import type { IncomingMessage } from 'node:http'
import type { Plugin } from 'vite'

const OCTOPUS_GRAPHQL_URL = 'https://api.octopus.energy/v1/graphql/'

// Kraken tokens last 60 minutes; refresh a little early to avoid edge-of-expiry failures.
const TOKEN_TTL_MS = 55 * 60 * 1000

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk) => (body += chunk))
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
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

// Dev-only stand-in for the production backend: proxies /graphql to Octopus with a Kraken
// token obtained from the API key, so the key stays on the server and never reaches the browser.
export function octopusProxy(apiKey: string | undefined, accountNumber: string | undefined): Plugin {
  let cached: { token: Promise<string>; expiresAt: number } | undefined

  // Caches the request itself, so a burst of parallel queries shares one token fetch.
  function getToken(): Promise<string> {
    if (cached && cached.expiresAt > Date.now()) return cached.token
    const token = requestToken()
    cached = { token, expiresAt: Date.now() + TOKEN_TTL_MS }
    // A failed fetch is dropped so the next query retries instead of reusing the rejection.
    token.catch(() => {
      if (cached?.token === token) cached = undefined
    })
    return token
  }

  async function requestToken(): Promise<string> {
    if (!apiKey) throw new Error('OCTOPUS_API_KEY is not set. Add it to web/.env and restart the dev server.')

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
    return token
  }

  return {
    name: 'octopus-proxy',
    configureServer(server) {
      if (!apiKey || !accountNumber) {
        server.config.logger.warn('OCTOPUS_API_KEY and OCTOPUS_ACCOUNT_NUMBER must both be set in web/.env.')
      }

      server.middlewares.use('/graphql', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end()
          return
        }

        const forward = readOnlyBody(await readBody(req), accountNumber)
        if ('status' in forward) {
          res.statusCode = forward.status
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ errors: [{ message: forward.message }] }))
          return
        }

        try {
          const upstream = await fetch(OCTOPUS_GRAPHQL_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: await getToken() },
            body: forward.body,
          })
          res.statusCode = upstream.status
          res.setHeader('Content-Type', upstream.headers.get('content-type') ?? 'application/json')
          res.end(await upstream.text())
        } catch (error) {
          res.statusCode = 502
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ errors: [{ message: String(error) }] }))
        }
      })
    },
  }
}
