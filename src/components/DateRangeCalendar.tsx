import { useState } from 'react'
import type { BlockedRange } from '../types/availability'
import './DateRangeCalendar.css'

interface DateRangeCalendarProps {
  startAt: string
  endAt: string
  onChange: (startAt: string, endAt: string) => void
  blocked: BlockedRange[]
}

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const MONTH_NAMES = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
]

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function toISO(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`
}

function parseISODate(value: string): Date | null {
  if (!value) return null
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function startOfDay(date: Date): Date {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function isoDatePart(value: string): string {
  return value.slice(0, 10)
}

function isBlockedDay(iso: string, blocked: BlockedRange[]): boolean {
  return blocked.some((b) => {
    const rangeStart = isoDatePart(b.start_at)
    const rangeEnd = isoDatePart(b.end_at)
    return iso >= rangeStart && iso < rangeEnd
  })
}

function hasBlockedNightInRange(startIso: string, endIso: string, blocked: BlockedRange[]): boolean {
  return blocked.some((b) => {
    const rangeStart = isoDatePart(b.start_at)
    const rangeEnd = isoDatePart(b.end_at)
    return startIso < rangeEnd && rangeStart < endIso
  })
}

function DateRangeCalendar({ startAt, endAt, onChange, blocked }: DateRangeCalendarProps) {
  const today = startOfDay(new Date())
  const [viewDate, setViewDate] = useState(() => {
    const base = parseISODate(startAt) || today
    return new Date(base.getFullYear(), base.getMonth(), 1)
  })

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const firstOfMonth = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const leadingBlanks = (firstOfMonth.getDay() + 6) % 7

  const cells: Array<{ iso: string; day: number } | null> = []
  for (let i = 0; i < leadingBlanks; i++) cells.push(null)
  for (let day = 1; day <= daysInMonth; day++) cells.push({ iso: toISO(year, month, day), day })

  function handleDayClick(iso: string) {
    if (iso === startAt || iso === endAt) {
      onChange('', '')
      return
    }
    if (!startAt || endAt) {
      onChange(iso, '')
      return
    }
    if (iso < startAt) {
      onChange(iso, '')
      return
    }
    onChange(startAt, iso)
  }

  function goToPreviousMonth() {
    setViewDate(new Date(year, month - 1, 1))
  }

  function goToNextMonth() {
    setViewDate(new Date(year, month + 1, 1))
  }

  return (
    <div className="date-range-calendar">
      <div className="date-range-calendar-header">
        <button type="button" onClick={goToPreviousMonth} aria-label="Mois précédent">‹</button>
        <span>{MONTH_NAMES[month]} {year}</span>
        <button type="button" onClick={goToNextMonth} aria-label="Mois suivant">›</button>
      </div>

      <div className="date-range-calendar-weekdays">
        {WEEKDAYS.map((w, i) => (
          <span key={i}>{w}</span>
        ))}
      </div>

      <div className="date-range-calendar-grid">
        {cells.map((cell, i) => {
          if (!cell) return <span key={i} />
          const cellDate = parseISODate(cell.iso)!
          const isPast = cellDate < today
          const isUnavailable = isBlockedDay(cell.iso, blocked)
          const isStart = cell.iso === startAt
          const isEnd = cell.iso === endAt
          const pickingEnd = Boolean(startAt) && !endAt && cell.iso > startAt
          const disabled =
            !isStart &&
            !isEnd &&
            (isPast || (pickingEnd ? hasBlockedNightInRange(startAt, cell.iso, blocked) : isUnavailable))
          const inRange = startAt && endAt && cell.iso > startAt && cell.iso < endAt

          const classNames = ['date-range-day']
          if (isUnavailable) classNames.push('date-range-day-unavailable')
          if (disabled) classNames.push('date-range-day-disabled')
          if (isStart || isEnd) classNames.push('date-range-day-selected')
          if (inRange) classNames.push('date-range-day-in-range')

          return (
            <button
              key={i}
              type="button"
              className={classNames.join(' ')}
              disabled={disabled}
              onClick={() => handleDayClick(cell.iso)}
            >
              {cell.day}
            </button>
          )
        })}
      </div>

      <p className="date-range-calendar-legend">
        <span className="date-range-legend-swatch date-range-legend-swatch-unavailable" /> indisponible
        <span className="date-range-legend-swatch date-range-legend-swatch-selected" /> sélectionné
      </p>
      <p className="date-range-calendar-hint">
        Le jour de départ d'une réservation reste disponible comme jour d'arrivée pour une autre.
      </p>
    </div>
  )
}

export default DateRangeCalendar
