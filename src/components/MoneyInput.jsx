import { currencyMark, formatEditableAmount, parseEditableAmount } from '../lib/money.js'

export default function MoneyInput({
  value,
  onChange,
  onBlur,
  currency = 'USD',
  placeholder = '0',
  disabled = false,
  className = '',
  ariaLabel,
}) {
  const displayValue = formatEditableAmount(value, currency)

  return (
    <div className={`money-input ${disabled ? 'is-disabled' : ''} ${className}`.trim()}>
      <span className="money-input-mark">{currencyMark(currency)}</span>
      <input
        type="text"
        inputMode="decimal"
        value={displayValue}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(event) => onChange?.(parseEditableAmount(event.target.value, currency))}
        onBlur={onBlur}
      />
    </div>
  )
}
