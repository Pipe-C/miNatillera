import { useState, useRef, useEffect } from 'react'
import './DatePicker.css'

const WEEKDAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do']
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

/**
 * Custom date picker with calendar panel.
 * @param {string} value - ISO date (YYYY-MM-DD) or ''
 * @param {function} onChange - called with ISO date string
 * @param {string} min - minimum selectable date (ISO)
 * @param {string} max - maximum selectable date (ISO)
 * @param {string} placeholder
 */
export default function DatePicker({ id, value, onChange, min, max, placeholder = 'dd/mm/aaaa', ...props }) {
  const [open, setOpen] = useState(false)
  const [openAbove, setOpenAbove] = useState(false)
  const [viewDate, setViewDate] = useState(() => {
    if (value) return new Date(value + 'T00:00:00')
    if (min) return new Date(min + 'T00:00:00')
    return new Date()
  })
  const containerRef = useRef(null)

  // Determine if calendar should open above or below
  function handleOpen() {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      setOpenAbove(spaceBelow < 320)
    }
    setOpen(true)
  }

  const selectedDate = value ? new Date(value + 'T00:00:00') : null
  const minDate = min ? new Date(min + 'T00:00:00') : null
  const maxDate = max ? new Date(max + 'T00:00:00') : null

  const displayValue = selectedDate
    ? `${pad(selectedDate.getDate())}/${pad(selectedDate.getMonth() + 1)}/${selectedDate.getFullYear()}`
    : ''

  function prevMonth() {
    setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))
  }

  function nextMonth() {
    setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))
  }

  function selectDay(day) {
    const iso = `${viewDate.getFullYear()}-${pad(viewDate.getMonth() + 1)}-${pad(day)}`
    onChange(iso)
    setOpen(false)
  }

  function isDisabled(day) {
    const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), day)
    if (minDate && d < minDate) return true
    if (maxDate && d > maxDate) return true
    return false
  }

  function isToday(day) {
    const now = new Date()
    return day === now.getDate() &&
      viewDate.getMonth() === now.getMonth() &&
      viewDate.getFullYear() === now.getFullYear()
  }

  function isSelected(day) {
    if (!selectedDate) return false
    return day === selectedDate.getDate() &&
      viewDate.getMonth() === selectedDate.getMonth() &&
      viewDate.getFullYear() === selectedDate.getFullYear()
  }

  // Days in current month
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  // Day of week for first day (Mon=0 based)
  let firstDow = new Date(year, month, 1).getDay()
  firstDow = firstDow === 0 ? 6 : firstDow - 1 // shift Sunday to end

  const blanks = Array(firstDow).fill(null)
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  return (
    <div className="datepicker" ref={containerRef}>
      <input
        id={id}
        className="datepicker__input"
        type="text"
        readOnly
        value={displayValue}
        placeholder={placeholder}
        onClick={() => handleOpen()}
        onFocus={() => handleOpen()}
        aria-haspopup="dialog"
        aria-expanded={open}
        {...props}
      />

      {open && (
        <>
          <div className="datepicker__overlay" onClick={() => setOpen(false)} />
          <div className={`datepicker__panel ${openAbove ? 'datepicker__panel--above' : ''}`} role="dialog" aria-label="Seleccionar fecha">
            <div className="datepicker__header">
              <button type="button" className="datepicker__nav" onClick={prevMonth} aria-label="Mes anterior">
                ‹
              </button>
              <span className="datepicker__month-label">
                {MONTHS[month]} {year}
              </span>
              <button type="button" className="datepicker__nav" onClick={nextMonth} aria-label="Mes siguiente">
                ›
              </button>
            </div>

            <div className="datepicker__weekdays">
              {WEEKDAYS.map(d => (
                <span key={d} className="datepicker__weekday">{d}</span>
              ))}
            </div>

            <div className="datepicker__days">
              {blanks.map((_, i) => (
                <span key={`blank-${i}`} className="datepicker__day datepicker__day--outside" />
              ))}
              {days.map(day => {
                const disabled = isDisabled(day)
                const selected = isSelected(day)
                const today = isToday(day)
                const classes = [
                  'datepicker__day',
                  disabled && 'datepicker__day--disabled',
                  selected && 'datepicker__day--selected',
                  today && !selected && 'datepicker__day--today'
                ].filter(Boolean).join(' ')

                return (
                  <button
                    key={day}
                    type="button"
                    className={classes}
                    disabled={disabled}
                    onClick={() => !disabled && selectDay(day)}
                    aria-label={`${day} de ${MONTHS[month]}`}
                    aria-pressed={selected}
                  >
                    {day}
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function pad(n) {
  return String(n).padStart(2, '0')
}
