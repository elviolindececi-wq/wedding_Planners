import { useEffect, useMemo, useState } from 'react'
import { fetchExchangeRate, formatExchangeRate } from '../../lib/exchangeRates.js'

export default function CurrencyChangeModal({ open, fromCurrency, toCurrency, hasAmounts, onClose, onConfirm }) {
  const [mode, setMode] = useState(hasAmounts ? 'automatic' : 'label_only')
  const [automaticRate, setAutomaticRate] = useState(null)
  const [automaticDate, setAutomaticDate] = useState('')
  const [automaticSource, setAutomaticSource] = useState('')
  const [manualRate, setManualRate] = useState('')
  const [loadingRate, setLoadingRate] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setMode(hasAmounts ? 'automatic' : 'label_only')
    setAutomaticRate(null)
    setAutomaticDate('')
    setAutomaticSource('')
    setManualRate('')
    setError('')
    setSubmitting(false)
  }, [open, fromCurrency, toCurrency, hasAmounts])

  useEffect(() => {
    if (!open || mode !== 'automatic' || !hasAmounts) return
    let active = true
    setLoadingRate(true)
    setError('')
    fetchExchangeRate(fromCurrency, toCurrency)
      .then((result) => {
        if (!active) return
        setAutomaticRate(result.rate)
        setAutomaticDate(result.date || '')
        setAutomaticSource(result.source || '')
      })
      .catch((err) => {
        if (!active) return
        setError(`${err.message} Podés usar un tipo de cambio manual.`)
        setMode('manual')
      })
      .finally(() => { if (active) setLoadingRate(false) })
    return () => { active = false }
  }, [open, mode, hasAmounts, fromCurrency, toCurrency])

  const selectedRate = useMemo(() => {
    if (mode === 'automatic') return Number(automaticRate) || 0
    if (mode === 'manual') return parseRate(manualRate)
    return 1
  }, [mode, automaticRate, manualRate])

  if (!open) return null

  async function submit() {
    if (mode !== 'label_only' && !(selectedRate > 0)) {
      setError('Ingresá un tipo de cambio mayor a cero.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await onConfirm?.({
        mode: mode === 'label_only' ? 'label_only' : 'convert',
        rate: mode === 'label_only' ? 1 : selectedRate,
        source: mode === 'automatic' ? automaticSource : mode === 'manual' ? 'Manual' : 'Sin conversión',
        date: mode === 'automatic' ? automaticDate : mode === 'manual' ? new Date().toISOString().slice(0, 10) : null,
      })
    } catch (err) {
      setError(err.message || 'No se pudo cambiar la moneda.')
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.() }}>
      <div className="modal-card currency-change-modal" role="dialog" aria-modal="true" aria-labelledby="currency-change-title">
        <div className="modal-head">
          <div>
            <p className="eyebrow">CAMBIAR MONEDA</p>
            <h2 id="currency-change-title">{fromCurrency} → {toCurrency}</h2>
            <p>Elegí qué debe pasar con los importes que ya cargaste.</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">×</button>
        </div>

        <div className="currency-change-options">
          {hasAmounts && <label className={`currency-option ${mode === 'automatic' ? 'active' : ''}`}>
            <input type="radio" name="currency-mode" value="automatic" checked={mode === 'automatic'} onChange={() => setMode('automatic')} />
            <span><strong>Convertir automáticamente</strong><small>Consulta una tasa de referencia y convierte presupuesto, categorías, conceptos y pagos.</small></span>
          </label>}

          {hasAmounts && <label className={`currency-option ${mode === 'manual' ? 'active' : ''}`}>
            <input type="radio" name="currency-mode" value="manual" checked={mode === 'manual'} onChange={() => setMode('manual')} />
            <span><strong>Usar mi propio tipo de cambio</strong><small>Ideal si trabajás con una cotización bancaria, de casa de cambios o pactada con la clienta.</small></span>
          </label>}

          <label className={`currency-option ${mode === 'label_only' ? 'active' : ''}`}>
            <input type="radio" name="currency-mode" value="label_only" checked={mode === 'label_only'} onChange={() => setMode('label_only')} />
            <span><strong>Solo cambiar la moneda</strong><small>No convierte los números. Úsalo solo si los importes ya estaban escritos en {toCurrency}.</small></span>
          </label>
        </div>

        {mode === 'automatic' && hasAmounts && <div className="exchange-rate-box">
          <span>Tipo de cambio de referencia</span>
          <strong>{loadingRate ? 'Consultando…' : formatExchangeRate(automaticRate, fromCurrency, toCurrency)}</strong>
          {!loadingRate && automaticSource && <small>{automaticSource}{automaticDate ? ` · ${formatDate(automaticDate)}` : ''}</small>}
        </div>}

        {mode === 'manual' && hasAmounts && <div className="manual-rate-box">
          <label>Tu tipo de cambio
            <div className="rate-input-row"><span>1 {fromCurrency} =</span><input autoFocus inputMode="decimal" value={manualRate} onChange={(e) => setManualRate(e.target.value)} placeholder="Ej. 7150" /><span>{toCurrency}</span></div>
          </label>
          {selectedRate > 0 && <small>{formatExchangeRate(selectedRate, fromCurrency, toCurrency)}</small>}
        </div>}

        {mode === 'label_only' && hasAmounts && <p className="currency-warning">Los valores numéricos quedarán exactamente iguales. Solo cambiará la moneda de referencia.</p>}
        <p className="form-hint">La conversión se aplica en una sola operación en Supabase para evitar importes mezclados entre monedas.</p>
        {error && <p className="form-error">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="secondary-btn" onClick={onClose}>Cancelar</button>
          <button type="button" className="primary-btn" onClick={submit} disabled={submitting || loadingRate || (mode !== 'label_only' && !(selectedRate > 0))}>{submitting ? 'Convirtiendo…' : mode === 'label_only' ? 'Cambiar moneda' : 'Convertir y cambiar'}</button>
        </div>
      </div>
    </div>
  )
}

function parseRate(value) {
  const raw = String(value || '').trim().replace(/\s/g, '')
  if (!raw) return 0
  // Si hay un único separador seguido de 3 dígitos, lo tratamos como miles (7.150 → 7150).
  if (/^\d+[.,]\d{3}$/.test(raw)) return Number(raw.replace(/[.,]/g, '')) || 0
  const normalized = raw.includes(',') && !raw.includes('.') ? raw.replace(',', '.') : raw.replace(/,/g, '')
  return Number(normalized) || 0
}

function formatDate(value) {
  try {
    return new Intl.DateTimeFormat('es-PY', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`))
  } catch {
    return value
  }
}
