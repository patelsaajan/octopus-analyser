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

type Refusal = { status: number; message: string }

// Turns the browser's request into the one sent to Octopus, or says why it won't be sent. The
// dashboard only reads, so mutations are refused: nobody who can reach the proxy can use it to
// change the account. Also fills in $accountNumber so the browser never needs to know it.
function readOnlyBody(rawBody: string, accountNumber: string | undefined): { body: string } | Refusal {
  let request: { query?: unknown; variables?: Record<string, unknown>; operationName?: unknown } | null
  try {
    request = JSON.parse(rawBody)
  } catch {
    return { status: 400, message: 'Expected a JSON body.' }
  }
  // Rules out a batch (an array of queries) as well as anything malformed.
  if (typeof request !== 'object' || request === null || Array.isArray(request) || typeof request.query !== 'string') {
    return { status: 400, message: 'Expected a single GraphQL query.' }
  }
  // Checked on the parsed text, where JSON escapes can no longer disguise the keyword. A query that
  // only mentions the word is refused too, which is the safe way round.
  if (/\bmutation\b/.test(request.query)) {
    return { status: 403, message: 'This proxy is read-only, so mutations are not forwarded.' }
  }
  const { query, variables, operationName } = request
  // Only the fields GraphQL defines are passed on.
  return {
    body: JSON.stringify({ query, operationName, variables: accountNumber ? { ...variables, accountNumber } : variables }),
  }
}

// Production counterpart of server/octopus-proxy.ts: proxies /graphql to Octopus with a Kraken
// token obtained from the API key, so the key stays on the Worker and never reaches the browser.
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (new URL(request.url).pathname !== '/graphql') return env.ASSETS.fetch(request)
    if (request.method !== 'POST') return new Response(null, { status: 405 })

    const forward = readOnlyBody(await request.text(), env.OCTOPUS_ACCOUNT_NUMBER)
    if ('status' in forward) {
      return Response.json({ errors: [{ message: forward.message }] }, { status: forward.status })
    }

    try {
      const upstream = await fetch(OCTOPUS_GRAPHQL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: await getToken(env.OCTOPUS_API_KEY) },
        body: forward.body,
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
