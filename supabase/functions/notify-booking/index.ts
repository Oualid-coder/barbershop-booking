// Supabase Edge Function — notify-booking
// Runtime : Deno — appel direct à l'API REST Resend via fetch natif

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

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

function formatDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function buildHtml(
  clientName: string,
  clientPhone: string,
  serviceName: string,
  formattedDate: string,
  time: string,
): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#09090b;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;padding:32px 16px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0"
             style="background:#18181b;border:1px solid #27272a;border-radius:16px;overflow:hidden;max-width:100%;">
        <tr><td style="background:#09090b;padding:20px 28px;border-bottom:1px solid #27272a;">
          <div style="width:20px;height:2px;background:#fbbf24;margin-bottom:10px;"></div>
          <p style="margin:0;color:#fff;font-size:12px;font-weight:600;letter-spacing:3px;text-transform:uppercase;">
            VIP Cut's
          </p>
        </td></tr>
        <tr><td style="padding:28px;">
          <h1 style="margin:0 0 6px;color:#fbbf24;font-size:22px;font-weight:700;">Nouvelle réservation</h1>
          <p style="margin:0 0 28px;color:#52525b;font-size:13px;">Réservation enregistrée automatiquement</p>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:12px 0;border-bottom:1px solid #27272a;color:#71717a;font-size:12px;width:120px;">Client</td>
              <td style="padding:12px 0;border-bottom:1px solid #27272a;color:#fff;font-size:14px;font-weight:600;">${clientName}</td>
            </tr>
            <tr>
              <td style="padding:12px 0;border-bottom:1px solid #27272a;color:#71717a;font-size:12px;">Téléphone</td>
              <td style="padding:12px 0;border-bottom:1px solid #27272a;">
                <a href="tel:${clientPhone}" style="color:#fbbf24;text-decoration:none;font-size:14px;font-weight:600;">${clientPhone}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 0;border-bottom:1px solid #27272a;color:#71717a;font-size:12px;">Service</td>
              <td style="padding:12px 0;border-bottom:1px solid #27272a;color:#fff;font-size:14px;">${serviceName}</td>
            </tr>
            <tr>
              <td style="padding:12px 0;border-bottom:1px solid #27272a;color:#71717a;font-size:12px;">Date</td>
              <td style="padding:12px 0;border-bottom:1px solid #27272a;color:#fff;font-size:14px;text-transform:capitalize;">${formattedDate}</td>
            </tr>
            <tr>
              <td style="padding:12px 0;color:#71717a;font-size:12px;">Heure</td>
              <td style="padding:12px 0;">
                <span style="color:#fbbf24;font-size:24px;font-weight:700;font-family:ui-monospace,monospace;">${time}</span>
              </td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="padding:14px 28px;border-top:1px solid #27272a;background:#09090b;">
          <p style="margin:0;color:#3f3f46;font-size:11px;text-align:center;">VIP Cut's · Coiffeur Barbier Paris 18e</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

Deno.serve(async (req: Request): Promise<Response> => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return respond({ error: 'Method Not Allowed' }, 405)
  }

  // ── Env vars ────────────────────────────────────────────────────────────────
  const RESEND_API_KEY            = Deno.env.get('RESEND_API_KEY')
  const FROM_EMAIL                = Deno.env.get('RESEND_FROM_EMAIL') ?? 'onboarding@resend.dev'
  const SUPABASE_URL              = Deno.env.get('SUPABASE_URL')
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const ONESIGNAL_APP_ID          = Deno.env.get('ONESIGNAL_APP_ID') ?? 'b578b9f9-247f-4c6a-8bd2-a5af632d4b60'
  const ONESIGNAL_API_KEY         = Deno.env.get('ONESIGNAL_API_KEY')

  if (!RESEND_API_KEY) {
    console.error('[notify-booking] RESEND_API_KEY is not set in secrets')
    return respond({ error: 'RESEND_API_KEY not configured' }, 500)
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[notify-booking] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set')
    return respond({ error: 'Supabase env vars not configured' }, 500)
  }

  // ── Parse body ──────────────────────────────────────────────────────────────
  // deno-lint-ignore no-explicit-any
  let payload: Record<string, any>
  try {
    payload = await req.json()
  } catch (_e) {
    return respond({ error: 'Invalid JSON body' }, 400)
  }

  const { client_name, client_phone, service_name, booking_date, booking_time, barber_id } = payload

  if (!client_name || !client_phone || !service_name || !booking_date || !booking_time || !barber_id) {
    return respond({ error: 'Missing required fields' }, 400)
  }

  if (!UUID_RE.test(String(barber_id))) {
    return respond({ error: 'Invalid barber_id format' }, 400)
  }

  // ── Fetch barber email via REST API (bypasses RLS) ──────────────────────────
  let barberRes: Response
  try {
    barberRes = await fetch(
      `${SUPABASE_URL}/rest/v1/barbers?id=eq.${barber_id}&select=email&limit=1`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    )
  } catch (networkErr) {
    console.error('[notify-booking] Cannot reach Supabase REST API:', networkErr)
    return respond({ error: 'Network error reaching Supabase' }, 502)
  }

  // deno-lint-ignore no-explicit-any
  let barberRows: Record<string, any>[] = []
  try {
    barberRows = await barberRes.json()
  } catch (_e) {
    // corps non-JSON (rare)
  }

  if (!barberRes.ok || !barberRows[0]?.email) {
    console.error('[notify-booking] Barber not found:', barber_id, JSON.stringify(barberRows))
    return respond({ error: 'Barber not found' }, 404)
  }

  const BARBER_EMAIL: string = barberRows[0].email

  // ── Rate limiting : max 20 emails par barbier par heure ─────────────────────
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  let countRes: Response
  try {
    countRes = await fetch(
      `${SUPABASE_URL}/rest/v1/email_logs?barber_id=eq.${barber_id}&created_at=gte.${oneHourAgo}&select=id`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          Prefer: 'count=exact',
        },
      }
    )
  } catch (networkErr) {
    console.error('[notify-booking] Cannot reach email_logs:', networkErr)
    return respond({ error: 'Network error reaching Supabase' }, 502)
  }

  const countHeader = countRes.headers.get('content-range') ?? ''
  const emailCount  = parseInt(countHeader.split('/')[1] ?? '0', 10)

  if (emailCount >= 20) {
    console.warn('[notify-booking] Rate limit reached for barber', barber_id, '— count:', emailCount)
    return respond({ error: 'Too many notifications. Try again later.' }, 429)
  }

  // ── Build email ─────────────────────────────────────────────────────────────
  const formattedDate = formatDate(String(booking_date))
  const time          = String(booking_time).slice(0, 5)
  const subject       = `Nouvelle réservation — ${service_name} le ${formattedDate} à ${time}`
  const html          = buildHtml(
    escapeHtml(String(client_name)),
    escapeHtml(String(client_phone)),
    escapeHtml(String(service_name)),
    escapeHtml(formattedDate),
    escapeHtml(time),
  )

  // ── Call Resend REST API ─────────────────────────────────────────────────────
  let resendResponse: Response
  try {
    resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [BARBER_EMAIL],
        subject,
        html,
      }),
    })
  } catch (networkErr) {
    console.error('[notify-booking] Cannot reach Resend API:', networkErr)
    return respond({ error: 'Network error reaching Resend API' }, 502)
  }

  // deno-lint-ignore no-explicit-any
  let resendBody: Record<string, any> = {}
  try {
    resendBody = await resendResponse.json()
  } catch (_e) {
    // corps non-JSON (rare) — on continue avec {}
  }

  if (!resendResponse.ok) {
    console.error(
      `[notify-booking] Resend rejected — HTTP ${resendResponse.status}:`,
      JSON.stringify(resendBody),
    )
    return respond({
      error: 'Resend API rejected the request',
      resend_status: resendResponse.status,
      resend_error: resendBody,
    }, 502)
  }

  console.log('[notify-booking] Email sent to', BARBER_EMAIL, '— id:', resendBody.id ?? 'unknown')

  // ── Log email pour rate limiting (fire-and-forget) ───────────────────────────
  fetch(`${SUPABASE_URL}/rest/v1/email_logs`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ barber_id }),
  }).catch(err => console.error('[notify-booking] email_logs insert failed:', err))

  // ── OneSignal push (fire-and-forget) ─────────────────────────────────────────
  if (ONESIGNAL_API_KEY) {
    fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Key ${ONESIGNAL_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        included_segments: ['All'],
        headings: { fr: 'Nouvelle réservation', en: 'New booking' },
        contents: {
          fr: `${escapeHtml(String(client_name))} — ${escapeHtml(String(service_name))} à ${time}`,
          en: `${escapeHtml(String(client_name))} — ${escapeHtml(String(service_name))} at ${time}`,
        },
      }),
    }).catch(err => console.error('[notify-booking] OneSignal push failed:', err))
  } else {
    console.warn('[notify-booking] ONESIGNAL_API_KEY not set — push skipped')
  }

  return respond({ ok: true, email_id: resendBody.id ?? null })
})
