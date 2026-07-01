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
      <td style="padding:10px 12px;border-bottom:1px solid #F1F5F9;color:#64748B;font-size:13px;white-space:nowrap;vertical-align:top;width:180px">${label}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #F1F5F9;font-size:14px;vertical-align:top">${value}</td>
    </tr>`
}

function buildEmail(name, body, status, source) {
  const isAssessment = body._form === 'assessment'
  const isConsultation = body._form === 'consultation'

  const assessmentRows = isAssessment ? `
    ${row('Primary Goal', body.goal)}
    ${row('Current Barriers', body.barrier)}
    ${row('Training Days/Week', body.days_per_week)}
    ${row('Biggest Need', body.need)}
    ${row('Commitment', body.commitment)}
  ` : ''

  const consultationRows = isConsultation ? `
    ${row('How They Heard', body.source)}
    ${row('Current Weight', body.current_weight)}
    ${row('Fitness Goal', body.goal)}
    ${row('Why It Matters', body.goal_importance)}
    ${row('Injuries / Medical', body.medical_history)}
    ${row('Best Time to Reach', body.preferred_contact_time)}
    ${row('Additional Info', body.message)}
  ` : ''

  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#fff">
      <h2 style="color:#2BAADF;margin:0 0 4px;font-size:22px">New ${isConsultation ? 'Consultation Request' : 'Lead'}: ${name}</h2>
      <p style="margin:0 0 20px;color:#64748B;font-size:13px">Status: <strong>${status}</strong> &nbsp;|&nbsp; Source: <strong>${source}</strong></p>
      <table style="width:100%;border-collapse:collapse;border:1px solid #E2E8F0;border-radius:8px;overflow:hidden">
        ${row('Name', name)}
        ${row('Email', body.email)}
        ${row('Phone', body.phone)}
        ${assessmentRows}
        ${consultationRows}
        ${row('Submitted', body.timestamp)}
      </table>
      <div style="margin-top:24px">
        <a href="https://myfitpro.vercel.app" style="background:#2BAADF;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">Open CRM &#x2192;</a>
      </div>
    </div>
  `
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
    const status = commitmentToStatus(body.commitment || '')
    const source = body._form === 'assessment' ? 'FunctionalFIT Form' : body._form === 'consultation' ? 'Consultation Form' : 'Website'
    const goal = (body.goal || '').slice(0, 300)

    const noteLines = [
      body.goal                 && `Goal: ${body.goal}`,
      body.barrier              && `Barrier: ${body.barrier}`,
      body.days_per_week        && `Training days/week: ${body.days_per_week}`,
      body.need                 && `Needs most: ${body.need}`,
      body.commitment           && `Commitment: ${body.commitment}`,
      body.source               && `How they heard: ${body.source}`,
      body.current_weight       && `Current weight: ${body.current_weight}`,
      body.goal_importance      && `Goal importance: ${body.goal_importance}`,
      body.medical_history      && `Medical/Injuries: ${body.medical_history}`,
      body.preferred_contact_time && `Best time: ${body.preferred_contact_time}`,
      body.message              && `Message: ${body.message}`,
      body.timestamp            && `Submitted: ${body.timestamp}`,
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
