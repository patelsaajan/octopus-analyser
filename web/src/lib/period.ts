import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
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

export function formatPeriod(period: Period): string {
  const { mode, start } = period
  if (mode === 'day') return format(start, 'EEE d MMM yyyy')
  if (mode === 'month') return format(start, 'MMMM yyyy')
  if (mode === 'year') return format(start, 'yyyy')

  const last = subDays(periodEnd(period), 1)
  const startFormat = isSameMonth(start, last) ? 'd' : isSameYear(start, last) ? 'd MMM' : 'd MMM yyyy'
  return `${format(start, startFormat)} to ${format(last, 'd MMM yyyy')}`
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
