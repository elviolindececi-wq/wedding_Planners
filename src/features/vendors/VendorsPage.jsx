import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { useOrganization } from '../../organization/OrganizationProvider.jsx'
import VendorModal from './VendorModal.jsx'

export default function VendorsPage() {
  const { organization } = useOrganization()
  const [vendors, setVendors] = useState([])
  const [links, setLinks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)

  const loadAll = useCallback(async () => {
    if (!organization?.id) return
    setLoading(true); setError('')
    const [vendorRes, linkRes] = await Promise.all([
      supabase.from('vendors').select('*').eq('organization_id', organization.id).order('company_name'),
      supabase.from('event_vendors').select('vendor_id,event_id,status'),
    ])
    if (vendorRes.error || linkRes.error) setError(vendorRes.error?.message || linkRes.error?.message)
    setVendors(vendorRes.data || []); setLinks(linkRes.data || []); setLoading(false)
  }, [organization?.id])

  useEffect(() => { loadAll() }, [loadAll])

  const categories = useMemo(() => [...new Set(vendors.map(v => v.category).filter(Boolean))].sort((a,b) => a.localeCompare(b)), [vendors])
  const counts = useMemo(() => {
    const map = new Map()
    links.forEach(link => map.set(link.vendor_id, (map.get(link.vendor_id) || 0) + 1))
    return map
  }, [links])
  const filtered = vendors.filter(v => {
    if (category !== 'all' && v.category !== category) return false
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      return [v.company_name,v.contact_name,v.category,v.phone,v.email,v.instagram,v.general_notes].filter(Boolean).some(x => x.toLowerCase().includes(q))
    }
    return true
  })

  async function removeVendor(vendor) {
    if ((counts.get(vendor.id) || 0) > 0) return window.alert('Este proveedor está vinculado a uno o más eventos. Quitá primero esas asignaciones para eliminarlo del directorio.')
    if (!window.confirm(`¿Eliminar “${vendor.company_name}” del directorio?`)) return
    const { error: deleteError } = await supabase.from('vendors').delete().eq('id', vendor.id).eq('organization_id', organization.id)
    if (deleteError) setError(deleteError.message); else loadAll()
  }

  return <section className="vendors-directory-page">
    <div className="page-heading"><div><p className="eyebrow">RECURSO COMPARTIDO</p><h1>Directorio de proveedores</h1><p>Guardá el contacto una sola vez. Precios, cotizaciones, moneda y contratación se administran dentro de cada evento.</p></div><button className="primary-btn" onClick={() => { setEditing(null); setModal(true) }}>+ Nuevo proveedor</button></div>
    <div className="planning-metrics vendor-directory-metrics"><Metric label="Proveedores" value={vendors.length} detail="En tu agenda"/><Metric label="Rubros" value={categories.length} detail="Categorías del directorio"/><Metric label="Vinculaciones" value={links.length} detail="Asignaciones a eventos"/><Metric label="Contratados" value={links.filter(x => x.status === 'contracted').length} detail="En eventos activos"/></div>
    <div className="vendor-toolbar"><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar proveedor, contacto, rubro…"/><select value={category} onChange={e => setCategory(e.target.value)}><option value="all">Todos los rubros</option>{categories.map(x => <option key={x} value={x}>{x}</option>)}</select></div>
    {error && <p className="form-error">{error}</p>}
    {loading ? <div className="panel loading-panel">Cargando proveedores…</div> : filtered.length ? <div className="vendor-directory-grid">{filtered.map(v => <article className="panel vendor-directory-card" key={v.id}>
      <div className="vendor-card-head"><div><span className="pill">{v.category || 'Sin rubro'}</span><h3>{v.company_name}</h3></div>{v.rating ? <span className="vendor-rating">{'★'.repeat(v.rating)}</span> : null}</div>
      <p className="vendor-contact-main">{v.contact_name || 'Contacto no cargado'}</p>
      <div className="vendor-contact-list">{v.phone && <span>☎ {v.phone}</span>}{v.email && <span>✉ {v.email}</span>}{v.instagram && <span>◎ {v.instagram}</span>}</div>
      <div className="vendor-card-footer"><span>{counts.get(v.id) || 0} evento{(counts.get(v.id) || 0) === 1 ? '' : 's'} vinculado{(counts.get(v.id) || 0) === 1 ? '' : 's'}</span><div><button className="text-action" onClick={() => { setEditing(v); setModal(true) }}>Editar</button><button className="text-action danger-action" onClick={() => removeVendor(v)}>Eliminar</button></div></div>
    </article>)}</div> : <div className="panel empty-state"><p className="eyebrow">DIRECTORIO</p><h2>{vendors.length ? 'No hay coincidencias' : 'Todavía no cargaste proveedores'}</h2><p>Tu agenda de proveedores se comparte entre todos tus eventos.</p>{!vendors.length && <button className="primary-btn" onClick={() => setModal(true)}>Crear primer proveedor</button>}</div>}
    <VendorModal open={modal} organizationId={organization?.id} vendor={editing} onClose={() => setModal(false)} onSaved={async () => { setModal(false); await loadAll() }}/>
  </section>
}

function Metric({ label, value, detail }) { return <article className="planning-metric"><span>{label}</span><strong>{value}</strong><small>{detail}</small></article> }
