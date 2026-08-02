import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

function getClient() {
  if (!supabaseUrl || !supabaseKey) throw new Error('Database not configured')
  return createClient(supabaseUrl, supabaseKey)
}

// GET /api/sms/threads — latest message + latest inbound timestamp per phone number.
// Used by the UI to show a "new reply" indicator without fetching every full thread.
export async function GET() {
  try {
    const supabase = getClient()
    const { data, error } = await supabase
      .from('sms_messages')
      .select('from_number,to_number,direction,created_at')
      .order('created_at', { ascending: false })
      .limit(1000)
    if (error) throw error

    const threads = {}
    for (const m of data || []) {
      const phone = m.direction === 'inbound' ? m.from_number : m.to_number
      if (!phone) continue
      if (!threads[phone]) threads[phone] = { phone, lastMessageAt: m.created_at, lastInboundAt: null }
      if (m.direction === 'inbound' && !threads[phone].lastInboundAt) threads[phone].lastInboundAt = m.created_at
    }
    return Response.json({ threads: Object.values(threads) })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
