import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider.jsx'

export default function RequireAuth({ children }) {
  const { user, loading, authError } = useAuth()
  const location = useLocation()

  if (loading) return <FullScreenState title="Validando sesión…" />
  if (authError) return <FullScreenState title="No se pudo iniciar la aplicación" detail={authError} />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />

  return children
}

function FullScreenState({ title, detail }) {
  return (
    <div className="auth-screen auth-screen-center">
      <div className="auth-card compact-state">
        <div className="brand brand-auth">
          <span className="brand-mark">P</span>
          <div><strong>Planner</strong><small>nombre de trabajo</small></div>
        </div>
        <h1>{title}</h1>
        {detail ? <p className="form-error">{detail}</p> : <p>Un momento.</p>}
      </div>
    </div>
  )
}
