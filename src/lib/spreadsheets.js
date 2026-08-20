let sheetJsPromise

export async function loadSheetJS() {
  if (window.XLSX) return window.XLSX
  if (!sheetJsPromise) {
    sheetJsPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
      script.async = true
      script.onload = () => window.XLSX ? resolve(window.XLSX) : reject(new Error('No se pudo cargar el lector de Excel.'))
      script.onerror = () => reject(new Error('No se pudo cargar el lector de Excel. Revisá tu conexión.'))
      document.head.appendChild(script)
    })
  }
  return sheetJsPromise
}

export async function readWorkbook(file) {
  const XL = await loadSheetJS()
  const lower = String(file?.name || '').toLowerCase()
  if (!lower.endsWith('.xlsx') && !lower.endsWith('.xls')) throw new Error('Elegí un archivo .xlsx o .xls.')
  const data = await file.arrayBuffer()
  return { XL, workbook: XL.read(data, { cellDates: true }) }
}

export function sheetRows(XL, workbook, sheetName) {
  const key = workbook.SheetNames.find(name => normalizeSpreadsheetKey(name) === normalizeSpreadsheetKey(sheetName))
  if (!key) return []
  return XL.utils.sheet_to_json(workbook.Sheets[key], { header: 1, defval: '', raw: false, dateNF: 'yyyy-mm-dd' })
}

export function findHeader(rows, required = [], recognized = []) {
  for (let i = 0; i < rows.length; i += 1) {
    const normalized = (rows[i] || []).map(normalizeSpreadsheetKey)
    if (!required.every(value => normalized.includes(normalizeSpreadsheetKey(value)))) continue
    if (recognized.length) {
      const count = normalized.filter(value => recognized.map(normalizeSpreadsheetKey).includes(value)).length
      if (count < Math.min(2, recognized.length)) continue
    }
    return { index: i, headers: normalized }
  }
  return null
}

export function normalizeSpreadsheetKey(value = '') {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

export function spreadsheetNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.max(0, value) : 0
  let raw = String(value ?? '').trim()
  if (!raw) return 0
  raw = raw.replace(/\s/g, '').replace(/[^0-9,.-]/g, '')
  const comma = raw.lastIndexOf(',')
  const dot = raw.lastIndexOf('.')
  if (comma >= 0 && dot >= 0) {
    const decimal = comma > dot ? ',' : '.'
    const thousands = decimal === ',' ? '.' : ','
    raw = raw.split(thousands).join('').replace(decimal, '.')
  } else if (comma >= 0) {
    const decimals = raw.length - comma - 1
    raw = decimals > 0 && decimals <= 2 ? raw.replace(',', '.') : raw.replace(/,/g, '')
  } else if (dot >= 0) {
    const decimals = raw.length - dot - 1
    if (decimals === 3 && /^\d{1,3}(\.\d{3})+$/.test(raw)) raw = raw.replace(/\./g, '')
  }
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0
}

export function spreadsheetDate(value) {
  if (!value) return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10)
  const raw = String(value).trim()
  if (!raw) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const parts = raw.split(/[\/.-]/).map(Number)
  if (parts.length === 3 && parts.every(Number.isFinite)) {
    const [a, b, c] = parts
    const year = a > 1900 ? a : c
    const month = a > 1900 ? b : b
    const day = a > 1900 ? c : a
    if (year > 1900 && month >= 1 && month <= 12 && day >= 1 && day <= 31) return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`
  }
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10)
}

export async function downloadWorkbook(filename, build) {
  const XL = await loadSheetJS()
  const workbook = XL.utils.book_new()
  await build(XL, workbook)
  XL.writeFile(workbook, filename)
}
