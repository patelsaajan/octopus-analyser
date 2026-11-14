import { pick, useGraphiQL } from '@graphiql/react'
import { useEffect } from 'react'

const accountNumber = import.meta.env.OCTOPUS_ACCOUNT_NUMBER

// Adds the account number from .env to the variables pane whenever the query declares $accountNumber,
// so the editor's variable validation is satisfied and the value is visible in the request.
export function AccountNumberVariable() {
  const { queryEditor, variableEditor } = useGraphiQL(pick('queryEditor', 'variableEditor'))

  useEffect(() => {
    if (!accountNumber || !queryEditor || !variableEditor) return

    const fill = () => {
      if (!/\$accountNumber\b/.test(queryEditor.getValue())) return

      let variables: Record<string, unknown>
      try {
        variables = JSON.parse(variableEditor.getValue().trim() || '{}')
      } catch {
        return // Leave hand-edited, mid-typing JSON alone.
      }
      if (variables.accountNumber !== undefined) return

      variableEditor.setValue(JSON.stringify({ ...variables, accountNumber }, null, 2))
    }

    fill()
    const subscription = queryEditor.onDidChangeModelContent(fill)
    return () => subscription.dispose()
  }, [queryEditor, variableEditor])

  return null
}
