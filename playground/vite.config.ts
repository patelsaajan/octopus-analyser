import type { IncomingMessage } from 'node:http'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

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

// Proxies /graphql to Octopus and attaches a Kraken token obtained from the API key,
// so the key stays on the dev server and never reaches the browser.
function octopusProxy(apiKey: string | undefined): Plugin {
  let cached: { token: string; expiresAt: number } | undefined

  async function getToken(): Promise<string | undefined> {
    if (!apiKey) return undefined
    if (cached && cached.expiresAt > Date.now()) return cached.token

    const res = await fetch(OCTOPUS_GRAPHQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'mutation ($key: String!) { obtainKrakenToken(input: { APIKey: $key }) { token } }',
        variables: { key: apiKey },
      }),
    })
    const json = await res.json()
    const token: string | undefined = json?.data?.obtainKrakenToken?.token
    if (!token) throw new Error(`Failed to obtain Kraken token: ${JSON.stringify(json?.errors ?? json)}`)

    cached = { token, expiresAt: Date.now() + TOKEN_TTL_MS }
    return token
  }

  return {
    name: 'octopus-proxy',
    configureServer(server) {
      if (!apiKey) {
        server.config.logger.warn(
          'OCTOPUS_API_KEY is not set: requests will be unauthenticated (schema introspection still works).',
        )
      }

      server.middlewares.use('/graphql', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end()
          return
        }

        try {
          const token = await getToken()
          const upstream = await fetch(OCTOPUS_GRAPHQL_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token && { Authorization: token }),
            },
            body: await readBody(req),
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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'OCTOPUS_')
  return {
    plugins: [react(), octopusProxy(env.OCTOPUS_API_KEY)],
    // The account number isn't secret, so it's exposed to the browser to prefill the variables pane.
    define: {
      'import.meta.env.OCTOPUS_ACCOUNT_NUMBER': JSON.stringify(env.OCTOPUS_ACCOUNT_NUMBER ?? ''),
    },
    // graphiql and our own code must share one @graphiql/react instance, or the editor store isn't shared.
    resolve: {
      dedupe: ['@graphiql/react'],
    },
    // GraphiQL's Monaco workers use `?worker` imports, which the dep pre-bundler can't load.
    optimizeDeps: {
      exclude: ['graphiql/setup-workers/vite', '@graphiql/react/setup-workers/vite'],
    },
  }
})
