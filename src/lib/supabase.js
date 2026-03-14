import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)

// ── CLIENTS ──────────────────────────────────────────────────────────────────

export async function getAllClients() {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function saveClient(client) {
  const { data, error } = await supabase
    .from('clients')
    .upsert({
      id: client.id,
      name: client.name,
      goal: client.goal || '',
      dob: client.dob || '',
      equipment: client.equipment || '',
      trainer_notes: client.trainerNotes || '',
      updated_at: new Date().toISOString()
    })
    .select()
    .single()
  if (error) throw error
  return data
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
  // Convert to { [assessmentType]: { ...answers, _summary, _completedAt } }
  const result = {}
  for (const row of data || []) {
    result[row.assessment_type] = {
      ...row.answers,
      _summary: row.summary || '',
      _completedAt: row.completed_at
    }
  }
  return result
}

export async function saveAssessment(clientId, assessmentType, answers, summary) {
  // Check if one already exists for this client+type
  const { data: existing } = await supabase
    .from('assessments')
    .select('id')
    .eq('client_id', clientId)
    .eq('assessment_type', assessmentType)
    .single()

  const payload = {
    client_id: clientId,
    assessment_type: assessmentType,
    answers: answers,
    summary: summary || '',
    completed_at: new Date().toISOString()
  }

  if (existing) {
    const { error } = await supabase
      .from('assessments')
      .update(payload)
      .eq('id', existing.id)
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('assessments')
      .insert(payload)
    if (error) throw error
  }
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

// ── CHECKINS (Sign-In Sheets) ───────────────────────────────────────────────

export async function getCheckinsByDate(sessionDate) {
  const { data, error } = await supabase
    .from('checkins')
    .select('*, clients(name)')
    .eq('session_date', sessionDate)
    .order('time_in', { ascending: true })
  if (error) throw error
  return data || []
}

export async function createCheckin(clientId, sessionDate, sessionType) {
  const { data, error } = await supabase
    .from('checkins')
    .insert({
      client_id: clientId,
      session_date: sessionDate,
      time_in: new Date().toISOString(),
      session_type: sessionType || 'Training'
    })
    .select('*, clients(name)')
    .single()
  if (error) throw error
  return data
}

export async function signOutCheckin(checkinId) {
  const { data, error } = await supabase
    .from('checkins')
    .update({ time_out: new Date().toISOString() })
    .eq('id', checkinId)
    .select('*, clients(name)')
    .single()
  if (error) throw error
  return data
}

export async function updateCheckinNotes(checkinId, notes) {
  const { error } = await supabase
    .from('checkins')
    .update({ notes })
    .eq('id', checkinId)
  if (error) throw error
}

export async function deleteCheckin(checkinId) {
  const { error } = await supabase
    .from('checkins')
    .delete()
    .eq('id', checkinId)
  if (error) throw error
}
