const OCTOPUS_GRAPHQL_URL = 'https://api.octopus.energy/v1/graphql/'

// Kraken tokens last 60 minutes; refresh a little early to avoid edge-of-expiry failures.
const TOKEN_TTL_MS = 55 * 60 * 1000

interface Env {
  // Secrets, uploaded by scripts/deploy.sh.
  OCTOPUS_API_KEY?: string
  OCTOPUS_ACCOUNT_NUMBER?: string
  ASSETS: { fetch(request: Request): Promise<Response> }
}

// Lives for as long as the isolate does. Holds the token itself rather than the pending
// request, because Workers cannot await a promise that was created by another request.
let cached: { token: string; expiresAt: number } | undefined

async function getToken(apiKey: string | undefined): Promise<string> {
  if (cached && cached.expiresAt > Date.now()) return cached.token
  if (!apiKey) throw new Error('OCTOPUS_API_KEY is not set. Run scripts/deploy.sh to upload it.')

  const res = await fetch(OCTOPUS_GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: 'mutation ($key: String!) { obtainKrakenToken(input: { APIKey: $key }) { token } }',
      variables: { key: apiKey },
    }),
  })
  const json: { data?: { obtainKrakenToken?: { token: string } }; errors?: unknown } = await res.json()
  const token = json.data?.obtainKrakenToken?.token
  if (!token) throw new Error(`Failed to obtain Kraken token: ${JSON.stringify(json?.errors ?? json)}`)

  cached = { token, expiresAt: Date.now() + TOKEN_TTL_MS }
  return token
}

// Fills in $accountNumber so the browser never needs to know it.
function withAccountNumber(rawBody: string, accountNumber: string | undefined): string {
  if (!accountNumber) return rawBody
  const body = JSON.parse(rawBody)
  return JSON.stringify({ ...body, variables: { ...body.variables, accountNumber } })
}

// Production counterpart of server/octopus-proxy.ts: proxies /graphql to Octopus with a Kraken
// token obtained from the API key, so the key stays on the Worker and never reaches the browser.
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (new URL(request.url).pathname !== '/graphql') return env.ASSETS.fetch(request)
    if (request.method !== 'POST') return new Response(null, { status: 405 })

    try {
      const upstream = await fetch(OCTOPUS_GRAPHQL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: await getToken(env.OCTOPUS_API_KEY) },
        body: withAccountNumber(await request.text(), env.OCTOPUS_ACCOUNT_NUMBER),
      })
      return new Response(upstream.body, {
        status: upstream.status,
        headers: { 'Content-Type': upstream.headers.get('content-type') ?? 'application/json' },
      })
    } catch (error) {
      return Response.json({ errors: [{ message: String(error) }] }, { status: 502 })
    }
  },
}
