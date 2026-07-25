import { useState, useEffect } from 'react'
import { formatWithSeparators, stripSeparators, parseMoney } from '../lib/formatMoney'

export default function MoneyInput({ id, value, onChange, placeholder, className = '', ...props }) {
  const [displayValue, setDisplayValue] = useState(() =>
    value ? formatWithSeparators(value) : ''
  )

  // Sync display when value changes externally (e.g. edit modal opens with new contribution)
  useEffect(() => {
    const clean = parseMoney(value)
    const currentClean = stripSeparators(displayValue)
    if (clean !== currentClean) {
      setDisplayValue(clean ? formatWithSeparators(clean) : '')
    }
  }, [value])

  function handleChange(e) {
    const raw = stripSeparators(e.target.value)
    const formatted = formatWithSeparators(raw)
    setDisplayValue(formatted)
    onChange(raw)
  }

  return (
    <input
      id={id}
      className={`input-base mono ${className}`}
      type="text"
      inputMode="numeric"
      placeholder={placeholder}
      value={displayValue}
      onChange={handleChange}
      {...props}
    />
  )
}
