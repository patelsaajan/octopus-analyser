export type Direction = 'CONSUMPTION' | 'GENERATION'

export type Reading = {
  startAt: Date
  endAt: Date
  kwh: number
}

type MeasurementsPage = {
  data?: {
    account: {
      properties: {
        measurements: {
          edges: { node: { value: string; unit: string; startAt?: string; endAt?: string } }[]
          pageInfo: { hasNextPage: boolean; endCursor: string | null }
        }
      }[]
    }
  }
  errors?: { message: string }[]
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
          first: 100
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

async function fetchPage(variables: Record<string, unknown>, signal: AbortSignal): Promise<MeasurementsPage> {
  const res = await fetch('/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: USAGE_QUERY, variables }),
    signal,
  })
  const json: MeasurementsPage = await res.json()
  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join('\n'))
  return json
}

// Fetches every half-hourly reading in [startAt, endAt) for one direction, following pagination cursors.
export async function fetchReadings(
  direction: Direction,
  startAt: Date,
  endAt: Date,
  signal: AbortSignal,
): Promise<Reading[]> {
  const readings: Reading[] = []
  let after: string | null = null

  do {
    const page = await fetchPage(
      { startAt: startAt.toISOString(), endAt: endAt.toISOString(), direction, after },
      signal,
    )
    // The account has one property (the house), so only the first is read.
    const measurements = page.data?.account.properties[0]?.measurements
    if (!measurements) break

    for (const { node } of measurements.edges) {
      if (!node.startAt || !node.endAt) continue
      readings.push({ startAt: new Date(node.startAt), endAt: new Date(node.endAt), kwh: Number(node.value) })
    }
    after = measurements.pageInfo.hasNextPage ? measurements.pageInfo.endCursor : null
  } while (after)

  return readings
}
