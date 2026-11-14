import { useEffect, useState } from 'react'
import type { DateRange } from 'react-day-picker'
import { addDays, startOfDay } from 'date-fns'
import { fetchReadings, type Reading } from '@/lib/octopus'

type UsageResult =
  | { status: 'error'; message: string }
  | { status: 'success'; imported: Reading[]; exported: Reading[] }

type UsageState = { status: 'idle' } | { status: 'loading' } | UsageResult

export function useUsage(range: DateRange | undefined): UsageState {
  const from = range?.from?.getTime()
  const to = range?.to?.getTime()
  const key = from !== undefined && to !== undefined ? `${from}:${to}` : undefined

  // Results are tagged with the range they belong to, so a new range reads as loading without resetting state.
  const [result, setResult] = useState<{ key: string; value: UsageResult }>()

  useEffect(() => {
    if (from === undefined || to === undefined) return

    const controller = new AbortController()
    const key = `${from}:${to}`
    // The picker's end date is inclusive, so fetch up to the start of the following day.
    const startAt = startOfDay(from)
    const endAt = addDays(startOfDay(to), 1)

    Promise.all([
      fetchReadings('CONSUMPTION', startAt, endAt, controller.signal),
      fetchReadings('GENERATION', startAt, endAt, controller.signal),
    ])
      .then(([imported, exported]) => setResult({ key, value: { status: 'success', imported, exported } }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        const message = error instanceof Error ? error.message : String(error)
        setResult({ key, value: { status: 'error', message } })
      })

    return () => controller.abort()
  }, [from, to])

  if (key === undefined) return { status: 'idle' }
  if (result?.key !== key) return { status: 'loading' }
  return result.value
}
