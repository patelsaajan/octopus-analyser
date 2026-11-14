import { GasUsage } from '@/components/gas-usage'
import { UsageDashboard } from '@/components/usage-dashboard'

export default function UsagePage() {
  return (
    <UsageDashboard
      title="Electricity usage"
      description="Half-hourly grid import and export from the smart meter."
    >
      {({ period, unit }) => <GasUsage period={period} unit={unit} />}
    </UsageDashboard>
  )
}
