import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export const supabase = supabaseUrl ? createClient(supabaseUrl, supabaseKey) : null

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
  // Uses the most recent save as the "current" one
  const result = {}
  for (const row of data || []) {
    if (!result[row.assessment_type]) {
      result[row.assessment_type] = {
        ...row.answers,
        _summary: row.summary || '',
        _completedAt: row.completed_at
      }
    }
  }
  return result
}

// Get all saved versions of assessments for a client (grouped by type)
export async function getAssessmentHistoryForClient(clientId, assessmentType) {
  const { data, error } = await supabase
    .from('assessments')
    .select('*')
    .eq('client_id', clientId)
    .eq('assessment_type', assessmentType)
    .order('completed_at', { ascending: false })
  if (error) throw error
  return (data || []).map(row => ({
    id: row.id,
    answers: row.answers,
    completedAt: row.completed_at,
    saveLabel: row.summary || 'Assessment 1'
  }))
}

export async function saveAssessment(clientId, assessmentType, answers, saveLabel) {
  const payload = {
    client_id: clientId,
    assessment_type: assessmentType,
    answers: answers,
    summary: saveLabel || 'Assessment 1',
    completed_at: new Date().toISOString()
  }

  // Always insert a new row — each save is a numbered version
  const { error } = await supabase
    .from('assessments')
    .insert(payload)
  if (error) throw error
}

export async function deleteAssessment(assessmentId) {
  const { error } = await supabase
    .from('assessments')
    .delete()
    .eq('id', assessmentId)
  if (error) throw error
}

export async function deleteAllAssessmentsForType(clientId, assessmentType) {
  const { error } = await supabase
    .from('assessments')
    .delete()
    .eq('client_id', clientId)
    .eq('assessment_type', assessmentType)
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

export async function saveWeightLog(clientId, { weight, bodyFat, rating, behaviorNotes, loggedAt }) {
  const { error } = await supabase
    .from('weight_logs')
    .insert({
      client_id: clientId,
      weight: weight || null,
      body_fat: bodyFat || null,
      rating: rating || null,
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
