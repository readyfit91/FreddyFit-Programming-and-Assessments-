import crypto from 'crypto'

// ── Rate limiting (in-memory, resets on redeploy) ────────────────────────────
const attempts = new Map() // ip -> { count, blockedUntil }
const MAX_ATTEMPTS = 5
const BLOCK_MINUTES = 15
const WINDOW_MS = 60 * 1000 // 1 minute window for counting attempts

function getRateLimitInfo(ip) {
  const now = Date.now()
  let info = attempts.get(ip)
  if (!info) {
    info = { count: 0, firstAttempt: now, blockedUntil: 0 }
    attempts.set(ip, info)
  }
  // Reset window if it's been long enough since first attempt
  if (now - info.firstAttempt > WINDOW_MS && info.blockedUntil < now) {
    info.count = 0
    info.firstAttempt = now
  }
  return info
}

function recordFailedAttempt(ip) {
  const info = getRateLimitInfo(ip)
  info.count++
  if (info.count >= MAX_ATTEMPTS) {
    info.blockedUntil = Date.now() + BLOCK_MINUTES * 60 * 1000
  }
}

function clearAttempts(ip) {
  attempts.delete(ip)
}

// ── Timing-safe password comparison ──────────────────────────────────────────
function safeCompare(input, correct) {
  const a = Buffer.from(input)
  const b = Buffer.from(correct)
  if (a.length !== b.length) {
    // Compare against self to use constant time, then return false
    crypto.timingSafeEqual(a, a)
    return false
  }
  return crypto.timingSafeEqual(a, b)
}

// ── Signed auth token ────────────────────────────────────────────────────────
function generateToken() {
  const secret = process.env.APP_PASSWORD + (process.env.AUTH_SECRET || '_ff_session_key')
  const payload = Date.now().toString()
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex')
  return `${payload}.${sig}`
}

export function verifyToken(token) {
  if (!token) return false
  const secret = process.env.APP_PASSWORD + (process.env.AUTH_SECRET || '_ff_session_key')
  const [payload, sig] = token.split('.')
  if (!payload || !sig) return false
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  } catch {
    return false
  }
}

// ── POST /api/login ──────────────────────────────────────────────────────────
export async function POST(request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const rateInfo = getRateLimitInfo(ip)

    // Check if blocked
    if (rateInfo.blockedUntil > Date.now()) {
      const mins = Math.ceil((rateInfo.blockedUntil - Date.now()) / 60000)
      return Response.json(
        { error: `Too many attempts. Try again in ${mins} minute${mins > 1 ? 's' : ''}.` },
        { status: 429 }
      )
    }

    const { password } = await request.json()
    const correct = process.env.APP_PASSWORD

    if (!correct) {
      return Response.json({ error: 'APP_PASSWORD not set in environment' }, { status: 500 })
    }

    if (!password || !safeCompare(password, correct)) {
      recordFailedAttempt(ip)
      const remaining = MAX_ATTEMPTS - getRateLimitInfo(ip).count
      return Response.json(
        { error: remaining > 0 ? `Wrong password. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.` : `Too many attempts. Locked for ${BLOCK_MINUTES} minutes.` },
        { status: 401 }
      )
    }

    // Success — clear attempts and set signed cookie
    clearAttempts(ip)
    const token = generateToken()

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': `ff_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${60 * 60 * 24 * 7}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
      }
    })
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}
