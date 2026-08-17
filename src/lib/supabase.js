import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()
const expectedRef = import.meta.env.VITE_EXPECTED_SUPABASE_PROJECT_REF?.trim()

function projectRefFromUrl(value) {
  if (!value) return null
  try {
    const host = new URL(value).hostname
    return host.endsWith('.supabase.co') ? host.split('.')[0] : null
  } catch {
    return null
  }
}

export function assertSafeSupabaseConfig() {
  if (!url && !anonKey) return { configured: false }
  if (!url || !anonKey) throw new Error('Configuración Supabase incompleta.')
  if (!expectedRef) {
    throw new Error('Falta VITE_EXPECTED_SUPABASE_PROJECT_REF. La app se niega a conectar sin esta guarda.')
  }

  const actualRef = projectRefFromUrl(url)
  if (!actualRef || actualRef !== expectedRef) {
    throw new Error('Supabase bloqueado: la URL no coincide con el project-ref esperado para este producto nuevo.')
  }

  return { configured: true, projectRef: actualRef }
}

const safety = assertSafeSupabaseConfig()
export const supabase = safety.configured ? createClient(url, anonKey) : null
export const isSupabaseConfigured = safety.configured
