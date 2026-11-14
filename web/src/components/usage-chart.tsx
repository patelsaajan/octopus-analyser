import { format } from 'date-fns'
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
import { exportValue, formatValue, importValue, type Unit } from '@/lib/tariff'

const chartConfig = {
  imported: { label: 'Imported', color: 'var(--chart-import)' },
  exported: { label: 'Exported', color: 'var(--chart-export)' },
} satisfies ChartConfig

type DailyTotal = { day: string; imported: number; exported: number }

type UsageChartProps = {
  imported: Reading[]
  exported: Reading[]
  unit: Unit
}

function dailyTotals({ imported, exported, unit }: UsageChartProps): DailyTotal[] {
  const days = new Map<string, DailyTotal>()
  const add = (readings: Reading[], key: 'imported' | 'exported', valueOf: typeof importValue) => {
    for (const reading of readings) {
      const day = format(reading.startAt, 'yyyy-MM-dd')
      const total = days.get(day) ?? { day, imported: 0, exported: 0 }
      total[key] += valueOf(reading, unit)
      days.set(day, total)
    }
  }
  add(imported, 'imported', importValue)
  add(exported, 'exported', exportValue)
  return [...days.values()].sort((a, b) => a.day.localeCompare(b.day))
}

export function UsageChart(props: UsageChartProps) {
  const data = dailyTotals(props)

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-72 w-full">
      <BarChart data={data} barGap={2} barCategoryGap="30%">
        <CartesianGrid vertical={false} strokeDasharray="3 6" stroke="var(--chart-grid)" />
        <XAxis
          dataKey="day"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(day: string) => format(new Date(day), 'EEE d')}
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
              labelFormatter={(day: string) => format(new Date(day), 'EEEE d MMMM')}
              formatter={(value, name) => (
                <div className="flex w-full justify-between gap-4">
                  <span>{chartConfig[name as keyof typeof chartConfig].label}</span>
                  <span className="font-medium tabular-nums">{formatValue(Number(value), props.unit)}</span>
                </div>
              )}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="imported" fill="var(--color-imported)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="exported" fill="var(--color-exported)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  )
}
