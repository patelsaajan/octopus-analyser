import 'graphiql/setup-workers/vite'
import 'graphiql/style.css'
import './index.css'

import { createTransport } from '@graphiql/toolkit'
import { GraphiQL } from 'graphiql'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { AccountNumberVariable } from './AccountNumberVariable'

// Same-origin URL: the Vite dev server proxies this to Octopus with auth attached.
const transport = createTransport({ url: '/graphql' })

const defaultQuery = `# Checks your API key works and lists your account numbers.
query Viewer {
  viewer {
    givenName
    accounts {
      number
    }
  }
}

# $accountNumber is filled in from OCTOPUS_ACCOUNT_NUMBER in .env.
query Account($accountNumber: String!) {
  account(accountNumber: $accountNumber) {
    number
    status
  }
}
`

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GraphiQL transport={transport} defaultQuery={defaultQuery} brand="Octopus" defaultEditorToolsVisibility="variables">
      <AccountNumberVariable />
    </GraphiQL>
  </StrictMode>,
)
