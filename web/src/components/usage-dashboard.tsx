import { subWeeks } from 'date-fns'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PeriodPicker } from '@/components/period-picker'
import { UnitToggle } from '@/components/unit-toggle'
import { UsageChart, type Series } from '@/components/usage-chart'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useUsage } from '@/hooks/use-usage'
import type { Reading } from '@/lib/octopus'
import { periodContaining, type Period, type PeriodMode } from '@/lib/period'
import { exportValue, formatValue, importValue, type Unit } from '@/lib/tariff'
import { useSettings, type ChartLayout } from '@/stores/settings'

const BUCKET_NAMES: Record<PeriodMode, string> = { day: 'hour', week: 'day', month: 'week', year: 'month' }

const CHART_COPY: Record<Series, { title: string; verb: string }> = {
  imported: { title: 'Imported', verb: 'imported from' },
  exported: { title: 'Exported', verb: 'exported to' },
}

const UNIT_NAMES: Record<Unit, string> = { kwh: 'kWh', gbp: 'pounds' }

const sum = (readings: Reading[], valueOf: (reading: Reading) => number) =>
  readings.reduce((total, reading) => total + valueOf(reading), 0)

const TILE_TITLES: Record<Unit, [string, string, string]> = {
  kwh: ['Imported from grid', 'Exported to grid', 'Net import'],
  gbp: ['Import cost', 'Export earnings', 'Net cost'],
}

function StatTile({ title, value, unit }: { title: string; value: number | undefined; unit: Unit }) {
  return (
    <Card className="rounded-2xl ring-0">
      <CardContent className="flex flex-col gap-1">
        <span className="text-xs font-medium tracking-label text-muted-foreground uppercase">{title}</span>
        {value === undefined ? (
          <Skeleton className="h-10 w-32 bg-muted" />
        ) : unit === 'kwh' ? (
          <span className="text-4xl font-bold tracking-heading tabular-nums">
            {value.toFixed(1)} <span className="text-base font-medium">kWh</span>
          </span>
        ) : (
          <span className="text-4xl font-bold tracking-heading tabular-nums">{formatValue(value, unit)}</span>
        )}
      </CardContent>
    </Card>
  )
}

type ChartCardProps = {
  series: Series[]
  readings: Record<Series, Reading[]> | undefined
  period: Period
  unit: Unit
  byHourOfDay?: boolean
}

function ChartCard({ series, readings, period, unit, byHourOfDay }: ChartCardProps) {
  const copies = series.map((key) => CHART_COPY[key])
  const bucketName = BUCKET_NAMES[period.mode]
  const title = copies.map((copy) => copy.title).join(' and ')
  // Joined as "imported from and exported to", so one sentence covers both series.
  const verbs = copies.map((copy) => copy.verb).join(' and ')

  return (
    <Card className="rounded-2xl ring-0">
      <CardHeader>
        <CardTitle className="text-lg font-bold tracking-heading">
          {byHourOfDay ? `${title} by time of day` : `${title} each ${bucketName}`}
        </CardTitle>
        <CardDescription>
          {byHourOfDay
            ? `Electricity ${verbs} the grid in each hour of the day, totalled across the ${period.mode}, in ${UNIT_NAMES[unit]}.`
            : `Electricity ${verbs} the grid each ${bucketName}, in ${UNIT_NAMES[unit]}.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {readings ? (
          <UsageChart
            series={series.map((key) => ({ key, readings: readings[key] }))}
            period={period}
            unit={unit}
            byHourOfDay={byHourOfDay}
          />
        ) : (
          <Skeleton className="h-72 w-full bg-muted" />
        )}
      </CardContent>
    </Card>
  )
}

type ChartCardsProps = Omit<ChartCardProps, 'series'> & { layout: ChartLayout; only?: Series }

// One combined chart, or a chart each for import and export, depending on the layout setting.
function ChartCards({ layout, only, ...props }: ChartCardsProps) {
  if (only) return <ChartCard series={[only]} {...props} />
  if (layout === 'joint') return <ChartCard series={['imported', 'exported']} {...props} />
  return (
    <>
      <ChartCard series={['imported']} {...props} />
      <ChartCard series={['exported']} {...props} />
    </>
  )
}

type UsageDashboardProps = {
  title: string
  description: string
  // Limits the figures and charts to one direction; both are shown when left out.
  only?: Series
}

export function UsageDashboard({ title, description, only }: UsageDashboardProps) {
  const [period, setPeriod] = useState(() => periodContaining('week', subWeeks(new Date(), 1)))
  const [unit, setUnit] = useState<Unit>('kwh')
  const usage = useUsage(period)
  const loaded = usage.status === 'success' ? usage : undefined
  const chartLayout = useSettings((state) => state.chartLayout)

  const imported = loaded && sum(loaded.imported, (reading) => importValue(reading, unit))
  const exported = loaded && sum(loaded.exported, (reading) => exportValue(reading, unit))
  const [importTitle, exportTitle, netTitle] = TILE_TITLES[unit]

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-4 sm:p-8">
      <header className="flex flex-col gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-heading">{title}</h1>
          <p className="text-muted-foreground">{description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <UnitToggle value={unit} onChange={setUnit} />
          <PeriodPicker value={period} onChange={setPeriod} />
          <Button render={<Link to="/settings" />} nativeButton={false} variant="outline" className="ml-auto">
            See tariff
          </Button>
        </div>
      </header>

      {usage.status === 'error' && (
        <Card className="rounded-2xl bg-destructive/10 ring-0">
          <CardContent className="text-destructive">{usage.message}</CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {only !== 'exported' && <StatTile title={importTitle} value={imported} unit={unit} />}
        {only !== 'imported' && <StatTile title={exportTitle} value={exported} unit={unit} />}
        {!only && (
          <StatTile
            title={netTitle}
            value={imported === undefined || exported === undefined ? undefined : imported - exported}
            unit={unit}
          />
        )}
      </div>

      <ChartCards layout={chartLayout} only={only} readings={loaded} period={period} unit={unit} />
      {/* A day is already charted by the hour, so only longer periods get the time-of-day view */}
      {period.mode !== 'day' && (
        <ChartCards layout={chartLayout} only={only} readings={loaded} period={period} unit={unit} byHourOfDay />
      )}
    </div>
  )
}
