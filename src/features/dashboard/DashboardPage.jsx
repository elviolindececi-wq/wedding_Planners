const events = [
  { id: 'ana-mateo', type: 'Boda', name: 'Ana & Mateo', date: '15 AGO 2027', alert: '3 tareas vencidas', next: 'Pago catering mañana' },
  { id: 'valentina', type: 'Quinceaños', name: 'Valentina', date: '22 SEP 2027', alert: 'Todo al día', next: 'Prueba de vestido · viernes' },
  { id: 'sofia-juan', type: 'Boda', name: 'Sofía & Juan', date: '03 OCT 2027', alert: '18 invitados pendientes', next: 'Reunión técnica · 20 ago' },
]

export default function DashboardPage() {
  return (
    <section>
      <div className="page-heading">
        <div><p className="eyebrow">HOY</p><h1>Tu operación, en un solo lugar</h1><p>Negocio, clientas y eventos sin mezclar información.</p></div>
        <button className="primary-btn">+ Nuevo evento</button>
      </div>

      <div className="metrics-grid">
        <article className="metric"><span>Leads activos</span><strong>14</strong><small>3 necesitan seguimiento</small></article>
        <article className="metric"><span>Eventos activos</span><strong>12</strong><small>8 bodas · 4 quinceaños</small></article>
        <article className="metric"><span>Pipeline</span><strong>US$ 34.500</strong><small>5 propuestas abiertas</small></article>
        <article className="metric"><span>Cobros pendientes</span><strong>US$ 4.200</strong><small>Del negocio de la planner</small></article>
      </div>

      <div className="section-title"><div><p className="eyebrow">OPERACIÓN</p><h2>Próximos eventos</h2></div><a href="/app/eventos">Ver todos</a></div>
      <div className="cards-grid">
        {events.map((event) => (
          <a className="event-card" href={`/app/eventos/${event.id}`} key={event.id}>
            <div className="event-card-top"><span className="pill">{event.type}</span><strong>{event.date}</strong></div>
            <h3>{event.name}</h3>
            <p>{event.alert}</p>
            <small>{event.next}</small>
          </a>
        ))}
      </div>
    </section>
  )
}
