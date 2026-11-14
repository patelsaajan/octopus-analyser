import { addMonths, eachDayOfInterval, eachMonthOfInterval, max, min, subMilliseconds } from 'date-fns'
import { graphql, type Reading } from '@/lib/octopus'
import { periodEnd, type Period } from '@/lib/period'

// A gas agreement's flat tariff: unit rate in pence per kWh and standing charge in pence per day, both including VAT.
export type GasTariff = {
  name: string
  // The gas meter point the agreement is on.
  mprn: string
  productCode: string
  // e.g. G-1R-VAR-22-11-01-K, whose last letter is the region.
  tariffCode: string
  validFrom: Date
  validTo: Date | null
  unitRate: number
  standingCharge: number
}

type MeasurementsData = {
  account: {
    properties: {
      measurements: {
        edges: { node: { value: string; unit: string; startAt?: string; endAt?: string } }[]
        pageInfo: { hasNextPage: boolean; endCursor: string | null }
      }
    }[]
  }
}

// The meter reports in kWh (Octopus converts from cubic metres). $accountNumber is filled in by the server proxy.
const GAS_USAGE_QUERY = `
  query GasUsage(
    $accountNumber: String!
    $startAt: DateTime!
    $endAt: DateTime!
    $frequency: ReadingFrequencyType!
    $after: String
  ) {
    account(accountNumber: $accountNumber) {
      properties {
        measurements(
          startAt: $startAt
          endAt: $endAt
          timezone: "Europe/London"
          first: 1000
          after: $after
          utilityFilters: [{ gasFilters: { readingFrequencyType: $frequency } }]
        ) {
          edges {
            node {
              value
              unit
              ... on IntervalMeasurementType {
                startAt
                endAt
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    }
  }
`

const GAS_TARIFF_QUERY = `
  query GasTariffs($accountNumber: String!) {
    account(accountNumber: $accountNumber) {
      properties {
        gasMeterPoints {
          mprn
          agreements(excludeFuture: true) {
            validFrom
            validTo
            tariff {
              __typename
              ... on GasTariffType {
                displayName
                productCode
                tariffCode
                unitRate
                standingCharge
              }
            }
          }
        }
      }
    }
  }
`

type GasTariffData = {
  account: {
    properties: {
      gasMeterPoints: {
        mprn: string
        agreements: {
          validFrom: string
          validTo: string | null
          tariff: {
            __typename: string
            displayName?: string
            productCode?: string
            tariffCode?: string
            unitRate?: number
            standingCharge?: number
          }
        }[]
      }[]
    }[]
  }
}

// Every past and current gas agreement, so a period before the latest tariff change is priced at the rates then.
export async function fetchGasTariffs(signal?: AbortSignal): Promise<GasTariff[]> {
  const data = await graphql<GasTariffData>(GAS_TARIFF_QUERY, {}, signal)
  const agreements =
    data?.account.properties.flatMap((property) =>
      property.gasMeterPoints.flatMap((meterPoint) =>
        meterPoint.agreements.map((agreement) => ({ ...agreement, mprn: meterPoint.mprn })),
      ),
    ) ?? []

  return agreements.flatMap(({ validFrom, validTo, tariff, mprn }) =>
    tariff.unitRate === undefined || tariff.standingCharge === undefined
      ? []
      : [
          {
            name: tariff.displayName ?? 'Unknown tariff',
            mprn,
            productCode: tariff.productCode ?? '',
            tariffCode: tariff.tariffCode ?? '',
            validFrom: new Date(validFrom),
            validTo: validTo ? new Date(validTo) : null,
            unitRate: tariff.unitRate,
            standingCharge: tariff.standingCharge,
          },
        ],
  )
}

export function gasTariffAt(date: Date, tariffs: GasTariff[]): GasTariff | undefined {
  return tariffs.find(({ validFrom, validTo }) => validFrom <= date && (validTo === null || date < validTo))
}

// The tariff in force at the end of the period, or now for the current one.
export function latestGasTariff(period: Period, tariffs: GasTariff[], now = new Date()): GasTariff | undefined {
  return gasTariffAt(min([subMilliseconds(periodEnd(period), 1), now]), tariffs)
}

// Gas has a flat rate, so it's fetched no finer than the chart's bars: hourly for a day, daily otherwise.
// A year of daily readings fits in one page, so unlike electricity there's no need to split the range by month.
export type GasFrequency = 'HOUR_INTERVAL' | 'DAY_INTERVAL'

// Readings for [startAt, endAt) at the given frequency, following pagination cursors.
async function fetchGasRange(startAt: Date, endAt: Date, frequency: GasFrequency, signal: AbortSignal): Promise<Reading[]> {
  const readings: Reading[] = []
  let after: string | null = null

  do {
    const data = await graphql<MeasurementsData>(
      GAS_USAGE_QUERY,
      { startAt: startAt.toISOString(), endAt: endAt.toISOString(), frequency, after },
      signal,
    )
    // The account has one property (the house), so only the first is read.
    const measurements = data?.account.properties[0]?.measurements
    if (!measurements) break

    for (const { node } of measurements.edges) {
      if (!node.startAt || !node.endAt) continue
      readings.push({ startAt: new Date(node.startAt), endAt: new Date(node.endAt), kwh: Number(node.value) })
    }
    after = measurements.pageInfo.hasNextPage ? measurements.pageInfo.endCursor : null
  } while (after)

  return readings
}

// Hourly readings have occasional gaps that the daily ones don't (October 2026 is missing about a day of hours), so
// totals use daily readings and hourly ones are only for seeing when gas is used. Periods are split into calendar
// months fetched in parallel, so a year of hourly readings (around 8,760) isn't paged in series.
export async function fetchGasReadings(period: Period, frequency: GasFrequency, signal: AbortSignal): Promise<Reading[]> {
  const endAt = periodEnd(period)
  const months = eachMonthOfInterval({ start: period.start, end: subMilliseconds(endAt, 1) })
  const chunks = await Promise.all(
    months.map((month) => fetchGasRange(max([month, period.start]), min([addMonths(month, 1), endAt]), frequency, signal)),
  )
  return chunks.flat()
}

// A reading's unit cost in pounds, or undefined when no agreement covers it.
export function gasCost(reading: Reading, tariffs: GasTariff[]): number | undefined {
  const tariff = gasTariffAt(reading.startAt, tariffs)
  return tariff && (reading.kwh * tariff.unitRate) / 100
}

// Standing charges in pounds for each day of the period that has started, on whichever agreement covered it.
export function gasStandingCharges(period: Period, tariffs: GasTariff[], now = new Date()): number {
  const end = min([periodEnd(period), now])
  if (end <= period.start) return 0
  const days = eachDayOfInterval({ start: period.start, end: subMilliseconds(end, 1) })
  return days.reduce((total, day) => total + (gasTariffAt(day, tariffs)?.standingCharge ?? 0) / 100, 0)
}
