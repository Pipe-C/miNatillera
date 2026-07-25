/**
 * Centralized money handling utilities.
 * Single source of truth for all monetary formatting/parsing in the project.
 */

/**
 * Parse any money representation to a clean integer string (no decimals, no separators).
 * Handles: "50000.00", "50.000", "50000", "$50,000", etc.
 * Always returns the integer portion as a plain digit string.
 */
export function parseMoney(value) {
  if (!value && value !== 0) return ''
  const str = String(value)
  // If it has a decimal point that looks like cents (e.g. "50000.00"), parse as float first
  if (/^\d+\.\d{1,2}$/.test(str.trim())) {
    return String(Math.round(parseFloat(str)))
  }
  // Otherwise strip all non-digit characters (dots as thousands separators, commas, $, etc.)
  const clean = str.replace(/\D/g, '')
  return clean || ''
}

/**
 * Format a numeric string with thousands separators (dots) for display.
 * Input: "2500000" or "2500000.00" → Output: "2.500.000"
 */
export function formatWithSeparators(value) {
  const clean = parseMoney(value)
  if (!clean) return ''
  return Number(clean).toLocaleString('es-CO')
}

/**
 * Strip separators to get the raw numeric value for the API.
 * Input: "2.500.000" → Output: "2500000"
 */
export function stripSeparators(formatted) {
  return formatted.replace(/\./g, '').replace(/,/g, '').replace(/\D/g, '')
}

/**
 * Format a numeric value as Colombian Peso for display in UI (with $ symbol).
 * Use this for read-only display (stats, lists, exports).
 */
export function formatCOP(value) {
  const num = parseFloat(value)
  if (isNaN(num)) return value || '$0'
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(num)
}
