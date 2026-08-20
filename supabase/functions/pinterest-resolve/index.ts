const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function normalizedHost(url: URL) {
  return url.hostname.toLowerCase().replace(/^www\./, '')
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const body = await request.json().catch(() => ({}))
    const raw = String(body?.url || '').trim()
    if (!raw) return json({ error: 'Falta la URL.' }, 400)

    const input = new URL(raw)
    const host = normalizedHost(input)
    if (host !== 'pin.it' && host !== 'pinterest.com' && !host.endsWith('.pinterest.com')) {
      return json({ error: 'Solo se admiten URLs de Pinterest.' }, 400)
    }

    if (host !== 'pin.it') return json({ url: input.toString() })

    const response = await fetch(input.toString(), {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PlannerEventos/1.0; +https://supabase.com)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-419,es;q=0.9,en;q=0.8',
      },
    })

    const finalUrl = new URL(response.url || input.toString())
    const finalHost = normalizedHost(finalUrl)
    if (finalHost !== 'pinterest.com' && !finalHost.endsWith('.pinterest.com')) {
      return json({ error: 'Pinterest no devolvió una URL válida.' }, 422)
    }

    return json({ url: finalUrl.toString() })
  } catch (error) {
    console.error('pinterest-resolve', error)
    return json({ error: error instanceof Error ? error.message : 'No se pudo resolver el link.' }, 500)
  }
})
