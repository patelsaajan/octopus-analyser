import { cn } from 'cn'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useExportPlans, type ExportPlan } from '@/hooks/use-export-plans'
import type { Reading } from '@/lib/octopus'
import type { Period } from '@/lib/period'
import { priceReadings, type Priced } from '@/lib/products'
import { formatValue, type Tariffs } from '@/lib/tariff'

type PlanResult = ExportPlan & Priced

// Differences under half a penny count as the same, so rounding never reads as a gain or loss.
function Comparison({ plan, current }: { plan: PlanResult; current: PlanResult | undefined }) {
  if (plan.current || !current) return <span className="text-muted-foreground">Your current tariff</span>
  const difference = plan.pounds - current.pounds
  if (Math.abs(difference) < 0.005) return <span className="text-muted-foreground">Same as your current tariff</span>
  return (
    <span className={cn('font-medium', difference > 0 ? 'text-foreground' : 'text-destructive')}>
      {formatValue(Math.abs(difference), 'gbp')} {difference > 0 ? 'more' : 'less'} than your current tariff
    </span>
  )
}

function PlanCard({ plan, current, period }: { plan: PlanResult; current: PlanResult | undefined; period: Period }) {
  return (
    <Card className={cn('rounded-2xl ring-0', plan.current && 'ring-2 ring-primary')}>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <span className="font-semibold">{plan.name}</span>
          {plan.current && <Badge>Current tariff</Badge>}
        </div>
        <span className="text-4xl font-bold tracking-heading tabular-nums">{formatValue(plan.pounds, 'gbp')}</span>
        <div className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground tabular-nums">
            {plan.pricedKwh > 0 ? `${((plan.pounds * 100) / plan.pricedKwh).toFixed(1)}p/kWh on average` : 'No export priced'}
          </span>
          <Comparison plan={plan} current={current} />
          {plan.unpricedKwh >= 0.05 && (
            <span className="text-muted-foreground">
              {plan.unpricedKwh.toFixed(1)} kWh not priced: no rates were published for part of this {period.mode}.
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

type TariffAnalysisProps = {
  period: Period
  exported: Reading[] | undefined
  tariffs: Tariffs | undefined
}

// What the period's export earned on the current plan, next to what it would have earned on the others, each priced
// at the rates that plan actually had at the time.
export function TariffAnalysis({ period, exported, tariffs }: TariffAnalysisProps) {
  const plans = useExportPlans(period, tariffs)
  const results =
    plans.status === 'success' && exported
      ? plans.plans.map((plan): PlanResult => ({ ...plan, ...priceReadings(exported, plan.rates) }))
      : undefined
  const current = results?.find((plan) => plan.current)
  // Current plan first, then the alternatives from best to worst.
  const ordered = results && [
    ...results.filter((plan) => plan.current),
    ...results.filter((plan) => !plan.current).sort((a, b) => b.pounds - a.pounds),
  ]

  return (
    <section className="flex flex-col gap-4 pt-4">
      <div>
        <h2 className="text-2xl font-bold tracking-heading">Tariff analysis</h2>
        <p className="text-muted-foreground">
          What this {period.mode}'s export earned on your tariff, and what it would have earned on the alternatives.
        </p>
      </div>

      {plans.status === 'error' && <p className="text-destructive">{plans.message}</p>}

      <div className="grid gap-4 sm:grid-cols-3">
        {ordered
          ? ordered.map((plan) => <PlanCard key={plan.productCode} plan={plan} current={current} period={period} />)
          : plans.status !== 'error' &&
            Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-44 rounded-2xl bg-muted" />)}
      </div>

      {results?.some((plan) => plan.productCode.startsWith('FLUX-')) && (
        <p className="text-sm text-muted-foreground">
          Octopus Flux Export only comes with Flux import, so switching would change your import costs too.
        </p>
      )}
    </section>
  )
}
