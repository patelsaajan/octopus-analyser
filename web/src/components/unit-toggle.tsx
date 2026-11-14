import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { Unit } from '@/lib/tariff'

type UnitToggleProps = {
  value: Unit
  onChange: (unit: Unit) => void
}

export function UnitToggle({ value, onChange }: UnitToggleProps) {
  return (
    <ToggleGroup
      aria-label="Show values in"
      value={[value]}
      // Ignore deselection so one unit is always active.
      onValueChange={(values) => values[0] && onChange(values[0] as Unit)}
      className="gap-0.5 rounded-full bg-muted p-0.5"
    >
      <ToggleGroupItem value="kwh" className="rounded-full px-3 hover:bg-transparent aria-pressed:bg-secondary">
        kWh
      </ToggleGroupItem>
      <ToggleGroupItem value="gbp" className="rounded-full px-3 hover:bg-transparent aria-pressed:bg-secondary">
        £
      </ToggleGroupItem>
    </ToggleGroup>
  )
}
