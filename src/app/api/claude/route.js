import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})

export async function POST(request) {
  try {
    const { messages, maxTokens = 1000, system } = await request.json()

    const params = {
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      messages,
    }
    if (system) params.system = system

    const response = await client.messages.create(params)

    const text = response.content?.map(b => b.text || '').join('') || ''
    return Response.json({ text })
  } catch (error) {
    console.error('Claude API error:', error)

    const status = error.status ?? 500
    const errorType = error.error?.type || ''
    let message = error.message

    // Billing / credit errors (type-safe check + message fallback)
    const isBilling =
      errorType === 'credit_balance_too_low' ||
      (message?.toLowerCase().includes('credit') && (status === 400 || status === 402))

    if (isBilling) {
      message = 'AI features are temporarily unavailable — the Anthropic API credit balance is too low. Please add credits at console.anthropic.com.'
    }

    return Response.json({ error: message, errorType, status }, { status })
  }
}
