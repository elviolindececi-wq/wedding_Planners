import { NavLink, Outlet } from 'react-router-dom'
import { mainNavigation } from '../app/navigation.js'
import { useAuth } from '../auth/AuthProvider.jsx'
import { useOrganization } from '../organization/OrganizationProvider.jsx'

export default function AppShell() {
  const { user, signOut } = useAuth()
  const { organization, subscription } = useOrganization()
  const displayName = user?.user_metadata?.full_name || user?.email || 'Planner'
  const initials = getInitials(displayName)

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">P</span>
          <div>
            <strong>Planner</strong>
            <small>{subscription?.plan_code ? `Plan ${subscription.plan_code}` : 'nombre de trabajo'}</small>
          </div>
        </div>

        <nav className="nav-list">
          {mainNavigation.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/app'} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <span>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <NavLink to="/app/equipo" className="nav-item">Mi equipo</NavLink>
          <NavLink to="/app/plan" className="nav-item">Mi plan</NavLink>
          <NavLink to="/app/configuracion" className="nav-item">Configuración</NavLink>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div>
            <small>Organización</small>
            <strong>{organization?.name || 'Mi estudio'}</strong>
          </div>
          <div className="account-area">
            <div className="account-copy"><strong>{displayName}</strong><button className="text-btn" type="button" onClick={signOut}>Salir</button></div>
            <div className="avatar" title={displayName}>{initials}</div>
          </div>
        </header>
        <div className="page-wrap"><Outlet /></div>
      </main>
    </div>
  )
}

function getInitials(value) {
  return value
    .split(/\s+|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'P'
}
