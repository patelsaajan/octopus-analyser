import type { ReactNode } from 'react'
import { CurrentTariffs } from '@/components/current-tariffs'
import { PeriodPicker } from '@/components/period-picker'
import { UnitToggle } from '@/components/unit-toggle'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import type { Period } from '@/lib/period'
import type { Unit } from '@/lib/tariff'

type DashboardControlsProps = {
  period: Period
  onPeriodChange: (period: Period) => void
  // Left out on pages that show kWh and pounds side by side.
  unit?: { value: Unit; onChange: (unit: Unit) => void }
}

// The period comes first as the main control; the unit toggle sits below a divider as secondary.
export function DashboardControls({ period, onPeriodChange, unit }: DashboardControlsProps) {
  return (
    <>
      <PeriodPicker value={period} onChange={onPeriodChange} />
      {unit && (
        <>
          <Separator />
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">Show values in</span>
            <UnitToggle value={unit.value} onChange={unit.onChange} />
          </div>
        </>
      )}
    </>
  )
}

type DashboardShellProps = {
  title: string
  description: string
  controls: ReactNode
  errors: string[]
  children: ReactNode
}

// A page with a title, a sticky panel of controls and current tariffs on the right, and the content beside it.
export function DashboardShell({ title, description, controls, errors, children }: DashboardShellProps) {
  return (
    <div className="mx-auto flex w-full max-w-8xl flex-col gap-6 p-4 sm:p-8">
      <header>
        <h1 className="text-3xl font-bold tracking-heading">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
      </header>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* Above the content on small screens; a sticky panel on the right from lg up */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-8 lg:order-last lg:w-80 lg:shrink-0">
          <Card className="rounded-2xl ring-0">
            <CardContent className="flex flex-col gap-4">{controls}</CardContent>
          </Card>
          <CurrentTariffs />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-6">
          {errors.map((message) => (
            <Card key={message} className="rounded-2xl bg-destructive/10 ring-0">
              <CardContent className="text-destructive">{message}</CardContent>
            </Card>
          ))}
          {children}
        </div>
      </div>
    </div>
  )
}
