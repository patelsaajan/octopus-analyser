import { format } from 'date-fns'
import { FlameIcon, ZapIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useAccountDetails } from '@/hooks/use-account-details'
import { useGasTariffs } from '@/hooks/use-gas-tariffs'
import { useTariffs } from '@/hooks/use-tariffs'
import { gasTariffAt } from '@/lib/gas'
import type { AccountDetails } from '@/lib/octopus'
import { formatValue, type Tariff, type Timeslot } from '@/lib/tariff'
import { useSettings, type ChartLayout } from '@/stores/settings'

const CHART_LAYOUTS: { value: ChartLayout; label: string }[] = [
  { value: 'separate', label: 'Separate' },
  { value: 'joint', label: 'Combined' },
]

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{children}</span>
    </div>
  )
}

// API enums like "DOMESTIC" read as "Domestic".
const enumLabel = (value: string) => value.charAt(0) + value.slice(1).toLowerCase().replaceAll('_', ' ')

function AccountRows({ account }: { account: AccountDetails }) {
  return (
    <>
      <Row label="Account number">
        <span className="font-mono">{account.number}</span>
      </Row>
      <Row label="Account holder">{account.holder.fullName}</Row>
      <Row label="Email">{account.holder.email}</Row>
      {account.holder.mobile && <Row label="Mobile">{account.holder.mobile}</Row>}
      <Row label="Status">{enumLabel(account.status)}</Row>
      <Row label="Account type">{enumLabel(account.accountType)}</Row>
      <Row label="Balance">{formatValue(account.balance / 100, 'gbp')}</Row>
      <Row label="Customer since">{formatDate(account.createdAt)}</Row>
    </>
  )
}

// "ECO7_NIGHT" reads as "night"; the scheme prefix only matters to the API. Export's slots all share the
// rateType "STANDARD", so when names don't tell the slots apart the dearest is called peak instead.
function slotName(slot: Timeslot, tariff: Tariff): string {
  const names = new Set(tariff.timeslots.map(({ timeslot }) => timeslot))
  if (names.size < tariff.timeslots.length) {
    return slot.rate === Math.max(...tariff.timeslots.map(({ rate }) => rate)) ? 'peak' : 'standard'
  }
  return (slot.timeslot.split('_').pop() ?? slot.timeslot).toLowerCase()
}

// "05:30:00" as "05:30".
const slotTime = (time: string) => time.slice(0, 5)

const formatDate = (date: Date) => format(date, 'd MMM yyyy')

// Heads a group of tariff rows with its fuel's icon and the tariff's display name.
function TariffHeading({ title, name, fuel }: { title: string; name: string | undefined; fuel: 'electricity' | 'gas' }) {
  const Icon = fuel === 'electricity' ? ZapIcon : FlameIcon
  return (
    <div className="flex flex-col pb-2">
      <span className="flex items-center gap-2 font-semibold">
        <Icon className="size-4 text-muted-foreground" aria-hidden />
        {title}
      </span>
      {name ? <span className="text-sm text-muted-foreground">{name}</span> : <Skeleton className="mt-1 h-4 w-48 bg-muted" />}
    </div>
  )
}

function TariffRows({ direction, tariff }: { direction: string; tariff: Tariff }) {
  return (
    <>
      <Row label="Valid from">{formatDate(tariff.validFrom)}</Row>
      <Row label="Valid to">{tariff.validTo ? formatDate(tariff.validTo) : 'No end date'}</Row>
      {tariff.timeslots.map((slot) => (
        <Row
          key={`${slot.activeFrom}-${slot.activeTo}`}
          label={`${direction}, ${slotName(slot, tariff)} (${slotTime(slot.activeFrom)} to ${slotTime(slot.activeTo)})`}
        >
          {slot.rate}p/kWh
        </Row>
      ))}
    </>
  )
}

export default function SettingsPage() {
  const account = useAccountDetails()
  const tariffState = useTariffs()
  const tariffs = tariffState.status === 'success' ? tariffState.tariffs : undefined
  const gasState = useGasTariffs()
  const gasTariff = gasState.status === 'success' ? gasTariffAt(new Date(), gasState.tariffs) : undefined
  const { chartLayout, setChartLayout } = useSettings()

  return (
    <div className="mx-auto flex w-full max-w-8xl flex-col gap-6 p-4 sm:p-8">
      <header>
        <h1 className="text-3xl font-bold tracking-heading">Settings</h1>
        <p className="text-muted-foreground">The account and tariff the dashboard uses.</p>
      </header>

      {/* Two independent columns, so the short Account card doesn't stretch to the Tariff card's height */}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <Card className="rounded-2xl ring-0">
            <CardHeader>
              <CardTitle className="text-lg font-bold tracking-heading">Account</CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-border">
              {account ? <AccountRows account={account} /> : <Skeleton className="my-2 h-48 w-full bg-muted" />}
            </CardContent>
          </Card>

          <Card className="rounded-2xl ring-0">
            <CardHeader>
              <CardTitle className="text-lg font-bold tracking-heading">Usage</CardTitle>
            </CardHeader>
            <CardContent>
              <Row label="Import and export charts">
                <ToggleGroup
                  aria-label="Import and export charts"
                  value={[chartLayout]}
                  // Ignore deselection so one layout is always active.
                  onValueChange={(values) => values[0] && setChartLayout(values[0] as ChartLayout)}
                  className="gap-0.5 rounded-full bg-muted p-0.5"
                >
                  {CHART_LAYOUTS.map((layout) => (
                    <ToggleGroupItem
                      key={layout.value}
                      value={layout.value}
                      className="rounded-full px-3 hover:bg-transparent aria-pressed:bg-secondary"
                    >
                      {layout.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </Row>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-2xl ring-0">
          <CardHeader>
            <CardTitle className="text-lg font-bold tracking-heading">Tariff</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {tariffState.status === 'error' && <p className="text-destructive">{tariffState.message}</p>}

            <div className="divide-y divide-border">
              <TariffHeading title="Electricity import" name={tariffs?.import.name} fuel="electricity" />
              {tariffs ? (
                <TariffRows direction="Import" tariff={tariffs.import} />
              ) : (
                <Skeleton className="my-2 h-24 w-full bg-muted" />
              )}
            </div>

            {/* Stronger than the row dividers, so the two tariffs read as separate groups */}
            <Separator className="bg-muted-foreground/50" />

            <div className="divide-y divide-border">
              <TariffHeading title="Electricity export" name={tariffs?.export.name} fuel="electricity" />
              {tariffs ? (
                <TariffRows direction="Export" tariff={tariffs.export} />
              ) : (
                <Skeleton className="my-2 h-24 w-full bg-muted" />
              )}
            </div>

            <Separator className="bg-muted-foreground/50" />

            <div className="divide-y divide-border">
              <TariffHeading title="Gas" name={gasTariff?.name} fuel="gas" />
              {gasState.status === 'error' && <p className="py-2 text-destructive">{gasState.message}</p>}
              {gasTariff && (
                <>
                  <Row label="Valid from">{formatDate(gasTariff.validFrom)}</Row>
                  <Row label="Valid to">{gasTariff.validTo ? formatDate(gasTariff.validTo) : 'No end date'}</Row>
                  <Row label="Unit rate">{gasTariff.unitRate.toFixed(2)}p/kWh</Row>
                  <Row label="Standing charge">{gasTariff.standingCharge.toFixed(2)}p/day</Row>
                </>
              )}
              {gasState.status === 'loading' && <Skeleton className="my-2 h-24 w-full bg-muted" />}
              {gasState.status === 'success' && !gasTariff && (
                <p className="py-2 text-muted-foreground">No current gas tariff.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
