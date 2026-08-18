const API_BASE = 'https://api.frankfurter.dev/v2'

export async function fetchExchangeRate(baseCurrency, quoteCurrency) {
  const base = String(baseCurrency || '').toUpperCase()
  const quote = String(quoteCurrency || '').toUpperCase()
  if (!base || !quote) throw new Error('Monedas incompletas.')
  if (base === quote) return { rate: 1, date: new Date().toISOString().slice(0, 10), source: 'Misma moneda' }

  // Para pares con PYG intentamos primero la referencia del Banco Central del Paraguay.
  // Si ese proveedor no publica el par elegido, caemos al agregado de fuentes oficiales.
  if (base === 'PYG' || quote === 'PYG') {
    try {
      const bcp = await requestRate(base, quote, 'BCP')
      if (bcp?.rate > 0) return { ...bcp, source: 'Banco Central del Paraguay (BCP)' }
    } catch {
      // fallback intencional
    }
  }

  const blended = await requestRate(base, quote)
  return { ...blended, source: 'Frankfurter · fuentes oficiales' }
}

async function requestRate(base, quote, provider = '') {
  const params = provider ? `?providers=${encodeURIComponent(provider)}` : ''
  const response = await fetch(`${API_BASE}/rate/${encodeURIComponent(base)}/${encodeURIComponent(quote)}${params}`)
  if (!response.ok) throw new Error('No se pudo consultar el tipo de cambio automático.')
  const data = await response.json()
  const rate = Number(data?.rate)
  if (!(rate > 0)) throw new Error('La fuente no devolvió un tipo de cambio válido.')
  return { rate, date: data.date || new Date().toISOString().slice(0, 10) }
}

export function formatExchangeRate(value, base, quote) {
  const rate = Number(value)
  if (!Number.isFinite(rate) || rate <= 0) return '—'
  const maximumFractionDigits = rate >= 100 ? 2 : rate >= 1 ? 4 : 8
  return `1 ${base} = ${new Intl.NumberFormat('es-PY', { maximumFractionDigits }).format(rate)} ${quote}`
}
