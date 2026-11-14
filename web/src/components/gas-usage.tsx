import { getHours } from 'date-fns'
import { StatTile } from '@/components/stat-tile'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import { useGas } from '@/hooks/use-gas'
import { gasCost, gasStandingCharges, latestGasTariff } from '@/lib/gas'
import type { Reading } from '@/lib/octopus'
import { BUCKET_LABELS, BUCKET_NAMES, bucketsOf, HOUR_OF_DAY_LABELS, type Period } from '@/lib/period'
import { formatValue, type Unit } from '@/lib/tariff'

const CONFIG: ChartConfig = { gas: { label: 'Gas', color: 'var(--chart-gas)' } }

type BucketTotal = { tick: string; full: string; gas: number }

// The period's own buckets, or with byHourOfDay every day folded onto one 24-hour axis.
function bucketTotals(
  readings: Reading[],
  period: Period,
  valueOf: (reading: Reading) => number,
  byHourOfDay: boolean,
): BucketTotal[] {
  if (byHourOfDay) {
    const totals = HOUR_OF_DAY_LABELS.map((label) => ({ ...label, gas: 0 }))
    for (const reading of readings) totals[getHours(reading.startAt)].gas += valueOf(reading)
    return totals
  }

  const buckets = bucketsOf(period)
  const labels = BUCKET_LABELS[period.mode]
  const totals = buckets.map((bucket) => ({ tick: labels.tick(bucket), full: labels.full(bucket), gas: 0 }))
  for (const reading of readings) {
    const index = buckets.findIndex(({ start, end }) => start <= reading.startAt && reading.startAt < end)
    if (index !== -1) totals[index].gas += valueOf(reading)
  }
  return totals
}

function GasChart({ data, hourly, unit }: { data: BucketTotal[]; hourly: boolean; unit: Unit }) {
  return (
    <ChartContainer config={CONFIG} className="aspect-auto h-72 w-full">
      <BarChart data={data} barCategoryGap="30%">
        <CartesianGrid vertical={false} strokeDasharray="3 6" stroke="var(--chart-grid)" />
        <XAxis
          dataKey="tick"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          // Label every other hour on an hourly axis; otherwise let Recharts drop labels only when they collide.
          interval={hourly ? 1 : 'preserveEnd'}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={40}
          tickFormatter={(value: number) => (unit === 'gbp' ? `£${value}` : String(value))}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              className="rounded-xl border-0 bg-secondary text-foreground"
              labelFormatter={(_, payload) => (payload[0]?.payload as BucketTotal | undefined)?.full}
              formatter={(value) => (
                <div className="flex w-full justify-between gap-4">
                  <span>Gas</span>
                  <span className="font-medium tabular-nums">{formatValue(Number(value), unit)}</span>
                </div>
              )}
            />
          }
        />
        <Bar dataKey="gas" fill="var(--color-gas)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  )
}

type GasChartCardProps = {
  title: string
  description: string
  // Undefined while loading.
  data: BucketTotal[] | undefined
  hourly: boolean
  unit: Unit
}

function GasChartCard({ title, description, data, hourly, unit }: GasChartCardProps) {
  return (
    <Card className="rounded-2xl ring-0">
      <CardHeader>
        <CardTitle className="text-lg font-bold tracking-heading">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {data ? <GasChart data={data} hourly={hourly} unit={unit} /> : <Skeleton className="h-72 w-full bg-muted" />}
      </CardContent>
    </Card>
  )
}

// Gas used over the dashboard's period, with its cost when the gas agreement gives a unit rate and standing charge.
export function GasUsage({ period, unit }: { period: Period; unit: Unit }) {
  const gas = useGas(period)
  const loaded = gas.status === 'success' ? gas : undefined
  const bucketName = BUCKET_NAMES[period.mode]

  const kwh = loaded?.readings.reduce((total, reading) => total + reading.kwh, 0)
  const costs = loaded?.readings.map((reading) => gasCost(reading, loaded.tariffs))
  // Pounds need every reading covered by an agreement; otherwise the figures stay in kWh rather than guess a price.
  const priced = loaded && loaded.tariffs.length > 0 && costs?.every((cost) => cost !== undefined)
  const cost =
    loaded && costs
      ? priced
        ? costs.reduce((total: number, cost) => total + (cost ?? 0), 0) + gasStandingCharges(period, loaded.tariffs)
        : null
      : undefined
  const tariff = loaded && latestGasTariff(period, loaded.tariffs)
  const chartUnit = unit === 'gbp' && priced ? 'gbp' : 'kwh'
  const valueOf = (reading: Reading) =>
    chartUnit === 'gbp' && loaded ? (gasCost(reading, loaded.tariffs) ?? 0) : reading.kwh
  const standingNote = `The standing charge (${tariff ? `${tariff.standingCharge.toFixed(1)}p a day` : 'daily'}) is in the total above, not the bars.`

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-2xl font-bold tracking-heading">Gas</h2>

      {gas.status === 'error' && (
        <Card className="rounded-2xl bg-destructive/10 ring-0">
          <CardContent className="text-destructive">{gas.message}</CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile title="Gas used" value={kwh} unit="kwh" icon="gas" />
        <StatTile title="Gas cost" value={cost} unit="gbp" icon="gas" />
        <StatTile title="Unit rate" value={loaded && (tariff?.unitRate ?? null)} unit="rate" icon="rate" />
      </div>

      <GasChartCard
        title={`Gas used each ${bucketName}`}
        description={
          chartUnit === 'gbp'
            ? `Gas cost each ${bucketName}, in pounds. ${standingNote}`
            : `Gas used each ${bucketName}, in kWh.`
        }
        data={loaded && bucketTotals(loaded.readings, period, valueOf, false)}
        hourly={period.mode === 'day'}
        unit={chartUnit}
      />
      {/* A day is already charted by the hour, so only longer periods get the time-of-day view */}
      {period.mode !== 'day' && (
        <GasChartCard
          title="Gas used by time of day"
          description={`Gas ${chartUnit === 'gbp' ? 'cost' : 'used'} in each hour of the day, totalled across the ${period.mode}, in ${chartUnit === 'gbp' ? `pounds. ${standingNote}` : 'kWh.'}`}
          data={loaded && bucketTotals(loaded.hourly, period, valueOf, true)}
          hourly
          unit={chartUnit}
        />
      )}
    </section>
  )
}
