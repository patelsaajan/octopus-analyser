import { TariffAnalysis } from '@/components/tariff-analysis'
import { UsageDashboard } from '@/components/usage-dashboard'

export default function ExportPage() {
  return (
    <UsageDashboard
      title="Export overview"
      description="Electricity exported to the grid from the smart meter."
      only="exported"
    >
      {({ period, readings, tariffs }) => (
        <TariffAnalysis period={period} exported={readings?.exported} tariffs={tariffs} />
      )}
    </UsageDashboard>
  )
}
