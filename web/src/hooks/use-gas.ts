import { useEffect, useState } from 'react'
import { loadGasTariffs } from '@/hooks/use-gas-tariffs'
import { fetchGasReadings, type GasTariff } from '@/lib/gas'
import type { Reading } from '@/lib/octopus'
import type { Period } from '@/lib/period'

export type GasResult =
  | { status: 'error'; message: string }
  // readings are daily (hourly for a day) and complete; hourly only feeds the time-of-day chart.
  | { status: 'success'; readings: Reading[]; hourly: Reading[]; tariffs: GasTariff[] }

export function useGas(period: Period): { status: 'loading' } | GasResult {
  const mode = period.mode
  const from = period.start.getTime()
  const key = `${mode}:${from}`

  // Results are tagged with the period they belong to, so a new period reads as loading without resetting state.
  const [result, setResult] = useState<{ key: string; value: GasResult }>()

  useEffect(() => {
    const controller = new AbortController()
    const key = `${mode}:${from}`

    const period = { mode, start: new Date(from) }
    const hourly = fetchGasReadings(period, 'HOUR_INTERVAL', controller.signal)
    // A day is charted by the hour anyway, so it skips the daily request.
    const readings = mode === 'day' ? hourly : fetchGasReadings(period, 'DAY_INTERVAL', controller.signal)

    Promise.all([readings, hourly, loadGasTariffs()])
      .then(([readings, hourly, tariffs]) => setResult({ key, value: { status: 'success', readings, hourly, tariffs } }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        const message = error instanceof Error ? error.message : String(error)
        setResult({ key, value: { status: 'error', message } })
      })

    return () => controller.abort()
  }, [mode, from])

  if (result?.key !== key) return { status: 'loading' }
  return result.value
}
