const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search'
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'
const ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive'
const CACHE_TTL = 6 * 60 * 60 * 1000

export async function getEventWeather({ city, country, eventDate }) {
  if (!city || !eventDate) return { kind: 'missing' }

  const location = await geocodeLocation(city, country)
  if (!location) throw new Error(`No encontré ${city}${country ? `, ${country}` : ''} para consultar el clima.`)

  const today = localDateString(new Date())
  const days = dateDiff(today, eventDate)

  if (days >= 0 && days <= 16) {
    const forecast = await getForecast(location, eventDate)
    if (forecast) return { kind: 'forecast', daysUntil: days, location, ...forecast }
  }

  if (days < 0) {
    const actual = await getHistoricalDay(location, eventDate)
    if (actual) return { kind: 'past', daysUntil: days, location, ...actual }
  }

  const trend = await getHistoricalTrend(location, eventDate)
  return { kind: 'trend', daysUntil: days, location, ...trend }
}

async function geocodeLocation(city, country) {
  const cacheKey = `planner-weather-geocode:${normalize(`${city}|${country || ''}`)}`
  const cached = readCache(cacheKey)
  if (cached) return cached

  const query = [city, country].filter(Boolean).join(', ')
  const response = await fetch(`${GEOCODING_URL}?name=${encodeURIComponent(query)}&count=1&language=es&format=json`)
  if (!response.ok) throw new Error('No se pudo consultar la ubicación del evento.')
  const data = await response.json()
  let result = data?.results?.[0]

  // Si el país escrito no coincide exactamente con el catálogo de geocoding,
  // reintentamos solo con la ciudad para no bloquear la tarjeta.
  if (!result && country) {
    const fallback = await fetch(`${GEOCODING_URL}?name=${encodeURIComponent(city)}&count=1&language=es&format=json`)
    if (fallback.ok) result = (await fallback.json())?.results?.[0]
  }
  if (!result) return null

  const location = {
    latitude: result.latitude,
    longitude: result.longitude,
    timezone: result.timezone || 'auto',
    name: result.name || city,
    admin1: result.admin1 || '',
    country: result.country || country || '',
  }
  writeCache(cacheKey, location, 30 * 24 * 60 * 60 * 1000)
  return location
}

async function getForecast(location, eventDate) {
  const cacheKey = `planner-weather-forecast:${location.latitude}:${location.longitude}:${eventDate}`
  const cached = readCache(cacheKey)
  if (cached) return cached

  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max',
    timezone: 'auto',
    forecast_days: '16',
  })
  const response = await fetch(`${FORECAST_URL}?${params}`)
  if (!response.ok) throw new Error('No se pudo consultar el pronóstico del evento.')
  const data = await response.json()
  const index = data?.daily?.time?.indexOf(eventDate) ?? -1
  if (index < 0) return null

  const result = {
    date: eventDate,
    weatherCode: valueAt(data.daily.weather_code, index),
    tempMax: valueAt(data.daily.temperature_2m_max, index),
    tempMin: valueAt(data.daily.temperature_2m_min, index),
    rainProbability: valueAt(data.daily.precipitation_probability_max, index),
    precipitation: valueAt(data.daily.precipitation_sum, index),
    windMax: valueAt(data.daily.wind_speed_10m_max, index),
  }
  writeCache(cacheKey, result)
  return result
}

async function getHistoricalDay(location, eventDate) {
  const data = await requestArchiveDay(location, eventDate)
  if (!data) return null
  return { date: eventDate, ...data }
}

async function getHistoricalTrend(location, eventDate) {
  const monthDay = eventDate.slice(5)
  const cacheKey = `planner-weather-trend:${location.latitude}:${location.longitude}:${monthDay}`
  const cached = readCache(cacheKey)
  if (cached) return cached

  const nowYear = new Date().getFullYear()
  const eventYear = Number(eventDate.slice(0, 4))
  const lastHistoricalYear = Math.min(nowYear - 1, eventYear - 1)
  const years = []
  for (let year = lastHistoricalYear; year >= lastHistoricalYear - 6; year -= 1) {
    const date = `${year}-${monthDay}`
    if (isValidIsoDate(date)) years.push(date)
  }

  const rows = (await Promise.all(years.map(date => requestArchiveDay(location, date).catch(() => null)))).filter(Boolean)
  if (!rows.length) throw new Error('No pude construir una tendencia histórica para esta fecha.')

  const rainy = rows.filter(row => Number(row.precipitation || 0) >= 1).length
  const result = {
    sampleYears: rows.length,
    rainProbability: Math.round((rainy / rows.length) * 100),
    avgTempMax: average(rows.map(row => row.tempMax)),
    avgTempMin: average(rows.map(row => row.tempMin)),
    avgPrecipitation: average(rows.map(row => row.precipitation)),
  }
  writeCache(cacheKey, result, 7 * 24 * 60 * 60 * 1000)
  return result
}

async function requestArchiveDay(location, date) {
  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    start_date: date,
    end_date: date,
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max',
    timezone: 'auto',
  })
  const response = await fetch(`${ARCHIVE_URL}?${params}`)
  if (!response.ok) throw new Error('No se pudo consultar el histórico meteorológico.')
  const data = await response.json()
  if (!data?.daily?.time?.length) return null
  return {
    weatherCode: valueAt(data.daily.weather_code, 0),
    tempMax: valueAt(data.daily.temperature_2m_max, 0),
    tempMin: valueAt(data.daily.temperature_2m_min, 0),
    precipitation: valueAt(data.daily.precipitation_sum, 0),
    windMax: valueAt(data.daily.wind_speed_10m_max, 0),
  }
}

export function weatherPresentation(code) {
  const value = Number(code)
  if ([0].includes(value)) return { icon: '☀️', label: 'Despejado' }
  if ([1, 2].includes(value)) return { icon: '🌤️', label: 'Parcialmente nublado' }
  if ([3].includes(value)) return { icon: '☁️', label: 'Nublado' }
  if ([45, 48].includes(value)) return { icon: '🌫️', label: 'Niebla' }
  if ([51, 53, 55, 56, 57].includes(value)) return { icon: '🌦️', label: 'Llovizna' }
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(value)) return { icon: '🌧️', label: 'Lluvia' }
  if ([71, 73, 75, 77, 85, 86].includes(value)) return { icon: '🌨️', label: 'Nieve' }
  if ([95, 96, 99].includes(value)) return { icon: '⛈️', label: 'Tormentas' }
  return { icon: '🌤️', label: 'Condiciones variables' }
}

function valueAt(list, index) {
  const value = list?.[index]
  return value === null || value === undefined ? null : Number(value)
}

function average(values) {
  const clean = values.map(Number).filter(Number.isFinite)
  if (!clean.length) return null
  return Math.round((clean.reduce((a, b) => a + b, 0) / clean.length) * 10) / 10
}

function dateDiff(from, to) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000)
}

function localDateString(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function isValidIsoDate(value) {
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function normalize(value) {
  return String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-')
}

function readCache(key) {
  try {
    const stored = JSON.parse(localStorage.getItem(key) || 'null')
    if (!stored || Date.now() > stored.expiresAt) return null
    return stored.value
  } catch {
    return null
  }
}

function writeCache(key, value, ttl = CACHE_TTL) {
  try {
    localStorage.setItem(key, JSON.stringify({ value, expiresAt: Date.now() + ttl }))
  } catch {
    // El clima no debe bloquear la app si el navegador no permite storage.
  }
}
