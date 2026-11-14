import { eachDayOfInterval, min, subMilliseconds } from 'date-fns'
import type { Reading } from '@/lib/octopus'
import { periodEnd, type Period } from '@/lib/period'

// Octopus's public REST API: product names and dated rates for any tariff, no login needed.
const REST_URL = 'https://api.octopus.energy/v1'

// Import plans the current one is compared against. Export asks the API which plans the meter can switch to, but
// for import that list leaves out every plan that needs kit to join (Go, Cosy, Agile, Flux), so these are chosen
// by hand instead.
const IMPORT_COMPARISON_PRODUCTS = [
  'VAR-22-11-01',
  'GO-VAR-22-10-14',
  'AGILE-24-10-01',
  'COSY-22-12-08',
  'FLUX-IMPORT-23-02-14',
]

// The three things a plan can be compared on: electricity bought, electricity sold, and gas bought.
export type Section = 'import' | 'export' | 'gas'

export const SECTIONS: Record<
  Section,
  {
    fuel: 'electricity' | 'gas'
    // Whether lower totals are better (a cost) or higher ones (earnings).
    isCost: boolean
    hasStandingCharge: boolean
    // Whether the price can vary through the day. Gas readings are daily, so a time of day means nothing for them.
    timeOfUse: boolean
    // Hand-picked plans, or those Octopus lists as available to the meter point.
    comparisons: string[] | 'available'
  }
> = {
  import: { fuel: 'electricity', isCost: true, hasStandingCharge: true, timeOfUse: true, comparisons: IMPORT_COMPARISON_PRODUCTS },
  export: { fuel: 'electricity', isCost: false, hasStandingCharge: false, timeOfUse: true, comparisons: 'available' },
  gas: { fuel: 'gas', isCost: true, hasStandingCharge: true, timeOfUse: false, comparisons: 'available' },
}

// A rate in pence (per kWh, or per day for a standing charge) over [from, to); a null `to` runs on with no end.
export type RatePeriod = { from: Date; to: Date | null; rate: number }

type RatesPage = {
  next: string | null
  results: { value_inc_vat: number; valid_from: string; valid_to: string | null; payment_method: string | null }[]
}

async function getJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`Octopus returned ${res.status} for ${url}`)
  return res.json()
}

export async function fetchProduct(
  productCode: string,
  signal: AbortSignal,
): Promise<{ name: string; description: string }> {
  const product = await getJson<{ display_name: string; description: string }>(
    `${REST_URL}/products/${productCode}/`,
    signal,
  )
  return { name: product.display_name, description: product.description }
}

// Every unit rate or standing charge period overlapping [from, to) for a single-rate tariff in a region.
export async function fetchRates(
  kind: 'standard-unit-rates' | 'standing-charges',
  fuel: 'electricity' | 'gas',
  productCode: string,
  region: string,
  from: Date,
  to: Date,
  signal: AbortSignal,
): Promise<RatePeriod[]> {
  const params = new URLSearchParams({ period_from: from.toISOString(), period_to: to.toISOString(), page_size: '1500' })
  const tariffCode = `${fuel === 'gas' ? 'G' : 'E'}-1R-${productCode}-${region}`
  let url: string | null = `${REST_URL}/products/${productCode}/${fuel}-tariffs/${tariffCode}/${kind}/?${params}`
  const rates: RatePeriod[] = []
  while (url) {
    const page: RatesPage = await getJson<RatesPage>(url, signal)
    for (const rate of page.results) {
      // Some plans (e.g. Flexible Octopus) list direct debit and dearer non direct debit prices side by side;
      // direct debit is assumed, and plans with one price leave payment_method null.
      if (rate.payment_method !== null && rate.payment_method !== 'DIRECT_DEBIT') continue
      rates.push({
        from: new Date(rate.valid_from),
        to: rate.valid_to ? new Date(rate.valid_to) : null,
        rate: rate.value_inc_vat,
      })
    }
    url = page.next
  }
  return rates.sort((a, b) => a.from.getTime() - b.from.getTime())
}

// A newly launched fixed plan publishes one open-ended rate from its launch, so it has no rate for earlier dates.
// Its price is fixed, so that rate is a fair stand-in for earlier dates too; time-of-use plans get no such stand-in.
function launchRate(rates: RatePeriod[]): RatePeriod | undefined {
  return rates.length === 1 && rates[0].to === null ? rates[0] : undefined
}

// The rate in force at a moment, from periods sorted by start; undefined if none covers it.
function rateAt(at: Date, rates: RatePeriod[]): number | undefined {
  const time = at.getTime()
  // Binary search for the last period starting at or before the moment.
  let low = 0
  let high = rates.length - 1
  let found = -1
  while (low <= high) {
    const mid = (low + high) >> 1
    if (rates[mid].from.getTime() <= time) {
      found = mid
      low = mid + 1
    } else {
      high = mid - 1
    }
  }
  const rate = rates[found]
  return rate && (rate.to === null || time < rate.to.getTime()) ? rate.rate : undefined
}

export type Priced = { pounds: number; pricedKwh: number; unpricedKwh: number }

// Prices each reading at the rate in force when it started, or a fixed plan's launch rate before it launched. Other
// readings with no published rate are counted separately rather than priced at zero.
export function priceReadings(readings: Reading[], rates: RatePeriod[]): Priced {
  const launch = launchRate(rates)
  let pence = 0
  let pricedKwh = 0
  let unpricedKwh = 0
  for (const reading of readings) {
    let rate = rateAt(reading.startAt, rates)
    if (rate === undefined && launch && reading.startAt < launch.from) rate = launch.rate
    if (rate === undefined) {
      unpricedKwh += reading.kwh
    } else {
      pence += reading.kwh * rate
      pricedKwh += reading.kwh
    }
  }
  return { pounds: pence / 100, pricedKwh, unpricedKwh }
}

// Standing charges in pounds for each day of the period that has started, at the charge in force that day.
export function standingChargeTotal(period: Period, charges: RatePeriod[], now = new Date()): number {
  const end = min([periodEnd(period), now])
  if (end <= period.start) return 0
  const days = eachDayOfInterval({ start: period.start, end: subMilliseconds(end, 1) })
  const launch = launchRate(charges)
  const chargeOn = (day: Date) => rateAt(day, charges) ?? (launch && day < launch.from ? launch.rate : 0)
  return days.reduce((total, day) => total + chargeOn(day), 0) / 100
}
