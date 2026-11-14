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

// Fills in $accountNumber so the browser never needs to know it.
function withAccountNumber(rawBody: string, accountNumber: string | undefined): string {
  if (!accountNumber) return rawBody
  const body = JSON.parse(rawBody)
  return JSON.stringify({ ...body, variables: { ...body.variables, accountNumber } })
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

        try {
          const upstream = await fetch(OCTOPUS_GRAPHQL_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: await getToken() },
            body: withAccountNumber(await readBody(req), accountNumber),
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
