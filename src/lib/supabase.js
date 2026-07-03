import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export const supabase = supabaseUrl ? createClient(supabaseUrl, supabaseKey) : null

// ── CLIENTS ──────────────────────────────────────────────────────────────────

export async function getAllClients() {
  const res = await fetch('/api/clients')
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Failed to load clients (${res.status})`)
  }
  const { clients, error } = await res.json()
  if (error) throw new Error(error)
  return clients || []
}

export async function getClientById(id) {
  const res = await fetch(`/api/clients?id=${encodeURIComponent(id)}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Failed to load client (${res.status})`)
  }
  const { client, error } = await res.json()
  if (error) throw new Error(error)
  return client
}

export async function saveClient(client) {
  const res = await fetch('/api/clients', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(client)
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Failed to save client (${res.status})`)
  }
  const { client: saved, error } = await res.json()
  if (error) throw new Error(error)
  return saved
}

export async function deleteClient(clientId) {
  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('id', clientId)
  if (error) throw error
}

// ── ASSESSMENTS ──────────────────────────────────────────────────────────────

export async function getAssessmentsForClient(clientId) {
  const { data, error } = await supabase
    .from('assessments')
    .select('*')
    .eq('client_id', clientId)
    .order('completed_at', { ascending: false })
  if (error) throw error
  // Convert to { [assessmentType]: { ...answers, _summary, _completedAt, _history } }
  const result = {}
  const historyMap = {}
  for (const row of data || []) {
    if (!historyMap[row.assessment_type]) historyMap[row.assessment_type] = []
    historyMap[row.assessment_type].push({
      id: row.id,
      answers: row.answers,
      summary: row.summary || '',
      completedAt: row.completed_at
    })
    if (!result[row.assessment_type]) {
      result[row.assessment_type] = {
        ...row.answers,
        _summary: row.summary || '',
        _completedAt: row.completed_at
      }
    }
  }
  // Attach history arrays
  for (const type of Object.keys(result)) {
    result[type]._history = historyMap[type] || []
  }
  return result
}

export async function saveAssessment(clientId, assessmentType, answers, summary, forceNew = false) {
  const payload = {
    client_id: clientId,
    assessment_type: assessmentType,
    answers: answers,
    summary: summary || '',
    completed_at: new Date().toISOString()
  }

  if (!forceNew) {
    // Check if one already exists for this client+type
    const { data: existing } = await supabase
      .from('assessments')
      .select('id')
      .eq('client_id', clientId)
      .eq('assessment_type', assessmentType)
      .order('completed_at', { ascending: false })
      .limit(1)
      .single()

    if (existing) {
      const { error } = await supabase
        .from('assessments')
        .update(payload)
        .eq('id', existing.id)
      if (error) throw error
      return
    }
  }

  const { error } = await supabase
    .from('assessments')
    .insert(payload)
  if (error) throw error
}

// ── PROGRAMS ─────────────────────────────────────────────────────────────────

export async function getProgramForClient(clientId) {
  const { data, error } = await supabase
    .from('programs')
    .select('*')
    .eq('client_id', clientId)
    .order('generated_at', { ascending: false })
    .limit(1)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return data || null
}

export async function saveProgram(clientId, phases) {
  // Delete old, insert new
  await supabase.from('programs').delete().eq('client_id', clientId)
  const { error } = await supabase
    .from('programs')
    .insert({ client_id: clientId, phases, generated_at: new Date().toISOString() })
  if (error) throw error
}

// ── WORKOUTS ─────────────────────────────────────────────────────────────────

export async function getWorkoutsForClient(clientId) {
  const { data, error } = await supabase
    .from('workouts')
    .select('*')
    .eq('client_id', clientId)
    .order('generated_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function saveWorkout(clientId, content, prompt) {
  const { error } = await supabase
    .from('workouts')
    .insert({ client_id: clientId, content, prompt, generated_at: new Date().toISOString() })
  if (error) throw error
}

// ── WEIGHT LOGS ─────────────────────────────────────────────────────────────

export async function getWeightLogsForClient(clientId) {
  const { data, error } = await supabase
    .from('weight_logs')
    .select('*')
    .eq('client_id', clientId)
    .order('logged_at', { ascending: true })
  if (error) throw error
  return data || []
}

export async function saveWeightLog(clientId, { weight, bodyFat, bmi, rating, behaviorTags, behaviorNotes, loggedAt }) {
  const { error } = await supabase
    .from('weight_logs')
    .insert({
      client_id: clientId,
      weight: weight || null,
      body_fat: bodyFat || null,
      bmi: bmi || null,
      rating: rating || null,
      behavior_tags: behaviorTags || null,
      behavior_notes: behaviorNotes || '',
      logged_at: loggedAt || new Date().toISOString()
    })
  if (error) throw error
}

export async function deleteWeightLog(logId) {
  const { error } = await supabase
    .from('weight_logs')
    .delete()
    .eq('id', logId)
  if (error) throw error
}

// ── CRM LEADS ────────────────────────────────────────────────────────────────

export async function getAllLeads() {
  // Fetch via API route — server-side always has env vars available
  const res = await fetch('/api/leads')
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Failed to load leads (${res.status})`)
  }
  const { leads, error } = await res.json()
  if (error) throw new Error(error)
  return leads || []
}

export async function saveLead(lead) {
  const res = await fetch('/api/leads', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(lead)
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Failed to save lead (${res.status})`)
  }
  const { lead: saved, error } = await res.json()
  if (error) throw new Error(error)
  return saved
}

export async function deleteLead(leadId) {
  const res = await fetch(`/api/leads?id=${leadId}`, { method: 'DELETE' })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Failed to delete lead (${res.status})`)
  }
}

// ── BLOOD WORK ────────────────────────────────────────────────────────────────

export async function getBloodWork(clientId) {
  const { data, error } = await supabase.from('blood_work').select('*').eq('client_id', clientId).order('year', { ascending: false })
  if (error) throw error
  return data || []
}

export async function saveBloodWork(record) {
  const payload = {
    client_id: record.client_id,
    year: record.year,
    period: record.period,
    frequency: record.frequency,
    test_date: record.test_date || null,
    markers: record.markers || {},
    notes: record.notes || '',
    updated_at: new Date().toISOString()
  }
  if (record.id) {
    const { data, error } = await supabase.from('blood_work').update(payload).eq('id', record.id).select()
    if (error) throw error
    return data?.[0] || null
  } else {
    const insertPayload = { ...payload, id: crypto.randomUUID() }
    const { data, error } = await supabase.from('blood_work').insert(insertPayload).select()
    if (error) throw error
    return data?.[0] || null
  }
}

export async function deleteBloodWork(id) {
  const { error } = await supabase.from('blood_work').delete().eq('id', id)
  if (error) throw error
}

// ── SESSIONS ─────────────────────────────────────────────────────────────────

export async function getRecurringSessions() {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('recurring', true)
    .order('date').order('time')
  if (error) throw error
  return data || []
}

export async function getSessions(startDate, endDate) {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date').order('time')
  if (error) throw error
  return data || []
}

export async function saveSession(session) {
  const payload = {
    client_id: session.client_id || null,
    client_name: session.client_name || '',
    client_email: session.client_email || '',
    client_phone: session.client_phone || '',
    date: session.date,
    time: session.time,
    session_type: session.session_type || 'FIT60',
    duration: session.duration || 60,
    recurring: session.recurring || false,
    notes: session.notes || '',
    link: session.link || '',
    exceptions: session.exceptions || [],
    updated_at: new Date().toISOString()
  }
  if (session.id) {
    const { data, error } = await supabase.from('sessions').update(payload).eq('id', session.id).select()
    if (error) throw error
    return data?.[0] || null
  } else {
    const insertPayload = { ...payload, id: crypto.randomUUID() }
    const { data, error } = await supabase.from('sessions').insert(insertPayload).select()
    if (error) throw error
    return data?.[0] || null
  }
}

export async function deleteSession(id) {
  const { error } = await supabase.from('sessions').delete().eq('id', id)
  if (error) throw error
}
