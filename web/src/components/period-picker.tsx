import { format, getYear, setMonth, setYear, startOfYear, subDays } from 'date-fns'
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { useState } from 'react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  describePeriod,
  isInFuture,
  periodContaining,
  periodEnd,
  shiftPeriod,
  type Period,
  type PeriodMode,
} from '@/lib/period'

const MODES: { value: PeriodMode; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
]

type PeriodPickerProps = {
  value: Period
  onChange: (period: Period) => void
}

type GridItem = { key: string; label: string; date: Date; selected: boolean; disabled: boolean }

type GridPickerProps = {
  heading: string
  items: GridItem[]
  onPick: (date: Date) => void
  onPrevious: () => void
  onNext: () => void
  nextDisabled: boolean
}

// A paged 3 by 4 grid, used for picking a month within a year or a year within a span of twelve.
function GridPicker({ heading, items, onPick, onPrevious, onNext, nextDisabled }: GridPickerProps) {
  return (
    <div className="flex w-64 flex-col gap-2 p-2">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon-sm" aria-label="Previous page" onClick={onPrevious}>
          <ChevronLeftIcon />
        </Button>
        <span className="text-sm font-medium">{heading}</span>
        <Button variant="ghost" size="icon-sm" aria-label="Next page" onClick={onNext} disabled={nextDisabled}>
          <ChevronRightIcon />
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {items.map((item) => (
          <Button
            key={item.key}
            variant="ghost"
            aria-pressed={item.selected}
            disabled={item.disabled}
            onClick={() => onPick(item.date)}
            className={cn(item.selected && 'bg-primary text-primary-foreground hover:bg-primary')}
          >
            {item.label}
          </Button>
        ))}
      </div>
    </div>
  )
}

function MonthGrid({ value, onPick }: { value: Period; onPick: (date: Date) => void }) {
  const [year, setViewYear] = useState(getYear(value.start))
  const now = new Date()
  const items = Array.from({ length: 12 }, (_, month) => {
    const date = setMonth(startOfYear(setYear(now, year)), month)
    return {
      key: String(month),
      label: format(date, 'MMM'),
      date,
      selected: date.getTime() === value.start.getTime(),
      disabled: date > now,
    }
  })

  return (
    <GridPicker
      heading={String(year)}
      items={items}
      onPick={onPick}
      onPrevious={() => setViewYear(year - 1)}
      onNext={() => setViewYear(year + 1)}
      nextDisabled={year >= getYear(now)}
    />
  )
}

function YearGrid({ value, onPick }: { value: Period; onPick: (date: Date) => void }) {
  const now = new Date()
  // The page is named by its last year, so the current year starts on the bottom row.
  const [lastYear, setLastYear] = useState(Math.max(getYear(value.start), getYear(now)))
  const items = Array.from({ length: 12 }, (_, i) => {
    const year = lastYear - 11 + i
    const date = startOfYear(setYear(now, year))
    return {
      key: String(year),
      label: String(year),
      date,
      selected: date.getTime() === value.start.getTime(),
      disabled: date > now,
    }
  })

  return (
    <GridPicker
      heading={`${lastYear - 11} to ${lastYear}`}
      items={items}
      onPick={onPick}
      onPrevious={() => setLastYear(lastYear - 12)}
      onNext={() => setLastYear(lastYear + 12)}
      nextDisabled={lastYear >= getYear(now)}
    />
  )
}

export function PeriodPicker({ value, onChange }: PeriodPickerProps) {
  const [open, setOpen] = useState(false)
  const today = new Date()
  const next = shiftPeriod(value, 1)

  const pick = (date: Date) => {
    onChange(periodContaining(value.mode, date))
    setOpen(false)
  }

  // Switching mode keeps today in view when the current period contains it, otherwise its first day.
  const changeMode = (mode: PeriodMode) => {
    const containsToday = value.start <= today && today < periodEnd(value)
    onChange(periodContaining(mode, containsToday ? today : value.start))
  }

  const calendarProps = {
    defaultMonth: value.start,
    weekStartsOn: 1,
    disabled: { after: today },
  } as const

  const { title, caption } = describePeriod(value)

  return (
    <div className="flex flex-col gap-4">
      <ToggleGroup
        aria-label="Group by"
        value={[value.mode]}
        // Ignore deselection so one mode is always active.
        onValueChange={(values) => values[0] && changeMode(values[0] as PeriodMode)}
        className="w-full gap-0.5 rounded-full bg-muted p-0.5"
      >
        {MODES.map((mode) => (
          <ToggleGroupItem
            key={mode.value}
            value={mode.value}
            className="flex-1 rounded-full px-3 hover:bg-transparent aria-pressed:bg-secondary"
          >
            {mode.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {/* The selected dates are the panel's main content: large, with the arrows stepping either side of them */}
      <div className="flex w-full items-center gap-1">
        <Button
          variant="ghost"
          size="icon-lg"
          className="rounded-full"
          aria-label={`Previous ${value.mode}`}
          onClick={() => onChange(shiftPeriod(value, -1))}
        >
          <ChevronLeftIcon />
        </Button>
        <Popover open={open} onOpenChange={setOpen}>
          {/* Fills the row between the arrows, so its width doesn't change with the label */}
          <PopoverTrigger
            render={<Button variant="ghost" className="h-auto min-w-0 flex-1 flex-col gap-0.5 rounded-xl py-2" />}
          >
            <span className="text-xl font-bold tracking-heading tabular-nums">{title}</span>
            <span className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
              <CalendarIcon className="size-3.5" aria-hidden />
              {caption}
            </span>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="center">
            {value.mode === 'day' && (
              <Calendar mode="single" selected={value.start} onSelect={(date) => date && pick(date)} {...calendarProps} />
            )}
            {value.mode === 'week' && (
              <Calendar
                mode="range"
                selected={{ from: value.start, to: subDays(periodEnd(value), 1) }}
                onDayClick={(date, modifiers) => !modifiers.disabled && pick(date)}
                {...calendarProps}
              />
            )}
            {value.mode === 'month' && <MonthGrid value={value} onPick={pick} />}
            {value.mode === 'year' && <YearGrid value={value} onPick={pick} />}
          </PopoverContent>
        </Popover>
        <Button
          variant="ghost"
          size="icon-lg"
          className="rounded-full"
          aria-label={`Next ${value.mode}`}
          onClick={() => onChange(next)}
          disabled={isInFuture(next)}
        >
          <ChevronRightIcon />
        </Button>
      </div>
    </div>
  )
}
