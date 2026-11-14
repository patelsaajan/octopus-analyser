import type { Reading } from '@/lib/octopus'

export type Unit = 'kwh' | 'gbp'

// Pence per kWh. A reading is priced by the half-hour slot it starts in, in UK local time.
export const RATES = {
  import: { offPeak: 8, standard: 40 },
  export: { standard: 9, peak: 16 },
}

const londonTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

function minutesIntoDay(date: Date): number {
  const parts = londonTime.formatToParts(date)
  const part = (type: 'hour' | 'minute') => Number(parts.find((p) => p.type === type)?.value)
  return part('hour') * 60 + part('minute')
}

const at = (hour: number, minute = 0) => hour * 60 + minute

// Off-peak runs overnight from 11:30pm to 5:30am.
export function importRate(startAt: Date): number {
  const minutes = minutesIntoDay(startAt)
  return minutes >= at(23, 30) || minutes < at(5, 30) ? RATES.import.offPeak : RATES.import.standard
}

// Peak export runs from 4pm to 7pm.
export function exportRate(startAt: Date): number {
  const minutes = minutesIntoDay(startAt)
  return minutes >= at(16) && minutes < at(19) ? RATES.export.peak : RATES.export.standard
}

// A reading's value in the chosen unit: kWh as-is, or its price in pounds.
export function importValue(reading: Reading, unit: Unit): number {
  return unit === 'kwh' ? reading.kwh : (reading.kwh * importRate(reading.startAt)) / 100
}

export function exportValue(reading: Reading, unit: Unit): number {
  return unit === 'kwh' ? reading.kwh : (reading.kwh * exportRate(reading.startAt)) / 100
}

const pounds = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' })

export function formatValue(value: number, unit: Unit): string {
  return unit === 'kwh' ? `${value.toFixed(1)} kWh` : pounds.format(value)
}
