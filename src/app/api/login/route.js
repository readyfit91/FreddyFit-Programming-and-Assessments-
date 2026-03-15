export async function POST(request) {
  try {
    const { password } = await request.json()
    const correct = process.env.APP_PASSWORD

    if (!correct) {
      return Response.json({ error: 'APP_PASSWORD not set in environment' }, { status: 500 })
    }

    if (password === correct) {
      return Response.json({ success: true })
    }

    return Response.json({ error: 'Wrong password' }, { status: 401 })
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}
