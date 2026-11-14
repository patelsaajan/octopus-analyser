import { addMonths, eachMonthOfInterval, max, min, subMilliseconds } from 'date-fns'
import { timeOfDay, type Tariff, type Tariffs, type Timeslot } from '@/lib/tariff'

export type Direction = 'CONSUMPTION' | 'GENERATION'

export type Reading = {
  startAt: Date
  endAt: Date
  kwh: number
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

// One direction per query so each can page independently; $accountNumber is filled in by the server proxy.
const USAGE_QUERY = `
  query Usage(
    $accountNumber: String!
    $startAt: DateTime!
    $endAt: DateTime!
    $direction: ReadingDirectionType!
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
          utilityFilters: [{
            electricityFilters: {
              readingFrequencyType: THIRTY_MIN_INTERVAL
              readingDirection: $direction
            }
          }]
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

const ACCOUNT_QUERY = `
  query Account($accountNumber: String!) {
    account(accountNumber: $accountNumber) {
      number
      status
      accountType
      balance
      createdAt
    }
    viewer {
      fullName
      email
      mobile
    }
  }
`

export type AccountDetails = {
  number: string
  status: string
  accountType: string
  // Pence, as the API returns it.
  balance: number
  createdAt: Date
  holder: { fullName: string; email: string; mobile: string | null }
}

type AccountData = {
  account: Omit<AccountDetails, 'createdAt' | 'holder'> & { createdAt: string }
  viewer: AccountDetails['holder']
}

export async function graphql<T>(query: string, variables: Record<string, unknown>, signal?: AbortSignal): Promise<T | undefined> {
  const res = await fetch('/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    signal,
  })
  const json: { data?: T; errors?: { message: string }[] } = await res.json()
  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join('\n'))
  return json.data
}

const TARIFF_QUERY = `
  query TariffTimes($accountNumber: String!) {
    account(accountNumber: $accountNumber) {
      properties {
        electricityMeterPoints {
          mpan
          agreements(excludeFuture: true) {
            validFrom
            validTo
            timeOfUseScheme {
              timezone
              timeslots {
                timeslot
                activeFrom
                activeTo
              }
            }
            tariff {
              __typename
              ... on HalfHourlyTariff {
                displayName
                productCode
                tariffCode
                unitRates {
                  value
                  rateType
                  validFrom
                  validTo
                }
              }
            }
          }
        }
      }
    }
  }
`

type Validity = { validFrom: string; validTo: string | null }

type TariffData = {
  account: {
    properties: {
      electricityMeterPoints: {
        mpan: string
        agreements: (Validity & {
          timeOfUseScheme: {
            timezone: string
            timeslots: { timeslot: string; activeFrom: string; activeTo: string }[]
          } | null
          tariff: {
            __typename: string
            displayName?: string
            productCode?: string
            tariffCode?: string
            unitRates?: (Validity & { value: number; rateType: string })[]
          }
        })[]
      }[]
    }[]
  }
}

const isCurrent = ({ validFrom, validTo }: Validity, now = new Date()) =>
  new Date(validFrom) <= now && (validTo === null || now < new Date(validTo))

type Agreement = TariffData['account']['properties'][number]['electricityMeterPoints'][number]['agreements'][number]
type UnitRate = NonNullable<Agreement['tariff']['unitRates']>[number]

// Export rates come as dated periods (9p until 16:00, 16p until 19:00, and so on) rather than a time-of-use
// scheme, so the daily pattern is read off each period's local start and end times. Later periods win a clash.
function slotsFromPeriods(rates: UnitRate[], timezone: string): Timeslot[] {
  const slots = new Map<string, Timeslot>()
  const byStart = [...rates].sort((a, b) => new Date(a.validFrom).getTime() - new Date(b.validFrom).getTime())
  for (const rate of byStart) {
    const activeFrom = timeOfDay(new Date(rate.validFrom), timezone)
    // An open-ended rate applies all day, which equal start and end times stand for.
    const activeTo = rate.validTo ? timeOfDay(new Date(rate.validTo), timezone) : activeFrom
    slots.set(`${activeFrom}-${activeTo}`, { timeslot: rate.rateType, activeFrom, activeTo, rate: rate.value })
  }
  return [...slots.values()]
}

function tariffOf(agreement: Agreement & { mpan: string }, timezone: string, timeslots: Timeslot[]): Tariff {
  return {
    name: agreement.tariff.displayName ?? 'Unknown tariff',
    mpan: agreement.mpan,
    productCode: agreement.tariff.productCode ?? '',
    tariffCode: agreement.tariff.tariffCode ?? '',
    validFrom: new Date(agreement.validFrom),
    validTo: agreement.validTo ? new Date(agreement.validTo) : null,
    timezone,
    timeslots,
  }
}

// Reads the current import and export tariffs. Only the import meter point has a time-of-use scheme, which is how
// the two are told apart: import pairs each scheme timeslot with the unit rate whose rateType matches it, and
// export builds its timeslots from its dated rate periods.
export async function fetchTariffs(signal?: AbortSignal): Promise<Tariffs> {
  const data = await graphql<TariffData>(TARIFF_QUERY, {}, signal)
  const agreements = (
    data?.account.properties.flatMap((property) =>
      property.electricityMeterPoints.flatMap((meterPoint) =>
        meterPoint.agreements.map((agreement) => ({ ...agreement, mpan: meterPoint.mpan })),
      ),
    ) ?? []
  ).filter((agreement) => isCurrent(agreement) && agreement.tariff.unitRates)

  const importAgreement = agreements.find((agreement) => agreement.timeOfUseScheme)
  const exportAgreement = agreements.find((agreement) => !agreement.timeOfUseScheme)
  if (!importAgreement?.timeOfUseScheme) throw new Error('No current import tariff with time-of-use rates was found.')
  if (!exportAgreement) throw new Error('No current export tariff was found.')

  const scheme = importAgreement.timeOfUseScheme
  const importRates = importAgreement.tariff.unitRates?.filter((rate) => isCurrent(rate)) ?? []
  const importSlots = scheme.timeslots.map(({ timeslot, activeFrom, activeTo }) => {
    const rate = importRates.find((rate) => rate.rateType === timeslot)
    if (!rate) throw new Error(`The import tariff has no current rate for its ${timeslot} timeslot.`)
    return { timeslot, activeFrom, activeTo, rate: rate.value }
  })

  // Export has no scheme to name a timezone, so it follows import's.
  return {
    import: tariffOf(importAgreement, scheme.timezone, importSlots),
    export: tariffOf(exportAgreement, scheme.timezone, slotsFromPeriods(exportAgreement.tariff.unitRates ?? [], scheme.timezone)),
  }
}

const AVAILABLE_PRODUCTS_QUERY = `
  query AvailableProducts($accountNumber: String!, $mpans: [String]!, $availableAt: DateTime!) {
    availableProductsForMeterPoint(accountNumber: $accountNumber, mpxns: $mpans, availableAt: $availableAt) {
      products {
        code
        displayName
        availableFrom
        isDomestic
        isHidden
      }
    }
  }
`

type AvailableProductsData = {
  availableProductsForMeterPoint: {
    products: { code: string; displayName: string; availableFrom: string; isDomestic: boolean | null; isHidden: boolean }[]
  }[]
}

// Codes of the domestic plans Octopus says a meter point can switch to now. Some plans are listed in several
// versions under one name (e.g. two Smart Export Guarantee products), so only the newest of each name is kept.
export async function fetchAvailableProducts(mpan: string, signal: AbortSignal): Promise<string[]> {
  const data = await graphql<AvailableProductsData>(
    AVAILABLE_PRODUCTS_QUERY,
    { mpans: [mpan], availableAt: new Date().toISOString() },
    signal,
  )
  const newestByName = new Map<string, { code: string; availableFrom: string }>()
  for (const product of data?.availableProductsForMeterPoint[0]?.products ?? []) {
    if (product.isHidden || product.isDomestic === false) continue
    const seen = newestByName.get(product.displayName)
    if (!seen || new Date(product.availableFrom) > new Date(seen.availableFrom)) {
      newestByName.set(product.displayName, product)
    }
  }
  return [...newestByName.values()].map(({ code }) => code)
}

// The proxy fills in the account number on every query, so asking the API for it is how the browser learns it.
// viewer is the person the API key belongs to, i.e. the account holder.
export async function fetchAccountDetails(signal: AbortSignal): Promise<AccountDetails | undefined> {
  const data = await graphql<AccountData>(ACCOUNT_QUERY, {}, signal)
  if (!data) return undefined
  return { ...data.account, createdAt: new Date(data.account.createdAt), holder: data.viewer }
}

// Fetches every half-hourly reading in [startAt, endAt) for one direction, following pagination cursors.
async function fetchRange(
  direction: Direction,
  startAt: Date,
  endAt: Date,
  signal: AbortSignal,
): Promise<Reading[]> {
  const readings: Reading[] = []
  let after: string | null = null

  do {
    const data = await graphql<MeasurementsData>(
      USAGE_QUERY,
      { startAt: startAt.toISOString(), endAt: endAt.toISOString(), direction, after },
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

// Splits the range into calendar months fetched in parallel, so a year (around 17,500 readings) isn't paged in series.
// Readings stay half-hourly whatever the chart shows, because the time-of-use rates change on the half hour.
export async function fetchReadings(
  direction: Direction,
  startAt: Date,
  endAt: Date,
  signal: AbortSignal,
): Promise<Reading[]> {
  const months = eachMonthOfInterval({ start: startAt, end: subMilliseconds(endAt, 1) })
  const chunks = await Promise.all(
    months.map((month) =>
      fetchRange(direction, max([month, startAt]), min([addMonths(month, 1), endAt]), signal),
    ),
  )
  return chunks.flat()
}
