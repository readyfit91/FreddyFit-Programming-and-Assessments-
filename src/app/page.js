'use client'
import { useState, useEffect, useCallback } from 'react'
import { getAllClients, saveClient, deleteClient, getAssessmentsForClient, saveAssessment, getProgramForClient, saveProgram, saveWorkout, getWorkoutsForClient } from '../lib/supabase'
import { ALL_ASSESSMENTS, MAIN_ASSESSMENTS, C } from '../lib/assessments'
import { FIELD_MODIFIERS } from '../lib/modifiers'

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
  const [summary, setSummary] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (client.assessments?.[assessment.id]) {
      const d = client.assessments[assessment.id]
      setAnswers(d)
      setSummary(d._summary || '')
      setDone(true)
    }
  }, [assessment.id, client.assessments])

  const allFields = assessment.sections.flatMap(s => s.fields)
  const answered = allFields.filter(f => answers[f.id]?.toString().trim()).length
  const progress = Math.round((answered / allFields.length) * 100)
  const set = (id, val) => setAnswers(a => ({ ...a, [id]: val }))

  const generateSummary = async () => {
    setLoading(true)
    setDone(true)
    const qa = allFields.map(f => {
      const base = `${f.label}: ${answers[f.id] || '(not recorded)'}`
      const rating = answers[`${f.id}_rating`]
      const modifier = answers[`${f.id}_modifier`]
      const confirmed = answers[`${f.id}_mod_confirmed`]
      const ratingStr = rating ? ` | Rating: ${rating}/10 ${parseInt(rating) <= 7 ? '(FAIL)' : '(PASS)'}` : ''
      const modStr = modifier ? ` | Modifier tried: ${modifier}${confirmed === 'yes' ? ' ✓ CONFIRMED WORKING' : confirmed === 'no' ? ' ✗ did not help' : ''}` : ''
      return base + ratingStr + modStr
    }).join('\n')
    try {
      const s = await callClaude([{ role: 'user', content: `You are an expert personal trainer reviewing a completed ${assessment.name} assessment for client: ${client.name}.\n\nResults:\n${qa}\n\nProvide a structured clinical summary: 1) Key findings & red flags 2) Areas that tested strong/normal 3) Priority correctives & protocols to assign 4) Recommended training modifications 5) Suggested breakout assessments. Be specific and practical.` }], 1000)
      setSummary(s)
      const completed = { ...answers, _summary: s, _completedAt: new Date().toISOString() }
      await saveAssessment(client.id, assessment.id, answers, s)
      onComplete(assessment.id, completed)
    } catch (e) {
      setSummary('Error generating summary: ' + e.message)
    }
    setLoading(false)
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
    const modifiers = FIELD_MODIFIERS[f.id]
    const ratingNum = parseInt(rating)
    const isFail = rating && ratingNum <= 7
    const isPass = rating && ratingNum >= 8
    const ratingColor = !rating ? C.sub : isFail ? C.red : C.green

    return (
      <div style={{ marginTop: 10, background: C.faint, borderRadius: 10, padding: '12px 14px', border: `1px solid ${C.border}` }}>

        {/* STEP 1 — Rate */}
        <div style={{ marginBottom: rating ? 12 : 0 }}>
          <div style={{ fontSize: 10, color: C.sub, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Step 1 — Rate this test</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {[1,2,3,4,5,6,7,8,9,10].map(n => {
              const isSelected = ratingNum === n
              const btnFail = n <= 7
              return (
                <button key={n} onClick={() => {
                  set(ratingKey, n.toString())
                  // Reset downstream if rating changes
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

        {/* STEP 2 — Modifier (only if fail and modifiers exist) */}
        {isFail && modifiers && modifiers.length > 0 && (
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12, marginBottom: modifier ? 12 : 0 }}>
            <div style={{ fontSize: 10, color: C.red, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Step 2 — Try a modifier. Which one helped?</div>
            <select value={modifier || ''} onChange={e => {
              set(modKey, e.target.value)
              set(modConfirmedKey, '') // reset confirmation if modifier changes
            }} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1.5px solid ${modifier ? C.accent : C.red + '66'}`, background: 'white', color: modifier ? C.text : C.sub, fontFamily: 'Montserrat,sans-serif', fontSize: 13, outline: 'none', cursor: 'pointer' }}>
              <option value="">— Select a modifier to try —</option>
              {modifiers.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        )}

        {/* STEP 3 — Confirm (only if modifier selected and not "No modifier worked") */}
        {isFail && modifier && modifier !== 'No modifier worked' && (
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
            <div style={{ fontSize: 10, color: C.accent, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Step 3 — Did <span style={{ color: C.accent }}>{modifier}</span> improve the test?</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => set(modConfirmedKey, 'yes')} style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: `1.5px solid ${modConfirmed === 'yes' ? C.green : C.border}`, background: modConfirmed === 'yes' ? C.green : 'white', color: modConfirmed === 'yes' ? 'white' : C.green, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>✓ Yes — it worked</button>
              <button onClick={() => set(modConfirmedKey, 'no')} style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: `1.5px solid ${modConfirmed === 'no' ? C.red : C.border}`, background: modConfirmed === 'no' ? C.red : 'white', color: modConfirmed === 'no' ? 'white' : C.red, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>✗ No — try another</button>
            </div>
            {modConfirmed === 'yes' && (
              <div style={{ marginTop: 8, padding: '8px 12px', background: C.green + '12', borderRadius: 8, border: `1px solid ${C.green}44`, fontSize: 11, color: C.green, fontWeight: 700 }}>
                ✓ Recorded: <strong>{modifier}</strong> confirmed as corrective for this test
              </div>
            )}
            {modConfirmed === 'no' && (
              <div style={{ marginTop: 8, padding: '8px 12px', background: C.orange + '12', borderRadius: 8, border: `1px solid ${C.orange}44`, fontSize: 11, color: C.orange, fontWeight: 700 }}>
                Try selecting a different modifier above ↑
              </div>
            )}
          </div>
        )}

        {/* No modifier worked — record it */}
        {isFail && modifier === 'No modifier worked' && (
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
            <div style={{ padding: '8px 12px', background: C.red + '10', borderRadius: 8, border: `1px solid ${C.red}33`, fontSize: 11, color: C.red, fontWeight: 700 }}>
              ✗ Recorded: No modifier improved this test — flag for deeper investigation
            </div>
          </div>
        )}

        {/* Pass — no modifier needed */}
        {isPass && (
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
            <div style={{ fontSize: 11, color: C.green, fontWeight: 700 }}>✓ Pass — no corrective needed for this test</div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px' }}>
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
          {s.fields.map(f => (
            <div key={f.id} style={{ marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${C.faint}` }}>
              <label style={{ display: 'block', fontSize: 12, color: C.sub, marginBottom: 6, fontWeight: 600 }}>{f.label}</label>
              {renderField(f)}
              {renderRatingAndModifier(f)}
            </div>
          ))}
        </div>
      ))}

      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
        <Btn onClick={generateSummary} disabled={loading}>{loading ? 'Generating...' : done ? '↺ Regenerate Summary' : '⚡ Generate AI Summary'}</Btn>
      </div>

      {loading && <Spinner />}

      {summary && (
        <div style={{ marginTop: 24, background: C.accent + '08', border: `1px solid ${C.accent}33`, borderRadius: 12, padding: '20px 22px' }}>
          <div style={{ fontWeight: 800, fontSize: 12, color: C.accent, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>AI Summary</div>
          <pre style={{ fontSize: 12, lineHeight: 1.8, color: C.text, whiteSpace: 'pre-wrap', fontFamily: 'Montserrat,sans-serif' }}>{summary}</pre>
        </div>
      )}
    </div>
  )
}

// ── WORKOUT GENERATOR ─────────────────────────────────────────────────────────
function WorkoutGenerator({ client, onBack }) {
  const [prompt, setPrompt] = useState('')
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
    const qa = fields.map(f => `  ${f.label}: ${data[f.id] || '(not recorded)'}`).join('\n')
    return `${a.name}:\n${qa}${data._summary ? '\n  SUMMARY: ' + data._summary : ''}`
  }).filter(Boolean).join('\n\n') || 'No assessments completed yet.'

  const generate = async () => {
    if (!prompt.trim()) { setError('Please describe the workout you want.'); return }
    setGenerating(true); setError(''); setWorkout('')
    try {
      const text = await callClaude([{ role: 'user', content: `You are an expert personal trainer. Generate a detailed workout for:\nCLIENT: ${client.name}\nGOAL: ${client.goal || 'Not specified'}\nEQUIPMENT: ${client.equipment || 'Not specified'}\n\nASSESSMENT FINDINGS:\n${assessmentContext}\n\nTRAINER REQUEST: ${prompt}\n\nFormat with: WORKOUT TITLE, CLIENT NOTES, CORRECTIVE WARM-UP (from assessment findings), MAIN WORKOUT (days/blocks with sets x reps x rest + cues), COOL DOWN, TRAINER NOTES (INTERNAL). Be specific, reference the actual findings.` }], 4000)
      setWorkout(text)
    } catch (e) { setError('Error: ' + e.message) }
    setGenerating(false)
  }

  const saveCurrentWorkout = async () => {
    if (!workout) return
    await saveWorkout(client.id, workout, prompt)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    const updated = await getWorkoutsForClient(client.id)
    setPastWorkouts(updated)
  }

  const printWorkout = () => window.print()

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 24px' }}>
      <button onClick={onBack} style={{ background: 'none', border: `1px solid ${C.border}`, color: C.sub, borderRadius: 7, padding: '6px 14px', fontSize: 12, cursor: 'pointer', marginBottom: 24 }}>← Back to Client</button>
      <div style={{ fontWeight: 800, fontSize: 26, letterSpacing: 3, color: C.text, marginBottom: 4 }}>{client.name}</div>
      <div style={{ fontSize: 12, color: C.sub, marginBottom: 24 }}>Workout Generator · {Object.keys(client.assessments || {}).length} assessments on file</div>

      {Object.keys(client.assessments || {}).length > 0 && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 18px', marginBottom: 20 }}>
          <div style={{ fontSize: 10, color: C.sub, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>AI will use these assessments</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {Object.keys(client.assessments || {}).map(id => {
              const a = ALL_ASSESSMENTS[id]
              return a ? <span key={id} style={{ background: a.colorDim, border: `1px solid ${a.color}44`, borderRadius: 20, padding: '3px 12px', fontSize: 11, color: a.color, fontWeight: 600 }}>{a.icon} {a.name}</span> : null
            })}
          </div>
        </div>
      )}

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '22px 24px', marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 11, color: C.sub, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700, marginBottom: 10 }}>Describe the workout you want</label>
        <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={4} placeholder="e.g. 3 day push/pull/legs, full gym, 45 mins per session" style={{ width: '100%', background: C.faint, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 16px', color: C.text, fontSize: 13, fontFamily: 'Montserrat,sans-serif', outline: 'none', resize: 'vertical' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
          <div style={{ fontSize: 11, color: C.sub }}>AI will read all assessment findings and shape the workout around them</div>
          <Btn onClick={generate} disabled={generating}>{generating ? '⏳ Generating...' : '⚡ Generate Workout'}</Btn>
        </div>
      </div>

      {error && <div style={{ background: C.red + '12', border: `1px solid ${C.red}44`, borderRadius: 10, padding: '12px 16px', fontSize: 13, color: C.red, marginBottom: 16 }}>{error}</div>}
      {generating && <Spinner />}

      {workout && (
        <div style={{ background: C.card, border: `2px solid ${C.accent}44`, borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ background: `linear-gradient(135deg,${C.accent}18,${C.accent}08)`, borderBottom: `1px solid ${C.accent}33`, padding: '16px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ fontWeight: 800, fontSize: 14, letterSpacing: 2, color: C.accent }}>WORKOUT GENERATED</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn onClick={saveCurrentWorkout} outline small color={C.accent}>{saved ? '✓ Saved' : '💾 Save'}</Btn>
              <Btn onClick={printWorkout} small>🖨 Print / PDF</Btn>
            </div>
          </div>
          <div style={{ padding: 24 }}>
            <textarea value={workout} onChange={e => setWorkout(e.target.value)} rows={35} style={{ width: '100%', background: C.faint, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, color: C.text, fontSize: 12, fontFamily: 'Courier New,monospace', lineHeight: 1.8, outline: 'none', resize: 'vertical' }} />
          </div>
        </div>
      )}

      {pastWorkouts.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <button onClick={() => setShowPast(!showPast)} style={{ background: 'none', border: 'none', color: C.sub, fontSize: 12, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif' }}>{showPast ? '▼' : '▶'} Past Workouts ({pastWorkouts.length})</button>
          {showPast && pastWorkouts.map(w => (
            <div key={w.id} style={{ marginTop: 10, background: C.faint, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ fontSize: 11, color: C.sub, marginBottom: 6 }}>{new Date(w.generated_at).toLocaleDateString()} · {w.prompt}</div>
              <pre style={{ fontSize: 11, color: C.text, whiteSpace: 'pre-wrap', fontFamily: 'Montserrat,sans-serif', lineHeight: 1.7 }}>{w.content.slice(0, 300)}...</pre>
              <button onClick={() => setWorkout(w.content)} style={{ marginTop: 8, background: 'none', border: `1px solid ${C.accent}`, color: C.accent, borderRadius: 6, padding: '4px 12px', fontSize: 11, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif' }}>Load this workout</button>
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
    const qa = fields.map(f => `${f.label}: ${data[f.id] || '(not recorded)'}`).join('\n')
    return `\n=== ${a.name} ===\n${qa}${data._summary ? '\nSUMMARY: ' + data._summary : ''}`
  }).filter(Boolean).join('\n\n')

  const buildProgram = async () => {
    setGenerating(true)
    const promptText = `You are an expert personal trainer. Build a complete 12-month program.\n\nCLIENT: ${client.name}\nGOAL: ${client.goal || 'Not specified'}\nEQUIPMENT: ${client.equipment || 'Not specified'}\n\nASSESSMENT DATA:\n${assessmentSummaries || 'No assessments yet'}\n\nCreate THREE phases. Each phase needs: PHASE FOCUS, CORRECTIVE PROTOCOLS (sets/reps), WEEKLY STRUCTURE (days with warm-up/main/accessory), PROGRESSIONS & MILESTONES, CONTRAINDICATIONS.\n\nRespond with JSON only — no markdown:\n{"p1":{"program":"...","equipment":"...","trainerNotes":"..."},"p2":{"program":"...","equipment":"...","trainerNotes":"..."},"p3":{"program":"...","equipment":"...","trainerNotes":"..."}}`
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

  const update = (pid, field, val) => setProgram(p => ({ ...p, phases: { ...p.phases, [pid]: { ...p.phases[pid], [field]: val } } }))

  const printProgram = () => window.print()

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>
      <button onClick={onBack} style={{ background: 'none', border: `1px solid ${C.border}`, color: C.sub, borderRadius: 7, padding: '6px 14px', fontSize: 12, cursor: 'pointer', marginBottom: 24 }}>← Back to Client</button>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 28 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 26, letterSpacing: 3, color: C.text }}>{client.name}</div>
          <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>12-Month Program Builder{program.generatedAt ? ` · Generated ${new Date(program.generatedAt).toLocaleDateString()}` : ''}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {program.generatedAt && <Btn onClick={printProgram} outline small>🖨 Print / PDF</Btn>}
          <Btn onClick={buildProgram} disabled={generating}>{generating ? '⏳ Building...' : '🤖 Build 12-Month Program'}</Btn>
        </div>
      </div>

      {generating && <><Spinner /><div style={{ textAlign: 'center', fontSize: 13, color: C.sub, marginTop: 8 }}>Building your 12-month program... this takes ~30 seconds</div></>}

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
    { phase: 'Phase 1 — Always First', color: C.teal, items: [ALL_ASSESSMENTS.hypermobility, ALL_ASSESSMENTS.prime8] },
    { phase: 'Phase 2 — Ground Up Breakouts', color: C.orange, items: [ALL_ASSESSMENTS.foot, ALL_ASSESSMENTS.hip, ALL_ASSESSMENTS.knee, ALL_ASSESSMENTS.structural] },
    { phase: 'Phase 3 — Neck & Shoulder', color: C.sky, items: [ALL_ASSESSMENTS.neck, ALL_ASSESSMENTS.neckPosture, ALL_ASSESSMENTS.neckSensitivity, ALL_ASSESSMENTS.speedy6, ALL_ASSESSMENTS.shoulderPosture, ALL_ASSESSMENTS.speedy7, ALL_ASSESSMENTS.shoulderSensitivity] },
  ]

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 24px' }}>
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

      {FLOW.map(group => (
        <div key={group.phase} style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: group.color, textTransform: 'uppercase', marginBottom: 10 }}>{group.phase}</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {group.items.map(a => {
              const done = assessmentsDone.includes(a.id)
              return (
                <button key={a.id} onClick={() => onRunAssessment(a, client)} style={{ padding: '12px 16px', borderRadius: 12, border: `2px solid ${done ? a.color : C.border}`, background: done ? a.color + '12' : C.card, cursor: 'pointer', textAlign: 'left', minWidth: 160, flex: '1 1 160px', maxWidth: 220 }}>
                  <div style={{ fontSize: 18, marginBottom: 4 }}>{a.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: done ? a.color : C.text, marginBottom: 2 }}>{a.name}</div>
                  {done && <div style={{ fontSize: 10, color: a.color, fontWeight: 600 }}>✓ Completed</div>}
                  {!done && <div style={{ fontSize: 10, color: C.sub }}>Tap to start</div>}
                </button>
              )
            })}
          </div>
        </div>
      ))}
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
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '40px 24px' }}>
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
export default function App() {
  const [view, setView] = useState('roster')
  const [client, setClient] = useState(null)
  const [assessment, setAssessment] = useState(null)

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
