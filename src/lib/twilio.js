import twilio from 'twilio'

let client = null

function getClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!sid || !token) return null
  if (!client) client = twilio(sid, token)
  return client
}

// Normalizes to E.164 assuming US numbers when no country code is present.
export function toE164(phone) {
  if (!phone) return ''
  const digits = phone.replace(/[^\d+]/g, '')
  if (digits.startsWith('+')) return digits
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return digits
}

// Sends an SMS via Twilio. Returns { success, sid } or { success: false, error }.
// No-ops (rather than throwing) when Twilio isn't configured, so callers can
// fire-and-forget without needing to check env config first.
export async function sendSMS(to, body) {
  const twilioClient = getClient()
  const from = process.env.TWILIO_FROM_NUMBER
  if (!twilioClient || !from) {
    return { success: false, error: 'Twilio not configured' }
  }
  const toNumber = toE164(to)
  if (!toNumber) {
    return { success: false, error: 'No recipient phone number provided' }
  }
  try {
    const message = await twilioClient.messages.create({ to: toNumber, from, body })
    return { success: true, sid: message.sid }
  } catch (err) {
    return { success: false, error: err.message }
  }
}
