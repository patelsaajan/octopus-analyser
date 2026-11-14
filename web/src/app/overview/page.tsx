import { subWeeks } from 'date-fns'
import { ArrowDownToLineIcon, ArrowUpFromLineIcon, FlameIcon, type LucideIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { DashboardControls, DashboardShell } from '@/components/dashboard-shell'
import { StatTile } from '@/components/stat-tile'
import { TariffAnalysis } from '@/components/tariff-analysis'
import { useGas } from '@/hooks/use-gas'
import { useTariffs } from '@/hooks/use-tariffs'
import { useUsage } from '@/hooks/use-usage'
import { gasCost, gasStandingCharges, latestGasTariff } from '@/lib/gas'
import type { Reading } from '@/lib/octopus'
import { periodContaining } from '@/lib/period'
import { formatValue, VALUE_OF, type Tariff } from '@/lib/tariff'

const kwhOf = (readings: Reading[]) => readings.reduce((total, reading) => total + reading.kwh, 0)

// Pence per kWh, or null when there's no kWh to divide by.
const rateOf = (pounds: number | undefined, kwh: number | undefined) =>
  pounds === undefined || kwh === undefined ? undefined : kwh > 0 ? (pounds * 100) / kwh : null

// The region letter and meter an electricity plan comparison needs, from the account's tariff.
const currentPlanOf = (tariff: Tariff, unitPounds: number) => ({
  productCode: tariff.productCode,
  region: tariff.tariffCode.slice(-1),
  meter: tariff.mpan,
  unitPounds,
})

function OverviewSection({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="flex items-center gap-2 text-2xl font-bold tracking-heading">
        <Icon className="size-6 text-muted-foreground" aria-hidden />
        {title}
      </h2>
      {children}
    </section>
  )
}

export default function OverviewPage() {
  const [period, setPeriod] = useState(() => periodContaining('week', subWeeks(new Date(), 1)))
  const usage = useUsage(period)
  const tariffState = useTariffs()
  const gas = useGas(period)
  const tariffs = tariffState.status === 'success' ? tariffState.tariffs : undefined
  const electricity = usage.status === 'success' && tariffs ? usage : undefined
  const errors = [usage, tariffState, gas].flatMap((state) => (state.status === 'error' ? [state.message] : []))

  const importKwh = electricity && kwhOf(electricity.imported)
  const exportKwh = electricity && kwhOf(electricity.exported)
  const total = (series: 'imported' | 'exported') =>
    electricity && tariffs && electricity[series].reduce((sum, reading) => sum + VALUE_OF[series](reading, 'gbp', tariffs), 0)
  const importCost = total('imported')
  const exportEarnings = total('exported')

  const gasLoaded = gas.status === 'success' ? gas : undefined
  const gasKwh = gasLoaded && kwhOf(gasLoaded.readings)
  const gasUnitCosts = gasLoaded?.readings.map((reading) => gasCost(reading, gasLoaded.tariffs))
  // Pounds need every reading covered by a gas agreement; otherwise the cost stays unknown rather than guessed.
  const gasUnitPounds =
    gasUnitCosts && gasUnitCosts.every((cost) => cost !== undefined)
      ? gasUnitCosts.reduce((sum: number, cost) => sum + (cost ?? 0), 0)
      : undefined
  const gasStanding = gasLoaded && gasStandingCharges(period, gasLoaded.tariffs)
  const gasTariff = gasLoaded && latestGasTariff(period, gasLoaded.tariffs)

  return (
    <DashboardShell
      title="Plan analysis"
      description="What you imported, exported and used in gas, and how your plans compare."
      errors={errors}
      controls={<DashboardControls period={period} onPeriodChange={setPeriod} />}
    >
      <OverviewSection title="Electricity import" icon={ArrowDownToLineIcon}>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatTile title="Imported from grid" value={importKwh} unit="kwh" icon="imported" />
          <StatTile title="Import cost" value={importCost} unit="gbp" icon="imported" note="Before standing charges" />
          <StatTile title="Average import rate" value={rateOf(importCost, importKwh)} unit="rate" icon="rate" />
        </div>
        <TariffAnalysis
          section="import"
          period={period}
          readings={electricity?.imported}
          current={tariffs && importCost !== undefined ? currentPlanOf(tariffs.import, importCost) : undefined}
        />
      </OverviewSection>

      <OverviewSection title="Electricity export" icon={ArrowUpFromLineIcon}>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatTile title="Exported to grid" value={exportKwh} unit="kwh" icon="exported" />
          <StatTile title="Export earnings" value={exportEarnings} unit="gbp" icon="exported" />
          <StatTile title="Average export rate" value={rateOf(exportEarnings, exportKwh)} unit="rate" icon="rate" />
        </div>
        <TariffAnalysis
          section="export"
          period={period}
          readings={electricity?.exported}
          current={tariffs && exportEarnings !== undefined ? currentPlanOf(tariffs.export, exportEarnings) : undefined}
        />
      </OverviewSection>

      <OverviewSection title="Gas" icon={FlameIcon}>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatTile title="Gas used" value={gasKwh} unit="kwh" icon="gas" />
          <StatTile
            title="Gas cost"
            value={gasUnitPounds === undefined || gasStanding === undefined ? undefined : gasUnitPounds + gasStanding}
            unit="gbp"
            icon="gas"
            note={gasStanding === undefined ? undefined : `Includes ${formatValue(gasStanding, 'gbp')} standing charge`}
          />
          <StatTile title="Average gas rate" value={rateOf(gasUnitPounds, gasKwh)} unit="rate" icon="rate" />
        </div>
        <TariffAnalysis
          section="gas"
          period={period}
          readings={gasLoaded?.readings}
          current={
            gasTariff && gasUnitPounds !== undefined
              ? {
                  productCode: gasTariff.productCode,
                  region: gasTariff.tariffCode.slice(-1),
                  meter: gasTariff.mprn,
                  unitPounds: gasUnitPounds,
                }
              : undefined
          }
        />
      </OverviewSection>
    </DashboardShell>
  )
}
