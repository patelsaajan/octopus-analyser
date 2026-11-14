import { useEffect, useState } from 'react'
import { fetchGasTariffs, type GasTariff } from '@/lib/gas'

type GasTariffsState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; tariffs: GasTariff[] }

// One tariff request shared by the gas section and Settings; a failure is dropped so the next fetch retries.
let request: Promise<GasTariff[]> | undefined

export function loadGasTariffs(): Promise<GasTariff[]> {
  request ??= fetchGasTariffs().catch((error: unknown) => {
    request = undefined
    throw error
  })
  return request
}

export function useGasTariffs(): GasTariffsState {
  const [state, setState] = useState<GasTariffsState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    loadGasTariffs()
      .then((tariffs) => !cancelled && setState({ status: 'success', tariffs }))
      .catch((error: unknown) => {
        if (cancelled) return
        setState({ status: 'error', message: error instanceof Error ? error.message : String(error) })
      })
    return () => {
      cancelled = true
    }
  }, [])

  return state
}
