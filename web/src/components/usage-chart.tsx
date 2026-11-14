import { format, subDays } from 'date-fns'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import type { Reading } from '@/lib/octopus'
import { bucketsOf, type Bucket, type Period, type PeriodMode } from '@/lib/period'
import { exportValue, formatValue, importValue, type Unit } from '@/lib/tariff'

export type Series = 'imported' | 'exported'

const SERIES: Record<Series, { label: string; color: string; valueOf: typeof importValue }> = {
  imported: { label: 'Imported', color: 'var(--chart-import)', valueOf: importValue },
  exported: { label: 'Exported', color: 'var(--chart-export)', valueOf: exportValue },
}

// How each mode labels a bar on the axis, and in full in the tooltip.
const BUCKET_LABELS: Record<PeriodMode, { tick: (bucket: Bucket) => string; full: (bucket: Bucket) => string }> = {
  day: {
    tick: ({ start }) => format(start, 'HH:mm'),
    full: ({ start, end }) => `${format(start, 'HH:mm')} to ${format(end, 'HH:mm')}`,
  },
  week: {
    tick: ({ start }) => format(start, 'EEE d'),
    full: ({ start }) => format(start, 'EEEE d MMMM'),
  },
  month: {
    tick: ({ start }) => format(start, 'd MMM'),
    full: ({ start, end }) => `${format(start, 'd')} to ${format(subDays(end, 1), 'd MMMM')}`,
  },
  year: {
    tick: ({ start }) => format(start, 'MMM'),
    full: ({ start }) => format(start, 'MMMM yyyy'),
  },
}

type BucketTotal = { tick: string; full: string } & Partial<Record<Series, number>>

type UsageChartProps = {
  // One entry draws a single series; two draw them side by side on a shared scale.
  series: { key: Series; readings: Reading[] }[]
  period: Period
  unit: Unit
}

// Every bucket in the period gets a bar, even with no readings, so the axis always spans the whole period.
function bucketTotals({ series, period, unit }: UsageChartProps): BucketTotal[] {
  const buckets = bucketsOf(period)
  const labels = BUCKET_LABELS[period.mode]
  const totals: BucketTotal[] = buckets.map((bucket) => ({
    tick: labels.tick(bucket),
    full: labels.full(bucket),
    ...Object.fromEntries(series.map(({ key }) => [key, 0])),
  }))

  for (const { key, readings } of series) {
    for (const reading of readings) {
      const index = buckets.findIndex(({ start, end }) => start <= reading.startAt && reading.startAt < end)
      if (index !== -1) totals[index][key] = (totals[index][key] ?? 0) + SERIES[key].valueOf(reading, unit)
    }
  }
  return totals
}

export function UsageChart(props: UsageChartProps) {
  const data = bucketTotals(props)
  const config: ChartConfig = Object.fromEntries(
    props.series.map(({ key }) => [key, { label: SERIES[key].label, color: SERIES[key].color }]),
  )

  return (
    <ChartContainer config={config} className="aspect-auto h-72 w-full">
      <BarChart data={data} barGap={2} barCategoryGap="30%">
        <CartesianGrid vertical={false} strokeDasharray="3 6" stroke="var(--chart-grid)" />
        <XAxis
          dataKey="tick"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          // Label every other hour on a day; otherwise let Recharts drop labels only when they collide.
          interval={props.period.mode === 'day' ? 1 : 'preserveEnd'}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={40}
          tickFormatter={(value: number) => (props.unit === 'gbp' ? `£${value}` : String(value))}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              className="rounded-xl border-0 bg-secondary text-foreground"
              labelFormatter={(_, payload) => (payload[0]?.payload as BucketTotal | undefined)?.full}
              formatter={(value, name) => (
                <div className="flex w-full justify-between gap-4">
                  <span>{config[name].label}</span>
                  <span className="font-medium tabular-nums">{formatValue(Number(value), props.unit)}</span>
                </div>
              )}
            />
          }
        />
        {props.series.length > 1 && <ChartLegend content={<ChartLegendContent />} />}
        {props.series.map(({ key }) => (
          <Bar key={key} dataKey={key} fill={`var(--color-${key})`} radius={[4, 4, 0, 0]} />
        ))}
      </BarChart>
    </ChartContainer>
  )
}
