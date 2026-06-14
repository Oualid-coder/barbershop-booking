// Supabase Edge Function — create-barber
// Réservé aux propriétaires (role = 'owner').
// Crée un compte Auth puis insère un barbier en base.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function respond(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }
  if (req.method !== 'POST') {
    return respond({ error: 'Method Not Allowed' }, 405)
  }

  const SUPABASE_URL              = Deno.env.get('SUPABASE_URL')
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return respond({ error: 'Supabase env vars not configured' }, 500)
  }

  // ── Verify caller JWT ────────────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return respond({ error: 'Unauthorized' }, 401)
  }
  const jwt = authHeader.slice(7)

  let callerId: string
  try {
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        apikey: SUPABASE_SERVICE_ROLE_KEY,
      },
    })
    if (!userRes.ok) return respond({ error: 'Unauthorized' }, 401)
    const user = await userRes.json()
    callerId = user.id
    if (!callerId) return respond({ error: 'Unauthorized' }, 401)
  } catch {
    return respond({ error: 'Unauthorized' }, 401)
  }

  // ── Check caller is owner ────────────────────────────────────────────────────
  try {
    const barberRes = await fetch(
      `${SUPABASE_URL}/rest/v1/barbers?user_id=eq.${callerId}&select=role&limit=1`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      },
    )
    const rows = await barberRes.json()
    if (!rows[0] || rows[0].role !== 'owner') {
      return respond({ error: 'Forbidden: owner only' }, 403)
    }
  } catch {
    return respond({ error: 'Network error' }, 502)
  }

  // ── Parse body ───────────────────────────────────────────────────────────────
  // deno-lint-ignore no-explicit-any
  let body: Record<string, any>
  try {
    body = await req.json()
  } catch {
    return respond({ error: 'Invalid JSON body' }, 400)
  }

  const { name, email, password } = body
  if (!name || !email || !password) {
    return respond({ error: 'Missing required fields: name, email, password' }, 400)
  }
  if (!EMAIL_RE.test(String(email))) {
    return respond({ error: 'Invalid email format' }, 400)
  }
  if (String(password).length < 6) {
    return respond({ error: 'Password must be at least 6 characters' }, 400)
  }

  // ── Create Auth user ─────────────────────────────────────────────────────────
  let newUserId: string
  try {
    const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: String(email).trim().toLowerCase(),
        password: String(password),
        email_confirm: true,
      }),
    })
    const created = await createRes.json()
    if (!createRes.ok) {
      return respond({ error: created.message || 'Failed to create Auth user' }, 400)
    }
    newUserId = created.id
  } catch {
    return respond({ error: 'Network error creating Auth user' }, 502)
  }

  // ── Insert barber record ─────────────────────────────────────────────────────
  try {
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/barbers`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        name: String(name).trim(),
        email: String(email).trim().toLowerCase(),
        user_id: newUserId,
        active: true,
        role: 'barber',
      }),
    })
    const inserted = await insertRes.json()
    if (!insertRes.ok) {
      // Cleanup: delete the Auth user to avoid orphaned accounts
      await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${newUserId}`, {
        method: 'DELETE',
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }).catch(() => {})
      console.error('[create-barber] barber insert failed:', JSON.stringify(inserted))
      return respond({ error: 'Failed to create barber record' }, 500)
    }
    console.log('[create-barber] Created barber:', inserted[0]?.id, '— name:', name)
    return respond({ ok: true, barber: inserted[0] })
  } catch {
    return respond({ error: 'Network error inserting barber' }, 502)
  }
})
