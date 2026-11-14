import { UsageDashboard } from '@/components/usage-dashboard'

export default function HomePage() {
  return (
    <UsageDashboard
      title="Electricity usage"
      description="Half-hourly grid import and export from the smart meter."
    />
  )
}
