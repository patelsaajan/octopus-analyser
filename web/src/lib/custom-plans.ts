import type { Reading } from '@/lib/octopus'
import type { Priced, RatePeriod, Section } from '@/lib/products'
import { rateAt } from '@/lib/tariff'

// One stretch of the day at one price in pence per kWh. A band starts where the previous one ended (the first at
// midnight) and runs until its own `until` ("HH:mm"); the last band's `until` is "00:00", the following midnight.
// Chaining them this way means a plan always covers the whole day with no gaps or overlaps.
type CustomBand = { until: string; rate: number }

// A plan the user has typed in to compare against, with its standing charge in pence per day (0 for export).
export type CustomPlan = { id: string; section: Section; name: string; bands: CustomBand[]; standingCharge: number }

const MIDNIGHT = '00:00'

// Each band with the time it starts at.
export function bandTimes(bands: { until: string }[]): { from: string; until: string }[] {
  return bands.map((band, i) => ({ from: i === 0 ? MIDNIGHT : bands[i - 1].until, until: band.until }))
}

// "00:00 to 05:30 at 8p/kWh, 05:30 to 00:00 at 30p/kWh", or "25p/kWh all day" for a single band.
export function describeBands(plan: CustomPlan): string {
  if (plan.bands.length === 1) return `${plan.bands[0].rate}p/kWh all day`
  const times = bandTimes(plan.bands)
  return plan.bands.map((band, i) => `${times[i].from} to ${times[i].until} at ${band.rate}p/kWh`).join(', ')
}

// Prices each reading at the band its start falls in, in UK local time.
export function priceCustomPlan(readings: Reading[], plan: CustomPlan): Priced {
  const times = bandTimes(plan.bands)
  const tariff = {
    name: plan.name,
    timezone: 'Europe/London',
    timeslots: plan.bands.map((band, i) => ({
      timeslot: String(i),
      activeFrom: times[i].from,
      activeTo: times[i].until,
      rate: band.rate,
    })),
  }
  let pence = 0
  let pricedKwh = 0
  for (const reading of readings) {
    pence += reading.kwh * rateAt(reading.startAt, tariff)
    pricedKwh += reading.kwh
  }
  return { pounds: pence / 100, pricedKwh, unpricedKwh: 0 }
}

// The plan's flat standing charge as an open-ended rate period, the shape standingChargeTotal takes.
export function customStandingCharges(plan: CustomPlan): RatePeriod[] {
  return [{ from: new Date(0), to: null, rate: plan.standingCharge }]
}
