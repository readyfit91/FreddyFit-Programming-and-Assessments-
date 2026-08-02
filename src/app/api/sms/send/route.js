import { createClient } from '@supabase/supabase-js'
import { sendSms, normalizePhone } from '../../../../lib/twilio'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

function getClient() {
  if (!supabaseUrl || !supabaseKey) throw new Error('Database not configured')
  return createClient(supabaseUrl, supabaseKey)
}

// GET /api/sms/send?phone=xxx — fetch the SMS thread with a given phone number
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const phone = normalizePhone(searchParams.get('phone') || '')
    if (!phone) return Response.json({ error: 'Missing phone' }, { status: 400 })

    const supabase = getClient()
    const { data, error } = await supabase
      .from('sms_messages')
      .select('*')
      .or(`to_number.eq.${phone},from_number.eq.${phone}`)
      .order('created_at', { ascending: true })
      .limit(200)
    if (error) throw error
    return Response.json({ messages: data || [] })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/sms/send — send an outbound SMS and log it
export async function POST(request) {
  try {
    const { to, body, leadId, clientId } = await request.json()
    if (!to || !body || !body.trim()) {
      return Response.json({ error: 'Missing to/body' }, { status: 400 })
    }

    const toNumber = normalizePhone(to)
    const message = await sendSms({ to: toNumber, body })

    let logged = null
    try {
      const supabase = getClient()
      const { data, error } = await supabase.from('sms_messages').insert({
        lead_id: leadId || null,
        client_id: clientId || null,
        direction: 'outbound',
        from_number: message.from || '',
        to_number: toNumber,
        body,
        status: message.status || 'queued',
        twilio_sid: message.sid || null,
      }).select().single()
      if (error) throw error
      logged = data
    } catch (logErr) {
      console.error('sms log failed:', logErr)
    }

    return Response.json({ success: true, message: logged || { to_number: toNumber, body, direction: 'outbound' } })
  } catch (err) {
    console.error('sms send error:', err)
    return Response.json({ error: err.message || 'Failed to send SMS' }, { status: 500 })
  }
}
