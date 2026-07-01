import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

function getClient() {
  if (!supabaseUrl || !supabaseKey) throw new Error('Database not configured')
  return createClient(supabaseUrl, supabaseKey)
}

// GET /api/leads — fetch all leads server-side (avoids client-side env var issues)
export async function GET() {
  try {
    const supabase = getClient()
    const { data, error } = await supabase.from('leads').select('*')
    if (error) throw error
    const sorted = (data || []).sort((a, b) => {
      const aDate = a.updated_at || a.date_added || ''
      const bDate = b.updated_at || b.date_added || ''
      return bDate.localeCompare(aDate)
    })
    return Response.json({ leads: sorted })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

// PUT /api/leads — update an existing lead
export async function PUT(request) {
  try {
    const lead = await request.json()
    const supabase = getClient()
    const payload = {
      name: lead.name,
      phone: lead.phone || '',
      email: lead.email || '',
      source: lead.source || '',
      goal: lead.goal || '',
      status: lead.status || 'New Lead',
      date_added: lead.date_added || localDate(),
      last_contact_date: lead.last_contact_date || null,
      notes: lead.notes || '',
      consultation_notes: lead.consultation_notes || '',
      updated_at: new Date().toISOString()
    }
    if (lead.id) {
      const { data, error } = await supabase.from('leads').update(payload).eq('id', lead.id).select().single()
      if (error) throw error
      return Response.json({ lead: data })
    } else {
      const { data, error } = await supabase.from('leads').insert(payload).select().single()
      if (error) throw error
      return Response.json({ lead: data })
    }
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

// DELETE /api/leads?id=xxx — delete a lead
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })
    const supabase = getClient()
    const { error } = await supabase.from('leads').delete().eq('id', id)
    if (error) throw error
    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

function localDate() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

// POST /api/leads — public endpoint used by the lead capture form
export async function POST(request) {
  try {
    const body = await request.json()
    const { name, phone, email, goal, source } = body

    if (!name || !name.trim()) {
      return Response.json({ error: 'Name is required' }, { status: 400 })
    }

    if (!supabaseUrl || !supabaseKey) {
      return Response.json({ error: 'Database not configured' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    const today = new Date().toISOString().split('T')[0]

    const { error } = await supabase.from('leads').insert({
      name: name.trim(),
      phone: phone?.trim() || '',
      email: email?.trim() || '',
      goal: goal?.trim() || '',
      source: source?.trim() || 'Lead Form',
      status: 'New Lead',
      date_added: today,
      updated_at: new Date().toISOString()
    })

    if (error) throw error

    return Response.json({ success: true })
  } catch (err) {
    console.error('Lead capture error:', err)
    return Response.json({ error: err.message || 'Failed to save lead' }, { status: 500 })
  }
}
