import { cn } from 'cn'
import { ArrowDownToLineIcon, ArrowUpFromLineIcon, FlameIcon, GaugeIcon, ScaleIcon, type LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatValue, type Unit } from '@/lib/tariff'

// Each tile's icon, tinted to match its chart series where it has one.
const TILE_ICONS = {
  imported: { icon: ArrowDownToLineIcon, className: 'text-chart-import' },
  exported: { icon: ArrowUpFromLineIcon, className: 'text-chart-export' },
  net: { icon: ScaleIcon, className: 'text-muted-foreground' },
  rate: { icon: GaugeIcon, className: 'text-muted-foreground' },
  gas: { icon: FlameIcon, className: 'text-chart-gas' },
} satisfies Record<string, { icon: LucideIcon; className: string }>

type StatTileProps = {
  title: string
  // null means there's nothing to show, such as a rate with no kWh to divide by.
  value: number | null | undefined
  // 'rate' is pence per kWh.
  unit: Unit | 'rate'
  icon: keyof typeof TILE_ICONS
  // A small line under the value, shown once it has loaded.
  note?: string
}

export function StatTile({ title, value, unit, icon, note }: StatTileProps) {
  const { icon: Icon, className } = TILE_ICONS[icon]
  return (
    <Card className="rounded-2xl ring-0">
      <CardContent className="flex flex-col gap-1">
        <span className="flex items-center gap-2 text-xs font-medium tracking-label text-muted-foreground uppercase">
          <Icon className={cn('size-4', className)} aria-hidden />
          {title}
        </span>
        {value === undefined ? (
          <Skeleton className="h-10 w-32 bg-muted" />
        ) : value === null ? (
          <span className="text-4xl font-bold tracking-heading text-muted-foreground">n/a</span>
        ) : unit === 'rate' ? (
          <span className="text-4xl font-bold tracking-heading tabular-nums">
            {value.toFixed(1)}p <span className="text-base font-medium">/kWh</span>
          </span>
        ) : unit === 'kwh' ? (
          <span className="text-4xl font-bold tracking-heading tabular-nums">
            {value.toFixed(1)} <span className="text-base font-medium">kWh</span>
          </span>
        ) : (
          <span className="text-4xl font-bold tracking-heading tabular-nums">{formatValue(value, unit)}</span>
        )}
        {note && value !== undefined && <span className="text-sm text-muted-foreground tabular-nums">{note}</span>}
      </CardContent>
    </Card>
  )
}
