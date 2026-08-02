import twilio from 'twilio'

const accountSid = process.env.TWILIO_ACCOUNT_SID || ''
const authToken = process.env.TWILIO_AUTH_TOKEN || ''
const fromNumber = process.env.TWILIO_PHONE_NUMBER || ''

let client = null
function getClient() {
  if (!accountSid || !authToken) throw new Error('Twilio not configured (missing TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN)')
  if (!client) client = twilio(accountSid, authToken)
  return client
}

// Normalizes a phone number to E.164. Assumes US/Canada (+1) for bare 10-digit numbers,
// since that's the only market FreddyFit currently operates in.
export function normalizePhone(raw) {
  if (!raw) return ''
  const trimmed = String(raw).trim()
  const digits = trimmed.replace(/[^\d+]/g, '')
  if (digits.startsWith('+')) return digits
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return digits ? `+${digits}` : ''
}

export function isTwilioConfigured() {
  return !!(accountSid && authToken && fromNumber)
}

// Click-to-call rings OWNER_PHONE_NUMBER first, so calling also needs that set.
export function isCallingConfigured() {
  return isTwilioConfigured() && !!process.env.OWNER_PHONE_NUMBER
}

export async function sendSms({ to, body }) {
  if (!fromNumber) throw new Error('Twilio not configured (missing TWILIO_PHONE_NUMBER)')
  const toNumber = normalizePhone(to)
  if (!toNumber) throw new Error('Invalid or missing phone number')
  const message = await getClient().messages.create({ to: toNumber, from: fromNumber, body })
  return message
}

// Places a click-to-call bridge: rings the owner's phone, and once answered, `twimlUrl`
// (an /api/calls/connect URL) tells Twilio how to dial the actual target number.
export async function makeCall({ twimlUrl }) {
  const ownerNumber = process.env.OWNER_PHONE_NUMBER || ''
  if (!ownerNumber) throw new Error('Calling not configured (missing OWNER_PHONE_NUMBER)')
  if (!fromNumber) throw new Error('Twilio not configured (missing TWILIO_PHONE_NUMBER)')
  const toOwner = normalizePhone(ownerNumber)
  const call = await getClient().calls.create({ to: toOwner, from: fromNumber, url: twimlUrl, method: 'POST' })
  return call
}

export function validateTwilioSignature(signature, url, params) {
  if (!authToken) return false
  return twilio.validateRequest(authToken, signature, url, params)
}
