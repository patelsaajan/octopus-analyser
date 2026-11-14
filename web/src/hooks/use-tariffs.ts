import { useEffect, useState } from 'react'
import { fetchTariffs } from '@/lib/octopus'
import type { Tariffs } from '@/lib/tariff'

type TariffsState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; tariffs: Tariffs }

// One request shared by every component that needs the tariffs; a failure is dropped so the next mount retries.
let request: Promise<Tariffs> | undefined

function loadTariffs(): Promise<Tariffs> {
  request ??= fetchTariffs().catch((error: unknown) => {
    request = undefined
    throw error
  })
  return request
}

export function useTariffs(): TariffsState {
  const [state, setState] = useState<TariffsState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    loadTariffs()
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
