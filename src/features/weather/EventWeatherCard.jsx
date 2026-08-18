import { useEffect, useMemo, useState } from 'react'
import { getEventWeather, weatherPresentation } from '../../lib/weather.js'

export default function EventWeatherCard({ event }) {
  const [state, setState] = useState({ loading: true, data: null, error: '' })

  useEffect(() => {
    let active = true
    if (!event?.event_date || !event?.city) {
      setState({ loading: false, data: { kind: 'missing' }, error: '' })
      return () => { active = false }
    }

    setState({ loading: true, data: null, error: '' })
    getEventWeather({ city: event.city, country: event.country, eventDate: event.event_date })
      .then(data => { if (active) setState({ loading: false, data, error: '' }) })
      .catch(error => { if (active) setState({ loading: false, data: null, error: error.message || 'No se pudo consultar el clima.' }) })
    return () => { active = false }
  }, [event?.city, event?.country, event?.event_date])

  const content = useMemo(() => buildContent(state.data), [state.data])

  if (state.loading) {
    return <article className="panel weather-card span-2"><p className="eyebrow">CLIMA DEL EVENTO</p><p className="weather-loading">Consultando clima para {event.city}…</p></article>
  }

  if (state.error) {
    return <article className="panel weather-card span-2"><p className="eyebrow">CLIMA DEL EVENTO</p><div className="weather-empty"><strong>No pude actualizar el clima</strong><span>{state.error}</span></div></article>
  }

  if (state.data?.kind === 'missing') {
    return <article className="panel weather-card span-2"><p className="eyebrow">CLIMA DEL EVENTO</p><div className="weather-empty"><strong>Completá fecha y ciudad</strong><span>Con esos datos podremos mostrar pronóstico o tendencia histórica.</span></div></article>
  }

  return (
    <article className={`panel weather-card span-2 ${content.risk ? 'weather-risk' : ''}`}>
      <div className="weather-head">
        <div>
          <p className="eyebrow">{content.eyebrow}</p>
          <h2>{content.title}</h2>
          <p>{content.subtitle}</p>
        </div>
        <div className="weather-icon" aria-hidden="true">{content.icon}</div>
      </div>
      <div className="weather-metrics">
        {content.metrics.map(metric => <div key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.detail || ''}</small></div>)}
      </div>
      {content.notice && <div className={`weather-notice ${content.risk ? 'risk' : ''}`}><strong>{content.risk ? 'Revisar plan B' : 'Referencia para planificación'}</strong><span>{content.notice}</span></div>}
    </article>
  )
}

function buildContent(data) {
  if (!data) return { metrics: [] }
  const location = [data.location?.name, data.location?.admin1, data.location?.country].filter(Boolean).join(', ')

  if (data.kind === 'forecast') {
    const weather = weatherPresentation(data.weatherCode)
    const rain = Number(data.rainProbability || 0)
    const risk = rain >= 50 || Number(data.precipitation || 0) >= 5 || [95, 96, 99].includes(Number(data.weatherCode))
    return {
      eyebrow: data.daysUntil === 0 ? 'CLIMA · HOY' : `PRONÓSTICO · FALTAN ${data.daysUntil} DÍAS`,
      title: `${weather.label} en ${data.location?.name || 'el evento'}`,
      subtitle: `${formatDate(data.date)} · ${location}`,
      icon: weather.icon,
      risk,
      metrics: [
        { label: 'Temperatura', value: temperatureRange(data.tempMin, data.tempMax), detail: 'mín. / máx.' },
        { label: 'Prob. de lluvia', value: percent(rain), detail: `${number(data.precipitation, 1)} mm estimados` },
        { label: 'Viento', value: `${number(data.windMax, 0)} km/h`, detail: 'máximo diario' },
      ],
      notice: risk
        ? 'Hay señales de lluvia, viento o tormenta. Conviene confirmar alternativa cubierta, montaje y logística con proveedores.'
        : 'El pronóstico está dentro de la ventana operativa. Volvé a revisarlo a medida que se acerque la fecha.',
    }
  }

  if (data.kind === 'past') {
    const weather = weatherPresentation(data.weatherCode)
    return {
      eyebrow: 'CLIMA HISTÓRICO · EVENTO PASADO',
      title: `${weather.label} en ${data.location?.name || 'el evento'}`,
      subtitle: `${formatDate(data.date)} · ${location}`,
      icon: weather.icon,
      risk: false,
      metrics: [
        { label: 'Temperatura', value: temperatureRange(data.tempMin, data.tempMax), detail: 'mín. / máx.' },
        { label: 'Precipitación', value: `${number(data.precipitation, 1)} mm`, detail: 'registro histórico' },
        { label: 'Viento', value: `${number(data.windMax, 0)} km/h`, detail: 'máximo diario' },
      ],
      notice: 'Estos son datos históricos del día del evento, no un pronóstico.',
    }
  }

  const rain = Number(data.rainProbability || 0)
  return {
    eyebrow: 'TENDENCIA HISTÓRICA · TODAVÍA NO ES PRONÓSTICO',
    title: `Cómo suele estar el clima en esa fecha`,
    subtitle: `${location} · muestra de ${data.sampleYears || 0} años`,
    icon: rain >= 50 ? '🌦️' : '🌤️',
    risk: false,
    metrics: [
      { label: 'Días con lluvia', value: percent(rain), detail: 'frecuencia histórica' },
      { label: 'Temperatura habitual', value: temperatureRange(data.avgTempMin, data.avgTempMax), detail: 'promedio histórico' },
      { label: 'Lluvia promedio', value: `${number(data.avgPrecipitation, 1)} mm`, detail: 'en esa fecha' },
    ],
    notice: data.daysUntil <= 16
      ? 'El pronóstico real debería estar disponible; si no apareció, volvé a intentar más tarde.'
      : `Faltan ${data.daysUntil} días. Cuando el evento entre en los próximos 16 días, esta tarjeta cambiará automáticamente a pronóstico real.`,
  }
}

function formatDate(value) {
  if (!value) return 'Fecha por definir'
  return new Intl.DateTimeFormat('es-PY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`))
}
function number(value, digits = 0) { return new Intl.NumberFormat('es-PY', { maximumFractionDigits: digits }).format(Number(value) || 0) }
function percent(value) { return `${Math.round(Number(value) || 0)}%` }
function temperatureRange(min, max) { return `${number(min, 0)}° / ${number(max, 0)}°` }
