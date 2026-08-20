export function paymentEventAmount(payment, eventCurrency) {
  if (!payment) return 0
  if (payment.event_amount !== null && payment.event_amount !== undefined) return Number(payment.event_amount) || 0
  if ((payment.currency || eventCurrency) === eventCurrency) return Number(payment.amount) || 0
  const rate = Number(payment.exchange_rate || 0)
  return rate > 0 ? (Number(payment.amount) || 0) * rate : 0
}

export function paymentPayloadAmounts({ amount, currency, eventCurrency, exchangeRate, exchangeRateSource, exchangeRateDate }) {
  const raw = Number(amount) || 0
  const same = currency === eventCurrency
  const rate = same ? 1 : Number(exchangeRate || 0)
  if (!same && !(rate > 0)) throw new Error('Ingresá o consultá un tipo de cambio válido para este pago.')
  const zeroDecimal = ['PYG','CLP','JPY','KRW'].includes(eventCurrency)
  const eventAmount = same ? raw : raw * rate
  return {
    amount: raw,
    currency,
    exchange_rate: rate,
    exchange_rate_source: same ? 'Misma moneda' : (exchangeRateSource || 'Manual'),
    exchange_rate_date: same ? new Date().toISOString().slice(0,10) : (exchangeRateDate || new Date().toISOString().slice(0,10)),
    event_amount: zeroDecimal ? Math.round(eventAmount) : Math.round(eventAmount * 100) / 100,
  }
}
