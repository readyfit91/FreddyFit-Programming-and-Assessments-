import { createClient } from '@supabase/supabase-js'
import { validateTwilioSignature } from '../../../../lib/twilio'

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

    if (supabaseUrl && supabaseKey) {
      const supabase = getClient()
      const { error } = await supabase.from('sms_messages').insert({
        direction: 'inbound',
        from_number: from,
        to_number: to,
        body,
        status,
        twilio_sid: sid,
      })
      if (error) console.error('sms webhook insert failed:', error)
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
