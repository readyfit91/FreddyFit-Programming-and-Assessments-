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
    return Response.json({ error: error.message }, { status: 500 })
  }
}
