import { max } from 'date-fns'
import { useEffect, useState } from 'react'
import { fetchAvailableProducts } from '@/lib/octopus'
import { periodEnd, type Period } from '@/lib/period'
import { fetchProduct, fetchRates, SECTIONS, type RatePeriod, type Section } from '@/lib/products'

// The plan an account is on for a section: its product, the region letter its tariff code ends in, and the meter
// point (MPAN or MPRN) it's on.
export type CurrentPlan = { productCode: string; region: string; meter: string }

// unitRates is empty for the current plan, which is priced from the account's own tariff instead (its product may
// not publish unit rates, as Intelligent Octopus Go doesn't). standingCharges is empty for export, which has none.
export type Plan = {
  productCode: string
  name: string
  description: string
  current: boolean
  unitRates: RatePeriod[]
  standingCharges: RatePeriod[]
}

type PlansResult = { status: 'error'; message: string } | { status: 'success'; plans: Plan[] }

type PlansState = { status: 'loading' } | PlansResult

// The current plan for a section plus the plans it's compared against, with their rates in the account's region.
// The current plan is matched by product code, so it appears once with current set rather than twice.
export function usePlans(section: Section, period: Period, current: CurrentPlan | undefined): PlansState {
  const from = period.start.getTime()
  const to = periodEnd(period).getTime()
  const { productCode: currentCode, region, meter } = current ?? {}
  const key = currentCode && region && meter ? `${section}:${from}:${to}:${currentCode}:${region}` : undefined

  // Results are tagged with the request they belong to, so a new period reads as loading without resetting state.
  const [result, setResult] = useState<{ key: string; value: PlansResult }>()

  useEffect(() => {
    if (!currentCode || !region || !meter) return

    const controller = new AbortController()
    const key = `${section}:${from}:${to}:${currentCode}:${region}`
    const { fuel, hasStandingCharge, comparisons } = SECTIONS[section]
    const comparisonCodes =
      comparisons === 'available' ? fetchAvailableProducts(meter, controller.signal) : Promise.resolve(comparisons)
    // Rates run up to today rather than the period's end, so a fixed plan launched since still returns its rate.
    const ratesTo = max([new Date(to), new Date()])
    const rates = (kind: Parameters<typeof fetchRates>[0], productCode: string) =>
      fetchRates(kind, fuel, productCode, region, new Date(from), ratesTo, controller.signal)

    const loadPlan = async (productCode: string): Promise<Plan> => {
      const isCurrent = productCode === currentCode
      const [{ name, description }, unitRates, standingCharges] = await Promise.all([
        fetchProduct(productCode, controller.signal),
        isCurrent ? [] : rates('standard-unit-rates', productCode),
        hasStandingCharge ? rates('standing-charges', productCode) : [],
      ])
      return { productCode, name, description, current: isCurrent, unitRates, standingCharges }
    }

    comparisonCodes
      .then((comparisons) =>
        Promise.all([currentCode, ...comparisons.filter((code) => code !== currentCode)].map(loadPlan)),
      )
      .then((plans) => setResult({ key, value: { status: 'success', plans } }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        const message = error instanceof Error ? error.message : String(error)
        setResult({ key, value: { status: 'error', message } })
      })

    return () => controller.abort()
  }, [section, from, to, currentCode, region, meter])

  if (key === undefined || result?.key !== key) return { status: 'loading' }
  return result.value
}
