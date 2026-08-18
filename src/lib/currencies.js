export const CURRENCIES = [
  { code: 'PYG', symbol: '₲', label: 'Guaraní paraguayo' },
  { code: 'ARS', symbol: '$', label: 'Peso argentino' },
  { code: 'BRL', symbol: 'R$', label: 'Real brasileño' },
  { code: 'UYU', symbol: '$U', label: 'Peso uruguayo' },
  { code: 'BOB', symbol: 'Bs', label: 'Boliviano' },
  { code: 'CLP', symbol: '$', label: 'Peso chileno' },
  { code: 'COP', symbol: '$', label: 'Peso colombiano' },
  { code: 'PEN', symbol: 'S/', label: 'Sol peruano' },
  { code: 'VES', symbol: 'Bs', label: 'Bolívar venezolano' },
  { code: 'CRC', symbol: '₡', label: 'Colón costarricense' },
  { code: 'GTQ', symbol: 'Q', label: 'Quetzal guatemalteco' },
  { code: 'HNL', symbol: 'L', label: 'Lempira hondureño' },
  { code: 'NIO', symbol: 'C$', label: 'Córdoba nicaragüense' },
  { code: 'PAB', symbol: 'B/', label: 'Balboa panameño' },
  { code: 'DOP', symbol: 'RD$', label: 'Peso dominicano' },
  { code: 'USD', symbol: '$', label: 'Dólar estadounidense' },
  { code: 'CAD', symbol: '$', label: 'Dólar canadiense' },
  { code: 'MXN', symbol: '$', label: 'Peso mexicano' },
  { code: 'EUR', symbol: '€', label: 'Euro' },
  { code: 'GBP', symbol: '£', label: 'Libra esterlina' },
  { code: 'CHF', symbol: 'Fr', label: 'Franco suizo' },
  { code: 'JPY', symbol: '¥', label: 'Yen japonés' },
  { code: 'CNY', symbol: '¥', label: 'Yuan chino' },
  { code: 'KRW', symbol: '₩', label: 'Won surcoreano' },
  { code: 'INR', symbol: '₹', label: 'Rupia india' },
  { code: 'AUD', symbol: '$', label: 'Dólar australiano' },
  { code: 'NZD', symbol: '$', label: 'Dólar neozelandés' },
  { code: 'AED', symbol: 'د.إ', label: 'Dírham emiratí' },
  { code: 'SAR', symbol: '﷼', label: 'Riyal saudí' },
  { code: 'ZAR', symbol: 'R', label: 'Rand sudafricano' },
]

export function currencyLabel(code) {
  const item = CURRENCIES.find(currency => currency.code === code)
  return item ? `${item.code} · ${item.label}` : code
}
