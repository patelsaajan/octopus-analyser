import { endOfWeek, startOfWeek, subWeeks } from 'date-fns'
import { useState } from 'react'
import type { DateRange } from 'react-day-picker'
import { DateRangePicker } from '@/components/date-range-picker'
import { UnitToggle } from '@/components/unit-toggle'
import { UsageChart } from '@/components/usage-chart'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useUsage } from '@/hooks/use-usage'
import type { Reading } from '@/lib/octopus'
import { exportValue, formatValue, importValue, RATES, type Unit } from '@/lib/tariff'

function previousWeek(): DateRange {
  const lastWeek = subWeeks(new Date(), 1)
  return {
    from: startOfWeek(lastWeek, { weekStartsOn: 1 }),
    to: endOfWeek(lastWeek, { weekStartsOn: 1 }),
  }
}

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

export default function HomePage() {
  const [range, setRange] = useState<DateRange | undefined>(previousWeek)
  const [unit, setUnit] = useState<Unit>('kwh')
  const usage = useUsage(range)
  const loaded = usage.status === 'success' ? usage : undefined

  const imported = loaded && sum(loaded.imported, (reading) => importValue(reading, unit))
  const exported = loaded && sum(loaded.exported, (reading) => exportValue(reading, unit))
  const [importTitle, exportTitle, netTitle] = TILE_TITLES[unit]

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-4 sm:p-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-heading">Electricity usage</h1>
          <p className="text-muted-foreground">Half-hourly grid import and export from the smart meter.</p>
        </div>
        <div className="flex items-center gap-3">
          <UnitToggle value={unit} onChange={setUnit} />
          <DateRangePicker value={range} onChange={setRange} />
        </div>
      </header>

      {usage.status === 'error' && (
        <Card className="rounded-2xl bg-destructive/10 ring-0">
          <CardContent className="text-destructive">{usage.message}</CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile title={importTitle} value={imported} unit={unit} />
        <StatTile title={exportTitle} value={exported} unit={unit} />
        <StatTile
          title={netTitle}
          value={imported === undefined || exported === undefined ? undefined : imported - exported}
          unit={unit}
        />
      </div>

      <Card className="rounded-2xl ring-0">
        <CardHeader>
          <CardTitle className="text-lg font-bold tracking-heading">Daily totals</CardTitle>
          <CardDescription>
            {unit === 'kwh'
              ? 'Electricity imported from and exported to the grid each day, in kWh.'
              : `Import at ${RATES.import.offPeak}p/kWh from 11:30pm to 5:30am and ${RATES.import.standard}p otherwise. Export at ${RATES.export.peak}p/kWh from 4pm to 7pm and ${RATES.export.standard}p otherwise.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loaded ? (
            <UsageChart imported={loaded.imported} exported={loaded.exported} unit={unit} />
          ) : (
            <Skeleton className="h-72 w-full bg-muted" />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
