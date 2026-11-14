import { subWeeks } from 'date-fns'
import { useState, type ReactNode } from 'react'
import { DashboardControls, DashboardShell } from '@/components/dashboard-shell'
import { StatTile } from '@/components/stat-tile'
import { SeriesLegend, UsageChart, type Series } from '@/components/usage-chart'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useTariffs } from '@/hooks/use-tariffs'
import { useUsage } from '@/hooks/use-usage'
import type { Reading } from '@/lib/octopus'
import { periodContaining, type Period, type PeriodMode } from '@/lib/period'
import { VALUE_OF, type Tariffs, type Unit } from '@/lib/tariff'
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

type ChartCardProps = {
  series: Series[]
  readings: Record<Series, Reading[]> | undefined
  tariffs: Tariffs | undefined
  period: Period
  unit: Unit
  byHourOfDay?: boolean
}

function ChartCard({ series, readings, tariffs, period, unit, byHourOfDay }: ChartCardProps) {
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
        {series.length > 1 && (
          <CardAction>
            <SeriesLegend series={series} />
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {readings && tariffs ? (
          <UsageChart
            series={series.map((key) => ({ key, readings: readings[key] }))}
            tariffs={tariffs}
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

type ChartCardsProps = Omit<ChartCardProps, 'series'> & { layout: ChartLayout }

// One combined chart, or a chart each for import and export, depending on the layout setting.
function ChartCards({ layout, ...props }: ChartCardsProps) {
  if (layout === 'joint') return <ChartCard series={['imported', 'exported']} {...props} />
  return (
    <>
      <ChartCard series={['imported']} {...props} />
      <ChartCard series={['exported']} {...props} />
    </>
  )
}

// What the dashboard has loaded for its selected period; readings and tariffs are undefined until they arrive.
export type DashboardData = {
  period: Period
  unit: Unit
  readings: Record<Series, Reading[]> | undefined
  tariffs: Tariffs | undefined
}

type UsageDashboardProps = {
  title: string
  description: string
  // Extra sections shown below the charts; a function gets the dashboard's period and loaded data.
  children?: ReactNode | ((data: DashboardData) => ReactNode)
}

export function UsageDashboard({ title, description, children }: UsageDashboardProps) {
  const [period, setPeriod] = useState(() => periodContaining('week', subWeeks(new Date(), 1)))
  const [unit, setUnit] = useState<Unit>('kwh')
  const usage = useUsage(period)
  const tariffState = useTariffs()
  const tariffs = tariffState.status === 'success' ? tariffState.tariffs : undefined
  // Figures wait for the tariffs as well as the readings, since pounds can't be worked out without them.
  const loaded = usage.status === 'success' && tariffs ? usage : undefined
  const errors = [usage, tariffState].flatMap((state) => (state.status === 'error' ? [state.message] : []))
  const chartLayout = useSettings((state) => state.chartLayout)

  const total = (series: Series, unit: Unit) =>
    loaded && tariffs && sum(loaded[series], (reading) => VALUE_OF[series](reading, unit, tariffs))
  const imported = total('imported', unit)
  const exported = total('exported', unit)
  // Average pence per kWh over the period, whichever unit the figures are in; undefined with nothing to divide by.
  const averageRate = (series: Series) => {
    const kwh = total(series, 'kwh')
    const pounds = total(series, 'gbp')
    return kwh && pounds !== undefined ? `${((pounds * 100) / kwh).toFixed(1)}p/kWh on average` : undefined
  }
  // Net cost over net kWh; meaningless once export matches or beats import, so it's left out then.
  const netRate = (() => {
    const totals = [total('imported', 'kwh'), total('exported', 'kwh'), total('imported', 'gbp'), total('exported', 'gbp')]
    if (!totals.every((value): value is number => value !== undefined)) return undefined
    const [importKwh, exportKwh, importGbp, exportGbp] = totals
    const netKwh = importKwh - exportKwh
    return netKwh > 0 ? `${(((importGbp - exportGbp) * 100) / netKwh).toFixed(1)}p/kWh net` : undefined
  })()
  const [importTitle, exportTitle, netTitle] = TILE_TITLES[unit]

  return (
    <DashboardShell
      title={title}
      description={description}
      errors={errors}
      controls={<DashboardControls period={period} onPeriodChange={setPeriod} unit={{ value: unit, onChange: setUnit }} />}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile title={importTitle} value={imported} unit={unit} icon="imported" note={averageRate('imported')} />
        <StatTile title={exportTitle} value={exported} unit={unit} icon="exported" note={averageRate('exported')} />
        <StatTile
          icon="net"
          note={netRate}
          title={netTitle}
          value={imported === undefined || exported === undefined ? undefined : imported - exported}
          unit={unit}
        />
      </div>

      <ChartCards layout={chartLayout} readings={loaded} tariffs={tariffs} period={period} unit={unit} />
      {/* A day is already charted by the hour, so only longer periods get the time-of-day view */}
      {period.mode !== 'day' && (
        <ChartCards layout={chartLayout} readings={loaded} tariffs={tariffs} period={period} unit={unit} byHourOfDay />
      )}

      {typeof children === 'function' ? children({ period, unit, readings: loaded, tariffs }) : children}
    </DashboardShell>
  )
}
