// ── OFFLINE SYNC QUEUE ────────────────────────────────────────────────────────
// Queues Supabase writes when offline, replays them when back online.
// All data is cached locally so the app stays functional without internet.

const QUEUE_KEY = 'ff_offline_queue'
const CACHE_PREFIX = 'ff_cache_'

// ── Queue Management ─────────────────────────────────────────────────────────

function getQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]') }
  catch { return [] }
}

function saveQueue(queue) {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(queue)) } catch {}
}

export function addToQueue(action) {
  const queue = getQueue()
  queue.push({ ...action, id: Date.now() + '_' + Math.random().toString(36).slice(2, 8), createdAt: new Date().toISOString() })
  saveQueue(queue)
}

export function getQueueLength() {
  return getQueue().length
}

export function isOnline() {
  return typeof navigator !== 'undefined' ? navigator.onLine : true
}

// ── Local Data Cache ─────────────────────────────────────────────────────────
// Mirror of Supabase data in localStorage so reads work offline

export function cacheData(key, data) {
  try { localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(data)) } catch {}
}

export function getCachedData(key) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

// ── Flush Queue (replay all pending writes) ──────────────────────────────────

export async function flushQueue(supabase) {
  if (!isOnline() || !supabase) return { flushed: 0, failed: 0 }

  const queue = getQueue()
  if (queue.length === 0) return { flushed: 0, failed: 0 }

  let flushed = 0
  let failed = 0
  const remaining = []

  for (const action of queue) {
    try {
      await replayAction(supabase, action)
      flushed++
    } catch (e) {
      console.error('Offline sync failed for action:', action.type, e)
      // Keep failed items in queue to retry later (but not forever)
      const retries = (action.retries || 0) + 1
      if (retries < 5) {
        remaining.push({ ...action, retries })
      } else {
        console.warn('Dropping action after 5 retries:', action)
      }
      failed++
    }
  }

  saveQueue(remaining)
  return { flushed, failed }
}

async function replayAction(supabase, action) {
  switch (action.type) {
    case 'saveClient': {
      const { error } = await supabase
        .from('clients')
        .upsert({
          id: action.data.id,
          name: action.data.name,
          goal: action.data.goal || '',
          dob: action.data.dob || '',
          equipment: action.data.equipment || '',
          trainer_notes: action.data.trainerNotes || '',
          updated_at: action.data.updatedAt || new Date().toISOString()
        })
        .select().single()
      if (error) throw error
      break
    }
    case 'saveAssessment': {
      const payload = {
        client_id: action.data.clientId,
        assessment_type: action.data.assessmentType,
        answers: action.data.answers,
        summary: action.data.summary || '',
        completed_at: action.data.completedAt || new Date().toISOString()
      }
      const { error } = await supabase.from('assessments').insert(payload)
      if (error) throw error
      break
    }
    case 'saveWeightLog': {
      const { error } = await supabase.from('weight_logs').insert({
        client_id: action.data.clientId,
        weight: action.data.weight || null,
        body_fat: action.data.bodyFat || null,
        rating: action.data.rating || null,
        behavior_notes: action.data.behaviorNotes || '',
        logged_at: action.data.loggedAt || new Date().toISOString()
      })
      if (error) throw error
      break
    }
    case 'deleteWeightLog': {
      const { error } = await supabase.from('weight_logs').delete().eq('id', action.data.logId)
      if (error) throw error
      break
    }
    case 'saveProgram': {
      await supabase.from('programs').delete().eq('client_id', action.data.clientId)
      const { error } = await supabase.from('programs').insert({
        client_id: action.data.clientId,
        phases: action.data.phases,
        generated_at: new Date().toISOString()
      })
      if (error) throw error
      break
    }
    case 'saveWorkout': {
      const { error } = await supabase.from('workouts').insert({
        client_id: action.data.clientId,
        content: action.data.content,
        prompt: action.data.prompt,
        generated_at: new Date().toISOString()
      })
      if (error) throw error
      break
    }
    case 'deleteClient': {
      const { error } = await supabase.from('clients').delete().eq('id', action.data.clientId)
      if (error) throw error
      break
    }
    default:
      console.warn('Unknown offline action type:', action.type)
  }
}
