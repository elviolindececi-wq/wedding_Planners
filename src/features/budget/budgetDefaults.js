export const weddingBudgetCategories = [
  ['Lugar y alquiler', 'fixed', 15],
  ['Banquete y catering', 'per_guest', 28],
  ['Bebidas', 'per_guest', 8],
  ['Decoración y flores', 'fixed', 10],
  ['Fotografía y video', 'fixed', 8],
  ['Música y sonido', 'fixed', 5],
  ['Vestuario', 'fixed', 6],
  ['Belleza', 'fixed', 2],
  ['Ceremonia', 'fixed', 2],
  ['Papelería', 'per_guest', 1],
  ['Transporte', 'fixed', 1.5],
  ['Pastelería', 'per_guest', 2],
  ['Entretenimiento', 'fixed', 2],
  ['Alianzas', 'fixed', 2],
  ['Planificación / coordinación', 'fixed', 3.5],
  ['Imprevistos', 'fixed', 4],
  ['Otros', 'mixed', 0],
]

export const quinceBudgetCategories = [
  ['Salón y alquiler', 'fixed', 15],
  ['Banquete y catering', 'per_guest', 25],
  ['Bebidas', 'per_guest', 7],
  ['Decoración y flores', 'fixed', 11],
  ['Fotografía y video', 'fixed', 8],
  ['Música, DJ y sonido', 'fixed', 6],
  ['Vestido y vestuario', 'fixed', 6],
  ['Belleza', 'fixed', 3],
  ['Ceremonia', 'fixed', 2],
  ['Papelería e invitaciones', 'per_guest', 1],
  ['Transporte', 'fixed', 1.5],
  ['Torta y mesa dulce', 'per_guest', 3],
  ['Entretenimiento', 'fixed', 3],
  ['Coreografía / baile', 'fixed', 1.5],
  ['Souvenirs', 'per_guest', 2],
  ['Planificación / coordinación', 'fixed', 2],
  ['Imprevistos', 'fixed', 3],
  ['Otros', 'mixed', 0],
]

export function getDefaultBudgetCategories(event) {
  const source = event?.event_type === 'quince' ? quinceBudgetCategories : weddingBudgetCategories
  return source.map(([name, cost_type], index) => ({
    id: crypto.randomUUID(),
    event_id: event.id,
    name,
    cost_type,
    planned_amount: 0,
    sort_order: index,
  }))
}

export function getDistributionWeightMap(eventType) {
  const source = eventType === 'quince' ? quinceBudgetCategories : weddingBudgetCategories
  return new Map(source.map(([name, , weight]) => [normalizeCategoryName(name), Number(weight) || 0]))
}

export function normalizeCategoryName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}
