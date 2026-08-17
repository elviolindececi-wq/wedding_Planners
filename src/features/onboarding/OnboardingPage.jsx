import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import { useAuth } from '../../auth/AuthProvider.jsx'
import { useOrganization } from '../../organization/OrganizationProvider.jsx'

export default function OnboardingPage() {
  const { user, signOut } = useAuth()
  const { organization, loading, error: organizationError, refresh } = useOrganization()
  const navigate = useNavigate()
  const defaultName = useMemo(() => user?.user_metadata?.full_name || '', [user])
  const [organizationName, setOrganizationName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!organizationName && defaultName) setOrganizationName(`Estudio de ${defaultName}`)
  }, [defaultName, organizationName])

  if (!loading && organization) return <Navigate to="/app" replace />

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    setError('')

    const name = organizationName.trim()
    const slug = slugify(name)
    const { error: rpcError } = await supabase.rpc('create_my_organization', { p_name: name, p_slug: slug || null })

    if (rpcError) {
      setError(toFriendlyOrganizationError(rpcError.message))
      setSubmitting(false)
      return
    }

    await refresh()
    navigate('/app', { replace: true })
    setSubmitting(false)
  }

  return (
    <div className="auth-screen onboarding-screen">
      <section className="auth-visual">
        <div className="auth-visual-inner">
          <div className="brand brand-auth brand-auth-light"><span className="brand-mark">P</span><div><strong>Planner</strong><small>nombre de trabajo</small></div></div>
          <p className="eyebrow eyebrow-light">PRIMER PASO</p>
          <h1>Creemos el espacio de tu negocio.</h1>
          <p>Esta organización será el contenedor de tu equipo, CRM, proveedores y eventos.</p>
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <p className="eyebrow">TU ORGANIZACIÓN</p>
          <h1>¿Cómo se llama tu estudio?</h1>
          <p className="auth-subtitle">Podés cambiar este nombre más adelante.</p>

          {organizationError && <p className="form-error">{organizationError}</p>}
          <form className="auth-form" onSubmit={handleSubmit}>
            <label>Nombre del estudio<input value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} placeholder="Ej. Ceci Wedding & Events" required /></label>
            {error && <p className="form-error">{error}</p>}
            <button className="primary-btn auth-submit" type="submit" disabled={submitting || loading}>{submitting ? 'Creando…' : 'Crear mi espacio'}</button>
          </form>
          <button type="button" className="text-btn onboarding-signout" onClick={signOut}>Cerrar sesión</button>
        </div>
      </section>
    </div>
  )
}

function slugify(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)
}

function toFriendlyOrganizationError(message = '') {
  if (message.includes('organization_already_exists')) return 'Esta cuenta ya tiene una organización creada.'
  if (message.includes('organizations_slug_key')) return 'Ese identificador ya está en uso. Probá con otro nombre de estudio.'
  return message || 'No pudimos crear la organización.'
}
