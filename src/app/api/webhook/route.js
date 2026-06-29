import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// POST /api/webhook — Zapier sends data here; creates a new CRM lead
// Expected fields: name, email, phone, message
export async function POST(request) {
  try {
    const body = await request.json()
    const { name, email, phone, message } = body

    if (!supabaseUrl || !supabaseKey) {
      return Response.json({ error: 'Database not configured' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    const today = new Date().toISOString().split('T')[0]

    // Derive a useful name fallback if Zapier sends an empty name
    const leadName = name?.trim() || email?.trim() || 'Unknown Lead'

    const { error } = await supabase.from('leads').insert({
      name: leadName,
      email: email?.trim() || '',
      phone: phone?.trim() || '',
      goal: '',
      source: 'Zapier / Email',
      status: 'New Lead',
      notes: message?.trim() || '',
      date_added: today,
      updated_at: new Date().toISOString()
    })

    if (error) throw error

    return Response.json({ success: true, message: 'Lead created' })
  } catch (err) {
    console.error('Zapier webhook error:', err)
    return Response.json({ error: err.message || 'Failed to create lead' }, { status: 500 })
  }
}

// GET — health check so Zapier can verify the endpoint
export async function GET() {
  return Response.json({ ok: true, endpoint: 'FreddyFit Zapier Webhook' })
}
