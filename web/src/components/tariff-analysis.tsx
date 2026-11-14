import { cn } from 'cn'
import { CircleHelpIcon, Trash2Icon } from 'lucide-react'
import { CustomPlanDialog } from '@/components/custom-plan-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { usePlans, type CurrentPlan, type Plan } from '@/hooks/use-plans'
import { customStandingCharges, describeBands, priceCustomPlan, type CustomPlan } from '@/lib/custom-plans'
import type { Reading } from '@/lib/octopus'
import type { Period } from '@/lib/period'
import { priceReadings, SECTIONS, standingChargeTotal, type Priced, type Section } from '@/lib/products'
import { formatValue } from '@/lib/tariff'
import { useSettings } from '@/stores/settings'

const COPY: Record<Section, { better: string; worse: string; intro: (mode: string) => string; note?: string }> = {
  import: {
    better: 'cheaper',
    worse: 'dearer',
    intro: (mode) =>
      `What this ${mode}'s import cost on your tariff, including standing charges, and what it would have cost on other plans.`,
  },
  export: {
    better: 'more',
    worse: 'less',
    intro: (mode) => `What this ${mode}'s export earned on your tariff, and what it would have earned on other plans.`,
    note: 'These are the export plans Octopus says your meter can switch to right now.',
  },
  gas: {
    better: 'cheaper',
    worse: 'dearer',
    intro: (mode) =>
      `What this ${mode}'s gas cost on your tariff, including standing charges, and what it would have cost on other plans.`,
    note: 'These are the gas plans Octopus says your meter can switch to right now.',
  },
}

// custom is set on a plan the user typed in, which can be edited or removed.
type PlanResult = Plan & Priced & { standing: number; total: number; custom?: CustomPlan }

type ComparisonProps = {
  plan: PlanResult
  current: PlanResult | undefined
  section: Section
  // Drops "than your current tariff", for the table where the column heading says it.
  compact?: boolean
}

// Differences under half a penny count as the same, so rounding never reads as a gain or loss.
function Comparison({ plan, current, section, compact }: ComparisonProps) {
  // The current plan's badge takes the place the others use for their difference, so every card has the same rows.
  if (plan.current || !current) return <Badge className={cn(!compact && 'mt-1 self-start')}>Current tariff</Badge>
  const difference = plan.total - current.total
  if (Math.abs(difference) < 0.005) {
    return <span className="text-muted-foreground">{compact ? 'Same' : 'Same as your current tariff'}</span>
  }
  const better = SECTIONS[section].isCost ? difference < 0 : difference > 0
  return (
    <span className={cn('font-medium', better ? 'text-foreground' : 'text-destructive')}>
      {formatValue(Math.abs(difference), 'gbp')} {better ? COPY[section].better : COPY[section].worse}
      {!compact && ' than your current tariff'}
    </span>
  )
}

// The plan's name with its description behind a help icon. The icon flows inline after the name, so it stays
// beside the last word if the name wraps.
function PlanName({ plan }: { plan: PlanResult }) {
  return (
    <span className="min-w-0 font-semibold">
      {plan.name}
      <Tooltip>
        <TooltipTrigger
          aria-label={`About ${plan.name}`}
          className="ml-1.5 inline-flex rounded-full align-middle text-muted-foreground hover:text-foreground"
        >
          <CircleHelpIcon className="size-4" />
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">{plan.description}</TooltipContent>
      </Tooltip>
    </span>
  )
}

// The badge, edit and remove controls a custom plan carries; nothing for Octopus's own plans.
function CustomPlanActions({ plan, section }: { plan: PlanResult; section: Section }) {
  const removeCustomPlan = useSettings((state) => state.removeCustomPlan)
  if (!plan.custom) return null
  return (
    <div className="flex items-center gap-1">
      <Badge variant="outline">Custom</Badge>
      <CustomPlanDialog section={section} plan={plan.custom} />
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Remove ${plan.name}`}
        onClick={() => removeCustomPlan(plan.productCode)}
      >
        <Trash2Icon />
      </Button>
    </div>
  )
}

const averageRate = (plan: PlanResult) =>
  plan.pricedKwh > 0 ? `${((plan.pounds * 100) / plan.pricedKwh).toFixed(1)}p/kWh` : undefined

function Unpriced({ plan, period }: { plan: PlanResult; period: Period }) {
  if (plan.unpricedKwh < 0.05) return null
  return (
    <span className="text-muted-foreground">
      {plan.unpricedKwh.toFixed(1)} kWh not priced: no rates were published for part of this {period.mode}.
    </span>
  )
}

type PlanCardProps = { plan: PlanResult; current: PlanResult | undefined; section: Section; period: Period }

function PlanCard({ plan, current, section, period }: PlanCardProps) {
  const rate = averageRate(plan)
  return (
    <Card className={cn('rounded-2xl ring-0', plan.current && 'ring-2 ring-primary')}>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <PlanName plan={plan} />
          <CustomPlanActions plan={plan} section={section} />
        </div>
        <span className="text-4xl font-bold tracking-heading tabular-nums">{formatValue(plan.total, 'gbp')}</span>
        <div className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground tabular-nums">
            {rate ? `${rate} on average` : 'Nothing priced'}
            {SECTIONS[section].hasStandingCharge && `, plus ${formatValue(plan.standing, 'gbp')} standing charge`}
          </span>
          <Comparison plan={plan} current={current} section={section} />
          <Unpriced plan={plan} period={period} />
        </div>
      </CardContent>
    </Card>
  )
}

type PlanTableProps = { plans: PlanResult[]; current: PlanResult | undefined; section: Section; period: Period }

// The same comparison as the cards, one plan per row.
function PlanTable({ plans, current, section, period }: PlanTableProps) {
  const { hasStandingCharge, isCost } = SECTIONS[section]
  return (
    <Card className="rounded-2xl py-2 ring-0">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="px-4">Plan</TableHead>
            <TableHead className="px-4 text-right">Average rate</TableHead>
            {hasStandingCharge && <TableHead className="px-4 text-right">Standing charge</TableHead>}
            <TableHead className="px-4 text-right">{isCost ? 'Total cost' : 'Total earned'}</TableHead>
            <TableHead className="px-4 text-right">Against current tariff</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {plans.map((plan) => (
            <TableRow key={plan.productCode} className={cn(plan.current && 'bg-muted/40 hover:bg-muted/40')}>
              <TableCell className="px-4 whitespace-normal">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-3">
                    <PlanName plan={plan} />
                    <CustomPlanActions plan={plan} section={section} />
                  </div>
                  <Unpriced plan={plan} period={period} />
                </div>
              </TableCell>
              <TableCell className="px-4 text-right text-muted-foreground tabular-nums">
                {averageRate(plan) ?? 'Nothing priced'}
              </TableCell>
              {hasStandingCharge && (
                <TableCell className="px-4 text-right text-muted-foreground tabular-nums">
                  {formatValue(plan.standing, 'gbp')}
                </TableCell>
              )}
              <TableCell className="px-4 text-right text-base font-bold tabular-nums">
                {formatValue(plan.total, 'gbp')}
              </TableCell>
              <TableCell className="px-4 text-right tabular-nums">
                <Comparison plan={plan} current={current} section={section} compact />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  )
}

type TariffAnalysisProps = {
  section: Section
  period: Period
  readings: Reading[] | undefined
  // The current plan and what its unit charges came to on the account's own tariff, so its card matches the
  // figures above it (its product may not publish unit rates at all).
  current: (CurrentPlan & { unitPounds: number }) | undefined
}

// What the period cost (or earned) on the current plan, next to what it would have on other plans, each priced at
// the rates that plan actually had at the time.
export function TariffAnalysis({ section, period, readings, current }: TariffAnalysisProps) {
  const plans = usePlans(section, period, current)
  const allCustomPlans = useSettings((state) => state.customPlans)
  const planView = useSettings((state) => state.planView)

  // Custom plans join the list as extra alternatives; their id stands in for a product code.
  const customResults = (readings ?? []).length
    ? allCustomPlans
        .filter((plan) => plan.section === section)
        .map((plan): PlanResult => {
          const priced = priceCustomPlan(readings ?? [], plan)
          const standing = standingChargeTotal(period, customStandingCharges(plan))
          return {
            productCode: plan.id,
            name: plan.name,
            description: describeBands(plan),
            current: false,
            custom: plan,
            unitRates: [],
            standingCharges: [],
            ...priced,
            standing,
            total: priced.pounds + standing,
          }
        })
    : []

  const octopusResults =
    plans.status === 'success' && readings && current
      ? plans.plans.map((plan): PlanResult => {
          const priced = plan.current
            ? {
                pounds: current.unitPounds,
                pricedKwh: readings.reduce((total, reading) => total + reading.kwh, 0),
                unpricedKwh: 0,
                launchPricedKwh: 0,
              }
            : priceReadings(readings, plan.unitRates)
          const standing = standingChargeTotal(period, plan.standingCharges)
          return { ...plan, ...priced, standing, total: priced.pounds + standing }
        })
      : undefined
  const results = octopusResults && [...octopusResults, ...customResults]
  const currentResult = results?.find((plan) => plan.current)
  // Current plan first, then the alternatives from best to worst.
  const ordered = results && [
    ...results.filter((plan) => plan.current),
    ...results
      .filter((plan) => !plan.current)
      .sort((a, b) => (SECTIONS[section].isCost ? a.total - b.total : b.total - a.total)),
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold tracking-heading">Compared with other plans</h3>
          <p className="text-muted-foreground">{COPY[section].intro(period.mode)}</p>
        </div>
        <CustomPlanDialog section={section} />
      </div>

      {plans.status === 'error' && <p className="text-destructive">{plans.message}</p>}

      {ordered && planView === 'table' ? (
        <PlanTable plans={ordered} current={currentResult} section={section} period={period} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          {ordered
            ? ordered.map((plan) => (
                <PlanCard key={plan.productCode} plan={plan} current={currentResult} section={section} period={period} />
              ))
            : plans.status !== 'error' &&
              Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-44 rounded-2xl bg-muted" />)}
        </div>
      )}

      {COPY[section].note && <p className="text-sm text-muted-foreground">{COPY[section].note}</p>}
    </div>
  )
}
