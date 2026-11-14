import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { bandTimes, type CustomPlan } from '@/lib/custom-plans'
import { SECTIONS, type Section } from '@/lib/products'
import { useSettings } from '@/stores/settings'

const MIDNIGHT = '00:00'

// Form values are kept as the strings the inputs hold, so an empty field stays empty rather than becoming 0.
type BandDraft = { until: string; rate: string }

type Draft = { name: string; bands: BandDraft[]; standingCharge: string }

// A blank form, or one filled in from the plan being edited.
const draftOf = (plan: CustomPlan | undefined): Draft =>
  plan
    ? {
        name: plan.name,
        bands: plan.bands.map((band) => ({ until: band.until, rate: String(band.rate) })),
        standingCharge: String(plan.standingCharge),
      }
    : { name: '', bands: [{ until: MIDNIGHT, rate: '' }], standingCharge: '' }

const isPrice = (value: string) => value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0

// The first thing still stopping the plan from being saved, or undefined when it's complete. The last band always
// ends at midnight, so the bands cover the whole day as long as every earlier one ends later than the one before.
function problemWith(draft: Draft, needsStandingCharge: boolean): string | undefined {
  if (!draft.name.trim()) return 'Give the plan a name.'
  const ends = draft.bands.slice(0, -1).map((band) => band.until)
  if (ends.some((until) => !until)) return 'Set an end time for every time band.'
  if (ends.some((until, i) => until <= (i === 0 ? MIDNIGHT : ends[i - 1]))) {
    return 'Each time band must end later than the one before it.'
  }
  if (draft.bands.some((band) => !isPrice(band.rate))) {
    return draft.bands.length > 1 ? 'Enter a price for every time band.' : 'Enter a price.'
  }
  if (needsStandingCharge && !isPrice(draft.standingCharge)) return 'Enter a standing charge.'
  return undefined
}

// Adds a hand-entered plan to a section's comparison, or edits one when given a plan: a price for each part of the
// day, from midnight to midnight, and a standing charge where the section has one.
export function CustomPlanDialog({ section, plan: editing }: { section: Section; plan?: CustomPlan }) {
  const { hasStandingCharge, timeOfUse } = SECTIONS[section]
  const addCustomPlan = useSettings((state) => state.addCustomPlan)
  const updateCustomPlan = useSettings((state) => state.updateCustomPlan)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(() => draftOf(editing))
  // Several of these dialogs can be on a page, so field ids are per instance.
  const fieldId = useId()

  // Opening always starts from the saved plan (or blank), so changes abandoned last time don't linger.
  const changeOpen = (open: boolean) => {
    if (open) setDraft(draftOf(editing))
    setOpen(open)
  }
  const times = bandTimes(draft.bands)
  const problem = problemWith(draft, hasStandingCharge)

  const setBand = (index: number, change: Partial<BandDraft>) =>
    setDraft({ ...draft, bands: draft.bands.map((band, i) => (i === index ? { ...band, ...change } : band)) })

  // The new band takes over the end of the day, so the band before it needs its own end time setting.
  const addBand = () =>
    setDraft({
      ...draft,
      bands: [...draft.bands.slice(0, -1), { ...draft.bands[draft.bands.length - 1], until: '' }, { until: MIDNIGHT, rate: '' }],
    })

  // Whichever band ends up last runs to midnight.
  const removeBand = (index: number) => {
    const bands = draft.bands.filter((_, i) => i !== index)
    bands[bands.length - 1] = { ...bands[bands.length - 1], until: MIDNIGHT }
    setDraft({ ...draft, bands })
  }

  const save = () => {
    if (problem) return
    const plan: CustomPlan = {
      id: editing?.id ?? crypto.randomUUID(),
      section,
      name: draft.name.trim(),
      bands: draft.bands.map((band) => ({ until: band.until, rate: Number(band.rate) })),
      standingCharge: hasStandingCharge ? Number(draft.standingCharge) : 0,
    }
    if (editing) updateCustomPlan(plan)
    else addCustomPlan(plan)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      {editing ? (
        <DialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Edit ${editing.name}`} />}>
          <PencilIcon />
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button variant="outline" size="sm" />}>
          <PlusIcon data-icon="inline-start" />
          Add custom plan
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit custom plan' : 'Add a custom plan'}</DialogTitle>
          <DialogDescription>
            {timeOfUse
              ? 'Enter a price for each part of the day. The bands run from midnight to midnight.'
              : 'Enter the price per kWh. Gas is read daily, so it has one price for the whole day.'}
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            save()
          }}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${fieldId}-name`}>Plan name</Label>
            <Input
              id={`${fieldId}-name`}
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              placeholder="e.g. Another supplier's tariff"
            />
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">{timeOfUse ? 'Time bands' : 'Unit rate'}</legend>
            {draft.bands.map((band, index) => {
              const last = index === draft.bands.length - 1
              return (
                <div key={index} className="flex items-center gap-2">
                  {timeOfUse && (
                    <>
                      <span className="w-12 text-sm text-muted-foreground tabular-nums">{times[index].from || '--:--'}</span>
                      <span className="text-sm text-muted-foreground">to</span>
                      {/* The last band always ends at midnight, which is what keeps the day fully covered */}
                      <Input
                        type="time"
                        aria-label={`Band ${index + 1} end time`}
                        className="w-28"
                        value={band.until}
                        disabled={last}
                        onChange={(event) => setBand(index, { until: event.target.value })}
                      />
                    </>
                  )}
                  <Input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="any"
                    aria-label={timeOfUse ? `Band ${index + 1} price in pence per kWh` : 'Price in pence per kWh'}
                    className="min-w-0 flex-1"
                    value={band.rate}
                    onChange={(event) => setBand(index, { rate: event.target.value })}
                  />
                  <span className="text-sm text-muted-foreground">p/kWh</span>
                  {timeOfUse && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove band ${index + 1}`}
                      disabled={draft.bands.length === 1}
                      onClick={() => removeBand(index)}
                    >
                      <Trash2Icon />
                    </Button>
                  )}
                </div>
              )
            })}
            {timeOfUse && (
              <Button type="button" variant="ghost" size="sm" className="self-start" onClick={addBand}>
                <PlusIcon data-icon="inline-start" />
                Add time band
              </Button>
            )}
          </fieldset>

          {hasStandingCharge && (
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${fieldId}-standing`}>Standing charge</Label>
              <div className="flex items-center gap-2">
                <Input
                  id={`${fieldId}-standing`}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  className="min-w-0 flex-1"
                  value={draft.standingCharge}
                  onChange={(event) => setDraft({ ...draft, standingCharge: event.target.value })}
                />
                <span className="text-sm text-muted-foreground">p/day</span>
              </div>
            </div>
          )}

          <DialogFooter className="items-center sm:justify-between">
            {/* Says what's still missing while Save is disabled */}
            <p aria-live="polite" className="text-sm text-muted-foreground">
              {problem}
            </p>
            <Button type="submit" disabled={problem !== undefined}>
              {editing ? 'Save changes' : 'Save plan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
