import { createClient } from '@supabase/supabase-js'
import { makeCall, normalizePhone, isCallingConfigured } from '../../../../lib/twilio'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

function getClient() {
  if (!supabaseUrl || !supabaseKey) throw new Error('Database not configured')
  return createClient(supabaseUrl, supabaseKey)
}

// POST /api/calls/click-to-call — rings the owner's phone (OWNER_PHONE_NUMBER) first; once
// answered, Twilio requests /api/calls/connect, which dials the actual target number.
export async function POST(request) {
  try {
    const { to, name, leadId, clientId } = await request.json()
    if (!to) return Response.json({ error: 'Missing to' }, { status: 400 })
    if (!isCallingConfigured()) {
      return Response.json({ error: 'Calling is not configured (missing Twilio credentials or OWNER_PHONE_NUMBER)' }, { status: 500 })
    }

    const toNumber = normalizePhone(to)
    if (!toNumber) return Response.json({ error: 'Invalid phone number' }, { status: 400 })

    const proto = request.headers.get('x-forwarded-proto') || 'https'
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || ''
    const connectUrl = `${proto}://${host}/api/calls/connect?to=${encodeURIComponent(toNumber)}&name=${encodeURIComponent(name || '')}`

    const call = await makeCall({ twimlUrl: connectUrl })

    try {
      const supabase = getClient()
      const { error } = await supabase.from('calls').insert({
        lead_id: leadId || null,
        client_id: clientId || null,
        to_number: toNumber,
        from_number: call.from || '',
        status: call.status || 'queued',
        twilio_sid: call.sid || null,
      })
      if (error) throw error
    } catch (logErr) {
      console.error('call log failed:', logErr)
    }

    return Response.json({ success: true, sid: call.sid })
  } catch (err) {
    console.error('click-to-call error:', err)
    return Response.json({ error: err.message || 'Failed to place call' }, { status: 500 })
  }
}
