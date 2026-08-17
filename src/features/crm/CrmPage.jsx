const columns = [
  ['Nuevo contacto', ['Lucía & Tomás', 'Camila & Diego']],
  ['Reunión', ['Micaela & Bruno']],
  ['Propuesta enviada', ['Carla & Nico', 'Paula & Andrés']],
  ['Negociación', ['María & Pedro']],
  ['Ganada', ['Ana & Mateo']],
]

export default function CrmPage() {
  return (
    <section>
      <div className="page-heading"><div><p className="eyebrow">MI NEGOCIO</p><h1>CRM</h1><p>Seguimiento comercial separado de la operación de cada evento.</p></div><button className="primary-btn">+ Nueva oportunidad</button></div>
      <div className="pipeline">
        {columns.map(([title, items]) => (
          <div className="pipeline-col" key={title}><div className="pipeline-title"><strong>{title}</strong><span>{items.length}</span></div>{items.map((item) => <article className="lead-card" key={item}><strong>{item}</strong><small>Próximo seguimiento · 22 ago</small><span>US$ 2.500 potencial</span></article>)}</div>
        ))}
      </div>
    </section>
  )
}
