import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import { useAuth } from '../../auth/AuthProvider.jsx'

export default function AuthPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mode, setMode] = useState('login')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  if (!loading && user) return <Navigate to="/app" replace />

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setMessage('')

    try {
      if (mode === 'login') {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (signInError) throw signInError
        navigate(location.state?.from || '/app', { replace: true })
        return
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: fullName.trim() } },
      })
      if (signUpError) throw signUpError

      if (data.session) {
        navigate('/onboarding', { replace: true })
      } else {
        setMessage('Cuenta creada. Revisá tu email para confirmar el registro y después iniciá sesión.')
        setMode('login')
        setPassword('')
      }
    } catch (err) {
      setError(toFriendlyAuthError(err?.message))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-screen">
      <section className="auth-visual">
        <div className="auth-visual-inner">
          <div className="brand brand-auth brand-auth-light">
            <span className="brand-mark">P</span>
            <div><strong>Planner</strong><small>nombre de trabajo</small></div>
          </div>
          <p className="eyebrow eyebrow-light">TU OPERACIÓN</p>
          <h1>Tu negocio y cada evento, en un solo lugar.</h1>
          <p>CRM, planificación, proveedores, presupuesto y experiencia para bodas y quinceaños.</p>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-mobile-brand brand brand-auth">
            <span className="brand-mark">P</span>
            <div><strong>Planner</strong><small>nombre de trabajo</small></div>
          </div>
          <p className="eyebrow">ACCESO PROFESIONAL</p>
          <h1>{mode === 'login' ? 'Ingresá a tu espacio' : 'Creá tu cuenta'}</h1>
          <p className="auth-subtitle">{mode === 'login' ? 'Continuá gestionando tu operación.' : 'Empezá con tu organización y tu primer evento.'}</p>

          <div className="auth-switch" role="tablist" aria-label="Acceso">
            <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError(''); setMessage('') }}>Ingresar</button>
            <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setError(''); setMessage('') }}>Crear cuenta</button>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {mode === 'register' && (
              <label>Nombre y apellido<input value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" required /></label>
            )}
            <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></label>
            <label>Contraseña<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={8} required /></label>

            {error && <p className="form-error">{error}</p>}
            {message && <p className="form-success">{message}</p>}

            <button className="primary-btn auth-submit" type="submit" disabled={submitting}>
              {submitting ? 'Procesando…' : mode === 'login' ? 'Ingresar' : 'Crear cuenta'}
            </button>
          </form>
        </div>
      </section>
    </div>
  )
}

function toFriendlyAuthError(message = '') {
  const value = message.toLowerCase()
  if (value.includes('invalid login credentials')) return 'Email o contraseña incorrectos.'
  if (value.includes('email not confirmed')) return 'Primero confirmá tu email desde el mensaje que te envió Supabase.'
  if (value.includes('user already registered')) return 'Ya existe una cuenta con ese email.'
  if (value.includes('password')) return 'La contraseña no cumple los requisitos de seguridad.'
  return message || 'No pudimos completar la operación.'
}
