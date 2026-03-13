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
  const [hasUnsaved, setHasUnsaved] = useState(false)

  useEffect(() => {
    if (client.assessments?.[assessment.id]) {
      setAnswers(client.assessments[assessment.id])
      setSaved(true)
    }
  }, [assessment.id, client.assessments])

  const allFields = assessment.sections.flatMap(s => s.fields)
  const answered = allFields.filter(f => answers[f.id]?.toString().trim()).length
  const progress = Math.round((answered / allFields.length) * 100)
  const set = (id, val) => { setAnswers(a => ({ ...a, [id]: val })); if (saved) setHasUnsaved(true) }

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
      setHasUnsaved(false)
    } catch (e) {
      alert('Error saving: ' + e.message)
    }
    setSaving(false)
  }

  const renderField = (f) => {
    const val = answers[f.id] || ''
    const base = { width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontFamily: 'Montserrat,sans-serif', fontSize: 13, color: C.text, outline: 'none', background: C.faint }
    if (f.type === 'textarea') return <textarea value={val} onChange={e => set(f.id, e.target.value)} rows={3} style={{ ...base, resize: 'vertical' }} placeholder={f.placeholder || ''} />
    if (f.type === 'passfail') {
      if (assessment.id === 'prime8' || f.modifiers) return null
      return (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {f.options.map(o => <button key={o} onClick={() => set(f.id, o)} style={{ padding: '8px 16px', borderRadius: 7, border: `1.5px solid ${val === o ? C.accent : C.border}`, background: val === o ? C.accent + '20' : 'white', color: val === o ? C.accent : C.sub, fontFamily: 'Montserrat,sans-serif', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>{o}</button>)}
        </div>
      )
    }
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
    const isPrime8 = assessment.id === 'prime8'
    // Only show rating system for fields that have modifiers (Prime 8 inline or FIELD_MODIFIERS)
    const hasModifiers = !!(f.modifiers || FIELD_MODIFIERS[f.id])
    if (!isPrime8 && !hasModifiers) return null

    // Special: Prime 8 Neck Rotation — finger widths instead of rating
    if (isPrime8 && f.fingerWidths) {
      const fwKey = `${f.id}_finger_widths`
      const fw = answers[fwKey]
      const isFW3 = fw === '3+'
      return (
        <div style={{ marginTop: 10, background: C.faint, borderRadius: 10, padding: '12px 14px', border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 10, color: C.sub, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>How Many Finger Widths?</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {['1','2','3+'].map(n => {
              const isSelected = fw === n
              const isFailOpt = n === '3+'
              return (
                <button key={n} onClick={() => {
                  set(fwKey, n)
                  set(f.id, n === '3+' ? 'Fail' : 'Pass')
                }} style={{
                  padding: '8px 24px', borderRadius: 7,
                  border: `1.5px solid ${isSelected ? (isFailOpt ? C.red : C.green) : C.border}`,
                  background: isSelected ? (isFailOpt ? C.red : C.green) : 'white',
                  color: isSelected ? 'white' : isFailOpt ? C.red : C.green,
                  fontFamily: 'Montserrat,sans-serif', fontWeight: 800, fontSize: 14,
                  cursor: 'pointer'
                }}>{n}</button>
              )
            })}
          </div>
          {fw && !isFW3 && (
            <div style={{ marginTop: 8, fontSize: 11, fontWeight: 800, color: C.green }}>✓ PASS — {fw} finger width{fw !== '1' ? 's' : ''}</div>
          )}
          {isFW3 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.red, marginBottom: 8 }}>✗ FAIL — 3+ finger widths</div>
              <div style={{ padding: '10px 14px', background: C.red + '10', borderRadius: 8, border: `1px solid ${C.red}33`, fontSize: 12, color: C.red, fontWeight: 700 }}>
                ⚠️ Perform Breakout Neck Assessment for further evaluation
              </div>
              {f.failNotes && (
                <div style={{ marginTop: 8, background: C.orange + '08', border: `1px solid ${C.orange}22`, borderRadius: 10, padding: '12px 16px' }}>
                  <div style={{ fontSize: 10, color: C.orange, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>📋 What To Do Next</div>
                  <pre style={{ fontSize: 12, lineHeight: 1.7, color: C.text, whiteSpace: 'pre-wrap', fontFamily: 'Montserrat,sans-serif', margin: 0 }}>{f.failNotes}</pre>
                </div>
              )}
            </div>
          )}
        </div>
      )
    }

    const ratingKey = `${f.id}_rating`
    const modKey = `${f.id}_modifier`
    const modConfirmedKey = `${f.id}_mod_confirmed`
    const modRatingKey = `${f.id}_mod_rating`
    const rating = answers[ratingKey]
    const modifier = answers[modKey]
    const modConfirmed = answers[modConfirmedKey]
    const modRating = answers[modRatingKey]
    const ratingNum = parseInt(rating)
    const modRatingNum = parseInt(modRating)
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
                  set(modRatingKey, '')
                  const modOptions = f.modifiers || FIELD_MODIFIERS[f.id]
                  if (n >= 8) {
                    set(f.id, 'Pass')
                  } else if (!modOptions || modOptions.length === 0) {
                    set(f.id, 'Fail')
                  }
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

        {/* MODIFIER DROPDOWN — select which modifier to attempt (inline or from FIELD_MODIFIERS) */}
        {(() => {
          const modOptions = f.modifiers || FIELD_MODIFIERS[f.id]
          if (!isFail || !modOptions || modOptions.length === 0) return null
          const noHelpLabel = modOptions.find(m => m.startsWith('No modifier')) || 'No modifier worked'
          return (
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12, marginBottom: modifier ? 12 : 0 }}>
              <div style={{ fontSize: 10, color: C.red, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Step 2 — Which modifier helped?</div>
              <select value={modifier || ''} onChange={e => {
                set(modKey, e.target.value)
                set(modConfirmedKey, '')
                set(modRatingKey, '')
                if (e.target.value.startsWith('No modifier')) {
                  set(f.id, 'Fail')
                }
              }} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1.5px solid ${modifier ? C.accent : C.red + '66'}`, background: 'white', color: modifier ? C.text : C.sub, fontFamily: 'Montserrat,sans-serif', fontSize: 13, outline: 'none', cursor: 'pointer' }}>
                <option value="">— Select the modifier that helped —</option>
                {modOptions.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          )
        })()}

        {/* ALL ASSESSMENTS: Re-rate after modifier attempt */}
        {isFail && modifier && !modifier.startsWith('No modifier') && (
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
            <div style={{ fontSize: 10, color: C.accent, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Step 3 — Re-rate after {modifier.split('→')[0].trim()}</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {[1,2,3,4,5,6,7,8,9,10].map(n => {
                const isSelected = modRatingNum === n
                const btnFail = n <= 7
                return (
                  <button key={n} onClick={() => {
                    set(modRatingKey, n.toString())
                    if (n >= 8) set(f.id, 'Pass')
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
            {modRating && modRatingNum >= 8 && (
              <div style={{ marginTop: 8, padding: '8px 12px', background: C.green + '12', borderRadius: 8, border: `1px solid ${C.green}44`, fontSize: 11, color: C.green, fontWeight: 700 }}>
                ✓ PASS — {modifier.split('→')[0].trim()} improved to {modRating}/10
              </div>
            )}
            {modRating && modRatingNum <= 7 && (
              <div style={{ marginTop: 8, padding: '8px 12px', background: C.orange + '12', borderRadius: 8, border: `1px solid ${C.orange}44`, fontSize: 11, color: C.orange, fontWeight: 700 }}>
                Still {modRating}/10 — select a different modifier above ↑
              </div>
            )}
          </div>
        )}

        {/* No modifier helped — flag it */}
        {isFail && modifier && modifier.startsWith('No modifier') && (
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
            <div style={{ padding: '8px 12px', background: C.red + '10', borderRadius: 8, border: `1px solid ${C.red}33`, fontSize: 11, color: C.red, fontWeight: 700 }}>
              ✗ Recorded: {modifier} — flag for deeper investigation / breakout assessments
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
            // Hide conditional fields until their parent meets criteria
            if (f.showWhenFail) {
              const parentVal = parseFloat(answers[f.showWhenFail])
              const parentField = s.fields.find(p => p.id === f.showWhenFail)
              // Balance fault fields: show when age is entered
              if (f.balanceSide) {
                if (!parentVal || isNaN(parentVal)) return null
              }
              // Dorsiflexion limiting factor: show when cm < threshold
              else if (!parentVal || !parentField?.autoPassThreshold || parentVal >= parentField.autoPassThreshold) return null
            }
            return (
            <div key={f.id} style={{ marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${C.faint}` }}>
              <label style={{ display: 'block', fontSize: 12, color: C.sub, marginBottom: 6, fontWeight: 600 }}>{f.label}</label>
              {renderField(f)}
              {assessment.id !== 'bms5' && renderRatingAndModifier(f)}
              {f.balanceAge && answers[f.id] && !isNaN(parseInt(answers[f.id])) && (() => {
                const age = parseInt(answers[f.id])
                const ageGroups = [
                  { range: '20-49', min: 20, max: 49, allowed: 2 },
                  { range: '50-59', min: 50, max: 59, allowed: 3 },
                  { range: '60-69', min: 60, max: 69, allowed: 6 },
                  { range: '70-79', min: 70, max: 79, allowed: 12 },
                ]
                const group = ageGroups.find(g => age >= g.min && age <= g.max)
                return group ? (
                  <div style={{ marginTop: 8, padding: '8px 12px', background: C.accent + '10', borderRadius: 8, border: `1px solid ${C.accent}33` }}>
                    <div style={{ fontSize: 11, color: C.accent, fontWeight: 700 }}>Age group: {group.range} — allowed ≤ {group.allowed} faults per leg</div>
                    <div style={{ fontSize: 10, color: C.sub, marginTop: 4 }}>Stand in sock/bare feet, arms crossed over opposite shoulders. Eyes closed. Standing leg straight. 60 seconds per leg.</div>
                    <div style={{ fontSize: 10, color: C.sub, marginTop: 2 }}>Faults: touch floor, move standing foot, big torso side bend, open eyes, or 5+ seconds to reset.</div>
                  </div>
                ) : (
                  <div style={{ marginTop: 8, fontSize: 11, color: C.sub }}>Age {age} — norms available for ages 20-79</div>
                )
              })()}
              {f.autoPassThreshold && answers[f.id] && !isNaN(parseFloat(answers[f.id])) && (() => {
                const val = parseFloat(answers[f.id])
                const isPass = val >= f.autoPassThreshold
                return (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: isPass ? C.green : C.red }}>
                      {isPass ? `✓ Pass — ${val}cm (≥ ${f.autoPassThreshold}cm)` : `✗ Fail — ${val}cm (below ${f.autoPassThreshold}cm)`}
                    </div>
                    {!isPass && f.failNotes && (
                      <div style={{ marginTop: 10, background: C.orange + '08', border: `1px solid ${C.orange}22`, borderRadius: 10, padding: '12px 16px' }}>
                        <div style={{ fontSize: 10, color: C.orange, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>📋 What To Do Next</div>
                        <pre style={{ fontSize: 12, lineHeight: 1.7, color: C.text, whiteSpace: 'pre-wrap', fontFamily: 'Montserrat,sans-serif', margin: 0 }}>{f.failNotes}</pre>
                      </div>
                    )}
                  </div>
                )
              })()}
              {f.balanceSide && answers[f.id] && !isNaN(parseInt(answers[f.id])) && answers.f_balance_age && !isNaN(parseInt(answers.f_balance_age)) && (() => {
                const faults = parseInt(answers[f.id])
                const age = parseInt(answers.f_balance_age)
                const ageGroups = [
                  { range: '20-49', min: 20, max: 49, allowed: 2 },
                  { range: '50-59', min: 50, max: 59, allowed: 3 },
                  { range: '60-69', min: 60, max: 69, allowed: 6 },
                  { range: '70-79', min: 70, max: 79, allowed: 12 },
                ]
                const clientGroup = ageGroups.find(g => age >= g.min && age <= g.max)
                const allowed = clientGroup ? clientGroup.allowed : (age < 20 ? 2 : 12)
                const isPass = faults <= allowed
                // Which age group does their performance match?
                let performanceGroup = null
                if (faults <= 2) performanceGroup = '20-49 year olds (≤ 2 faults)'
                else if (faults <= 3) performanceGroup = '50-59 year olds (≤ 3 faults)'
                else if (faults <= 6) performanceGroup = '60-69 year olds (≤ 6 faults)'
                else if (faults <= 12) performanceGroup = '70-79 year olds (≤ 12 faults)'
                else performanceGroup = 'Below 70-79 norms (> 12 faults)'
                return (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: isPass ? C.green : C.red }}>
                      {isPass
                        ? `✓ Pass — ${faults} fault${faults !== 1 ? 's' : ''} (allowed ≤ ${allowed} for age ${clientGroup ? clientGroup.range : age})`
                        : `✗ Fail — ${faults} fault${faults !== 1 ? 's' : ''} (allowed ≤ ${allowed} for age ${clientGroup ? clientGroup.range : age})`}
                    </div>
                    <div style={{ marginTop: 6, fontSize: 11, color: C.sub, fontWeight: 600 }}>
                      Performance level: <span style={{ color: isPass ? C.green : C.orange }}>{performanceGroup}</span>
                    </div>
                    {!isPass && (
                      <div style={{ marginTop: 10, background: C.orange + '08', border: `1px solid ${C.orange}22`, borderRadius: 10, padding: '12px 16px' }}>
                        <div style={{ fontSize: 10, color: C.orange, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>📋 What To Do Next</div>
                        <pre style={{ fontSize: 12, lineHeight: 1.7, color: C.text, whiteSpace: 'pre-wrap', fontFamily: 'Montserrat,sans-serif', margin: 0 }}>{"SOLUTIONS:\n1. Single legged balance exercises.\n2. More time in sock (or bare) feet.\n3. Daily application of peppermint oil on bottoms of feet.\n\nNote: Inability to balance on one leg for 20+ seconds could signal brain damage in otherwise healthy individuals (BMJ study — associated with all cause mortality rates)."}</pre>
                      </div>
                    )}
                  </div>
                )
              })()}
              {assessment.id === 'foot' && f.type === 'passfail' && f.failNotes && answers[f.id] && answers[f.id] !== f.options[0] && (
                <div style={{ marginTop: 10, background: C.orange + '08', border: `1px solid ${C.orange}22`, borderRadius: 10, padding: '12px 16px' }}>
                  <div style={{ fontSize: 10, color: C.orange, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>📋 What To Do Next</div>
                  <pre style={{ fontSize: 12, lineHeight: 1.7, color: C.text, whiteSpace: 'pre-wrap', fontFamily: 'Montserrat,sans-serif', margin: 0 }}>{f.failNotes}</pre>
                </div>
              )}
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
        <Btn onClick={saveAssessmentData} disabled={saving} color={hasUnsaved ? C.orange : C.accent}>{saving ? 'Saving...' : hasUnsaved ? '⚠️ Unsaved Changes — Tap to Save' : saved ? '✓ Saved' : '💾 Save Assessment'}</Btn>
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

// ── CLIENT INTAKE FORM ───────────────────────────────────────────────────────
function ClientIntakeForm({ existingClient, onSave, onBack }) {
  // Parse existing intake data from trainerNotes JSON if editing
  const existingIntake = (() => {
    if (!existingClient?.trainerNotes) return {}
    try { return JSON.parse(existingClient.trainerNotes) } catch { return {} }
  })()

  const [form, setForm] = useState({
    name: existingClient?.name || '',
    phone: existingIntake.phone || '',
    email: existingIntake.email || '',
    dob: existingClient?.dob || '',
    gender: existingIntake.gender || '',
    occupation: existingIntake.occupation || '',
    taking_medication: existingIntake.taking_medication || '',
    medication_list: existingIntake.medication_list || '',
    pre_existing_conditions: existingIntake.pre_existing_conditions || '',
    conditions_description: existingIntake.conditions_description || '',
    nutrition_rating: existingIntake.nutrition_rating || '',
    follows_diet: existingIntake.follows_diet || '',
    diet_description: existingIntake.diet_description || '',
    short_term_goals: existingIntake.short_term_goals || existingClient?.goal || '',
    long_term_goals: existingIntake.long_term_goals || '',
    commitment_rating: existingIntake.commitment_rating || '',
    motivation: existingIntake.motivation || '',
    activity_level: existingIntake.activity_level || '',
    sleep_hours: existingIntake.sleep_hours || '',
    stress_rating: existingIntake.stress_rating || '',
    mental_health_challenges: existingIntake.mental_health_challenges || '',
    mental_health_discuss: existingIntake.mental_health_discuss || '',
    fitness_experience: existingIntake.fitness_experience || '',
    training_methods: existingIntake.training_methods || '',
    support_system: existingIntake.support_system || '',
    preferred_days: existingIntake.preferred_days || [],
    preferred_times: existingIntake.preferred_times || [],
    has_gym: existingIntake.has_gym || '',
    gym_name: existingIntake.gym_name || '',
    planning_gym: existingIntake.planning_gym || '',
    financial_concerns: existingIntake.financial_concerns || '',
    financial_concerns_description: existingIntake.financial_concerns_description || '',
    referral_source: existingIntake.referral_source || '',
    referral_other: existingIntake.referral_other || '',
    additional_info: existingIntake.additional_info || '',
  })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})

  const isEdit = !!existingClient

  const update = (key, val) => {
    setForm(f => ({ ...f, [key]: val }))
    if (errors[key]) setErrors(e => ({ ...e, [key]: null }))
  }

  const toggleArray = (key, val) => {
    setForm(f => {
      const arr = f[key] || []
      return { ...f, [key]: arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val] }
    })
  }

  const handleSave = async () => {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Client name is required'
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    setSaving(true)
    try {
      // Store all intake data as JSON in trainerNotes
      const { name, dob, short_term_goals, long_term_goals, ...intakeFields } = form
      const intakeJson = JSON.stringify({ ...intakeFields, short_term_goals, long_term_goals })
      const goal = [short_term_goals, long_term_goals].filter(Boolean).join(' | ')

      const clientData = isEdit
        ? { ...existingClient, name, dob, goal, equipment: existingClient.equipment || '', trainerNotes: intakeJson }
        : { id: makeId(), name, dob, goal, equipment: '', trainerNotes: intakeJson, assessments: {} }
      await saveClient(clientData)
      onSave(clientData)
    } catch (e) {
      alert('Error saving: ' + e.message)
    }
    setSaving(false)
  }

  // Shared styles
  const labelStyle = { display: 'block', fontSize: 11, color: C.sub, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }
  const inputStyle = (key) => ({ width: '100%', background: C.faint, border: `1px solid ${errors[key] ? C.red : C.border}`, borderRadius: 8, padding: '10px 12px', fontFamily: 'Montserrat,sans-serif', fontSize: 13, outline: 'none', boxSizing: 'border-box' })
  const sectionStyle = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '22px 24px', marginBottom: 16 }
  const sectionTitle = (icon, title) => (
    <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 2, color: C.accent, textTransform: 'uppercase', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
      <span>{icon}</span>{title}
    </div>
  )

  const TextInput = ({ k, label, type = 'text', placeholder = '', required = false }) => (
    <div style={{ marginBottom: 14 }}>
      <label style={labelStyle}>{label}{required && <span style={{ color: C.red, marginLeft: 3 }}>*</span>}</label>
      <input type={type} value={form[k]} onChange={e => update(k, e.target.value)} placeholder={placeholder} style={inputStyle(k)} />
      {errors[k] && <div style={{ fontSize: 11, color: C.red, fontWeight: 600, marginTop: 4 }}>{errors[k]}</div>}
    </div>
  )

  const TextArea = ({ k, label, placeholder = '', rows = 3 }) => (
    <div style={{ marginBottom: 14 }}>
      <label style={labelStyle}>{label}</label>
      <textarea value={form[k]} onChange={e => update(k, e.target.value)} placeholder={placeholder} rows={rows} style={{ ...inputStyle(k), resize: 'vertical' }} />
    </div>
  )

  const YesNo = ({ k, label }) => (
    <div style={{ marginBottom: 14 }}>
      <label style={labelStyle}>{label}</label>
      <div style={{ display: 'flex', gap: 8 }}>
        {['Yes', 'No'].map(opt => (
          <button key={opt} onClick={() => update(k, opt)} style={{ padding: '8px 20px', borderRadius: 8, border: `1.5px solid ${form[k] === opt ? C.accent : C.border}`, background: form[k] === opt ? C.accent + '15' : C.faint, color: form[k] === opt ? C.accent : C.sub, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>{opt}</button>
        ))}
      </div>
    </div>
  )

  const Rating = ({ k, label, max = 10 }) => (
    <div style={{ marginBottom: 14 }}>
      <label style={labelStyle}>{label}</label>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {Array.from({ length: max }, (_, i) => i + 1).map(n => (
          <button key={n} onClick={() => update(k, n.toString())} style={{ width: 36, height: 36, borderRadius: 8, border: `1.5px solid ${form[k] === n.toString() ? C.accent : C.border}`, background: form[k] === n.toString() ? C.accent : C.faint, color: form[k] === n.toString() ? '#000' : C.sub, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{n}</button>
        ))}
      </div>
    </div>
  )

  const Select = ({ k, label, options }) => (
    <div style={{ marginBottom: 14 }}>
      <label style={labelStyle}>{label}</label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {options.map(opt => (
          <button key={opt} onClick={() => update(k, opt)} style={{ padding: '9px 14px', borderRadius: 8, border: `1.5px solid ${form[k] === opt ? C.accent : C.border}`, background: form[k] === opt ? C.accent + '15' : C.faint, color: form[k] === opt ? C.accent : C.text, fontFamily: 'Montserrat,sans-serif', fontWeight: form[k] === opt ? 700 : 500, fontSize: 12, cursor: 'pointer', textAlign: 'left' }}>{opt}</button>
        ))}
      </div>
    </div>
  )

  const MultiSelect = ({ k, label, options }) => (
    <div style={{ marginBottom: 14 }}>
      <label style={labelStyle}>{label}</label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {options.map(opt => {
          const selected = (form[k] || []).includes(opt)
          return (
            <button key={opt} onClick={() => toggleArray(k, opt)} style={{ padding: '8px 14px', borderRadius: 8, border: `1.5px solid ${selected ? C.accent : C.border}`, background: selected ? C.accent + '15' : C.faint, color: selected ? C.accent : C.sub, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>{opt}</button>
          )
        })}
      </div>
    </div>
  )

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 24px 32px' }}>
      <LogoHeader />
      <button onClick={onBack} style={{ background: 'none', border: `1px solid ${C.border}`, color: C.sub, borderRadius: 7, padding: '6px 14px', fontSize: 12, cursor: 'pointer', marginBottom: 24 }}>← Back</button>

      <div style={{ fontWeight: 800, fontSize: 24, letterSpacing: 3, color: C.text, marginBottom: 4 }}>{isEdit ? 'EDIT CLIENT' : 'CLIENT INTAKE FORM'}</div>
      <div style={{ fontSize: 12, color: C.sub, marginBottom: 24, lineHeight: 1.6 }}>Please fill out this form as accurately as possible. This will help us tailor your training program to your unique needs and goals. All information provided is confidential.</div>

      {/* ── Personal Information ── */}
      <div style={sectionStyle}>
        {sectionTitle('👤', 'Personal Information')}
        <TextInput k="name" label="Full Name" required placeholder="e.g. John Smith" />
        <TextInput k="phone" label="Phone Number" type="tel" placeholder="e.g. (555) 123-4567" />
        <TextInput k="email" label="Email Address" type="email" placeholder="e.g. john@example.com" />
        <TextInput k="dob" label="Date of Birth" type="date" />
        <Select k="gender" label="Gender" options={['Male', 'Female', 'Other']} />
        <TextInput k="occupation" label="Occupation" placeholder="e.g. Office worker, construction, nurse..." />
      </div>

      {/* ── Health & Medical ── */}
      <div style={sectionStyle}>
        {sectionTitle('🩺', 'Health & Medical Information')}
        <YesNo k="taking_medication" label="Are you currently taking any medication?" />
        {form.taking_medication === 'Yes' && <TextArea k="medication_list" label="If yes, please list them" placeholder="List all current medications..." rows={2} />}
        <YesNo k="pre_existing_conditions" label="Do you have any pre-existing injuries or medical conditions?" />
        {form.pre_existing_conditions === 'Yes' && <TextArea k="conditions_description" label="If yes, please describe" placeholder="Describe injuries, conditions, surgeries..." rows={2} />}
      </div>

      {/* ── Nutrition ── */}
      <div style={sectionStyle}>
        {sectionTitle('🥗', 'Nutrition')}
        <Rating k="nutrition_rating" label="How would you rate your overall nutrition in the last 90 days? (1 = poor, 10 = excellent)" />
        <YesNo k="follows_diet" label="Do you follow any specific diet or nutrition plan?" />
        {form.follows_diet === 'Yes' && <TextArea k="diet_description" label="If yes, please describe" placeholder="e.g. Keto, intermittent fasting, meal prep..." rows={2} />}
      </div>

      {/* ── Goals ── */}
      <div style={sectionStyle}>
        {sectionTitle('🎯', 'Goals')}
        <TextArea k="short_term_goals" label="What are your short-term goals? (within the next 3-6 months)" placeholder="e.g. Lose 10 lbs, improve flexibility, reduce back pain..." rows={3} />
        <TextArea k="long_term_goals" label="What are your long-term goals? (6 months and beyond)" placeholder="e.g. Run a marathon, build lean muscle, maintain active lifestyle..." rows={3} />
      </div>

      {/* ── Commitment & Motivation ── */}
      <div style={sectionStyle}>
        {sectionTitle('💪', 'Commitment & Motivation')}
        <Rating k="commitment_rating" label="How would you rate your overall commitment to achieving your fitness goals? (1 = low, 10 = high)" />
        <TextArea k="motivation" label="What motivates you to achieve your goals?" placeholder="What drives you? What does success look like?" rows={3} />
      </div>

      {/* ── Lifestyle & Activity Level ── */}
      <div style={sectionStyle}>
        {sectionTitle('🏃', 'Lifestyle & Activity Level')}
        <Select k="activity_level" label="How would you describe your current activity level?" options={[
          'Sedentary (little or no exercise)',
          'Lightly active (light exercise or sports 1-3 days/week)',
          'Moderately active (moderate exercise or sports 3-5 days/week)',
          'Very active (hard exercise or sports 6-7 days/week)',
          'Super active (very intense exercise or physical job)',
        ]} />
        <Select k="sleep_hours" label="How many hours of sleep do you typically get each night?" options={[
          'Less than 5 hours',
          '5-6 hours',
          '7-8 hours',
          '9+ hours',
        ]} />
        <Rating k="stress_rating" label="On a scale of 1-10, how would you rate your current stress levels? (1 = low, 10 = high)" />
        <YesNo k="mental_health_challenges" label="Do you currently deal with any mental health challenges? (e.g., anxiety, depression)" />
        {form.mental_health_challenges === 'Yes' && <YesNo k="mental_health_discuss" label="Would you like to discuss this further?" />}
      </div>

      {/* ── Fitness Experience ── */}
      <div style={sectionStyle}>
        {sectionTitle('🏋️', 'Fitness Experience')}
        <Select k="fitness_experience" label="What is your previous experience with fitness or personal training?" options={['Beginner', 'Intermediate', 'Advanced']} />
        <TextArea k="training_methods" label="Any specific training methods or programs you've followed?" placeholder="e.g. CrossFit, bodybuilding, yoga, P90X..." rows={2} />
      </div>

      {/* ── Support System ── */}
      <div style={sectionStyle}>
        {sectionTitle('🤝', 'Support System')}
        <YesNo k="support_system" label="Do you have a support system in place (e.g., friends, family) to help you achieve your fitness goals?" />
      </div>

      {/* ── Scheduling Preferences ── */}
      <div style={sectionStyle}>
        {sectionTitle('📅', 'Scheduling Preferences')}
        <MultiSelect k="preferred_days" label="Preferred days for personal training sessions" options={['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']} />
        <MultiSelect k="preferred_times" label="Preferred times for sessions" options={['Morning (7 AM - 12 PM)', 'Afternoon (12 PM - 5 PM)', 'Evening (5 PM - 9 PM)']} />
      </div>

      {/* ── Gym Membership ── */}
      <div style={sectionStyle}>
        {sectionTitle('🏢', 'Gym Membership')}
        <YesNo k="has_gym" label="Do you currently belong to a gym?" />
        {form.has_gym === 'Yes' && <TextInput k="gym_name" label="Which gym?" placeholder="e.g. Planet Fitness, LA Fitness..." />}
        {form.has_gym === 'No' && <YesNo k="planning_gym" label="Are you planning to join a gym in the near future?" />}
      </div>

      {/* ── Financial Considerations ── */}
      <div style={sectionStyle}>
        {sectionTitle('💰', 'Financial Considerations')}
        <YesNo k="financial_concerns" label="Are there any concerns you have about committing to personal training sessions?" />
        {form.financial_concerns === 'Yes' && <TextArea k="financial_concerns_description" label="If yes, please briefly describe" placeholder="Budget constraints, scheduling conflicts..." rows={2} />}
      </div>

      {/* ── Referral Source ── */}
      <div style={sectionStyle}>
        {sectionTitle('📣', 'Referral Source')}
        <Select k="referral_source" label="How did you hear about FreddyFit Personal Training?" options={['Social Media', 'Referral from a friend/family', 'Google Search', 'Advertisement', 'Other']} />
        {form.referral_source === 'Other' && <TextInput k="referral_other" label="Please specify" placeholder="How did you find us?" />}
      </div>

      {/* ── Additional Information ── */}
      <div style={sectionStyle}>
        {sectionTitle('📝', 'Additional Information')}
        <TextArea k="additional_info" label="Is there anything else you'd like us to know about you, your fitness journey, or your goals?" placeholder="Anything else we should know..." rows={4} />
      </div>

      {/* ── Save ── */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', padding: '8px 0 20px' }}>
        <Btn onClick={onBack} outline color={C.sub}>Cancel</Btn>
        <Btn onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : isEdit ? '✓ Save Changes' : '+ Add Client'}</Btn>
      </div>
    </div>
  )
}

// ── PROTOCOL ADVISOR ─────────────────────────────────────────────────────────
function ProtocolAdvisor({ client, onBack }) {
  const [analysis, setAnalysis] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  // Extract all failures from completed assessments
  const getFindings = () => {
    const findings = []
    Object.entries(client.assessments || {}).forEach(([assessmentId, data]) => {
      const a = ALL_ASSESSMENTS[assessmentId]
      if (!a) return
      const fields = a.sections.flatMap(s => s.fields)
      fields.forEach(f => {
        // Prime 8 style: rating-based failures
        const ratingKey = `${f.id}_rating`
        const modKey = `${f.id}_modifier`
        const modConfirmedKey = `${f.id}_mod_confirmed`
        const modRatingKey = `${f.id}_mod_rating`
        const rating = data[ratingKey]
        const modifier = data[modKey]
        const modConfirmed = data[modConfirmedKey]
        const modRating = data[modRatingKey]

        // Determine if modifier worked: check explicit yes/no confirmation first,
        // then check re-rating (re-rate >=8 means it worked)
        let modifierWorked = null
        if (modConfirmed === 'yes') modifierWorked = true
        else if (modConfirmed === 'no') modifierWorked = false
        else if (modRating) modifierWorked = parseInt(modRating) >= 8
        else if (modifier && modifier.startsWith('No modifier')) modifierWorked = false

        if (rating && parseInt(rating) <= 7) {
          findings.push({
            assessment: a.name,
            test: f.label,
            rating: parseInt(rating),
            modRating: modRating ? parseInt(modRating) : null,
            modifier: modifier || null,
            modifierWorked,
            failNotes: f.failNotes || null,
            fieldId: f.id,
          })
          return
        }

        // Pass/fail style failures
        const val = data[f.id]
        if (f.type === 'passfail' && val && val !== 'Pass' && val !== 'No change' && val !== '') {
          const isFail = val === 'Fail' || val.startsWith('Fail') || val.includes('Yes')
          if (isFail) {
            findings.push({
              assessment: a.name,
              test: f.label,
              rating: null,
              result: val,
              modifier: modifier || null,
              modifierWorked,
              failNotes: f.failNotes || null,
              fieldId: f.id,
            })
          }
        }

        // Finger widths (neck rotation)
        const fwKey = `${f.id}_finger_widths`
        if (data[fwKey] === '3+') {
          findings.push({
            assessment: a.name,
            test: f.label,
            rating: null,
            result: '3+ finger widths (FAIL)',
            failNotes: f.failNotes || null,
            fieldId: f.id,
          })
        }
      })
    })
    return findings
  }

  const findings = getFindings()

  const analyze = async () => {
    if (findings.length === 0) { setError('No failed tests found in assessments.'); return }
    setGenerating(true); setError(''); setAnalysis('')

    const findingsText = findings.map((f, i) => {
      let line = `${i + 1}. [${f.assessment}] ${f.test}`
      if (f.rating !== null && f.rating !== undefined) line += ` — Rating: ${f.rating}/10`
      if (f.result) line += ` — Result: ${f.result}`
      if (f.modifier) {
        let modStatus = f.modifierWorked === true ? 'WORKED' : f.modifierWorked === false ? 'DID NOT WORK' : 'Not yet tested'
        if (f.modRating) modStatus += ` (re-rated to ${f.modRating}/10)`
        line += ` | Modifier tried: "${f.modifier}" → ${modStatus}`
      }
      if (f.failNotes) line += `\n   Protocol notes: ${f.failNotes.split('\n').slice(0, 3).join(' | ')}`
      return line
    }).join('\n')

    try {
      const text = await callClaude([{ role: 'user', content: `You are an expert corrective exercise specialist and personal trainer working with the FreddyFit assessment system.

A client has completed their assessments. Below are ALL the failed tests and their associated corrective protocol notes.

CLIENT: ${client.name}
GOAL: ${client.goal || 'Not specified'}

═══ FAILED TESTS & PROTOCOL NOTES ═══
${findingsText}

═══ YOUR TASK ═══
Analyze ALL findings and produce a PRIORITIZED corrective protocol action plan. Group related failures together where they share a root cause.

FORMAT YOUR RESPONSE EXACTLY LIKE THIS:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CORRECTIVE PROTOCOL ACTION PLAN
Client: ${client.name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

QUICK SUMMARY
(2-3 sentences: What are the main patterns? What's the biggest concern?)

───────────────────────────────────
🔴 URGENT — Address First
───────────────────────────────────
(Protocols that involve pain, sensitivity, structural concerns, or tests where NO modifier worked. These need attention before progressing.)

For each protocol:
  PROTOCOL: [Protocol Name]
  WHY URGENT: [Brief reason — pain, structural, nerve involvement, etc.]
  BASED ON: [Which failed test(s) — include ratings]
  ACTION: [What to do — specific corrective exercises, sets x reps, or referral]
  SEND TO APP: [Name of the corrective protocol to build in the workout app]

───────────────────────────────────
🟡 IMPORTANT — Address in Weeks 1-4
───────────────────────────────────
(Protocols where a modifier DID work, or functional failures that affect training safety.)

Same format as above.

───────────────────────────────────
🟢 MAINTENANCE — Ongoing Correctives
───────────────────────────────────
(Lower-priority items, minor asymmetries, or things to monitor over time.)

Same format as above.

───────────────────────────────────
⚠️ FLAGS & REFERRALS
───────────────────────────────────
(Anything that needs medical referral, imaging, or specialist attention. Include "No modifier worked" items.)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROTOCOL CHECKLIST (for workout app)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
(Numbered list of all corrective protocols to create in the workout app, in priority order. Just the protocol names.)

IMPORTANT:
- Only reference protocols mentioned in the assessment notes (DUCK PROTOCOL, PIGEON PROTOCOL, CALFZILLA, LE BUTTE, NECK SAVVY, LEONARDO DA NECKY, NECK MATE, KING ATLAS, HIP HIP HOORAY, PELVIS PRESLEY, BEES KNEES, SHOULDER SAVIOR, SHOULDER STORY, SHOULDER SUPERIOR, THORACIC PARK, ROTATOR CUP, BREAKTHROUGH, WING NUT, SUPER SHOULDER DOWN, EDGAR ALLAN ELBOW, etc.)
- Do NOT invent protocols that aren't in the data
- If a modifier was confirmed working, that tells you which protocol to use
- If no modifier worked, flag it as needing deeper investigation
- Be specific about which side (Left/Right) when applicable` }], 4000)
      setAnalysis(text)
    } catch (e) { setError('Error: ' + e.message) }
    setGenerating(false)
  }

  const printAnalysis = () => window.print()

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 24px 32px' }}>
      <LogoHeader />
      <button onClick={onBack} style={{ background: 'none', border: `1px solid ${C.border}`, color: C.sub, borderRadius: 7, padding: '6px 14px', fontSize: 12, cursor: 'pointer', marginBottom: 24 }}>← Back to Client</button>
      <div style={{ fontWeight: 800, fontSize: 26, letterSpacing: 3, color: C.text, marginBottom: 4 }}>{client.name}</div>
      <div style={{ fontSize: 12, color: C.sub, marginBottom: 24 }}>Protocol Advisor · {Object.keys(client.assessments || {}).length} assessments on file</div>

      {/* Findings summary */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '22px 24px', marginBottom: 20 }}>
        <div style={{ fontSize: 10, color: C.sub, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700, marginBottom: 12 }}>Assessment Findings</div>
        {findings.length === 0 ? (
          <div style={{ fontSize: 13, color: C.sub, padding: '20px 0', textAlign: 'center' }}>No failed tests found. All assessments are passing.</div>
        ) : (
          <>
            <div style={{ fontSize: 13, color: C.text, marginBottom: 14, fontWeight: 600 }}>{findings.length} failed test{findings.length !== 1 ? 's' : ''} found across {Object.keys(client.assessments || {}).length} assessment{Object.keys(client.assessments || {}).length !== 1 ? 's' : ''}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' }}>
              {findings.map((f, i) => (
                <div key={i} style={{ padding: '10px 12px', background: C.faint, borderRadius: 8, border: `1px solid ${C.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ minWidth: 44, textAlign: 'center' }}>
                      {f.rating !== null && f.rating !== undefined ? (
                        <span style={{ fontWeight: 800, fontSize: 16, color: f.rating <= 4 ? C.red : C.orange }}>{f.rating}</span>
                      ) : (
                        <span style={{ fontWeight: 800, fontSize: 12, color: C.red }}>FAIL</span>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{f.test}</div>
                      <div style={{ fontSize: 10, color: C.sub }}>{f.assessment}</div>
                    </div>
                    {f.modifierWorked === false && <span style={{ fontSize: 9, background: C.red + '15', color: C.red, borderRadius: 10, padding: '2px 8px', fontWeight: 700, whiteSpace: 'nowrap' }}>No fix</span>}
                    {f.modifierWorked === true && <span style={{ fontSize: 9, background: C.green + '15', color: C.green, borderRadius: 10, padding: '2px 8px', fontWeight: 700, whiteSpace: 'nowrap' }}>Fixed</span>}
                    {f.modifier && f.modifierWorked === null && <span style={{ fontSize: 9, background: C.orange + '15', color: C.orange, borderRadius: 10, padding: '2px 8px', fontWeight: 700, whiteSpace: 'nowrap' }}>Not re-rated</span>}
                  </div>
                  {f.modifier && (
                    <div style={{ marginTop: 6, marginLeft: 54, fontSize: 10, color: C.sub, lineHeight: 1.6 }}>
                      Modifier: {f.modifier}
                      {f.modRating !== null && f.modRating !== undefined ? (
                        <span style={{ color: f.modRating >= 8 ? C.green : C.orange, fontWeight: 700 }}> · Re-rated: {f.modRating}/10</span>
                      ) : (
                        <span style={{ color: C.orange, fontWeight: 700 }}> · Step 3 re-rate: not saved</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Generate button */}
      {findings.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, padding: '0 4px' }}>
          <div style={{ fontSize: 11, color: C.sub }}>Analyzes all failures, groups root causes, and ranks corrective protocols by urgency</div>
          <Btn onClick={analyze} disabled={generating}>{generating ? '⏳ Analyzing...' : '⚡ Analyze & Prioritize'}</Btn>
        </div>
      )}

      {error && <div style={{ background: C.red + '12', border: `1px solid ${C.red}44`, borderRadius: 10, padding: '12px 16px', fontSize: 13, color: C.red, marginBottom: 16 }}>{error}</div>}
      {generating && <><Spinner /><div style={{ textAlign: 'center', fontSize: 12, color: C.sub, marginTop: 4 }}>Analyzing assessment findings and prioritizing protocols...</div></>}

      {analysis && (
        <div style={{ background: C.card, border: `2px solid ${C.orange}44`, borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ background: `linear-gradient(135deg,${C.orange}18,${C.orange}08)`, borderBottom: `1px solid ${C.orange}33`, padding: '16px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14, letterSpacing: 2, color: C.orange }}>CORRECTIVE PROTOCOL ACTION PLAN</div>
              <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>{client.name} · Generated {new Date().toLocaleDateString()}</div>
            </div>
            <Btn onClick={printAnalysis} small>🖨 Print / PDF</Btn>
          </div>
          <div style={{ padding: 24 }}>
            <pre style={{ fontSize: 12, lineHeight: 2, color: C.text, whiteSpace: 'pre-wrap', fontFamily: 'Montserrat,sans-serif', margin: 0 }}>{analysis}</pre>
          </div>
        </div>
      )}

      <style>{`@media print { .no-print { display: none !important; } }`}</style>
    </div>
  )
}

// ── CLIENT PROFILE ────────────────────────────────────────────────────────────
function ClientProfile({ client, onUpdate, onRunAssessment, onBuildProgram, onGenerateWorkout, onProtocolAdvisor, onEditClient, onBack }) {
  const assessmentsDone = Object.keys(client.assessments || {})
  const [showIntake, setShowIntake] = useState(false)

  // Parse intake data from trainerNotes JSON
  const intake = (() => {
    if (!client.trainerNotes) return null
    try { return JSON.parse(client.trainerNotes) } catch { return null }
  })()

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
          <Btn onClick={() => onProtocolAdvisor(client)} small color={C.orange}>🩺 Protocols</Btn>
          <Btn onClick={() => onGenerateWorkout(client)} small>💪 Workout</Btn>
          <Btn onClick={() => onBuildProgram(client)} small>📋 Program</Btn>
          <Btn onClick={() => onEditClient(client)} outline small color={C.sub}>✏️ Edit</Btn>
        </div>
      </div>

      {/* Intake Summary */}
      {intake ? (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 20px', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setShowIntake(!showIntake)}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: C.accent, textTransform: 'uppercase' }}>📋 Client Intake</div>
            <span style={{ fontSize: 11, color: C.sub }}>{showIntake ? '▲ Hide' : '▼ View Details'}</span>
          </div>
          {!showIntake && (
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 10 }}>
              {intake.phone && <div style={{ fontSize: 11, color: C.sub }}>{intake.phone}</div>}
              {intake.email && <div style={{ fontSize: 11, color: C.sub }}>{intake.email}</div>}
              {intake.fitness_experience && <span style={{ fontSize: 10, background: C.accent + '15', color: C.accent, borderRadius: 10, padding: '2px 10px', fontWeight: 700 }}>{intake.fitness_experience}</span>}
              {intake.activity_level && <span style={{ fontSize: 10, background: C.teal + '15', color: C.teal, borderRadius: 10, padding: '2px 10px', fontWeight: 700 }}>{intake.activity_level.split('(')[0].trim()}</span>}
            </div>
          )}
          {showIntake && (() => {
            const Section = ({ title, items }) => {
              const filtered = items.filter(([, v]) => v && v !== '' && !(Array.isArray(v) && v.length === 0))
              if (filtered.length === 0) return null
              return (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: C.sub, textTransform: 'uppercase', marginBottom: 6 }}>{title}</div>
                  {filtered.map(([label, val]) => (
                    <div key={label} style={{ display: 'flex', gap: 8, padding: '4px 0', fontSize: 12, borderBottom: `1px solid ${C.border}22` }}>
                      <span style={{ color: C.sub, minWidth: 140, fontWeight: 600 }}>{label}</span>
                      <span style={{ color: C.text }}>{Array.isArray(val) ? val.join(', ') : val}</span>
                    </div>
                  ))}
                </div>
              )
            }
            return (
              <div>
                <Section title="Personal" items={[
                  ['Phone', intake.phone], ['Email', intake.email], ['Gender', intake.gender], ['Occupation', intake.occupation],
                ]} />
                <Section title="Health & Medical" items={[
                  ['Medication', intake.taking_medication], ['Medications', intake.medication_list],
                  ['Conditions', intake.pre_existing_conditions], ['Details', intake.conditions_description],
                ]} />
                <Section title="Nutrition" items={[
                  ['Rating (90 days)', intake.nutrition_rating ? `${intake.nutrition_rating}/10` : ''],
                  ['Follows diet', intake.follows_diet], ['Diet', intake.diet_description],
                ]} />
                <Section title="Goals" items={[
                  ['Short-term', intake.short_term_goals], ['Long-term', intake.long_term_goals],
                ]} />
                <Section title="Commitment" items={[
                  ['Rating', intake.commitment_rating ? `${intake.commitment_rating}/10` : ''],
                  ['Motivation', intake.motivation],
                ]} />
                <Section title="Lifestyle" items={[
                  ['Activity level', intake.activity_level], ['Sleep', intake.sleep_hours],
                  ['Stress', intake.stress_rating ? `${intake.stress_rating}/10` : ''],
                  ['Mental health', intake.mental_health_challenges],
                ]} />
                <Section title="Experience" items={[
                  ['Level', intake.fitness_experience], ['Methods', intake.training_methods],
                ]} />
                <Section title="Scheduling" items={[
                  ['Days', intake.preferred_days], ['Times', intake.preferred_times],
                ]} />
                <Section title="Gym" items={[
                  ['Member', intake.has_gym], ['Gym', intake.gym_name], ['Planning to join', intake.planning_gym],
                ]} />
                <Section title="Other" items={[
                  ['Referral', intake.referral_source === 'Other' ? intake.referral_other : intake.referral_source],
                  ['Support system', intake.support_system],
                  ['Financial concerns', intake.financial_concerns === 'Yes' ? intake.financial_concerns_description || 'Yes' : intake.financial_concerns],
                  ['Additional info', intake.additional_info],
                ]} />
              </div>
            )
          })()}
        </div>
      ) : (
        <div style={{ background: C.faint, border: `1px dashed ${C.border}`, borderRadius: 14, padding: '16px 20px', marginBottom: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: C.sub, marginBottom: 8 }}>No intake form on file</div>
          <Btn onClick={() => onEditClient(client)} small outline color={C.sub}>Fill Out Intake Form</Btn>
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
function ClientRoster({ onSelectClient, onNewClient }) {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

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
        <Btn onClick={onNewClient}>+ New Client</Btn>
      </div>

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
  const openIntake = () => { setClient(null); setView('intake') }
  const openEditClient = (c) => { setClient(c); setView('editClient') }

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
        {view !== 'roster' && (
          <div style={{ fontSize: 12, color: C.sub }}>
            {view === 'intake' ? 'New Client' : view === 'assessment' ? assessment?.name : view === 'program' ? 'Program Builder' : view === 'workout' ? 'Workout Generator' : view === 'protocols' ? 'Protocol Advisor' : view === 'editClient' ? 'Edit Client' : client?.name}
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {view === 'roster' && <ClientRoster onSelectClient={goToClient} onNewClient={openIntake} />}
        {view === 'client' && client && (
          <ClientProfile
            client={client}
            onUpdate={updateClient}
            onRunAssessment={runAssessment}
            onBuildProgram={c => { setClient(c); setView('program') }}
            onGenerateWorkout={c => { setClient(c); setView('workout') }}
            onProtocolAdvisor={c => { setClient(c); setView('protocols') }}
            onEditClient={openEditClient}
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
        {view === 'protocols' && client && (
          <ProtocolAdvisor
            client={client}
            onBack={() => setView('client')}
          />
        )}
        {view === 'intake' && (
          <ClientIntakeForm
            onSave={(c) => { goToClient({ ...c, assessments: {} }) }}
            onBack={() => setView('roster')}
          />
        )}
        {view === 'editClient' && client && (
          <ClientIntakeForm
            existingClient={client}
            onSave={(c) => { updateClient({ ...client, ...c }); setView('client') }}
            onBack={() => setView('client')}
          />
        )}
      </div>
    </div>
  )
}
