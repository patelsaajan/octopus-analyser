import { useEffect, useState } from 'react'
import { fetchReadings, type Reading } from '@/lib/octopus'
import { periodEnd, type Period } from '@/lib/period'

type UsageResult =
  | { status: 'error'; message: string }
  | { status: 'success'; imported: Reading[]; exported: Reading[] }

type UsageState = { status: 'loading' } | UsageResult

export function useUsage(period: Period): UsageState {
  const from = period.start.getTime()
  const to = periodEnd(period).getTime()
  const key = `${from}:${to}`

  // Results are tagged with the range they belong to, so a new range reads as loading without resetting state.
  const [result, setResult] = useState<{ key: string; value: UsageResult }>()

  useEffect(() => {
    const controller = new AbortController()
    const key = `${from}:${to}`

    Promise.all([
      fetchReadings('CONSUMPTION', new Date(from), new Date(to), controller.signal),
      fetchReadings('GENERATION', new Date(from), new Date(to), controller.signal),
    ])
      .then(([imported, exported]) => setResult({ key, value: { status: 'success', imported, exported } }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        const message = error instanceof Error ? error.message : String(error)
        setResult({ key, value: { status: 'error', message } })
      })

    return () => controller.abort()
  }, [from, to])

  if (result?.key !== key) return { status: 'loading' }
  return result.value
}
