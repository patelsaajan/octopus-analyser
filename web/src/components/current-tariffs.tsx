import { FlameIcon, ZapIcon, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useGasTariffs } from '@/hooks/use-gas-tariffs'
import { useTariffs } from '@/hooks/use-tariffs'
import { gasTariffAt } from '@/lib/gas'

// name is undefined while loading and null when the account has no such tariff.
function TariffRow({ icon: Icon, label, name }: { icon: LucideIcon; label: string; name: string | null | undefined }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="flex min-w-0 flex-col">
        <span className="text-xs text-muted-foreground">{label}</span>
        {name === undefined ? (
          <Skeleton className="mt-1 h-4 w-40 bg-muted" />
        ) : (
          <span className="text-sm font-medium">{name ?? 'None'}</span>
        )}
      </div>
    </div>
  )
}

// The plans the account is on now, with a link to their rates and dates on the Settings page.
export function CurrentTariffs() {
  const tariffs = useTariffs()
  const gas = useGasTariffs()
  // A failed request shows as "None" here; the Settings page carries the error message.
  const electricity = (direction: 'import' | 'export') =>
    tariffs.status === 'loading' ? undefined : tariffs.status === 'success' ? tariffs.tariffs[direction].name : null
  const gasName = gas.status === 'loading' ? undefined : gas.status === 'success' ? (gasTariffAt(new Date(), gas.tariffs)?.name ?? null) : null

  return (
    <Card className="rounded-2xl ring-0">
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">Your tariffs</h2>
          <Button render={<Link to="/settings" />} nativeButton={false} variant="outline" size="sm">
            See more
          </Button>
        </div>
        <TariffRow icon={ZapIcon} label="Electricity import" name={electricity('import')} />
        <TariffRow icon={ZapIcon} label="Electricity export" name={electricity('export')} />
        <TariffRow icon={FlameIcon} label="Gas" name={gasName} />
      </CardContent>
    </Card>
  )
}
