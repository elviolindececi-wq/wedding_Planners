import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import './designInspiration.css'

const CATEGORIES = [
  'General', 'Ceremonia', 'Recepción', 'Flores', 'Papelería', 'Iluminación',
  'Looks', 'Mesas & decoración', 'Torta', 'Detalles', 'Quinceañera', 'Otro',
]

const CATEGORY_ICONS = {
  General: '✦', Ceremonia: '♡', Recepción: '◇', Flores: '❀', Papelería: '✉',
  Iluminación: '✧', Looks: '♢', 'Mesas & decoración': '⌂', Torta: '♧',
  Detalles: '·', Quinceañera: '☆', Otro: '+',
}

const PALETTE_CATEGORY = 'Paleta'
const MAX_UPLOAD_MB = 12
const REFERENCE_STATUSES = [
  ['idea', 'Idea'],
  ['shortlisted', 'Preseleccionada'],
  ['selected', 'Elegida'],
  ['approved', 'Aprobada por cliente'],
  ['discarded', 'Descartada'],
]
const FINAL_STATUSES = new Set(['selected', 'approved'])

export default function DesignInspirationPage() {
  const { event, refreshEvent } = useOutletContext()
  const [items, setItems] = useState([])
  const [signedUrls, setSignedUrls] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [activeCategory, setActiveCategory] = useState('Todas')
  const [referenceModal, setReferenceModal] = useState(false)
  const [editingReference, setEditingReference] = useState(null)
  const [concept, setConcept] = useState(event.style_summary || '')
  const [savingConcept, setSavingConcept] = useState(false)
  const [colorName, setColorName] = useState('')
  const [colorHex, setColorHex] = useState('#8B5555')
  const [uploading, setUploading] = useState(false)
  const [boardMode, setBoardMode] = useState('all')
  const [eventVendors, setEventVendors] = useState([])
  const [budgetCategories, setBudgetCategories] = useState([])
  const uploadRef = useRef(null)

  useEffect(() => { setConcept(event.style_summary || '') }, [event.style_summary])

  const loadItems = useCallback(async () => {
    setLoading(true)
    setError('')
    const { data, error: queryError } = await supabase
      .from('inspiration_items')
      .select('*')
      .eq('event_id', event.id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })

    if (queryError) {
      setError(queryError.message)
      setLoading(false)
      return
    }

    const nextItems = data || []
    setItems(nextItems)
    await loadSignedUrls(nextItems, setSignedUrls)
    setLoading(false)
  }, [event.id])

  useEffect(() => { loadItems() }, [loadItems])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [vendorRes, categoryRes] = await Promise.all([
        supabase.from('event_vendors').select('id,service_category,vendor_id,vendors(company_name)').eq('event_id', event.id).order('created_at'),
        supabase.from('budget_categories').select('id,name').eq('event_id', event.id).order('sort_order'),
      ])
      if (cancelled) return
      if (!vendorRes.error) setEventVendors(vendorRes.data || [])
      if (!categoryRes.error) setBudgetCategories(categoryRes.data || [])
    })()
    return () => { cancelled = true }
  }, [event.id])

  const palette = useMemo(() => items.filter(item => Boolean(item.color_hex)), [items])
  const references = useMemo(() => items.filter(item => !item.color_hex), [items])

  const categoriesInUse = useMemo(() => {
    const set = new Set(references.map(item => item.category || 'General'))
    return CATEGORIES.filter(category => set.has(category))
  }, [references])

  const visibleReferences = useMemo(() => {
    let rows = activeCategory === 'Todas' ? references : references.filter(item => (item.category || 'General') === activeCategory)
    if (boardMode === 'final') rows = rows.filter(item => FINAL_STATUSES.has(item.decision_status || 'idea'))
    return rows
  }, [references, activeCategory, boardMode])

  const finalReferences = useMemo(() => references.filter(item => FINAL_STATUSES.has(item.decision_status || 'idea')), [references])

  const stats = useMemo(() => ({
    total: references.length,
    final: finalReferences.length,
    pinterest: references.filter(item => item.source_type === 'pinterest').length,
    uploads: references.filter(item => item.source_type === 'upload').length,
    palette: palette.length,
  }), [references, finalReferences, palette])

  async function saveConcept() {
    setSavingConcept(true); setError(''); setNotice('')
    const { error: updateError } = await supabase
      .from('events')
      .update({ style_summary: concept.trim() || null, updated_at: new Date().toISOString() })
      .eq('id', event.id)
    setSavingConcept(false)
    if (updateError) return setError(updateError.message)
    await refreshEvent?.()
    setNotice('✓ Concepto visual guardado.')
  }

  async function addColor() {
    const normalized = normalizeHex(colorHex)
    if (!normalized) return setError('Ingresá un color HEX válido, por ejemplo #CFA89B.')
    setError(''); setNotice('')
    const payload = {
      id: crypto.randomUUID(), event_id: event.id, category: PALETTE_CATEGORY,
      title: colorName.trim() || normalized.toUpperCase(), source_type: 'other',
      color_hex: normalized.toUpperCase(), note: null,
      sort_order: palette.length,
    }
    const { error: insertError } = await supabase.from('inspiration_items').insert(payload)
    if (insertError) return setError(insertError.message)
    setItems(prev => [...prev, payload])
    setColorName('')
    setNotice('✓ Color agregado a la paleta.')
  }

  async function removeItem(item) {
    const label = item.color_hex ? `el color ${item.title || item.color_hex}` : `“${item.title || 'esta referencia'}”`
    if (!window.confirm(`¿Eliminar ${label}?`)) return
    setError(''); setNotice('')
    if (item.source_type === 'upload' && item.storage_path) {
      const { error: storageError } = await supabase.storage.from('event-inspiration').remove([item.storage_path])
      if (storageError) return setError(storageError.message)
    }
    const { error: deleteError } = await supabase
      .from('inspiration_items')
      .delete()
      .eq('id', item.id)
      .eq('event_id', event.id)
    if (deleteError) return setError(deleteError.message)
    setItems(prev => prev.filter(row => row.id !== item.id))
    setNotice('✓ Eliminado.')
  }

  async function handleUpload(file) {
    if (!file) return
    if (!file.type.startsWith('image/')) return setError('Elegí un archivo de imagen.')
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) return setError(`La imagen no puede superar ${MAX_UPLOAD_MB} MB.`)
    setUploading(true); setError(''); setNotice('')
    try {
      const extension = safeExtension(file.name, file.type)
      const id = crypto.randomUUID()
      const path = `${event.id}/${id}.${extension}`
      const { error: uploadError } = await supabase.storage
        .from('event-inspiration')
        .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type })
      if (uploadError) throw uploadError

      const title = cleanFileName(file.name)
      const item = {
        id, event_id: event.id, category: activeCategory === 'Todas' ? 'General' : activeCategory,
        title, source_type: 'upload', storage_path: path, source_url: null,
        note: null, color_hex: null, sort_order: references.length,
        decision_status: 'idea', execution_note: null, event_vendor_id: null, budget_category_id: null,
      }
      const { error: insertError } = await supabase.from('inspiration_items').insert(item)
      if (insertError) {
        await supabase.storage.from('event-inspiration').remove([path])
        throw insertError
      }
      const { data: signed } = await supabase.storage.from('event-inspiration').createSignedUrl(path, 60 * 60)
      setItems(prev => [item, ...prev])
      if (signed?.signedUrl) setSignedUrls(prev => ({ ...prev, [path]: signed.signedUrl }))
      setNotice('✓ Imagen agregada al moodboard.')
    } catch (err) {
      setError(err.message || 'No se pudo subir la imagen.')
    } finally {
      setUploading(false)
      if (uploadRef.current) uploadRef.current.value = ''
    }
  }

  function openNewReference() {
    setEditingReference(null)
    setReferenceModal(true)
  }

  function openEditReference(item) {
    setEditingReference(item)
    setReferenceModal(true)
  }

  function shareVisibleMoodboard() {
    if (!visibleReferences.length) return setNotice('No hay referencias para compartir en esta vista.')
    const baseLabel = boardMode === 'final' ? 'Diseño final' : 'Moodboard'
    const label = activeCategory === 'Todas' ? baseLabel : `${baseLabel} · ${activeCategory}`
    const lines = visibleReferences.slice(0, 12).map((item, index) => {
      const url = item.source_url || (item.storage_path ? signedUrls[item.storage_path] : '')
      const title = item.title || defaultReferenceTitle(item)
      return `${index + 1}. ${title}${url ? `\n${url}` : ''}`
    })
    const extra = visibleReferences.length > 12 ? `\n\n+ ${visibleReferences.length - 12} referencias más en la app.` : ''
    openWhatsApp(`${label} · ${event.name}\n\n${lines.join('\n\n')}${extra}`)
  }

  async function saveReference(payload) {
    setError(''); setNotice('')
    if (editingReference) {
      const patch = {
        title: payload.title || null,
        category: payload.category || 'General',
        source_url: payload.source_url,
        source_type: editingReference.source_type === 'upload' ? 'upload' : detectSourceType(payload.source_url),
        note: payload.note || null,
        decision_status: payload.decision_status || 'idea',
        execution_note: payload.execution_note || null,
        event_vendor_id: payload.event_vendor_id || null,
        budget_category_id: payload.budget_category_id || null,
      }
      const { error: updateError } = await supabase
        .from('inspiration_items')
        .update(patch)
        .eq('id', editingReference.id)
        .eq('event_id', event.id)
      if (updateError) throw updateError
      setItems(prev => prev.map(item => item.id === editingReference.id ? { ...item, ...patch } : item))
      setNotice('✓ Referencia actualizada.')
    } else {
      const item = {
        id: crypto.randomUUID(), event_id: event.id,
        title: payload.title || null,
        category: payload.category || 'General',
        source_type: detectSourceType(payload.source_url),
        source_url: payload.source_url,
        note: payload.note || null,
        storage_path: null, color_hex: null,
        sort_order: references.length,
        decision_status: payload.decision_status || 'idea',
        execution_note: payload.execution_note || null,
        event_vendor_id: payload.event_vendor_id || null,
        budget_category_id: payload.budget_category_id || null,
      }
      const { error: insertError } = await supabase.from('inspiration_items').insert(item)
      if (insertError) throw insertError
      setItems(prev => [item, ...prev])
      setNotice(item.source_type === 'pinterest' ? '✓ Pin guardado en el moodboard.' : '✓ Referencia guardada.')
    }
    setReferenceModal(false)
    setEditingReference(null)
  }

  async function updateDecisionStatus(item, decisionStatus) {
    const previous = item.decision_status || 'idea'
    setItems(rows => rows.map(row => row.id === item.id ? { ...row, decision_status: decisionStatus } : row))
    const { error: updateError } = await supabase.from('inspiration_items').update({ decision_status: decisionStatus }).eq('id', item.id).eq('event_id', event.id)
    if (updateError) {
      setItems(rows => rows.map(row => row.id === item.id ? { ...row, decision_status: previous } : row))
      setError(updateError.message)
    }
  }

  function printFinalMoodboard() {
    if (!finalReferences.length) return setNotice('Todavía no hay referencias elegidas o aprobadas para exportar.')
    setBoardMode('final')
    window.setTimeout(() => window.print(), 180)
  }

  if (loading) return <div className="panel loading-panel">Cargando diseño e inspiración…</div>

  return (
    <section className="design-page">
      <header className="design-header">
        <div>
          <span className="design-eyebrow">DISEÑO & INSPIRACIÓN</span>
          <h2>Dirección creativa del evento</h2>
          <p>Concepto, paleta y referencias visuales en un solo lugar. Pinterest se previsualiza dentro del moodboard.</p>
        </div>
        <div className="design-header-actions">
          <button className="secondary-btn" onClick={() => uploadRef.current?.click()} disabled={uploading}>{uploading ? 'Subiendo…' : '↑ Subir imagen'}</button>
          <input ref={uploadRef} hidden type="file" accept="image/*" onChange={event => handleUpload(event.target.files?.[0])} />
          <button className="primary-btn" onClick={openNewReference}>+ Agregar referencia</button>
        </div>
      </header>

      {error && <div className="design-alert error">{error}</div>}
      {notice && <div className="design-alert success">{notice}</div>}

      <div className="design-stats">
        <StatCard label="Referencias" value={stats.total} />
        <StatCard label="Diseño final" value={stats.final} />
        <StatCard label="Pinterest" value={stats.pinterest} />
        <StatCard label="Colores" value={stats.palette} />
      </div>

      <div className="design-two-column">
        <article className="design-card concept-card">
          <div className="design-card-heading">
            <div>
              <span className="design-section-kicker">CONCEPTO VISUAL</span>
              <h3>¿Cómo tiene que sentirse?</h3>
            </div>
            <span className="design-muted">Brief general</span>
          </div>
          <textarea
            className="concept-textarea"
            value={concept}
            onChange={e => setConcept(e.target.value)}
            placeholder="Ej.: romántico contemporáneo, cálido, luz de velas, flores orgánicas, blanco roto + vino, elegante sin sentirse rígido…"
          />
          <div className="concept-footer">
            <span>{concept.trim().length ? `${concept.trim().length} caracteres` : 'Definí el hilo conductor antes de elegir detalles.'}</span>
            <button className="secondary-btn" onClick={saveConcept} disabled={savingConcept}>{savingConcept ? 'Guardando…' : 'Guardar concepto'}</button>
          </div>
        </article>

        <article className="design-card palette-card">
          <div className="design-card-heading">
            <div>
              <span className="design-section-kicker">PALETA</span>
              <h3>Colores del evento</h3>
            </div>
            <span className="design-muted">{palette.length} guardados</span>
          </div>
          <div className="palette-strip">
            {palette.length ? palette.map(item => (
              <button key={item.id} className="palette-swatch" title="Eliminar color" onClick={() => removeItem(item)}>
                <span className="palette-color" style={{ background: item.color_hex }} />
                <span className="palette-name">{item.title || item.color_hex}</span>
                <span className="palette-hex">{item.color_hex}</span>
              </button>
            )) : <div className="palette-empty">Todavía no definiste colores.</div>}
          </div>
          <div className="palette-add">
            <input type="color" value={normalizeHex(colorHex) || '#8B5555'} onChange={e => setColorHex(e.target.value)} aria-label="Elegir color" />
            <input value={colorName} onChange={e => setColorName(e.target.value)} placeholder="Nombre · Vino" />
            <input className="hex-input" value={colorHex} onChange={e => setColorHex(e.target.value)} placeholder="#8B5555" />
            <button className="secondary-btn" onClick={addColor}>Agregar</button>
          </div>
        </article>
      </div>

      <article className="design-card moodboard-card">
        <div className="moodboard-topbar">
          <div>
            <span className="design-section-kicker">{boardMode === 'final' ? 'DISEÑO FINAL' : 'MOODBOARD'}</span>
            <h3>{boardMode === 'final' ? 'Decisiones elegidas y aprobadas' : 'Referencias visuales'}</h3>
            <p>{boardMode === 'final' ? 'La vista ejecutiva del evento: solo lo elegido y aprobado para llevar a proveedores y cliente.' : 'Guardá Pins, links e imágenes. La vista se organiza como un tablero visual, sin recortar las referencias.'}</p>
          </div>
          <div className="moodboard-top-actions">
            <div className="board-mode-toggle" aria-label="Vista del moodboard">
              <button className={boardMode === 'all' ? 'active' : ''} onClick={() => setBoardMode('all')}>Todo el moodboard</button>
              <button className={boardMode === 'final' ? 'active' : ''} onClick={() => setBoardMode('final')}>Diseño final <span>{finalReferences.length}</span></button>
            </div>
            <button className="secondary-btn whatsapp-share-btn" onClick={shareVisibleMoodboard} disabled={!visibleReferences.length}>WhatsApp</button>
            <button className="secondary-btn" onClick={printFinalMoodboard} disabled={!finalReferences.length}>PDF</button>
            <button className="primary-btn" onClick={openNewReference}>+ Referencia</button>
          </div>
        </div>

        <div className="category-filter" role="tablist" aria-label="Filtrar moodboard">
          <button className={activeCategory === 'Todas' ? 'active' : ''} onClick={() => setActiveCategory('Todas')}>Todas <span>{references.length}</span></button>
          {categoriesInUse.map(category => {
            const count = references.filter(item => (item.category || 'General') === category).length
            return <button key={category} className={activeCategory === category ? 'active' : ''} onClick={() => setActiveCategory(category)}>{CATEGORY_ICONS[category] || '·'} {category} <span>{count}</span></button>
          })}
        </div>

        {visibleReferences.length ? (
          <div className="moodboard-grid">
            {visibleReferences.map(item => (
              <ReferenceCard
                key={item.id}
                item={item}
                signedUrl={item.storage_path ? signedUrls[item.storage_path] : ''}
                eventName={event.name}
                eventVendors={eventVendors}
                budgetCategories={budgetCategories}
                onStatusChange={status => updateDecisionStatus(item, status)}
                onEdit={() => openEditReference(item)}
                onDelete={() => removeItem(item)}
              />
            ))}
          </div>
        ) : (
          <div className="moodboard-empty">
            <div className="moodboard-empty-icon">✦</div>
            <h4>{boardMode === 'final' ? 'Todavía no hay decisiones en Diseño final' : activeCategory === 'Todas' ? 'Tu moodboard empieza acá' : `Todavía no hay referencias en ${activeCategory}`}</h4>
            <p>{boardMode === 'final' ? 'Marcá una referencia como Elegida o Aprobada por cliente para verla acá.' : 'Pegá un Pin de Pinterest, un link o subí una imagen propia.'}</p>
            <div className="moodboard-empty-actions">
              <button className="primary-btn" onClick={openNewReference}>Pegar link</button>
              <button className="secondary-btn" onClick={() => uploadRef.current?.click()}>Subir imagen</button>
            </div>
          </div>
        )}
      </article>

      {referenceModal && (
        <ReferenceModal
          item={editingReference}
          initialCategory={activeCategory === 'Todas' ? 'General' : activeCategory}
          eventVendors={eventVendors}
          budgetCategories={budgetCategories}
          onClose={() => { setReferenceModal(false); setEditingReference(null) }}
          onSave={saveReference}
        />
      )}
    </section>
  )
}

function StatCard({ label, value }) {
  return <div className="design-stat"><strong>{value}</strong><span>{label}</span></div>
}

function ReferenceCard({ item, signedUrl, eventName, eventVendors, budgetCategories, onStatusChange, onEdit, onDelete }) {
  const isPinterest = item.source_type === 'pinterest'
  const shareUrl = item.source_url || signedUrl
  const linkedVendor = eventVendors.find(row => row.id === item.event_vendor_id)
  const linkedCategory = budgetCategories.find(row => row.id === item.budget_category_id)
  const decisionStatus = item.decision_status || 'idea'
  function shareReference() {
    const title = item.title || defaultReferenceTitle(item)
    const details = [
      `Inspiración · ${eventName}`,
      title,
      `Estado: ${statusLabel(decisionStatus)}`,
      item.note || '',
      item.execution_note ? `Ejecución: ${item.execution_note}` : '',
      linkedVendor ? `Proveedor: ${linkedVendor.vendors?.company_name || linkedVendor.service_category || 'Vinculado'}` : '',
      linkedCategory ? `Presupuesto: ${linkedCategory.name}` : '',
      shareUrl || '',
    ].filter(Boolean).join('\n')
    openWhatsApp(details)
  }
  return (
    <article className={`reference-card ${isPinterest ? 'is-pinterest' : ''}`}>
      <div className="reference-visual">
        {item.source_type === 'upload' ? (
          signedUrl ? <img src={signedUrl} alt={item.title || 'Inspiración'} /> : <div className="reference-loading">Cargando imagen…</div>
        ) : isPinterest ? (
          <PinterestEmbed url={item.source_url} compact />
        ) : (
          <GenericLinkPreview url={item.source_url} />
        )}
      </div>
      <div className="reference-body">
        <div className="reference-meta">
          <span className="reference-category">{CATEGORY_ICONS[item.category] || '·'} {item.category || 'General'}</span>
          <span className={`reference-source source-${item.source_type}`}>{sourceLabel(item.source_type)}</span>
        </div>
        <div className="reference-decision-row">
          <select className={`decision-select decision-${decisionStatus}`} value={decisionStatus} onChange={e => onStatusChange(e.target.value)} aria-label="Estado de decisión">
            {REFERENCE_STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <h4>{item.title || defaultReferenceTitle(item)}</h4>
        {item.note && <p>{item.note}</p>}
        {(item.execution_note || linkedVendor || linkedCategory) && (
          <div className="execution-summary">
            {item.execution_note && <div><strong>Ejecución</strong><span>{item.execution_note}</span></div>}
            <div className="reference-links">
              {linkedVendor && <span>Proveedor · {linkedVendor.vendors?.company_name || linkedVendor.service_category || 'Vinculado'}</span>}
              {linkedCategory && <span>Presupuesto · {linkedCategory.name}</span>}
            </div>
          </div>
        )}
        <div className="reference-actions">
          <div className="reference-share-actions">
            <button className="whatsapp-card-btn" onClick={shareReference} disabled={!shareUrl}>WhatsApp</button>
            {item.source_url && <a href={item.source_url} target="_blank" rel="noreferrer">Abrir ↗</a>}
          </div>
          <div>
            <button onClick={onEdit}>Editar</button>
            <button className="danger-link" onClick={onDelete}>Eliminar</button>
          </div>
        </div>
      </div>
    </article>
  )
}

function ReferenceModal({ item, initialCategory, eventVendors, budgetCategories, onClose, onSave }) {
  const [url, setUrl] = useState(item?.source_url || '')
  const [title, setTitle] = useState(item?.title || '')
  const [category, setCategory] = useState(item?.category || initialCategory || 'General')
  const [note, setNote] = useState(item?.note || '')
  const [decisionStatus, setDecisionStatus] = useState(item?.decision_status || 'idea')
  const [executionNote, setExecutionNote] = useState(item?.execution_note || '')
  const [eventVendorId, setEventVendorId] = useState(item?.event_vendor_id || '')
  const [budgetCategoryId, setBudgetCategoryId] = useState(item?.budget_category_id || '')
  const [saving, setSaving] = useState(false)
  const [resolvingShortUrl, setResolvingShortUrl] = useState(false)
  const [localError, setLocalError] = useState('')
  const sourceType = item?.source_type === 'upload' ? 'upload' : detectSourceType(url)
  const pinterestInfo = parsePinterestUrl(url)
  const isUploadItem = item?.source_type === 'upload'
  const validUrl = isUploadItem || isHttpUrl(url)

  async function submit(event) {
    event.preventDefault()
    if (!validUrl) return setLocalError('Pegá un link completo que empiece con http:// o https://.')
    setSaving(true); setLocalError('')
    try {
      let finalUrl = url.trim()
      if (parsePinterestUrl(finalUrl).shortened) {
        setResolvingShortUrl(true)
        const resolved = await resolvePinterestShortUrl(finalUrl)
        setResolvingShortUrl(false)
        if (resolved) {
          finalUrl = resolved
          setUrl(resolved)
        } else {
          throw new Error('No pudimos resolver este link corto de Pinterest. Abrilo una vez y copiá la URL completa de pinterest.com.')
        }
      }
      await onSave({
        source_url: isUploadItem ? item.source_url : finalUrl,
        title: title.trim(), category, note: note.trim(),
        decision_status: decisionStatus, execution_note: executionNote.trim(),
        event_vendor_id: eventVendorId || null, budget_category_id: budgetCategoryId || null,
      })
    } catch (err) {
      setResolvingShortUrl(false)
      setLocalError(err.message || 'No se pudo guardar la referencia.')
      setSaving(false)
    }
  }

  return (
    <div className="design-modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <form className="design-modal" onSubmit={submit}>
        <div className="design-modal-header">
          <div>
            <span className="design-section-kicker">{item ? 'EDITAR REFERENCIA' : 'NUEVA REFERENCIA'}</span>
            <h3>{sourceType === 'pinterest' ? 'Pinterest' : sourceType === 'upload' ? 'Imagen de inspiración' : 'Link de inspiración'}</h3>
          </div>
          <button type="button" className="modal-x" onClick={onClose}>×</button>
        </div>

        {!isUploadItem && <label className="design-field">
          <span>Link</span>
          <input autoFocus value={url} onChange={e => setUrl(e.target.value)} placeholder="https://www.pinterest.com/pin/..." />
          <small>{pinterestInfo.shortened ? 'Link corto detectado: lo convertimos automáticamente a la URL completa para mostrar la previsualización.' : 'Los Pins y tableros de Pinterest muestran su previsualización oficial.'}</small>
        </label>}

        {!isUploadItem && validUrl && (
          <div className="reference-modal-preview">
            {sourceType === 'pinterest' ? <PinterestEmbed url={url} /> : <GenericLinkPreview url={url} />}
          </div>
        )}

        <div className="design-form-row">
          <label className="design-field">
            <span>Título</span>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej.: Centros de mesa orgánicos" />
          </label>
          <label className="design-field">
            <span>Categoría</span>
            <select value={category} onChange={e => setCategory(e.target.value)}>
              {CATEGORIES.map(option => <option key={option}>{option}</option>)}
            </select>
          </label>
        </div>

        <label className="design-field">
          <span>Nota de inspiración</span>
          <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Qué rescatar de esta referencia, qué adaptar, qué evitar…" />
        </label>

        <div className="design-form-row three">
          <label className="design-field">
            <span>Estado de decisión</span>
            <select value={decisionStatus} onChange={e => setDecisionStatus(e.target.value)}>
              {REFERENCE_STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="design-field">
            <span>Proveedor vinculado</span>
            <select value={eventVendorId} onChange={e => setEventVendorId(e.target.value)}>
              <option value="">Sin vincular</option>
              {eventVendors.map(row => <option key={row.id} value={row.id}>{row.vendors?.company_name || row.service_category || 'Proveedor'}</option>)}
            </select>
          </label>
          <label className="design-field">
            <span>Categoría de presupuesto</span>
            <select value={budgetCategoryId} onChange={e => setBudgetCategoryId(e.target.value)}>
              <option value="">Sin vincular</option>
              {budgetCategories.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}
            </select>
          </label>
        </div>

        <label className="design-field execution-field">
          <span>Indicaciones de ejecución</span>
          <textarea value={executionNote} onChange={e => setExecutionNote(e.target.value)} placeholder="Ej.: menos follaje, rosas blancas, velas marfil, altura máxima 35 cm, evitar hortensias…" />
          <small>Esto es lo que la planner finalmente necesita comunicar al proveedor.</small>
        </label>

        {localError && <div className="design-alert error">{localError}</div>}

        <div className="design-modal-footer">
          <button type="button" className="secondary-btn" onClick={onClose}>Cancelar</button>
          <button className="primary-btn" disabled={saving || resolvingShortUrl}>{resolvingShortUrl ? 'Resolviendo Pinterest…' : saving ? 'Guardando…' : item ? 'Guardar cambios' : 'Guardar referencia'}</button>
        </div>
      </form>
    </div>
  )
}

function PinterestEmbed({ url, compact = false }) {
  const holderRef = useRef(null)
  const [resolvedUrl, setResolvedUrl] = useState(url)
  const [resolving, setResolving] = useState(false)
  const [resolveError, setResolveError] = useState('')
  const originalPinterest = parsePinterestUrl(url)

  useEffect(() => {
    setResolvedUrl(url)
    setResolveError('')
    if (!originalPinterest.shortened) {
      setResolving(false)
      return undefined
    }

    let cancelled = false
    const timer = window.setTimeout(async () => {
      setResolving(true)
      try {
        const resolved = await resolvePinterestShortUrl(url)
        if (cancelled) return
        if (resolved && parsePinterestUrl(resolved).previewable) {
          setResolvedUrl(resolved)
          setResolveError('')
        } else {
          setResolveError('No pudimos convertir automáticamente este link corto.')
        }
      } catch (err) {
        if (!cancelled) setResolveError(err.message || 'No pudimos convertir automáticamente este link corto.')
      } finally {
        if (!cancelled) setResolving(false)
      }
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [url, originalPinterest.shortened])

  const pinterest = parsePinterestUrl(resolvedUrl)

  useEffect(() => {
    if (!pinterest.previewable) return undefined
    let cancelled = false
    let timer
    ensurePinterestScript().then(() => {
      if (cancelled) return
      timer = window.setTimeout(() => {
        try { window.PinUtils?.build?.() } catch { /* fallback remains available */ }
      }, 100)
    })
    return () => { cancelled = true; if (timer) window.clearTimeout(timer) }
  }, [resolvedUrl, pinterest.previewable])

  if (resolving) {
    return (
      <div className="pinterest-fallback resolving">
        <span className="pinterest-mark">P</span>
        <strong>Preparando Pinterest…</strong>
        <p>Estamos convirtiendo el link corto para mostrar el Pin dentro del moodboard.</p>
        <span className="pinterest-resolving-dot">Resolviendo enlace…</span>
      </div>
    )
  }

  if (!pinterest.previewable) {
    return (
      <div className="pinterest-fallback">
        <span className="pinterest-mark">P</span>
        <strong>Pinterest</strong>
        <p>{originalPinterest.shortened ? (resolveError || 'No pudimos convertir este link corto automáticamente.') : 'Esta URL de Pinterest no corresponde a un Pin o tablero compatible con previsualización.'}</p>
        <a href={url} target="_blank" rel="noreferrer">Abrir en Pinterest ↗</a>
        {originalPinterest.shortened && <small>Abrilo y copiá la URL completa de pinterest.com si querés forzar la previsualización.</small>}
      </div>
    )
  }

  const mode = pinterest.kind === 'pin' ? 'embedPin' : 'embedBoard'
  return (
    <div ref={holderRef} className={`pinterest-embed ${compact ? 'compact' : ''}`} key={`${mode}:${resolvedUrl}`}>
      <a
        href={resolvedUrl}
        data-pin-do={mode}
        {...(mode === 'embedBoard' ? {
          'data-pin-board-width': compact ? '280' : '420',
          'data-pin-scale-height': compact ? '180' : '260',
          'data-pin-scale-width': compact ? '70' : '90',
        } : {})}
      >
        <span className="pinterest-loading">Cargando vista de Pinterest…</span>
      </a>
    </div>
  )
}

function GenericLinkPreview({ url }) {
  const domain = safeDomain(url)
  return (
    <a className="generic-link-preview" href={url} target="_blank" rel="noreferrer">
      <span className="generic-link-icon">↗</span>
      <span><strong>{domain || 'Referencia web'}</strong><small>{shortUrl(url)}</small></span>
    </a>
  )
}

async function loadSignedUrls(items, setSignedUrls) {
  const uploadItems = items.filter(item => item.source_type === 'upload' && item.storage_path)
  if (!uploadItems.length) { setSignedUrls({}); return }
  const pairs = await Promise.all(uploadItems.map(async item => {
    const { data } = await supabase.storage.from('event-inspiration').createSignedUrl(item.storage_path, 60 * 60)
    return [item.storage_path, data?.signedUrl || '']
  }))
  setSignedUrls(Object.fromEntries(pairs))
}

let pinterestScriptPromise
function ensurePinterestScript() {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.PinUtils) return Promise.resolve()
  if (pinterestScriptPromise) return pinterestScriptPromise
  pinterestScriptPromise = new Promise(resolve => {
    const existing = document.querySelector('script[data-planner-pinterest="true"]')
    if (existing) {
      if (window.PinUtils) resolve()
      else existing.addEventListener('load', () => resolve(), { once: true })
      return
    }
    const script = document.createElement('script')
    script.async = true
    script.defer = true
    script.src = 'https://assets.pinterest.com/js/pinit.js'
    script.dataset.plannerPinterest = 'true'
    script.onload = () => resolve()
    script.onerror = () => resolve()
    document.body.appendChild(script)
  })
  return pinterestScriptPromise
}

async function resolvePinterestShortUrl(value) {
  const raw = String(value || '').trim()
  const info = parsePinterestUrl(raw)
  if (!info.shortened) return raw

  const { data, error } = await supabase.functions.invoke('pinterest-resolve', {
    body: { url: raw },
  })
  if (error) throw new Error(error.message || 'No se pudo resolver el link corto de Pinterest.')
  const resolved = String(data?.url || '').trim()
  if (!resolved || !parsePinterestUrl(resolved).previewable) return ''
  return resolved
}

function openWhatsApp(message) {
  if (typeof window === 'undefined') return
  const text = String(message || '').trim()
  if (!text) return
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
}

function detectSourceType(value) {
  return parsePinterestUrl(value).isPinterest ? 'pinterest' : 'link'
}

function parsePinterestUrl(value) {
  try {
    const url = new URL(String(value || '').trim())
    const host = url.hostname.toLowerCase().replace(/^www\./, '')
    const shortened = host === 'pin.it'
    const isPinterest = shortened || host === 'pinterest.com' || host.endsWith('.pinterest.com')
    if (!isPinterest) return { isPinterest: false, previewable: false, kind: 'link', shortened: false }
    if (shortened) return { isPinterest: true, previewable: false, kind: 'pin', shortened: true }
    const segments = url.pathname.split('/').filter(Boolean)
    const pinIndex = segments.findIndex(segment => segment.toLowerCase() === 'pin')
    if (pinIndex >= 0 && segments[pinIndex + 1]) return { isPinterest: true, previewable: true, kind: 'pin', shortened: false }
    if (segments.length >= 2) return { isPinterest: true, previewable: true, kind: 'board', shortened: false }
    return { isPinterest: true, previewable: false, kind: 'profile', shortened: false }
  } catch {
    return { isPinterest: false, previewable: false, kind: 'link', shortened: false }
  }
}

function isHttpUrl(value) {
  try {
    const url = new URL(String(value || '').trim())
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch { return false }
}

function normalizeHex(value) {
  const raw = String(value || '').trim()
  const match = raw.match(/^#?([0-9a-f]{6})$/i)
  return match ? `#${match[1].toUpperCase()}` : ''
}

function safeDomain(value) {
  try { return new URL(value).hostname.replace(/^www\./, '') } catch { return '' }
}

function shortUrl(value) {
  if (!value) return ''
  try {
    const url = new URL(value)
    return `${url.hostname.replace(/^www\./, '')}${url.pathname}`.slice(0, 72)
  } catch { return String(value).slice(0, 72) }
}

function statusLabel(value) {
  return REFERENCE_STATUSES.find(([key]) => key === value)?.[1] || 'Idea'
}

function sourceLabel(type) {
  if (type === 'pinterest') return 'Pinterest'
  if (type === 'upload') return 'Imagen propia'
  return 'Link'
}

function defaultReferenceTitle(item) {
  if (item.source_type === 'pinterest') return 'Referencia de Pinterest'
  if (item.source_type === 'upload') return 'Imagen de inspiración'
  return safeDomain(item.source_url) || 'Referencia visual'
}

function cleanFileName(name) {
  return String(name || 'Imagen').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Imagen'
}

function safeExtension(name, mime) {
  const fromName = String(name || '').split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (fromName && fromName.length <= 5) return fromName
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  if (mime === 'image/gif') return 'gif'
  return 'jpg'
}
