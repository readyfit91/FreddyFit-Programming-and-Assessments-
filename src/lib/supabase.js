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

// Merges `updatesOrFn` into a client's trainer_notes JSON and saves it. Always re-fetches the
// client's current trainer_notes from the server first — never trusts a local/cached copy —
// because the roster list omits trainer_notes (to reduce egress) and other clients' full data
// may never have loaded locally at all. Without this, "read the local copy, merge, write it
// back" call sites silently erase whatever wasn't loaded locally (e.g. Program Journal weeks,
// sign-in sheet data, a linked client's entire notes).
// `updatesOrFn` is either a plain object to shallow-merge in, or `(freshNotes) => object` when
// the update needs to be computed from the fresh server-side data (e.g. appending to an array).
export async function mergeClientNotes(client, updatesOrFn) {
  let baseNotes = {}
  try {
    const fresh = await getClientById(client.id)
    baseNotes = JSON.parse(fresh?.trainer_notes || '{}')
  } catch {
    try { baseNotes = JSON.parse(client.trainerNotes || '{}') } catch {}
  }
  const updates = typeof updatesOrFn === 'function' ? updatesOrFn(baseNotes) : updatesOrFn
  const merged = { ...baseNotes, ...updates }
  // program_journal is a map of many independent week/phase entries — merge by key instead of
  // replacing the whole map so weeks not loaded in this particular update are never wiped out.
  if (updates.program_journal) {
    merged.program_journal = { ...(baseNotes.program_journal || {}), ...updates.program_journal }
  }
  const updatedClient = { ...client, trainerNotes: JSON.stringify(merged) }
  const saved = await saveClient(updatedClient)
  return { ...updatedClient, id: saved?.id || client.id, trainerNotes: saved?.trainer_notes ?? updatedClient.trainerNotes }
}

// Deletes a top-level key from a client's trainer_notes entirely (unlike mergeClientNotes, which
// only ever adds/merges keys in). Used to migrate a key out of trainer_notes once its data has
// been moved somewhere else, so it stops being resent on every future client save.
export async function removeClientNotesKey(client, key) {
  let baseNotes = {}
  try {
    const fresh = await getClientById(client.id)
    baseNotes = JSON.parse(fresh?.trainer_notes || '{}')
  } catch {
    try { baseNotes = JSON.parse(client.trainerNotes || '{}') } catch {}
  }
  if (!(key in baseNotes)) return null
  delete baseNotes[key]
  const updatedClient = { ...client, trainerNotes: JSON.stringify(baseNotes) }
  const saved = await saveClient(updatedClient)
  return { ...updatedClient, id: saved?.id || client.id, trainerNotes: saved?.trainer_notes ?? updatedClient.trainerNotes }
}

// ── PROGRAM JOURNAL ──────────────────────────────────────────────────────────
// Each week's data, each phase's notes, and each phase's week order used to live as keys inside
// the client's single trainer_notes JSON blob, and every edit re-sent that *entire* blob —
// including every week ever logged — as part of the client save. For clients with years of
// history that payload could exceed the ~4.5MB serverless request body limit on its own, with no
// file involved, causing "Failed to save client (413)". Storing each entry as its own row means
// a save only ever needs to send the one entry that changed, no matter how much history exists.

export async function getProgramJournalForClient(clientId) {
  const { data, error } = await supabase
    .from('program_journal_entries')
    .select('journal_key, data')
    .eq('client_id', clientId)
  if (error) throw error
  const journal = {}
  for (const row of data || []) journal[row.journal_key] = row.data
  return journal
}

export async function saveProgramJournalEntry(clientId, journalKey, data) {
  const { error } = await supabase
    .from('program_journal_entries')
    .upsert({ client_id: clientId, journal_key: journalKey, data, updated_at: new Date().toISOString() }, { onConflict: 'client_id,journal_key' })
  if (error) throw error
}

export async function deleteProgramJournalEntry(clientId, journalKey) {
  const { error } = await supabase
    .from('program_journal_entries')
    .delete()
    .eq('client_id', clientId)
    .eq('journal_key', journalKey)
  if (error) throw error
}

// Uploads a program file (PDF/image) to Supabase Storage instead of embedding it as base64 in
// trainer_notes — a base64 file plus the client's full JSON notes can exceed the ~4.5MB request
// body limit on serverless functions, causing "Failed to save client (413)". Returns just a
// public URL + storage path, which stay small no matter how large the underlying file is.
export async function uploadProgramFile(clientId, file) {
  if (!supabase) throw new Error('Database not configured')
  const ext = file.name.split('.').pop()
  const path = `${clientId}/${Date.now()}-${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('program-files').upload(path, file, {
    contentType: file.type,
    upsert: false
  })
  if (error) throw error
  const { data } = supabase.storage.from('program-files').getPublicUrl(path)
  return { url: data.publicUrl, path, name: file.name, type: file.type }
}

export async function deleteProgramFile(path) {
  if (!supabase || !path) return
  await supabase.storage.from('program-files').remove([path])
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
