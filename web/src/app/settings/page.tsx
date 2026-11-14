import type { ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useAccountNumber } from '@/hooks/use-account-number'
import { RATES } from '@/lib/tariff'
import { useSettings, type ChartLayout } from '@/stores/settings'

const CHART_LAYOUTS: { value: ChartLayout; label: string }[] = [
  { value: 'separate', label: 'Separate' },
  { value: 'joint', label: 'Combined' },
]

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{children}</span>
    </div>
  )
}

export default function SettingsPage() {
  const accountNumber = useAccountNumber()
  const { chartLayout, setChartLayout } = useSettings()

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-4 sm:p-8">
      <header>
        <h1 className="text-3xl font-bold tracking-heading">Settings</h1>
        <p className="text-muted-foreground">The account and tariff the dashboard uses.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-2xl ring-0">
          <CardHeader>
            <CardTitle className="text-lg font-bold tracking-heading">Account</CardTitle>
          </CardHeader>
          <CardContent>
            <Row label="Account number">
              {accountNumber ? <span className="font-mono">{accountNumber}</span> : <Skeleton className="h-5 w-24 bg-muted" />}
            </Row>
          </CardContent>
        </Card>

        <Card className="rounded-2xl ring-0">
          <CardHeader>
            <CardTitle className="text-lg font-bold tracking-heading">Tariff</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            <Row label="Import, off-peak (11:30pm to 5:30am)">{RATES.import.offPeak}p/kWh</Row>
            <Row label="Import, standard">{RATES.import.standard}p/kWh</Row>
            <Row label="Export, peak (4pm to 7pm)">{RATES.export.peak}p/kWh</Row>
            <Row label="Export, standard">{RATES.export.standard}p/kWh</Row>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl ring-0">
        <CardHeader>
          <CardTitle className="text-lg font-bold tracking-heading">Usage</CardTitle>
        </CardHeader>
        <CardContent>
          <Row label="Import and export charts">
            <ToggleGroup
              aria-label="Import and export charts"
              value={[chartLayout]}
              // Ignore deselection so one layout is always active.
              onValueChange={(values) => values[0] && setChartLayout(values[0] as ChartLayout)}
              className="gap-0.5 rounded-full bg-muted p-0.5"
            >
              {CHART_LAYOUTS.map((layout) => (
                <ToggleGroupItem
                  key={layout.value}
                  value={layout.value}
                  className="rounded-full px-3 hover:bg-transparent aria-pressed:bg-secondary"
                >
                  {layout.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Row>
        </CardContent>
      </Card>
    </div>
  )
}
