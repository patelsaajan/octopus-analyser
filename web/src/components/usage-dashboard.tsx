import { cn } from 'cn'
import { subWeeks } from 'date-fns'
import { ArrowDownToLineIcon, ArrowUpFromLineIcon, GaugeIcon, ScaleIcon, type LucideIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { PeriodPicker } from '@/components/period-picker'
import { UnitToggle } from '@/components/unit-toggle'
import { SeriesLegend, UsageChart, type Series } from '@/components/usage-chart'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useTariffs } from '@/hooks/use-tariffs'
import { useUsage } from '@/hooks/use-usage'
import type { Reading } from '@/lib/octopus'
import { periodContaining, type Period, type PeriodMode } from '@/lib/period'
import { formatValue, VALUE_OF, type Tariffs, type Unit } from '@/lib/tariff'
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

// Each tile's icon, tinted to match its chart series where it has one.
const TILE_ICONS = {
  imported: { icon: ArrowDownToLineIcon, className: 'text-chart-import' },
  exported: { icon: ArrowUpFromLineIcon, className: 'text-chart-export' },
  net: { icon: ScaleIcon, className: 'text-muted-foreground' },
  rate: { icon: GaugeIcon, className: 'text-muted-foreground' },
} satisfies Record<string, { icon: LucideIcon; className: string }>

type StatTileProps = {
  title: string
  // null means there's nothing to show, such as a rate with no kWh to divide by.
  value: number | null | undefined
  // 'rate' is pence per kWh.
  unit: Unit | 'rate'
  icon: keyof typeof TILE_ICONS
}

function StatTile({ title, value, unit, icon }: StatTileProps) {
  const { icon: Icon, className } = TILE_ICONS[icon]
  return (
    <Card className="rounded-2xl ring-0">
      <CardContent className="flex flex-col gap-1">
        <span className="flex items-center gap-2 text-xs font-medium tracking-label text-muted-foreground uppercase">
          <Icon className={cn('size-4', className)} aria-hidden />
          {title}
        </span>
        {value === undefined ? (
          <Skeleton className="h-10 w-32 bg-muted" />
        ) : value === null ? (
          <span className="text-4xl font-bold tracking-heading text-muted-foreground">n/a</span>
        ) : unit === 'rate' ? (
          <span className="text-4xl font-bold tracking-heading tabular-nums">
            {value.toFixed(1)}p <span className="text-base font-medium">/kWh</span>
          </span>
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

function ControlGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium tracking-label text-muted-foreground uppercase">{label}</span>
      {children}
    </div>
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
  // Limits the figures and charts to one direction; both are shown when left out.
  only?: Series
  // Extra sections shown below the charts; a function gets the dashboard's period and loaded data.
  children?: ReactNode | ((data: DashboardData) => ReactNode)
}

export function UsageDashboard({ title, description, only, children }: UsageDashboardProps) {
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
  const [importTitle, exportTitle, netTitle] = TILE_TITLES[unit]
  const onlyKwh = only && total(only, 'kwh')
  const onlyGbp = only && total(only, 'gbp')

  return (
    <div className="mx-auto flex w-full max-w-8xl flex-col gap-6 p-4 sm:p-8">
      <header>
        <h1 className="text-3xl font-bold tracking-heading">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
      </header>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* Above the content on small screens; a sticky panel on the right from lg up */}
        <aside className="lg:sticky lg:top-8 lg:order-last lg:w-80 lg:shrink-0">
          <Card className="rounded-2xl ring-0">
            <CardContent className="flex flex-col gap-5">
              {/* items-end lines the button up with the toggle rather than its label */}
              <div className="flex items-end justify-between gap-3">
                <ControlGroup label="Show in">
                  <UnitToggle value={unit} onChange={setUnit} />
                </ControlGroup>
                <Button render={<Link to="/settings" />} nativeButton={false} variant="outline">
                  See tariff
                </Button>
              </div>
              <ControlGroup label="Period">
                <PeriodPicker value={period} onChange={setPeriod} />
              </ControlGroup>
            </CardContent>
          </Card>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-6">
          {errors.map((message) => (
            <Card key={message} className="rounded-2xl bg-destructive/10 ring-0">
              <CardContent className="text-destructive">{message}</CardContent>
            </Card>
          ))}

          <div className="grid gap-4 sm:grid-cols-3">
            {only ? (
              // A single direction gets both figures, kWh and pounds, whichever unit the charts show,
              // plus the average rate they work out at.
              <>
                <StatTile title={TILE_TITLES.kwh[only === 'imported' ? 0 : 1]} value={onlyKwh} unit="kwh" icon={only} />
                <StatTile title={TILE_TITLES.gbp[only === 'imported' ? 0 : 1]} value={onlyGbp} unit="gbp" icon={only} />
                <StatTile
                  icon="rate"
                  title={only === 'imported' ? 'Average import rate' : 'Average export rate'}
                  value={onlyKwh === undefined || onlyGbp === undefined ? undefined : onlyKwh ? (onlyGbp * 100) / onlyKwh : null}
                  unit="rate"
                />
              </>
            ) : (
              <>
                <StatTile title={importTitle} value={imported} unit={unit} icon="imported" />
                <StatTile title={exportTitle} value={exported} unit={unit} icon="exported" />
              </>
            )}
            {!only && (
              <StatTile
                icon="net"
                title={netTitle}
                value={imported === undefined || exported === undefined ? undefined : imported - exported}
                unit={unit}
              />
            )}
          </div>

          <ChartCards
            layout={chartLayout}
            only={only}
            readings={loaded}
            tariffs={tariffs}
            period={period}
            unit={unit}
          />
          {/* A day is already charted by the hour, so only longer periods get the time-of-day view */}
          {period.mode !== 'day' && (
            <ChartCards
              layout={chartLayout}
              only={only}
              readings={loaded}
              tariffs={tariffs}
              period={period}
              unit={unit}
              byHourOfDay
            />
          )}

          {typeof children === 'function' ? children({ period, unit, readings: loaded, tariffs }) : children}
        </div>
      </div>
    </div>
  )
}
