'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { getAllClients, saveClient, deleteClient, getAssessmentsForClient, saveAssessment, getProgramForClient, saveProgram, saveWorkout, getWorkoutsForClient } from '../lib/supabase'
import { ALL_ASSESSMENTS, MAIN_ASSESSMENTS, C } from '../lib/assessments'
import { FIELD_MODIFIERS } from '../lib/modifiers'
import { QRCodeCanvas } from 'qrcode.react'

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
    if (f.type === 'info') return (
      <div style={{ padding: '12px 16px', background: C.sky + '10', border: `1px solid ${C.sky}33`, borderRadius: 10, fontSize: 12, color: C.text, lineHeight: 1.7, fontFamily: 'Montserrat,sans-serif' }}>
        📋 {f.text}
      </div>
    )
    if (f.type === 'textarea') return <textarea value={val} onChange={e => set(f.id, e.target.value)} rows={3} style={{ ...base, resize: 'vertical' }} placeholder={f.placeholder || ''} />
    if (f.type === 'passfail') {
      // Prime 8 and fields with inline modifiers use the rating system instead
      if (assessment.id === 'prime8' || f.modifiers) return null
      return (
        <div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {f.options.map(o => <button key={o} onClick={() => set(f.id, o)} style={{ padding: '8px 16px', borderRadius: 7, border: `1.5px solid ${val === o ? C.accent : C.border}`, background: val === o ? C.accent + '20' : 'white', color: val === o ? C.accent : C.sub, fontFamily: 'Montserrat,sans-serif', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>{o}</button>)}
          </div>
          {f.optionNotes && val && f.optionNotes[val] && (
            <div style={{ marginTop: 10, padding: '10px 14px', background: C.accent + '10', border: `1px solid ${C.accent}33`, borderRadius: 8, fontSize: 12, fontWeight: 700, color: C.accent, fontFamily: 'Montserrat,sans-serif' }}>
              → {f.optionNotes[val]}
            </div>
          )}
        </div>
      )
    }
    if (f.type === 'fingerWidthsHFP') {
      const fwKey = f.id
      const fw = parseInt(val) || 0
      const passLimit = f.fingerWidthsPass || 3
      const isFail = fw > passLimit
      const isPass = fw > 0 && fw <= passLimit
      const wallTestKey = `${f.id}_wall_test`
      const wallRating = parseInt(answers[wallTestKey]) || 0
      return (
        <div>
          <div style={{ fontSize: 11, color: C.sub, fontWeight: 700, marginBottom: 6 }}>How many finger widths between earlobe and AC joint?</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[1,2,3,4,5,6].map(n => {
              const selected = fw === n
              const fail = n > passLimit
              return (
                <button key={n} onClick={() => { set(fwKey, n.toString()); if (n <= passLimit) set(wallTestKey, '') }} style={{
                  width: 40, height: 40, borderRadius: 8,
                  border: `2px solid ${selected ? (fail ? C.red : C.green) : C.border}`,
                  background: selected ? (fail ? C.red : C.green) : 'white',
                  color: selected ? 'white' : fail ? C.red : C.green,
                  fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif'
                }}>{n}</button>
              )
            })}
          </div>
          {isPass && (
            <div style={{ marginTop: 8, fontSize: 11, fontWeight: 800, color: C.green }}>✓ PASS — {fw} finger width{fw !== 1 ? 's' : ''}</div>
          )}
          {isFail && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.red, marginBottom: 8 }}>✗ FAIL — {fw} finger widths (4+ = forward head posture)</div>
              <div style={{ padding: '12px 14px', background: C.orange + '10', border: `1px solid ${C.orange}33`, borderRadius: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, color: C.orange, textTransform: 'uppercase', marginBottom: 8 }}>Perform Empty Can Against the Wall</div>
                <div style={{ fontSize: 11, color: C.sub, marginBottom: 8 }}>Rate 1–10 (8+ = Pass)</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {[1,2,3,4,5,6,7,8,9,10].map(n => {
                    const selected = wallRating === n
                    const btnFail = n <= 7
                    return (
                      <button key={n} onClick={() => set(wallTestKey, n.toString())} style={{
                        width: 32, height: 32, borderRadius: 7,
                        border: `1.5px solid ${selected ? (btnFail ? C.red : C.green) : C.border}`,
                        background: selected ? (btnFail ? C.red : C.green) : 'white',
                        color: selected ? 'white' : btnFail ? C.red : C.green,
                        fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif'
                      }}>{n}</button>
                    )
                  })}
                </div>
                {wallRating >= 8 && (
                  <div style={{ marginTop: 8, fontSize: 11, fontWeight: 800, color: C.green }}>✓ PASS — {wallRating}/10 — Forward head posture is causing shoulder problems</div>
                )}
                {wallRating > 0 && wallRating <= 7 && (
                  <div style={{ marginTop: 8, fontSize: 11, fontWeight: 800, color: C.red }}>✗ FAIL — {wallRating}/10</div>
                )}
              </div>
            </div>
          )}
        </div>
      )
    }
    if (f.type === 'neckConclusion') {
      const threshold = 8
      const earRightWith = parseInt(answers['np_ear_right_with']) || 0
      const earLeftWith = parseInt(answers['np_ear_left_with']) || 0
      const hipRightWith = parseInt(answers['np_seated_hip_right_with']) || 0
      const hipLeftWith = parseInt(answers['np_seated_hip_left_with']) || 0
      const rightStrong = (earRightWith >= threshold) || (hipRightWith >= threshold)
      const leftStrong = (earLeftWith >= threshold) || (hipLeftWith >= threshold)
      const hasData = earRightWith > 0 || earLeftWith > 0 || hipRightWith > 0 || hipLeftWith > 0
      if (!hasData) return <div style={{ fontSize: 12, color: C.sub, fontStyle: 'italic' }}>Complete the tests above to see conclusion</div>
      let conclusion = ''
      let color = C.accent
      if (rightStrong && leftStrong) {
        conclusion = 'Stronger on BOTH sides with hand on neck → Perform Neck Mate or Leonardo Da Necky'
      } else if (rightStrong) {
        conclusion = 'Stronger on RIGHT side with hand on neck → Perform King Atlas Right Upper Neck Protocol'
      } else if (leftStrong) {
        conclusion = 'Stronger on LEFT side with hand on neck → Perform King Atlas Left Upper Neck Protocol'
      } else {
        conclusion = 'No improvement with neck pressure on either side'
        color = C.sub
      }
      return (
        <div style={{ padding: '14px 18px', background: color + '12', border: `2px solid ${color}44`, borderRadius: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, color, textTransform: 'uppercase', marginBottom: 8 }}>Conclusion</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, lineHeight: 1.6 }}>{conclusion}</div>
        </div>
      )
    }
    if (f.type === 'dualRating') {
      const firstKey = f.id
      const secondKey = `${f.id}_with`
      const firstRating = parseInt(answers[firstKey]) || 0
      const secondRating = parseInt(answers[secondKey]) || 0
      const threshold = f.passThreshold || 8
      const renderButtons = (key, rating) => (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {[1,2,3,4,5,6,7,8,9,10].map(n => {
            const selected = rating === n
            const btnFail = n < threshold
            return (
              <button key={n} onClick={() => set(key, n.toString())} style={{
                width: 32, height: 32, borderRadius: 7,
                border: `1.5px solid ${selected ? (btnFail ? C.red : C.green) : C.border}`,
                background: selected ? (btnFail ? C.red : C.green) : 'white',
                color: selected ? 'white' : btnFail ? C.red : C.green,
                fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif'
              }}>{n}</button>
            )
          })}
        </div>
      )
      return (
        <div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, color: C.sub, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>{f.firstLabel}</div>
            {renderButtons(firstKey, firstRating)}
            {firstRating > 0 && firstRating < threshold && (
              <div style={{ marginTop: 6, fontSize: 11, fontWeight: 800, color: C.red }}>✗ {firstRating}/10</div>
            )}
            {firstRating >= threshold && (
              <div style={{ marginTop: 6, fontSize: 11, fontWeight: 800, color: C.green }}>✓ {firstRating}/10</div>
            )}
          </div>
          <div>
            <div style={{ fontSize: 10, color: C.sub, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>{f.secondLabel}</div>
            {renderButtons(secondKey, secondRating)}
            {secondRating > 0 && secondRating < threshold && (
              <div style={{ marginTop: 6, fontSize: 11, fontWeight: 800, color: C.red }}>✗ FAIL — {secondRating}/10</div>
            )}
            {secondRating >= threshold && (
              <div style={{ marginTop: 8, padding: '10px 14px', background: C.accent + '10', border: `1px solid ${C.accent}33`, borderRadius: 8, fontSize: 12, fontWeight: 700, color: C.accent }}>
                ✓ PASS — {secondRating}/10 → {f.passNotes}
              </div>
            )}
          </div>
        </div>
      )
    }
    if (f.type === 'scale') {
      if (f.passThreshold) {
        const rating = parseInt(val) || 0
        const threshold = f.passThreshold
        return (
          <div>
            <div style={{ fontSize: 10, color: C.sub, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Rate 1–{f.max || 10}</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {Array.from({ length: (f.max || 10) - (f.min || 1) + 1 }, (_, i) => i + (f.min || 1)).map(n => {
                const selected = rating === n
                const btnFail = n < threshold
                return (
                  <button key={n} onClick={() => set(f.id, n.toString())} style={{
                    width: 32, height: 32, borderRadius: 7,
                    border: `1.5px solid ${selected ? (btnFail ? C.red : C.green) : C.border}`,
                    background: selected ? (btnFail ? C.red : C.green) : 'white',
                    color: selected ? 'white' : btnFail ? C.red : C.green,
                    fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif'
                  }}>{n}</button>
                )
              })}
            </div>
            {rating > 0 && rating < threshold && f.failNotes && (
              <div style={{ marginTop: 8, fontSize: 11, fontWeight: 800, color: C.red }}>{f.failNotes} — {rating}/10</div>
            )}
            {rating >= threshold && f.passNotes && (
              <div style={{ marginTop: 8, padding: '10px 14px', background: C.accent + '10', border: `1px solid ${C.accent}33`, borderRadius: 8, fontSize: 12, fontWeight: 700, color: C.accent }}>
                ✓ PASS — {rating}/10 → {f.passNotes}
              </div>
            )}
          </div>
        )
      }
      return (
        <div>
          <input type="range" min={f.min || 0} max={f.max || 10} value={val || f.min || 0} onChange={e => set(f.id, e.target.value)} style={{ width: '100%', accentColor: C.accent }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.sub }}><span>{f.min ?? 0}</span><span style={{ fontWeight: 700, color: C.accent }}>{val || f.min || 0}</span><span>{f.max ?? 10}</span></div>
        </div>
      )
    }
    return <input type="text" value={val} onChange={e => set(f.id, e.target.value)} placeholder={f.placeholder || ''} style={base} />
  }

  const renderRatingAndModifier = (f) => {
    if (f.type === 'textarea' || f.type === 'scale' || f.type === 'dualRating' || f.type === 'neckConclusion' || f.type === 'info') return null
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

    // For fields with inline modifiers (gauntlet tests): rate 1-10 first
    const hasInlineModifiers = !!f.modifiers
    const ratingKey = `${f.id}_rating`
    const modKey = `${f.id}_modifier`
    const modConfirmedKey = `${f.id}_mod_confirmed`
    const modRatingKey = `${f.id}_mod_rating`
    const modifier = answers[modKey]
    const modRating = answers[modRatingKey]
    const modRatingNum = parseInt(modRating)
    const initialRating = answers[ratingKey]
    const initialRatingNum = parseInt(initialRating)

    // For inline-modifier fields (gauntlet): use rating-based pass/fail
    // For other fields: use option-based pass/fail
    let isFail, isPass
    if (hasInlineModifiers) {
      isFail = initialRating && initialRatingNum <= 7
      isPass = initialRating && initialRatingNum >= 8
    } else {
      isFail = answers[f.id] && answers[f.id] !== f.options?.[0] && answers[f.id] !== 'Pass'
      isPass = answers[f.id] === f.options?.[0] || answers[f.id] === 'Pass'
    }

    // For inline modifier fields, always show the initial rating buttons
    if (hasInlineModifiers) {
      return (
        <div style={{ marginTop: 10, background: C.faint, borderRadius: 10, padding: '12px 14px', border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 10, color: C.sub, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Rate This Test (1–10)</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {[1,2,3,4,5,6,7,8,9,10].map(n => {
              const isSelected = initialRatingNum === n
              const btnFail = n <= 7
              return (
                <button key={n} onClick={() => {
                  set(ratingKey, n.toString())
                  if (n >= 8) {
                    set(f.id, 'Pass')
                    set(modKey, '')
                    set(modRatingKey, '')
                  } else {
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

          {/* Pass */}
          {isPass && (
            <div style={{ marginTop: 8, fontSize: 11, color: C.green, fontWeight: 700 }}>✓ {initialRating}/10 — Pass, no corrective needed</div>
          )}

          {/* Fail — show fail notes */}
          {isFail && f.failNotes && (
            <div style={{ marginTop: 10, background: C.orange + '08', border: `1px solid ${C.orange}22`, borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ fontSize: 10, color: C.orange, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>📋 Trainer Script</div>
              <pre style={{ fontSize: 12, lineHeight: 1.7, color: C.text, whiteSpace: 'pre-wrap', fontFamily: 'Montserrat,sans-serif', margin: 0 }}>{f.failNotes}</pre>
            </div>
          )}

          {/* Fail — modifier dropdown */}
          {isFail && (() => {
            const modOptions = f.modifiers
            if (!modOptions || modOptions.length === 0) return null
            return (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 10, color: C.red, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Modifiers to try</div>
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

          {/* Re-rate after modifier */}
          {isFail && modifier && !modifier.startsWith('No modifier') && (
            <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 12, paddingTop: 12 }}>
              <div style={{ fontSize: 10, color: C.accent, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Re-rate after {modifier.split('→')[0].trim()} (1–10)</div>
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

          {/* No modifier helped */}
          {isFail && modifier && modifier.startsWith('No modifier') && (
            <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 12, paddingTop: 12 }}>
              <div style={{ padding: '8px 12px', background: C.red + '10', borderRadius: 8, border: `1px solid ${C.red}33`, fontSize: 11, color: C.red, fontWeight: 700, marginBottom: 10 }}>
                ✗ Recorded: {modifier} — flag for deeper investigation / breakout assessments
              </div>
              {(f.id === 'ns_full_can_right' || f.id === 'ns_full_can_left') && (() => {
                const nextKey = `${f.id}_next_step`
                const nextRatingKey = `${f.id}_next_rating`
                const selectedStep = answers[nextKey] || ''
                const stepRating = parseInt(answers[nextRatingKey]) || 0
                const steps = [
                  { id: 'scalene', label: 'Posterior scalene neck tension may compress the long thoracic nerve. Try Wing Nut or Neck Mate' },
                  { id: 'gh', label: 'GH instability may be a factor. Try Rotator Cup Protocol and re-test for strengthening' },
                  { id: 'nerve', label: 'Consider possible long thoracic nerve damage — REFER OUT' },
                ]
                return (
                  <div style={{ background: C.orange + '10', border: `1px solid ${C.orange}33`, borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, color: C.orange, textTransform: 'uppercase', marginBottom: 10 }}>What To Do Next</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {steps.map(s => {
                        const isSelected = selectedStep === s.id
                        return (
                          <button key={s.id} onClick={() => { set(nextKey, s.id); set(nextRatingKey, '') }} style={{
                            textAlign: 'left', padding: '10px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif',
                            border: `2px solid ${isSelected ? C.accent : C.border}22`,
                            background: isSelected ? C.accent + '15' : 'white',
                            color: C.text, fontSize: 12, fontWeight: isSelected ? 700 : 500, lineHeight: 1.5
                          }}>• {s.label}</button>
                        )
                      })}
                    </div>
                    {selectedStep && selectedStep !== 'nerve' && (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: 10, color: C.sub, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Rate After Re-Test (1–10)</div>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {[1,2,3,4,5,6,7,8,9,10].map(n => {
                            const isSelected = stepRating === n
                            const btnFail = n <= 7
                            return (
                              <button key={n} onClick={() => set(nextRatingKey, n.toString())} style={{
                                width: 32, height: 32, borderRadius: 7,
                                border: `1.5px solid ${isSelected ? (btnFail ? C.red : C.green) : C.border}`,
                                background: isSelected ? (btnFail ? C.red : C.green) : 'white',
                                color: isSelected ? 'white' : btnFail ? C.red : C.green,
                                fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif'
                              }}>{n}</button>
                            )
                          })}
                        </div>
                        {stepRating >= 8 && (
                          <div style={{ marginTop: 8, fontSize: 11, fontWeight: 800, color: C.green }}>✓ PASS — {stepRating}/10</div>
                        )}
                        {stepRating > 0 && stepRating <= 7 && (
                          <div style={{ marginTop: 8, fontSize: 11, fontWeight: 800, color: C.red }}>✗ FAIL — {stepRating}/10 — try another option above</div>
                        )}
                      </div>
                    )}
                    {selectedStep === 'nerve' && (
                      <div style={{ marginTop: 10, padding: '10px 14px', background: C.red + '15', borderRadius: 8, border: `1px solid ${C.red}44`, fontSize: 12, color: C.red, fontWeight: 700 }}>
                        ⚠️ Possible long thoracic nerve damage — REFER OUT to specialist
                      </div>
                    )}
                  </div>
                )
              })()}
              {(f.id === 'ns_empty_can_right' || f.id === 'ns_empty_can_left') && (
                <div style={{ background: C.orange + '10', border: `1px solid ${C.orange}33`, borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, color: C.orange, textTransform: 'uppercase', marginBottom: 10 }}>What To Do Next</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8 }}>If pointing to NECK:</div>
                  <div style={{ fontSize: 12, color: C.text, lineHeight: 1.8, marginBottom: 12, paddingLeft: 12 }}>
                    • Neck Breakout Assessment<br/>• Neck Sensitivity Screen<br/>• Speedy 6 Neck Mobility
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8 }}>If pointing to SHOULDER:</div>
                  <div style={{ fontSize: 12, color: C.text, lineHeight: 1.8, paddingLeft: 12 }}>
                    • Shoulder Breakout Assessment<br/>• Shoulder Sensitivity Screen<br/>• Speedy 7 Shoulder Mobility
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )
    }

    // Non-inline modifier fields (Prime 8, FIELD_MODIFIERS): existing pass/fail based flow
    if (!isFail && !isPass) return null

    return (
      <div style={{ marginTop: 10, background: C.faint, borderRadius: 10, padding: '12px 14px', border: `1px solid ${C.border}` }}>

        {/* MODIFIER DROPDOWN */}
        {(() => {
          const modOptions = FIELD_MODIFIERS[f.id]
          if (!isFail || !modOptions || modOptions.length === 0) return null
          return (
            <div style={{ marginBottom: modifier ? 12 : 0 }}>
              <div style={{ fontSize: 10, color: C.red, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Modifiers to try</div>
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

        {/* Re-rate after modifier attempt */}
        {isFail && modifier && !modifier.startsWith('No modifier') && (
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
            <div style={{ fontSize: 10, color: C.accent, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Re-rate after {modifier.split('→')[0].trim()} (1–10)</div>
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

        {/* No modifier helped */}
        {isFail && modifier && modifier.startsWith('No modifier') && (
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
            <div style={{ padding: '8px 12px', background: C.red + '10', borderRadius: 8, border: `1px solid ${C.red}33`, fontSize: 11, color: C.red, fontWeight: 700, marginBottom: 10 }}>
              ✗ Recorded: {modifier} — flag for deeper investigation / breakout assessments
            </div>
            {(f.id === 'ns_full_can_right' || f.id === 'ns_full_can_left') && (() => {
              const nextKey = `${f.id}_next_step`
              const nextRatingKey = `${f.id}_next_rating`
              const selectedStep = answers[nextKey] || ''
              const stepRating = parseInt(answers[nextRatingKey]) || 0
              const steps = [
                { id: 'scalene', label: 'Posterior scalene neck tension may compress the long thoracic nerve. Try Wing Nut or Neck Mate' },
                { id: 'gh', label: 'GH instability may be a factor. Try Rotator Cup Protocol and re-test for strengthening' },
                { id: 'nerve', label: 'Consider possible long thoracic nerve damage — REFER OUT' },
              ]
              return (
                <div style={{ background: C.orange + '10', border: `1px solid ${C.orange}33`, borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, color: C.orange, textTransform: 'uppercase', marginBottom: 10 }}>What To Do Next</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {steps.map(s => {
                      const isSelected = selectedStep === s.id
                      return (
                        <button key={s.id} onClick={() => { set(nextKey, s.id); set(nextRatingKey, '') }} style={{
                          textAlign: 'left', padding: '10px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif',
                          border: `2px solid ${isSelected ? C.accent : C.border}22`,
                          background: isSelected ? C.accent + '15' : 'white',
                          color: C.text, fontSize: 12, fontWeight: isSelected ? 700 : 500, lineHeight: 1.5
                        }}>• {s.label}</button>
                      )
                    })}
                  </div>
                  {selectedStep && selectedStep !== 'nerve' && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 10, color: C.sub, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Rate After Re-Test (1–10)</div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {[1,2,3,4,5,6,7,8,9,10].map(n => {
                          const isSelected = stepRating === n
                          const btnFail = n <= 7
                          return (
                            <button key={n} onClick={() => set(nextRatingKey, n.toString())} style={{
                              width: 32, height: 32, borderRadius: 7,
                              border: `1.5px solid ${isSelected ? (btnFail ? C.red : C.green) : C.border}`,
                              background: isSelected ? (btnFail ? C.red : C.green) : 'white',
                              color: isSelected ? 'white' : btnFail ? C.red : C.green,
                              fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif'
                            }}>{n}</button>
                          )
                        })}
                      </div>
                      {stepRating >= 8 && (
                        <div style={{ marginTop: 8, fontSize: 11, fontWeight: 800, color: C.green }}>✓ PASS — {stepRating}/10</div>
                      )}
                      {stepRating > 0 && stepRating <= 7 && (
                        <div style={{ marginTop: 8, fontSize: 11, fontWeight: 800, color: C.red }}>✗ FAIL — {stepRating}/10 — try another option above</div>
                      )}
                    </div>
                  )}
                  {selectedStep === 'nerve' && (
                    <div style={{ marginTop: 10, padding: '10px 14px', background: C.red + '15', borderRadius: 8, border: `1px solid ${C.red}44`, fontSize: 12, color: C.red, fontWeight: 700 }}>
                      ⚠️ Possible long thoracic nerve damage — REFER OUT to specialist
                    </div>
                  )}
                </div>
              )
            })()}
            {(f.id === 'ns_empty_can_right' || f.id === 'ns_empty_can_left') && (
              <div style={{ background: C.orange + '10', border: `1px solid ${C.orange}33`, borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, color: C.orange, textTransform: 'uppercase', marginBottom: 10 }}>What To Do Next</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8 }}>If pointing to NECK:</div>
                <div style={{ fontSize: 12, color: C.text, lineHeight: 1.8, marginBottom: 12, paddingLeft: 12 }}>
                  • Neck Breakout Assessment<br/>• Neck Sensitivity Screen<br/>• Speedy 6 Neck Mobility
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8 }}>If pointing to SHOULDER:</div>
                <div style={{ fontSize: 12, color: C.text, lineHeight: 1.8, paddingLeft: 12 }}>
                  • Shoulder Breakout Assessment<br/>• Shoulder Sensitivity Screen<br/>• Speedy 7 Shoulder Mobility
                </div>
              </div>
            )}
          </div>
        )}

        {/* Pass */}
        {isPass && (
          <div>
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
          {s.importantNote && (
            <div style={{ marginBottom: 16, background: C.accent + '10', border: `1px solid ${C.accent}33`, borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ fontSize: 10, color: C.accent, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>📌 Important</div>
              <pre style={{ fontSize: 12, lineHeight: 1.7, color: C.text, whiteSpace: 'pre-wrap', fontFamily: 'Montserrat,sans-serif', margin: 0 }}>{s.importantNote}</pre>
            </div>
          )}
          {s.fields.map(f => {
            // Hide lying squat sub-questions when "Not needed" is selected
            const lyingSubFields = ['bms_sq_lying_arms','bms_sq_lying_knees','bms_sq_lying_ankles','bms_sq_lying_result']
            if (lyingSubFields.includes(f.id) && answers.bms_sq_lying !== 'Yes — performed') return null
            // Hide thigh follow-up questions until both legs are measured and one is smaller
            if (f.thighFollowUp) {
              const r = parseFloat(answers.k_thigh_right)
              const l = parseFloat(answers.k_thigh_left)
              if (!r || !l || isNaN(r) || isNaN(l) || r === l) return null
              const smallerLeg = l < r ? 'left' : 'right'
              const labelWithLeg = f.label.replace(/\?$/, ` (${smallerLeg} leg)?`)
              f = { ...f, label: labelWithLeg }
            }
            // Hide fields until parent has a specific value
            if (f.showWhenParent) {
              if (f.showWhenParentValue === '__gte8__') {
                const parentNum = parseInt(answers[f.showWhenParent])
                if (!parentNum || isNaN(parentNum) || parentNum < 8) return null
              } else if (f.showWhenParentValue === '__any__') {
                if (!answers[f.showWhenParent]) return null
              } else {
                if (answers[f.showWhenParent] !== f.showWhenParentValue) return null
              }
            }
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
              {assessment.id === 'structural' && f.type === 'text' && f.failNotes && (
                <div style={{ marginTop: 10, background: C.orange + '08', border: `1px solid ${C.orange}22`, borderRadius: 10, padding: '12px 16px' }}>
                  <div style={{ fontSize: 10, color: C.orange, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>📋 Clinical Notes</div>
                  <pre style={{ fontSize: 12, lineHeight: 1.7, color: C.text, whiteSpace: 'pre-wrap', fontFamily: 'Montserrat,sans-serif', margin: 0 }}>{f.failNotes}</pre>
                </div>
              )}
              {/* Leg Length — auto-conclude which leg is shorter */}
              {f.id === 'st_leg_length_left' && answers['st_leg_length_right'] && answers['st_leg_length_left'] && (() => {
                const r = parseFloat(answers['st_leg_length_right'])
                const l = parseFloat(answers['st_leg_length_left'])
                if (isNaN(r) || isNaN(l)) return null
                const diff = Math.abs(r - l).toFixed(1)
                if (r === l) return (
                  <div style={{ marginTop: 10, padding: '10px 14px', background: C.green + '12', borderRadius: 10, border: `1px solid ${C.green}44` }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: C.green }}>✓ Legs are equal length — {r} cm each</div>
                  </div>
                )
                const shorter = l < r ? 'LEFT' : 'RIGHT'
                const longer = l < r ? 'RIGHT' : 'LEFT'
                return (
                  <div style={{ marginTop: 10, padding: '10px 14px', background: C.red + '10', borderRadius: 10, border: `1px solid ${C.red}33` }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: C.red }}>⚠ {shorter} leg is shorter by {diff} cm</div>
                    <div style={{ fontSize: 11, color: C.sub, marginTop: 4 }}>Right: {r} cm · Left: {l} cm · Difference: {diff} cm</div>
                  </div>
                )
              })()}
              {/* Empty Can Seated — show rating result */}
              {f.emptyCan && answers[f.id] && !isNaN(parseInt(answers[f.id])) && (() => {
                const rating = parseInt(answers[f.id])
                if (rating < 1 || rating > 10) return null
                const shorterLeg = answers['st_leg_which_shorter'] || null
                if (rating >= 8) return (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ padding: '10px 14px', background: C.green + '12', borderRadius: 10, border: `1px solid ${C.green}44` }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: C.green }}>✓ {rating}/10 — Good seated empty can strength</div>
                    </div>
                    <div style={{ marginTop: 8, padding: '10px 14px', background: C.accent + '10', borderRadius: 10, border: `1px solid ${C.accent}33` }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.accent }}>Now perform Empty Can STANDING on the {shorterLeg || 'shorter'} leg on weight plates. Measure how many cm of plates allow the test to pass.</div>
                    </div>
                  </div>
                )
                return (
                  <div style={{ marginTop: 10, padding: '10px 14px', background: C.red + '10', borderRadius: 10, border: `1px solid ${C.red}33` }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: C.red }}>✗ {rating}/10 — Weak seated empty can</div>
                    <div style={{ fontSize: 12, color: C.red, fontWeight: 700, marginTop: 8 }}>⚠ Conduct the Shoulder/Neck Assessment before proceeding</div>
                  </div>
                )
              })()}
              {/* Empty Can Standing on weight plates — show rating result */}
              {f.emptyCanStanding && answers[f.id] && !isNaN(parseInt(answers[f.id])) && (() => {
                const rating = parseInt(answers[f.id])
                if (rating < 1 || rating > 10) return null
                const shorterLeg = answers['st_leg_which_shorter'] || 'shorter'
                return (
                  <div style={{ marginTop: 10, padding: '10px 14px', background: (rating >= 8 ? C.green : C.red) + '12', borderRadius: 10, border: `1px solid ${(rating >= 8 ? C.green : C.red)}44` }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: rating >= 8 ? C.green : C.red }}>
                      {rating >= 8 ? `✓ ${rating}/10 — PASS on ${shorterLeg} leg with weight plates` : `✗ ${rating}/10 — Still weak on ${shorterLeg} leg with weight plates`}
                    </div>
                  </div>
                )
              })()}
              {/* Empty Can Standing Rating with cm adjustment */}
              {f.emptyCanStandingRating && answers[f.id] && !isNaN(parseInt(answers[f.id])) && (() => {
                const rating = parseInt(answers[f.id])
                if (rating < 1 || rating > 10) return null
                const plateHeight = answers['st_empty_can_plate_height']
                const shorterLeg = answers['st_leg_which_shorter'] || 'shorter'
                return (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ padding: '10px 14px', background: (rating >= 8 ? C.green : C.red) + '12', borderRadius: 10, border: `1px solid ${(rating >= 8 ? C.green : C.red)}44` }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: rating >= 8 ? C.green : C.red }}>
                        {rating >= 8 ? `✓ ${rating}/10 — PASS with ${plateHeight || '?'} cm adjustment` : `✗ ${rating}/10 — FAIL with ${plateHeight || '?'} cm adjustment`}
                      </div>
                    </div>
                    {plateHeight && rating >= 8 && (
                      <div style={{ marginTop: 8, padding: '10px 14px', background: C.accent + '10', borderRadius: 10, border: `1px solid ${C.accent}33` }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.accent }}>Appropriate height: {plateHeight} cm — this is the ideal lift height for the {shorterLeg} leg</div>
                      </div>
                    )}
                  </div>
                )
              })()}
              {(assessment.id === 'foot' || assessment.id === 'structural') && f.type === 'passfail' && f.failNotes && answers[f.id] && answers[f.id] !== f.options[0] && (
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
              {/* W-Sit + Yoga-Sit combo outcome */}
              {assessment.id === 'structural' && f.id === 'st_yogasit' && answers['st_wsit'] && answers['st_yogasit'] && (() => {
                const wSit = answers['st_wsit'] === 'Yes'
                const yogaSit = answers['st_yogasit'] === 'Yes'
                let outcome = ''
                let color = C.green
                if (!wSit && !yogaSit) {
                  outcome = "NORMAL — Can't do both W-Sit and Yoga Sit. Likely about 14 degrees angle in neck of femur."
                  color = C.green
                } else if (wSit && yogaSit) {
                  outcome = "HYPERMOBILE OR LOW MUSCLE TONE — Can do both W-Sit and Yoga Sit."
                  color = C.orange
                } else if (wSit && !yogaSit) {
                  outcome = "ANTETORSION (anteversion/medial hip rotation) — Can do W-Sit, but can't do Yoga Sit.\n\nPathologic increase in angle of torsion. These people may appear to have genu valgus (knock-knees). If these individuals also have postural knee hyperextension (common with hypermobile people), then they can look bowlegged (but they aren't actually bowlegged). Hip or knee pain can develop because of excessive medial rotation. Hip antetorsion on one side only is common.\n\n• In general, keep FEET POINTED OUT during conventional exercise.\n\n• Try the Lucky Nuggets Antetorsion Protocol and re-test for improvement.\n\n• Also consider the Ant Hilda workout (Hip Online Programming Specialist)."
                  color = C.red
                } else if (!wSit && yogaSit) {
                  outcome = "RETROTORSION (retroversion/lateral hip rotation) — Can't do W-Sit, but can do Yoga Sit.\n\nPathologic decrease in angle of torsion. These people tend to have the feet turned out (i.e. Duck Walk or Charlie Chaplin gait).\n\n• In general KEEP FEET POINTED STRAIGHT AHEAD OR INWARD during conventional exercise.\n\n• Try the Lucky Nuggets Retrotorsion Protocol and re-test for improvement.\n\n• Also consider the Retro Joe workout (Hip Online Programming Specialist)."
                  color = C.red
                }
                return (
                  <div style={{ marginTop: 10, background: color + '10', border: `1px solid ${color}33`, borderRadius: 10, padding: '12px 16px' }}>
                    <div style={{ fontSize: 10, color, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>📋 W-Sit & Yoga-Sit Combined Result</div>
                    <pre style={{ fontSize: 12, lineHeight: 1.7, color: C.text, whiteSpace: 'pre-wrap', fontFamily: 'Montserrat,sans-serif', margin: 0 }}>{outcome}</pre>
                  </div>
                )
              })()}
              {/* Knee Cap Height — show prompt when Right Higher or Left Higher selected */}
              {f.kneeCapHeight && answers[f.id] && answers[f.id] !== 'Equal' && (
                <div style={{ marginTop: 10, padding: '12px 16px', background: C.orange + '08', border: `1px solid ${C.orange}22`, borderRadius: 10 }}>
                  <div style={{ fontSize: 10, color: C.orange, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>📋 High Knee Cap — {answers[f.id]}</div>
                  <pre style={{ fontSize: 12, lineHeight: 1.7, color: C.text, whiteSpace: 'pre-wrap', fontFamily: 'Montserrat,sans-serif', margin: 0 }}>{"A high knee cap can be due to rectus femoris tightness, or a pelvic imbalance (rotation or tilt).\n\n• High knee caps can grind into the articular cartilage, leading to accelerated wear and tear.\n\nConsider applying the Bees Knees High Knee Cap / Tight Quad protocol, then re-test patella alignment right after — in most cases, the kneecap shifts into better alignment immediately."}</pre>
                </div>
              )}
              {/* Bow-Legged — auto-flag when finger widths > 2 */}
              {f.kneeVarusFingers && answers[f.id] && !isNaN(parseFloat(answers[f.id])) && (() => {
                const fw = parseFloat(answers[f.id])
                if (fw <= 2) return (
                  <div style={{ marginTop: 8, padding: '8px 12px', background: C.green + '12', borderRadius: 8, border: `1px solid ${C.green}44` }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.green }}>{"✓ Pass — "}{fw} finger width{fw !== 1 ? 's' : ''} (within normal range)</div>
                  </div>
                )
                return (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ padding: '8px 12px', background: C.red + '12', borderRadius: 8, border: `1px solid ${C.red}44`, marginBottom: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.red }}>{"✗ Bowlegged — "}{fw} finger widths (more than 2)</div>
                    </div>
                    <div style={{ padding: '12px 16px', background: C.orange + '08', border: `1px solid ${C.orange}22`, borderRadius: 10 }}>
                      <div style={{ fontSize: 10, color: C.orange, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>📋 Bowlegged Assessment Notes</div>
                      <pre style={{ fontSize: 12, lineHeight: 1.7, color: C.text, whiteSpace: 'pre-wrap', fontFamily: 'Montserrat,sans-serif', margin: 0 }}>{"Sometimes happens on only one side, due to skeletal problems, nerve tension, infection, and/or tumors. If it happens on one side and is trauma induced it can be much easier to straighten out according to Dr. George Roth.\n\nConsider applying the Bees Knees Bowlegged protocol (it can reduce bow-legged alignment by 1-2 finger widths instantly). Also consider using the Bow Jackson Workout and/or Block Sabbath Workout (from the Knee Programming Specialist Online Course).\n\nNOTE: In rare cases, a client may fail both this test and the postural knee hyperextension test. When this happens, do not apply the standard bowlegged protocol. Although medial hip rotation combined with knee hyperextension can appear bowlegged, it actually requires a different strategy. In these situations: Focus on releasing the groin (using percussion or foam rolling). Strengthen the quadriceps, calves, and glute medius. Do lots of heels elevated squats and calf raises."}</pre>
                    </div>
                  </div>
                )
              })()}
              {/* Knock-Kneed — show prompt when Knock Kneed or Wide Hips selected */}
              {f.kneeValgus && answers[f.id] && answers[f.id] !== 'Pass' && (
                <div style={{ marginTop: 10, padding: '12px 16px', background: C.orange + '08', border: `1px solid ${C.orange}22`, borderRadius: 10 }}>
                  <div style={{ fontSize: 10, color: C.orange, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>📋 {answers[f.id] === 'Wide Hips / V-Taper' ? 'Wide Hips / V-Taper' : 'Knock-Kneed'} — Assessment Notes</div>
                  <pre style={{ fontSize: 12, lineHeight: 1.7, color: C.text, whiteSpace: 'pre-wrap', fontFamily: 'Montserrat,sans-serif', margin: 0 }}>{"WIDE HIPS / V-TAPER: If the client stands with their feet together, side by side, touching, and they have wide hips or a V-taper shape, treat them the same way you would for knock-kneed posture. These individuals often have a larger Q-angle — the angle between the ASIS (anterior superior iliac spine) and the patella — which increases the likelihood of inward knee stress and related alignment issues.\n\nFUNCTION IS KING: If someone appears to have knock knees or wide hips, use the Hip Swing Test to confirm whether it's functionally affecting them, as demonstrated by weakness in the test.\n\nConsider applying the Bees Knees Knock Kneed Corrective protocol, and the Ball McCartney Workout (from the Knee Programming Specialist Online Course)."}</pre>
                </div>
              )}
              {/* Baker's Cyst — show prompt when Yes on either leg */}
              {f.kneeBakers && answers[f.id] === 'Yes' && (
                <div style={{ marginTop: 10, padding: '12px 16px', background: C.orange + '08', border: `1px solid ${C.orange}22`, borderRadius: 10 }}>
                  <div style={{ fontSize: 10, color: C.orange, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>📋 Baker's Cyst Detected — {f.id === 'k_bakers_right' ? 'Right Knee' : 'Left Knee'}</div>
                  <pre style={{ fontSize: 12, lineHeight: 1.7, color: C.text, whiteSpace: 'pre-wrap', fontFamily: 'Montserrat,sans-serif', margin: 0 }}>{"Baker's Cyst is a cystic sac, resulting from an abnormal accumulation of synovial fluid in the medial aspect of the popliteal fossa.\n\nIf they have a Baker's Cyst, it can be a sign that there is an issue in the body:\n\n• Baker's cyst may result from a meniscus tear, rheumatoid arthritis, or hamstring tendinitis (Waldman, Dr Steven (2002) Atlas of Common Pain Syndromes. W.B. Saunders Company. An imprint of Elsevier Science. Toronto ON.).\n\n• Use a low back assessment as a breakout test: When the body tries to offload pressure from pinched lower lumbar nerves, it may compensate with postural knee flexion, increasing stress on the back of the knee. Over time, this can contribute to the development of Baker's cysts.\n\n• In some cases, Baker's cysts may also stem from long-standing hamstring dysfunction. To rule out nerve involvement, refer to the Core Mastery Course and perform the myotome assessments to check if hamstring function is being inhibited by compression at the L5 nerve root."}</pre>
                </div>
              )}
              {/* Hyperextension — show prompt when Yes on either leg */}
              {f.kneeHyperext && answers[f.id] === 'Yes' && (
                <div style={{ marginTop: 10, padding: '12px 16px', background: C.orange + '08', border: `1px solid ${C.orange}22`, borderRadius: 10 }}>
                  <div style={{ fontSize: 10, color: C.orange, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>📋 Postural Knee Hyperextension — {f.id === 'k_hyperext_right' ? 'Right Leg' : 'Left Leg'}</div>
                  <pre style={{ fontSize: 12, lineHeight: 1.7, color: C.text, whiteSpace: 'pre-wrap', fontFamily: 'Montserrat,sans-serif', margin: 0 }}>{"FROM THE SIDE, assess upper and lower leg bones. Instruct them to LOCK OUT KNEES ALL THE WAY.\n\nDo the knees look to bend backward? If yes it's postural knee hyperextension.\n\nSome people have overdeveloped quads and small hamstrings (which looks like hyperextension). Focus on the LEG BONES.\n\nFOR EXTRA PRECISION: Hang a measuring tape, or string straight down from the mid-hip and thigh to mid-ankle. THE KNEE SHOULD BE IN THE MIDDLE. If the knee is BEHIND THE VERTICAL AXIS, the knees are in postural hyperextension.\n\n• Extra pressure can be focused on the anterior (front) of the knee joint, which can lead to pain over time.\n\n• Can be due to loose ligaments, and hypermobility, a backward slant of tibia plateau, (normal is 5.5 degrees), or backward concavity of shaft of lower leg bone due to calf tightness (\"retroflexion\"), or it may be a compensation for rigid feet (when the foot doesn't dorsiflex during walking, as knee hyperextension or hip lateral rotation, can be a long-term compensation).\n\n• Try using Bees Knees HyperExtended Knees Corrective & Sloop John Bosu workout (Knee Programming Specialist Online Course)."}</pre>
                </div>
              )}
              {/* Knee Flexion — show prompt when Yes on either leg */}
              {f.kneeFlexion && answers[f.id] === 'Yes' && (
                <div style={{ marginTop: 10, padding: '12px 16px', background: C.orange + '08', border: `1px solid ${C.orange}22`, borderRadius: 10 }}>
                  <div style={{ fontSize: 10, color: C.orange, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>📋 Postural Knee Flexion — {f.id === 'k_flexion_right' ? 'Right Leg' : 'Left Leg'}</div>
                  <pre style={{ fontSize: 12, lineHeight: 1.7, color: C.text, whiteSpace: 'pre-wrap', fontFamily: 'Montserrat,sans-serif', margin: 0 }}>{"FROM THE SIDE, assess upper and lower leg bones. Does one knee seem to stick out in front of the other?\n\nFOR EXTRA PRECISION: Hang a measuring tape, or string straight down from the mid-hip and thigh. THE KNEE SHOULD BE IN THE MIDDLE. If a knee is IN FRONT OF THE VERTICAL AXIS, the knee is in postural flexion.\n\n• Extra pressure can be focused on the posterior (back) of the knee joint, which can lead to pain over time.\n\n• CAUSES: A flexed knee could be the symptom of a meniscal tear, degenerative changes (like arthritis), or nerve pressure (stemming from neck or low back, the spine goes flat and knee goes bent to reduce nerve pressure by opening the neural foramina). Assess neck and low back. A flexed knee could indicate a twist through the pelvis: Consider a Hip and Pelvis Assessment.\n\n• Try using Bees Knees Flexed Knees (Knee Programming Specialist Online Course)."}</pre>
                </div>
              )}
              {/* Patella Press — show rating result and alarm at 6+ */}
              {f.kneePatella && answers[f.id] && !isNaN(parseInt(answers[f.id])) && (() => {
                const rating = parseInt(answers[f.id])
                const legName = f.id === 'k_patella_right_rating' ? 'Right Knee' : 'Left Knee'
                if (rating === 0) return (
                  <div style={{ marginTop: 8, padding: '8px 12px', background: C.green + '12', borderRadius: 8, border: `1px solid ${C.green}44` }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.green }}>{"✓ No pain — "}{legName}</div>
                  </div>
                )
                const isAlarming = rating >= 6
                return (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ padding: '8px 12px', background: (isAlarming ? C.red : C.orange) + '12', borderRadius: 8, border: `1px solid ${(isAlarming ? C.red : C.orange)}44`, marginBottom: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: isAlarming ? C.red : C.orange }}>{isAlarming ? '⚠ ALARMING' : '⚠ Pain detected'} — {legName}: {rating}/10</div>
                    </div>
                    <div style={{ padding: '12px 16px', background: C.orange + '08', border: `1px solid ${C.orange}22`, borderRadius: 10 }}>
                      <div style={{ fontSize: 10, color: C.orange, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>📋 Patella Press — {legName}</div>
                      <pre style={{ fontSize: 12, lineHeight: 1.7, color: C.text, whiteSpace: 'pre-wrap', fontFamily: 'Montserrat,sans-serif', margin: 0 }}>{"When they have pain on this test, it's normally slight, only a 2 or 3 out of 10.\n\n• Pain could indicate Chondromalacia Patella, which is a common cause of chronic anterior knee pain. It results from degeneration of cartilage due to poor alignment of the kneecap (patella) as it slides over the lower thighbone (femur).\n\nPain could result from the knee cap being out of position — consider the Bees Knees High Knee Cap / Tight Quad protocol.\n\nTry the Boston Knee Party or Knights Who Say \"Knee\" workouts from the Knee Programming Specialist Online Course.\n\nOther Considerations: Modify lifestyle behaviors to reduce kneeling. If you must kneel, consider using knee pads (such as athletic knee pads), or kneel on a more forgiving surface, like a bosu ball."}</pre>
                    </div>
                  </div>
                )
              })()}
              {/* Joint Line Compression — show prompt at 9+ */}
              {f.kneeJointLine && answers[f.id] && !isNaN(parseInt(answers[f.id])) && (() => {
                const rating = parseInt(answers[f.id])
                const legName = f.id === 'k_joint_right_rating' ? 'Right Knee' : 'Left Knee'
                if (rating === 0) return (
                  <div style={{ marginTop: 8, padding: '8px 12px', background: C.green + '12', borderRadius: 8, border: `1px solid ${C.green}44` }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.green }}>{"✓ No pain — "}{legName}</div>
                  </div>
                )
                if (rating < 9) return (
                  <div style={{ marginTop: 8, padding: '8px 12px', background: C.orange + '12', borderRadius: 8, border: `1px solid ${C.orange}44` }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.orange }}>{"⚠ Pain detected — "}{legName}: {rating}/10</div>
                  </div>
                )
                return (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ padding: '8px 12px', background: C.red + '12', borderRadius: 8, border: `1px solid ${C.red}44`, marginBottom: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.red }}>{"⚠ ALARMING — "}{legName}: {rating}/10</div>
                    </div>
                    <div style={{ padding: '12px 16px', background: C.orange + '08', border: `1px solid ${C.orange}22`, borderRadius: 10 }}>
                      <div style={{ fontSize: 10, color: C.orange, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>📋 Joint Line Compression — {legName}</div>
                      <pre style={{ fontSize: 12, lineHeight: 1.7, color: C.text, whiteSpace: 'pre-wrap', fontFamily: 'Montserrat,sans-serif', margin: 0 }}>{"If pain is 9 or 10/10: Could be meniscal tear or bone on bone irritation.\n\nIf they do have pain here, progress onto the next tests to support a meniscal tear theory.\n\nFor medial knee pain, try loosening the TFL (this is in the Hip Hip Hooray series). Re-test for improvement immediately after.\n\nIf they can't find the joint lines: Ask them just to press everywhere along the sides of the knee, looking for tenderness. Make note of what they find."}</pre>
                    </div>
                  </div>
                )
              })()}
              {/* Auto-comparison for thigh girth — show after left leg is entered */}
              {f.id === 'k_thigh_left' && answers.k_thigh_right && answers.k_thigh_left && !isNaN(parseFloat(answers.k_thigh_right)) && !isNaN(parseFloat(answers.k_thigh_left)) && (() => {
                const r = parseFloat(answers.k_thigh_right)
                const l = parseFloat(answers.k_thigh_left)
                const diff = Math.abs(r - l).toFixed(1)
                if (r === l) return (
                  <div style={{ marginTop: 8, padding: '8px 12px', background: C.green + '12', borderRadius: 8, border: `1px solid ${C.green}44` }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.green }}>✓ Equal — both legs measure {r}cm</div>
                  </div>
                )
                const smallerLeg = l < r ? 'left' : 'right'
                const smallerVal = Math.min(r, l)
                const largerVal = Math.max(r, l)
                return (
                  <div style={{ marginTop: 8, padding: '8px 12px', background: C.orange + '12', borderRadius: 8, border: `1px solid ${C.orange}44` }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.orange }}>⚠ The {smallerLeg} leg measures less — {smallerVal}cm vs {largerVal}cm ({diff}cm difference)</div>
                    <div style={{ fontSize: 11, color: C.sub, marginTop: 4 }}>Answer the follow-up questions below for the {smallerLeg} leg.</div>
                  </div>
                )
              })()}
              {/* Thigh girth verdict — show after all follow-up questions answered */}
              {f.id === 'k_thigh_sport' && answers.k_thigh_right && answers.k_thigh_left && answers.k_thigh_injury && answers.k_thigh_surgery && answers.k_thigh_sport && (() => {
                const r = parseFloat(answers.k_thigh_right)
                const l = parseFloat(answers.k_thigh_left)
                if (isNaN(r) || isNaN(l) || r === l) return null
                const smallerLeg = l < r ? 'left' : 'right'
                const diff = Math.abs(r - l).toFixed(1)
                const injury = answers.k_thigh_injury === 'Yes'
                const surgery = answers.k_thigh_surgery === 'Yes'
                const sport = answers.k_thigh_sport === 'Yes'
                let verdict = `The ${smallerLeg} leg measures ${diff}cm less in upper thigh girth.`
                if (injury && surgery) verdict += ` The ${smallerLeg} leg has a history of both recent injury and surgery — muscle atrophy is likely post-surgical and post-injury. Prioritize gradual quad re-activation on the ${smallerLeg} side with VMO-focused work.`
                else if (injury) verdict += ` A recent injury to the ${smallerLeg} leg likely explains the reduced girth — disuse atrophy from pain avoidance. Focus on pain-free quad activation and progressive loading on the ${smallerLeg} side.`
                else if (surgery) verdict += ` Surgery on the ${smallerLeg} leg likely caused post-operative muscle atrophy. Focus on progressive quad strengthening and VMO re-activation on the ${smallerLeg} side.`
                else if (sport) verdict += ` No injury or surgery reported, but the client plays a quad dominant sport — the larger leg may be the overworked dominant side. Monitor the ${smallerLeg} leg for compensatory weakness and consider single-leg training to balance both sides.`
                else verdict += ` No injury, surgery, or quad dominant sport reported. The ${smallerLeg} leg shows reduced girth which may indicate a compensatory pattern or disuse. Investigate further — consider checking hip and low back function for nerve-related causes of ${smallerLeg} quad inhibition.`
                return (
                  <div style={{ marginTop: 10, padding: '12px 16px', background: C.red + '08', border: `1px solid ${C.red}22`, borderRadius: 10 }}>
                    <div style={{ fontSize: 10, color: C.red, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>🦵 Thigh Girth Verdict</div>
                    <div style={{ fontSize: 12, lineHeight: 1.7, color: C.text, fontFamily: 'Montserrat,sans-serif' }}>{verdict}</div>
                  </div>
                )
              })()}
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
// ── Intake form sub-components (defined outside to prevent focus loss on re-render) ──
const IntakeTextInput = ({ k, label, type = 'text', placeholder = '', required = false, form, update, errors, labelStyle, inputStyle }) => (
  <div style={{ marginBottom: 14 }}>
    <label style={labelStyle}>{label}{required && <span style={{ color: C.red, marginLeft: 3 }}>*</span>}</label>
    <input type={type} value={form[k]} onChange={e => update(k, e.target.value)} placeholder={placeholder} style={inputStyle(k)} />
    {errors[k] && <div style={{ fontSize: 11, color: C.red, fontWeight: 600, marginTop: 4 }}>{errors[k]}</div>}
  </div>
)

const IntakeTextArea = ({ k, label, placeholder = '', rows = 3, form, update, labelStyle, inputStyle }) => (
  <div style={{ marginBottom: 14 }}>
    <label style={labelStyle}>{label}</label>
    <textarea value={form[k]} onChange={e => update(k, e.target.value)} placeholder={placeholder} rows={rows} style={{ ...inputStyle(k), resize: 'vertical' }} />
  </div>
)

const IntakeYesNo = ({ k, label, form, update, labelStyle }) => (
  <div style={{ marginBottom: 14 }}>
    <label style={labelStyle}>{label}</label>
    <div style={{ display: 'flex', gap: 8 }}>
      {['Yes', 'No'].map(opt => (
        <button key={opt} onClick={() => update(k, opt)} style={{ padding: '8px 20px', borderRadius: 8, border: `1.5px solid ${form[k] === opt ? C.accent : C.border}`, background: form[k] === opt ? C.accent + '15' : C.faint, color: form[k] === opt ? C.accent : C.sub, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>{opt}</button>
      ))}
    </div>
  </div>
)

const IntakeRating = ({ k, label, max = 10, form, update, labelStyle }) => (
  <div style={{ marginBottom: 14 }}>
    <label style={labelStyle}>{label}</label>
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {Array.from({ length: max }, (_, i) => i + 1).map(n => (
        <button key={n} onClick={() => update(k, n.toString())} style={{ width: 36, height: 36, borderRadius: 8, border: `1.5px solid ${form[k] === n.toString() ? C.accent : C.border}`, background: form[k] === n.toString() ? C.accent : C.faint, color: form[k] === n.toString() ? '#000' : C.sub, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{n}</button>
      ))}
    </div>
  </div>
)

const IntakeSelect = ({ k, label, options, form, update, labelStyle }) => (
  <div style={{ marginBottom: 14 }}>
    <label style={labelStyle}>{label}</label>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {options.map(opt => (
        <button key={opt} onClick={() => update(k, opt)} style={{ padding: '9px 14px', borderRadius: 8, border: `1.5px solid ${form[k] === opt ? C.accent : C.border}`, background: form[k] === opt ? C.accent + '15' : C.faint, color: form[k] === opt ? C.accent : C.text, fontFamily: 'Montserrat,sans-serif', fontWeight: form[k] === opt ? 700 : 500, fontSize: 12, cursor: 'pointer', textAlign: 'left' }}>{opt}</button>
      ))}
    </div>
  </div>
)

const WAIVER_TEXT = `I hereby affirm, to the best of my knowledge, that I am in good physical condition and do not have any disability or medical condition that would prevent or limit my participation in this program. I have not been advised by a physician to avoid exercise, and I have not experienced heart problems, lung problems, high blood pressure, shortness of breath during physical activity, or any other medical condition that I have not disclosed to FREDDYFIT LLC.

I understand and agree that I am fully responsible for my participation in any services provided by FREDDYFIT LLC. I acknowledge that all activities are undertaken at my own risk. I release and hold harmless FREDDYFIT LLC, including its shareholders, directors, officers, employees, representatives, and agents, from any and all claims, losses, injuries, damages, or liabilities arising from my participation in or use of services provided by FREDDYFIT LLC.`

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const TIME_OPTIONS = ['Morning', 'Afternoon', 'Evening']
const DAY_STATUS_OPTIONS = ['Available', 'Preferred', 'Unavailable']

function SignaturePad({ value, onChange }) {
  const canvasRef = useRef(null)
  const isDrawing = useRef(false)
  const hasDrawn = useRef(!!value)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * 2
    canvas.height = rect.height * 2
    ctx.scale(2, 2)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 2.5
    ctx.strokeStyle = '#1a1a2e'
    // Draw signature guide line
    ctx.save()
    ctx.strokeStyle = '#ddd'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(20, rect.height - 30)
    ctx.lineTo(rect.width - 20, rect.height - 30)
    ctx.stroke()
    ctx.restore()
    // "X" marker
    ctx.save()
    ctx.font = '16px Montserrat, sans-serif'
    ctx.fillStyle = '#ccc'
    ctx.fillText('✕', 8, rect.height - 22)
    ctx.restore()
    // Restore existing signature
    if (value) {
      hasDrawn.current = true
      const img = new Image()
      img.onload = () => { ctx.drawImage(img, 0, 0, rect.width, rect.height) }
      img.src = value
    }
  }, [])

  const getPos = (e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const touch = e.touches ? e.touches[0] : e
    return { x: touch.clientX - rect.left, y: touch.clientY - rect.top }
  }

  const startDraw = (e) => {
    e.preventDefault()
    hasDrawn.current = true
    isDrawing.current = true
    const ctx = canvasRef.current.getContext('2d')
    ctx.strokeStyle = '#1a1a2e'
    ctx.lineWidth = 2.5
    ctx.setLineDash([])
    const pos = getPos(e)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
  }

  const draw = (e) => {
    if (!isDrawing.current) return
    e.preventDefault()
    const ctx = canvasRef.current.getContext('2d')
    const pos = getPos(e)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
  }

  const endDraw = () => {
    if (!isDrawing.current) return
    isDrawing.current = false
    onChange(canvasRef.current.toDataURL())
  }

  const clear = () => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    ctx.clearRect(0, 0, rect.width, rect.height)
    hasDrawn.current = false
    // Redraw guide line
    ctx.save()
    ctx.strokeStyle = '#ddd'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(20, rect.height - 30)
    ctx.lineTo(rect.width - 20, rect.height - 30)
    ctx.stroke()
    ctx.restore()
    ctx.save()
    ctx.font = '16px Montserrat, sans-serif'
    ctx.fillStyle = '#ccc'
    ctx.fillText('✕', 8, rect.height - 22)
    ctx.restore()
    onChange('')
  }

  return (
    <div style={{ position: 'relative' }}>
      {!value && (
        <div style={{ position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none', zIndex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: '#bbb', fontWeight: 600, fontFamily: 'Montserrat,sans-serif' }}>Sign here</div>
          <div style={{ fontSize: 10, color: '#ccc', marginTop: 2, fontFamily: 'Montserrat,sans-serif' }}>Use your finger or mouse to sign</div>
        </div>
      )}
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: 160, border: `2px solid ${value ? C.green + '66' : C.border}`, borderRadius: 12, background: '#fafbfc', touchAction: 'none', cursor: 'crosshair', position: 'relative', zIndex: 2 }}
        onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
        onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}
      />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
        <button onClick={clear} style={{ background: 'none', border: `1.5px solid ${C.border}`, color: C.sub, borderRadius: 8, padding: '6px 16px', fontSize: 12, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif', fontWeight: 600 }}>Clear</button>
        {value && <div style={{ fontSize: 11, color: C.green, fontWeight: 700 }}>✓ Signature captured</div>}
      </div>
    </div>
  )
}

function InitialPad({ value, onChange }) {
  const canvasRef = useRef(null)
  const isDrawing = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * 2
    canvas.height = rect.height * 2
    ctx.scale(2, 2)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 2
    ctx.strokeStyle = '#1a1a2e'
    if (value && value.startsWith('data:')) {
      const img = new Image()
      img.onload = () => { ctx.drawImage(img, 0, 0, rect.width, rect.height) }
      img.src = value
    }
  }, [])

  const getPos = (e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const touch = e.touches ? e.touches[0] : e
    return { x: touch.clientX - rect.left, y: touch.clientY - rect.top }
  }

  const startDraw = (e) => {
    e.preventDefault()
    isDrawing.current = true
    const ctx = canvasRef.current.getContext('2d')
    ctx.strokeStyle = '#1a1a2e'
    ctx.lineWidth = 2
    ctx.setLineDash([])
    const pos = getPos(e)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
  }

  const draw = (e) => {
    if (!isDrawing.current) return
    e.preventDefault()
    const ctx = canvasRef.current.getContext('2d')
    const pos = getPos(e)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
  }

  const endDraw = () => {
    if (!isDrawing.current) return
    isDrawing.current = false
    onChange(canvasRef.current.toDataURL())
  }

  const clear = () => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    ctx.clearRect(0, 0, rect.width, rect.height)
    onChange('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 80 }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: C.sub, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Initial</div>
      <div style={{ position: 'relative' }}>
        {!value && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none', zIndex: 1, fontSize: 10, color: '#ccc', fontWeight: 600, fontFamily: 'Montserrat,sans-serif', whiteSpace: 'nowrap' }}>Draw</div>
        )}
        <canvas
          ref={canvasRef}
          style={{ width: 80, height: 50, border: `2px solid ${value ? C.green : C.border}`, borderRadius: 8, background: value ? C.green + '08' : '#fafbfc', touchAction: 'none', cursor: 'crosshair', position: 'relative', zIndex: 2 }}
          onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
          onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}
        />
      </div>
      {value ? (
        <button onClick={clear} style={{ marginTop: 3, background: 'none', border: 'none', color: C.sub, fontSize: 9, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif', textDecoration: 'underline', padding: 0 }}>clear</button>
      ) : null}
      {value && <div style={{ fontSize: 9, color: C.green, fontWeight: 700, marginTop: 2 }}>✓</div>}
    </div>
  )
}

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
    address: existingIntake.address || '',
    dob: existingClient?.dob || '',
    gender: existingIntake.gender || '',
    occupation: existingIntake.occupation || '',
    taking_medication: existingIntake.taking_medication || '',
    medication_list: existingIntake.medication_list || '',
    pre_existing_conditions: existingIntake.pre_existing_conditions || '',
    conditions_description: existingIntake.conditions_description || '',
    had_surgery: existingIntake.had_surgery || '',
    surgery_description: existingIntake.surgery_description || '',
    pain_foot: existingIntake.pain_foot || '',
    pain_foot_side: existingIntake.pain_foot_side || '',
    pain_knee: existingIntake.pain_knee || '',
    pain_knee_side: existingIntake.pain_knee_side || '',
    pain_hip: existingIntake.pain_hip || '',
    pain_hip_side: existingIntake.pain_hip_side || '',
    pain_back: existingIntake.pain_back || '',
    pain_back_side: existingIntake.pain_back_side || '',
    pain_shoulder: existingIntake.pain_shoulder || '',
    pain_shoulder_side: existingIntake.pain_shoulder_side || '',
    pain_neck: existingIntake.pain_neck || '',
    pain_neck_side: existingIntake.pain_neck_side || '',
    pain_migraines: existingIntake.pain_migraines || '',
    pain_migraines_side: existingIntake.pain_migraines_side || '',
    nutrition_rating: existingIntake.nutrition_rating || '',
    nutrition_failure: existingIntake.nutrition_failure || '',
    follows_diet: existingIntake.follows_diet || '',
    diet_description: existingIntake.diet_description || '',
    goal_3_month: existingIntake.goal_3_month || '',
    goal_6_month: existingIntake.goal_6_month || '',
    goal_1_year: existingIntake.goal_1_year || '',
    commitment_rating: existingIntake.commitment_rating || '',
    motivation: existingIntake.motivation || '',
    commit_solo_workouts: existingIntake.commit_solo_workouts || '',
    commit_pt_sessions: existingIntake.commit_pt_sessions || '',
    pt_decline_reason: existingIntake.pt_decline_reason || '',
    activity_level: existingIntake.activity_level || '',
    sleep_hours: existingIntake.sleep_hours || '',
    stress_rating: existingIntake.stress_rating || '',
    mental_health_challenges: existingIntake.mental_health_challenges || '',
    mental_health_discuss: existingIntake.mental_health_discuss || '',
    mental_health_notes: existingIntake.mental_health_notes || '',
    fitness_experience: existingIntake.fitness_experience || '',
    training_methods: existingIntake.training_methods || '',
    support_system: existingIntake.support_system || '',
    schedule: existingIntake.schedule || {},
    has_gym: existingIntake.has_gym || '',
    gym_name: existingIntake.gym_name || '',
    planning_gym: existingIntake.planning_gym || '',
    financial_concerns: existingIntake.financial_concerns || '',
    financial_concerns_description: existingIntake.financial_concerns_description || '',
    referral_source: existingIntake.referral_source || '',
    referral_other: existingIntake.referral_other || '',
    additional_info: existingIntake.additional_info || '',
    waiver_signature: existingIntake.waiver_signature || '',
    functional_fit_commit: existingIntake.functional_fit_commit || '',
    functional_fit_initial_1: existingIntake.functional_fit_initial_1 || '',
    functional_fit_initial_2: existingIntake.functional_fit_initial_2 || '',
    functional_fit_initial_3: existingIntake.functional_fit_initial_3 || '',
  })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})

  const isEdit = !!existingClient

  const update = useCallback((key, val) => {
    setForm(f => ({ ...f, [key]: val }))
    if (errors[key]) setErrors(e => ({ ...e, [key]: null }))
  }, [errors])

  const updateSchedule = (day, field, val) => {
    setForm(f => ({
      ...f,
      schedule: { ...f.schedule, [day]: { ...(f.schedule[day] || {}), [field]: val } }
    }))
  }

  const handleSave = async () => {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Client name is required'
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    setSaving(true)
    try {
      const { name, dob, goal_3_month, goal_6_month, goal_1_year, ...intakeFields } = form
      const intakeJson = JSON.stringify({ ...intakeFields, goal_3_month, goal_6_month, goal_1_year })
      const goal = [goal_3_month, goal_6_month, goal_1_year].filter(Boolean).join(' | ')

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

  // Shorthand props passed to all sub-components
  const fp = { form, update, errors, labelStyle, inputStyle }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 24px 32px' }}>
      <LogoHeader />
      <button onClick={onBack} style={{ background: 'none', border: `1px solid ${C.border}`, color: C.sub, borderRadius: 7, padding: '6px 14px', fontSize: 12, cursor: 'pointer', marginBottom: 24 }}>← Back</button>

      <div style={{ fontWeight: 800, fontSize: 24, letterSpacing: 3, color: C.text, marginBottom: 4 }}>{isEdit ? 'EDIT CLIENT' : 'CLIENT INTAKE FORM'}</div>
      <div style={{ fontSize: 12, color: C.sub, marginBottom: 24, lineHeight: 1.6 }}>Please fill out this form as accurately as possible. This will help us tailor your training program to your unique needs and goals. All information provided is confidential.</div>

      {/* ── Personal Information ── */}
      <div style={sectionStyle}>
        {sectionTitle('👤', 'Personal Information')}
        <IntakeTextInput k="name" label="Full Name" required placeholder="e.g. John Smith" {...fp} />
        <IntakeTextInput k="phone" label="Phone Number" type="tel" placeholder="e.g. (555) 123-4567" {...fp} />
        <IntakeTextInput k="email" label="Email Address" type="email" placeholder="e.g. john@example.com" {...fp} />
        <IntakeTextInput k="address" label="Address" placeholder="e.g. 123 Main St, City, State ZIP" {...fp} />
        <IntakeTextInput k="dob" label="Date of Birth" type="date" {...fp} />
        <IntakeSelect k="gender" label="Gender" options={['Male', 'Female', 'Other']} {...fp} />
        <IntakeTextInput k="occupation" label="Occupation" placeholder="e.g. Office worker, construction, nurse..." {...fp} />
      </div>

      {/* ── Health & Medical ── */}
      <div style={sectionStyle}>
        {sectionTitle('🩺', 'Health & Medical Information')}
        <IntakeYesNo k="taking_medication" label="Are you currently taking any medication?" {...fp} />
        {form.taking_medication === 'Yes' && <IntakeTextArea k="medication_list" label="If yes, please list them" placeholder="List all current medications..." rows={2} {...fp} />}
        <IntakeYesNo k="pre_existing_conditions" label="Do you have any pre-existing injuries or medical conditions?" {...fp} />
        {form.pre_existing_conditions === 'Yes' && <IntakeTextArea k="conditions_description" label="If yes, please describe" placeholder="Describe injuries or conditions..." rows={2} {...fp} />}
        <IntakeYesNo k="had_surgery" label="Have you ever had surgery?" {...fp} />
        {form.had_surgery === 'Yes' && <IntakeTextArea k="surgery_description" label="If yes, please describe" placeholder="Type of surgery, when, any lasting effects..." rows={2} {...fp} />}

        {/* ── Pain Screening ── */}
        <div style={{ marginTop: 16, padding: '14px 16px', background: C.faint, borderRadius: 10, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.5, color: C.sub, textTransform: 'uppercase', marginBottom: 12 }}>Current Pain Screening</div>
          {[
            { k: 'pain_foot', label: 'Foot Pain', sideOptions: ['Left foot', 'Right foot', 'Both feet'] },
            { k: 'pain_knee', label: 'Knee Pain', sideOptions: ['Left knee', 'Right knee', 'Both knees'] },
            { k: 'pain_hip', label: 'Hip Pain', sideOptions: ['Left hip', 'Right hip', 'Both hips'] },
            { k: 'pain_back', label: 'Back Pain', sideOptions: ['Lower back', 'Mid back', 'Upper back', 'Both sides', 'Left side', 'Right side'] },
            { k: 'pain_shoulder', label: 'Shoulder Pain', sideOptions: ['Left shoulder', 'Right shoulder', 'Both shoulders'] },
            { k: 'pain_neck', label: 'Neck Pain', sideOptions: ['Left side', 'Right side', 'Both sides', 'Central'] },
            { k: 'pain_migraines', label: 'Migraines / Headaches', sideOptions: ['Left side', 'Right side', 'Both sides', 'Front', 'Back of head'] },
          ].map(({ k: painKey, label: painLabel, sideOptions }) => (
            <div key={painKey} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: `1px solid ${C.border}22` }}>
              <IntakeYesNo k={painKey} label={painLabel} {...fp} />
              {form[painKey] === 'Yes' && (
                <div style={{ marginTop: -6, marginLeft: 8 }}>
                  <label style={fp.labelStyle}>Which area?</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {sideOptions.map(opt => (
                      <button key={opt} onClick={() => update(`${painKey}_side`, opt)} style={{ padding: '6px 14px', borderRadius: 7, border: `1.5px solid ${form[`${painKey}_side`] === opt ? C.accent : C.border}`, background: form[`${painKey}_side`] === opt ? C.accent + '15' : 'white', color: form[`${painKey}_side`] === opt ? C.accent : C.sub, fontFamily: 'Montserrat,sans-serif', fontWeight: 600, fontSize: 11, cursor: 'pointer' }}>{opt}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Nutrition ── */}
      <div style={sectionStyle}>
        {sectionTitle('🥗', 'Nutrition')}
        <IntakeRating k="nutrition_rating" label="How would you rate your overall nutrition in the last 90 days? (1 = poor, 10 = excellent)" {...fp} />
        <IntakeTextArea k="nutrition_failure" label="What causes you to fail nutritionally?" placeholder="e.g. Late night snacking, skipping meals, fast food convenience..." rows={3} {...fp} />
        <IntakeYesNo k="follows_diet" label="Do you follow any specific diet or nutrition plan?" {...fp} />
        {form.follows_diet === 'Yes' && <IntakeTextArea k="diet_description" label="If yes, please describe" placeholder="e.g. Keto, intermittent fasting, meal prep..." rows={2} {...fp} />}
      </div>

      {/* ── Goals ── */}
      <div style={sectionStyle}>
        {sectionTitle('🎯', 'Goals')}
        <IntakeTextArea k="goal_3_month" label="What is your 3-month goal?" placeholder="e.g. Lose 10 lbs, reduce back pain, build consistency..." rows={3} {...fp} />
        <IntakeTextArea k="goal_6_month" label="What is your 6-month goal?" placeholder="e.g. Gain lean muscle, improve mobility, run a 5K..." rows={3} {...fp} />
        <IntakeTextArea k="goal_1_year" label="What is your 1-year goal?" placeholder="e.g. Complete a transformation, maintain active lifestyle..." rows={3} {...fp} />
      </div>

      {/* ── Commitment & Motivation ── */}
      <div style={sectionStyle}>
        {sectionTitle('💪', 'Commitment & Motivation')}
        <IntakeRating k="commitment_rating" label="How would you rate your overall commitment to achieving your fitness goals? (1 = low, 10 = high)" {...fp} />
        <IntakeTextArea k="motivation" label="What motivates you to achieve your goals?" placeholder="What drives you? What does success look like?" rows={3} {...fp} />

        {/* Solo workout commitment */}
        <IntakeYesNo k="commit_solo_workouts" label="Can you commit to 2 workouts on your own per week that I design for you in the app?" {...fp} />
        {form.commit_solo_workouts === 'No' && (
          <div style={{ background: C.orange + '10', border: `1px solid ${C.orange}33`, borderRadius: 10, padding: '14px 16px', marginTop: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.orange, marginBottom: 6 }}>⚠️ REVISIT COMMITMENT LEVEL</div>
            <div style={{ fontSize: 12, lineHeight: 1.7, color: C.text }}>
              The client said they cannot commit to 2 solo workouts per week. Go back to the commitment rating above and have an honest conversation:
            </div>
            <ul style={{ fontSize: 12, lineHeight: 1.8, color: C.text, margin: '8px 0 0 0', paddingLeft: 20 }}>
              <li>What is realistically preventing them from doing 2 workouts on their own?</li>
              <li>Would they be willing to start with even 1 session per week and build up?</li>
              <li>Remind them that the app-based workouts are designed specifically for them and take the guesswork out</li>
              <li>Re-rate their commitment — does the number still feel accurate?</li>
            </ul>
          </div>
        )}

        {/* Personal training sessions commitment */}
        {(form.commit_solo_workouts === 'Yes' || form.commit_solo_workouts === 'No') && (
          <>
            <IntakeYesNo k="commit_pt_sessions" label="Can you commit to 2 personal training sessions with me per week?" {...fp} />
            {form.commit_pt_sessions === 'No' && (
              <>
                <IntakeTextArea k="pt_decline_reason" label="What's holding you back from 2 sessions per week?" placeholder="e.g. Budget, schedule, distance, unsure about commitment..." rows={3} {...fp} />
                <div style={{ background: C.accent + '08', border: `1px solid ${C.accent}22`, borderRadius: 10, padding: '14px 16px', marginTop: 4 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: C.accent, marginBottom: 8 }}>🤖 AI TALKING POINTS — Use these to guide the conversation</div>
                  <div style={{ fontSize: 12, lineHeight: 1.8, color: C.text }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>💰 If finances are the concern:</div>
                    <ul style={{ margin: '0 0 10px 0', paddingLeft: 20 }}>
                      <li>How much do they spend monthly on things that don{"'"}t improve their health? (eating out, subscriptions, impulse purchases)</li>
                      <li>What is the cost of NOT investing in their health? (medical bills, medications, lost productivity, reduced quality of life)</li>
                      <li>Personal training is preventative healthcare — it{"'"}s cheaper than physiotherapy, chiropractic visits, or surgery down the road</li>
                      <li>Ask: "If I could show you that 2 sessions/week gets you to your goals twice as fast, would it be worth finding the budget?"</li>
                    </ul>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>🏥 If health is the concern:</div>
                    <ul style={{ margin: '0 0 10px 0', paddingLeft: 20 }}>
                      <li>The longer they wait, the harder it gets — injuries compound, mobility decreases, recovery slows</li>
                      <li>2 sessions gives enough frequency to build real momentum and see measurable results</li>
                      <li>With only 1 session/week, progress is slower and it{"'"}s easier to lose motivation</li>
                      <li>Their body adapts best with consistent stimulus — 2x/week is the minimum effective dose for real change</li>
                    </ul>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>⏰ If scheduling is the concern:</div>
                    <ul style={{ margin: '0 0 10px 0', paddingLeft: 20 }}>
                      <li>Can they do early mornings or lunch breaks?</li>
                      <li>Sessions can be as short as 30-45 minutes — it{"'"}s about quality, not duration</li>
                      <li>Help them look at their weekly schedule right now and find 2 realistic slots</li>
                    </ul>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>🎯 General closer:</div>
                    <ul style={{ margin: 0, paddingLeft: 20 }}>
                      <li>"You rated your commitment a {form.commitment_rating || '?'}/10 — let{"'"}s make sure your actions match that number"</li>
                      <li>"What would it take for you to say yes to 2 sessions per week?"</li>
                      <li>"Would you be open to trying 2x/week for just 4 weeks and then we reassess?"</li>
                    </ul>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* ── Lifestyle & Activity Level ── */}
      <div style={sectionStyle}>
        {sectionTitle('🏃', 'Lifestyle & Activity Level')}
        <IntakeSelect k="activity_level" label="How would you describe your current activity level?" options={[
          'Sedentary (little or no exercise)',
          'Lightly active (light exercise or sports 1-3 days/week)',
          'Moderately active (moderate exercise or sports 3-5 days/week)',
          'Very active (hard exercise or sports 6-7 days/week)',
          'Super active (very intense exercise or physical job)',
        ]} {...fp} />
        <IntakeSelect k="sleep_hours" label="How many hours of sleep do you typically get each night?" options={[
          'Less than 5 hours',
          '5-6 hours',
          '7-8 hours',
          '9+ hours',
        ]} {...fp} />
        <IntakeRating k="stress_rating" label="On a scale of 1-10, how would you rate your current stress levels? (1 = low, 10 = high)" {...fp} />
        <IntakeYesNo k="mental_health_challenges" label="Do you currently deal with any mental health challenges? (e.g., anxiety, depression)" {...fp} />
        {form.mental_health_challenges === 'Yes' && (
          <>
            <IntakeYesNo k="mental_health_discuss" label="Would you like to discuss this further?" {...fp} />
            {form.mental_health_discuss === 'Yes' && <IntakeTextArea k="mental_health_notes" label="Please share anything you'd like us to know" placeholder="Share as much or as little as you're comfortable with..." rows={3} {...fp} />}
          </>
        )}
      </div>

      {/* ── Fitness Experience ── */}
      <div style={sectionStyle}>
        {sectionTitle('🏋️', 'Fitness Experience')}
        <IntakeSelect k="fitness_experience" label="What is your previous experience with fitness or personal training?" options={['Beginner', 'Intermediate', 'Advanced']} {...fp} />
        <IntakeTextArea k="training_methods" label="Any specific training methods or programs you've followed?" placeholder="e.g. CrossFit, bodybuilding, yoga, P90X..." rows={2} {...fp} />
      </div>

      {/* ── Support System ── */}
      <div style={sectionStyle}>
        {sectionTitle('🤝', 'Support System')}
        <IntakeTextArea k="support_system" label="Describe your support system (e.g., friends, family, accountability partners)" placeholder="Who supports your fitness journey? How do they help?" rows={3} {...fp} />
      </div>

      {/* ── Scheduling Preferences ── */}
      <div style={sectionStyle}>
        {sectionTitle('📅', 'Scheduling Preferences')}
        <label style={labelStyle}>For each day, select availability and preferred time(s)</label>
        {DAYS_OF_WEEK.map(day => {
          const dayData = form.schedule[day] || {}
          const status = dayData.status || ''
          const times = dayData.times || []
          const isActive = status === 'Available' || status === 'Preferred'
          const statusColor = status === 'Preferred' ? C.accent : status === 'Available' ? C.green : status === 'Unavailable' ? C.red : C.border
          return (
            <div key={day} style={{ marginBottom: 10, padding: '12px 14px', background: isActive ? statusColor + '06' : C.faint, border: `1.5px solid ${status ? statusColor + '44' : C.border}`, borderRadius: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: status && status !== 'Unavailable' ? 8 : 0 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{day}</span>
                <div style={{ display: 'flex', gap: 5 }}>
                  {DAY_STATUS_OPTIONS.map(opt => {
                    const selected = status === opt
                    const optColor = opt === 'Preferred' ? C.accent : opt === 'Available' ? C.green : C.red
                    return (
                      <button key={opt} onClick={() => {
                        updateSchedule(day, 'status', selected ? '' : opt)
                        if (opt === 'Unavailable') updateSchedule(day, 'times', [])
                      }} style={{ padding: '4px 10px', borderRadius: 7, border: `1.5px solid ${selected ? optColor : C.border}`, background: selected ? optColor + '15' : 'transparent', color: selected ? optColor : C.sub, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, fontSize: 10, cursor: 'pointer' }}>{selected ? '✓ ' : ''}{opt}</button>
                    )
                  })}
                </div>
              </div>
              {isActive && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {TIME_OPTIONS.map(time => {
                    const selected = times.includes(time)
                    return (
                      <button key={time} onClick={() => {
                        const newTimes = selected ? times.filter(t => t !== time) : [...times, time]
                        updateSchedule(day, 'times', newTimes)
                      }} style={{ padding: '5px 12px', borderRadius: 7, border: `1.5px solid ${selected ? statusColor : C.border}`, background: selected ? statusColor + '15' : 'transparent', color: selected ? statusColor : C.sub, fontFamily: 'Montserrat,sans-serif', fontWeight: 600, fontSize: 11, cursor: 'pointer' }}>{selected ? '✓ ' : ''}{time}</button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Gym Membership ── */}
      <div style={sectionStyle}>
        {sectionTitle('🏢', 'Gym Membership')}
        <IntakeYesNo k="has_gym" label="Do you currently belong to a gym?" {...fp} />
        {form.has_gym === 'Yes' && <IntakeTextInput k="gym_name" label="Which gym?" placeholder="e.g. Planet Fitness, LA Fitness..." {...fp} />}
        {form.has_gym === 'No' && <IntakeYesNo k="planning_gym" label="Are you planning to join a gym in the near future?" {...fp} />}
      </div>

      {/* ── Financial Considerations ── */}
      <div style={sectionStyle}>
        {sectionTitle('💰', 'Financial Considerations')}
        <IntakeYesNo k="financial_concerns" label="Are there any concerns you have about committing to personal training sessions?" {...fp} />
        {form.financial_concerns === 'Yes' && <IntakeTextArea k="financial_concerns_description" label="If yes, please briefly describe" placeholder="Budget constraints, scheduling conflicts..." rows={2} {...fp} />}
      </div>

      {/* ── Referral Source ── */}
      <div style={sectionStyle}>
        {sectionTitle('📣', 'Referral Source')}
        <IntakeSelect k="referral_source" label="How did you hear about FreddyFit Personal Training?" options={['Social Media', 'Referral from a friend/family', 'Google Search', 'Advertisement', 'Other']} {...fp} />
        {form.referral_source === 'Other' && <IntakeTextInput k="referral_other" label="Please specify" placeholder="How did you find us?" {...fp} />}
      </div>

      {/* ── Additional Information ── */}
      <div style={sectionStyle}>
        {sectionTitle('📝', 'Additional Information')}
        <IntakeTextArea k="additional_info" label="Is there anything else you'd like us to know about you, your fitness journey, or your goals?" placeholder="Anything else we should know..." rows={4} {...fp} />
      </div>

      {/* ── Waiver & Signature ── */}
      <div style={sectionStyle}>
        {sectionTitle('✍️', 'Waiver & Signature')}
        <div style={{ fontSize: 12, color: C.text, lineHeight: 1.8, marginBottom: 16, padding: '16px 18px', background: C.faint, borderRadius: 12, border: `1px solid ${C.border}`, maxHeight: 200, overflowY: 'auto' }}>
          {WAIVER_TEXT}
        </div>
        <div style={{ fontSize: 10, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>By signing below, I agree to the terms above</div>
        <SignaturePad value={form.waiver_signature} onChange={val => update('waiver_signature', val)} />
      </div>

      {/* ── Functional Fit Package ── */}
      <div style={sectionStyle}>
        {sectionTitle('🎯', 'Functional Fit Package')}
        <IntakeYesNo k="functional_fit_commit" label="Are you ready to commit to the Functional Fit Package?" {...fp} />

        {form.functional_fit_commit === 'Yes' && (
          <div style={{ marginTop: 8 }}>
            {/* QR Code */}
            <div style={{ textAlign: 'center', padding: '24px 16px', background: '#6C63FF08', borderRadius: 14, border: `2px solid #6C63FF33`, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 2, color: C.text, textTransform: 'uppercase', marginBottom: 2 }}>FunctionalFit</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 12 }}>$299.00</div>
              <div style={{ display: 'inline-block', padding: 12, background: 'white', borderRadius: 14, border: '3px solid #6C63FF', boxShadow: '0 4px 20px #6C63FF22' }}>
                <QRCodeCanvas value="https://buy.stripe.com/5kQ14nawL8Ft4l6fnh3Ru05" size={180} level="H" includeMargin={false} />
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#6C63FF', marginTop: 10 }}>Scan to Pay</div>
            </div>

            {/* Agreement initials */}
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.5, color: C.sub, textTransform: 'uppercase', marginBottom: 12 }}>Please initial each statement below</div>

            {[
              { k: 'functional_fit_initial_1', num: '1', text: 'I understand that I will receive four (4) one-on-one personal training sessions to be scheduled and completed within the next 3–4 weeks from the date of purchase.' },
              { k: 'functional_fit_initial_2', num: '2', text: 'I understand that this package comes with a 100% satisfaction guarantee. If, upon completion of all four (4) sessions, I am not satisfied with the service provided, I am eligible for a full refund. To exercise this guarantee, I must submit my refund request in writing.' },
              { k: 'functional_fit_initial_3', num: '3', text: `I understand the cancellation policy: if I cancel a scheduled session with less than 12 hours' notice, the session will be forfeited and counted as used. If my trainer cancels a session, the next session will be complimentary at no charge to me.` },
            ].map(({ k, num, text }) => {
              const initialed = !!form[k]
              return (
                <div key={k} style={{ display: 'flex', gap: 14, padding: '16px', background: initialed ? C.green + '06' : C.faint, borderRadius: 12, border: `1.5px solid ${initialed ? C.green + '44' : C.border}`, marginBottom: 10, alignItems: 'flex-start' }}>
                  <InitialPad value={form[k]} onChange={val => update(k, val)} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: C.accent, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Statement {num}</div>
                    <div style={{ fontSize: 12, lineHeight: 1.7, color: C.text }}>{text}</div>
                  </div>
                </div>
              )
            })}

            {form.functional_fit_initial_1 && form.functional_fit_initial_2 && form.functional_fit_initial_3 && (
              <div style={{ marginTop: 12, padding: '10px 14px', background: C.green + '10', borderRadius: 8, border: `1px solid ${C.green}33`, fontSize: 12, color: C.green, fontWeight: 700, textAlign: 'center' }}>
                All statements initialed — Functional Fit Package agreement complete
              </div>
            )}
          </div>
        )}

        {form.functional_fit_commit === 'No' && (
          <div style={{ padding: '12px 16px', background: C.orange + '10', borderRadius: 10, border: `1px solid ${C.orange}33`, marginTop: 4 }}>
            <div style={{ fontSize: 12, color: C.orange, fontWeight: 700 }}>Client is not ready to commit at this time. Follow up at a later date.</div>
          </div>
        )}
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

// ── SIGN-IN SHEET ────────────────────────────────────────────────────────────
const PACKAGE_OPTIONS = [
  { label: '3 Months — 24 Sessions', sessions: 24 },
  { label: '6 Months — 48 Sessions', sessions: 48 },
  { label: '12 Months — 96 Sessions', sessions: 96 },
]

function SignInSheet({ client, onBack, onUpdate }) {
  const localKey = `ff_signin_${client.id}`

  // Load from localStorage first (offline safety), then fall back to trainerNotes
  const initialData = (() => {
    try {
      const local = localStorage.getItem(localKey)
      if (local) return JSON.parse(local)
    } catch {}
    if (!client.trainerNotes) return {}
    try { return JSON.parse(client.trainerNotes) } catch { return {} }
  })()

  const [packageType, setPackageType] = useState(initialData.sign_in_package || '')
  const [entries, setEntries] = useState(initialData.sign_in_entries || [])
  const [sessionOffset, setSessionOffset] = useState(initialData.sign_in_offset || 0)
  const [packageLocked, setPackageLocked] = useState(!!initialData.sign_in_package)
  const [showPopup, setShowPopup] = useState(null) // { remaining, total, session }
  const [saving, setSaving] = useState(false)
  const [editingOffset, setEditingOffset] = useState(false)
  const [tempOffset, setTempOffset] = useState(String(initialData.sign_in_offset || 0))
  const [selected, setSelected] = useState(new Set()) // indices of selected entries
  const [deleteConfirm, setDeleteConfirm] = useState(0) // 0=none, 1=first, 2=second, 3=third (executes)
  const [pendingSync, setPendingSync] = useState(!!localStorage.getItem(localKey + '_pending'))
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)

  const totalSessions = PACKAGE_OPTIONS.find(p => p.label === packageType)?.sessions || 0
  const sessionsUsed = entries.length + sessionOffset
  const sessionsRemaining = Math.max(0, totalSessions - sessionsUsed)

  // Save locally first, then try Supabase
  const saveLocal = (pkg, ents, offset) => {
    const data = { sign_in_package: pkg, sign_in_entries: ents, sign_in_offset: offset }
    try { localStorage.setItem(localKey, JSON.stringify(data)) } catch {}
  }

  const syncToSupabase = async (pkg, ents, offset) => {
    try {
      let base = {}
      try { base = JSON.parse(client.trainerNotes || '{}') } catch {}
      const updatedNotes = { ...base, sign_in_package: pkg, sign_in_entries: ents, sign_in_offset: offset }
      const updatedClient = { ...client, trainerNotes: JSON.stringify(updatedNotes) }
      await saveClient(updatedClient)
      onUpdate(updatedClient)
      // Clear pending flag and local cache on successful sync
      localStorage.removeItem(localKey + '_pending')
      localStorage.removeItem(localKey)
      setPendingSync(false)
      return true
    } catch {
      return false
    }
  }

  const saveData = async (pkg, ents, offset) => {
    setSaving(true)
    // Always save locally first — data is never lost
    saveLocal(pkg, ents, offset)
    // Try to sync to Supabase
    const ok = await syncToSupabase(pkg, ents, offset)
    if (!ok) {
      // Mark as pending so we know to retry later
      localStorage.setItem(localKey + '_pending', '1')
      setPendingSync(true)
    }
    setSaving(false)
  }

  // Auto-sync when coming back online
  useEffect(() => {
    const goOnline = () => {
      setOnline(true)
      // If there's pending data, try to sync it
      const pending = localStorage.getItem(localKey + '_pending')
      if (pending) {
        const data = (() => { try { return JSON.parse(localStorage.getItem(localKey)) } catch { return null } })()
        if (data) syncToSupabase(data.sign_in_package, data.sign_in_entries, data.sign_in_offset)
      }
    }
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    // Try syncing on mount if pending
    goOnline()
    return () => { window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline) }
  }, [])

  const handlePackageChange = (val) => {
    setPackageType(val)
    setPackageLocked(true)
    saveData(val, entries, sessionOffset)
  }

  const handleSign = (signature) => {
    const now = new Date()
    const today = now.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
    const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    const sessionNum = entries.length + sessionOffset + 1
    const newEntries = [...entries, { session: sessionNum, date: today, time, signature }]
    setEntries(newEntries)
    saveData(packageType, newEntries, sessionOffset)
    const remaining = Math.max(0, totalSessions - (newEntries.length + sessionOffset))
    setShowPopup({ remaining, total: totalSessions, session: sessionNum })
  }

  const handleDeleteEntry = (idx) => {
    const newEntries = entries.filter((_, i) => i !== idx).map((e, i) => ({ ...e, session: i + sessionOffset + 1 }))
    setEntries(newEntries)
    setSelected(new Set())
    saveData(packageType, newEntries, sessionOffset)
  }

  const toggleSelect = (idx) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(idx) ? next.delete(idx) : next.add(idx)
      return next
    })
    setDeleteConfirm(0)
  }

  const toggleSelectAll = () => {
    if (selected.size === entries.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(entries.map((_, i) => i)))
    }
    setDeleteConfirm(0)
  }

  const handleBulkDelete = () => {
    if (deleteConfirm < 3) {
      setDeleteConfirm(deleteConfirm + 1)
      return
    }
    // 3rd confirmation reached — delete
    const newEntries = entries.filter((_, i) => !selected.has(i)).map((e, i) => ({ ...e, session: i + sessionOffset + 1 }))
    setEntries(newEntries)
    setSelected(new Set())
    setDeleteConfirm(0)
    saveData(packageType, newEntries, sessionOffset)
  }

  const handleOffsetSave = () => {
    const val = Math.max(0, parseInt(tempOffset) || 0)
    setSessionOffset(val)
    setEditingOffset(false)
    // Renumber existing entries to account for new offset
    const renumbered = entries.map((e, i) => ({ ...e, session: i + val + 1 }))
    setEntries(renumbered)
    saveData(packageType, renumbered, val)
  }

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 24px 32px' }}>
      <LogoHeader />
      <button onClick={onBack} style={{ background: 'none', border: `1px solid ${C.border}`, color: C.sub, borderRadius: 7, padding: '6px 14px', fontSize: 12, cursor: 'pointer', marginBottom: 24 }}>← Back to Profile</button>

      <div style={{ fontWeight: 800, fontSize: 26, letterSpacing: 3, color: C.text, marginBottom: 4 }}>Sign-In Sheet</div>
      <div style={{ fontSize: 14, color: C.sub, marginBottom: pendingSync || !online ? 12 : 24 }}>{client.name}</div>

      {/* Offline / Pending Sync Indicator */}
      {(!online || pendingSync) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', marginBottom: 16, borderRadius: 10, fontSize: 12, fontWeight: 700, fontFamily: 'Montserrat,sans-serif', background: !online ? C.orange + '12' : C.sky + '12', border: `1.5px solid ${!online ? C.orange + '44' : C.sky + '44'}`, color: !online ? C.orange : C.sky }}>
          <span style={{ fontSize: 16 }}>{!online ? '⚡' : '↻'}</span>
          {!online
            ? 'You\'re offline — signatures are saved locally and will sync when you reconnect'
            : 'Syncing saved data to cloud...'
          }
        </div>
      )}

      {/* Package Selection */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '20px 24px', marginBottom: 20 }}>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, color: C.sub, textTransform: 'uppercase', marginBottom: 10 }}>{packageLocked ? 'Package' : 'Select Package'}</div>
        {packageLocked ? (
          <div style={{ padding: '12px 14px', borderRadius: 10, border: `2px solid ${C.accent}`, fontSize: 14, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, color: C.text, background: C.faint }}>
            {packageType}
          </div>
        ) : (
          <select
            value={packageType}
            onChange={e => handlePackageChange(e.target.value)}
            style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: `2px solid ${packageType ? C.accent : C.border}`, fontSize: 14, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, color: C.text, background: C.card, outline: 'none', cursor: 'pointer', appearance: 'auto' }}
          >
            <option value="">— Choose a package —</option>
            {PACKAGE_OPTIONS.map(p => (
              <option key={p.label} value={p.label}>{p.label}</option>
            ))}
          </select>
        )}
        {packageType && (
          <div style={{ marginTop: 12 }}>
            {editingOffset ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.sub }}>Previous sessions completed:</span>
                <input
                  type="number"
                  min="0"
                  max={totalSessions - 1}
                  value={tempOffset}
                  onChange={e => setTempOffset(e.target.value)}
                  style={{ width: 70, padding: '6px 10px', borderRadius: 8, border: `2px solid ${C.accent}`, fontSize: 14, fontWeight: 700, color: C.text, background: C.card, outline: 'none', fontFamily: 'Montserrat,sans-serif', textAlign: 'center' }}
                />
                <button onClick={handleOffsetSave} style={{ background: C.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif' }}>Save</button>
                <button onClick={() => { setEditingOffset(false); setTempOffset(String(sessionOffset)) }} style={{ background: 'none', border: `1px solid ${C.border}`, color: C.sub, borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif' }}>Cancel</button>
              </div>
            ) : (
              <button onClick={() => { setEditingOffset(true); setTempOffset(String(sessionOffset)) }} style={{ background: 'none', border: 'none', color: C.accent, fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0, fontFamily: 'Montserrat,sans-serif' }}>
                {sessionOffset > 0 ? `${sessionOffset} previous sessions recorded` : 'Set previous sessions completed'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Session Counter */}
      {packageType && (
        <>
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: C.accent }}>{sessionsUsed}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.sub, letterSpacing: 1, textTransform: 'uppercase', marginTop: 2 }}>Sessions Used</div>
            </div>
            <div style={{ flex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: sessionsRemaining <= 4 ? C.orange : C.green }}>{sessionsRemaining}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.sub, letterSpacing: 1, textTransform: 'uppercase', marginTop: 2 }}>Remaining</div>
            </div>
            <div style={{ flex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: C.text }}>{totalSessions}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.sub, letterSpacing: 1, textTransform: 'uppercase', marginTop: 2 }}>Total</div>
            </div>
          </div>

          {/* Sign-In Area */}
          {sessionsRemaining > 0 ? (
            <div style={{ background: C.card, border: `2px solid ${C.accent}44`, borderRadius: 14, padding: '20px 24px', marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, color: C.accent, textTransform: 'uppercase', marginBottom: 4 }}>Session {sessionsUsed + 1} of {totalSessions}</div>
              <div style={{ fontSize: 13, color: C.sub, marginBottom: 12 }}>Sign below to check in for today's session</div>
              <SignInPad onSign={handleSign} saving={saving} />
            </div>
          ) : (
            <div style={{ background: C.orange + '10', border: `2px solid ${C.orange}44`, borderRadius: 14, padding: '20px 24px', marginBottom: 20, textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: C.orange, marginBottom: 4 }}>Package Complete</div>
              <div style={{ fontSize: 13, color: C.sub }}>All {totalSessions} sessions have been used. Select a new package to continue.</div>
            </div>
          )}

          {/* Sign-In History */}
          {entries.length > 0 && (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '20px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, color: C.sub, textTransform: 'uppercase' }}>Sign-In History</div>
                {selected.size > 0 && (
                  <button onClick={handleBulkDelete} style={{
                    background: deleteConfirm === 0 ? C.red : deleteConfirm === 1 ? C.red : deleteConfirm === 2 ? '#b91c1c' : '#7f1d1d',
                    color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif',
                    animation: deleteConfirm > 0 ? 'none' : undefined
                  }}>
                    {deleteConfirm === 0 && `Delete ${selected.size} Selected`}
                    {deleteConfirm === 1 && `Are you sure? (1/3)`}
                    {deleteConfirm === 2 && `Really delete? (2/3)`}
                    {deleteConfirm === 3 && `FINAL confirm — delete forever (3/3)`}
                  </button>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '30px 40px 1fr 70px 70px', gap: '0', fontSize: 10, fontWeight: 700, color: C.sub, letterSpacing: 1, textTransform: 'uppercase', padding: '0 0 8px', borderBottom: `1px solid ${C.border}`, alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <input type="checkbox" checked={selected.size === entries.length && entries.length > 0} onChange={toggleSelectAll} style={{ width: 16, height: 16, cursor: 'pointer', accentColor: C.accent }} title="Select All" />
                </div>
                <div>#</div>
                <div>Date</div>
                <div>Time</div>
                <div>Signature</div>
              </div>
              {[...entries].reverse().map((entry, i) => {
                const realIdx = entries.length - 1 - i
                const isSelected = selected.has(realIdx)
                return (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '30px 40px 1fr 70px 70px', gap: '0', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${C.border}11`, background: isSelected ? C.red + '08' : 'transparent' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(realIdx)} style={{ width: 16, height: 16, cursor: 'pointer', accentColor: C.accent }} />
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: C.accent }}>{entry.session}</div>
                    <div style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>{entry.date}</div>
                    <div style={{ fontSize: 12, color: C.sub, fontWeight: 600 }}>{entry.time || '—'}</div>
                    <div>{entry.signature && <img src={entry.signature} alt="sig" style={{ height: 28, borderRadius: 4, border: `1px solid ${C.border}` }} />}</div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Sessions Remaining Popup */}
      {showPopup && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={() => setShowPopup(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.card, borderRadius: 20, padding: '40px 36px', textAlign: 'center', maxWidth: 360, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: 2, color: C.accent, textTransform: 'uppercase', marginBottom: 8 }}>Session {showPopup.session} Complete</div>
            <div style={{ fontSize: 56, fontWeight: 800, color: showPopup.remaining <= 4 ? C.orange : C.green, lineHeight: 1, margin: '16px 0' }}>{showPopup.remaining}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 4 }}>
              {showPopup.remaining === 0 ? 'No sessions remaining' : `Session${showPopup.remaining === 1 ? '' : 's'} Remaining`}
            </div>
            <div style={{ fontSize: 12, color: C.sub, marginBottom: 24 }}>out of {showPopup.total} total sessions</div>
            {showPopup.remaining <= 4 && showPopup.remaining > 0 && (
              <div style={{ background: C.orange + '15', border: `1px solid ${C.orange}33`, borderRadius: 10, padding: '10px 14px', marginBottom: 20, fontSize: 12, color: C.orange, fontWeight: 700 }}>
                Running low — time to discuss renewal!
              </div>
            )}
            {showPopup.remaining === 0 && (
              <div style={{ background: C.orange + '15', border: `1px solid ${C.orange}33`, borderRadius: 10, padding: '10px 14px', marginBottom: 20, fontSize: 12, color: C.orange, fontWeight: 700 }}>
                Package complete! Select a new package to continue.
              </div>
            )}
            <Btn onClick={() => setShowPopup(null)}>Got It</Btn>
          </div>
        </div>
      )}
    </div>
  )
}

function SignInPad({ onSign, saving }) {
  const canvasRef = useRef(null)
  const isDrawing = useRef(false)
  const hasDrawn = useRef(false)
  const lastPoint = useRef(null)

  const drawGuideLine = (ctx, w, h) => {
    ctx.save()
    ctx.strokeStyle = '#ddd'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(20, h - 20)
    ctx.lineTo(w - 20, h - 20)
    ctx.stroke()
    ctx.restore()
    ctx.save()
    ctx.font = '14px Montserrat, sans-serif'
    ctx.fillStyle = '#ccc'
    ctx.fillText('\u2715', 8, h - 12)
    ctx.restore()
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * 2
    canvas.height = rect.height * 2
    ctx.scale(2, 2)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    drawGuideLine(ctx, rect.width, rect.height)

    // Prevent all default touch behaviors on the canvas
    const prevent = (e) => e.preventDefault()
    canvas.addEventListener('touchstart', prevent, { passive: false })
    canvas.addEventListener('touchmove', prevent, { passive: false })
    canvas.addEventListener('touchend', prevent, { passive: false })
    canvas.addEventListener('contextmenu', prevent)
    canvas.addEventListener('selectstart', prevent)
    canvas.addEventListener('dblclick', prevent)
    return () => {
      canvas.removeEventListener('touchstart', prevent)
      canvas.removeEventListener('touchmove', prevent)
      canvas.removeEventListener('touchend', prevent)
      canvas.removeEventListener('contextmenu', prevent)
      canvas.removeEventListener('selectstart', prevent)
      canvas.removeEventListener('dblclick', prevent)
    }
  }, [])

  const getPos = (e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const touch = e.touches ? e.touches[0] : e
    return { x: touch.clientX - rect.left, y: touch.clientY - rect.top }
  }

  const startDraw = (e) => {
    e.preventDefault()
    e.stopPropagation()
    hasDrawn.current = true
    isDrawing.current = true
    lastPoint.current = getPos(e)
  }

  const draw = (e) => {
    if (!isDrawing.current) return
    e.preventDefault()
    e.stopPropagation()
    const ctx = canvasRef.current.getContext('2d')
    const pos = getPos(e)
    ctx.strokeStyle = '#1a1a2e'
    ctx.lineWidth = 2.5
    ctx.setLineDash([])
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(lastPoint.current.x, lastPoint.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    lastPoint.current = pos
  }

  const endDraw = (e) => {
    if (e) { e.preventDefault(); e.stopPropagation() }
    isDrawing.current = false
    lastPoint.current = null
  }

  const clear = () => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    ctx.clearRect(0, 0, rect.width, rect.height)
    hasDrawn.current = false
    drawGuideLine(ctx, rect.width, rect.height)
  }

  const handleSubmit = () => {
    if (!hasDrawn.current) return
    const sig = canvasRef.current.toDataURL()
    onSign(sig)
    setTimeout(() => {
      hasDrawn.current = false
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      const rect = canvas.getBoundingClientRect()
      ctx.clearRect(0, 0, rect.width, rect.height)
      drawGuideLine(ctx, rect.width, rect.height)
    }, 300)
  }

  return (
    <div>
      <div style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', top: '35%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none', zIndex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: '#bbb', fontWeight: 600, fontFamily: 'Montserrat,sans-serif' }}>Sign to check in</div>
          <div style={{ fontSize: 10, color: '#ccc', marginTop: 2, fontFamily: 'Montserrat,sans-serif' }}>Use your finger or mouse</div>
        </div>
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: 120, border: `2px solid ${C.border}`, borderRadius: 12, background: '#fafbfc', touchAction: 'none', cursor: 'crosshair', position: 'relative', zIndex: 2, userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
          onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
          onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}
        />
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
        <button onClick={clear} style={{ background: 'none', border: `1.5px solid ${C.border}`, color: C.sub, borderRadius: 8, padding: '8px 18px', fontSize: 12, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif', fontWeight: 600 }}>Clear</button>
        <Btn onClick={handleSubmit} disabled={saving}>{saving ? 'Saving...' : 'Sign In'}</Btn>
      </div>
    </div>
  )
}

// ── PROGRAM UPLOADS ──────────────────────────────────────────────────────────
const DAYS_PER_WEEK = 2

function ProgramUploads({ client, onUpdate }) {
  const parseNotes = () => { try { return JSON.parse(client.trainerNotes || '{}') } catch { return {} } }
  const stored = parseNotes()
  const [programFile, setProgramFile] = useState(stored.program_file || null)
  const [entries, setEntries] = useState(stored.program_entries || [])
  const [startWeek, setStartWeek] = useState(stored.program_start_week || 1)
  const [startDay, setStartDay] = useState(stored.program_start_day || 1)
  const [saving, setSaving] = useState(false)
  const [copiedAll, setCopiedAll] = useState(false)
  const [showProgram, setShowProgram] = useState(false)
  const [activeEntry, setActiveEntry] = useState(null)
  const [draftNotes, setDraftNotes] = useState('')
  const [scrollToWeek, setScrollToWeek] = useState(null)

  const persist = async (updates) => {
    setSaving(true)
    try {
      const base = parseNotes()
      const merged = { ...base, ...updates }
      const updatedClient = { ...client, trainerNotes: JSON.stringify(merged) }
      await saveClient(updatedClient)
      onUpdate(updatedClient)
    } catch (e) { alert('Error saving: ' + e.message) }
    setSaving(false)
  }

  const handleUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { alert('File too large — max 2 MB. Try a lower resolution photo.'); return }
    const reader = new FileReader()
    reader.onload = () => {
      const pf = { data: reader.result, name: file.name, uploadedAt: new Date().toISOString() }
      setProgramFile(pf)
      setShowProgram(true)
      persist({ program_file: pf })
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const removeProgram = () => {
    if (!confirm('Remove the uploaded program?')) return
    setProgramFile(null)
    setShowProgram(false)
    persist({ program_file: null })
  }

  // Calculate week/day for the next entry
  const getNextWeekDay = () => {
    if (entries.length === 0) return { week: startWeek, day: startDay }
    const last = entries[entries.length - 1]
    let nextDay = last.day + 1
    let nextWeek = last.week
    if (nextDay > DAYS_PER_WEEK) { nextDay = 1; nextWeek++ }
    return { week: nextWeek, day: nextDay }
  }

  const saveEntry = () => {
    if (!draftNotes.trim()) return
    const wd = getNextWeekDay()
    const newEntry = { week: wd.week, day: wd.day, notes: draftNotes.trim(), savedAt: new Date().toISOString() }
    const updated = [...entries, newEntry]
    setEntries(updated)
    setDraftNotes('')
    setActiveEntry(null)
    persist({ program_entries: updated })
  }

  const deleteEntry = (idx) => {
    if (!confirm('Delete this entry?')) return
    const updated = entries.filter((_, i) => i !== idx)
    setEntries(updated)
    persist({ program_entries: updated })
  }

  const updateStartWeek = (w) => {
    const v = Math.max(1, parseInt(w) || 1)
    setStartWeek(v)
    persist({ program_start_week: v })
  }

  const updateStartDay = (d) => {
    const v = Math.max(1, Math.min(DAYS_PER_WEEK, parseInt(d) || 1))
    setStartDay(v)
    persist({ program_start_day: v })
  }

  const copyAllNotes = () => {
    const text = entries.map(e => `Week ${e.week} Day ${e.day}:\n${e.notes}`).join('\n\n')
    navigator.clipboard.writeText(text).then(() => {
      setCopiedAll(true)
      setTimeout(() => setCopiedAll(false), 2000)
    })
  }

  // Group entries by week for scrolling
  const weeks = {}
  entries.forEach((e, idx) => {
    if (!weeks[e.week]) weeks[e.week] = []
    weeks[e.week].push({ ...e, idx })
  })
  const weekNums = Object.keys(weeks).map(Number).sort((a, b) => a - b)

  const next = getNextWeekDay()
  const chipStyle = (active) => ({ padding: '4px 12px', borderRadius: 20, border: `1.5px solid ${active ? C.accent : C.border}`, background: active ? C.accent + '12' : 'transparent', color: active ? C.accent : C.sub, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif' })

  // ── No program uploaded yet ──
  if (!programFile) {
    return (
      <div style={{ background: C.faint, border: `1px dashed ${C.border}`, borderRadius: 14, padding: '20px 24px', marginBottom: 20, textAlign: 'center' }}>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, color: C.sub, textTransform: 'uppercase', marginBottom: 8 }}>Program Journal</div>
        <div style={{ fontSize: 12, color: C.sub, marginBottom: 12 }}>Upload your written program, then log notes for each workout day</div>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 8, background: C.accent, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif' }}>
          Upload Program
          <input type="file" accept="image/*,.pdf" onChange={handleUpload} style={{ display: 'none' }} />
        </label>
      </div>
    )
  }

  // ── Main view ──
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '20px 24px', marginBottom: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, color: C.sub, textTransform: 'uppercase' }}>Program Journal</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setShowProgram(!showProgram)} style={{ padding: '5px 12px', borderRadius: 7, border: `1.5px solid ${showProgram ? C.accent : C.border}`, background: showProgram ? C.accent + '12' : 'transparent', color: showProgram ? C.accent : C.sub, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif' }}>
            {showProgram ? 'Hide Program' : 'View Program'}
          </button>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 7, border: `1.5px solid ${C.border}`, background: 'transparent', color: C.sub, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif' }}>
            Replace
            <input type="file" accept="image/*,.pdf" onChange={handleUpload} style={{ display: 'none' }} />
          </label>
        </div>
      </div>

      {/* Side-by-side: Program on left, Notes on right */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>

        {/* Left: Program viewer (sticky so it stays visible while scrolling notes) */}
        {showProgram && (
          <div style={{ flex: '1 1 320px', minWidth: 280, maxWidth: 500, position: 'sticky', top: 60, alignSelf: 'flex-start' }}>
            <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
              {programFile.data?.startsWith('data:image') && (
                <img src={programFile.data} alt={programFile.name} style={{ width: '100%', maxHeight: 600, objectFit: 'contain', display: 'block' }} />
              )}
              {programFile.data?.startsWith('data:application/pdf') && (
                <div style={{ padding: '20px 16px', textAlign: 'center' }}>
                  <a href={programFile.data} download={programFile.name} style={{ fontSize: 12, color: C.accent, fontWeight: 700, textDecoration: 'none' }}>Download PDF: {programFile.name}</a>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
              <div style={{ fontSize: 10, color: C.sub }}>{programFile.name}</div>
              <button onClick={removeProgram} style={{ padding: '3px 10px', borderRadius: 6, border: `1px solid ${C.red}44`, background: 'transparent', color: C.red, fontSize: 9, fontWeight: 700, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif' }}>Remove</button>
            </div>
          </div>
        )}

        {/* Right: Notes journal */}
        <div style={{ flex: '1 1 320px', minWidth: 280 }}>

          {/* Starting Week / Day selector */}
          {entries.length === 0 && (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 14px', borderRadius: 10, background: C.faint, border: `1px solid ${C.border}`, marginBottom: 14, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.text }}>Start at:</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: C.sub }}>Week</span>
                <input type="number" min="1" value={startWeek} onChange={e => updateStartWeek(e.target.value)} style={{ width: 50, padding: '4px 8px', borderRadius: 6, border: `1.5px solid ${C.border}`, fontSize: 13, fontWeight: 700, textAlign: 'center', fontFamily: 'Montserrat,sans-serif', color: C.text }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: C.sub }}>Day</span>
                <input type="number" min="1" max={DAYS_PER_WEEK} value={startDay} onChange={e => updateStartDay(e.target.value)} style={{ width: 50, padding: '4px 8px', borderRadius: 6, border: `1.5px solid ${C.border}`, fontSize: 13, fontWeight: 700, textAlign: 'center', fontFamily: 'Montserrat,sans-serif', color: C.text }} />
              </div>
              <div style={{ fontSize: 10, color: C.sub }}>({DAYS_PER_WEEK} days per week)</div>
            </div>
          )}

          {/* Week chips for scrolling */}
          {weekNums.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: C.sub, fontWeight: 700 }}>Jump to:</span>
              {weekNums.map(w => (
                <button key={w} onClick={() => { setScrollToWeek(w); setTimeout(() => setScrollToWeek(null), 100) }} style={chipStyle(scrollToWeek === w)}>
                  Wk {w}
                </button>
              ))}
              {entries.length > 0 && (
                <button onClick={copyAllNotes} style={{ ...chipStyle(copiedAll), marginLeft: 'auto', borderColor: copiedAll ? C.green : C.accent, color: copiedAll ? C.green : C.accent, background: copiedAll ? C.green + '12' : C.accent + '08' }}>
                  {copiedAll ? '✓ Copied!' : 'Copy All Notes'}
                </button>
              )}
            </div>
          )}

          {/* Previous entries grouped by week */}
          {weekNums.map(w => (
            <div key={w} id={`program-week-${w}`} ref={el => { if (scrollToWeek === w && el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }) }} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, color: C.teal, textTransform: 'uppercase', marginBottom: 6, paddingLeft: 2 }}>Week {w}</div>
              {weeks[w].map(e => (
                <div key={e.idx} style={{ display: 'flex', gap: 10, padding: '10px 14px', borderRadius: 10, border: `1px solid ${C.border}`, marginBottom: 6, background: C.faint, alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 48, textAlign: 'center' }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: C.accent, letterSpacing: 1 }}>DAY {e.day}</div>
                    <div style={{ fontSize: 9, color: C.sub, marginTop: 2 }}>{new Date(e.savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                  </div>
                  <div style={{ flex: 1, fontSize: 12, color: C.text, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{e.notes}</div>
                  <button onClick={() => deleteEntry(e.idx)} style={{ background: 'none', border: 'none', color: C.red + '88', fontSize: 14, cursor: 'pointer', padding: '0 4px', flexShrink: 0 }} title="Delete">x</button>
                </div>
              ))}
            </div>
          ))}

          {/* Active notes entry */}
          <div style={{ border: `2px solid ${C.accent}44`, borderRadius: 12, padding: '14px 16px', background: C.accent + '04' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div>
                <span style={{ fontSize: 12, fontWeight: 800, color: C.accent }}>Week {next.week} — Day {next.day}</span>
                <span style={{ fontSize: 10, color: C.sub, marginLeft: 8 }}>What did you end up doing?</span>
              </div>
              {saving && <span style={{ fontSize: 10, color: C.sub }}>Saving...</span>}
            </div>
            <textarea
              value={draftNotes}
              onChange={e => setDraftNotes(e.target.value)}
              rows={4}
              placeholder="e.g. Swapped barbell squats for goblet squats. Added face pulls. Client felt good at 3x10 tempo..."
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 13, fontFamily: 'Montserrat,sans-serif', color: C.text, background: '#fff', resize: 'vertical', outline: 'none', boxSizing: 'border-box', lineHeight: 1.6 }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button onClick={saveEntry} disabled={!draftNotes.trim() || saving} style={{ padding: '7px 18px', borderRadius: 8, background: draftNotes.trim() ? C.accent : C.border, color: '#fff', fontSize: 12, fontWeight: 700, cursor: draftNotes.trim() ? 'pointer' : 'default', border: 'none', fontFamily: 'Montserrat,sans-serif', opacity: draftNotes.trim() ? 1 : 0.5 }}>
                Save & Next Day
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── CLIENT PROFILE ────────────────────────────────────────────────────────────
function ClientProfile({ client, onUpdate, onRunAssessment, onBuildProgram, onGenerateWorkout, onProtocolAdvisor, onEditClient, onSignInSheet, onBack }) {
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
          <Btn onClick={() => onSignInSheet(client)} small color={C.green}>📋 Sign-In Sheet</Btn>
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
                  ['Surgery', intake.had_surgery], ['Surgery details', intake.surgery_description],
                  ['Foot pain', intake.pain_foot === 'Yes' ? `Yes — ${intake.pain_foot_side || 'unspecified'}` : intake.pain_foot],
                  ['Knee pain', intake.pain_knee === 'Yes' ? `Yes — ${intake.pain_knee_side || 'unspecified'}` : intake.pain_knee],
                  ['Hip pain', intake.pain_hip === 'Yes' ? `Yes — ${intake.pain_hip_side || 'unspecified'}` : intake.pain_hip],
                  ['Back pain', intake.pain_back === 'Yes' ? `Yes — ${intake.pain_back_side || 'unspecified'}` : intake.pain_back],
                  ['Shoulder pain', intake.pain_shoulder === 'Yes' ? `Yes — ${intake.pain_shoulder_side || 'unspecified'}` : intake.pain_shoulder],
                  ['Neck pain', intake.pain_neck === 'Yes' ? `Yes — ${intake.pain_neck_side || 'unspecified'}` : intake.pain_neck],
                  ['Migraines', intake.pain_migraines === 'Yes' ? `Yes — ${intake.pain_migraines_side || 'unspecified'}` : intake.pain_migraines],
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
                  ['2 solo workouts/week', intake.commit_solo_workouts],
                  ['2 PT sessions/week', intake.commit_pt_sessions],
                  ['PT decline reason', intake.pt_decline_reason],
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
                <Section title="Functional Fit Package" items={[
                  ['Committed', intake.functional_fit_commit],
                  ['Initialed: 4 sessions / 3-4 weeks', intake.functional_fit_initial_1 ? '✓ Signed' : ''],
                  ['Initialed: 100% guarantee', intake.functional_fit_initial_2 ? '✓ Signed' : ''],
                  ['Initialed: Cancellation policy', intake.functional_fit_initial_3 ? '✓ Signed' : ''],
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

      {/* Program Uploads */}
      <ProgramUploads client={client} onUpdate={onUpdate} />

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

  // Birthday countdown
  const upcomingBirthdays = (() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return clients
      .filter(c => c.dob)
      .map(c => {
        const dob = new Date(c.dob + 'T00:00:00')
        const nextBday = new Date(today.getFullYear(), dob.getMonth(), dob.getDate())
        if (nextBday < today) nextBday.setFullYear(nextBday.getFullYear() + 1)
        const diffDays = Math.round((nextBday - today) / (1000 * 60 * 60 * 24))
        const age = nextBday.getFullYear() - dob.getFullYear()
        return { name: c.name, daysUntil: diffDays, date: nextBday, age }
      })
      .sort((a, b) => a.daysUntil - b.daysUntil)
      .slice(0, 5)
  })()

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

      {/* Birthday Countdown */}
      {!loading && upcomingBirthdays.length > 0 && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 22px', marginBottom: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, color: C.accent, textTransform: 'uppercase', marginBottom: 14 }}>Upcoming Birthdays</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {upcomingBirthdays.map((b, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: b.daysUntil === 0 ? C.accent + '18' : C.faint, borderRadius: 10, border: b.daysUntil === 0 ? `2px solid ${C.accent}44` : `1px solid ${C.border}22` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 20 }}>{b.daysUntil === 0 ? '🎂' : '🎈'}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{b.name}</div>
                    <div style={{ fontSize: 11, color: C.sub, marginTop: 1 }}>
                      {b.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — Turning {b.age}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: b.daysUntil === 0 ? C.accent : b.daysUntil <= 7 ? C.orange : C.text, lineHeight: 1 }}>{b.daysUntil}</div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: C.sub, letterSpacing: 1, textTransform: 'uppercase', marginTop: 2 }}>{b.daysUntil === 0 ? 'Today!' : b.daysUntil === 1 ? 'Day' : 'Days'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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

  // Prevent inputs from scrolling to the very top — keep them centered on screen
  useEffect(() => {
    const handleFocus = (e) => {
      const el = e.target
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
        // Small delay to let the keyboard open and layout settle
        setTimeout(() => {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 300)
      }
    }
    document.addEventListener('focus', handleFocus, true)
    return () => document.removeEventListener('focus', handleFocus, true)
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
            {view === 'intake' ? 'New Client' : view === 'assessment' ? assessment?.name : view === 'program' ? 'Program Builder' : view === 'workout' ? 'Workout Generator' : view === 'protocols' ? 'Protocol Advisor' : view === 'signin' ? 'Sign-In Sheet' : view === 'editClient' ? 'Edit Client' : client?.name}
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
            onSignInSheet={c => { setClient(c); setView('signin') }}
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
        {view === 'signin' && client && (
          <SignInSheet
            client={client}
            onUpdate={updateClient}
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
