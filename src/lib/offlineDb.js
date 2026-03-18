// ── OFFLINE-AWARE DATABASE LAYER ──────────────────────────────────────────────
// Wraps Supabase calls: when online, calls Supabase and caches locally.
// When offline, reads from cache and queues writes for later sync.

import {
  supabase,
  getAllClients as _getAllClients,
  saveClient as _saveClient,
  deleteClient as _deleteClient,
  getAssessmentsForClient as _getAssessmentsForClient,
  saveAssessment as _saveAssessment,
  getProgramForClient as _getProgramForClient,
  saveProgram as _saveProgram,
  saveWorkout as _saveWorkout,
  getWorkoutsForClient as _getWorkoutsForClient,
  getWeightLogsForClient as _getWeightLogsForClient,
  saveWeightLog as _saveWeightLog,
  deleteWeightLog as _deleteWeightLog
} from './supabase'

import { addToQueue, cacheData, getCachedData, isOnline, flushQueue, getQueueLength } from './offlineSync'

// ── CLIENTS ──────────────────────────────────────────────────────────────────

export async function getAllClients() {
  if (isOnline() && supabase) {
    try {
      const data = await _getAllClients()
      cacheData('clients', data)
      return data
    } catch (e) {
      console.warn('Online fetch failed, using cache:', e)
    }
  }
  return getCachedData('clients') || []
}

export async function saveClient(client) {
  // Always cache locally
  const clients = getCachedData('clients') || []
  const idx = clients.findIndex(c => c.id === client.id)
  const clientRow = {
    id: client.id, name: client.name, goal: client.goal || '',
    dob: client.dob || '', equipment: client.equipment || '',
    trainer_notes: client.trainerNotes || '',
    updated_at: new Date().toISOString()
  }
  if (idx >= 0) clients[idx] = { ...clients[idx], ...clientRow }
  else clients.unshift(clientRow)
  cacheData('clients', clients)

  if (isOnline() && supabase) {
    try { return await _saveClient(client) } catch (e) {
      console.warn('Save failed, queuing offline:', e)
    }
  }
  addToQueue({ type: 'saveClient', data: { ...client, updatedAt: new Date().toISOString() } })
  return clientRow
}

export async function deleteClient(clientId) {
  const clients = (getCachedData('clients') || []).filter(c => c.id !== clientId)
  cacheData('clients', clients)

  if (isOnline() && supabase) {
    try { return await _deleteClient(clientId) } catch (e) {
      console.warn('Delete failed, queuing offline:', e)
    }
  }
  addToQueue({ type: 'deleteClient', data: { clientId } })
}

// ── ASSESSMENTS ──────────────────────────────────────────────────────────────

export async function getAssessmentsForClient(clientId) {
  if (isOnline() && supabase) {
    try {
      const data = await _getAssessmentsForClient(clientId)
      cacheData(`assessments_${clientId}`, data)
      return data
    } catch (e) { console.warn('Assessments fetch failed, using cache:', e) }
  }
  return getCachedData(`assessments_${clientId}`) || {}
}

export async function saveAssessment(clientId, assessmentType, answers, summary) {
  // Cache locally — add as new version
  const cached = getCachedData(`assessments_${clientId}`) || {}
  const newVersion = { id: 'offline_' + Date.now(), answers, summary: summary || '', completedAt: new Date().toISOString() }
  if (!cached[assessmentType]) {
    cached[assessmentType] = { ...answers, _summary: summary || '', _completedAt: newVersion.completedAt, _versions: [newVersion] }
  } else {
    // Update latest answers and prepend new version
    cached[assessmentType] = { ...cached[assessmentType], ...answers, _summary: summary || '', _completedAt: newVersion.completedAt }
    cached[assessmentType]._versions = [newVersion, ...(cached[assessmentType]._versions || [])]
  }
  cacheData(`assessments_${clientId}`, cached)

  if (isOnline() && supabase) {
    try { return await _saveAssessment(clientId, assessmentType, answers, summary) } catch (e) {
      console.warn('Assessment save failed, queuing:', e)
    }
  }
  addToQueue({ type: 'saveAssessment', data: { clientId, assessmentType, answers, summary, completedAt: new Date().toISOString() } })
}

// ── PROGRAMS ─────────────────────────────────────────────────────────────────

export async function getProgramForClient(clientId) {
  if (isOnline() && supabase) {
    try {
      const data = await _getProgramForClient(clientId)
      if (data) cacheData(`program_${clientId}`, data)
      return data
    } catch (e) { console.warn('Program fetch failed, using cache:', e) }
  }
  return getCachedData(`program_${clientId}`) || null
}

export async function saveProgram(clientId, phases) {
  cacheData(`program_${clientId}`, { client_id: clientId, phases, generated_at: new Date().toISOString() })

  if (isOnline() && supabase) {
    try { return await _saveProgram(clientId, phases) } catch (e) {
      console.warn('Program save failed, queuing:', e)
    }
  }
  addToQueue({ type: 'saveProgram', data: { clientId, phases } })
}

// ── WORKOUTS ─────────────────────────────────────────────────────────────────

export async function getWorkoutsForClient(clientId) {
  if (isOnline() && supabase) {
    try {
      const data = await _getWorkoutsForClient(clientId)
      cacheData(`workouts_${clientId}`, data)
      return data
    } catch (e) { console.warn('Workouts fetch failed, using cache:', e) }
  }
  return getCachedData(`workouts_${clientId}`) || []
}

export async function saveWorkout(clientId, content, prompt) {
  const cached = getCachedData(`workouts_${clientId}`) || []
  cached.unshift({ client_id: clientId, content, prompt, generated_at: new Date().toISOString() })
  cacheData(`workouts_${clientId}`, cached)

  if (isOnline() && supabase) {
    try { return await _saveWorkout(clientId, content, prompt) } catch (e) {
      console.warn('Workout save failed, queuing:', e)
    }
  }
  addToQueue({ type: 'saveWorkout', data: { clientId, content, prompt } })
}

// ── WEIGHT LOGS ──────────────────────────────────────────────────────────────

export async function getWeightLogsForClient(clientId) {
  if (isOnline() && supabase) {
    try {
      const data = await _getWeightLogsForClient(clientId)
      cacheData(`weightlogs_${clientId}`, data)
      return data
    } catch (e) { console.warn('Weight logs fetch failed, using cache:', e) }
  }
  return getCachedData(`weightlogs_${clientId}`) || []
}

export async function saveWeightLog(clientId, logData) {
  const cached = getCachedData(`weightlogs_${clientId}`) || []
  cached.push({ client_id: clientId, ...logData, id: 'offline_' + Date.now(), logged_at: logData.loggedAt || new Date().toISOString() })
  cacheData(`weightlogs_${clientId}`, cached)

  if (isOnline() && supabase) {
    try { return await _saveWeightLog(clientId, logData) } catch (e) {
      console.warn('Weight log save failed, queuing:', e)
    }
  }
  addToQueue({ type: 'saveWeightLog', data: { clientId, ...logData } })
}

export async function deleteWeightLog(logId) {
  // Remove from all cached weight logs
  const keys = Object.keys(localStorage).filter(k => k.startsWith('ff_cache_weightlogs_'))
  keys.forEach(k => {
    try {
      const data = JSON.parse(localStorage.getItem(k) || '[]')
      const filtered = data.filter(w => w.id !== logId)
      localStorage.setItem(k, JSON.stringify(filtered))
    } catch {}
  })

  if (isOnline() && supabase) {
    try { return await _deleteWeightLog(logId) } catch (e) {
      console.warn('Weight log delete failed, queuing:', e)
    }
  }
  addToQueue({ type: 'deleteWeightLog', data: { logId } })
}

// ── SYNC ─────────────────────────────────────────────────────────────────────

export async function syncOfflineData() {
  if (!isOnline() || !supabase) return { flushed: 0, failed: 0 }
  return await flushQueue(supabase)
}

export { getQueueLength, isOnline }
