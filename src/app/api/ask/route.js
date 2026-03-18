import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '../../../lib/supabase'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Rough token estimate: ~4 chars per token
const MAX_CONTEXT_CHARS = 60000 // ~15k tokens, well under the 30k limit

function trimToFit(text, maxChars) {
  if (text.length <= maxChars) return text
  return text.slice(0, maxChars) + '\n\n[... context trimmed to fit token limits ...]'
}

async function gatherClientContext(clientId, question) {
  const sections = []

  // Client info (small, always include)
  const { data: clientData } = await supabase
    .from('clients').select('*').eq('id', clientId).single()
  if (clientData) {
    sections.push({ key: 'profile', priority: 1, text: `## Client Profile\nName: ${clientData.name}\nGoals: ${clientData.goal || 'Not set'}\nDOB: ${clientData.dob || 'Not set'}\nEquipment: ${clientData.equipment || 'Not set'}` })

    if (clientData.trainer_notes) {
      try {
        const notes = typeof clientData.trainer_notes === 'string'
          ? JSON.parse(clientData.trainer_notes) : clientData.trainer_notes
        const { program_journal, program_file, legacy_notes, ...intake } = notes

        if (Object.keys(intake).length > 0) {
          sections.push({ key: 'intake', priority: 2, text: `## Intake Form Data\n${JSON.stringify(intake, null, 1)}` })
        }

        if (legacy_notes) {
          sections.push({ key: 'legacy', priority: 3, text: `## Previous Software Notes (Legacy)\n${legacy_notes}` })
        }

        if (program_journal) {
          const journalLines = []
          for (const [weekKey, weekData] of Object.entries(program_journal)) {
            if (weekKey.endsWith('_weekorder') || !weekData?.days) continue
            journalLines.push(`\n### ${weekKey}`)
            for (const day of weekData.days) {
              journalLines.push(`\n**Day ${day.dayNum}**${day.date ? ` (${day.date})` : ''}`)
              for (const ex of day.exercises || []) {
                let line = `- ${ex.exercise || '(unnamed)'}: ${ex.sets || '?'} sets x ${ex.reps || '?'} reps`
                if (ex.weight) line += `, ${ex.weight} lbs`
                if (ex.tempo) line += `, tempo ${ex.tempo}`
                if (ex.rpe) line += `, RPE ${ex.rpe}`
                if (ex.notes) line += ` | Notes: ${ex.notes}`
                journalLines.push(line)
                if (ex.setLogs && ex.setLogs.some(s => s && Object.values(s).some(v => v))) {
                  ex.setLogs.forEach((log, si) => {
                    if (!log || !Object.values(log).some(v => v)) return
                    let setLine = `  Set ${si + 1}:`
                    if (log.weight) setLine += ` ${log.weight} lbs`
                    if (log.reps) setLine += ` x ${log.reps} reps`
                    if (log.rpe) setLine += `, RPE ${log.rpe}`
                    if (log.tempo) setLine += `, tempo ${log.tempo}`
                    if (log.cues) setLine += ` | Cues: ${log.cues}`
                    if (log.notes) setLine += ` | Notes: ${log.notes}`
                    journalLines.push(setLine)
                  })
                }
              }
              if (day.dayNotes) journalLines.push(`  Day Notes: ${day.dayNotes}`)
            }
          }
          if (journalLines.length > 0) {
            sections.push({ key: 'journal', priority: 2, text: `## Program Journal (Workout History)${journalLines.join('\n')}` })
          }
        }
      } catch (e) { /* trainer_notes wasn't valid JSON */ }
    }
  }

  // Assessments (all versions)
  const { data: assessments } = await supabase
    .from('assessments').select('*').eq('client_id', clientId)
    .order('completed_at', { ascending: false })
  if (assessments?.length) {
    const assLines = assessments.map(a => {
      let line = `### ${a.assessment_type} (${a.completed_at?.split('T')[0] || 'unknown date'})`
      if (a.summary) line += `\nSummary: ${a.summary}`
      if (a.answers) line += `\nResults: ${JSON.stringify(a.answers, null, 1)}`
      return line
    })
    sections.push({ key: 'assessments', priority: 2, text: `## Assessments\n${assLines.join('\n\n')}` })
  }

  // Weight logs
  const { data: weightLogs } = await supabase
    .from('weight_logs').select('*').eq('client_id', clientId)
    .order('logged_at', { ascending: true })
  if (weightLogs?.length) {
    const wLines = weightLogs.map(w => {
      let line = `${w.logged_at?.split('T')[0] || '?'}: ${w.weight ? w.weight + ' lbs' : ''}`
      if (w.body_fat) line += `, ${w.body_fat}% BF`
      if (w.rating) line += ` (${w.rating})`
      if (w.behavior_notes) line += ` - ${w.behavior_notes}`
      return line
    })
    sections.push({ key: 'weight', priority: 3, text: `## Weight & Body Composition Logs\n${wLines.join('\n')}` })
  }

  // Programs (AI-generated phases)
  const { data: program } = await supabase
    .from('programs').select('*').eq('client_id', clientId)
    .order('generated_at', { ascending: false }).limit(1).single()
  if (program?.phases) {
    const pLines = Object.entries(program.phases).map(([key, val]) => {
      let line = `### ${key === 'p1' ? 'Phase 1 (Months 1-3)' : key === 'p2' ? 'Phase 2 (Months 4-6)' : 'Phase 3 (Months 7-12)'}`
      if (val.equipment) line += `\nEquipment: ${val.equipment}`
      if (val.program) line += `\nProgram: ${val.program.slice(0, 1500)}`
      if (val.trainerNotes) line += `\nTrainer Notes: ${val.trainerNotes}`
      return line
    })
    sections.push({ key: 'program', priority: 3, text: `## AI-Generated Program\n${pLines.join('\n\n')}` })
  }

  // Prioritize sections based on the question
  const q = question.toLowerCase()
  for (const sec of sections) {
    if (sec.key === 'journal' && (q.includes('squat') || q.includes('bench') || q.includes('deadlift') || q.includes('weight') || q.includes('heaviest') || q.includes('workout') || q.includes('session') || q.includes('notes') || q.includes('exercise') || q.includes('rpe') || q.includes('set'))) sec.priority = 1
    if (sec.key === 'assessments' && (q.includes('assess') || q.includes('test') || q.includes('score') || q.includes('mobility') || q.includes('prime') || q.includes('pass') || q.includes('fail'))) sec.priority = 1
    if (sec.key === 'weight' && (q.includes('weight') || q.includes('body fat') || q.includes('lbs') || q.includes('progress') || q.includes('lost') || q.includes('gained'))) sec.priority = 1
    if (sec.key === 'intake' && (q.includes('available') || q.includes('prefer') || q.includes('medication') || q.includes('surgery') || q.includes('injury') || q.includes('doctor') || q.includes('medical') || q.includes('goal') || q.includes('schedule') || q.includes('day'))) sec.priority = 1
    if (sec.key === 'legacy' && (q.includes('previous') || q.includes('old') || q.includes('before') || q.includes('history') || q.includes('legacy'))) sec.priority = 1
  }

  // Sort by priority and build context within budget
  sections.sort((a, b) => a.priority - b.priority)
  let totalChars = 0
  const included = []
  for (const sec of sections) {
    if (totalChars + sec.text.length > MAX_CONTEXT_CHARS) {
      // Try to include a trimmed version
      const remaining = MAX_CONTEXT_CHARS - totalChars
      if (remaining > 500) {
        included.push(trimToFit(sec.text, remaining))
        totalChars += remaining
      }
      break
    }
    included.push(sec.text)
    totalChars += sec.text.length
  }

  return included.join('\n\n---\n\n')
}

export async function POST(request) {
  try {
    const { question, clientId, history = [] } = await request.json()

    if (!question || !clientId) {
      return Response.json({ error: 'Missing question or clientId' }, { status: 400 })
    }

    const context = await gatherClientContext(clientId, question)

    const systemPrompt = `You are an AI assistant for a personal trainer using the FreddyFit platform. You have access to client data including their workout history, assessments, weight logs, intake forms, and program details.

Answer the trainer's questions about their client accurately and concisely. Reference specific data points — dates, weights, RPE, notes, assessment results — when relevant. If the data doesn't contain what's being asked about, say so honestly.

Be direct and useful. You're talking to a trainer, not a client — use professional fitness terminology freely.

Here is the data for this client:

${context}`

    // Keep conversation history short to save tokens
    const recentHistory = history.slice(-4).map(h => ({ role: h.role, content: h.content }))
    const messages = [
      ...recentHistory,
      { role: 'user', content: question }
    ]

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      system: systemPrompt,
      messages
    })

    const text = response.content?.map(b => b.text || '').join('') || ''
    return Response.json({ text })
  } catch (error) {
    console.error('Ask API error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}
