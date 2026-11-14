import { useEffect, useState } from 'react'
import { periodEnd, type Period } from '@/lib/period'
import { COMPARISON_PRODUCTS, fetchProductName, fetchUnitRates, type RatePeriod } from '@/lib/products'
import type { Tariffs } from '@/lib/tariff'

export type ExportPlan = { productCode: string; name: string; current: boolean; rates: RatePeriod[] }

type PlansResult = { status: 'error'; message: string } | { status: 'success'; plans: ExportPlan[] }

type PlansState = { status: 'loading' } | PlansResult

// The current export plan plus the comparison plans, with their rates for the period in the account's region.
// The current plan is matched by product code, so it appears once with current set rather than twice.
export function useExportPlans(period: Period, tariffs: Tariffs | undefined): PlansState {
  const from = period.start.getTime()
  const to = periodEnd(period).getTime()
  const currentCode = tariffs?.export.productCode
  // The tariff code ends in the region letter, e.g. E-1R-OUTGOING-PRIME-FIX-12M-26-06-23-K.
  const region = tariffs?.export.tariffCode.slice(-1)
  const key = currentCode && region ? `${from}:${to}:${currentCode}:${region}` : undefined

  // Results are tagged with the request they belong to, so a new period reads as loading without resetting state.
  const [result, setResult] = useState<{ key: string; value: PlansResult }>()

  useEffect(() => {
    if (!currentCode || !region) return

    const controller = new AbortController()
    const key = `${from}:${to}:${currentCode}:${region}`
    const codes = [currentCode, ...COMPARISON_PRODUCTS.filter((code) => code !== currentCode)]

    Promise.all(
      codes.map(async (productCode) => {
        const [name, rates] = await Promise.all([
          fetchProductName(productCode, controller.signal),
          fetchUnitRates(productCode, region, new Date(from), new Date(to), controller.signal),
        ])
        return { productCode, name, current: productCode === currentCode, rates }
      }),
    )
      .then((plans) => setResult({ key, value: { status: 'success', plans } }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        const message = error instanceof Error ? error.message : String(error)
        setResult({ key, value: { status: 'error', message } })
      })

    return () => controller.abort()
  }, [from, to, currentCode, region])

  if (key === undefined || result?.key !== key) return { status: 'loading' }
  return result.value
}
