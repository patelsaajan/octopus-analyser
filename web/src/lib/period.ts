import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  differenceInCalendarDays,
  differenceInCalendarMonths,
  differenceInCalendarWeeks,
  differenceInCalendarYears,
  eachDayOfInterval,
  eachHourOfInterval,
  eachMonthOfInterval,
  eachWeekOfInterval,
  format,
  isSameMonth,
  isSameYear,
  max,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
  subMilliseconds,
} from 'date-fns'

export type PeriodMode = 'day' | 'week' | 'month' | 'year'

// A calendar day, week, month or year; start is its first moment in local time.
export type Period = { mode: PeriodMode; start: Date }

// One bar on the chart, covering [start, end).
export type Bucket = { start: Date; end: Date }

const WEEK_OPTIONS = { weekStartsOn: 1 } as const

const startOf: Record<PeriodMode, (date: Date) => Date> = {
  day: startOfDay,
  week: (date) => startOfWeek(date, WEEK_OPTIONS),
  month: startOfMonth,
  year: startOfYear,
}

const add: Record<PeriodMode, (date: Date, amount: number) => Date> = {
  day: addDays,
  week: addWeeks,
  month: addMonths,
  year: addYears,
}

export function periodContaining(mode: PeriodMode, date: Date): Period {
  return { mode, start: startOf[mode](date) }
}

// Exclusive: the first moment of the following period.
export function periodEnd({ mode, start }: Period): Date {
  return add[mode](start, 1)
}

export function shiftPeriod({ mode, start }: Period, amount: number): Period {
  return { mode, start: add[mode](start, amount) }
}

export function isInFuture(period: Period): boolean {
  return period.start > new Date()
}

const differenceIn: Record<PeriodMode, (later: Date, earlier: Date) => number> = {
  day: differenceInCalendarDays,
  week: (later, earlier) => differenceInCalendarWeeks(later, earlier, WEEK_OPTIONS),
  month: differenceInCalendarMonths,
  year: differenceInCalendarYears,
}

// Where a period sits relative to now: "Today", "Last week", "3 months ago".
function relativeLabel({ mode, start }: Period, now: Date): string {
  const ago = differenceIn[mode](now, start)
  if (ago < 0) return 'Upcoming'
  if (mode === 'day') return ago === 0 ? 'Today' : ago === 1 ? 'Yesterday' : `${ago} days ago`
  return ago === 0 ? `This ${mode}` : ago === 1 ? `Last ${mode}` : `${ago} ${mode}s ago`
}

// A short title for the period ("2 to 8 Nov", "November", "2026") and a caption placing it in time. The title
// leaves the year out to stay short, so the caption adds it whenever it isn't the current year.
export function describePeriod(period: Period, now = new Date()): { title: string; caption: string } {
  const { mode, start } = period
  const last = subDays(periodEnd(period), 1)
  const title = {
    day: () => format(start, 'EEE d MMM'),
    week: () => `${format(start, isSameMonth(start, last) ? 'd' : 'd MMM')} to ${format(last, 'd MMM')}`,
    month: () => format(start, 'MMMM'),
    year: () => format(start, 'yyyy'),
  }[mode]()

  const relative = relativeLabel(period, now)
  if (mode === 'year' || (isSameYear(start, now) && isSameYear(last, now))) return { title, caption: relative }
  const years = isSameYear(start, last) ? format(last, 'yyyy') : `${format(start, 'yyyy')} to ${format(last, 'yyyy')}`
  return { title, caption: `${relative}, ${years}` }
}

// Hours of a day, days of a week, weeks of a month (clipped to the month's edges) or months of a year.
export function bucketsOf(period: Period): Bucket[] {
  const end = periodEnd(period)
  const interval = { start: period.start, end: subMilliseconds(end, 1) }
  const starts = {
    day: () => eachHourOfInterval(interval),
    week: () => eachDayOfInterval(interval),
    month: () => eachWeekOfInterval(interval, WEEK_OPTIONS).map((week) => max([week, period.start])),
    year: () => eachMonthOfInterval(interval),
  }[period.mode]()
  return starts.map((start, i) => ({ start, end: starts[i + 1] ?? end }))
}
