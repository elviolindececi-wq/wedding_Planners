import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider.jsx'
import RequireAuth from './auth/RequireAuth.jsx'
import { OrganizationProvider } from './organization/OrganizationProvider.jsx'
import RequireOrganization from './organization/RequireOrganization.jsx'
import AuthPage from './features/auth/AuthPage.jsx'
import OnboardingPage from './features/onboarding/OnboardingPage.jsx'
import AppShell from './components/AppShell.jsx'
import DashboardPage from './features/dashboard/DashboardPage.jsx'
import CrmPage from './features/crm/CrmPage.jsx'
import EventsPage from './features/events/EventsPage.jsx'
import EventWorkspace from './features/events/EventWorkspace.jsx'
import EventOverview from './features/events/EventOverview.jsx'
import PlanningPage from './features/planning/PlanningPage.jsx'
import EventSectionPlaceholder from './features/events/EventSectionPlaceholder.jsx'
import VendorsPage from './features/vendors/VendorsPage.jsx'
import CalendarPage from './features/calendar/CalendarPage.jsx'
import ResourcesPage from './features/resources/ResourcesPage.jsx'
import SimplePage from './features/settings/SimplePage.jsx'

function ProtectedOrganizationArea({ children }) {
  return (
    <RequireAuth>
      <OrganizationProvider>
        {children}
      </OrganizationProvider>
    </RequireAuth>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/app" replace />} />
        <Route path="/login" element={<AuthPage />} />
        <Route path="/onboarding" element={<ProtectedOrganizationArea><OnboardingPage /></ProtectedOrganizationArea>} />

        <Route path="/app" element={<ProtectedOrganizationArea><RequireOrganization><AppShell /></RequireOrganization></ProtectedOrganizationArea>}>
          <Route index element={<DashboardPage />} />
          <Route path="crm" element={<CrmPage />} />
          <Route path="eventos" element={<EventsPage />} />
          <Route path="eventos/:eventId" element={<EventWorkspace />}>
            <Route index element={<EventOverview />} />
            <Route path="plan" element={<PlanningPage />} />
            {['presupuesto','proveedores','cotizaciones','pagos','invitados','mesas','diseno','experiencia','personas','dia','documentos','notas'].map(path => <Route key={path} path={path} element={<EventSectionPlaceholder />} />)}
          </Route>
          <Route path="proveedores" element={<VendorsPage />} />
          <Route path="calendario" element={<CalendarPage />} />
          <Route path="recursos" element={<ResourcesPage />} />
          <Route path="equipo" element={<SimplePage title="Mi equipo" description="Usuarios internos, roles y asignaciones por evento." />} />
          <Route path="plan" element={<SimplePage title="Mi plan" description="Límites por usuarios internos y eventos activos." />} />
          <Route path="configuracion" element={<SimplePage title="Configuración" description="Organización, integraciones y preferencias." />} />
        </Route>

        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </AuthProvider>
  )
}
