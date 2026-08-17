import { NavLink, Outlet } from 'react-router-dom'
import { mainNavigation } from '../app/navigation.js'

export default function AppShell() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">P</span>
          <div>
            <strong>Planner</strong>
            <small>nombre de trabajo</small>
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
            <strong>Estudio Demo</strong>
          </div>
          <div className="avatar">CL</div>
        </header>
        <div className="page-wrap"><Outlet /></div>
      </main>
    </div>
  )
}
