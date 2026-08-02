import { createClient } from '@supabase/supabase-js'
import { validateTwilioSignature, normalizePhone, sendSms } from '../../../../lib/twilio'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

function getClient() {
  if (!supabaseUrl || !supabaseKey) throw new Error('Database not configured')
  return createClient(supabaseUrl, supabaseKey)
}

const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'

function twimlResponse(status = 200) {
  return new Response(EMPTY_TWIML, { status, headers: { 'Content-Type': 'text/xml' } })
}

// Point this Twilio phone number's "A message comes in" webhook (in the Twilio console,
// under Phone Numbers) at: https://<your-domain>/api/sms/webhook
export async function POST(request) {
  try {
    const rawBody = await request.text()
    const params = Object.fromEntries(new URLSearchParams(rawBody))

    const signature = request.headers.get('x-twilio-signature') || ''
    const proto = request.headers.get('x-forwarded-proto') || 'https'
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || ''
    const url = `${proto}://${host}${new URL(request.url).pathname}`

    if (!validateTwilioSignature(signature, url, params)) {
      console.error('SMS webhook: invalid Twilio signature')
      return twimlResponse(403)
    }

    const from = params.From || ''
    const to = params.To || ''
    const body = params.Body || ''
    const sid = params.MessageSid || null
    const status = params.SmsStatus || params.MessageStatus || 'received'

    let senderName = from

    if (supabaseUrl && supabaseKey) {
      const supabase = getClient()
      const normalizedFrom = normalizePhone(from)

      // Match the inbound number against leads/clients so the thread (and the owner alert
      // below) can show a name instead of a bare phone number. Phone numbers aren't stored
      // normalized, so compare normalized in JS rather than trusting an exact SQL match.
      let leadId = null
      let clientId = null
      try {
        const { data: leads } = await supabase.from('leads').select('id,name,phone').not('phone', 'is', null)
        const match = (leads || []).find(l => l.phone && normalizePhone(l.phone) === normalizedFrom)
        if (match) { leadId = match.id; senderName = match.name }
      } catch (e) { console.error('sms webhook lead lookup failed:', e) }
      if (!leadId) {
        try {
          const { data: clients } = await supabase.from('clients').select('id,name,phone').not('phone', 'is', null)
          const match = (clients || []).find(c => c.phone && normalizePhone(c.phone) === normalizedFrom)
          if (match) { clientId = match.id; senderName = match.name }
        } catch (e) { console.error('sms webhook client lookup failed:', e) }
      }

      const { error } = await supabase.from('sms_messages').insert({
        lead_id: leadId,
        client_id: clientId,
        direction: 'inbound',
        from_number: from,
        to_number: to,
        body,
        status,
        twilio_sid: sid,
      })
      if (error) console.error('sms webhook insert failed:', error)
    }

    // Forward the reply to Freddy's own phone — replies otherwise only show up inside the
    // app, and there's no other notification channel wired up yet.
    const ownerNumber = process.env.OWNER_PHONE_NUMBER || ''
    if (ownerNumber && normalizePhone(ownerNumber) !== normalizePhone(from)) {
      try {
        const preview = body.length > 300 ? body.slice(0, 300) + '…' : body
        await sendSms({ to: ownerNumber, body: `FreddyFit: New text from ${senderName}: "${preview}"` })
      } catch (alertErr) {
        console.error('SMS reply alert failed:', alertErr)
      }
    }

    return twimlResponse()
  } catch (err) {
    console.error('sms webhook error:', err)
    return twimlResponse(500)
  }
}

export async function GET() {
  return Response.json({ ok: true, endpoint: 'FreddyFit SMS Webhook' })
}
