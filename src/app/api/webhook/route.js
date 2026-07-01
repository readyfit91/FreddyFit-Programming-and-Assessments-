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

// Case-insensitive field lookup — handles spaces, underscores, and mixed case
// e.g. get(f, 'First Name') also matches 'first_name', 'firstname', 'first name'
function get(obj, ...keys) {
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== '') return obj[key]
    const needle = key.toLowerCase().replace(/[\s_]+/g, '')
    for (const k of Object.keys(obj)) {
      if (k.toLowerCase().replace(/[\s_]+/g, '') === needle) {
        if (obj[k] !== undefined && obj[k] !== '') return obj[k]
      }
    }
  }
  return ''
}

function commitmentToStatus(commitment = '') {
  const c = commitment.toLowerCase()
  if (c.includes('serious') || c.includes('ready to start') || c.includes('sign up')) return 'Follow Up'
  if (c.includes('interested') || c.includes('contact me') || c.includes('questions')) return 'New Lead'
  if (c.includes('not right now') || c.includes("isn't a priority") || c.includes('not a priority')) return 'Cold'
  return 'New Lead'
}

function mapSource(src = '') {
  const s = src.toLowerCase()
  if (s.includes('instagram')) return 'Instagram'
  if (s.includes('facebook')) return 'Facebook'
  if (s.includes('referral') || s.includes('friend') || s.includes('word')) return 'Referral'
  if (s.includes('walk') || s.includes('in person')) return 'Walk-in'
  if (s.includes('website') || s.includes('google') || s.includes('search')) return 'Website'
  if (s.includes('email')) return 'Email'
  return src || 'Website'
}

// Unwrap formsubmit.co payloads that nest fields inside a "data" key
function extractFields(raw) {
  return (raw.data && typeof raw.data === 'object') ? { ...raw, ...raw.data } : raw
}

function normaliseFields(raw) {
  const f = extractFields(raw)

  const firstName  = get(f, 'First Name', 'first_name', 'firstname')
  const lastName   = get(f, 'Last Name', 'last_name', 'lastname')
  const commitment = get(f, 'Commitment Level', 'commitment_level', 'commitment')
  const primaryGoal = get(f, 'Primary Goal', 'primary_goal', 'goal')
  const barriers   = get(f, 'Current Barriers', 'current_barriers', 'barrier', 'barriers')
  const trainingDays = get(f, 'Training Days Per Week', 'training_days_per_week', 'days_per_week')
  const biggestNeed = get(f, 'Biggest Need', 'biggest_need', 'need')
  const emailVal   = get(f, 'Email', 'email')
  const phoneVal   = get(f, 'Phone Number', 'phone_number', 'phone')
  const timestamp  = get(f, 'Timestamp', 'timestamp')

  // Assessment quiz: identified by presence of quiz-specific fields
  if (firstName || commitment || primaryGoal || barriers || trainingDays || biggestNeed) {
    const name = firstName ? `${firstName} ${lastName}`.trim() : get(f, 'name')
    return {
      name,
      email: emailVal,
      phone: phoneVal,
      goal: primaryGoal,
      barrier: barriers,
      days_per_week: trainingDays,
      need: biggestNeed,
      commitment,
      timestamp,
      _form: 'assessment',
    }
  }

  // Consultation form fields
  const fitnessGoal = get(f, 'fitness_goal', 'goal')
  const referral    = get(f, 'referral_source', 'source', 'how_did_you_hear')
  if (fitnessGoal || referral || get(f, 'injuries') || get(f, 'medication') || get(f, 'contact_availability')) {
    return {
      name: get(f, 'name'),
      email: emailVal || get(f, 'email'),
      phone: phoneVal || get(f, 'phone'),
      goal: fitnessGoal,
      source: referral,
      current_weight: get(f, 'current_weight'),
      goal_importance: get(f, 'goal_importance'),
      medical_history: [get(f, 'injuries'), get(f, 'medication')].filter(Boolean).join(' | '),
      preferred_contact_time: get(f, 'contact_availability', 'preferred_contact_time'),
      message: get(f, 'message'),
      _form: 'consultation',
    }
  }

  // Fallback: pass through as-is
  return f
}

function buildNotes(body) {
  const lines = []
  if (body.goal)                   lines.push(`🎯 Goal: ${body.goal}`)
  if (body.barrier)                lines.push(`\uD83D\UDEA7 Barrier: ${body.barrier}`)
  if (body.days_per_week)          lines.push(`📅 Training days/week: ${body.days_per_week}`)
  if (body.need)                   lines.push(`💡 Needs most: ${body.need}`)
  if (body.commitment)             lines.push(`✅ Commitment: ${body.commitment}`)
  if (body.current_weight)         lines.push(`⚖️ Current weight: ${body.current_weight}`)
  if (body.goal_importance)        lines.push(`🔥 Goal importance: ${body.goal_importance}`)
  if (body.motivation)             lines.push(`💬 Motivation: ${body.motivation}`)
  if (body.preferred_contact_time) lines.push(`🕐 Best time: ${body.preferred_contact_time}`)
  if (body.medical_history)        lines.push(`🏥 Medical/Injuries: ${body.medical_history}`)
  if (body.medications)            lines.push(`💊 Medications: ${body.medications}`)
  if (body.additional_info)        lines.push(`📝 Additional: ${body.additional_info}`)
  if (body.message)                lines.push(`💬 Message: ${body.message}`)
  if (body.timestamp)              lines.push(`🕒 Submitted: ${body.timestamp}`)
  return lines.join('\n')
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
  const ct = request.headers.get('content-type') || ''
  const isFormSubmit = ct.includes('application/x-www-form-urlencoded') || ct.includes('multipart/form-data')

  try {
    const raw = await parseBody(request)
    // Log the raw payload so we can see exactly what formsubmit.co sends
    console.log('WEBHOOK RAW PAYLOAD:', JSON.stringify(raw))

    const body = normaliseFields(raw)
    console.log('WEBHOOK NORMALISED:', JSON.stringify(body))

    const nextUrl = raw._next || raw.redirect || 'https://getfreddyfit.com'

    if (!supabaseUrl || !supabaseKey) {
      if (isFormSubmit) return Response.redirect(nextUrl + '?status=error', 302)
      return Response.json({ error: 'Database not configured' }, { status: 500, headers: CORS })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })

    const leadName = (body.name || body.email || 'Unknown Lead').trim() || 'Unknown Lead'

    let status = 'New Lead'
    let source = 'Website'

    if (body._form === 'assessment') {
      status = commitmentToStatus(body.commitment)
      source = 'FunctionalFIT Form'
    } else if (body._form === 'consultation') {
      source = mapSource(body.source || '')
    } else {
      if (body.commitment || body.barrier || body.days_per_week || body.need) {
        status = commitmentToStatus(body.commitment)
        source = 'FunctionalFIT Form'
      } else {
        source = mapSource(body.source || body.how_did_you_hear || '')
      }
    }

    const notes = buildNotes(body)
    const goal = (body.goal || '').slice(0, 300)

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
        subject: `🆕 New Lead: ${leadName}`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">
            <h2 style="color:#2BAADF;margin:0 0 16px">New Lead in your CRM</h2>
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="padding:8px 0;color:#64748B;font-size:13px;width:140px">Name</td><td style="padding:8px 0;font-weight:700">${leadName}</td></tr>
              ${body.phone ? `<tr><td style="padding:8px 0;color:#64748B;font-size:13px">Phone</td><td style="padding:8px 0">${body.phone}</td></tr>` : ''}
              ${body.email ? `<tr><td style="padding:8px 0;color:#64748B;font-size:13px">Email</td><td style="padding:8px 0">${body.email}</td></tr>` : ''}
              ${goal ? `<tr><td style="padding:8px 0;color:#64748B;font-size:13px">Goal</td><td style="padding:8px 0">${goal}</td></tr>` : ''}
              <tr><td style="padding:8px 0;color:#64748B;font-size:13px">Source</td><td style="padding:8px 0">${source}</td></tr>
              <tr><td style="padding:8px 0;color:#64748B;font-size:13px">Status</td><td style="padding:8px 0">${status}</td></tr>
              ${notes ? `<tr><td style="padding:8px 0;color:#64748B;font-size:13px;vertical-align:top">Notes</td><td style="padding:8px 0;white-space:pre-wrap">${notes}</td></tr>` : ''}
            </table>
            <div style="margin-top:24px">
              <a href="https://myfitpro.vercel.app" style="background:#2BAADF;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">Open CRM &#x2192;</a>
            </div>
          </div>
        `
      })
    } catch (emailErr) {
      console.error('Email notification failed:', emailErr)
    }

    if (isFormSubmit) {
      return Response.redirect(nextUrl + '?submitted=1', 302)
    }
    return Response.json({ success: true, message: 'Lead created', source, status }, { headers: CORS })

  } catch (err) {
    console.error('Webhook error:', err)
    if (isFormSubmit) return Response.redirect('https://getfreddyfit.com?status=error', 302)
    return Response.json({ error: err.message || 'Failed to create lead' }, { status: 500, headers: CORS })
  }
}

export async function GET() {
  return Response.json({ ok: true, endpoint: 'FreddyFit Webhook' }, { headers: CORS })
}
