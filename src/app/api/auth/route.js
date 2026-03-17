import { verifyToken } from '../login/route'

// GET /api/auth — check if session cookie is valid
export async function GET(request) {
  const cookies = request.headers.get('cookie') || ''
  const match = cookies.match(/ff_session=([^;]+)/)
  const token = match ? match[1] : null

  if (verifyToken(token)) {
    return Response.json({ authed: true })
  }
  return Response.json({ authed: false }, { status: 401 })
}

// DELETE /api/auth — logout (clear cookie)
export async function DELETE() {
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': `ff_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
    }
  })
}
