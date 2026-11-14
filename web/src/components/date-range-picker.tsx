import { format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import type { DateRange } from 'react-day-picker'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

type DateRangePickerProps = {
  value: DateRange | undefined
  onChange: (range: DateRange | undefined) => void
}

function formatRange(range: DateRange | undefined): string {
  if (!range?.from) return 'Pick dates'
  if (!range.to) return format(range.from, 'd MMM yyyy')
  return `${format(range.from, 'd MMM')} to ${format(range.to, 'd MMM yyyy')}`
}

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  return (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" />}>
        <CalendarIcon data-icon="inline-start" />
        {formatRange(value)}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <Calendar
          mode="range"
          selected={value}
          onSelect={onChange}
          defaultMonth={value?.from}
          numberOfMonths={2}
          weekStartsOn={1}
          disabled={{ after: new Date() }}
        />
      </PopoverContent>
    </Popover>
  )
}
