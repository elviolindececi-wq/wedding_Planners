import { Navigate } from 'react-router-dom'
import { useOrganization } from './OrganizationProvider.jsx'

export default function RequireOrganization({ children }) {
  const { organization, loading, error } = useOrganization()

  if (loading) {
    return <div className="auth-screen auth-screen-center"><div className="auth-card compact-state"><h1>Cargando tu espacio…</h1><p>Estamos preparando la organización.</p></div></div>
  }

  if (error) {
    return <div className="auth-screen auth-screen-center"><div className="auth-card compact-state"><h1>No pudimos cargar tu organización</h1><p className="form-error">{error}</p></div></div>
  }

  if (!organization) return <Navigate to="/onboarding" replace />

  return children
}
