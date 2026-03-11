'use client'
import { useState, useEffect, useCallback } from 'react'
import { getAllClients, saveClient, deleteClient, getAssessmentsForClient, saveAssessment, getProgramForClient, saveProgram, saveWorkout, getWorkoutsForClient } from '../lib/supabase'
import { ALL_ASSESSMENTS, MAIN_ASSESSMENTS, C } from '../lib/assessments'

const makeId = () => Math.random().toString(36).slice(2,10)

// ── HELPERS ──────────────────────────────────────────────────────────────────
async function callClaude(messages, maxTokens = 1000) {
  const res = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messages, maxTokens })
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return data.text
}

// ── SHARED UI ─────────────────────────────────────────────────────────────────
function LogoHeader() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', background: '#FFFFFF', padding: '16px 0', marginBottom: 16, borderBottom: `1px solid ${C.border}` }}>
      <img src="/logo.png" alt="FreddyFit" style={{ maxWidth: 240, width: '100%', height: 'auto' }} />
    </div>
  )
}

function Spinner() {
  return <div style={{display:'flex',justifyContent:'center',padding:40}}>
    <div style={{width:32,height:32,border:`3px solid ${C.border}`,borderTop:`3px solid ${C.accent}`,borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>
}

function Btn({onClick,children,color=C.accent,outline=false,small=false,disabled=false}) {
  const bg = outline ? 'transparent' : (disabled ? '#CBD5E0' : color)
  const clr = outline ? color : '#000'
  const pad = small ? '7px 14px' : '11px 22px'
  return <button onClick={onClick} disabled={disabled} style={{padding:pad,borderRadius:8,border:`1.5px solid ${outline?color:bg}`,background:bg,color:clr,fontFamily:'Montserrat,sans-serif',fontWeight:700,fontSize:small?11:13,cursor:disabled?'not-allowed':'pointer',letterSpacing:.5,transition:'opacity .15s',opacity:disabled?.5:1}}>{children}</button>
}

// ── ASSESSMENT FORM ───────────────────────────────────────────────────────────
function AssessmentForm({ assessment, client, onComplete, onBack }) {
  const [answers, setAnswers] = useState({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (client.assessments?.[assessment.id]) {
      setAnswers(client.assessments[assessment.id])
      setSaved(true)
    }
  }, [assessment.id, client.assessments])

  const allFields = assessment.sections.flatMap(s => s.fields)
  const answered = allFields.filter(f => answers[f.id]?.toString().trim()).length
  const progress = Math.round((answered / allFields.length) * 100)
  const set = (id, val) => setAnswers(a => ({ ...a, [id]: val }))

  // Auto-calculate BMS-5 performance level based on gender, age range, and total score
  useEffect(() => {
    if (assessment.id !== 'bms5') return
    const gender = answers.bms_gender
    const age = answers.bms_age_range
    const score = parseInt(answers.bms_total_score)
    if (!gender || !age || isNaN(score)) return

    const grid = {
      Male: {
        '18–39': [10, 11, 12, 13, 14],
        '40–49': [9, 10, 11, 12, 13],
        '50–59': [8, 9, 10, 11, 12],
        '60+':   [7, 8, 9, 10, 11],
      },
      Female: {
        '18–39': [11, 12, 13, 14, 15],
        '40–49': [10, 11, 12, 13, 14],
        '50–59': [9, 10, 11, 12, 13],
        '60+':   [8, 9, 10, 11, 12],
      }
    }
    const levels = ['Poor', 'Below Average', 'Average', 'Above Average', 'Excellent']
    const thresholds = grid[gender]?.[age]
    if (!thresholds) return

    let level = 'Poor'
    if (score >= thresholds[4]) level = 'Excellent'
    else if (score >= thresholds[3]) level = 'Above Average'
    else if (score >= thresholds[2]) level = 'Average'
    else if (score >= thresholds[1]) level = 'Below Average'
    else level = 'Poor'

    if (answers.bms_level !== level) {
      setAnswers(a => ({ ...a, bms_level: level }))
    }
  }, [assessment.id, answers.bms_gender, answers.bms_age_range, answers.bms_total_score])

  const saveAssessmentData = async () => {
    setSaving(true)
    try {
      const completed = { ...answers, _completedAt: new Date().toISOString() }
      await saveAssessment(client.id, assessment.id, answers, '')
      onComplete(assessment.id, completed)
      setSaved(true)
    } catch (e) {
      alert('Error saving: ' + e.message)
    }
    setSaving(false)
  }

  const renderField = (f) => {
    const val = answers[f.id] || ''
    const base = { width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontFamily: 'Montserrat,sans-serif', fontSize: 13, color: C.text, outline: 'none', background: C.faint }
    if (f.type === 'textarea') return <textarea value={val} onChange={e => set(f.id, e.target.value)} rows={3} style={{ ...base, resize: 'vertical' }} placeholder={f.placeholder || ''} />
    if (f.type === 'passfail') return (
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {f.options.map(o => <button key={o} onClick={() => set(f.id, o)} style={{ padding: '8px 16px', borderRadius: 7, border: `1.5px solid ${val === o ? C.accent : C.border}`, background: val === o ? C.accent + '20' : 'white', color: val === o ? C.accent : C.sub, fontFamily: 'Montserrat,sans-serif', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>{o}</button>)}
      </div>
    )
    if (f.type === 'scale') return (
      <div>
        <input type="range" min={f.min || 0} max={f.max || 10} value={val || f.min || 0} onChange={e => set(f.id, e.target.value)} style={{ width: '100%', accentColor: C.accent }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.sub }}><span>{f.min ?? 0}</span><span style={{ fontWeight: 700, color: C.accent }}>{val || f.min || 0}</span><span>{f.max ?? 10}</span></div>
      </div>
    )
    return <input type="text" value={val} onChange={e => set(f.id, e.target.value)} placeholder={f.placeholder || ''} style={base} />
  }

  const renderRatingAndModifier = (f) => {
    if (f.type === 'textarea' || f.type === 'scale') return null
    const ratingKey = `${f.id}_rating`
    const modKey = `${f.id}_modifier`
    const modConfirmedKey = `${f.id}_mod_confirmed`
    const rating = answers[ratingKey]
    const modifier = answers[modKey]
    const modConfirmed = answers[modConfirmedKey]
    const ratingNum = parseInt(rating)
    const isFail = rating && ratingNum <= 7
    const isPass = rating && ratingNum >= 8
    const ratingColor = !rating ? C.sub : isFail ? C.red : C.green

    return (
      <div style={{ marginTop: 10, background: C.faint, borderRadius: 10, padding: '12px 14px', border: `1px solid ${C.border}` }}>

        {/* Rate this test */}
        <div style={{ marginBottom: rating ? 12 : 0 }}>
          <div style={{ fontSize: 10, color: C.sub, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Step 1 — Rate this test (1–10)</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {[1,2,3,4,5,6,7,8,9,10].map(n => {
              const isSelected = ratingNum === n
              const btnFail = n <= 7
              return (
                <button key={n} onClick={() => {
                  set(ratingKey, n.toString())
                  set(modKey, '')
                  set(modConfirmedKey, '')
                }} style={{
                  width: 32, height: 32, borderRadius: 7,
                  border: `1.5px solid ${isSelected ? (btnFail ? C.red : C.green) : C.border}`,
                  background: isSelected ? (btnFail ? C.red : C.green) : 'white',
                  color: isSelected ? 'white' : btnFail ? C.red : C.green,
                  fontFamily: 'Montserrat,sans-serif', fontWeight: 800, fontSize: 12,
                  cursor: 'pointer'
                }}>{n}</button>
              )
            })}
          </div>
          {rating && (
            <div style={{ fontSize: 11, marginTop: 6, fontWeight: 800, color: ratingColor }}>
              {isFail ? `✗ FAIL — ${rating}/10` : `✓ PASS — ${rating}/10`}
            </div>
          )}
        </div>

        {/* FAIL NOTES — clinical decision notes from uploaded protocols */}
        {isFail && f.failNotes && (
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: C.orange, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>📋 What To Do Next</div>
            <div style={{ background: C.orange + '08', border: `1px solid ${C.orange}22`, borderRadius: 10, padding: '12px 16px' }}>
              <pre style={{ fontSize: 12, lineHeight: 1.7, color: C.text, whiteSpace: 'pre-wrap', fontFamily: 'Montserrat,sans-serif', margin: 0 }}>{f.failNotes}</pre>
            </div>
          </div>
        )}

        {/* MODIFIER DROPDOWN — select which modifier helped */}
        {isFail && f.modifiers && f.modifiers.length > 0 && (
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12, marginBottom: modifier ? 12 : 0 }}>
            <div style={{ fontSize: 10, color: C.red, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Step 2 — Which modifier helped?</div>
            <select value={modifier || ''} onChange={e => {
              set(modKey, e.target.value)
              set(modConfirmedKey, '')
            }} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1.5px solid ${modifier ? C.accent : C.red + '66'}`, background: 'white', color: modifier ? C.text : C.sub, fontFamily: 'Montserrat,sans-serif', fontSize: 13, outline: 'none', cursor: 'pointer' }}>
              <option value="">— Select the modifier that helped —</option>
              {f.modifiers.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        )}

        {/* CONFIRM — did it work? (only if modifier selected and not "No modifier helped") */}
        {isFail && modifier && modifier !== 'No modifier helped' && (
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
            <div style={{ fontSize: 10, color: C.accent, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Step 3 — Did <span style={{ color: C.accent }}>{modifier.split('→')[0].trim()}</span> improve the test?</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => set(modConfirmedKey, 'yes')} style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: `1.5px solid ${modConfirmed === 'yes' ? C.green : C.border}`, background: modConfirmed === 'yes' ? C.green : 'white', color: modConfirmed === 'yes' ? 'white' : C.green, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>✓ Yes — it worked</button>
              <button onClick={() => set(modConfirmedKey, 'no')} style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: `1.5px solid ${modConfirmed === 'no' ? C.red : C.border}`, background: modConfirmed === 'no' ? C.red : 'white', color: modConfirmed === 'no' ? 'white' : C.red, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>✗ No — try another</button>
            </div>
            {modConfirmed === 'yes' && (
              <div style={{ marginTop: 8, padding: '8px 12px', background: C.green + '12', borderRadius: 8, border: `1px solid ${C.green}44`, fontSize: 11, color: C.green, fontWeight: 700 }}>
                ✓ Recorded: <strong>{modifier}</strong>
              </div>
            )}
            {modConfirmed === 'no' && (
              <div style={{ marginTop: 8, padding: '8px 12px', background: C.orange + '12', borderRadius: 8, border: `1px solid ${C.orange}44`, fontSize: 11, color: C.orange, fontWeight: 700 }}>
                Select a different modifier above ↑
              </div>
            )}
          </div>
        )}

        {/* No modifier helped — flag it */}
        {isFail && modifier === 'No modifier helped' && (
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
            <div style={{ padding: '8px 12px', background: C.red + '10', borderRadius: 8, border: `1px solid ${C.red}33`, fontSize: 11, color: C.red, fontWeight: 700 }}>
              ✗ Recorded: No modifier helped — flag for deeper investigation / breakout assessments
            </div>
          </div>
        )}

        {/* Pass — no corrective needed */}
        {isPass && (
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
            <div style={{ fontSize: 11, color: C.green, fontWeight: 700 }}>✓ Pass — no corrective needed for this test</div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 24px 32px' }}>
      <LogoHeader />
      <button onClick={onBack} style={{ background: 'none', border: `1px solid ${C.border}`, color: C.sub, borderRadius: 7, padding: '6px 14px', fontSize: 12, cursor: 'pointer', marginBottom: 24 }}>← Back</button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
        <span style={{ fontSize: 32 }}>{assessment.icon}</span>
        <div>
          <div style={{ fontWeight: 800, fontSize: 22, letterSpacing: 2, color: C.text }}>{assessment.name}</div>
          <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>Client: {client.name} · {answered}/{allFields.length} fields · {progress}%</div>
        </div>
      </div>
      <div style={{ background: C.border, borderRadius: 4, height: 4, marginBottom: 28 }}>
        <div style={{ width: `${progress}%`, background: assessment.color, height: 4, borderRadius: 4, transition: 'width .3s' }} />
      </div>

      {assessment.sections.map(s => (
        <div key={s.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px 22px', marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: assessment.color, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 16 }}>{s.title}</div>
          {s.fields.map(f => {
            // Hide lying squat sub-questions when "Not needed" is selected
            const lyingSubFields = ['bms_sq_lying_arms','bms_sq_lying_knees','bms_sq_lying_ankles','bms_sq_lying_result']
            if (lyingSubFields.includes(f.id) && answers.bms_sq_lying !== 'Yes — performed') return null
            return (
            <div key={f.id} style={{ marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${C.faint}` }}>
              <label style={{ display: 'block', fontSize: 12, color: C.sub, marginBottom: 6, fontWeight: 600 }}>{f.label}</label>
              {renderField(f)}
              {assessment.id !== 'bms5' && assessment.id !== 'hypermobility' && renderRatingAndModifier(f)}
              {f.type === 'scale' && f.failNotes && answers[f.id] && (
                <div style={{ marginTop: 10, background: parseInt(answers[f.id]) >= 7 ? C.red + '08' : C.accent + '08', border: `1px solid ${parseInt(answers[f.id]) >= 7 ? C.red : C.accent}22`, borderRadius: 10, padding: '12px 16px' }}>
                  <div style={{ fontSize: 10, color: parseInt(answers[f.id]) >= 7 ? C.red : C.accent, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>📋 Trainer Script</div>
                  <pre style={{ fontSize: 11, lineHeight: 1.7, color: C.text, whiteSpace: 'pre-wrap', fontFamily: "'Courier New', Courier, monospace", margin: 0, overflowX: 'auto' }}>{f.failNotes}</pre>
                </div>
              )}
              {f.type === 'textarea' && f.failNotes && (
                <div style={{ marginTop: 10, background: C.accent + '08', border: `1px solid ${C.accent}22`, borderRadius: 10, padding: '12px 16px' }}>
                  <div style={{ fontSize: 10, color: C.accent, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>📋 Trainer Script</div>
                  <pre style={{ fontSize: 12, lineHeight: 1.7, color: C.text, whiteSpace: 'pre-wrap', fontFamily: 'Montserrat,sans-serif', margin: 0 }}>{f.failNotes}</pre>
                </div>
              )}
            </div>
          )})}
        </div>
      ))}

      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
        <Btn onClick={saveAssessmentData} disabled={saving}>{saving ? 'Saving...' : saved ? '✓ Saved — Tap to Re-save' : '💾 Save Assessment'}</Btn>
      </div>
    </div>
  )
}

// ── WORKOUT GENERATOR ─────────────────────────────────────────────────────────
function WorkoutGenerator({ client, onBack }) {
  const [equipment, setEquipment] = useState(client.equipment || '')
  const [movements, setMovements] = useState('')
  const [programDetails, setProgramDetails] = useState('')
  const [blockMonths, setBlockMonths] = useState('1-3')
  const [workout, setWorkout] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [pastWorkouts, setPastWorkouts] = useState([])
  const [showPast, setShowPast] = useState(false)

  useEffect(() => {
    getWorkoutsForClient(client.id).then(setPastWorkouts).catch(() => {})
  }, [client.id])

  const assessmentContext = Object.entries(client.assessments || {}).map(([id, data]) => {
    const a = ALL_ASSESSMENTS[id]
    if (!a) return ''
    const fields = a.sections.flatMap(s => s.fields)
    const qa = fields.map(f => {
      const base = `  ${f.label}: ${data[f.id] || '(not recorded)'}`
      const rating = data[`${f.id}_rating`]
      const modifier = data[`${f.id}_modifier`]
      const confirmed = data[`${f.id}_mod_confirmed`]
      const ratingStr = rating ? ` | Rating: ${rating}/10 ${parseInt(rating) <= 7 ? '(FAIL)' : '(PASS)'}` : ''
      const modStr = modifier ? ` | Modifier: ${modifier}${confirmed === 'yes' ? ' [CONFIRMED WORKING]' : confirmed === 'no' ? ' [DID NOT HELP]' : ''}` : ''
      return base + ratingStr + modStr
    }).join('\n')
    return `${a.name}:\n${qa}`
  }).filter(Boolean).join('\n\n') || 'No assessments completed yet.'

  const EQUIPMENT_OPTIONS = [
    'Barbell', 'Dumbbells', 'Kettlebells', 'Cable Machine', 'Resistance Bands',
    'TRX / Suspension', 'Smith Machine', 'Leg Press', 'Pull-up Bar',
    'Bench (flat/incline)', 'Foam Roller', 'Stability Ball', 'Medicine Ball',
    'Bodyweight Only', 'Landmine', 'Trap Bar'
  ]

  const MOVEMENT_OPTIONS = [
    'Squat Pattern', 'Hip Hinge', 'Lunge / Split Stance', 'Push (horizontal)',
    'Push (vertical)', 'Pull (horizontal)', 'Pull (vertical)', 'Carry / Loaded Walk',
    'Rotation / Anti-rotation', 'Single-Leg Balance', 'Core / Bracing',
    'Plyometrics', 'Corrective / Mobility'
  ]

  const toggleChip = (current, setCurrent, value) => {
    const arr = current ? current.split(', ').filter(Boolean) : []
    if (arr.includes(value)) setCurrent(arr.filter(v => v !== value).join(', '))
    else setCurrent([...arr, value].join(', '))
  }

  const isSelected = (current, value) => {
    const arr = current ? current.split(', ') : []
    return arr.includes(value)
  }

  const generate = async () => {
    if (!movements.trim() && !programDetails.trim()) { setError('Select at least some movements or add program details.'); return }
    setGenerating(true); setError(''); setWorkout('')
    try {
      const text = await callClaude([{ role: 'user', content: `You are an expert personal trainer. Generate a detailed, well-organized training block for:

CLIENT: ${client.name}
GOAL: ${client.goal || 'Not specified'}
TRAINING BLOCK: Months ${blockMonths} (3-month block)

═══ EQUIPMENT AVAILABLE ═══
${equipment || 'Not specified'}

═══ FUNCTIONAL MOVEMENTS REQUESTED ═══
${movements || 'Trainer discretion based on assessment findings'}

═══ PROGRAM REQUESTS ═══
${programDetails || 'Trainer discretion'}

═══ ASSESSMENT FINDINGS & CONFIRMED MODIFIERS ═══
${assessmentContext}

IMPORTANT INSTRUCTIONS:
- Use the assessment findings to shape the program. If a test FAILED, reference the confirmed modifier/protocol in the corrective warm-up.
- If a modifier was confirmed working, prescribe it as a warm-up exercise with sets x reps.
- Flag any contraindications or pain from the assessments.
- Do NOT invent findings — only reference what is in the data above.

FORMAT THE OUTPUT EXACTLY LIKE THIS — clean, spaced out, organized:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TRAINING BLOCK: MONTHS ${blockMonths}
Client: ${client.name}
Goal: ${client.goal || 'General fitness'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CLIENT NOTES
(Any contraindications, pain flags, or movement restrictions from assessments — written for the client to understand)

───────────────────────────────────
CORRECTIVE WARM-UP (Every Session)
───────────────────────────────────
(Pull directly from confirmed modifiers/protocols in assessment findings. List each with sets x reps x tempo.)

For each training day, format like this:

═══════════════════════════════════
DAY 1 — [Day Name]
═══════════════════════════════════

WARM-UP ACTIVATION
  1. Exercise Name
     → Sets x Reps | Tempo | Rest
     → Cue: [coaching cue]

MAIN WORK
  A1. Exercise Name
      → Sets x Reps | Load guidance | Rest
      → Cue: [coaching cue]
      → Why: [brief reason from assessment]

  A2. Exercise Name (superset with A1)
      → Sets x Reps | Load guidance | Rest

ACCESSORY WORK
  B1. Exercise Name
      → Sets x Reps | Rest
  B2. Exercise Name
      → Sets x Reps | Rest

FINISHER / CONDITIONING
  → Description | Duration

───────────────────────────────────

(Repeat for each training day)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROGRESSION PLAN (Over the 3 months)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Month 1: [focus]
Month 2: [progression]
Month 3: [target]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TRAINER NOTES (INTERNAL — DO NOT SHOW CLIENT)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
(Flags, concerns, reassessment notes, things to watch for)

Be specific. Reference actual assessment findings and confirmed protocols. Make it print-ready.` }], 6000)
      setWorkout(text)
    } catch (e) { setError('Error: ' + e.message) }
    setGenerating(false)
  }

  const saveCurrentWorkout = async () => {
    if (!workout) return
    const promptSummary = `Block: Months ${blockMonths} | Equipment: ${equipment} | Movements: ${movements} | Details: ${programDetails}`
    await saveWorkout(client.id, workout, promptSummary)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    const updated = await getWorkoutsForClient(client.id)
    setPastWorkouts(updated)
  }

  const printWorkout = () => window.print()

  const inputBox = { width: '100%', background: C.faint, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 16px', color: C.text, fontSize: 13, fontFamily: 'Montserrat,sans-serif', outline: 'none', resize: 'vertical' }
  const sectionLabel = { display: 'block', fontSize: 10, color: C.sub, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700, marginBottom: 10 }
  const chipStyle = (selected) => ({ padding: '7px 14px', borderRadius: 20, border: `1.5px solid ${selected ? C.accent : C.border}`, background: selected ? C.accent + '18' : 'white', color: selected ? C.accent : C.sub, fontFamily: 'Montserrat,sans-serif', fontWeight: 600, fontSize: 11, cursor: 'pointer', transition: 'all .15s' })

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 24px 32px' }}>
      <LogoHeader />
      <button onClick={onBack} style={{ background: 'none', border: `1px solid ${C.border}`, color: C.sub, borderRadius: 7, padding: '6px 14px', fontSize: 12, cursor: 'pointer', marginBottom: 24 }}>← Back to Client</button>
      <div style={{ fontWeight: 800, fontSize: 26, letterSpacing: 3, color: C.text, marginBottom: 4 }}>{client.name}</div>
      <div style={{ fontSize: 12, color: C.sub, marginBottom: 24 }}>Workout Generator · {Object.keys(client.assessments || {}).length} assessments on file</div>

      {Object.keys(client.assessments || {}).length > 0 && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 18px', marginBottom: 20 }}>
          <div style={{ fontSize: 10, color: C.sub, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>Assessments on File</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {Object.keys(client.assessments || {}).map(id => {
              const a = ALL_ASSESSMENTS[id]
              return a ? <span key={id} style={{ background: a.colorDim, border: `1px solid ${a.color}44`, borderRadius: 20, padding: '3px 12px', fontSize: 11, color: a.color, fontWeight: 600 }}>{a.icon} {a.name}</span> : null
            })}
          </div>
        </div>
      )}

      {/* BLOCK SELECTOR */}
      <div style={{ background: C.card, border: `1px solid ${C.accent}44`, borderRadius: 14, padding: '22px 24px', marginBottom: 16 }}>
        <label style={sectionLabel}>Training Block</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { value: '1-3', label: 'Months 1–3', sublabel: 'Foundation' },
            { value: '4-6', label: 'Months 4–6', sublabel: 'Development' },
            { value: '7-9', label: 'Months 7–9', sublabel: 'Performance' },
            { value: '10-12', label: 'Months 10–12', sublabel: 'Peak' },
          ].map(b => (
            <button key={b.value} onClick={() => setBlockMonths(b.value)} style={{
              flex: '1 1 120px', padding: '12px 16px', borderRadius: 10,
              border: `2px solid ${blockMonths === b.value ? C.accent : C.border}`,
              background: blockMonths === b.value ? C.accent + '12' : 'white',
              cursor: 'pointer', textAlign: 'left'
            }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: blockMonths === b.value ? C.accent : C.text, letterSpacing: 1 }}>{b.label}</div>
              <div style={{ fontSize: 10, color: C.sub, marginTop: 2 }}>{b.sublabel}</div>
            </button>
          ))}
        </div>
      </div>

      {/* EQUIPMENT BOX */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '22px 24px', marginBottom: 16 }}>
        <label style={sectionLabel}>Equipment Available</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {EQUIPMENT_OPTIONS.map(eq => (
            <button key={eq} onClick={() => toggleChip(equipment, setEquipment, eq)} style={chipStyle(isSelected(equipment, eq))}>{eq}</button>
          ))}
        </div>
        <input type="text" value={equipment} onChange={e => setEquipment(e.target.value)} placeholder="Or type custom equipment..." style={{ ...inputBox, resize: 'none', padding: '10px 14px' }} />
      </div>

      {/* MOVEMENTS BOX */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '22px 24px', marginBottom: 16 }}>
        <label style={sectionLabel}>Main Functional Movements</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {MOVEMENT_OPTIONS.map(mv => (
            <button key={mv} onClick={() => toggleChip(movements, setMovements, mv)} style={chipStyle(isSelected(movements, mv))}>{mv}</button>
          ))}
        </div>
        <input type="text" value={movements} onChange={e => setMovements(e.target.value)} placeholder="Or type custom movements..." style={{ ...inputBox, resize: 'none', padding: '10px 14px' }} />
      </div>

      {/* PROGRAM REQUESTS BOX */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '22px 24px', marginBottom: 16 }}>
        <label style={sectionLabel}>Program Requests</label>
        <div style={{ fontSize: 11, color: C.sub, marginBottom: 10 }}>Sets, reps, tempo, accessories, session duration, training days per week, or anything else important</div>
        <textarea value={programDetails} onChange={e => setProgramDetails(e.target.value)} rows={4} placeholder="e.g. 4 sets x 8-12 reps, 60s rest, include face pulls as accessory, 3 days/week, 45 min sessions, superset format..." style={inputBox} />
      </div>

      {/* GENERATE */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, padding: '0 4px' }}>
        <div style={{ fontSize: 11, color: C.sub }}>Uses your assessment findings, confirmed modifiers & protocol notes to build the program</div>
        <Btn onClick={generate} disabled={generating}>{generating ? '⏳ Generating...' : '⚡ Generate Training Block'}</Btn>
      </div>

      {error && <div style={{ background: C.red + '12', border: `1px solid ${C.red}44`, borderRadius: 10, padding: '12px 16px', fontSize: 13, color: C.red, marginBottom: 16 }}>{error}</div>}
      {generating && <><Spinner /><div style={{ textAlign: 'center', fontSize: 12, color: C.sub, marginTop: 4 }}>Building your training block from assessment data...</div></>}

      {workout && (
        <div style={{ background: C.card, border: `2px solid ${C.accent}44`, borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ background: `linear-gradient(135deg,${C.accent}18,${C.accent}08)`, borderBottom: `1px solid ${C.accent}33`, padding: '16px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14, letterSpacing: 2, color: C.accent }}>TRAINING BLOCK — MONTHS {blockMonths}</div>
              <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>{client.name} · Generated {new Date().toLocaleDateString()}</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn onClick={saveCurrentWorkout} outline small color={C.accent}>{saved ? '✓ Saved' : '💾 Save'}</Btn>
              <Btn onClick={printWorkout} small>🖨 Print / PDF</Btn>
            </div>
          </div>
          <div style={{ padding: 24 }}>
            <pre style={{ fontSize: 12, lineHeight: 2, color: C.text, whiteSpace: 'pre-wrap', fontFamily: 'Montserrat,sans-serif', margin: 0 }}>{workout}</pre>
          </div>
          <div style={{ borderTop: `1px solid ${C.border}`, padding: '14px 22px', background: C.faint }}>
            <details>
              <summary style={{ fontSize: 11, color: C.sub, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif', fontWeight: 600 }}>Edit raw output</summary>
              <textarea value={workout} onChange={e => setWorkout(e.target.value)} rows={30} style={{ width: '100%', background: 'white', border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, color: C.text, fontSize: 12, fontFamily: 'Courier New,monospace', lineHeight: 1.8, outline: 'none', resize: 'vertical', marginTop: 10 }} />
            </details>
          </div>
        </div>
      )}

      {pastWorkouts.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <button onClick={() => setShowPast(!showPast)} style={{ background: 'none', border: 'none', color: C.sub, fontSize: 12, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif', fontWeight: 600 }}>{showPast ? '▼' : '▶'} Past Training Blocks ({pastWorkouts.length})</button>
          {showPast && pastWorkouts.map(w => (
            <div key={w.id} style={{ marginTop: 10, background: C.faint, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 18px' }}>
              <div style={{ fontSize: 11, color: C.sub, marginBottom: 6, fontWeight: 600 }}>{new Date(w.generated_at).toLocaleDateString()} · {w.prompt}</div>
              <pre style={{ fontSize: 11, color: C.text, whiteSpace: 'pre-wrap', fontFamily: 'Montserrat,sans-serif', lineHeight: 1.7, margin: 0 }}>{w.content.slice(0, 400)}...</pre>
              <button onClick={() => setWorkout(w.content)} style={{ marginTop: 10, background: 'none', border: `1px solid ${C.accent}`, color: C.accent, borderRadius: 6, padding: '5px 14px', fontSize: 11, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif', fontWeight: 600 }}>Load this block</button>
            </div>
          ))}
        </div>
      )}

      <style>{`@media print { .no-print { display: none !important; } }`}</style>
    </div>
  )
}

// ── PROGRAM BUILDER ───────────────────────────────────────────────────────────
function ProgramBuilder({ client, onBack, onSave }) {
  const PHASES = [
    { id: 'p1', label: 'MONTHS 1–3', sublabel: 'Foundation', color: C.teal },
    { id: 'p2', label: 'MONTHS 4–6', sublabel: 'Development', color: C.accent },
    { id: 'p3', label: 'MONTHS 7–12', sublabel: 'Performance', color: C.orange },
  ]
  const [program, setProgram] = useState({ phases: { p1: { equipment: '', program: '', trainerNotes: '' }, p2: { equipment: '', program: '', trainerNotes: '' }, p3: { equipment: '', program: '', trainerNotes: '' } }, generatedAt: null })
  const [generating, setGenerating] = useState(false)
  const [expanded, setExpanded] = useState('p1')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getProgramForClient(client.id).then(p => {
      if (p) setProgram({ phases: p.phases, generatedAt: p.generated_at })
    }).catch(() => {})
  }, [client.id])

  const assessmentSummaries = Object.entries(client.assessments || {}).map(([id, data]) => {
    const a = ALL_ASSESSMENTS[id]
    if (!a) return ''
    const fields = a.sections.flatMap(s => s.fields)
    const qa = fields.map(f => {
      const base = `${f.label}: ${data[f.id] || '(not recorded)'}`
      const rating = data[`${f.id}_rating`]
      const modifier = data[`${f.id}_modifier`]
      const confirmed = data[`${f.id}_mod_confirmed`]
      const ratingStr = rating ? ` | Rating: ${rating}/10 ${parseInt(rating) <= 7 ? '(FAIL)' : '(PASS)'}` : ''
      const modStr = modifier ? ` | Modifier: ${modifier}${confirmed === 'yes' ? ' [CONFIRMED]' : confirmed === 'no' ? ' [DID NOT HELP]' : ''}` : ''
      return base + ratingStr + modStr
    }).join('\n')
    return `\n=== ${a.name} ===\n${qa}`
  }).filter(Boolean).join('\n\n')

  const buildProgram = async () => {
    setGenerating(true)
    const promptText = `You are an expert personal trainer. Build a complete 12-month program.\n\nCLIENT: ${client.name}\nGOAL: ${client.goal || 'Not specified'}\nEQUIPMENT: ${client.equipment || 'Not specified'}\n\nASSESSMENT DATA & CONFIRMED MODIFIERS:\n${assessmentSummaries || 'No assessments yet'}\n\nIMPORTANT: Use confirmed modifiers/protocols from the assessment data as corrective exercises. Do NOT invent findings.\n\nCreate THREE phases. Each phase needs: PHASE FOCUS, CORRECTIVE PROTOCOLS (from confirmed modifiers, with sets/reps), WEEKLY STRUCTURE (days with warm-up/main/accessory), PROGRESSIONS & MILESTONES, CONTRAINDICATIONS.\n\nRespond with JSON only — no markdown:\n{"p1":{"program":"...","equipment":"...","trainerNotes":"..."},"p2":{"program":"...","equipment":"...","trainerNotes":"..."},"p3":{"program":"...","equipment":"...","trainerNotes":"..."}}`
    try {
      const raw = await callClaude([{ role: 'user', content: promptText }], 8000)
      const clean = raw.replace(/```json|```/g, '').trim()
      let parsed
      try { parsed = JSON.parse(clean) }
      catch { parsed = { p1: { program: raw, equipment: client.equipment || '', trainerNotes: '' }, p2: { program: '', equipment: '', trainerNotes: '' }, p3: { program: '', equipment: '', trainerNotes: '' } } }
      const newProg = { phases: { p1: { ...program.phases.p1, ...parsed.p1 }, p2: { ...program.phases.p2, ...parsed.p2 }, p3: { ...program.phases.p3, ...parsed.p3 } }, generatedAt: new Date().toISOString() }
      setProgram(newProg)
      await saveProgram(client.id, newProg.phases)
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    } catch (e) { alert('Error: ' + e.message) }
    setGenerating(false)
  }

  const saveCurrentProgram = async () => {
    try {
      await saveProgram(client.id, program.phases)
      setProgram(p => ({ ...p, generatedAt: new Date().toISOString() }))
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    } catch (e) { alert('Error saving: ' + e.message) }
  }

  const update = (pid, field, val) => setProgram(p => ({ ...p, phases: { ...p.phases, [pid]: { ...p.phases[pid], [field]: val } } }))

  const printProgram = () => window.print()

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px 32px' }}>
      <LogoHeader />
      <button onClick={onBack} style={{ background: 'none', border: `1px solid ${C.border}`, color: C.sub, borderRadius: 7, padding: '6px 14px', fontSize: 12, cursor: 'pointer', marginBottom: 24 }}>← Back to Client</button>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 28 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 26, letterSpacing: 3, color: C.text }}>{client.name}</div>
          <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>12-Month Program Builder{program.generatedAt ? ` · Generated ${new Date(program.generatedAt).toLocaleDateString()}` : ''}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {program.generatedAt && <Btn onClick={printProgram} outline small>🖨 Print / PDF</Btn>}
          <Btn onClick={saveCurrentProgram} outline small>{saved ? '✓ Saved' : '💾 Save'}</Btn>
          <Btn onClick={buildProgram} disabled={generating}>{generating ? '⏳ Building...' : '⚡ Build 12-Month Program'}</Btn>
        </div>
      </div>

      {generating && <><Spinner /><div style={{ textAlign: 'center', fontSize: 13, color: C.sub, marginTop: 8 }}>Building your 12-month program from assessment data...</div></>}

      {PHASES.map(ph => (
        <div key={ph.id} style={{ background: C.card, border: `1px solid ${expanded === ph.id ? ph.color + '66' : C.border}`, borderRadius: 14, marginBottom: 12, overflow: 'hidden' }}>
          <button onClick={() => setExpanded(expanded === ph.id ? null : ph.id)} style={{ width: '100%', padding: '16px 22px', background: expanded === ph.id ? ph.color + '10' : 'transparent', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: ph.color, letterSpacing: 2 }}>{ph.label}</div>
              <div style={{ fontSize: 12, color: C.sub }}>{ph.sublabel}</div>
              {program.phases[ph.id]?.program && <span style={{ fontSize: 10, background: ph.color + '20', color: ph.color, borderRadius: 10, padding: '2px 8px', fontWeight: 700 }}>✓ Complete</span>}
            </div>
            <span style={{ color: C.sub }}>{expanded === ph.id ? '▲' : '▼'}</span>
          </button>
          {expanded === ph.id && (
            <div style={{ padding: '0 22px 22px' }}>
              {['equipment', 'program', 'trainerNotes'].map(field => (
                <div key={field} style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 11, color: C.sub, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>{field === 'trainerNotes' ? 'Trainer Notes (Internal)' : field === 'equipment' ? 'Equipment' : 'Program'}</label>
                  <textarea value={program.phases[ph.id]?.[field] || ''} onChange={e => update(ph.id, field, e.target.value)} rows={field === 'program' ? 18 : 3} style={{ width: '100%', background: C.faint, border: `1px solid ${C.border}`, borderRadius: 8, padding: '12px 14px', color: C.text, fontSize: 12, fontFamily: 'Montserrat,sans-serif', lineHeight: 1.8, outline: 'none', resize: 'vertical' }} />
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── CLIENT PROFILE ────────────────────────────────────────────────────────────
function ClientProfile({ client, onUpdate, onRunAssessment, onBuildProgram, onGenerateWorkout, onBack }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: client.name, goal: client.goal || '', dob: client.dob || '', equipment: client.equipment || '', trainerNotes: client.trainerNotes || '' })
  const [saving, setSaving] = useState(false)

  const assessmentsDone = Object.keys(client.assessments || {})

  const save = async () => {
    setSaving(true)
    const updated = { ...client, ...form }
    await saveClient(updated)
    onUpdate(updated)
    setEditing(false)
    setSaving(false)
  }

  const FLOW = [
    { phase: 'Phase 1 — Always First', color: C.teal, items: [ALL_ASSESSMENTS.hypermobility] },
    { phase: 'Phase 2 — Lower Body', color: C.accent, items: [ALL_ASSESSMENTS.prime8], subgroups: [
      { label: 'Phase 2 Breakouts (if needed)', items: [ALL_ASSESSMENTS.foot, ALL_ASSESSMENTS.hip, ALL_ASSESSMENTS.knee, ALL_ASSESSMENTS.structural] },
    ]},
    { phase: 'Phase 3 — Upper Body', color: C.sky, items: [ALL_ASSESSMENTS.neck], subgroups: [
      { label: 'Phase 3 Breakouts (if needed)', items: [ALL_ASSESSMENTS.neckPosture, ALL_ASSESSMENTS.shoulderPosture] },
      { label: 'Phase 3 Pain Sensitivity (if needed)', items: [ALL_ASSESSMENTS.neckSensitivity, ALL_ASSESSMENTS.shoulderSensitivity] },
    ]},
    { phase: 'Phase 4 — Mobility for Movement', color: C.indigo, items: [ALL_ASSESSMENTS.speedy6, ALL_ASSESSMENTS.speedy7] },
    { phase: 'Phase 5 — Performing & Ready to Function', color: C.green, items: [ALL_ASSESSMENTS.bms5] },
  ]

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 24px 32px' }}>
      <LogoHeader />
      <button onClick={onBack} style={{ background: 'none', border: `1px solid ${C.border}`, color: C.sub, borderRadius: 7, padding: '6px 14px', fontSize: 12, cursor: 'pointer', marginBottom: 24 }}>← All Clients</button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 30, letterSpacing: 4, color: C.text }}>{client.name}</div>
          {client.goal && <div style={{ fontSize: 13, color: C.sub, marginTop: 4 }}>Goal: {client.goal}</div>}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Btn onClick={() => onGenerateWorkout(client)} small>💪 Workout</Btn>
          <Btn onClick={() => onBuildProgram(client)} small>📋 Program</Btn>
          <Btn onClick={() => setEditing(!editing)} outline small color={C.sub}>{editing ? 'Cancel' : '✏️ Edit'}</Btn>
        </div>
      </div>

      {editing && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '22px 24px', marginBottom: 24 }}>
          {['name', 'goal', 'dob', 'equipment', 'trainerNotes'].map(field => (
            <div key={field} style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, color: C.sub, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>{field === 'trainerNotes' ? 'Trainer Notes' : field === 'dob' ? 'Date of Birth' : field.charAt(0).toUpperCase() + field.slice(1)}</label>
              {field === 'trainerNotes' ? <textarea value={form[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} rows={3} style={{ width: '100%', background: C.faint, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', fontFamily: 'Montserrat,sans-serif', fontSize: 13, outline: 'none', resize: 'vertical' }} />
                : <input type={field === 'dob' ? 'date' : 'text'} value={form[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} style={{ width: '100%', background: C.faint, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', fontFamily: 'Montserrat,sans-serif', fontSize: 13, outline: 'none' }} />}
            </div>
          ))}
          <Btn onClick={save} disabled={saving}>{saving ? 'Saving...' : '✓ Save Changes'}</Btn>
        </div>
      )}

      {FLOW.map(group => {
        const locked = group.requires && !group.requires.every(id => assessmentsDone.includes(id))
        const renderCards = (items) => (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {items.map(a => {
              const done = assessmentsDone.includes(a.id)
              return (
                <button key={a.id} onClick={() => !locked && onRunAssessment(a, client)} style={{ padding: '12px 16px', borderRadius: 12, border: `2px solid ${done ? a.color : C.border}`, background: done ? a.color + '12' : C.card, cursor: locked ? 'not-allowed' : 'pointer', textAlign: 'left', minWidth: 160, flex: '1 1 160px', maxWidth: 220, opacity: locked ? 0.45 : 1 }}>
                  <div style={{ fontSize: 18, marginBottom: 4 }}>{a.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: done ? a.color : C.text, marginBottom: 2 }}>{a.name}</div>
                  {done && <div style={{ fontSize: 10, color: a.color, fontWeight: 600 }}>✓ Completed</div>}
                  {!done && !locked && <div style={{ fontSize: 10, color: C.sub }}>Tap to start</div>}
                  {locked && <div style={{ fontSize: 10, color: C.sub }}>🔒 Complete Phase 1 & 2 first</div>}
                </button>
              )
            })}
          </div>
        )
        return (
          <div key={group.phase} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: group.color, textTransform: 'uppercase', marginBottom: 10 }}>{group.phase}{locked && <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1, marginLeft: 8, color: C.sub }}>🔒 LOCKED</span>}</div>
            {renderCards(group.items)}
            {!locked && group.subgroups && group.subgroups.map(sub => (
              <div key={sub.label} style={{ marginTop: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: C.sub, textTransform: 'uppercase', marginBottom: 8, paddingLeft: 4 }}>{sub.label}</div>
                {renderCards(sub.items)}
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

// ── CLIENT ROSTER ─────────────────────────────────────────────────────────────
function ClientRoster({ onSelectClient }) {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const all = await getAllClients()
    // Load assessments for each client
    const withAssessments = await Promise.all(all.map(async c => {
      const assessments = await getAssessmentsForClient(c.id).catch(() => ({}))
      return { ...c, trainerNotes: c.trainer_notes, assessments }
    }))
    setClients(withAssessments)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const addClient = async () => {
    if (!newName.trim()) return
    const c = { id: makeId(), name: newName.trim(), goal: '', dob: '', equipment: '', trainerNotes: '', assessments: {} }
    await saveClient(c)
    setNewName('')
    setAdding(false)
    await load()
  }

  const removeClient = async (id, e) => {
    e.stopPropagation()
    if (!confirm('Delete this client and all their data?')) return
    await deleteClient(id)
    setClients(cs => cs.filter(c => c.id !== id))
  }

  const filtered = clients.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '0 24px 40px' }}>
      <LogoHeader />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 26, letterSpacing: 4, color: C.text }}>CLIENT ROSTER</div>
          <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>{clients.length} client{clients.length !== 1 ? 's' : ''}</div>
        </div>
        <Btn onClick={() => setAdding(true)}>+ New Client</Btn>
      </div>

      {adding && (
        <div style={{ background: C.card, border: `1px solid ${C.accent}44`, borderRadius: 12, padding: '18px 20px', marginBottom: 20, display: 'flex', gap: 10 }}>
          <input autoFocus value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addClient()} placeholder="Client name..." style={{ flex: 1, background: C.faint, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', fontFamily: 'Montserrat,sans-serif', fontSize: 14, outline: 'none' }} />
          <Btn onClick={addClient}>Add</Btn>
          <Btn onClick={() => setAdding(false)} outline color={C.sub}>Cancel</Btn>
        </div>
      )}

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clients..." style={{ width: '100%', background: C.faint, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 16px', fontFamily: 'Montserrat,sans-serif', fontSize: 14, outline: 'none', marginBottom: 16 }} />

      {loading ? <Spinner /> : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: C.sub, fontSize: 14 }}>{clients.length === 0 ? 'No clients yet. Add your first client above.' : 'No clients match your search.'}</div>
      ) : filtered.map(c => {
        const count = Object.keys(c.assessments || {}).length
        return (
          <div key={c.id} onClick={() => onSelectClient(c)} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 20px', marginBottom: 10, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'border-color .15s' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = C.accent}
            onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: C.text }}>{c.name}</div>
              <div style={{ fontSize: 12, color: C.sub, marginTop: 3 }}>
                {c.goal && <span>{c.goal} · </span>}
                <span>{count} assessment{count !== 1 ? 's' : ''} on file</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {count > 0 && <span style={{ fontSize: 10, background: C.accent + '15', color: C.accent, borderRadius: 10, padding: '3px 10px', fontWeight: 700 }}>{count} assessments</span>}
              <button onClick={e => removeClient(c.id, e)} style={{ background: 'none', border: 'none', color: C.sub, cursor: 'pointer', fontSize: 16, padding: '4px 8px', borderRadius: 6 }}>✕</button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── ROOT APP ──────────────────────────────────────────────────────────────────
// ── LOGIN SCREEN ─────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!password.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password })
      })
      const data = await res.json()
      if (data.success) {
        sessionStorage.setItem('ff_auth', 'true')
        onLogin()
      } else {
        setError(data.error || 'Wrong password')
        setPassword('')
      }
    } catch {
      setError('Connection error — try again')
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <form onSubmit={handleSubmit} style={{ background: C.panel, borderRadius: 16, padding: '40px 32px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: `1px solid ${C.border}`, maxWidth: 360, width: '100%', textAlign: 'center' }}>
        <img src="/logo.png" alt="FreddyFit" style={{ maxWidth: 200, width: '100%', height: 'auto', marginBottom: 24 }} />
        <div style={{ fontSize: 13, color: C.sub, marginBottom: 20, fontFamily: 'Montserrat,sans-serif' }}>Enter your password to continue</div>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Password"
          autoFocus
          style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: `1.5px solid ${error ? C.red : C.border}`, fontFamily: 'Montserrat,sans-serif', fontSize: 14, outline: 'none', background: C.faint, marginBottom: 12, boxSizing: 'border-box' }}
        />
        {error && <div style={{ fontSize: 12, color: C.red, fontWeight: 600, marginBottom: 10, fontFamily: 'Montserrat,sans-serif' }}>{error}</div>}
        <button type="submit" disabled={loading || !password.trim()} style={{ width: '100%', padding: '12px 0', borderRadius: 8, border: 'none', background: loading ? '#CBD5E0' : C.accent, color: '#000', fontFamily: 'Montserrat,sans-serif', fontWeight: 700, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer', letterSpacing: 0.5 }}>
          {loading ? 'Checking...' : 'Log In'}
        </button>
      </form>
    </div>
  )
}

// ── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [authed, setAuthed] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [view, setView] = useState('roster')
  const [client, setClient] = useState(null)
  const [assessment, setAssessment] = useState(null)

  useEffect(() => {
    if (sessionStorage.getItem('ff_auth') === 'true') setAuthed(true)
    setCheckingAuth(false)
  }, [])

  if (checkingAuth) return null
  if (!authed) return <LoginScreen onLogin={() => setAuthed(true)} />

  const goToClient = (c) => { setClient(c); setView('client') }
  const updateClient = (c) => setClient(c)

  const runAssessment = (a, c) => {
    setAssessment(a)
    setClient(c)
    setView('assessment')
  }

  const completeAssessment = (id, answers) => {
    setClient(c => ({ ...c, assessments: { ...(c.assessments || {}), [id]: answers } }))
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '12px 24px', borderBottom: `1px solid ${C.border}`, background: C.panel, display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', flexShrink: 0 }} className="no-print">
        <button onClick={() => setView('roster')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div>
            <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: 2, color: '#8C9199' }}>FREDDY</span>
            <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: 2, color: C.accent, marginLeft: 3 }}>FIT</span>
          </div>
          <div style={{ width: 1, height: 20, background: C.border }} />
          <div style={{ fontSize: 11, color: C.sub, letterSpacing: 2, fontWeight: 600, textTransform: 'uppercase' }}>TrainDesk</div>
        </button>
        {client && view !== 'roster' && (
          <div style={{ fontSize: 12, color: C.sub }}>
            {view === 'assessment' ? assessment?.name : view === 'program' ? 'Program Builder' : view === 'workout' ? 'Workout Generator' : client.name}
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {view === 'roster' && <ClientRoster onSelectClient={goToClient} />}
        {view === 'client' && client && (
          <ClientProfile
            client={client}
            onUpdate={updateClient}
            onRunAssessment={runAssessment}
            onBuildProgram={c => { setClient(c); setView('program') }}
            onGenerateWorkout={c => { setClient(c); setView('workout') }}
            onBack={() => setView('roster')}
          />
        )}
        {view === 'assessment' && client && assessment && (
          <AssessmentForm
            assessment={assessment}
            client={client}
            onComplete={completeAssessment}
            onBack={() => setView('client')}
          />
        )}
        {view === 'program' && client && (
          <ProgramBuilder
            client={client}
            onBack={() => setView('client')}
            onSave={updateClient}
          />
        )}
        {view === 'workout' && client && (
          <WorkoutGenerator
            client={client}
            onBack={() => setView('client')}
          />
        )}
      </div>
    </div>
  )
}
