import { addMonths, eachMonthOfInterval, max, min, subMilliseconds } from 'date-fns'

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
    }
  }
`

async function graphql<T>(query: string, variables: Record<string, unknown>, signal: AbortSignal): Promise<T | undefined> {
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

// The proxy fills in the account number on every query, so asking the API for it is how the browser learns it.
export async function fetchAccountNumber(signal: AbortSignal): Promise<string | undefined> {
  const data = await graphql<{ account: { number: string } }>(ACCOUNT_QUERY, {}, signal)
  return data?.account.number
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
