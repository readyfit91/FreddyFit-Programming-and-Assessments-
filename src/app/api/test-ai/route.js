import Anthropic from '@anthropic-ai/sdk'

export async function GET() {
  const key = process.env.ANTHROPIC_API_KEY

  if (!key) {
    return Response.json({
      ok: false,
      problem: 'ANTHROPIC_API_KEY is not set in environment variables.',
      fix: 'Go to Vercel → your project → Settings → Environment Variables and add ANTHROPIC_API_KEY with your key from console.anthropic.com → API Keys.',
    })
  }

  const masked = key.slice(0, 10) + '...' + key.slice(-4)

  try {
    const client = new Anthropic({ apiKey: key })
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Say "ok"' }],
    })
    const text = response.content?.map(b => b.text || '').join('') || ''
    return Response.json({ ok: true, keyMasked: masked, response: text })
  } catch (error) {
    const status = error.status
    const errorType = error.error?.type || ''
    const message = error.message

    let problem = message
    let fix = ''

    if (!status) {
      problem = 'Could not reach Anthropic API (network error).'
      fix = 'Check that the server can reach api.anthropic.com.'
    } else if (status === 401) {
      problem = 'API key is invalid or revoked.'
      fix = 'Go to console.anthropic.com → API Keys, create a new key, and update ANTHROPIC_API_KEY in Vercel env vars. Then redeploy.'
    } else if (errorType === 'credit_balance_too_low' || message?.toLowerCase().includes('credit')) {
      problem = 'API key is valid but the workspace has no credits.'
      fix = 'Go to console.anthropic.com → Billing and add credits. Make sure you are adding credits to the same workspace this API key belongs to.'
    } else if (status === 403) {
      problem = 'API key does not have permission to use this model.'
      fix = 'Check your plan at console.anthropic.com.'
    }

    return Response.json({ ok: false, keyMasked: masked, status, errorType, problem, fix }, { status: 200 })
  }
}
