import { format, getHours, subDays } from 'date-fns'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import type { Reading } from '@/lib/octopus'
import { bucketsOf, type Bucket, type Period, type PeriodMode } from '@/lib/period'
import { formatValue, VALUE_OF, type Tariffs, type Unit } from '@/lib/tariff'

export type Series = 'imported' | 'exported'

// color feeds the chart's CSS variables; swatch is the same colour as a class, for the legend.
const SERIES: Record<Series, { label: string; color: string; swatch: string }> = {
  imported: { label: 'Imported', color: 'var(--chart-import)', swatch: 'bg-chart-import' },
  exported: { label: 'Exported', color: 'var(--chart-export)', swatch: 'bg-chart-export' },
}

// The key for a chart showing more than one series, shown beside its title rather than under the plot.
export function SeriesLegend({ series }: { series: Series[] }) {
  return (
    <div className="flex items-center gap-4 text-sm text-muted-foreground">
      {series.map((key) => (
        <span key={key} className="flex items-center gap-1.5">
          <span className={`size-2.5 rounded-sm ${SERIES[key].swatch}`} aria-hidden />
          {SERIES[key].label}
        </span>
      ))}
    </div>
  )
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

const hourLabel = (hour: number) => `${String(hour % 24).padStart(2, '0')}:00`

type BucketTotal = { tick: string; full: string } & Partial<Record<Series, number>>

// The bars a chart draws and which one each reading falls in (-1 for none).
type Grouping = { labels: { tick: string; full: string }[]; indexOf: (reading: Reading) => number }

// Every bucket in the period gets a bar, even with no readings, so the axis always spans the whole period.
function periodGrouping(period: Period): Grouping {
  const buckets = bucketsOf(period)
  const labels = BUCKET_LABELS[period.mode]
  return {
    labels: buckets.map((bucket) => ({ tick: labels.tick(bucket), full: labels.full(bucket) })),
    indexOf: (reading) => buckets.findIndex(({ start, end }) => start <= reading.startAt && reading.startAt < end),
  }
}

// Folds every day in the period onto one 24-hour axis, to show when energy tends to flow.
const hourOfDayGrouping: Grouping = {
  labels: Array.from({ length: 24 }, (_, hour) => ({
    tick: hourLabel(hour),
    full: `${hourLabel(hour)} to ${hourLabel(hour + 1)}`,
  })),
  indexOf: (reading) => getHours(reading.startAt),
}

type UsageChartProps = {
  // One entry draws a single series; two draw them side by side on a shared scale.
  series: { key: Series; readings: Reading[] }[]
  tariffs: Tariffs
  period: Period
  unit: Unit
  // Totals each hour of the day across the period, instead of charting the period's own buckets.
  byHourOfDay?: boolean
}

function bucketTotals({ series, tariffs, period, unit, byHourOfDay }: UsageChartProps): BucketTotal[] {
  const { labels, indexOf } = byHourOfDay ? hourOfDayGrouping : periodGrouping(period)
  const totals: BucketTotal[] = labels.map((label) => ({
    ...label,
    ...Object.fromEntries(series.map(({ key }) => [key, 0])),
  }))

  for (const { key, readings } of series) {
    for (const reading of readings) {
      const index = indexOf(reading)
      if (index !== -1) totals[index][key] = (totals[index][key] ?? 0) + VALUE_OF[key](reading, unit, tariffs)
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
          // Label every other hour on an hourly axis; otherwise let Recharts drop labels only when they collide.
          interval={props.byHourOfDay || props.period.mode === 'day' ? 1 : 'preserveEnd'}
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
        {props.series.map(({ key }) => (
          <Bar key={key} dataKey={key} fill={`var(--color-${key})`} radius={[4, 4, 0, 0]} />
        ))}
      </BarChart>
    </ChartContainer>
  )
}
