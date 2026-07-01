import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

function getClient() {
  if (!supabaseUrl || !supabaseKey) throw new Error('Database not configured')
  return createClient(supabaseUrl, supabaseKey)
}

// GET /api/clients — fetch all clients server-side
export async function GET() {
  try {
    const supabase = getClient()
    const { data, error } = await supabase.from('clients').select('*').order('updated_at', { ascending: false })
    if (error) throw error
    return Response.json({ clients: data || [] })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/clients — save (insert or update) a client server-side
export async function POST(request) {
  try {
    const client = await request.json()
    const supabase = getClient()
    const payload = {
      name: client.name,
      email: client.email || '',
      goal: client.goal || '',
      dob: client.dob || '',
      equipment: client.equipment || '',
      trainer_notes: client.trainerNotes || '',
      updated_at: new Date().toISOString()
    }
    let data, error
    if (client.id) {
      ;({ data, error } = await supabase.from('clients').update(payload).eq('id', client.id).select())
    } else {
      ;({ data, error } = await supabase.from('clients').insert({ ...payload, id: crypto.randomUUID() }).select())
    }
    if (error) throw error
    return Response.json({ client: data?.[0] || null })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
