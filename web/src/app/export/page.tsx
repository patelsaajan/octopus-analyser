import { UsageDashboard } from '@/components/usage-dashboard'

export default function ExportPage() {
  return (
    <UsageDashboard
      title="Export"
      description="Electricity exported to the grid from the smart meter."
      only="exported"
    />
  )
}
