import { validateTwilioSignature, normalizePhone } from '../../../../lib/twilio'

const fromNumber = process.env.TWILIO_PHONE_NUMBER || ''

function escapeXml(s) {
  return String(s || '').replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]))
}

function twiml(body, status = 200) {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, { status, headers: { 'Content-Type': 'text/xml' } })
}

// Twilio requests this once the owner's leg (rung by /api/calls/click-to-call) is answered.
// It dials the actual target number, bridging the owner to the lead/client.
export async function POST(request) {
  try {
    const rawBody = await request.text()
    const params = Object.fromEntries(new URLSearchParams(rawBody))

    const signature = request.headers.get('x-twilio-signature') || ''
    const proto = request.headers.get('x-forwarded-proto') || 'https'
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || ''
    const { pathname, search, searchParams } = new URL(request.url)
    const url = `${proto}://${host}${pathname}${search}`

    if (!validateTwilioSignature(signature, url, params)) {
      console.error('calls/connect: invalid Twilio signature')
      return twiml('<Say>Sorry, this call could not be verified.</Say><Hangup/>', 403)
    }

    const to = normalizePhone(searchParams.get('to') || '')
    const name = searchParams.get('name') || ''

    if (!to) {
      return twiml('<Say>No number to connect to.</Say><Hangup/>', 400)
    }

    return twiml(`<Say voice="alice">Connecting you to ${escapeXml(name || 'your contact')}.</Say><Dial callerId="${escapeXml(fromNumber)}">${escapeXml(to)}</Dial>`)
  } catch (err) {
    console.error('calls/connect error:', err)
    return twiml('<Say>An error occurred.</Say><Hangup/>', 500)
  }
}

export async function GET() {
  return Response.json({ ok: true, endpoint: 'FreddyFit Call Connect' })
}
