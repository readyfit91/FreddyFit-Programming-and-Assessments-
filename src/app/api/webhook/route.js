import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

// Maps commitment answer → CRM status
function commitmentToStatus(commitment = '') {
  const c = commitment.toLowerCase()
  if (c.includes('serious') || c.includes('ready to start') || c.includes('sign up')) return 'Follow Up'
  if (c.includes('interested') || c.includes('contact me') || c.includes('questions')) return 'New Lead'
  if (c.includes('not right now') || c.includes("isn't a priority") || c.includes('not a priority')) return 'Cold'
  return 'New Lead'
}

// Maps "how did you hear" → LEAD_SOURCES values
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

// Build a clean notes block for Form 1 (FunctionalFIT)
function buildForm1Notes(body) {
  const lines = []
  if (body.goal)          lines.push(`🎯 Goal: ${body.goal}`)
  if (body.barrier)       lines.push(`🚧 Barrier: ${body.barrier}`)
  if (body.days_per_week) lines.push(`📅 Training days/week: ${body.days_per_week}`)
  if (body.need)          lines.push(`💡 Needs most: ${body.need}`)
  if (body.commitment)    lines.push(`✅ Commitment: ${body.commitment}`)
  return lines.join('\n')
}

// Build a clean notes block for Form 2 (General Intake)
function buildForm2Notes(body) {
  const lines = []
  if (body.current_weight)         lines.push(`⚖️ Current weight: ${body.current_weight}`)
  if (body.motivation)             lines.push(`💬 Motivation: ${body.motivation}`)
  if (body.preferred_contact_time) lines.push(`🕐 Best time to contact: ${body.preferred_contact_time}`)
  if (body.medical_history)        lines.push(`🏥 Medical/Injuries: ${body.medical_history}`)
  if (body.medications)            lines.push(`💊 Medications: ${body.medications}`)
  if (body.additional_info)        lines.push(`📝 Additional: ${body.additional_info}`)
  return lines.join('\n')
}

// OPTIONS — preflight CORS (browsers send this before cross-origin POST)
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}

// Parse body regardless of content type (JSON, form-encoded, or multipart)
async function parseBody(request) {
  const ct = request.headers.get('content-type') || ''
  if (ct.includes('application/json')) {
    return request.json()
  }
  if (ct.includes('application/x-www-form-urlencoded') || ct.includes('multipart/form-data')) {
    const formData = await request.formData()
    const obj = {}
    for (const [k, v] of formData.entries()) obj[k] = v
    return obj
  }
  // Fallback: try JSON, then form text
  const text = await request.text()
  try { return JSON.parse(text) } catch {}
  return Object.fromEntries(new URLSearchParams(text))
}

// POST /api/webhook — receives intake form data from getfreddyfit.com
export async function POST(request) {
  try {
    const body = await parseBody(request)

    if (!supabaseUrl || !supabaseKey) {
      return Response.json({ error: 'Database not configured' }, { status: 500, headers: CORS })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })

    const isForm1 = !!(body.commitment || body.barrier || body.days_per_week || body.need)
    const isForm2 = !!(body.medical_history || body.motivation || body.current_weight || body.preferred_contact_time)

    const leadName = (body.name
      ? body.name
      : `${body.first_name || ''} ${body.last_name || ''}`.trim() || body.email || 'Unknown Lead'
    ).trim() || body.email || 'Unknown Lead'

    let status = 'New Lead'
    let source = 'Website'
    let notes = ''
    let goal = body.goal || ''

    if (isForm1) {
      status = commitmentToStatus(body.commitment)
      source = 'FunctionalFIT Form'
      notes = buildForm1Notes(body)
    } else if (isForm2) {
      source = mapSource(body.source || body.how_did_you_hear || '')
      notes = buildForm2Notes(body)
    } else {
      source = 'Zapier / Email'
      notes = body.message || ''
    }

    const { error } = await supabase.from('leads').insert({
      name: leadName,
      email: (body.email || '').trim(),
      phone: (body.phone || '').trim(),
      goal: goal.slice(0, 300),
      source,
      status,
      notes,
      date_added: today,
      updated_at: new Date().toISOString()
    })

    if (error) throw error

    return Response.json({ success: true, message: 'Lead created', source, status }, { headers: CORS })
  } catch (err) {
    console.error('Webhook error:', err)
    return Response.json({ error: err.message || 'Failed to create lead' }, { status: 500, headers: CORS })
  }
}

// GET — health check
export async function GET() {
  return Response.json({
    ok: true,
    endpoint: 'FreddyFit Webhook',
    forms: {
      form1_functionalfit: ['name', 'email', 'phone', 'goal', 'barrier', 'days_per_week', 'need', 'commitment'],
      form2_general_intake: ['name', 'email', 'phone', 'source', 'current_weight', 'goal', 'motivation', 'medical_history', 'medications', 'preferred_contact_time', 'additional_info']
    }
  }, { headers: CORS })
}
