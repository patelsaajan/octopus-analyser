import type { Reading } from '@/lib/octopus'

// Octopus's public REST API: product names and dated unit rates for any tariff, no login needed.
const REST_URL = 'https://api.octopus.energy/v1'

// Export plans the current one is compared against.
export const COMPARISON_PRODUCTS = ['FLUX-EXPORT-23-02-14', 'OUTGOING-VAR-24-10-26']

// A unit rate in pence per kWh over [from, to); a null `to` runs on with no end.
export type RatePeriod = { from: Date; to: Date | null; rate: number }

type RatesPage = {
  next: string | null
  results: { value_inc_vat: number; valid_from: string; valid_to: string | null }[]
}

async function getJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`Octopus returned ${res.status} for ${url}`)
  return res.json()
}

export async function fetchProductName(productCode: string, signal: AbortSignal): Promise<string> {
  const product = await getJson<{ display_name: string }>(`${REST_URL}/products/${productCode}/`, signal)
  return product.display_name
}

// Every rate period overlapping [from, to) for a single-rate electricity tariff in the given region.
export async function fetchUnitRates(
  productCode: string,
  region: string,
  from: Date,
  to: Date,
  signal: AbortSignal,
): Promise<RatePeriod[]> {
  const params = new URLSearchParams({ period_from: from.toISOString(), period_to: to.toISOString(), page_size: '1500' })
  let url: string | null =
    `${REST_URL}/products/${productCode}/electricity-tariffs/E-1R-${productCode}-${region}/standard-unit-rates/?${params}`
  const rates: RatePeriod[] = []
  while (url) {
    const page: RatesPage = await getJson<RatesPage>(url, signal)
    for (const rate of page.results) {
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

export type Priced = { pounds: number; pricedKwh: number; unpricedKwh: number }

// Prices each reading at the rate in force when it started. Readings with no published rate (e.g. before a
// product launched) are counted separately rather than priced at zero.
export function priceReadings(readings: Reading[], rates: RatePeriod[]): Priced {
  let pence = 0
  let pricedKwh = 0
  let unpricedKwh = 0
  for (const reading of readings) {
    const at = reading.startAt.getTime()
    // rates is sorted by start, so binary search for the last period starting at or before the reading.
    let low = 0
    let high = rates.length - 1
    let found = -1
    while (low <= high) {
      const mid = (low + high) >> 1
      if (rates[mid].from.getTime() <= at) {
        found = mid
        low = mid + 1
      } else {
        high = mid - 1
      }
    }
    const rate = rates[found]
    if (rate && (rate.to === null || at < rate.to.getTime())) {
      pence += reading.kwh * rate.rate
      pricedKwh += reading.kwh
    } else {
      unpricedKwh += reading.kwh
    }
  }
  return { pounds: pence / 100, pricedKwh, unpricedKwh }
}
