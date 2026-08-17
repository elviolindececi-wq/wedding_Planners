import { Navigate, Route, Routes } from 'react-router-dom'
import AppShell from './components/AppShell.jsx'
import DashboardPage from './features/dashboard/DashboardPage.jsx'
import CrmPage from './features/crm/CrmPage.jsx'
import EventsPage from './features/events/EventsPage.jsx'
import EventWorkspace from './features/events/EventWorkspace.jsx'
import EventOverview from './features/events/EventOverview.jsx'
import EventSectionPlaceholder from './features/events/EventSectionPlaceholder.jsx'
import VendorsPage from './features/vendors/VendorsPage.jsx'
import CalendarPage from './features/calendar/CalendarPage.jsx'
import ResourcesPage from './features/resources/ResourcesPage.jsx'
import SimplePage from './features/settings/SimplePage.jsx'

export default function App(){
  return <Routes>
    <Route path="/" element={<Navigate to="/app" replace />} />
    <Route path="/app" element={<AppShell />}>
      <Route index element={<DashboardPage />} />
      <Route path="crm" element={<CrmPage />} />
      <Route path="eventos" element={<EventsPage />} />
      <Route path="eventos/:eventId" element={<EventWorkspace />}>
        <Route index element={<EventOverview />} />
        {['plan','presupuesto','proveedores','cotizaciones','pagos','invitados','mesas','diseno','experiencia','personas','dia','documentos','notas'].map(path => <Route key={path} path={path} element={<EventSectionPlaceholder />} />)}
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
}
