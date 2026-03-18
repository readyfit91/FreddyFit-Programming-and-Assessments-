import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '../../../lib/supabase'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function gatherClientContext(clientId) {
  const parts = []

  // Client info
  const { data: clientData } = await supabase
    .from('clients').select('*').eq('id', clientId).single()
  if (clientData) {
    parts.push(`## Client Profile\nName: ${clientData.name}\nGoals: ${clientData.goal || 'Not set'}\nDOB: ${clientData.dob || 'Not set'}\nEquipment: ${clientData.equipment || 'Not set'}`)

    // Intake form from trainer_notes
    if (clientData.trainer_notes) {
      try {
        const notes = typeof clientData.trainer_notes === 'string'
          ? JSON.parse(clientData.trainer_notes) : clientData.trainer_notes
        // Extract intake data (everything except program_journal, program_file, legacy_notes)
        const { program_journal, program_file, legacy_notes, ...intake } = notes
        if (Object.keys(intake).length > 0) {
          parts.push(`## Intake Form Data\n${JSON.stringify(intake, null, 1)}`)
        }

        // Legacy notes from previous software
        if (legacy_notes) {
          parts.push(`## Previous Software Notes (Legacy)\nThese are notes copied from the trainer's previous software. They may contain old session logs, programs, client history, medical notes, or other relevant data.\n\n${legacy_notes}`)
        }

        // Program journal - extract all workout data
        if (program_journal) {
          const journalLines = []
          for (const [weekKey, weekData] of Object.entries(program_journal)) {
            if (weekKey.endsWith('_weekorder') || !weekData?.days) continue
            // Parse key like "y1_p1_Week 1"
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

                // Per-set logs
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
            parts.push(`## Program Journal (Workout History)${journalLines.join('\n')}`)
          }
        }
      } catch (e) { /* trainer_notes wasn't valid JSON */ }
    }
  }

  // Assessments
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
    parts.push(`## Assessments\n${assLines.join('\n\n')}`)
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
    parts.push(`## Weight & Body Composition Logs\n${wLines.join('\n')}`)
  }

  // Programs (AI-generated phases)
  const { data: program } = await supabase
    .from('programs').select('*').eq('client_id', clientId)
    .order('generated_at', { ascending: false }).limit(1).single()
  if (program?.phases) {
    const pLines = Object.entries(program.phases).map(([key, val]) => {
      let line = `### ${key === 'p1' ? 'Phase 1 (Months 1-3)' : key === 'p2' ? 'Phase 2 (Months 4-6)' : 'Phase 3 (Months 7-12)'}`
      if (val.equipment) line += `\nEquipment: ${val.equipment}`
      if (val.program) line += `\nProgram: ${val.program.slice(0, 2000)}`
      if (val.trainerNotes) line += `\nTrainer Notes: ${val.trainerNotes}`
      return line
    })
    parts.push(`## AI-Generated Program\n${pLines.join('\n\n')}`)
  }

  return parts.join('\n\n---\n\n')
}

export async function POST(request) {
  try {
    const { question, clientId, history = [] } = await request.json()

    if (!question || !clientId) {
      return Response.json({ error: 'Missing question or clientId' }, { status: 400 })
    }

    const context = await gatherClientContext(clientId)

    const systemPrompt = `You are an AI assistant for a personal trainer using the FreddyFit platform. You have access to complete client data including their workout history, assessments, weight logs, intake forms, and program details.

Answer the trainer's questions about their client accurately and concisely. Reference specific data points — dates, weights, RPE, notes, assessment results — when relevant. If the data doesn't contain what's being asked about, say so honestly.

Be direct and useful. You're talking to a trainer, not a client — use professional fitness terminology freely.

Here is all the data for this client:

${context}`

    // Build messages array with conversation history
    const messages = [
      ...history.map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: question }
    ]

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
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
