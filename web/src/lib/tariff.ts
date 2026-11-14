import type { Reading } from '@/lib/octopus'

export type Unit = 'kwh' | 'gbp'

// One part of the day at one rate in pence per kWh, e.g. ECO7_NIGHT from 23:30 to 05:30.
// activeFrom and activeTo are local times ("HH:mm" or "HH:mm:ss"); equal times mean the whole day.
export type Timeslot = { timeslot: string; activeFrom: string; activeTo: string; rate: number }

// A tariff on the account's current agreement, as read from the API.
export type Tariff = {
  name: string
  // The meter point the agreement is on.
  mpan: string
  // e.g. OUTGOING-PRIME-FIX-12M-26-06-23, and E-1R-<product>-K, whose last letter is the region.
  productCode: string
  tariffCode: string
  validFrom: Date
  validTo: Date | null
  timezone: string
  timeslots: Timeslot[]
}

export type Tariffs = { import: Tariff; export: Tariff }

const formatters = new Map<string, Intl.DateTimeFormat>()

// "HH:mm" in the given timezone; tariff times are local, so a reading is priced in that zone.
export function timeOfDay(date: Date, timeZone: string): string {
  let formatter = formatters.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    formatters.set(timeZone, formatter)
  }
  return formatter.format(date)
}

// "05:30:00" or "05:30" as minutes since midnight.
function minutesOf(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

// Whether a time of day falls in [from, to), where a slot like 23:30 to 05:30 wraps past midnight.
function inSlot(minutes: number, from: number, to: number): boolean {
  if (from === to) return true
  return from < to ? minutes >= from && minutes < to : minutes >= from || minutes < to
}

export function rateAt(startAt: Date, tariff: Pick<Tariff, 'name' | 'timezone' | 'timeslots'>): number {
  const minutes = minutesOf(timeOfDay(startAt, tariff.timezone))
  const slot = tariff.timeslots.find((slot) => inSlot(minutes, minutesOf(slot.activeFrom), minutesOf(slot.activeTo)))
  // The slots cover the whole day, so a miss means the API returned something unexpected.
  if (!slot) throw new Error(`No ${tariff.name} timeslot covers ${startAt.toISOString()}.`)
  return slot.rate
}

// A reading's value in the chosen unit: kWh as-is, or its price in pounds on the given tariff.
function value(reading: Reading, unit: Unit, tariff: Tariff): number {
  return unit === 'kwh' ? reading.kwh : (reading.kwh * rateAt(reading.startAt, tariff)) / 100
}

function importValue(reading: Reading, unit: Unit, tariffs: Tariffs): number {
  return value(reading, unit, tariffs.import)
}

function exportValue(reading: Reading, unit: Unit, tariffs: Tariffs): number {
  return value(reading, unit, tariffs.export)
}

export const VALUE_OF: Record<'imported' | 'exported', typeof importValue> = {
  imported: importValue,
  exported: exportValue,
}

const pounds = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' })

export function formatValue(value: number, unit: Unit): string {
  return unit === 'kwh' ? `${value.toFixed(1)} kWh` : pounds.format(value)
}
