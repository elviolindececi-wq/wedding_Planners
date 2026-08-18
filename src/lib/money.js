const ZERO_DECIMAL_CURRENCIES = new Set(['PYG', 'CLP', 'JPY', 'KRW'])

export function currencyFractionDigits(currency = 'USD') {
  return ZERO_DECIMAL_CURRENCIES.has(currency) ? 0 : 2
}

export function currencyMark(currency = 'USD') {
  try {
    const part = new Intl.NumberFormat('es-PY', {
      style: 'currency',
      currency,
      currencyDisplay: 'symbol',
      maximumFractionDigits: currencyFractionDigits(currency),
    }).formatToParts(0).find(item => item.type === 'currency')
    return part?.value || currency
  } catch {
    return currency
  }
}

export function formatEditableAmount(value, currency = 'USD') {
  if (value === '' || value === null || value === undefined) return ''
  const number = Number(value)
  if (!Number.isFinite(number)) return ''
  return new Intl.NumberFormat('es-PY', {
    useGrouping: true,
    minimumFractionDigits: 0,
    maximumFractionDigits: currencyFractionDigits(currency),
  }).format(number)
}

export function parseEditableAmount(raw, currency = 'USD') {
  if (raw === '' || raw === null || raw === undefined) return ''
  const text = String(raw).replace(/\s/g, '').replace(/[^0-9.,]/g, '')
  if (!text) return ''

  if (currencyFractionDigits(currency) === 0) {
    const digits = text.replace(/\D/g, '')
    return digits ? String(Number(digits)) : ''
  }

  const comma = text.lastIndexOf(',')
  const dot = text.lastIndexOf('.')
  const lastSep = Math.max(comma, dot)
  let integerDigits = ''
  let decimalDigits = ''

  if (lastSep >= 0) {
    const after = text.slice(lastSep + 1).replace(/\D/g, '')
    const canBeDecimal = after.length > 0 && after.length <= 2
    if (canBeDecimal) {
      integerDigits = text.slice(0, lastSep).replace(/\D/g, '')
      decimalDigits = after.slice(0, 2)
    } else {
      integerDigits = text.replace(/\D/g, '')
    }
  } else {
    integerDigits = text.replace(/\D/g, '')
  }

  if (!integerDigits && !decimalDigits) return ''
  const integer = integerDigits ? Number(integerDigits) : 0
  return decimalDigits ? `${integer}.${decimalDigits}` : String(integer)
}

export function formatMoney(value, currency = 'USD') {
  const number = Number(value) || 0
  return new Intl.NumberFormat('es-PY', {
    style: 'currency',
    currency,
    currencyDisplay: 'symbol',
    minimumFractionDigits: currencyFractionDigits(currency),
    maximumFractionDigits: currencyFractionDigits(currency),
  }).format(number)
}
