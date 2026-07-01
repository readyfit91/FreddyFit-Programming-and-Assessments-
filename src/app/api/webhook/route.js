import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const resend = new Resend(process.env.RESEND_API_KEY)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function commitmentToStatus(commitment = '') {
  const c = commitment.toLowerCase()
  if (c.includes('serious') || c.includes('ready to start') || c.includes('sign up')) return 'Follow Up'
  if (c.includes('interested') || c.includes('contact me') || c.includes('questions')) return 'New Lead'
  if (c.includes('not right now') || c.includes("isn't a priority") || c.includes('not a priority')) return 'Cold'
  return 'New Lead'
}

function row(label, value) {
  if (!value) return ''
  return `
      <tr>
        <td style="padding:12px 16px;background:#F8FAFC;border-bottom:1px solid #E2E8F0;font-size:12px;font-weight:600;color:#64748B;text-transform:uppercase;letter-spacing:0.05em;width:180px;vertical-align:top">${label}</td>
        <td style="padding:12px 16px;border-bottom:1px solid #E2E8F0;font-size:14px;color:#1E293B;vertical-align:top;line-height:1.5">${value}</td>
      </tr>`
}

function buildEmail(name, body, status, source) {
  const isAssessment   = body._form === 'assessment'
  const isConsultation = body._form === 'consultation'
  const formLabel      = isConsultation ? 'Consultation Request' : 'Performance Assessment'

  const statusColor = status === 'Follow Up' ? '#16A34A' : status === 'Cold' ? '#94A3B8' : '#2BAADF'

  const assessmentRows = isAssessment ? `
      ${row('Primary Goal', body.goal)}
      ${row('Current Barriers', body.barrier)}
      ${row('Training Days / Week', body.days_per_week)}
      ${row('Biggest Need', body.need)}
      ${row('Commitment Level', body.commitment)}
  ` : ''

  const consultationRows = isConsultation ? `
      ${row('How They Found Us', body.source)}
      ${row('Current Weight', body.current_weight)}
      ${row('Primary Fitness Goal', body.goal)}
      ${row('Why This Goal Matters', body.goal_importance)}
      ${row('Injuries / Medical History', body.medical_history)}
      ${row('Best Time to Reach', body.preferred_contact_time)}
      ${row('Additional Information', body.message)}
  ` : ''

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:32px 16px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">

        <!-- Header -->
        <tr>
          <td style="background:#1E293B;border-radius:12px 12px 0 0;padding:28px 32px">
            <p style="margin:0;font-size:12px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#2BAADF">FreddyFit</p>
            <h1 style="margin:6px 0 0;font-size:22px;font-weight:700;color:#FFFFFF">New ${formLabel}</h1>
          </td>
        </tr>

        <!-- Status bar -->
        <tr>
          <td style="background:#2BAADF;padding:10px 32px">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size:13px;color:#fff">Status: <strong>${status}</strong></td>
                <td align="right" style="font-size:13px;color:#fff">Source: <strong>${source}</strong></td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Contact info -->
        <tr>
          <td style="background:#ffffff;padding:0">
            <table width="100%" cellpadding="0" cellspacing="0">
              ${row('Name', name)}
              ${row('Email', body.email ? `<a href="mailto:${body.email}" style="color:#2BAADF">${body.email}</a>` : '')}
              ${row('Phone', body.phone ? `<a href="tel:${body.phone}" style="color:#2BAADF">${body.phone}</a>` : '')}
              ${assessmentRows}
              ${consultationRows}
              ${row('Submitted', body.timestamp)}
            </table>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="background:#ffffff;border-top:2px solid #F1F5F9;border-radius:0 0 12px 12px;padding:24px 32px;text-align:center">
            <a href="https://myfitpro.vercel.app" style="display:inline-block;background:#2BAADF;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:14px 32px;border-radius:8px">View in CRM &rarr;</a>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

async function parseBody(request) {
  const ct = request.headers.get('content-type') || ''
  if (ct.includes('application/json')) return request.json()
  if (ct.includes('application/x-www-form-urlencoded') || ct.includes('multipart/form-data')) {
    const fd = await request.formData()
    const obj = {}
    for (const [k, v] of fd.entries()) obj[k] = v
    return obj
  }
  const text = await request.text()
  try { return JSON.parse(text) } catch {}
  return Object.fromEntries(new URLSearchParams(text))
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}

export async function POST(request) {
  try {
    const body = await parseBody(request)
    console.log('WEBHOOK PAYLOAD:', JSON.stringify(body))

    if (!supabaseUrl || !supabaseKey) {
      return Response.json({ error: 'Database not configured' }, { status: 500, headers: CORS })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })

    const leadName = (body.name || '').trim() || (body.email || '').trim() || 'Unknown Lead'
    const status   = commitmentToStatus(body.commitment || '')
    const source   = body._form === 'assessment'   ? 'FunctionalFIT Form'
                   : body._form === 'consultation' ? 'Consultation Form'
                   : 'Website'
    const goal = (body.goal || '').slice(0, 300)

    const noteLines = [
      body.goal                   && `Goal: ${body.goal}`,
      body.barrier                && `Barrier: ${body.barrier}`,
      body.days_per_week          && `Training days/week: ${body.days_per_week}`,
      body.need                   && `Needs most: ${body.need}`,
      body.commitment             && `Commitment: ${body.commitment}`,
      body.source                 && `How they heard: ${body.source}`,
      body.current_weight         && `Current weight: ${body.current_weight}`,
      body.goal_importance        && `Goal importance: ${body.goal_importance}`,
      body.medical_history        && `Medical/Injuries: ${body.medical_history}`,
      body.preferred_contact_time && `Best time: ${body.preferred_contact_time}`,
      body.message                && `Message: ${body.message}`,
      body.timestamp              && `Submitted: ${body.timestamp}`,
    ].filter(Boolean)
    const notes = noteLines.join('\n')

    const { error } = await supabase.from('leads').insert({
      id: crypto.randomUUID(),
      name: leadName,
      email: (body.email || '').trim(),
      phone: (body.phone || '').trim(),
      goal,
      source,
      status,
      notes,
      date_added: today,
      updated_at: new Date().toISOString()
    })

    if (error) throw error

    try {
      await resend.emails.send({
        from: 'myfitpro@getfreddyfit.com',
        to: 'readyfit91@gmail.com',
        subject: `New ${body._form === 'consultation' ? 'Consultation' : 'Lead'}: ${leadName}`,
        html: buildEmail(leadName, body, status, source)
      })
    } catch (emailErr) {
      console.error('Email failed:', emailErr)
    }

    return Response.json({ success: true }, { headers: CORS })

  } catch (err) {
    console.error('Webhook error:', err)
    return Response.json({ error: err.message || 'Failed' }, { status: 500, headers: CORS })
  }
}

export async function GET() {
  return Response.json({ ok: true, endpoint: 'FreddyFit Webhook' }, { headers: CORS })
}
