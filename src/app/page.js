'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { getAllClients, saveClient, deleteClient, getAssessmentsForClient, saveAssessment, getProgramForClient, saveProgram, saveWorkout, getWorkoutsForClient, getWeightLogsForClient, saveWeightLog, deleteWeightLog, getAllLeads, saveLead, deleteLead, getBloodWork, saveBloodWork, deleteBloodWork, getSessions, getRecurringSessions, saveSession, deleteSession } from '../lib/supabase'
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

// ── SCROLLING REMINDER TICKER ────────────────────────────────────────────────
function ReminderTicker({ clients }) {
  const today = new Date().toISOString().split('T')[0]
  const allReminders = (clients || []).flatMap(c => {
    let intake = null
    try { intake = JSON.parse(c.trainerNotes || c.trainer_notes || '{}') } catch {}
    const reminders = intake?.reminders || []
    return reminders.filter(r => !r.done).map(r => ({ ...r, clientName: c.name, clientId: c.id }))
  }).sort((a, b) => new Date(a.date) - new Date(b.date))

  if (allReminders.length === 0) return null

  const items = allReminders.map(r => {
    const isOverdue = r.date < today
    const dateStr = new Date(r.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return { ...r, isOverdue, dateStr }
  })

  // Duplicate items for seamless loop
  const tickerContent = [...items, ...items]

  return (
    <>
      <style>{`
        @keyframes reminderScroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
      <div className="no-print" style={{
        background: C.card,
        borderBottom: `1px solid ${C.border}`,
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        position: 'relative',
        flexShrink: 0,
      }}>
        {/* Static label */}
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, zIndex: 2,
          display: 'flex', alignItems: 'center',
          background: `linear-gradient(90deg, ${C.card} 80%, transparent)`,
          paddingLeft: 12, paddingRight: 18,
        }}>
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2, color: C.accent, textTransform: 'uppercase' }}>📌 REMINDERS</span>
        </div>
        {/* Scrolling track */}
        <div style={{
          display: 'inline-flex', alignItems: 'center',
          animation: `reminderScroll ${Math.max(items.length * 6, 15)}s linear infinite`,
          paddingLeft: 130,
        }}>
          {tickerContent.map((r, i) => (
            <span key={`${r.id}-${i}`} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 18px',
              fontSize: 12, fontFamily: 'Montserrat,sans-serif', fontWeight: 600,
              color: r.isOverdue ? C.red : C.text,
            }}>
              <span style={{
                fontSize: 10, fontWeight: 800,
                background: r.isOverdue ? C.red + '18' : C.accent + '15',
                color: r.isOverdue ? C.red : C.accent,
                borderRadius: 6, padding: '2px 8px',
              }}>{r.clientName}</span>
              <span>{r.note}</span>
              <span style={{ fontSize: 10, color: r.isOverdue ? C.red + 'AA' : C.sub }}>
                {r.isOverdue ? '⚠️ overdue' : r.dateStr}
              </span>
              <span style={{ color: C.border, margin: '0 8px' }}>•</span>
            </span>
          ))}
        </div>
        {/* Right fade */}
        <div style={{
          position: 'absolute', right: 0, top: 0, bottom: 0, width: 40, zIndex: 2,
          background: `linear-gradient(270deg, ${C.card} 40%, transparent)`,
        }} />
      </div>
    </>
  )
}

// ── REST TIMER ───────────────────────────────────────────────────────────────
function RestTimer() {
  const [open, setOpen] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [running, setRunning] = useState(false)
  const [totalSeconds, setTotalSeconds] = useState(0)
  const intervalRef = useRef(null)
  const audioCtxRef = useRef(null)
  const silentBufferRef = useRef(null)
  const keepAliveRef = useRef(null)

  // Get or create AudioContext — must be called during a user tap on iOS
  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      try {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)()
        // Create a reusable silent buffer for keep-alive pings
        const buf = audioCtxRef.current.createBuffer(1, 1, 22050)
        silentBufferRef.current = buf
      } catch {}
    }
    const ctx = audioCtxRef.current
    if (ctx?.state === 'suspended') ctx.resume()
    return ctx
  }, [])

  // Play a silent sound to keep iOS audio context alive — call on every user tap
  const unlockAudio = useCallback(() => {
    const ctx = getAudioCtx()
    if (!ctx || !silentBufferRef.current) return
    const src = ctx.createBufferSource()
    src.buffer = silentBufferRef.current
    src.connect(ctx.destination)
    src.start(0)
  }, [getAudioCtx])

  // Play 5-second continuous beep alert — works reliably on iOS/iPad
  const playBeep = useCallback(() => {
    try {
      const ctx = getAudioCtx()
      if (!ctx) return
      if (ctx.state === 'suspended') ctx.resume()
      const now = ctx.currentTime

      // Single continuous oscillator for full 5 seconds — iOS handles one long tone
      // much more reliably than many short scheduled tones
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'square'
      osc.frequency.setValueAtTime(880, now)

      // Pulsing pattern: alternate between loud and soft to create urgency
      // Each pulse cycle is 0.5s (0.3s on, 0.2s softer) = 10 pulses in 5s
      for (let i = 0; i < 10; i++) {
        const t = now + i * 0.5
        gain.gain.setValueAtTime(0.4, t)
        gain.gain.setValueAtTime(0.08, t + 0.3)
        // Step up frequency every 2 pulses for ascending urgency
        if (i % 2 === 0) {
          const freqs = [880, 988, 1047, 1175, 1319]
          osc.frequency.setValueAtTime(freqs[Math.min(Math.floor(i / 2), freqs.length - 1)], t)
        }
      }
      // Fade out at the very end
      gain.gain.setValueAtTime(0.4, now + 4.8)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 5.0)

      osc.start(now)
      osc.stop(now + 5.0)

      // Speak "Time to get back to work!" after the beeps
      if ('speechSynthesis' in window) {
        setTimeout(() => {
          const msg = new SpeechSynthesisUtterance('Time to get back to work!')
          msg.rate = 1.0
          msg.pitch = 1.1
          msg.volume = 1.0
          window.speechSynthesis.cancel()
          window.speechSynthesis.speak(msg)
        }, 5000)
      }
    } catch {}
  }, [getAudioCtx])

  // Keep audio context alive while timer is running (iOS suspends after ~30s idle)
  useEffect(() => {
    if (running) {
      keepAliveRef.current = setInterval(() => {
        const ctx = audioCtxRef.current
        if (!ctx || !silentBufferRef.current) return
        if (ctx.state === 'suspended') ctx.resume()
        const src = ctx.createBufferSource()
        src.buffer = silentBufferRef.current
        src.connect(ctx.destination)
        src.start(0)
      }, 5000) // ping every 5s to prevent iOS from suspending context
    }
    return () => clearInterval(keepAliveRef.current)
  }, [running])

  useEffect(() => {
    if (running && seconds > 0) {
      intervalRef.current = setInterval(() => {
        setSeconds(s => {
          if (s <= 1) {
            clearInterval(intervalRef.current)
            setRunning(false)
            playBeep()
            return 0
          }
          return s - 1
        })
      }, 1000)
    }
    return () => clearInterval(intervalRef.current)
  }, [running, playBeep])

  const start = (secs) => {
    unlockAudio()
    clearInterval(intervalRef.current)
    setSeconds(secs)
    setTotalSeconds(secs)
    setRunning(true)
    setOpen(true)
  }

  const pause = () => { unlockAudio(); clearInterval(intervalRef.current); setRunning(false) }
  const resume = () => { unlockAudio(); if (seconds > 0) setRunning(true) }
  const reset = () => { unlockAudio(); clearInterval(intervalRef.current); setRunning(false); setSeconds(0); setTotalSeconds(0) }

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss = String(seconds % 60).padStart(2, '0')
  const progress = totalSeconds > 0 ? seconds / totalSeconds : 0
  const done = totalSeconds > 0 && seconds === 0 && !running

  const presets = [
    { label: '30s', secs: 30 },
    { label: '60s', secs: 60 },
    { label: '90s', secs: 90 },
    { label: '2m', secs: 120 },
    { label: '3m', secs: 180 },
  ]

  // Minimized floating button
  if (!open) {
    return (
      <button
        onClick={() => { unlockAudio(); setOpen(true) }}
        style={{
          position: 'fixed', top: 62, right: 16, zIndex: 10000,
          width: running ? 52 : 44, height: running ? 52 : 44,
          borderRadius: '50%',
          background: running ? C.accent : done ? C.green : C.panel,
          border: `2px solid ${running ? C.accent : done ? C.green : C.border}`,
          color: running ? '#000' : done ? '#fff' : C.sub,
          fontFamily: 'Montserrat,sans-serif', fontWeight: 700,
          fontSize: running ? 11 : 16, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
          transition: 'all .2s',
          animation: done ? 'timerPulse 1s ease-in-out infinite' : 'none',
        }}
      >
        {running ? `${mm}:${ss}` : done ? '✓' : '⏱'}
      </button>
    )
  }

  // Expanded panel
  return (
    <>
      <style>{`
        @keyframes timerPulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.08)} }
      `}</style>
      <div style={{
        position: 'fixed', top: 58, right: 12, zIndex: 10000,
        background: C.panel, borderRadius: 16,
        border: `1.5px solid ${C.border}`,
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        padding: 16, width: 200,
        fontFamily: 'Montserrat,sans-serif',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.sub, letterSpacing: 1.5, textTransform: 'uppercase' }}>Rest Timer</span>
          <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: C.sub, padding: 0, lineHeight: 1 }}>✕</button>
        </div>

        {/* Circular progress + time */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
          <div style={{ position: 'relative', width: 100, height: 100 }}>
            <svg width="100" height="100" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="50" cy="50" r="44" fill="none" stroke={C.faint} strokeWidth="6" />
              <circle
                cx="50" cy="50" r="44" fill="none"
                stroke={done ? C.green : C.accent}
                strokeWidth="6" strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 44}
                strokeDashoffset={2 * Math.PI * 44 * (1 - progress)}
                style={{ transition: 'stroke-dashoffset 0.3s linear' }}
              />
            </svg>
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{
                fontSize: 26, fontWeight: 800, color: done ? C.green : C.text,
                fontVariantNumeric: 'tabular-nums', letterSpacing: 1,
                animation: done ? 'timerPulse 1s ease-in-out infinite' : 'none',
              }}>
                {mm}:{ss}
              </span>
              {done && <span style={{ fontSize: 9, fontWeight: 700, color: C.green, marginTop: 2 }}>DONE</span>}
            </div>
          </div>
        </div>

        {/* Presets */}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
          {presets.map(p => (
            <button
              key={p.secs}
              onClick={() => start(p.secs)}
              style={{
                padding: '5px 10px', borderRadius: 6,
                border: `1.5px solid ${totalSeconds === p.secs && (running || seconds > 0) ? C.accent : C.border}`,
                background: totalSeconds === p.secs && (running || seconds > 0) ? C.accent + '18' : C.faint,
                color: C.text, fontFamily: 'Montserrat,sans-serif',
                fontWeight: 700, fontSize: 11, cursor: 'pointer',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          {running ? (
            <button onClick={pause} style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: `1.5px solid ${C.orange}`, background: C.orange + '18', color: C.orange, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
              Pause
            </button>
          ) : seconds > 0 ? (
            <button onClick={resume} style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: `1.5px solid ${C.accent}`, background: C.accent + '18', color: C.accent, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
              Resume
            </button>
          ) : null}
          {(seconds > 0 || done) && (
            <button onClick={reset} style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: `1.5px solid ${C.border}`, background: C.faint, color: C.sub, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
              Reset
            </button>
          )}
        </div>
      </div>
    </>
  )
}

// ── ASSESSMENT FORM ───────────────────────────────────────────────────────────
function AssessmentForm({ assessment, client, onComplete, onBack, forceNew = false }) {
  const [answers, setAnswers] = useState({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [hasUnsaved, setHasUnsaved] = useState(false)

  useEffect(() => {
    if (!forceNew && client.assessments?.[assessment.id]) {
      setAnswers(client.assessments[assessment.id])
      setSaved(true)
    }
  }, [assessment.id, client.assessments, forceNew])

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
      await saveAssessment(client.id, assessment.id, answers, '', forceNew)
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

// ── PDF VIEWER (renders all pages for iPad compatibility) ────────────────────
function PdfViewer({ dataUrl, name }) {
  const containerRef = useRef(null)
  const [pages, setPages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setPages([])

    const loadPdf = async () => {
      try {
        // Load pdf.js from CDN
        if (!window.pdfjsLib) {
          await new Promise((resolve, reject) => {
            const s = document.createElement('script')
            s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
            s.onload = resolve
            s.onerror = () => reject(new Error('Failed to load PDF viewer'))
            document.head.appendChild(s)
          })
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
        }

        const pdf = await window.pdfjsLib.getDocument(dataUrl).promise
        if (cancelled) return

        const rendered = []
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i)
          const scale = containerRef.current ? (containerRef.current.clientWidth / page.getViewport({ scale: 1 }).width) : 1.5
          const viewport = page.getViewport({ scale })
          const canvas = document.createElement('canvas')
          canvas.width = viewport.width
          canvas.height = viewport.height
          await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
          rendered.push(canvas.toDataURL())
          if (cancelled) return
        }
        setPages(rendered)
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadPdf()
    return () => { cancelled = true }
  }, [dataUrl])

  if (error) return (
    <div style={{ padding: 16, textAlign: 'center' }}>
      <div style={{ fontSize: 12, color: C.red, marginBottom: 8 }}>Could not render PDF</div>
      <a href={dataUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: C.accent, fontWeight: 700, textDecoration: 'none' }}>Open PDF in new tab</a>
    </div>
  )

  return (
    <div ref={containerRef}>
      {loading && <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: C.sub }}>Loading PDF...</div>}
      <div style={{ maxHeight: 600, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {pages.map((src, i) => (
          <img key={i} src={src} alt={`${name} page ${i + 1}`} style={{ width: '100%', display: 'block', borderBottom: i < pages.length - 1 ? `2px solid ${C.border}` : 'none' }} />
        ))}
      </div>
      {pages.length > 0 && (
        <div style={{ padding: '6px 12px', textAlign: 'center', background: C.faint, fontSize: 10, color: C.sub }}>
          {pages.length} page{pages.length !== 1 ? 's' : ''} — <a href={dataUrl} target="_blank" rel="noopener noreferrer" style={{ color: C.accent, fontWeight: 700, textDecoration: 'none' }}>Open in new tab</a>
        </div>
      )}
    </div>
  )
}

// ── PROGRAM JOURNAL ──────────────────────────────────────────────────────────
const PHASES = [
  { id: 'p1', name: 'Phase 1 — The Base', sub: 'Building movement patterns and capacity', color: C.teal },
  { id: 'p2', name: 'Phase 2 — The Forge', sub: 'Developing raw strength', color: C.accent },
  { id: 'p3', name: 'Phase 3 — The Engine', sub: 'VO2 and work capacity', color: C.indigo },
  { id: 'p4', name: 'Phase 4 — The Peak', sub: 'Max strength and PRs', color: C.orange },
]
const YEARS = [1, 2, 3, 4, 5]
// Default week order — deloads can be inserted between any weeks
const DEFAULT_WEEK_ORDER = ['Week 1','Week 2','Week 3','Week 4','Week 5','Week 6','Week 7','Week 8','Week 9','Week 10','Week 11','Week 12','Deload']

const emptyExercise = () => ({ id: makeId(), exercise: '', sets: '', setsType: 'sets', reps: '', repsType: 'reps', weight: '', tempo: '', rpe: '', notes: '', circuit: '', setLogs: [] })
const emptyDay = (num) => ({ id: makeId(), dayNum: num, exercises: [emptyExercise()], dayNotes: '', date: '' })

function ProgramUploads({ client, onUpdate }) {
  const parseNotes = () => { try { return JSON.parse(client.trainerNotes || '{}') } catch { return {} } }
  const stored = parseNotes()

  // program_journal: { "y1_p1_Week 1": { days: [...] }, ... }
  const [journal, setJournal] = useState(stored.program_journal || {})
  const posKey = `ff_journal_pos_${client.id}`
  const savedPos = (() => { try { return JSON.parse(localStorage.getItem(posKey) || 'null') } catch { return null } })()
  const [selYear, setSelYear] = useState(savedPos?.year || 1)
  const [selPhase, setSelPhase] = useState(savedPos?.phase || 'p1')
  const [selWeek, setSelWeek] = useState(savedPos?.week || 'Week 1')
  // Week order per phase — allows custom deload placement
  const weekOrderKey = `y${selYear}_${selPhase}_weekorder`
  const weekOrder = journal[weekOrderKey] || DEFAULT_WEEK_ORDER
  const [saving, setSaving] = useState(false)
  const [autoSaving, setAutoSaving] = useState(false)
  const autoSaveTimer = useRef(null)
  const [programFile, setProgramFile] = useState(stored.program_file || null)
  const [showProgram, setShowProgram] = useState(false)

  const journalKey = `y${selYear}_${selPhase}_${selWeek}`
  const weekData = journal[journalKey] || { days: [emptyDay(1), emptyDay(2)] }
  const phaseNotesKey = `y${selYear}_${selPhase}_phaseNotes`
  const phaseNotes = journal[phaseNotesKey] || ''

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

  const [unsavedDays, setUnsavedDays] = useState(new Set())
  const [savedDays, setSavedDays] = useState(new Set())
  const [collapsedNotes, setCollapsedNotes] = useState(new Set())
  const [collapsedDays, setCollapsedDays] = useState(new Set())
  const [expandedSetLogs, setExpandedSetLogs] = useState(new Set())
  const [weekNotesUnsaved, setWeekNotesUnsaved] = useState(false)
  const [weekNotesSaved, setWeekNotesSaved] = useState(false)
  const [phaseNotesUnsaved, setPhaseNotesUnsaved] = useState(false)
  const [phaseNotesSaved, setPhaseNotesSaved] = useState(false)
  const journalRef = useRef(journal)

  useEffect(() => {
    setWeekNotesUnsaved(false)
    setWeekNotesSaved(false)
  }, [journalKey])

  useEffect(() => {
    setPhaseNotesUnsaved(false)
    setPhaseNotesSaved(false)
  }, [phaseNotesKey])

  useEffect(() => { journalRef.current = journal }, [journal])

  // Persist last-viewed position
  useEffect(() => {
    try { localStorage.setItem(posKey, JSON.stringify({ year: selYear, phase: selPhase, week: selWeek })) } catch {}
  }, [selYear, selPhase, selWeek])

  const triggerAutoSave = () => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    setAutoSaving(true)
    autoSaveTimer.current = setTimeout(async () => {
      try { await persist({ program_journal: journalRef.current }) } catch {}
      setAutoSaving(false)
    }, 1500)
  }

  // Update locally and schedule autosave
  const updateWeekDataLocal = (newDays, changedDayIdx) => {
    const updated = { ...journal, [journalKey]: { ...weekData, days: newDays } }
    setJournal(updated)
    if (changedDayIdx !== undefined) {
      setUnsavedDays(prev => new Set(prev).add(changedDayIdx))
      setSavedDays(prev => { const n = new Set(prev); n.delete(changedDayIdx); return n })
    }
    triggerAutoSave()
  }

  // Persist entire week to database
  const updateWeekData = (newDays) => {
    const updated = { ...journal, [journalKey]: { ...weekData, days: newDays } }
    setJournal(updated)
    persist({ program_journal: updated })
  }

  // Save a specific day (persists the whole week since that's the storage unit)
  const saveDay = (dayIdx) => {
    const updated = { ...journal, [journalKey]: weekData }
    persist({ program_journal: updated })
    setUnsavedDays(prev => { const n = new Set(prev); n.delete(dayIdx); return n })
    setSavedDays(prev => new Set(prev).add(dayIdx))
    setTimeout(() => setSavedDays(prev => { const n = new Set(prev); n.delete(dayIdx); return n }), 2000)
  }

  const updateExercise = (dayIdx, exIdx, field, value) => {
    const days = weekData.days.map((d, di) => {
      if (di !== dayIdx) return d
      const exercises = d.exercises.map((ex, ei) => ei === exIdx ? { ...ex, [field]: value } : ex)
      return { ...d, exercises }
    })
    updateWeekDataLocal(days, dayIdx)
  }

  const addExercise = (dayIdx) => {
    const days = weekData.days.map((d, di) => di === dayIdx ? { ...d, exercises: [...d.exercises, emptyExercise()] } : d)
    updateWeekDataLocal(days, dayIdx)
  }

  const removeExercise = (dayIdx, exIdx) => {
    const days = weekData.days.map((d, di) => {
      if (di !== dayIdx) return d
      if (d.exercises.length <= 1) return d
      return { ...d, exercises: d.exercises.filter((_, ei) => ei !== exIdx) }
    })
    updateWeekDataLocal(days, dayIdx)
  }

  const duplicateExercise = (dayIdx, exIdx) => {
    const days = weekData.days.map((d, di) => {
      if (di !== dayIdx) return d
      const exercises = d.exercises.map((ex, ei) => {
        if (ei !== exIdx) return ex
        const currentSets = parseInt(ex.sets) || 1
        const newSets = currentSets + 1
        const setLogs = [...(ex.setLogs || [])]
        while (setLogs.length < newSets) setLogs.push({ rpe: '', notes: '' })
        return { ...ex, sets: String(newSets), setLogs }
      })
      return { ...d, exercises }
    })
    updateWeekDataLocal(days, dayIdx)
  }

  const toggleCollapsedNotes = (dayIdx) => {
    setCollapsedNotes(prev => {
      const n = new Set(prev)
      n.has(dayIdx) ? n.delete(dayIdx) : n.add(dayIdx)
      return n
    })
  }

  const toggleCollapsedDay = (dayIdx) => {
    setCollapsedDays(prev => {
      const n = new Set(prev)
      n.has(dayIdx) ? n.delete(dayIdx) : n.add(dayIdx)
      return n
    })
  }

  const toggleSetLogs = (dayIdx, exIdx) => {
    const key = `${dayIdx}-${exIdx}`
    setExpandedSetLogs(prev => {
      const n = new Set(prev)
      n.has(key) ? n.delete(key) : n.add(key)
      return n
    })
  }

  const updateSetLog = (dayIdx, exIdx, setIdx, field, value) => {
    const days = weekData.days.map((d, di) => {
      if (di !== dayIdx) return d
      const exercises = d.exercises.map((ex, ei) => {
        if (ei !== exIdx) return ex
        const setLogs = [...(ex.setLogs || [])]
        setLogs[setIdx] = { ...(setLogs[setIdx] || {}), [field]: value }
        return { ...ex, setLogs }
      })
      return { ...d, exercises }
    })
    updateWeekDataLocal(days, dayIdx)
  }

  const updateDayNotes = (dayIdx, value) => {
    const days = weekData.days.map((d, di) => di === dayIdx ? { ...d, dayNotes: value } : d)
    updateWeekDataLocal(days, dayIdx)
  }

  const updateWeekNotesLocal = (value) => {
    const updatedWeek = { ...weekData, weekNotes: value }
    const updated = { ...journal, [journalKey]: updatedWeek }
    setJournal(updated)
    setWeekNotesUnsaved(true)
    setWeekNotesSaved(false)
    triggerAutoSave()
  }

  const saveWeekNotes = () => {
    persist({ program_journal: journalRef.current })
    setWeekNotesUnsaved(false)
    setWeekNotesSaved(true)
    setTimeout(() => setWeekNotesSaved(false), 2000)
  }

  const updatePhaseNotesLocal = (value) => {
    const updated = { ...journal, [phaseNotesKey]: value }
    setJournal(updated)
    setPhaseNotesUnsaved(true)
    setPhaseNotesSaved(false)
    triggerAutoSave()
  }

  const savePhaseNotes = () => {
    persist({ program_journal: journalRef.current })
    setPhaseNotesUnsaved(false)
    setPhaseNotesSaved(true)
    setTimeout(() => setPhaseNotesSaved(false), 2000)
  }

  const addDay = () => {
    const nextNum = weekData.days.length + 1
    updateWeekData([...weekData.days, emptyDay(nextNum)])
  }

  const removeDay = (dayIdx) => {
    if (weekData.days.length <= 1) return
    if (!confirm(`Remove Day ${dayIdx + 1}?`)) return
    const days = weekData.days.filter((_, i) => i !== dayIdx).map((d, i) => ({ ...d, dayNum: i + 1 }))
    updateWeekData(days)
    setUnsavedDays(new Set())
  }

  const handleUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { alert('File too large — max 2 MB.'); return }
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

  // Check if a week has data
  const weekHasData = (yr, ph, wk) => {
    const k = `y${yr}_${ph}_${wk}`
    const d = journal[k]
    if (!d) return false
    return d.days.some(day => day.exercises.some(ex => ex.exercise.trim()) || day.dayNotes.trim())
  }

  // Update date on a day
  const updateDayDate = (dayIdx, value) => {
    const days = weekData.days.map((d, di) => di === dayIdx ? { ...d, date: value } : d)
    updateWeekDataLocal(days, dayIdx)
  }

  // Toggle circuit label on an exercise
  const toggleCircuit = (dayIdx, exIdx) => {
    const day = weekData.days[dayIdx]
    const ex = day.exercises[exIdx]
    // Cycle: '' -> 'A' -> 'B' -> 'C' -> ''
    const labels = ['', 'A', 'B', 'C', 'D']
    const nextIdx = (labels.indexOf(ex.circuit || '') + 1) % labels.length
    updateExercise(dayIdx, exIdx, 'circuit', labels[nextIdx])
  }

  const currentPhase = PHASES.find(p => p.id === selPhase)
  const [copied, setCopied] = useState('')
  const [showCopyModal, setShowCopyModal] = useState(false)
  const [copySelYears, setCopySelYears] = useState([])
  const [copySelPhases, setCopySelPhases] = useState([])
  const [copySelWeeks, setCopySelWeeks] = useState([])
  const [editingWeekIdx, setEditingWeekIdx] = useState(-1)
  const [editingWeekName, setEditingWeekName] = useState('')

  // Rename a week in the order
  const renameWeek = (idx, newName) => {
    if (!newName.trim()) return
    const oldName = weekOrder[idx]
    const newOrder = weekOrder.map((w, i) => i === idx ? newName.trim() : w)
    // Update journal: rename old key to new key
    const updated = { ...journal }
    const oldKey = `y${selYear}_${selPhase}_${oldName}`
    const newKey = `y${selYear}_${selPhase}_${newName.trim()}`
    if (updated[oldKey] && oldName !== newName.trim()) {
      updated[newKey] = updated[oldKey]
      delete updated[oldKey]
    }
    updated[weekOrderKey] = newOrder
    setJournal(updated)
    if (selWeek === oldName) setSelWeek(newName.trim())
    persist({ program_journal: updated })
    setEditingWeekIdx(-1)
  }

  // Format a single week's data as text
  const formatWeekText = (yr, ph, wk) => {
    const k = `y${yr}_${ph}_${wk}`
    const d = journal[k]
    if (!d) return ''
    const phaseName = PHASES.find(p => p.id === ph)?.name || ph
    let lines = [`=== Year ${yr} | ${phaseName} | ${wk} ===\n`]
    d.days.forEach((day, i) => {
      lines.push(`--- Day ${i + 1}${day.date ? ` (${new Date(day.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })})` : ''} ---`)
      day.exercises.forEach(ex => {
        if (!ex.exercise.trim()) return
        const parts = [ex.circuit ? `[Circuit ${ex.circuit}]` : '', ex.exercise]
        if (ex.sets) parts.push(`${ex.sets} ${ex.setsType === 'rounds' ? 'rounds' : 'sets'}`)
        if (ex.reps) parts.push(`x ${ex.reps} ${ex.repsType === 'time' ? 'sec' : 'reps'}`)
        if (ex.tempo) parts.push(`@ ${ex.tempo}`)
        if (ex.rpe) parts.push(`RPE ${ex.rpe}`)
        if (ex.notes) parts.push(`— ${ex.notes}`)
        lines.push(parts.filter(Boolean).join(' '))
      })
      if (day.dayNotes?.trim()) lines.push(`Notes: ${day.dayNotes.trim()}`)
      lines.push('')
    })
    return lines.join('\n')
  }

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label)
      setTimeout(() => setCopied(''), 2000)
    })
  }

  // Copy selected combination
  const copySelected = () => {
    const years = copySelYears.length ? copySelYears : [selYear]
    const phases = copySelPhases.length ? copySelPhases : [selPhase]
    const texts = years.flatMap(yr =>
      phases.flatMap(ph => {
        const order = journal[`y${yr}_${ph}_weekorder`] || DEFAULT_WEEK_ORDER
        const weeks = copySelWeeks.length ? order.filter(w => copySelWeeks.includes(w)) : order
        return weeks.map(wk => formatWeekText(yr, ph, wk))
      })
    ).filter(t => t.trim())
    if (texts.length === 0) { alert('No data found for the selected combination.'); return }
    copyToClipboard(texts.join('\n'), 'custom')
    setShowCopyModal(false)
  }

  // Toggle helpers for multi-select
  const toggleCopyYear = (y) => setCopySelYears(prev => prev.includes(y) ? prev.filter(v => v !== y) : [...prev, y])
  const toggleCopyPhase = (p) => setCopySelPhases(prev => prev.includes(p) ? prev.filter(v => v !== p) : [...prev, p])
  const toggleCopyWeek = (w) => setCopySelWeeks(prev => prev.includes(w) ? prev.filter(v => v !== w) : [...prev, w])

  const selectStyle = { padding: '7px 12px', borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 12, fontWeight: 700, fontFamily: 'Montserrat,sans-serif', color: C.text, background: '#fff', cursor: 'pointer', outline: 'none' }
  const inputCell = { padding: '6px 8px', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 12, fontFamily: 'Montserrat,sans-serif', color: C.text, outline: 'none', background: '#fff', boxSizing: 'border-box', width: '100%', minWidth: 0 }
  const copyBtnStyle = (active) => ({ padding: '5px 12px', borderRadius: 7, border: `1.5px solid ${active ? C.accent : C.border}`, background: active ? C.accent + '15' : 'transparent', color: active ? C.accent : C.sub, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif', letterSpacing: 0.5 })
  const chipStyle = (active) => ({ padding: '4px 10px', borderRadius: 6, border: `1.5px solid ${active ? C.accent : C.border}`, background: active ? C.accent + '15' : '#fff', color: active ? C.accent : C.sub, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif' })

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '20px 24px', marginBottom: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, color: C.sub, textTransform: 'uppercase' }}>Program Journal</div>
          {saving && <span style={{ fontSize: 10, color: C.accent }}>Saving...</span>}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {programFile && (
            <button onClick={() => setShowProgram(!showProgram)} style={{ padding: '5px 12px', borderRadius: 7, border: `1.5px solid ${showProgram ? C.accent : C.border}`, background: showProgram ? C.accent + '12' : 'transparent', color: showProgram ? C.accent : C.sub, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif' }}>
              {showProgram ? 'Hide Program' : 'View Program'}
            </button>
          )}
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 7, border: `1.5px solid ${C.border}`, background: 'transparent', color: C.sub, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif' }}>
            {programFile ? 'Replace' : 'Upload'} Program
            <input type="file" accept="image/*,.pdf" onChange={handleUpload} style={{ display: 'none' }} />
          </label>
        </div>
      </div>

      {/* Program viewer */}
      {showProgram && programFile && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
            {programFile.data?.startsWith('data:image') && (
              <img src={programFile.data} alt={programFile.name} style={{ width: '100%', maxHeight: 500, objectFit: 'contain', display: 'block' }} />
            )}
            {programFile.data?.startsWith('data:application/pdf') && (
              <PdfViewer dataUrl={programFile.data} name={programFile.name} />
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
            <div style={{ fontSize: 10, color: C.sub }}>{programFile.name}</div>
            <button onClick={removeProgram} style={{ padding: '3px 10px', borderRadius: 6, border: `1px solid ${C.red}44`, background: 'transparent', color: C.red, fontSize: 9, fontWeight: 700, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif' }}>Remove</button>
          </div>
        </div>
      )}

      {/* Year / Phase / Week dropdowns */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
        <select value={selYear} onChange={e => setSelYear(Number(e.target.value))} style={selectStyle}>
          {YEARS.map(y => <option key={y} value={y}>Year {y}</option>)}
        </select>
        <select value={selPhase} onChange={e => setSelPhase(e.target.value)} style={{ ...selectStyle, borderColor: currentPhase.color, color: currentPhase.color }}>
          {PHASES.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={selWeek} onChange={e => setSelWeek(e.target.value)} style={{ ...selectStyle, ...(selWeek.startsWith('Deload') ? { borderColor: C.orange, color: C.orange } : {}) }}>
          {weekOrder.map(w => (
            <option key={w} value={w}>{w}{weekHasData(selYear, selPhase, w) ? ' ✓' : ''}</option>
          ))}
        </select>
      </div>

      {/* Copy & week tools */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        <button onClick={() => { setCopySelYears([]); setCopySelPhases([]); setCopySelWeeks([]); setShowCopyModal(!showCopyModal) }} style={copyBtnStyle(showCopyModal)}>
          {copied === 'custom' ? '✓ Copied!' : 'Copy & Export'}
        </button>
        <button onClick={() => { if (editingWeekIdx >= 0) { setEditingWeekIdx(-1) } else { setEditingWeekIdx(weekOrder.indexOf(selWeek)); setEditingWeekName(selWeek) } }} style={copyBtnStyle(editingWeekIdx >= 0)}>
          {editingWeekIdx >= 0 ? 'Cancel Rename' : 'Rename Week'}
        </button>
      </div>

      {/* Rename week inline */}
      {editingWeekIdx >= 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: C.sub }}>Rename:</span>
          <input value={editingWeekName} onChange={e => setEditingWeekName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') renameWeek(editingWeekIdx, editingWeekName) }} style={{ ...inputCell, flex: 1, maxWidth: 200 }} autoFocus />
          <button onClick={() => renameWeek(editingWeekIdx, editingWeekName)} style={{ padding: '5px 14px', borderRadius: 7, border: 'none', background: C.accent, color: '#000', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif' }}>Save</button>
        </div>
      )}

      {/* Copy modal */}
      {showCopyModal && (
        <div style={{ background: '#fff', border: `1.5px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.text, marginBottom: 10, letterSpacing: 1 }}>SELECT WHAT TO COPY</div>
          {/* Years */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: C.sub, marginBottom: 6, letterSpacing: 1 }}>YEARS <span style={{ fontWeight: 500, letterSpacing: 0 }}>(none = current year)</span></div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {YEARS.map(y => <button key={y} onClick={() => toggleCopyYear(y)} style={chipStyle(copySelYears.includes(y))}>Year {y}</button>)}
            </div>
          </div>
          {/* Phases */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: C.sub, marginBottom: 6, letterSpacing: 1 }}>PHASES <span style={{ fontWeight: 500, letterSpacing: 0 }}>(none = current phase)</span></div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {PHASES.map(p => <button key={p.id} onClick={() => toggleCopyPhase(p.id)} style={chipStyle(copySelPhases.includes(p.id))}>{p.name.split('—')[0].trim()}</button>)}
            </div>
          </div>
          {/* Weeks */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: C.sub, marginBottom: 6, letterSpacing: 1 }}>WEEKS <span style={{ fontWeight: 500, letterSpacing: 0 }}>(none = all weeks)</span></div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {weekOrder.map(w => <button key={w} onClick={() => toggleCopyWeek(w)} style={chipStyle(copySelWeeks.includes(w))}>{w}</button>)}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={copySelected} style={{ padding: '7px 20px', borderRadius: 8, border: 'none', background: C.accent, color: '#000', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif' }}>Copy to Clipboard</button>
            <button onClick={() => setShowCopyModal(false)} style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent', color: C.sub, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif' }}>Close</button>
          </div>
        </div>
      )}

      {/* Phase subtitle */}
      <div style={{ fontSize: 11, color: currentPhase.color, fontWeight: 700, marginBottom: 14, padding: '6px 12px', background: currentPhase.color + '10', borderRadius: 8, borderLeft: `3px solid ${currentPhase.color}` }}>
        {currentPhase.sub}
      </div>

      {/* Deload banner */}
      {selWeek.startsWith('Deload') && (
        <div style={{ fontSize: 12, fontWeight: 800, color: C.orange, textAlign: 'center', padding: '8px 12px', background: C.orange + '10', borderRadius: 8, border: `1.5px solid ${C.orange}33`, marginBottom: 14, letterSpacing: 1 }}>
          DELOAD WEEK — Reduced volume &amp; intensity
        </div>
      )}

      {/* Main Notes — phase-level, persists across all weeks */}
      <div style={{ marginBottom: 12, padding: '12px 14px', background: C.faint, border: `1px solid ${C.border}`, borderRadius: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 9, fontWeight: 800, color: C.sub, letterSpacing: 1, textTransform: 'uppercase' }}>Notes</span>
          <button
            onClick={savePhaseNotes}
            disabled={saving || (!phaseNotesUnsaved && !phaseNotesSaved)}
            style={{ marginLeft: 'auto', padding: '4px 14px', borderRadius: 7, border: 'none', background: phaseNotesSaved ? C.green : phaseNotesUnsaved ? C.accent : C.border, color: phaseNotesSaved ? '#fff' : phaseNotesUnsaved ? '#000' : C.sub, fontSize: 10, fontWeight: 700, cursor: phaseNotesUnsaved ? 'pointer' : 'default', fontFamily: 'Montserrat,sans-serif', letterSpacing: 0.5, transition: 'all .2s' }}
          >
            {saving ? 'Saving...' : phaseNotesSaved ? '✓ Saved!' : phaseNotesUnsaved ? 'Save Notes' : 'Saved'}
          </button>
        </div>
        <textarea
          value={phaseNotes}
          onChange={e => updatePhaseNotesLocal(e.target.value)}
          rows={4}
          placeholder="Add notes from an outside source, program details, or general phase notes..."
          style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 12, fontFamily: 'Montserrat,sans-serif', color: C.text, background: '#fff', resize: 'vertical', outline: 'none', boxSizing: 'border-box', lineHeight: 1.5 }}
        />
      </div>

      {/* Week Notes — for pasting notes from an outside source */}
      <div style={{ marginBottom: 16, padding: '12px 14px', background: C.faint, border: `1px solid ${C.border}`, borderRadius: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 9, fontWeight: 800, color: C.sub, letterSpacing: 1, textTransform: 'uppercase' }}>Week Notes</span>
          <span style={{ fontSize: 10, color: C.sub, fontStyle: 'italic' }}>/ Outside Source</span>
          <button
            onClick={saveWeekNotes}
            disabled={saving || (!weekNotesUnsaved && !weekNotesSaved)}
            style={{ marginLeft: 'auto', padding: '4px 14px', borderRadius: 7, border: 'none', background: weekNotesSaved ? C.green : weekNotesUnsaved ? C.accent : C.border, color: weekNotesSaved ? '#fff' : weekNotesUnsaved ? '#000' : C.sub, fontSize: 10, fontWeight: 700, cursor: weekNotesUnsaved ? 'pointer' : 'default', fontFamily: 'Montserrat,sans-serif', letterSpacing: 0.5, transition: 'all .2s' }}
          >
            {saving ? 'Saving...' : weekNotesSaved ? '✓ Saved!' : weekNotesUnsaved ? 'Save Notes' : 'Saved'}
          </button>
        </div>
        <textarea
          value={weekData.weekNotes || ''}
          onChange={e => updateWeekNotesLocal(e.target.value)}
          rows={3}
          placeholder="Paste notes from an outside source, coach's program, or external reference..."
          style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 12, fontFamily: 'Montserrat,sans-serif', color: C.text, background: '#fff', resize: 'vertical', outline: 'none', boxSizing: 'border-box', lineHeight: 1.5 }}
        />
      </div>

      {/* Days */}
      {weekData.days.map((day, dayIdx) => (
        <div key={day.id || dayIdx} style={{ border: `1.5px solid ${C.border}`, borderRadius: 12, padding: '14px 16px', marginBottom: 14, background: C.faint }}>
          {/* Day header with date */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: collapsedDays.has(dayIdx) ? 0 : 10, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={() => toggleCollapsedDay(dayIdx)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10, color: C.sub, fontWeight: 700, transition: 'transform .2s', display: 'inline-block', transform: collapsedDays.has(dayIdx) ? 'rotate(-90deg)' : 'rotate(0deg)' }}>▼</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: currentPhase.color, letterSpacing: 1 }}>DAY {dayIdx + 1}</span>
              </button>
              <input
                type="date"
                value={day.date || ''}
                onChange={e => updateDayDate(dayIdx, e.target.value)}
                style={{ padding: '3px 8px', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 11, fontFamily: 'Montserrat,sans-serif', color: day.date ? C.text : C.sub, background: '#fff', outline: 'none' }}
              />
              {day.date && (
                <span style={{ fontSize: 10, color: C.sub, fontWeight: 600 }}>
                  {new Date(day.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              )}
              {collapsedDays.has(dayIdx) && (
                <span style={{ fontSize: 10, color: C.sub, fontWeight: 600, fontStyle: 'italic' }}>
                  {day.exercises.filter(e => e.exercise).length} exercise{day.exercises.filter(e => e.exercise).length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            {weekData.days.length > 1 && (
              <button onClick={() => removeDay(dayIdx)} style={{ background: 'none', border: 'none', color: C.red + '88', fontSize: 11, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif', fontWeight: 700 }}>Remove Day</button>
            )}
          </div>

          {!collapsedDays.has(dayIdx) && <>
          <div style={{ overflowX: 'auto' }}>
          {/* Exercise header row */}
          <div style={{ display: 'grid', gridTemplateColumns: '22px 32px 1fr 50px 50px 56px 70px 50px 1fr 28px 28px', gap: 4, marginBottom: 4, alignItems: 'center', minWidth: 580 }}>
            <div style={{ fontSize: 8, fontWeight: 800, color: C.sub, letterSpacing: 0.5, textTransform: 'uppercase', textAlign: 'center' }}>#</div>
            <div style={{ fontSize: 8, fontWeight: 800, color: C.sub, letterSpacing: 0.5, textTransform: 'uppercase', textAlign: 'center' }}>CIR</div>
            <div style={{ fontSize: 8, fontWeight: 800, color: C.sub, letterSpacing: 0.5, textTransform: 'uppercase', paddingLeft: 4 }}>Exercise</div>
            <div style={{ fontSize: 8, fontWeight: 800, color: C.sub, letterSpacing: 0.5, textTransform: 'uppercase', textAlign: 'center' }}>Sets</div>
            <div style={{ fontSize: 8, fontWeight: 800, color: C.sub, letterSpacing: 0.5, textTransform: 'uppercase', textAlign: 'center' }}>Reps</div>
            <div style={{ fontSize: 8, fontWeight: 800, color: C.sub, letterSpacing: 0.5, textTransform: 'uppercase', textAlign: 'center' }}>Weight</div>
            <div style={{ fontSize: 8, fontWeight: 800, color: C.sub, letterSpacing: 0.5, textTransform: 'uppercase', textAlign: 'center' }}>Tempo</div>
            <div style={{ fontSize: 8, fontWeight: 800, color: C.sub, letterSpacing: 0.5, textTransform: 'uppercase', textAlign: 'center' }}>RPE</div>
            <div style={{ fontSize: 8, fontWeight: 800, color: C.sub, letterSpacing: 0.5, textTransform: 'uppercase', paddingLeft: 4 }}>Notes</div>
            <div />
            <div />
          </div>

          {/* Exercise rows */}
          {day.exercises.map((ex, exIdx) => {
            const circuitColor = ex.circuit === 'A' ? C.accent : ex.circuit === 'B' ? C.indigo : ex.circuit === 'C' ? C.green : ex.circuit === 'D' ? C.orange : null
            const sameCircuitAbove = exIdx > 0 && day.exercises[exIdx - 1].circuit && day.exercises[exIdx - 1].circuit === ex.circuit
            const sameCircuitBelow = exIdx < day.exercises.length - 1 && day.exercises[exIdx + 1]?.circuit && day.exercises[exIdx + 1].circuit === ex.circuit
            const showCircuitBar = !!ex.circuit && (sameCircuitAbove || sameCircuitBelow)
            const setLogKey = `${dayIdx}-${exIdx}`
            const setsNum = parseInt(ex.sets) || 0
            const hasSetLogs = ex.setLogs && ex.setLogs.some(s => s && (s.rpe || s.notes))
            return (
              <div key={ex.id || exIdx} style={{ marginBottom: 4, ...(showCircuitBar ? { boxShadow: `inset 3px 0 0 ${circuitColor}` } : {}) }}>
                <div style={{ display: 'grid', gridTemplateColumns: '22px 32px 1fr 50px 50px 56px 70px 50px 1fr 28px 28px', gap: 4, alignItems: 'center', minWidth: 580 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: C.sub, textAlign: 'center', padding: '7px 0', lineHeight: 1 }}>{exIdx + 1}</div>
                <button onClick={() => toggleCircuit(dayIdx, exIdx)} style={{ background: ex.circuit ? (circuitColor + '20') : 'transparent', border: `1.5px solid ${ex.circuit ? circuitColor : C.border}`, borderRadius: 6, fontSize: 10, fontWeight: 800, color: ex.circuit ? circuitColor : C.sub, cursor: 'pointer', padding: '4px 0', fontFamily: 'Montserrat,sans-serif', lineHeight: 1 }} title="Toggle circuit group (A/B/C/D)">
                  {ex.circuit || '—'}
                </button>
                <input value={ex.exercise} onChange={e => updateExercise(dayIdx, exIdx, 'exercise', e.target.value)} placeholder="e.g. Back Squat" style={inputCell} />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                  <input value={ex.sets} onChange={e => updateExercise(dayIdx, exIdx, 'sets', e.target.value)} placeholder="3" style={{ ...inputCell, textAlign: 'center', cursor: setsNum >= 2 ? 'pointer' : undefined, ...(setsNum >= 2 ? { borderColor: expandedSetLogs.has(setLogKey) ? C.accent : hasSetLogs ? C.accent + '66' : C.border } : {}) }} onClick={() => { if (setsNum >= 2) toggleSetLogs(dayIdx, exIdx) }} readOnly={setsNum >= 2} title={setsNum >= 2 ? 'Click to view per-set RPE & Notes' : ''} />
                  <span onClick={() => updateExercise(dayIdx, exIdx, 'setsType', ex.setsType === 'rounds' ? 'sets' : 'rounds')} style={{ fontSize: 7, fontWeight: 700, color: ex.setsType === 'rounds' ? C.accent : C.sub, cursor: 'pointer', letterSpacing: 0.3, textTransform: 'uppercase', userSelect: 'none', lineHeight: 1 }} title="Click to toggle sets/rounds">{ex.setsType === 'rounds' ? 'rounds' : 'sets'}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                  <input value={ex.reps} onChange={e => updateExercise(dayIdx, exIdx, 'reps', e.target.value)} placeholder="10" style={{ ...inputCell, textAlign: 'center' }} />
                  <span onClick={() => updateExercise(dayIdx, exIdx, 'repsType', ex.repsType === 'time' ? 'reps' : 'time')} style={{ fontSize: 7, fontWeight: 700, color: ex.repsType === 'time' ? C.accent : C.sub, cursor: 'pointer', letterSpacing: 0.3, textTransform: 'uppercase', userSelect: 'none', lineHeight: 1 }} title="Click to toggle reps/seconds">{ex.repsType === 'time' ? 'sec' : 'reps'}</span>
                </div>
                {/* Weight — hide in main row when per-set breakdown is open */}
                {expandedSetLogs.has(setLogKey) && setsNum >= 2 ? (
                  <div style={{ textAlign: 'center', fontSize: 8, color: C.sub, fontWeight: 700, letterSpacing: 0.3 }}>per set ↓</div>
                ) : (
                  <input value={ex.weight || ''} onChange={e => updateExercise(dayIdx, exIdx, 'weight', e.target.value)} placeholder="lbs" style={{ ...inputCell, textAlign: 'center' }} />
                )}
                {/* Tempo — hide in main row when per-set breakdown is open */}
                {expandedSetLogs.has(setLogKey) && setsNum >= 2 ? (
                  <div style={{ textAlign: 'center', fontSize: 8, color: C.sub, fontWeight: 700, letterSpacing: 0.3 }}>per set ↓</div>
                ) : (
                  <input value={ex.tempo || ''} onChange={e => { const digits = e.target.value.replace(/[^0-9]/g, '').slice(0, 4); const formatted = digits.split('').join('-'); updateExercise(dayIdx, exIdx, 'tempo', formatted); }} placeholder="3-1-2-0" style={{ ...inputCell, textAlign: 'center' }} maxLength={7} />
                )}
                {/* RPE — hide in main row when per-set breakdown is open */}
                {expandedSetLogs.has(setLogKey) && setsNum >= 2 ? (
                  <div style={{ textAlign: 'center', fontSize: 8, color: C.sub, fontWeight: 700, letterSpacing: 0.3 }}>↓</div>
                ) : (
                  <select value={ex.rpe} onChange={e => updateExercise(dayIdx, exIdx, 'rpe', e.target.value)} style={{ ...inputCell, textAlign: 'center', padding: '6px 2px' }}>
                    <option value="">—</option>
                    {[1,1.5,2,2.5,3,3.5,4,4.5,5,5.5,6,6.5,7,7.5,8,8.5,9,9.5,10].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                )}
                {/* Notes — hide in main row when per-set breakdown is open */}
                {expandedSetLogs.has(setLogKey) && setsNum >= 2 ? (
                  <div style={{ fontSize: 8, color: C.sub, fontWeight: 700, letterSpacing: 0.3, paddingLeft: 4 }}>per set ↓</div>
                ) : (
                  <input value={ex.notes} onChange={e => updateExercise(dayIdx, exIdx, 'notes', e.target.value)} placeholder="Cues..." style={inputCell} />
                )}
                <button onClick={() => duplicateExercise(dayIdx, exIdx)} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 5, color: C.accent, fontSize: 11, cursor: 'pointer', padding: 0, lineHeight: 1, fontWeight: 700, fontFamily: 'Montserrat,sans-serif' }} title="Add set">+</button>
                <button onClick={() => removeExercise(dayIdx, exIdx)} disabled={day.exercises.length <= 1} style={{ background: 'none', border: 'none', color: day.exercises.length > 1 ? C.red + '88' : C.border, fontSize: 16, cursor: day.exercises.length > 1 ? 'pointer' : 'default', padding: 0, lineHeight: 1 }} title="Remove exercise">×</button>
                </div>
                {/* Per-set RPE & Notes breakdown */}
                {expandedSetLogs.has(setLogKey) && setsNum >= 2 && (
                  <div style={{ marginLeft: 56, marginTop: 4, marginBottom: 6, padding: '8px 10px', background: '#fff', borderRadius: 8, border: `1px solid ${C.accent}33` }}>
                    <div style={{ fontSize: 9, fontWeight: 800, color: C.sub, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Per-Set Breakdown</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '36px 54px 50px 54px 66px 50px 1fr', gap: 4, marginBottom: 4, alignItems: 'end' }}>
                      <div style={{ fontSize: 7, fontWeight: 800, color: C.sub, letterSpacing: 0.5, textTransform: 'uppercase' }}>Set</div>
                      <div style={{ fontSize: 7, fontWeight: 800, color: C.sub, letterSpacing: 0.5, textTransform: 'uppercase' }}>Weight</div>
                      <div style={{ fontSize: 7, fontWeight: 800, color: C.sub, letterSpacing: 0.5, textTransform: 'uppercase' }}>{ex.repsType === 'time' ? 'Sec' : 'Reps'}</div>
                      <div style={{ fontSize: 7, fontWeight: 800, color: C.sub, letterSpacing: 0.5, textTransform: 'uppercase' }}>RPE</div>
                      <div style={{ fontSize: 7, fontWeight: 800, color: C.sub, letterSpacing: 0.5, textTransform: 'uppercase' }}>Tempo</div>
                      <div />
                      <div style={{ fontSize: 7, fontWeight: 800, color: C.sub, letterSpacing: 0.5, textTransform: 'uppercase' }}>Notes</div>
                    </div>
                    {Array.from({ length: setsNum }, (_, si) => {
                      const log = (ex.setLogs || [])[si] || {}
                      return (
                        <div key={si} style={{ display: 'grid', gridTemplateColumns: '36px 54px 50px 54px 66px 50px 1fr', gap: 4, marginBottom: 3, alignItems: 'center' }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: C.sub, paddingLeft: 4 }}>#{si + 1}</div>
                          <input value={log.weight || ''} onChange={e => updateSetLog(dayIdx, exIdx, si, 'weight', e.target.value)} placeholder="lbs" style={{ ...inputCell, textAlign: 'center', fontSize: 11, padding: '4px 2px' }} />
                          <input value={log.reps || ''} onChange={e => updateSetLog(dayIdx, exIdx, si, 'reps', e.target.value)} placeholder={ex.repsType === 'time' ? 'sec' : 'reps'} style={{ ...inputCell, textAlign: 'center', fontSize: 11, padding: '4px 2px' }} />
                          <select value={log.rpe || ''} onChange={e => updateSetLog(dayIdx, exIdx, si, 'rpe', e.target.value)} style={{ ...inputCell, textAlign: 'center', padding: '4px 2px', fontSize: 11 }}>
                            <option value="">—</option>
                            {[1,1.5,2,2.5,3,3.5,4,4.5,5,5.5,6,6.5,7,7.5,8,8.5,9,9.5,10].map(n => <option key={n} value={n}>{n}</option>)}
                          </select>
                          <input value={log.tempo || ''} onChange={e => { const digits = e.target.value.replace(/[^0-9]/g, '').slice(0, 4); const formatted = digits.split('').join('-'); updateSetLog(dayIdx, exIdx, si, 'tempo', formatted); }} placeholder="3-1-2-0" style={{ ...inputCell, textAlign: 'center', fontSize: 11, padding: '4px 2px' }} maxLength={7} />
                          <div />
                          <input value={log.notes || ''} onChange={e => updateSetLog(dayIdx, exIdx, si, 'notes', e.target.value)} placeholder="Set notes..." style={{ ...inputCell, fontSize: 11, padding: '4px 6px' }} />
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
          </div>

          {/* Add exercise button */}
          <button onClick={() => addExercise(dayIdx)} style={{ background: 'none', border: `1px dashed ${C.border}`, borderRadius: 6, padding: '5px 14px', fontSize: 11, color: C.accent, fontWeight: 700, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif', marginTop: 4 }}>
            + Add Exercise
          </button>

          {/* Day notes with collapse toggle */}
          <div style={{ marginTop: 10 }}>
            <button
              onClick={() => toggleCollapsedNotes(dayIdx)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 2px', marginBottom: collapsedNotes.has(dayIdx) ? 0 : 4 }}
            >
              <span style={{ fontSize: 9, fontWeight: 800, color: C.sub, letterSpacing: 1, textTransform: 'uppercase' }}>Day Notes</span>
              <span style={{ fontSize: 10, color: C.sub, fontWeight: 700, transition: 'transform .2s', display: 'inline-block', transform: collapsedNotes.has(dayIdx) ? 'rotate(-90deg)' : 'rotate(0deg)' }}>▼</span>
              {collapsedNotes.has(dayIdx) && day.dayNotes && (
                <span style={{ fontSize: 10, color: C.accent, fontWeight: 600, fontStyle: 'italic', fontFamily: 'Montserrat,sans-serif' }}>has notes</span>
              )}
            </button>
            {!collapsedNotes.has(dayIdx) && (
              <textarea
                value={day.dayNotes || ''}
                onChange={e => updateDayNotes(dayIdx, e.target.value)}
                rows={2}
                placeholder="How did this session go? Swaps, modifications, client feedback..."
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 12, fontFamily: 'Montserrat,sans-serif', color: C.text, background: '#fff', resize: 'vertical', outline: 'none', boxSizing: 'border-box', lineHeight: 1.5 }}
              />
            )}
          </div>

          {/* Autosave indicator */}
          <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
            {autoSaving && <span style={{ fontSize: 10, color: C.sub, fontStyle: 'italic' }}>Autosaving…</span>}
            {!autoSaving && savedDays.has(dayIdx) && <span style={{ fontSize: 10, color: C.green, fontWeight: 700 }}>✓ Saved</span>}
            <button
              onClick={() => saveDay(dayIdx)}
              disabled={saving || autoSaving || (!unsavedDays.has(dayIdx) && !savedDays.has(dayIdx))}
              style={{
                padding: '6px 20px', borderRadius: 7, border: 'none',
                background: savedDays.has(dayIdx) ? C.green : unsavedDays.has(dayIdx) ? C.accent : C.border,
                color: savedDays.has(dayIdx) ? '#fff' : unsavedDays.has(dayIdx) ? '#000' : C.sub,
                fontSize: 11, fontWeight: 700, cursor: (unsavedDays.has(dayIdx) && !autoSaving) ? 'pointer' : 'default',
                fontFamily: 'Montserrat,sans-serif', letterSpacing: 0.5, transition: 'all .2s'
              }}
            >
              {saving ? 'Saving...' : savedDays.has(dayIdx) ? '✓ Saved!' : unsavedDays.has(dayIdx) ? 'Save Day' : 'Saved'}
            </button>
          </div>
          </>}
        </div>
      ))}

      {/* Add day button */}
      <button onClick={addDay} style={{ background: 'none', border: `1.5px dashed ${C.accent}44`, borderRadius: 10, padding: '10px 20px', fontSize: 12, color: C.accent, fontWeight: 700, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif', width: '100%' }}>
        + Add Another Day
      </button>
    </div>
  )
}

// ── CLIENT PROFILE ────────────────────────────────────────────────────────────
// ── WEIGHT & BODY FAT TRACKER ────────────────────────────────────────────────
function WeightTracker({ client, onBack }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [weight, setWeight] = useState('')
  const [bodyFat, setBodyFat] = useState('')
  const [bmi, setBmi] = useState('')
  const [rating, setRating] = useState('')
  const [behaviorTags, setBehaviorTags] = useState([])
  const [behaviorNotes, setBehaviorNotes] = useState('')
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0])
  const [showHistory, setShowHistory] = useState(false)
  const [showJourneyModal, setShowJourneyModal] = useState(false)
  const chartRef = useRef(null)
  const modalChartRef = useRef(null)
  const pieChartRef = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getWeightLogsForClient(client.id)
      setLogs(data)
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [client.id])

  useEffect(() => { load() }, [load])

  const handleSave = async () => {
    if (!weight && !bodyFat) return alert('Enter at least weight or body fat %.')
    setSaving(true)
    try {
      await saveWeightLog(client.id, {
        weight: weight ? parseFloat(weight) : null,
        bodyFat: bodyFat ? parseFloat(bodyFat) : null,
        bmi: bmi ? parseFloat(bmi) : null,
        rating: rating || null,
        behaviorTags: behaviorTags.length ? behaviorTags : null,
        behaviorNotes,
        loggedAt: new Date(logDate + 'T12:00:00').toISOString()
      })
      setWeight(''); setBodyFat(''); setBmi(''); setRating(''); setBehaviorTags([]); setBehaviorNotes(''); setLogDate(new Date().toISOString().split('T')[0])
      await load()
    } catch (e) { alert('Error saving: ' + e.message) }
    setSaving(false)
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this weigh-in?')) return
    try { await deleteWeightLog(id); await load() } catch (e) { alert('Error: ' + e.message) }
  }

  // Shared chart drawing function
  const drawChart = useCallback((canvas, showBehavior) => {
    if (!canvas || logs.length < 2) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    const W = rect.width > 0 ? rect.width : canvas.width / dpr
    const H = rect.height > 0 ? rect.height : canvas.height / dpr
    if (rect.width > 0) {
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
    }
    ctx.scale(dpr, dpr)
    const pad = { top: 42, right: showBehavior ? 50 : 80, bottom: 50, left: 80 }
    const cW = W - pad.left - pad.right, cH = H - pad.top - pad.bottom

    ctx.clearRect(0, 0, W, H)

    const weightLogs = logs.filter(l => l.weight != null)
    const fatLogs = logs.filter(l => l.body_fat != null)
    const hasWeight = weightLogs.length >= 2
    const hasFat = fatLogs.length >= 2

    if (!hasWeight && !hasFat) return

    // Time range
    const allDates = logs.map(l => new Date(l.logged_at).getTime())
    const minT = Math.min(...allDates), maxT = Math.max(...allDates)
    const tRange = maxT - minT || 1
    const xFor = (t) => pad.left + ((t - minT) / tRange) * cW

    // Grid lines
    ctx.strokeStyle = '#E2E8F0'
    ctx.lineWidth = 1
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (cH / 4) * i
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke()
    }

    // Behavioral change markers — vertical dashed lines where rating shifts
    if (showBehavior) {
      const sorted = [...logs].sort((a, b) => new Date(a.logged_at) - new Date(b.logged_at))
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1], curr = sorted[i]
        if (curr.rating && prev.rating && curr.rating !== prev.rating) {
          const x = xFor(new Date(curr.logged_at).getTime())
          ctx.save()
          ctx.setLineDash([4, 4])
          ctx.strokeStyle = curr.rating === 'good' ? C.green + 'AA' : C.red + 'AA'
          ctx.lineWidth = 1.5
          ctx.beginPath(); ctx.moveTo(x, pad.top); ctx.lineTo(x, pad.top + cH); ctx.stroke()
          ctx.setLineDash([])
          // Arrow marker at top
          const markerColor = curr.rating === 'good' ? C.green : C.red
          const arrowLabel = curr.rating === 'good' ? '▲' : '▼'
          ctx.fillStyle = markerColor
          ctx.font = 'bold 14px Montserrat, sans-serif'
          ctx.textAlign = 'center'
          ctx.fillText(arrowLabel, x, pad.top - 2)
          // Date label at bottom
          const d = new Date(curr.logged_at)
          ctx.fillStyle = markerColor
          ctx.font = 'bold 9px Montserrat, sans-serif'
          ctx.fillText(`${d.getMonth() + 1}/${d.getDate()}`, x, pad.top + cH + 14)
          ctx.restore()
        }
      }
      // Highlight zones — light background color bands between behavioral shifts
      const shifts = [{ idx: 0, rating: sorted[0].rating || 'neutral' }]
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].rating && sorted[i].rating !== shifts[shifts.length - 1].rating) {
          shifts.push({ idx: i, rating: sorted[i].rating })
        }
      }
      for (let s = 0; s < shifts.length; s++) {
        const startX = xFor(new Date(sorted[shifts[s].idx].logged_at).getTime())
        const endX = s + 1 < shifts.length ? xFor(new Date(sorted[shifts[s + 1].idx].logged_at).getTime()) : pad.left + cW
        const zoneColor = shifts[s].rating === 'good' ? C.green + '08' : shifts[s].rating === 'bad' ? C.red + '08' : 'transparent'
        if (zoneColor !== 'transparent') {
          ctx.fillStyle = zoneColor
          ctx.fillRect(startX, pad.top, endX - startX, cH)
        }
      }
    }

    // X-axis date labels
    ctx.fillStyle = '#718096'
    ctx.font = '10px Montserrat, sans-serif'
    ctx.textAlign = 'center'
    const labelCount = Math.min(logs.length, showBehavior ? 10 : 6)
    const step = Math.max(1, Math.floor(logs.length / labelCount))
    for (let i = 0; i < logs.length; i += step) {
      const d = new Date(logs[i].logged_at)
      const label = `${d.getMonth() + 1}/${d.getDate()}`
      const x = xFor(d.getTime())
      ctx.fillText(label, x, H - pad.bottom + 18)
    }

    const drawLine = (data, getVal, color, label, yAxis) => {
      const vals = data.map(l => getVal(l))
      const minV = Math.min(...vals), maxV = Math.max(...vals)
      const vRange = maxV - minV || 1
      const yFor = (v) => pad.top + cH - ((v - minV) / vRange) * cH

      ctx.fillStyle = color
      ctx.font = '10px Montserrat, sans-serif'
      ctx.textAlign = yAxis === 'left' ? 'right' : 'left'
      for (let i = 0; i <= 4; i++) {
        const v = minV + (vRange / 4) * i
        const y = yFor(v)
        const x = yAxis === 'left' ? pad.left - 6 : W - pad.right + 6
        ctx.fillText(v.toFixed(1), x, y + 3)
      }

      ctx.font = 'bold 11px Montserrat, sans-serif'
      const labelX = yAxis === 'left' ? pad.left - 4 : W - pad.right + 4
      ctx.textAlign = yAxis === 'left' ? 'right' : 'left'
      ctx.fillText(label, labelX, pad.top - 18)

      ctx.strokeStyle = color
      ctx.lineWidth = 2.5
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.beginPath()
      data.forEach((l, i) => {
        const x = xFor(new Date(l.logged_at).getTime())
        const y = yFor(getVal(l))
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
      })
      ctx.stroke()

      // Dots with good/bad coloring
      const dotSize = showBehavior ? 6 : 5
      data.forEach(l => {
        const x = xFor(new Date(l.logged_at).getTime())
        const y = yFor(getVal(l))
        const dotColor = l.rating === 'good' ? C.green : l.rating === 'bad' ? C.red : color
        ctx.beginPath()
        ctx.arc(x, y, dotSize, 0, Math.PI * 2)
        ctx.fillStyle = dotColor
        ctx.fill()
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 2
        ctx.stroke()
      })

      // In modal: show behavior notes as tooltips near the dots
      if (showBehavior) {
        data.forEach(l => {
          if (l.behavior_notes) {
            const x = xFor(new Date(l.logged_at).getTime())
            const y = yFor(getVal(l))
            ctx.fillStyle = C.text + '99'
            ctx.font = '8px Montserrat, sans-serif'
            ctx.textAlign = 'center'
            const note = l.behavior_notes.length > 20 ? l.behavior_notes.slice(0, 20) + '...' : l.behavior_notes
            ctx.fillText(note, x, y - 12)
          }
        })
      }
    }

    if (hasWeight) drawLine(weightLogs, l => l.weight, C.accent, 'Weight (lbs)', 'left')
    if (hasFat) drawLine(fatLogs, l => l.body_fat, C.orange, 'Body Fat %', hasWeight ? 'right' : 'left')
  }, [logs])

  // Inline chart
  useEffect(() => { drawChart(chartRef.current, false) }, [drawChart])

  // Modal chart
  useEffect(() => {
    if (showJourneyModal) {
      setTimeout(() => drawChart(modalChartRef.current, true), 50)
    }
  }, [showJourneyModal, drawChart])

  const PIE_COLORS = ['#EF4444','#F59E0B','#8B5CF6','#EC4899','#14B8A6','#F97316','#3B82F6','#6B7280']

  const drawPieChart = useCallback((canvas) => {
    if (!canvas) return
    const tagCounts = {}
    logs.forEach(l => { (l.behavior_tags || []).forEach(tag => { tagCounts[tag] = (tagCounts[tag] || 0) + 1 }) })
    const entries = Object.entries(tagCounts).sort((a, b) => b[1] - a[1])
    if (entries.length === 0) return
    const total = entries.reduce((s, [, v]) => s + v, 0)
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr; canvas.height = rect.height * dpr
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)
    const size = Math.min(rect.width, rect.height)
    const cx = rect.width / 2, cy = rect.height / 2, r = size / 2 - 10
    let angle = -Math.PI / 2
    entries.forEach(([, count], i) => {
      const slice = (count / total) * Math.PI * 2
      ctx.beginPath(); ctx.moveTo(cx, cy)
      ctx.arc(cx, cy, r, angle, angle + slice)
      ctx.closePath()
      ctx.fillStyle = PIE_COLORS[i % PIE_COLORS.length]
      ctx.fill()
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke()
      angle += slice
    })
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.50, 0, Math.PI * 2)
    ctx.fillStyle = C.card; ctx.fill()
    const badCount = logs.filter(l => l.rating === 'bad').length
    const pct = logs.length > 0 ? Math.round((badCount / logs.length) * 100) : 0
    ctx.fillStyle = C.text; ctx.font = `bold ${Math.round(r * 0.36)}px Montserrat,sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(`${pct}%`, cx, cy - 6)
    ctx.fillStyle = C.sub; ctx.font = `${Math.round(r * 0.18)}px Montserrat,sans-serif`
    ctx.fillText('barriers', cx, cy + r * 0.22)
  }, [logs])

  useEffect(() => { drawPieChart(pieChartRef.current) }, [drawPieChart])

  const input = { width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontFamily: 'Montserrat,sans-serif', fontSize: 13, color: C.text, outline: 'none', background: C.faint, boxSizing: 'border-box' }

  const latestWeight = [...logs].reverse().find(l => l.weight != null)
  const latestFat = [...logs].reverse().find(l => l.body_fat != null)
  const firstWeight = logs.find(l => l.weight != null)
  const firstFat = logs.find(l => l.body_fat != null)
  const weightChange = latestWeight && firstWeight && latestWeight !== firstWeight ? (latestWeight.weight - firstWeight.weight).toFixed(1) : null
  const fatChange = latestFat && firstFat && latestFat !== firstFat ? (latestFat.body_fat - firstFat.body_fat).toFixed(1) : null

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 24px 32px' }}>
      <LogoHeader />
      <button onClick={onBack} style={{ background: 'none', border: `1px solid ${C.border}`, color: C.sub, borderRadius: 7, padding: '6px 14px', fontSize: 12, cursor: 'pointer', marginBottom: 24 }}>← Back to {client.name}</button>

      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: C.accent, textTransform: 'uppercase', marginBottom: 4 }}>WEIGHT & BODY FAT TRACKER</div>
      <div style={{ fontWeight: 800, fontSize: 26, letterSpacing: 3, color: C.text, marginBottom: 24 }}>{client.name}</div>

      {/* Summary cards */}
      {(latestWeight || latestFat) && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
          {latestWeight && (
            <div style={{ flex: '1 1 160px', background: C.accent + '10', border: `1.5px solid ${C.accent}33`, borderRadius: 12, padding: '14px 18px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.accent, letterSpacing: 1.5, textTransform: 'uppercase' }}>Current Weight</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: C.text, marginTop: 2 }}>{latestWeight.weight}<span style={{ fontSize: 13, color: C.sub }}> lbs</span></div>
              {weightChange && <div style={{ fontSize: 12, fontWeight: 700, color: parseFloat(weightChange) <= 0 ? C.green : C.red, marginTop: 2 }}>{parseFloat(weightChange) > 0 ? '+' : ''}{weightChange} lbs total</div>}
            </div>
          )}
          {latestFat && (
            <div style={{ flex: '1 1 160px', background: C.orange + '10', border: `1.5px solid ${C.orange}33`, borderRadius: 12, padding: '14px 18px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.orange, letterSpacing: 1.5, textTransform: 'uppercase' }}>Body Fat</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: C.text, marginTop: 2 }}>{latestFat.body_fat}<span style={{ fontSize: 13, color: C.sub }}>%</span></div>
              {fatChange && <div style={{ fontSize: 12, fontWeight: 700, color: parseFloat(fatChange) <= 0 ? C.green : C.red, marginTop: 2 }}>{parseFloat(fatChange) > 0 ? '+' : ''}{fatChange}% total</div>}
            </div>
          )}
          <div style={{ flex: '1 1 160px', background: C.faint, border: `1.5px solid ${C.border}`, borderRadius: 12, padding: '14px 18px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.sub, letterSpacing: 1.5, textTransform: 'uppercase' }}>Weigh-Ins</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: C.text, marginTop: 2 }}>{logs.length}</div>
            <div style={{ fontSize: 12, color: C.sub }}>logged</div>
          </div>
        </div>
      )}

      {/* Chart */}
      {loading ? <Spinner /> : logs.length >= 2 ? (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 16px 8px', marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: C.sub, textTransform: 'uppercase' }}>PROGRESS OVER TIME</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={async () => {
                try {
                  const { jsPDF } = await import('jspdf')
                  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' })
                  const W = doc.internal.pageSize.getWidth()
                  // Header bar
                  doc.setFillColor(43, 170, 223)
                  doc.rect(0, 0, W, 72, 'F')
                  doc.setFont('helvetica', 'bold')
                  doc.setFontSize(20)
                  doc.setTextColor(255, 255, 255)
                  doc.text('FreddyFit Performance Center', 36, 30)
                  doc.setFont('helvetica', 'normal')
                  doc.setFontSize(9)
                  doc.text('6047 Telegraph Road  ·  Saint Louis, MO 63123  ·  myfitpro@getfreddyfit.com  ·  314-584-9389', 36, 46)
                  doc.setFont('helvetica', 'bold')
                  doc.setFontSize(12)
                  doc.text('PATIENT PROGRESS REPORT', 36, 62)
                  // Client name
                  doc.setTextColor(26, 32, 44)
                  doc.setFontSize(18)
                  doc.setFont('helvetica', 'bold')
                  doc.text(client.name, 36, 96)
                  doc.setFontSize(10)
                  doc.setFont('helvetica', 'normal')
                  doc.setTextColor(113, 128, 150)
                  doc.text(`Generated ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`, 36, 112)
                  // Stats row
                  let y = 136
                  const latestW = [...logs].reverse().find(l => l.weight != null)
                  const firstW = logs.find(l => l.weight != null)
                  const latestBF = [...logs].reverse().find(l => l.body_fat != null)
                  const firstBF = logs.find(l => l.body_fat != null)
                  const latestBMI = [...logs].reverse().find(l => l.bmi != null)
                  const stats = [
                    latestW ? `Current Weight: ${latestW.weight} lbs` : null,
                    latestW && firstW && latestW !== firstW ? `Change: ${(latestW.weight - firstW.weight) > 0 ? '+' : ''}${(latestW.weight - firstW.weight).toFixed(1)} lbs` : null,
                    latestBF ? `Body Fat: ${latestBF.body_fat}%` : null,
                    latestBF && firstBF && latestBF !== firstBF ? `BF Change: ${(latestBF.body_fat - firstBF.body_fat) > 0 ? '+' : ''}${(latestBF.body_fat - firstBF.body_fat).toFixed(1)}%` : null,
                    latestBMI ? `BMI: ${latestBMI.bmi}` : null,
                    `Total Check-Ins: ${logs.length}`,
                  ].filter(Boolean)
                  doc.setFontSize(11)
                  doc.setTextColor(26, 32, 44)
                  doc.setFont('helvetica', 'bold')
                  stats.forEach((s, i) => {
                    doc.text(s, 36 + (i % 2) * 240, y + Math.floor(i / 2) * 18)
                  })
                  y += Math.ceil(stats.length / 2) * 18 + 16
                  // Charts side by side
                  const chartAreaW = W - 72
                  const pieW = 160
                  const lineChartW = chartAreaW - pieW - 16
                  if (logs.length >= 2) {
                    const offChart = document.createElement('canvas')
                    offChart.width = 900; offChart.height = 320
                    drawChart(offChart, false)
                    const imgData = offChart.toDataURL('image/png')
                    doc.addImage(imgData, 'PNG', 36, y, lineChartW, 190)
                  }
                  // Pie chart
                  const tagCounts = {}
                  logs.forEach(l => { (l.behavior_tags || []).forEach(t => { tagCounts[t] = (tagCounts[t] || 0) + 1 }) })
                  const pieEntries = Object.entries(tagCounts).sort((a, b) => b[1] - a[1])
                  const pieTotal = pieEntries.reduce((s, [, v]) => s + v, 0)
                  const PIE_PDF_COLORS = [
                    [239,68,68],[245,158,11],[139,92,246],[236,72,153],[20,184,166],[249,115,22],[59,130,246],[107,114,128]
                  ]
                  if (pieEntries.length > 0) {
                    const offCanvas = document.createElement('canvas')
                    const sz = 240
                    offCanvas.width = sz; offCanvas.height = sz
                    const octx = offCanvas.getContext('2d')
                    const cr = sz / 2, pr = sz / 2 - 10
                    let ang = -Math.PI / 2
                    pieEntries.forEach(([, count], i) => {
                      const slice = (count / pieTotal) * Math.PI * 2
                      octx.beginPath(); octx.moveTo(cr, cr)
                      octx.arc(cr, cr, pr, ang, ang + slice); octx.closePath()
                      const [r2, g2, b2] = PIE_PDF_COLORS[i % PIE_PDF_COLORS.length]
                      octx.fillStyle = `rgb(${r2},${g2},${b2})`; octx.fill()
                      octx.strokeStyle = '#fff'; octx.lineWidth = 3; octx.stroke()
                      ang += slice
                    })
                    octx.beginPath(); octx.arc(cr, cr, pr * 0.5, 0, Math.PI * 2)
                    octx.fillStyle = '#fff'; octx.fill()
                    const pieImgData = offCanvas.toDataURL('image/png')
                    const pX = 36 + lineChartW + 16
                    doc.addImage(pieImgData, 'PNG', pX, y, pieW - 10, pieW - 10)
                    // Barrier Breakdown label
                    doc.setFontSize(8); doc.setFont('helvetica', 'bold')
                    doc.setTextColor(239, 68, 68)
                    doc.text('BARRIER BREAKDOWN', pX, y - 6)
                    // Legend
                    let ly = y + pieW + 2
                    pieEntries.slice(0, 6).forEach(([tag, count], i) => {
                      const [r2, g2, b2] = PIE_PDF_COLORS[i % PIE_PDF_COLORS.length]
                      doc.setFillColor(r2, g2, b2); doc.rect(pX, ly - 5, 7, 7, 'F')
                      doc.setFontSize(7); doc.setFont('helvetica', 'normal')
                      doc.setTextColor(26, 32, 44)
                      doc.text(`${tag} (${Math.round((count / pieTotal) * 100)}%)`, pX + 10, ly)
                      ly += 11
                    })
                  }
                  y += 210
                  // Behavioral Insights summary
                  const badCount2 = logs.filter(l => l.rating === 'bad').length
                  const goodCount2 = logs.filter(l => l.rating === 'good').length
                  const ratedTotal = badCount2 + goodCount2
                  if (pieEntries.length > 0 || ratedTotal > 0) {
                    doc.setFillColor(249, 250, 251)
                    doc.rect(36, y, W - 72, 2, 'F')
                    y += 10
                    doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(43, 170, 223)
                    doc.text('BEHAVIORAL INSIGHTS', 36, y); y += 14
                    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(26, 32, 44)
                    if (ratedTotal > 0) {
                      const adherePct = Math.round((goodCount2 / ratedTotal) * 100)
                      doc.text(`• Adherence Rate: ${adherePct}% of rated check-ins were positive (${goodCount2} good / ${badCount2} needs work)`, 36, y); y += 14
                      if (adherePct >= 70) {
                        doc.text('  Great consistency! Keep reinforcing what is working.', 36, y); y += 14
                      } else if (adherePct >= 40) {
                        doc.text('  Moderate adherence. Focus on eliminating the top barriers listed below.', 36, y); y += 14
                      } else {
                        doc.text('  Adherence needs attention. Review barrier patterns with your trainer.', 36, y); y += 14
                      }
                    }
                    if (pieEntries.length > 0) {
                      doc.text(`• Top Barrier: ${pieEntries[0][0]} (${Math.round((pieEntries[0][1] / pieTotal) * 100)}% of all barrier flags)`, 36, y); y += 14
                      if (pieEntries.length > 1) {
                        doc.text(`• Secondary Barrier: ${pieEntries[1][0]} (${Math.round((pieEntries[1][1] / pieTotal) * 100)}%)`, 36, y); y += 14
                      }
                      doc.setTextColor(113, 128, 150); doc.setFontSize(9)
                      doc.text('Addressing your top barriers consistently is the single highest-leverage action for faster results.', 36, y); y += 18
                      doc.setTextColor(26, 32, 44); doc.setFontSize(10)
                    }
                  }
                  y += 10
                  // History table
                  doc.setFontSize(10)
                  doc.setFont('helvetica', 'bold')
                  doc.setTextColor(43, 170, 223)
                  doc.text('WEIGH-IN HISTORY', 36, y)
                  y += 14
                  doc.setFont('helvetica', 'normal')
                  doc.setTextColor(26, 32, 44)
                  const cols = ['Date', 'Weight', 'Body Fat', 'BMI', 'Rating', 'Barriers / Notes']
                  const colW = [72, 64, 64, 46, 64, W - 72 - 310]
                  let cx = 36
                  doc.setFont('helvetica', 'bold')
                  doc.setFontSize(8)
                  doc.setTextColor(113, 128, 150)
                  cols.forEach((c, i) => { doc.text(c, cx, y); cx += colW[i] })
                  y += 12
                  doc.setFont('helvetica', 'normal')
                  doc.setTextColor(26, 32, 44);
                  [...logs].reverse().forEach(l => {
                    if (y > 700) { doc.addPage(); y = 40 }
                    const d = new Date(l.logged_at)
                    const barriers = l.behavior_tags && l.behavior_tags.length ? l.behavior_tags.join(', ') : (l.behavior_notes ? l.behavior_notes.slice(0, 60) : '—')
                    const row = [
                      `${d.getMonth()+1}/${d.getDate()}/${d.getFullYear()}`,
                      l.weight != null ? `${l.weight} lbs` : '—',
                      l.body_fat != null ? `${l.body_fat}%` : '—',
                      l.bmi != null ? `${l.bmi}` : '—',
                      l.rating ? (l.rating === 'good' ? 'Good' : 'Needs Work') : '—',
                      barriers.slice(0, 55),
                    ]
                    cx = 36
                    row.forEach((v, i) => { doc.text(v, cx, y); cx += colW[i] })
                    y += 14
                  })
                  // Footer
                  const pages = doc.getNumberOfPages()
                  for (let p = 1; p <= pages; p++) {
                    doc.setPage(p)
                    doc.setFontSize(8)
                    doc.setTextColor(113, 128, 150)
                    doc.text('FreddyFit Performance Center  ·  6047 Telegraph Rd, Saint Louis MO 63123  ·  Confidential Patient Report', 36, doc.internal.pageSize.getHeight() - 20)
                    doc.text(`Page ${p} of ${pages}`, W - 36, doc.internal.pageSize.getHeight() - 20, { align: 'right' })
                  }
                  doc.save(`${client.name.replace(/\s+/g, '_')}_weight_report.pdf`)
                } catch(e) { alert('PDF export failed: ' + e.message) }
              }} style={{ background: C.green + '12', border: `1.5px solid ${C.green}44`, color: C.green, borderRadius: 8, padding: '5px 14px', fontSize: 10, fontWeight: 800, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif', letterSpacing: 1, textTransform: 'uppercase' }}>
                ↓ Export PDF
              </button>
              <button onClick={() => setShowJourneyModal(true)} style={{ background: C.accent + '12', border: `1.5px solid ${C.accent}44`, color: C.accent, borderRadius: 8, padding: '5px 14px', fontSize: 10, fontWeight: 800, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif', letterSpacing: 1, textTransform: 'uppercase' }}>
                View Journey
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'stretch' }}>
            {/* Weight / BF chart */}
            <div style={{ flex: 2, minWidth: 0 }}>
              <canvas ref={chartRef} style={{ width: '100%', height: 260, display: 'block' }} />
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', padding: '6px 0 2px', flexWrap: 'wrap' }}>
                {[['Good', C.green],['Needs Work', C.red],['Weight', C.accent],['Body Fat', C.orange]].map(([l, clr]) => (
                  <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, fontWeight: 700, color: C.sub }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: clr }} />{l}
                  </div>
                ))}
              </div>
            </div>
            {/* Barrier pie chart */}
            {(() => {
              const tagCounts = {}
              logs.forEach(l => { (l.behavior_tags || []).forEach(tag => { tagCounts[tag] = (tagCounts[tag] || 0) + 1 }) })
              const entries = Object.entries(tagCounts).sort((a, b) => b[1] - a[1])
              if (entries.length === 0) return null
              const total = entries.reduce((s, [, v]) => s + v, 0)
              return (
                <div style={{ flex: '0 0 200px', display: 'flex', flexDirection: 'column', alignItems: 'center', borderLeft: `1px solid ${C.border}`, paddingLeft: 14 }}>
                  <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.5, color: C.red, textTransform: 'uppercase', marginBottom: 6, alignSelf: 'flex-start' }}>BARRIER BREAKDOWN</div>
                  <canvas ref={pieChartRef} style={{ width: 120, height: 120, display: 'block', flexShrink: 0 }} />
                  <div style={{ marginTop: 10, width: '100%' }}>
                    {entries.slice(0, 5).map(([tag, count], i) => (
                      <div key={tag} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                        <div style={{ flex: 1, fontSize: 9, color: C.text, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tag}</div>
                        <div style={{ fontSize: 9, fontWeight: 800, color: PIE_COLORS[i % PIE_COLORS.length] }}>{Math.round((count / total) * 100)}%</div>
                      </div>
                    ))}
                    {entries.length > 5 && <div style={{ fontSize: 9, color: C.sub, marginTop: 2 }}>+{entries.length - 5} more</div>}
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      ) : (
        <div style={{ background: C.faint, border: `1px dashed ${C.border}`, borderRadius: 14, padding: '24px 20px', marginBottom: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: C.sub, fontWeight: 600 }}>{logs.length === 0 ? 'No weigh-ins yet — log the first one below!' : 'Log one more weigh-in to see the chart.'}</div>
        </div>
      )}

      {/* Input Form */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '20px 20px', marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: C.accent, textTransform: 'uppercase', marginBottom: 16 }}>LOG WEIGH-IN</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: C.sub, letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Date</label>
            <input type="date" value={logDate} onChange={e => setLogDate(e.target.value)} style={input} />
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: C.sub, letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Weight (lbs)</label>
            <input type="number" step="0.1" value={weight} onChange={e => setWeight(e.target.value)} placeholder="185.0" style={input} />
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: C.sub, letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Body Fat %</label>
            <input type="number" step="0.1" value={bodyFat} onChange={e => setBodyFat(e.target.value)} placeholder="22.5" style={input} />
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: C.sub, letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>BMI</label>
            <input type="number" step="0.1" value={bmi} onChange={e => setBmi(e.target.value)} placeholder="24.5" style={input} />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: C.sub, letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>How was this weigh-in?</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: rating === 'bad' ? 12 : 0 }}>
            <button onClick={() => { setRating(rating === 'good' ? '' : 'good'); setBehaviorTags([]) }} style={{ flex: 1, padding: '10px 16px', borderRadius: 10, border: `2px solid ${rating === 'good' ? C.green : C.border}`, background: rating === 'good' ? C.green + '15' : 'white', color: rating === 'good' ? C.green : C.sub, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              ✓ Good
            </button>
            <button onClick={() => setRating(rating === 'bad' ? '' : 'bad')} style={{ flex: 1, padding: '10px 16px', borderRadius: 10, border: `2px solid ${rating === 'bad' ? C.red : C.border}`, background: rating === 'bad' ? C.red + '15' : 'white', color: rating === 'bad' ? C.red : C.sub, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              ⚠ Needs Work
            </button>
          </div>
          {rating === 'bad' && (
            <div style={{ background: C.red + '08', border: `1px solid ${C.red}22`, borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.red, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>What's contributing? (select all that apply)</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {['Emotional Stress','Mental Stress','Physical Stress','Hormonal','Traveling','Eating Out','Late Night Snacking','Poor Tracking'].map(tag => {
                  const on = behaviorTags.includes(tag)
                  return (
                    <button key={tag} type="button" onClick={() => setBehaviorTags(prev => on ? prev.filter(t => t !== tag) : [...prev, tag])}
                      style={{ padding: '6px 13px', borderRadius: 20, border: `1.5px solid ${on ? C.red : C.border}`, background: on ? C.red + '18' : 'white', color: on ? C.red : C.sub, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, fontSize: 11, cursor: 'pointer', transition: 'all .12s' }}>
                      {tag}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: C.sub, letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Behavior Notes / What to Address</label>
          <textarea value={behaviorNotes} onChange={e => setBehaviorNotes(e.target.value)} rows={3} placeholder="e.g. Missed meals on weekends, hydration low, stress eating..." style={{ ...input, resize: 'vertical' }} />
        </div>

        <Btn onClick={handleSave} disabled={saving || (!weight && !bodyFat)}>
          {saving ? 'Saving...' : 'Log Weigh-In'}
        </Btn>
      </div>

      {/* History */}
      {logs.length > 0 && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setShowHistory(!showHistory)}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: C.sub, textTransform: 'uppercase' }}>WEIGH-IN HISTORY ({logs.length})</div>
            <span style={{ fontSize: 11, color: C.sub }}>{showHistory ? '▲ Hide' : '▼ View All'}</span>
          </div>
          {showHistory && (
            <div style={{ marginTop: 12 }}>
              {[...logs].reverse().map(l => {
                const d = new Date(l.logged_at)
                const dateStr = `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`
                return (
                  <div key={l.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 0', borderBottom: `1px solid ${C.border}22` }}>
                    <div style={{ minWidth: 8, height: 8, borderRadius: '50%', marginTop: 5, background: l.rating === 'good' ? C.green : l.rating === 'bad' ? C.red : C.border }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{dateStr}</span>
                        {l.weight != null && <span style={{ fontSize: 12, color: C.accent, fontWeight: 700 }}>{l.weight} lbs</span>}
                        {l.body_fat != null && <span style={{ fontSize: 12, color: C.orange, fontWeight: 700 }}>{l.body_fat}%</span>}
                          {l.rating && <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 8, padding: '1px 8px', background: l.rating === 'good' ? C.green + '15' : C.red + '15', color: l.rating === 'good' ? C.green : C.red }}>{l.rating === 'good' ? 'Good' : 'Needs Work'}</span>}
                      </div>
                      {l.behavior_tags && l.behavior_tags.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5 }}>
                          {l.behavior_tags.map(tag => <span key={tag} style={{ fontSize: 9, fontWeight: 700, borderRadius: 10, padding: '2px 8px', background: C.red + '12', color: C.red, border: `1px solid ${C.red}22` }}>{tag}</span>)}
                        </div>
                      )}
                      {l.behavior_notes && <div style={{ fontSize: 11, color: C.sub, marginTop: 3, lineHeight: 1.5 }}>{l.behavior_notes}</div>}
                    </div>
                    <button onClick={() => handleDelete(l.id)} style={{ background: 'none', border: 'none', color: C.red + '66', fontSize: 14, cursor: 'pointer', padding: '0 4px' }} title="Delete">×</button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Journey Modal */}
      {showJourneyModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }} onClick={() => setShowJourneyModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.card, borderRadius: 20, padding: '28px 24px', width: '95%', maxWidth: 960, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: C.accent, textTransform: 'uppercase', marginBottom: 4 }}>CLIENT JOURNEY</div>
                <div style={{ fontWeight: 800, fontSize: 22, letterSpacing: 2, color: C.text }}>{client.name}</div>
              </div>
              <button onClick={() => setShowJourneyModal(false)} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 12px', fontSize: 16, color: C.sub, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif' }}>×</button>
            </div>

            {/* Summary Row */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
              {latestWeight && (
                <div style={{ flex: '1 1 120px', background: C.accent + '10', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: C.accent, letterSpacing: 1, textTransform: 'uppercase' }}>Current</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: C.text }}>{latestWeight.weight}<span style={{ fontSize: 11, color: C.sub }}> lbs</span></div>
                  {weightChange && <div style={{ fontSize: 11, fontWeight: 700, color: parseFloat(weightChange) <= 0 ? C.green : C.red }}>{parseFloat(weightChange) > 0 ? '+' : ''}{weightChange} lbs</div>}
                </div>
              )}
              {latestFat && (
                <div style={{ flex: '1 1 120px', background: C.orange + '10', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: C.orange, letterSpacing: 1, textTransform: 'uppercase' }}>Body Fat</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: C.text }}>{latestFat.body_fat}<span style={{ fontSize: 11, color: C.sub }}>%</span></div>
                  {fatChange && <div style={{ fontSize: 11, fontWeight: 700, color: parseFloat(fatChange) <= 0 ? C.green : C.red }}>{parseFloat(fatChange) > 0 ? '+' : ''}{fatChange}%</div>}
                </div>
              )}
              <div style={{ flex: '1 1 120px', background: C.faint, borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: C.sub, letterSpacing: 1, textTransform: 'uppercase' }}>Total Check-Ins</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: C.text }}>{logs.length}</div>
              </div>
              {(() => {
                const goodCount = logs.filter(l => l.rating === 'good').length
                const badCount = logs.filter(l => l.rating === 'bad').length
                const total = goodCount + badCount
                const pct = total > 0 ? Math.round((goodCount / total) * 100) : 0
                return (
                  <div style={{ flex: '1 1 120px', background: pct >= 50 ? C.green + '10' : C.red + '10', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: pct >= 50 ? C.green : C.red, letterSpacing: 1, textTransform: 'uppercase' }}>Adherence</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: C.text }}>{pct}%</div>
                    <div style={{ fontSize: 10, color: C.sub }}>{goodCount} good / {badCount} needs work</div>
                  </div>
                )
              })()}
            </div>

            {/* Behavior Tag Pie Chart */}
            {(() => {
              const tagCounts = {}
              logs.forEach(l => { (l.behavior_tags || []).forEach(tag => { tagCounts[tag] = (tagCounts[tag] || 0) + 1 }) })
              const entries = Object.entries(tagCounts).sort((a, b) => b[1] - a[1])
              if (entries.length === 0) return null
              const total = entries.reduce((s, [, v]) => s + v, 0)
              const PIE_COLORS = ['#EF4444','#F59E0B','#8B5CF6','#EC4899','#14B8A6','#F97316','#3B82F6','#6B7280']
              return (
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 20px', marginBottom: 20 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, color: C.red, textTransform: 'uppercase', marginBottom: 14 }}>BARRIER BREAKDOWN — Needs Work Factors</div>
                  <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
                    <canvas ref={el => {
                      if (!el) return
                      const size = 160
                      el.width = size * (window.devicePixelRatio || 1); el.height = size * (window.devicePixelRatio || 1)
                      el.style.width = size + 'px'; el.style.height = size + 'px'
                      const ctx = el.getContext('2d')
                      ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1)
                      let angle = -Math.PI / 2
                      const cx = size / 2, cy = size / 2, r = size / 2 - 8
                      entries.forEach(([, count], i) => {
                        const slice = (count / total) * Math.PI * 2
                        ctx.beginPath(); ctx.moveTo(cx, cy)
                        ctx.arc(cx, cy, r, angle, angle + slice)
                        ctx.closePath()
                        ctx.fillStyle = PIE_COLORS[i % PIE_COLORS.length]
                        ctx.fill()
                        angle += slice
                      })
                      // Center hole
                      ctx.beginPath(); ctx.arc(cx, cy, r * 0.52, 0, Math.PI * 2); ctx.fillStyle = C.card; ctx.fill()
                    }} />
                    <div style={{ flex: 1, minWidth: 200 }}>
                      {entries.map(([tag, count], i) => (
                        <div key={tag} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                          <div style={{ width: 12, height: 12, borderRadius: 3, background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                          <div style={{ flex: 1, fontSize: 12, color: C.text, fontWeight: 600 }}>{tag}</div>
                          <div style={{ fontSize: 11, fontWeight: 800, color: PIE_COLORS[i % PIE_COLORS.length] }}>{count}×</div>
                          <div style={{ fontSize: 10, color: C.sub, minWidth: 34, textAlign: 'right' }}>{Math.round((count / total) * 100)}%</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* Large Chart with Behavioral Markers */}
            <div style={{ background: C.faint, borderRadius: 14, padding: '16px 12px 8px', marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, color: C.sub, textTransform: 'uppercase', marginBottom: 8 }}>PROGRESS WITH BEHAVIORAL CHANGES</div>
              <canvas ref={modalChartRef} style={{ width: '100%', height: 360, display: 'block' }} />
              <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', padding: '10px 0 4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: C.accent }} /> Weight
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: C.orange }} /> Body Fat
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: C.green }} /> Good
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: C.red }} /> Needs Work
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700 }}>
                  <div style={{ width: 16, height: 0, borderTop: `2px dashed ${C.green}` }} /> Positive Shift
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700 }}>
                  <div style={{ width: 16, height: 0, borderTop: `2px dashed ${C.red}` }} /> Negative Shift
                </div>
              </div>
            </div>

            {/* Behavioral Change Timeline */}
            {(() => {
              const sorted = [...logs].sort((a, b) => new Date(a.logged_at) - new Date(b.logged_at))
              const shifts = []
              for (let i = 1; i < sorted.length; i++) {
                const prev = sorted[i - 1], curr = sorted[i]
                if (curr.rating && prev.rating && curr.rating !== prev.rating) {
                  shifts.push(curr)
                }
              }
              const notesEntries = sorted.filter(l => l.behavior_notes)
              if (shifts.length === 0 && notesEntries.length === 0) return null
              return (
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 18px' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, color: C.sub, textTransform: 'uppercase', marginBottom: 12 }}>BEHAVIORAL CHANGE TIMELINE</div>
                  {shifts.length > 0 && shifts.map((s, i) => {
                    const d = new Date(s.logged_at)
                    const dateStr = `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`
                    const isGood = s.rating === 'good'
                    return (
                      <div key={`shift-${i}`} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 0', borderBottom: `1px solid ${C.border}22` }}>
                        <div style={{ minWidth: 28, height: 28, borderRadius: '50%', background: isGood ? C.green + '18' : C.red + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, marginTop: 2 }}>
                          {isGood ? '▲' : '▼'}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: isGood ? C.green : C.red }}>
                            {isGood ? 'Positive Shift' : 'Regression Noted'} — {dateStr}
                          </div>
                          {s.behavior_notes && <div style={{ fontSize: 11, color: C.sub, marginTop: 3, lineHeight: 1.5 }}>{s.behavior_notes}</div>}
                          {s.weight != null && <span style={{ fontSize: 11, color: C.accent, fontWeight: 600 }}>{s.weight} lbs</span>}
                          {s.weight != null && s.body_fat != null && <span style={{ color: C.sub }}> · </span>}
                          {s.body_fat != null && <span style={{ fontSize: 11, color: C.orange, fontWeight: 600 }}>{s.body_fat}%</span>}
                        </div>
                      </div>
                    )
                  })}
                  {notesEntries.length > 0 && (
                    <>
                      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, color: C.sub, textTransform: 'uppercase', marginTop: 16, marginBottom: 8 }}>TRAINER NOTES LOG</div>
                      {notesEntries.map((l, i) => {
                        const d = new Date(l.logged_at)
                        const dateStr = `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`
                        return (
                          <div key={`note-${i}`} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 0', borderBottom: `1px solid ${C.border}11` }}>
                            <div style={{ minWidth: 8, height: 8, borderRadius: '50%', marginTop: 5, background: l.rating === 'good' ? C.green : l.rating === 'bad' ? C.red : C.border }} />
                            <div>
                              <span style={{ fontSize: 11, fontWeight: 700, color: C.text }}>{dateStr}</span>
                              <div style={{ fontSize: 11, color: C.sub, marginTop: 2, lineHeight: 1.5 }}>{l.behavior_notes}</div>
                            </div>
                          </div>
                        )
                      })}
                    </>
                  )}
                </div>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}

// ── CLIENT REMINDERS ──────────────────────────────────────────────────────────
function ClientReminders({ client, onUpdate }) {
  const [open, setOpen] = useState(true)
  const [adding, setAdding] = useState(false)
  const [newDate, setNewDate] = useState('')
  const [newNote, setNewNote] = useState('')

  const intake = (() => {
    try { return JSON.parse(client.trainerNotes || '{}') } catch { return {} }
  })()
  const reminders = (intake.reminders || []).sort((a, b) => new Date(a.date) - new Date(b.date))

  const saveReminders = async (updated) => {
    const updatedNotes = JSON.stringify({ ...intake, reminders: updated })
    const updatedClient = { ...client, trainerNotes: updatedNotes }
    await saveClient(updatedClient)
    onUpdate(updatedClient)
  }

  const addReminder = async () => {
    if (!newDate || !newNote.trim()) return
    await saveReminders([...reminders, { id: makeId(), date: newDate, note: newNote.trim(), done: false }])
    setNewDate(''); setNewNote(''); setAdding(false)
  }

  const toggleDone = async (id) => {
    await saveReminders(reminders.map(r => r.id === id ? { ...r, done: !r.done } : r))
  }

  const removeReminder = async (id) => {
    await saveReminders(reminders.filter(r => r.id !== id))
  }

  const today = new Date().toISOString().split('T')[0]
  const upcoming = reminders.filter(r => !r.done && r.date >= today)
  const overdue = reminders.filter(r => !r.done && r.date < today)
  const completed = reminders.filter(r => r.done)

  return (
    <div style={{ background: C.card, border: `1.5px solid ${overdue.length > 0 ? C.red + '66' : C.accent + '44'}`, borderRadius: 14, padding: '16px 20px', marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setOpen(!open)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: overdue.length > 0 ? C.red : C.accent, textTransform: 'uppercase' }}>📌 Reminders</span>
          {overdue.length > 0 && <span style={{ fontSize: 10, background: C.red + '18', color: C.red, borderRadius: 10, padding: '2px 8px', fontWeight: 700 }}>{overdue.length} overdue</span>}
          {upcoming.length > 0 && <span style={{ fontSize: 10, background: C.accent + '15', color: C.accent, borderRadius: 10, padding: '2px 8px', fontWeight: 700 }}>{upcoming.length} upcoming</span>}
        </div>
        <span style={{ fontSize: 11, color: C.sub }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={{ marginTop: 12 }}>
          {/* Overdue */}
          {overdue.map(r => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: C.red + '08', borderRadius: 8, marginBottom: 6, border: `1px solid ${C.red}22` }}>
              <input type="checkbox" checked={false} onChange={() => toggleDone(r.id)} style={{ accentColor: C.red }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.red }}>{r.note}</div>
                <div style={{ fontSize: 10, color: C.red + 'AA' }}>⚠️ Overdue — {new Date(r.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
              </div>
              <button onClick={() => removeReminder(r.id)} style={{ background: 'none', border: 'none', color: C.sub, cursor: 'pointer', fontSize: 14 }}>✕</button>
            </div>
          ))}
          {/* Upcoming */}
          {upcoming.map(r => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: C.faint, borderRadius: 8, marginBottom: 6 }}>
              <input type="checkbox" checked={false} onChange={() => toggleDone(r.id)} style={{ accentColor: C.accent }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{r.note}</div>
                <div style={{ fontSize: 10, color: C.sub }}>{new Date(r.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</div>
              </div>
              <button onClick={() => removeReminder(r.id)} style={{ background: 'none', border: 'none', color: C.sub, cursor: 'pointer', fontSize: 14 }}>✕</button>
            </div>
          ))}
          {/* Completed */}
          {completed.length > 0 && (
            <div style={{ marginTop: 6 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: C.sub, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Completed</div>
              {completed.map(r => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', opacity: 0.5, marginBottom: 4 }}>
                  <input type="checkbox" checked={true} onChange={() => toggleDone(r.id)} style={{ accentColor: C.green }} />
                  <span style={{ fontSize: 11, color: C.sub, textDecoration: 'line-through', flex: 1 }}>{r.note}</span>
                  <button onClick={() => removeReminder(r.id)} style={{ background: 'none', border: 'none', color: C.sub, cursor: 'pointer', fontSize: 14 }}>✕</button>
                </div>
              ))}
            </div>
          )}

          {/* Add new */}
          {adding ? (
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} style={{ padding: '6px 10px', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 12, fontFamily: 'Montserrat,sans-serif' }} />
              <input value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Reminder note..." onKeyDown={e => e.key === 'Enter' && addReminder()} style={{ flex: 1, minWidth: 140, padding: '6px 10px', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 12, fontFamily: 'Montserrat,sans-serif' }} />
              <Btn onClick={addReminder} small>Save</Btn>
              <Btn onClick={() => { setAdding(false); setNewDate(''); setNewNote('') }} small outline color={C.sub}>Cancel</Btn>
            </div>
          ) : (
            <button onClick={() => setAdding(true)} style={{ marginTop: 6, padding: '6px 14px', borderRadius: 8, border: `1.5px dashed ${C.accent}44`, background: 'transparent', color: C.accent, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif' }}>
              + Add Reminder
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── CLIENT NOTES ──────────────────────────────────────────────────────────────
function ClientNotes({ client, onUpdate }) {
  const intake = (() => { try { return JSON.parse(client.trainerNotes || '{}') } catch { return {} } })()
  const [notes, setNotes] = useState(intake.clientNotes || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const notesTimer = useRef(null)
  const notesRef = useRef(notes)
  useEffect(() => { notesRef.current = notes }, [notes])

  const save = async (value) => {
    setSaving(true)
    try {
      const latest = (() => { try { return JSON.parse(client.trainerNotes || '{}') } catch { return {} } })()
      const updated = { ...latest, clientNotes: value }
      const updatedClient = { ...client, trainerNotes: JSON.stringify(updated) }
      await saveClient(updatedClient)
      onUpdate(updatedClient)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) { console.error('Error saving notes:', e.message) }
    setSaving(false)
  }

  const handleChange = (value) => {
    setNotes(value)
    setSaved(false)
    if (notesTimer.current) clearTimeout(notesTimer.current)
    notesTimer.current = setTimeout(() => save(notesRef.current), 1500)
  }

  return (
    <div style={{ background: C.card, border: `1.5px solid ${C.border}`, borderRadius: 14, padding: '16px 20px', marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: C.accent, textTransform: 'uppercase' }}>📝 Client Notes</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, color: saving ? C.sub : saved ? C.green : C.sub, fontWeight: saving || saved ? 700 : 400 }}>
            {saving ? 'Saving…' : saved ? '✓ Saved' : `${notes.length.toLocaleString()} chars`}
          </span>
        </div>
      </div>
      <textarea
        value={notes}
        onChange={e => handleChange(e.target.value)}
        onBlur={() => save(notes)}
        rows={6}
        placeholder={`Running notes for ${client.name}...\n\nUse this for session observations, progress notes, behavioral patterns, outside source references, or anything you want the AI to always know about this client.`}
        style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12, fontFamily: 'Montserrat,sans-serif', color: C.text, background: C.faint, resize: 'vertical', outline: 'none', boxSizing: 'border-box', lineHeight: 1.7 }}
      />
      <div style={{ fontSize: 10, color: C.sub, marginTop: 6 }}>Autosaves as you type · Always sent to AI</div>
    </div>
  )
}

// ── AI CHATBOX ────────────────────────────────────────────────────────────────
function AIChatBox({ client }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [clientData, setClientData] = useState(null)
  const chatEndRef = useRef(null)

  // Load ALL client data when chat opens
  useEffect(() => {
    if (!open || !client?.id) return
    let cancelled = false
    ;(async () => {
      try {
        const [workouts, weightLogs, program] = await Promise.all([
          getWorkoutsForClient(client.id).catch(() => []),
          getWeightLogsForClient(client.id).catch(() => []),
          getProgramForClient(client.id).catch(() => null),
        ])
        if (!cancelled) setClientData({ workouts, weightLogs, program })
      } catch {}
    })()
    return () => { cancelled = true }
  }, [open, client?.id])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Build FULL context about the client
  const getClientContext = () => {
    let ctx = `CLIENT PROFILE:\nName: ${client.name}\nGoal: ${client.goal || 'Not set'}\n`
    if (client.dob) ctx += `DOB: ${client.dob}\n`
    if (client.equipment) ctx += `Equipment: ${client.equipment}\n`

    // Full intake data
    let intake = null
    try { intake = JSON.parse(client.trainerNotes || '{}') } catch {}
    if (intake) {
      ctx += '\nINTAKE FORM:\n'
      const fields = [
        ['Phone', intake.phone], ['Email', intake.email], ['Gender', intake.gender],
        ['Occupation', intake.occupation], ['Fitness Level', intake.fitness_experience],
        ['Activity Level', intake.activity_level],
        ['Short-term Goals', intake.short_term_goals], ['Long-term Goals', intake.long_term_goals],
        ['Medications', intake.medication_list], ['Conditions', intake.pre_existing_conditions],
        ['Surgery', intake.surgery_description], ['Sleep', intake.sleep_hours],
        ['Stress', intake.stress_rating ? `${intake.stress_rating}/10` : ''],
        ['Nutrition', intake.nutrition_rating ? `${intake.nutrition_rating}/10` : ''],
        ['Diet', intake.diet_description], ['Mental Health', intake.mental_health_challenges],
        ['Commitment', intake.commitment_rating ? `${intake.commitment_rating}/10` : ''],
        ['Motivation', intake.motivation], ['Training Methods', intake.training_methods],
        ['Preferred Days', intake.preferred_days], ['Preferred Times', intake.preferred_times],
      ]
      fields.forEach(([k, v]) => { if (v) ctx += `  ${k}: ${Array.isArray(v) ? v.join(', ') : v}\n` })

      // Pain areas
      const painAreas = ['foot', 'knee', 'hip', 'back', 'shoulder', 'neck', 'migraines']
      painAreas.forEach(area => {
        const val = intake[`pain_${area}`]
        if (val === 'Yes') ctx += `  ${area} pain: Yes (${intake[`pain_${area}_side`] || 'unspecified side'})\n`
      })

      // Reminders
      const reminders = intake.reminders || []
      if (reminders.length > 0) {
        ctx += '\nREMINDERS:\n'
        reminders.forEach(r => ctx += `  ${r.date}: ${r.note} [${r.done ? 'done' : 'pending'}]\n`)
      }

      // Client notes — always include most recent content, oldest truncated if very long
      if (intake.clientNotes) {
        ctx += '\nCLIENT NOTES (trainer running log):\n'
        const MAX = 8000
        if (intake.clientNotes.length <= MAX) {
          ctx += intake.clientNotes + '\n'
        } else {
          ctx += '[older notes truncated]\n...' + intake.clientNotes.slice(-MAX) + '\n'
        }
      }
    }

    // Full assessment data with all test results
    const assessments = client.assessments || {}
    const doneTypes = Object.keys(assessments)
    if (doneTypes.length > 0) {
      ctx += '\nASSESSMENT RESULTS:\n'
      doneTypes.forEach(type => {
        const a = assessments[type]
        ctx += `\n  --- ${type.toUpperCase()} (completed ${a._completedAt ? new Date(a._completedAt).toLocaleDateString() : 'unknown'}) ---\n`
        Object.entries(a).forEach(([k, v]) => {
          if (k.startsWith('_')) return
          const display = typeof v === 'object' ? JSON.stringify(v) : String(v)
          ctx += `    ${k.replace(/_/g, ' ')}: ${display}\n`
        })
        if (a._summary) ctx += `    Summary: ${a._summary}\n`
      })
    }

    // Workout history
    if (clientData?.workouts?.length > 0) {
      ctx += '\nWORKOUT HISTORY (most recent first):\n'
      clientData.workouts.slice(0, 5).forEach((w, i) => {
        ctx += `\n  --- Workout ${i + 1} (${new Date(w.generated_at).toLocaleDateString()}) ---\n`
        if (w.prompt) ctx += `    Prompt: ${w.prompt}\n`
        const content = typeof w.content === 'string' ? w.content : JSON.stringify(w.content)
        ctx += `    Content: ${content.slice(0, 1500)}\n`
      })
    }

    // Weight logs
    if (clientData?.weightLogs?.length > 0) {
      ctx += '\nWEIGHT TRACKING:\n'
      clientData.weightLogs.slice(-10).forEach(l => {
        ctx += `  ${new Date(l.logged_at).toLocaleDateString()}: `
        if (l.weight) ctx += `Weight: ${l.weight}lbs `
        if (l.body_fat) ctx += `BF: ${l.body_fat}% `
        if (l.rating) ctx += `Rating: ${l.rating}/10 `
        if (l.behavior_notes) ctx += `Notes: ${l.behavior_notes}`
        ctx += '\n'
      })
    }

    // Program
    if (clientData?.program?.phases) {
      ctx += '\nPROGRAM (current):\n'
      const phases = clientData.program.phases
      const programStr = typeof phases === 'string' ? phases : JSON.stringify(phases)
      ctx += `  ${programStr.slice(0, 2000)}\n`
    }

    return ctx
  }

  const send = async () => {
    if (!input.trim() || loading) return
    const userMsg = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setLoading(true)
    try {
      const clientCtx = getClientContext()
      const systemPrompt = `You are FreddyFit AI, an expert personal training assistant. You have COMPLETE access to all of this client's data including intake forms, assessment test results, workout history, weight logs, program details, and reminders.\n\nHere is everything on file:\n\n${clientCtx}\n\nAnswer any question about this client with specific data from their records. Reference actual test results, scores, and dates when relevant. Be concise and practical. If the trainer asks about assessments, cite the specific test answers. If asked about progress, reference weight logs and assessment history.`
      const chatHistory = [...messages, { role: 'user', content: userMsg }].slice(-10)
      const text = await callClaude([
        { role: 'user', content: systemPrompt + '\n\nConversation:\n' + chatHistory.map(m => `${m.role === 'user' ? 'Trainer' : 'AI'}: ${m.content}`).join('\n') + '\n\nAI:' }
      ], 2000)
      setMessages(prev => [...prev, { role: 'assistant', content: text }])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error: ' + err.message }])
    }
    setLoading(false)
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{
        position: 'fixed', bottom: 20, right: 16, zIndex: 9999,
        width: 52, height: 52, borderRadius: '50%',
        background: C.accent, border: 'none', color: '#fff',
        fontSize: 22, cursor: 'pointer',
        boxShadow: '0 4px 16px rgba(43,170,223,0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        🤖
      </button>
    )
  }

  return (
    <div style={{
      position: 'fixed', bottom: 16, right: 12, zIndex: 9999,
      width: 340, maxWidth: 'calc(100vw - 24px)', height: 460, maxHeight: 'calc(100dvh - 100px)',
      background: C.panel, borderRadius: 18,
      border: `1.5px solid ${C.border}`, boxShadow: '0 8px 40px rgba(0,0,0,0.15)',
      display: 'flex', flexDirection: 'column', fontFamily: 'Montserrat,sans-serif',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.accent + '08', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: C.accent }}>🤖 FreddyFit AI</div>
          <div style={{ fontSize: 10, color: C.sub }}>Ask about {client.name}</div>
        </div>
        <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: C.sub }}>✕</button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '30px 10px', color: C.sub, fontSize: 12 }}>
            Ask anything about {client.name} — training ideas, assessment insights, programming suggestions...
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '85%', padding: '8px 12px', borderRadius: 12,
            background: m.role === 'user' ? C.accent : C.faint,
            color: m.role === 'user' ? '#fff' : C.text,
            fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre-wrap',
          }}>
            {m.content}
          </div>
        ))}
        {loading && (
          <div style={{ alignSelf: 'flex-start', padding: '8px 12px', borderRadius: 12, background: C.faint, fontSize: 12, color: C.sub }}>
            Thinking...
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '10px 12px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 8, flexShrink: 0 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Ask about this client..."
          style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12, fontFamily: 'Montserrat,sans-serif', outline: 'none', background: C.faint }}
        />
        <button onClick={send} disabled={loading || !input.trim()} style={{
          padding: '8px 14px', borderRadius: 8, border: 'none',
          background: loading || !input.trim() ? '#CBD5E0' : C.accent,
          color: '#fff', fontWeight: 700, fontSize: 12, cursor: loading ? 'not-allowed' : 'pointer',
        }}>
          Send
        </button>
      </div>
    </div>
  )
}

// ── ASSESSMENT HISTORY MODAL ──────────────────────────────────────────────────
function AssessmentHistoryModal({ assessment, client, onClose, onNewAssessment }) {
  const history = (client.assessments?.[assessment.id]?._history || [])
  if (history.length === 0) return null

  const [compareIdx, setCompareIdx] = useState(history.length > 1 ? 1 : null)
  const latest = history[0]
  const compare = compareIdx !== null ? history[compareIdx] : null

  // Get all answer keys across both versions
  const allKeys = [...new Set([
    ...Object.keys(latest?.answers || {}),
    ...Object.keys(compare?.answers || {})
  ])].filter(k => !k.startsWith('_'))

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10001, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: C.panel, borderRadius: 18, maxWidth: 700, width: '100%', maxHeight: '85dvh', overflow: 'auto', boxShadow: '0 12px 40px rgba(0,0,0,0.2)', fontFamily: 'Montserrat,sans-serif' }}>
        {/* Header */}
        <div style={{ padding: '18px 22px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: C.panel, zIndex: 1, borderRadius: '18px 18px 0 0' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: C.text }}>{assessment.icon} {assessment.name}</div>
            <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>{history.length} version{history.length !== 1 ? 's' : ''} on file</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Btn onClick={onNewAssessment} small color={C.green}>+ New Assessment</Btn>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: C.sub }}>✕</button>
          </div>
        </div>

        {/* Version selector */}
        <div style={{ padding: '14px 22px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: C.sub, textTransform: 'uppercase', marginBottom: 8 }}>Assessment Timeline</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {history.map((h, i) => (
              <button key={i} onClick={() => i > 0 && setCompareIdx(i)} style={{
                padding: '6px 12px', borderRadius: 8,
                border: `1.5px solid ${i === 0 ? C.accent : compareIdx === i ? C.orange : C.border}`,
                background: i === 0 ? C.accent + '15' : compareIdx === i ? C.orange + '15' : 'transparent',
                color: i === 0 ? C.accent : compareIdx === i ? C.orange : C.text,
                fontWeight: 700, fontSize: 11, cursor: i === 0 ? 'default' : 'pointer',
                fontFamily: 'Montserrat,sans-serif',
              }}>
                {i === 0 ? '★ Latest' : `v${history.length - i}`} — {new Date(h.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </button>
            ))}
          </div>
        </div>

        {/* Comparison */}
        <div style={{ padding: '14px 22px' }}>
          {compare ? (
            <>
              <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                <div style={{ flex: 1, fontSize: 10, fontWeight: 700, color: C.accent, letterSpacing: 1 }}>LATEST — {new Date(latest.completedAt).toLocaleDateString()}</div>
                <div style={{ flex: 1, fontSize: 10, fontWeight: 700, color: C.orange, letterSpacing: 1 }}>PREVIOUS — {new Date(compare.completedAt).toLocaleDateString()}</div>
              </div>
              {allKeys.map(key => {
                const curr = latest.answers?.[key]
                const prev = compare.answers?.[key]
                const changed = JSON.stringify(curr) !== JSON.stringify(prev)
                const display = v => v === undefined || v === null || v === '' ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v)
                return (
                  <div key={key} style={{ display: 'flex', gap: 12, padding: '6px 0', borderBottom: `1px solid ${C.border}22`, background: changed ? C.accent + '06' : 'transparent' }}>
                    <div style={{ width: 120, fontSize: 10, fontWeight: 600, color: C.sub, flexShrink: 0, paddingTop: 2 }}>{key.replace(/_/g, ' ')}</div>
                    <div style={{ flex: 1, fontSize: 12, color: changed ? C.accent : C.text, fontWeight: changed ? 700 : 400 }}>{display(curr)}</div>
                    <div style={{ flex: 1, fontSize: 12, color: changed ? C.orange : C.sub }}>{display(prev)}</div>
                  </div>
                )
              })}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: 20, color: C.sub, fontSize: 12 }}>
              Only one version on file. Complete a new assessment to compare changes over time.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ClientProfile({ client, onUpdate, onRunAssessment, onBuildProgram, onGenerateWorkout, onProtocolAdvisor, onEditClient, onSignInSheet, onWeightTracker, onSubscription, onBloodWork, onBack, allClients = [], onSwitchClient }) {
  const assessmentsDone = Object.keys(client.assessments || {})
  const [showIntake, setShowIntake] = useState(false)
  const [showLinkMenu, setShowLinkMenu] = useState(false)
  const [historyAssessment, setHistoryAssessment] = useState(null)

  // Parse intake data from trainerNotes JSON
  const intake = (() => {
    if (!client.trainerNotes) return null
    try { return JSON.parse(client.trainerNotes) } catch { return null }
  })()

  // Linked clients
  const linkedIds = intake?.linked_clients || []
  const linkedClients = allClients.filter(c => linkedIds.includes(c.id))
  const availableToLink = allClients.filter(c => c.id !== client.id && !linkedIds.includes(c.id))

  const linkClient = async (targetId) => {
    const base = intake || {}
    const myLinked = [...(base.linked_clients || []), targetId]
    const updatedNotes = JSON.stringify({ ...base, linked_clients: myLinked })
    const updatedClient = { ...client, trainerNotes: updatedNotes }
    await saveClient(updatedClient)
    onUpdate(updatedClient)

    // Also link back: add this client's id to target's linked_clients
    const target = allClients.find(c => c.id === targetId)
    if (target) {
      let targetData = {}
      try { targetData = JSON.parse(target.trainerNotes || '{}') } catch {}
      const targetLinked = [...(targetData.linked_clients || []), client.id]
      const targetNotes = JSON.stringify({ ...targetData, linked_clients: targetLinked })
      await saveClient({ ...target, trainerNotes: targetNotes })
    }
    setShowLinkMenu(false)
  }

  const unlinkClient = async (targetId) => {
    if (!confirm('Unlink this client?')) return
    const base = intake || {}
    const myLinked = (base.linked_clients || []).filter(id => id !== targetId)
    const updatedNotes = JSON.stringify({ ...base, linked_clients: myLinked })
    const updatedClient = { ...client, trainerNotes: updatedNotes }
    await saveClient(updatedClient)
    onUpdate(updatedClient)

    // Remove back-link
    const target = allClients.find(c => c.id === targetId)
    if (target) {
      let targetData = {}
      try { targetData = JSON.parse(target.trainerNotes || '{}') } catch {}
      const targetLinked = (targetData.linked_clients || []).filter(id => id !== client.id)
      const targetNotes = JSON.stringify({ ...targetData, linked_clients: targetLinked })
      await saveClient({ ...target, trainerNotes: targetNotes })
    }
  }

  const lastWeighIn = intake?.last_weigh_in || ''
  const weighInterval = intake?.weigh_interval || 7

  const saveWeighIn = async (date, interval) => {
    const base = intake || {}
    const updatedNotes = JSON.stringify({ ...base, last_weigh_in: date, weigh_interval: interval })
    const updatedClient = { ...client, trainerNotes: updatedNotes }
    await saveClient(updatedClient)
    onUpdate(updatedClient)
  }

  const nextWeighInDate = (() => {
    if (!lastWeighIn) return null
    const d = new Date(lastWeighIn)
    d.setDate(d.getDate() + Number(weighInterval))
    return d
  })()

  const weighCountdown = (() => {
    if (!nextWeighInDate) return null
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const next = new Date(nextWeighInDate)
    next.setHours(0, 0, 0, 0)
    return Math.ceil((next - today) / (1000 * 60 * 60 * 24))
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

      {/* Linked client switcher */}
      {(linkedClients.length > 0 || availableToLink.length > 0) && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16, padding: '10px 14px', background: C.faint, borderRadius: 10, border: `1px solid ${C.border}` }}>
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: C.sub, textTransform: 'uppercase' }}>Switch:</span>
          <div style={{ padding: '5px 12px', borderRadius: 8, background: C.accent + '15', border: `1.5px solid ${C.accent}`, fontSize: 12, fontWeight: 700, color: C.accent, fontFamily: 'Montserrat,sans-serif' }}>
            {client.name}
          </div>
          {linkedClients.map(lc => (
            <div key={lc.id} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <button onClick={() => onSwitchClient(lc)} style={{ padding: '5px 12px', borderRadius: 8, background: 'transparent', border: `1.5px solid ${C.border}`, fontSize: 12, fontWeight: 700, color: C.text, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif', transition: 'border-color .15s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = C.accent}
                onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
                {lc.name}
              </button>
              <button onClick={() => unlinkClient(lc.id)} style={{ background: 'none', border: 'none', color: C.red + '88', fontSize: 13, cursor: 'pointer', padding: '0 2px', lineHeight: 1 }} title="Unlink">×</button>
            </div>
          ))}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowLinkMenu(!showLinkMenu)} style={{ padding: '4px 10px', borderRadius: 7, border: `1.5px dashed ${C.accent}44`, background: 'transparent', color: C.accent, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif' }}>
              + Link Client
            </button>
            {showLinkMenu && availableToLink.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 100, minWidth: 180, maxHeight: 200, overflowY: 'auto' }}>
                {availableToLink.map(ac => (
                  <button key={ac.id} onClick={() => linkClient(ac.id)} style={{ display: 'block', width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: `1px solid ${C.border}22`, fontSize: 12, fontWeight: 600, color: C.text, cursor: 'pointer', textAlign: 'left', fontFamily: 'Montserrat,sans-serif' }}
                    onMouseEnter={e => e.currentTarget.style.background = C.faint}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    {ac.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 30, letterSpacing: 4, color: C.text }}>{client.name}</div>
          {client.goal && <div style={{ fontSize: 13, color: C.sub, marginTop: 4 }}>Goal: {client.goal}</div>}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Btn onClick={() => onBloodWork(client)} small color={C.red}>🩸 Blood Work</Btn>
          <Btn onClick={() => onWeightTracker(client)} small color={C.teal}>⚖️ Weight</Btn>
          <Btn onClick={() => onSubscription(client)} small color={C.indigo}>📅 Subscription</Btn>
          <Btn onClick={() => onSignInSheet(client)} small color={C.green}>📋 Sign-In Sheet</Btn>
          <Btn onClick={() => onProtocolAdvisor(client)} small color={C.orange}>🩺 Protocols</Btn>
          <Btn onClick={() => onGenerateWorkout(client)} small>💪 Workout</Btn>
          <Btn onClick={() => onBuildProgram(client)} small>📋 Program</Btn>
          <Btn onClick={() => onEditClient(client)} outline small color={C.sub}>✏️ Edit</Btn>
        </div>
      </div>

      {/* Weigh-In Countdown */}
      <div style={{ background: C.faint, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, color: C.sub, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>⚖️ Next Weigh-In</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flex: 1 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: C.sub, letterSpacing: 1, textTransform: 'uppercase' }}>Last Weigh-In</span>
            <input type="date" value={lastWeighIn} onChange={e => saveWeighIn(e.target.value, weighInterval)}
              style={{ fontSize: 12, fontWeight: 700, border: `1.5px solid ${C.border}`, borderRadius: 7, padding: '5px 10px', background: '#fff', color: C.text, fontFamily: 'Montserrat,sans-serif', cursor: 'pointer' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: C.sub, letterSpacing: 1, textTransform: 'uppercase' }}>Interval</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {[7, 14, 30].map(d => (
                <button key={d} onClick={() => saveWeighIn(lastWeighIn, d)}
                  style={{ padding: '5px 12px', borderRadius: 7, border: `1.5px solid ${weighInterval === d ? C.teal : C.border}`, background: weighInterval === d ? C.teal + '18' : '#fff', color: weighInterval === d ? C.teal : C.sub, fontWeight: 800, fontSize: 11, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif' }}>
                  {d}d
                </button>
              ))}
            </div>
          </div>
        </div>
        {nextWeighInDate && (
          <div style={{ textAlign: 'center', minWidth: 90 }}>
            <div style={{ fontSize: weighCountdown === 0 ? 22 : 28, fontWeight: 900, color: weighCountdown < 0 ? C.red : weighCountdown <= 2 ? C.orange : C.teal, fontFamily: 'Montserrat,sans-serif', lineHeight: 1 }}>
              {weighCountdown === 0 ? 'TODAY' : weighCountdown < 0 ? `${Math.abs(weighCountdown)}d LATE` : `${weighCountdown}d`}
            </div>
            <div style={{ fontSize: 9, fontWeight: 700, color: C.sub, letterSpacing: 1, textTransform: 'uppercase', marginTop: 2 }}>
              {weighCountdown === 0 ? 'Weigh in today!' : weighCountdown < 0 ? 'Overdue' : 'Until Next'}
            </div>
            <div style={{ fontSize: 10, color: C.sub, marginTop: 2 }}>
              {nextWeighInDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </div>
          </div>
        )}
        {!nextWeighInDate && (
          <div style={{ fontSize: 11, color: C.sub, fontStyle: 'italic' }}>Set last weigh-in date to start countdown</div>
        )}
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
                {(intake.source || intake.intake_notes || intake.consultation_notes) && (
                  <Section title="CRM Intake (from Lead)" items={[
                    ['Source', intake.source],
                    ['Intake Notes', intake.intake_notes],
                    ['Consultation Notes', intake.consultation_notes],
                  ]} />
                )}
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

      {/* Client Reminders */}
      <ClientReminders client={client} onUpdate={onUpdate} />

      {/* Client Notes */}
      <ClientNotes client={client} onUpdate={onUpdate} />

      {/* Program Uploads */}
      <ProgramUploads key={client.id} client={client} onUpdate={onUpdate} />

      {FLOW.map(group => {
        const locked = group.requires && !group.requires.every(id => assessmentsDone.includes(id))
        const renderCards = (items) => (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {items.map(a => {
              const done = assessmentsDone.includes(a.id)
              const historyCount = client.assessments?.[a.id]?._history?.length || 0
              const completedAt = client.assessments?.[a.id]?._completedAt
              return (
                <div key={a.id} style={{ minWidth: 160, flex: '1 1 160px', maxWidth: 220 }}>
                  <button onClick={() => !locked && onRunAssessment(a, client)} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: `2px solid ${done ? a.color : C.border}`, background: done ? a.color + '12' : C.card, cursor: locked ? 'not-allowed' : 'pointer', textAlign: 'left', opacity: locked ? 0.45 : 1 }}>
                    <div style={{ fontSize: 18, marginBottom: 4 }}>{a.icon}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: done ? a.color : C.text, marginBottom: 2 }}>{a.name}</div>
                    {done && <div style={{ fontSize: 10, color: a.color, fontWeight: 600 }}>✓ Completed {completedAt ? new Date(completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</div>}
                    {!done && !locked && <div style={{ fontSize: 10, color: C.sub }}>Tap to start</div>}
                    {locked && <div style={{ fontSize: 10, color: C.sub }}>🔒 Complete Phase 1 & 2 first</div>}
                  </button>
                  {done && !locked && (
                    <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                      {historyCount > 0 && (
                        <button onClick={() => setHistoryAssessment(a)} style={{ flex: 1, padding: '4px 0', borderRadius: 6, border: `1px solid ${C.border}`, background: C.faint, color: C.sub, fontSize: 9, fontWeight: 700, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif' }}>
                          📊 History ({historyCount})
                        </button>
                      )}
                      <button onClick={() => onRunAssessment(a, client, true)} style={{ flex: 1, padding: '4px 0', borderRadius: 6, border: `1px solid ${C.green}44`, background: C.green + '08', color: C.green, fontSize: 9, fontWeight: 700, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif' }}>
                        + New
                      </button>
                    </div>
                  )}
                </div>
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

      {/* AI ChatBox */}
      <AIChatBox client={client} />

      {/* Assessment History Modal */}
      {historyAssessment && (
        <AssessmentHistoryModal
          assessment={historyAssessment}
          client={client}
          onClose={() => setHistoryAssessment(null)}
          onNewAssessment={() => { setHistoryAssessment(null); onRunAssessment(historyAssessment, client, true) }}
        />
      )}
    </div>
  )
}

// ── CLIENT ROSTER ─────────────────────────────────────────────────────────────
function ClientRoster({ onSelectClient, onNewClient, onOpenSchedule }) {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [todaySessions, setTodaySessions] = useState([])
  const [upcomingSessions, setUpcomingSessions] = useState([])

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

  useEffect(() => {
    const today = new Date()
    const todayStr = today.toISOString().slice(0, 10)
    const end = new Date(today)
    end.setDate(end.getDate() + 6)
    const endStr = end.toISOString().slice(0, 10)
    getSessions(todayStr, endStr).then(all => {
      setTodaySessions(all.filter(s => s.date === todayStr))
      setUpcomingSessions(all.filter(s => s.date > todayStr))
    }).catch(() => {})
  }, [])

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

      {/* Schedule Widget */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 20px', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, color: C.accent, textTransform: 'uppercase' }}>📅 Today's Schedule</div>
          <button onClick={onOpenSchedule} style={{ fontSize: 11, fontWeight: 700, color: C.accent, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'Montserrat,sans-serif', padding: 0 }}>View Full Calendar →</button>
        </div>
        {todaySessions.length === 0 ? (
          <div style={{ fontSize: 12, color: C.sub, fontStyle: 'italic', marginBottom: upcomingSessions.length > 0 ? 12 : 0 }}>No sessions booked today</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: upcomingSessions.length > 0 ? 14 : 0 }}>
            {todaySessions.map(s => {
              const stype = SESSION_TYPES.find(t => t.label === s.session_type) || SESSION_TYPES[0]
              return (
              <div key={s.id} onClick={onOpenSchedule} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 14px', background: C.accent + '12', borderRadius: 9, border: `1.5px solid ${C.accent}33`, cursor: 'pointer' }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: C.accent, minWidth: 44 }}>{s.time.slice(0,5)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{s.client_name}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: stype.color, marginTop: 1 }}>{s.session_type || 'FIT60'}{s.recurring ? ' 🔁' : ''}</div>
                  {s.link && (
                    <a href={s.link.startsWith('http') ? s.link : `tel:${s.link.replace(/\s/g,'')}`}
                      onClick={e => e.stopPropagation()}
                      style={{ fontSize: 10, color: C.accent, textDecoration: 'underline', display: 'block', marginTop: 1 }}>
                      {s.link}
                    </a>
                  )}
                  {s.notes && <div style={{ fontSize: 10, color: C.sub, marginTop: 1 }}>{s.notes}</div>}
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.sub }}>{s.duration}min</div>
              </div>
              )
            })}
          </div>
        )}
        {upcomingSessions.length > 0 && (
          <>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: C.sub, textTransform: 'uppercase', marginBottom: 8 }}>Coming Up</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {upcomingSessions.slice(0, 4).map(s => {
                const d = new Date(s.date + 'T00:00:00')
                const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                const stype = SESSION_TYPES.find(t => t.label === s.session_type) || SESSION_TYPES[0]
                return (
                  <div key={s.id} onClick={onOpenSchedule} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 12px', background: C.faint, borderRadius: 8, cursor: 'pointer' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.sub, minWidth: 80 }}>{label}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.sub, minWidth: 40 }}>{s.time.slice(0,5)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{s.client_name}</div>
                      <div style={{ fontSize: 9, fontWeight: 700, color: stype.color }}>{s.session_type || 'FIT60'}{s.recurring ? ' 🔁' : ''}</div>
                      {s.link && (
                        <a href={s.link.startsWith('http') ? s.link : `tel:${s.link.replace(/\s/g,'')}`}
                          onClick={e => e.stopPropagation()}
                          style={{ fontSize: 9, color: C.accent, textDecoration: 'underline', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.link}
                        </a>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: C.sub }}>{s.duration}min</div>
                  </div>
                )
              })}
            </div>
          </>
        )}
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

      {/* All Reminders Dashboard */}
      {!loading && (() => {
        const today = new Date().toISOString().split('T')[0]
        const allReminders = clients.flatMap(c => {
          let intake = null
          try { intake = JSON.parse(c.trainerNotes || c.trainer_notes || '{}') } catch {}
          const reminders = intake?.reminders || []
          return reminders.filter(r => !r.done).map(r => ({ ...r, clientName: c.name, clientId: c.id }))
        }).sort((a, b) => new Date(a.date) - new Date(b.date))
        const overdue = allReminders.filter(r => r.date < today)
        const upcoming = allReminders.filter(r => r.date >= today).slice(0, 5)
        if (allReminders.length === 0) return null
        return (
          <div style={{ background: C.card, border: `1px solid ${overdue.length > 0 ? C.red + '44' : C.accent + '33'}`, borderRadius: 14, padding: '18px 22px', marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, color: overdue.length > 0 ? C.red : C.accent, textTransform: 'uppercase', marginBottom: 14 }}>
              📌 Client Reminders {overdue.length > 0 && <span style={{ fontSize: 10, background: C.red + '18', color: C.red, borderRadius: 10, padding: '2px 8px', fontWeight: 700, marginLeft: 6 }}>{overdue.length} overdue</span>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {overdue.map(r => (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: C.red + '08', borderRadius: 8, border: `1px solid ${C.red}22` }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.red }}>{r.clientName}: {r.note}</div>
                    <div style={{ fontSize: 10, color: C.red + 'AA' }}>⚠️ Overdue — {new Date(r.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                  </div>
                </div>
              ))}
              {upcoming.map(r => (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: C.faint, borderRadius: 8 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{r.clientName}: {r.note}</div>
                    <div style={{ fontSize: 10, color: C.sub }}>{new Date(r.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {loading ? <Spinner /> : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: C.sub, fontSize: 14 }}>{clients.length === 0 ? 'No clients yet. Add your first client above.' : 'No clients match your search.'}</div>
      ) : filtered.map(c => {
        const count = Object.keys(c.assessments || {}).length
        let intake = null
        try { intake = JSON.parse(c.trainerNotes || c.trainer_notes || '{}') } catch {}
        const reminders = (intake?.reminders || []).filter(r => !r.done)
        const today = new Date().toISOString().split('T')[0]
        const overdueCount = reminders.filter(r => r.date < today).length
        const nextReminder = reminders.sort((a, b) => new Date(a.date) - new Date(b.date))[0]
        return (
          <div key={c.id} onClick={() => onSelectClient(c)} style={{ background: C.card, border: `1px solid ${overdueCount > 0 ? C.red + '44' : C.border}`, borderRadius: 12, padding: '16px 20px', marginBottom: 10, cursor: 'pointer', transition: 'border-color .15s' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = C.accent}
            onMouseLeave={e => e.currentTarget.style.borderColor = overdueCount > 0 ? C.red + '44' : C.border}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: C.text }}>{c.name}</div>
                <div style={{ fontSize: 12, color: C.sub, marginTop: 3 }}>
                  {c.goal && <span>{c.goal} · </span>}
                  <span>{count} assessment{count !== 1 ? 's' : ''} on file</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {overdueCount > 0 && <span style={{ fontSize: 10, background: C.red + '18', color: C.red, borderRadius: 10, padding: '3px 10px', fontWeight: 700 }}>⚠️ {overdueCount}</span>}
                {count > 0 && <span style={{ fontSize: 10, background: C.accent + '15', color: C.accent, borderRadius: 10, padding: '3px 10px', fontWeight: 700 }}>{count} assessments</span>}
                <button onClick={e => removeClient(c.id, e)} style={{ background: 'none', border: 'none', color: C.sub, cursor: 'pointer', fontSize: 16, padding: '4px 8px', borderRadius: 6 }}>✕</button>
              </div>
            </div>
            {/* Key info badges */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              {intake?.fitness_experience && <span style={{ fontSize: 9, background: C.accent + '10', color: C.accent, borderRadius: 8, padding: '2px 8px', fontWeight: 700 }}>{intake.fitness_experience}</span>}
              {intake?.activity_level && <span style={{ fontSize: 9, background: C.teal + '10', color: C.teal, borderRadius: 8, padding: '2px 8px', fontWeight: 700 }}>{intake.activity_level.split('(')[0].trim()}</span>}
              {intake?.pre_existing_conditions && intake.pre_existing_conditions !== 'No' && <span style={{ fontSize: 9, background: C.orange + '10', color: C.orange, borderRadius: 8, padding: '2px 8px', fontWeight: 700 }}>⚕️ Conditions</span>}
              {nextReminder && <span style={{ fontSize: 9, background: nextReminder.date < today ? C.red + '10' : C.faint, color: nextReminder.date < today ? C.red : C.sub, borderRadius: 8, padding: '2px 8px', fontWeight: 700 }}>📌 {nextReminder.note.slice(0, 25)}{nextReminder.note.length > 25 ? '...' : ''}</span>}
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
    <div style={{ minHeight: '100dvh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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

// ── CRM LEADS ────────────────────────────────────────────────────────────────

// 30-day statistically-optimized outreach sequence
// Studies: texts open 98% in 3 min, calls convert 8x better, email nurtures long-term
const OUTREACH_SEQUENCE = [
  { day: 0,  step: 1, channel: 'Text',  emoji: '💬',
    action: 'Send this message now:\n\n"Hey [Name]! This is Freddy from FreddyFit Personal Training 👋 I just received your intake form — thank you for reaching out! I\'d love to jump on a quick 10-minute call to go over your notes and get your complimentary consultation scheduled. What does your schedule look like this week? 💪"\n\nSend within the first hour — leads go cold fast.',
    why: 'Texts open 98% within 3 minutes. First contact within 1 hour increases conversion by 7x.' },
  { day: 1,  step: 2, channel: 'Text',  emoji: '💬',
    action: 'Follow-up text — they haven\'t replied yet, keep it short and easy to respond to, reference their goal again',
    why: '50% of deals go to whoever follows up first. Most people forget to reply, not ignore.' },
  { day: 3,  step: 3, channel: 'Call',  emoji: '📞',
    action: 'Phone call — texts aren\'t landing, calls convert 8x better. Reference their goal. Invite them to their complimentary consultation at FreddyFit Personal Training. Leave a voicemail if no answer.',
    why: 'Phone calls convert 8x better than texts for consultations. Try 4–6pm.' },
  { day: 5,  step: 4, channel: 'Email', emoji: '✉️',
    action: 'Warm intro email — personal tone, reference their intake answers, explain what the complimentary consultation covers, include your contact info. Subject line first.',
    why: 'Reaching on a 3rd channel catches people who missed texts/calls.' },
  { day: 7,  step: 5, channel: 'Text',  emoji: '💬',
    action: 'Check-in text — casual and low pressure, acknowledge they may be busy, ask if this week works for a quick call',
    why: '80% of sales require 5+ touchpoints. Keep showing up.' },
  { day: 10, step: 6, channel: 'Call',  emoji: '📞',
    action: 'Second call attempt — try a different time of day. If voicemail, leave a brief personalized message referencing their goal and your number',
    why: 'Call at a different hour — morning vs evening changes answer rates dramatically.' },
  { day: 14, step: 7, channel: 'Email', emoji: '✉️',
    action: 'Value email — share a specific tip directly tied to their stated goal. Soft invite at the end to book their complimentary consultation at FreddyFit Personal Training.',
    why: 'Give before you ask. Value emails have 40% higher open rates.' },
  { day: 21, step: 8, channel: 'Text',  emoji: '💬',
    action: 'Re-engagement text — acknowledge it\'s been a few weeks, ask if they\'re still looking for support, reference their goal. Zero pressure.',
    why: 'Life gets in the way. Re-engaging after a gap often catches people at a better moment.' },
  { day: 30, step: 9, channel: 'Email', emoji: '✉️',
    action: 'Final email — make it count. Warm, direct, personal. Leave on great terms. Mention the door is always open at FreddyFit Personal Training.',
    why: 'Final touchpoint before moving to Cold. Some leads convert months later because of this.' },
]

// Given a lead, calculate which step to show and its status
function getOutreachStep(lead) {
  if (lead.status === 'Client' || lead.status === 'Cold') return null
  const dateAdded = lead.date_added ? new Date(lead.date_added + 'T00:00:00') : null
  if (!dateAdded) return null

  const today = new Date()
  const daysSinceAdded = Math.floor((today - dateAdded) / 86400000)

  // Which step was last completed — inferred from last_contact_date
  let completedUpToDay = -1
  if (lead.last_contact_date) {
    const lastContact = new Date(lead.last_contact_date + 'T00:00:00')
    const daysAtContact = Math.floor((lastContact - dateAdded) / 86400000)
    for (const s of OUTREACH_SEQUENCE) {
      if (s.day <= daysAtContact) completedUpToDay = s.day
    }
  }

  // Find the next step to do (first uncompleted step)
  const nextStep = OUTREACH_SEQUENCE.find(s => s.day > completedUpToDay)

  if (!nextStep) {
    // All 9 steps completed
    return { channel: 'Cold', emoji: '🥶', step: 10, day: daysSinceAdded, isComplete: true,
      label: '✅ All 9 steps done', action: 'You\'ve done everything. Mark Cold or archive.', why: '', isDue: true, isOverdue: false }
  }

  if (daysSinceAdded > 30 && completedUpToDay < 0) {
    return { channel: 'Cold', emoji: '🥶', step: 0, day: daysSinceAdded, isComplete: false,
      label: `Day ${daysSinceAdded} — 30-day window passed`, action: 'Consider marking Cold. If you restart, set last_contact_date to today.', why: '', isDue: true, isOverdue: true }
  }

  const isDue = nextStep.day <= daysSinceAdded
  const daysOverdue = isDue ? daysSinceAdded - nextStep.day : 0
  const daysUntil = isDue ? 0 : nextStep.day - daysSinceAdded

  return {
    channel: nextStep.channel,
    emoji: nextStep.emoji,
    step: nextStep.step,
    day: nextStep.day,
    daysSinceAdded,
    action: nextStep.action,
    why: nextStep.why,
    isDue,
    isOverdue: daysOverdue > 0,
    daysOverdue,
    daysUntil,
    label: isDue
      ? (daysOverdue > 0 ? `Day ${nextStep.day + 1} — ${nextStep.channel} (${daysOverdue}d overdue)` : `Day ${nextStep.day + 1} — ${nextStep.channel} due TODAY`)
      : `Day ${nextStep.day + 1} — ${nextStep.channel} in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}`,
    progress: Math.min(Math.round((daysSinceAdded / 30) * 100), 100),
    completedSteps: OUTREACH_SEQUENCE.filter(s => s.day <= completedUpToDay).length,
  }
}

function getStageInfo(lead) {
  // Alias used by bossCount — returns step only when action is due
  const step = getOutreachStep(lead)
  return (step && step.isDue) ? step : null
}

const CHANNEL_COLORS = {
  Text:  { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  Call:  { bg: '#FFF7ED', text: '#C05621', border: '#FED7AA' },
  Email: { bg: '#F0FDF4', text: '#166534', border: '#BBF7D0' },
  Cold:  { bg: '#F9FAFB', text: '#6B7280', border: '#E5E7EB' },
}

const LEAD_STATUSES = ['New Lead','Contacted','Follow Up','Booked','Client','Cold']
const LEAD_STATUS_COLORS = {
  'New Lead':   { bg: C.accent + '18', text: C.accent, border: C.accent + '44' },
  'Contacted':  { bg: C.orange + '18', text: C.orange, border: C.orange + '44' },
  'Follow Up':  { bg: '#8B5CF6' + '18', text: '#8B5CF6', border: '#8B5CF6' + '44' },
  'Booked':     { bg: C.lime + '18',   text: C.lime,   border: C.lime + '44' },
  'Client':     { bg: C.green + '18',  text: C.green,  border: C.green + '44' },
  'Cold':       { bg: C.border,        text: C.sub,    border: C.border },
}
const LEAD_SOURCES = ['Instagram', 'Facebook', 'Referral', 'Walk-in', 'Website', 'Email', 'Zapier / Email', 'Other']

// Lead notes are stored as JSON: { intake_notes, booked_consultation, committed_package }
// Old plain-text notes are treated as intake_notes
function parseLeadNotes(raw) {
  if (!raw) return { intake_notes: '', booked_consultation: false, committed_package: false }
  try {
    const p = JSON.parse(raw)
    if (p && typeof p === 'object' && !Array.isArray(p)) {
      return { intake_notes: p.intake_notes || '', booked_consultation: !!p.booked_consultation, committed_package: !!p.committed_package }
    }
  } catch {}
  return { intake_notes: raw, booked_consultation: false, committed_package: false }
}
function packLeadNotes(intake_notes, booked_consultation, committed_package) {
  return JSON.stringify({ intake_notes: intake_notes || '', booked_consultation: !!booked_consultation, committed_package: !!committed_package })
}

function AiCoachModal({ lead, onClose, stepOverride }) {
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const step = stepOverride || getOutreachStep(lead) || OUTREACH_SEQUENCE[0]
  const chCol = CHANNEL_COLORS[step.channel] || CHANNEL_COLORS.Text

  const generate = async () => {
    setLoading(true)
    setMsg('')
    try {
      const channelFormat = step.channel === 'Text'
        ? `TEXT MESSAGE RULES:\n- 2-3 sentences max, conversational tone\n- Reference their specific goal or barrier by name\n- Sign off: "— Freddy | FreddyFit Personal Training"\n- No excessive emojis`
        : step.channel === 'Call'
        ? `PHONE CALL SCRIPT (30 seconds spoken):\n- Opening: "Hi [Name], this is Freddy with FreddyFit Personal Training..."\n- Middle: Reference their specific goal (1 sentence)\n- Invite them to their complimentary in-person consultation at FreddyFit Personal Training\n- Closing: Leave your number if voicemail\n- Natural conversational language`
        : `EMAIL FORMAT:\n- Subject line first (starting with "Subject:")\n- Professional warm tone, like a real person not a marketing blast\n- Reference something specific from their intake\n- Mention FreddyFit Personal Training's complimentary consultation\n- Sign off: "Warm regards,\\nFreddy\\nFreddyFit Personal Training\\n6047 Telegraph Rd, Saint Louis, MO 63123\\n314-584-9389"`

      const prompt = `You are writing on behalf of Freddy at FreddyFit Personal Training in Saint Louis, MO (6047 Telegraph Rd).

Generate a personalized outreach message. Use the lead's actual intake data to make it feel personal.

LEAD:
Name: ${lead.name}
Goal: ${lead.goal || 'Not specified'}
Phone: ${lead.phone || 'N/A'}
Intake notes: ${parseLeadNotes(lead.notes).intake_notes || 'None'}

SEQUENCE CONTEXT:
This is Step ${step.step} of 9 in the 30-day follow-up (Day ${step.day + 1}).
What this message should accomplish: ${step.action}

${channelFormat}

Output only the message. Nothing else.`
      const result = await callClaude([{ role: 'user', content: prompt }], 500)
      setMsg(result)
    } catch (e) { setMsg('Error generating message. Please try again.') }
    setLoading(false)
  }

  const copy = () => {
    navigator.clipboard.writeText(msg).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 560, padding: '24px 24px 36px', maxHeight: '80vh', overflowY: 'auto', fontFamily: 'Montserrat,sans-serif' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: C.text }}>🤖 AI {step.channel} Message</div>
            <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>{lead.name} — Step {step.step}/9 · Day {(step.day || 0) + 1}/30</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: C.sub }}>×</button>
        </div>

        <div style={{ background: chCol.bg, border: `1.5px solid ${chCol.border}`, borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
          <div style={{ fontWeight: 800, fontSize: 12, color: chCol.text }}>{step.emoji} {step.channel.toUpperCase()} — Step {step.step} of 9</div>
          <div style={{ fontSize: 11, color: chCol.text, marginTop: 4, lineHeight: 1.5, opacity: 0.85 }}>{step.why}</div>
        </div>

        <Btn onClick={generate} disabled={loading} style={{ width: '100%', marginBottom: 14 }}>
          {loading ? '✨ Writing…' : msg ? '↺ Regenerate' : '✨ Generate Message'}
        </Btn>

        {msg && (
          <div style={{ background: C.faint, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 16px', marginBottom: 12 }}>
            <div style={{ fontSize: 13, color: C.text, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{msg}</div>
          </div>
        )}

        {msg && (
          <button onClick={copy} style={{ width: '100%', padding: '12px', borderRadius: 10, border: `1.5px solid ${copied ? C.green : C.border}`, background: copied ? C.green + '18' : 'transparent', color: copied ? C.green : C.sub, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
            {copied ? '✓ Copied!' : '📋 Copy Message'}
          </button>
        )}
        {!msg && !loading && (
          <div style={{ fontSize: 11, color: C.sub, textAlign: 'center', marginTop: 8 }}>
            AI will write a personalized {step.channel.toLowerCase()} message for {lead.name} based on their intake.
          </div>
        )}
      </div>
    </div>
  )
}

function CrmLeads({ onBack, onNavigateToRoster }) {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name:'', phone:'', email:'', source:'', goal:'', intake_notes:'', consultation_notes:'', booked_consultation: false, committed_package: false })
  const [aiCoachLead, setAiCoachLead] = useState(null)
  const [converting, setConverting] = useState(false)
  const [advancing, setAdvancing] = useState(null)
  const [showCold, setShowCold] = useState(false)

  const today = new Date().toISOString().split('T')[0]

  const load = useCallback(async () => {
    setLoading(true)
    try { setLeads(await getAllLeads()) } catch (e) { console.error('CRM load error:', e) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const activeLeads = leads.filter(l => l.status !== 'Client' && l.status !== 'Cold')
  const coldLeads = leads.filter(l => l.status === 'Cold')

  const actionItems = activeLeads
    .map(l => ({ lead: l, step: getOutreachStep(l) }))
    .filter(({ step }) => step && step.isDue && !step.isComplete)
    .sort((a, b) => (b.step.daysOverdue || 0) - (a.step.daysOverdue || 0))

  const upcomingItems = activeLeads
    .map(l => ({ lead: l, step: getOutreachStep(l) }))
    .filter(({ step }) => step && !step.isDue && !step.isComplete)
    .sort((a, b) => (a.step.daysUntil || 0) - (b.step.daysUntil || 0))

  const markStepDone = async (lead) => {
    setAdvancing(lead.id)
    try {
      await saveLead({ ...lead, last_contact_date: today })
      await load()
    } catch (e) { alert('Error: ' + e.message) }
    setAdvancing(null)
  }

  const markCold = async (lead) => {
    if (!confirm(`Mark ${lead.name} as Cold? You can always reactivate them later.`)) return
    setAdvancing(lead.id)
    try {
      await saveLead({ ...lead, status: 'Cold', last_contact_date: today })
      await load()
    } catch (e) { alert('Error: ' + e.message) }
    setAdvancing(null)
  }

  const reactivate = async (lead) => {
    setAdvancing(lead.id)
    try {
      await saveLead({ ...lead, status: 'New Lead', last_contact_date: today })
      await load()
    } catch (e) { alert('Error: ' + e.message) }
    setAdvancing(null)
  }

  const toggleFlag = async (lead, flag) => {
    setAdvancing(lead.id)
    try {
      const parsed = parseLeadNotes(lead.notes)
      parsed[flag] = !parsed[flag]
      await saveLead({ ...lead, notes: packLeadNotes(parsed.intake_notes, parsed.booked_consultation, parsed.committed_package) })
      await load()
    } catch (e) { alert('Error: ' + e.message) }
    setAdvancing(null)
  }

  const doConvert = async (lead) => {
    const parsed = parseLeadNotes(lead.notes)
    const intakeData = {
      phone: lead.phone || '',
      email: lead.email || '',
      source: lead.source || '',
      intake_notes: parsed.intake_notes,
      consultation_notes: lead.consultation_notes || '',
    }
    const result = await saveClient({
      name: lead.name,
      goal: lead.goal || '',
      dob: '',
      equipment: '',
      trainerNotes: JSON.stringify(intakeData),
    })
    if (!result) throw new Error('Client was not created — check Supabase connection')
    await saveLead({ ...lead, status: 'Client' })
    await load()
  }

  const convertToClient = async () => {
    if (!editing || editing === 'new') return
    if (!confirm(`Convert ${editing.name} to a full client?\n\nTheir intake data, goal, phone, email and consultation notes will transfer to their client profile.`)) return
    setConverting(true)
    try {
      const updatedLead = {
        ...editing,
        ...form,
        notes: packLeadNotes(form.intake_notes, form.booked_consultation, form.committed_package),
      }
      await doConvert(updatedLead)
      setEditing(null)
      if (onNavigateToRoster) onNavigateToRoster()
    } catch (e) { alert('Error converting lead: ' + e.message) }
    setConverting(false)
  }

  const directConvert = async (lead) => {
    if (!confirm(`Convert ${lead.name} to a full client?\n\nTheir intake data, goal, phone, email and consultation notes will transfer to their client profile.`)) return
    setAdvancing(lead.id)
    try {
      await doConvert(lead)
      if (onNavigateToRoster) onNavigateToRoster()
    } catch (e) { alert('Error converting lead: ' + e.message) }
    setAdvancing(null)
  }

  const openNew = () => {
    setForm({ name:'', phone:'', email:'', source:'', goal:'', intake_notes:'', consultation_notes:'', booked_consultation: false, committed_package: false })
    setEditing('new')
  }

  const openEdit = (lead) => {
    const parsed = parseLeadNotes(lead.notes)
    setForm({
      name: lead.name || '',
      phone: lead.phone || '',
      email: lead.email || '',
      source: lead.source || '',
      goal: lead.goal || '',
      intake_notes: parsed.intake_notes,
      booked_consultation: parsed.booked_consultation,
      committed_package: parsed.committed_package,
      consultation_notes: lead.consultation_notes || '',
    })
    setEditing(lead)
  }

  const save = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const isNew = editing === 'new'
      const payload = {
        name: form.name, phone: form.phone, email: form.email, source: form.source,
        goal: form.goal, consultation_notes: form.consultation_notes,
        notes: packLeadNotes(form.intake_notes, form.booked_consultation, form.committed_package),
        status: isNew ? 'New Lead' : (editing.status || 'New Lead'),
        ...(isNew ? {} : { id: editing.id, date_added: editing.date_added, last_contact_date: editing.last_contact_date }),
      }
      await saveLead(payload)
      await load()
      setEditing(null)
    } catch (e) { alert('Error saving lead: ' + e.message) }
    setSaving(false)
  }

  const remove = async (id, e) => {
    e.stopPropagation()
    if (!confirm('Delete this lead?')) return
    await deleteLead(id)
    setLeads(ls => ls.filter(l => l.id !== id))
  }

  const filteredActive = activeLeads.filter(l => {
    const q = search.toLowerCase()
    return !q || l.name?.toLowerCase().includes(q) || l.email?.toLowerCase().includes(q) || l.phone?.includes(q)
  })

  // Toggle pill component
  const TogglePill = ({ label, active, onToggle, disabled }) => (
    <button onClick={onToggle} disabled={disabled}
      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 20, border: `1.5px solid ${active ? C.green : C.border}`, background: active ? C.green + '18' : 'transparent', color: active ? C.green : C.sub, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, fontSize: 11, cursor: disabled ? 'not-allowed' : 'pointer', transition: 'all .15s', opacity: disabled ? 0.6 : 1 }}>
      <span style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${active ? C.green : C.border}`, background: active ? C.green : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {active && <span style={{ color: '#fff', fontSize: 9, fontWeight: 900, lineHeight: 1 }}>✓</span>}
      </span>
      {label}
    </button>
  )

  // ── FORM VIEW ──
  if (editing !== null) {
    const isNew = editing === 'new'
    return (
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '0 24px 40px' }}>
        <LogoHeader />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <button onClick={() => setEditing(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: C.sub }}>←</button>
          <div style={{ fontWeight: 800, fontSize: 22, letterSpacing: 3, color: C.text }}>{isNew ? 'NEW LEAD' : 'EDIT LEAD'}</div>
        </div>

        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '24px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[
            { label: 'Name *', key: 'name', type: 'text', placeholder: 'Full name' },
            { label: 'Phone', key: 'phone', type: 'tel', placeholder: 'Phone number' },
            { label: 'Email', key: 'email', type: 'email', placeholder: 'Email address' },
            { label: 'Goal', key: 'goal', type: 'text', placeholder: 'What are they looking to achieve?' },
          ].map(({ label, key, type, placeholder }) => (
            <div key={key}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, color: C.sub, textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
              <input type={type} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} placeholder={placeholder}
                style={{ width: '100%', background: C.faint, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', fontFamily: 'Montserrat,sans-serif', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
          ))}

          <div>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, color: C.sub, textTransform: 'uppercase', marginBottom: 6 }}>How They Found You</div>
            <select value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
              style={{ width: '100%', background: C.faint, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', fontFamily: 'Montserrat,sans-serif', fontSize: 13, outline: 'none' }}>
              <option value="">Select source…</option>
              {LEAD_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Status toggles */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, color: C.sub, textTransform: 'uppercase', marginBottom: 10 }}>Progress Tracking</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <TogglePill label="📅 Booked Consultation" active={form.booked_consultation} onToggle={() => setForm(f => ({ ...f, booked_consultation: !f.booked_consultation }))} />
              <TogglePill label="💪 Committed to FunctionalFit Package" active={form.committed_package} onToggle={() => setForm(f => ({ ...f, committed_package: !f.committed_package }))} />
            </div>
          </div>

          <div>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, color: C.sub, textTransform: 'uppercase', marginBottom: 6 }}>Intake Notes</div>
            <textarea value={form.intake_notes} onChange={e => setForm(f => ({ ...f, intake_notes: e.target.value }))}
              placeholder="Intake form data, health history, barriers…" rows={3}
              style={{ width: '100%', background: C.faint, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', fontFamily: 'Montserrat,sans-serif', fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
          </div>

          <div>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, color: C.sub, textTransform: 'uppercase', marginBottom: 6 }}>📋 Consultation Notes</div>
            <textarea value={form.consultation_notes} onChange={e => setForm(f => ({ ...f, consultation_notes: e.target.value }))}
              placeholder="What did you discuss on the call? Objections, what they're really after, next steps…" rows={5}
              style={{ width: '100%', background: '#FFFBEB', border: `1px solid #F59E0B44`, borderRadius: 8, padding: '10px 14px', fontFamily: 'Montserrat,sans-serif', fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8, flexWrap: 'wrap' }}>
            <Btn outline onClick={() => setEditing(null)}>Cancel</Btn>
            {editing !== 'new' && (
              <button onClick={convertToClient} disabled={converting}
                style={{ padding: '11px 22px', borderRadius: 8, border: `1.5px solid ${C.green}`, background: C.green + '18', color: C.green, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, fontSize: 13, cursor: converting ? 'not-allowed' : 'pointer', opacity: converting ? 0.6 : 1 }}>
                {converting ? 'Converting…' : '⭐ Convert to Client'}
              </button>
            )}
            <Btn onClick={save} disabled={saving || !form.name.trim()}>{saving ? 'Saving…' : 'Save Lead'}</Btn>
          </div>
        </div>
      </div>
    )
  }

  // ── LIST VIEW ──
  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '0 24px 40px' }}>
      <LogoHeader />
      {aiCoachLead && <AiCoachModal lead={aiCoachLead} onClose={() => setAiCoachLead(null)} />}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: C.sub }}>←</button>
            <div style={{ fontWeight: 800, fontSize: 26, letterSpacing: 4, color: C.text }}>CRM LEADS</div>
          </div>
          <div style={{ fontSize: 12, color: C.sub, marginTop: 4, marginLeft: 32 }}>
            {activeLeads.length} active{coldLeads.length > 0 && ` · ${coldLeads.length} cold`}
            {actionItems.length > 0 && <span style={{ color: C.orange, marginLeft: 8, fontWeight: 700 }}>🎯 {actionItems.length} need outreach</span>}
          </div>
        </div>
        <Btn onClick={openNew}>+ New Lead</Btn>
      </div>

      {/* ── BOSS PANEL ── */}
      {!loading && actionItems.length > 0 && (
        <div style={{ background: '#FFFBEB', border: '2px solid #F59E0B', borderRadius: 14, padding: '16px 18px', marginBottom: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: '#92400E', letterSpacing: 1, marginBottom: 14 }}>
            🎯 BOSS — {actionItems.length} lead{actionItems.length !== 1 ? 's' : ''} need outreach today
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {actionItems.map(({ lead, step }) => {
              const chCol = CHANNEL_COLORS[step.channel] || CHANNEL_COLORS.Text
              const busy = advancing === lead.id
              const parsed = parseLeadNotes(lead.notes)
              return (
                <div key={lead.id} style={{ background: '#fff', border: `2px solid ${step.isOverdue ? C.red : chCol.border}`, borderRadius: 12, padding: '14px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 15, color: C.text }}>{lead.name}</div>
                      {lead.goal && <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>🎯 {lead.goal}</div>}
                      {lead.phone && <div style={{ fontSize: 11, color: C.sub, marginTop: 1 }}>📞 {lead.phone}</div>}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: step.isOverdue ? C.red : chCol.text }}>
                        {step.isOverdue ? `⚠️ ${step.daysOverdue}d overdue` : '⚡ Due today'}
                      </div>
                      <div style={{ fontSize: 10, color: C.sub, marginTop: 2 }}>Day {step.day}/30 · Step {step.step}/9</div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div style={{ display: 'flex', gap: 3, marginBottom: 10, alignItems: 'center' }}>
                    {OUTREACH_SEQUENCE.map((s) => {
                      const isDone = (step.completedSteps || 0) >= s.step
                      const isCurrent = s.step === step.step
                      return (
                        <div key={s.step} title={`Day ${s.day}: ${s.channel}`}
                          style={{ flex: 1, height: isCurrent ? 10 : 6, borderRadius: 4, background: isCurrent ? (step.isOverdue ? C.red : C.orange) : isDone ? C.green : C.border, transition: 'all .2s' }} />
                      )
                    })}
                    <span style={{ fontSize: 9, color: C.sub, flexShrink: 0, marginLeft: 4 }}>{step.progress}%</span>
                  </div>

                  {/* Action instruction */}
                  <div style={{ background: chCol.bg, border: `1.5px solid ${chCol.border}`, borderRadius: 8, padding: '9px 12px', marginBottom: 10 }}>
                    <div style={{ fontWeight: 800, fontSize: 12, color: chCol.text, marginBottom: 4 }}>{step.emoji} {step.channel.toUpperCase()} — Step {step.step} of 9 · {step.why}</div>
                    <div style={{ fontSize: 11, color: chCol.text, lineHeight: 1.6, opacity: 0.9 }}>{step.action}</div>
                  </div>

                  {/* Booked / Committed toggles */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                    <button onClick={() => toggleFlag(lead, 'booked_consultation')} disabled={busy}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 20, border: `1.5px solid ${parsed.booked_consultation ? C.green : C.border}`, background: parsed.booked_consultation ? C.green + '18' : '#fff', color: parsed.booked_consultation ? C.green : C.sub, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, fontSize: 11, cursor: busy ? 'not-allowed' : 'pointer', transition: 'all .15s' }}>
                      <span style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${parsed.booked_consultation ? C.green : C.border}`, background: parsed.booked_consultation ? C.green : 'transparent', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {parsed.booked_consultation && <span style={{ color: '#fff', fontSize: 9, fontWeight: 900 }}>✓</span>}
                      </span>
                      📅 Booked Consultation
                    </button>
                    <button onClick={() => toggleFlag(lead, 'committed_package')} disabled={busy}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 20, border: `1.5px solid ${parsed.committed_package ? C.green : C.border}`, background: parsed.committed_package ? C.green + '18' : '#fff', color: parsed.committed_package ? C.green : C.sub, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, fontSize: 11, cursor: busy ? 'not-allowed' : 'pointer', transition: 'all .15s' }}>
                      <span style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${parsed.committed_package ? C.green : C.border}`, background: parsed.committed_package ? C.green : 'transparent', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {parsed.committed_package && <span style={{ color: '#fff', fontSize: 9, fontWeight: 900 }}>✓</span>}
                      </span>
                      💪 Committed to Package
                    </button>
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button onClick={() => setAiCoachLead(lead)}
                      style={{ padding: '8px 12px', borderRadius: 8, border: `1.5px solid ${C.accent}44`, background: C.accent + '18', color: C.accent, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
                      ✨ Write {step.channel}
                    </button>
                    <button onClick={() => markStepDone(lead)} disabled={busy}
                      style={{ padding: '8px 12px', borderRadius: 8, border: `1.5px solid ${C.green}`, background: C.green + '18', color: C.green, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, fontSize: 11, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}>
                      {busy ? '…' : '✅ Mark Done'}
                    </button>
                    <button onClick={() => directConvert(lead)} disabled={busy}
                      style={{ padding: '8px 12px', borderRadius: 8, border: `1.5px solid ${C.green}`, background: C.green + '18', color: C.green, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, fontSize: 11, cursor: busy ? 'not-allowed' : 'pointer' }}>
                      ⭐ Convert to Client
                    </button>
                    <button onClick={() => markCold(lead)} disabled={busy}
                      style={{ padding: '8px 12px', borderRadius: 8, border: `1.5px solid ${C.border}`, background: 'transparent', color: C.sub, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, fontSize: 11, cursor: busy ? 'not-allowed' : 'pointer' }}>
                      🥶 Gone Cold
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Upcoming */}
      {!loading && upcomingItems.length > 0 && (
        <div style={{ background: C.faint, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 11, color: C.sub, letterSpacing: 1, marginBottom: 10 }}>📅 COMING UP</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {upcomingItems.slice(0, 6).map(({ lead, step }) => {
              const chCol = CHANNEL_COLORS[step.channel] || CHANNEL_COLORS.Text
              return (
                <div key={lead.id} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => openEdit(lead)}>
                  <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 8, background: chCol.bg, color: chCol.text, border: `1px solid ${chCol.border}`, flexShrink: 0 }}>
                    {step.emoji} {step.channel} in {step.daysUntil}d
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{lead.name}</span>
                  <span style={{ fontSize: 11, color: C.sub }}>Day {step.day}/30</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search leads…"
        style={{ width: '100%', background: C.faint, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 16px', fontFamily: 'Montserrat,sans-serif', fontSize: 14, outline: 'none', marginBottom: 14, boxSizing: 'border-box' }} />

      {/* Active lead cards */}
      {loading ? <Spinner /> : filteredActive.length === 0 && activeLeads.length === 0 ? (
        <div style={{ textAlign: 'center', color: C.sub, padding: 48, fontSize: 14 }}>No active leads — click + New Lead to add one</div>
      ) : filteredActive.length === 0 ? (
        <div style={{ textAlign: 'center', color: C.sub, padding: 24, fontSize: 14 }}>No leads match your search</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {filteredActive.map(lead => {
            const step = getOutreachStep(lead)
            const chCol = step ? (CHANNEL_COLORS[step.channel] || CHANNEL_COLORS.Text) : null
            const parsed = parseLeadNotes(lead.notes)
            const dateAdded = lead.date_added ? new Date(lead.date_added + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
            const busy = advancing === lead.id
            return (
              <div key={lead.id} style={{ background: C.card, border: `1.5px solid ${step?.isDue && step?.isOverdue ? C.red + '55' : step?.isDue ? C.orange + '55' : C.border}`, borderRadius: 14, padding: '14px 18px', position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => openEdit(lead)}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: C.text }}>{lead.name}</div>
                    {lead.goal && <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>🎯 {lead.goal}</div>}
                  </div>
                  <button onClick={e => remove(lead.id, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.sub, fontSize: 18, padding: '0 0 0 8px', lineHeight: 1 }}>×</button>
                </div>

                {/* Step indicator */}
                {step && !step.isComplete && (
                  <div style={{ display: 'flex', gap: 3, marginBottom: 8, alignItems: 'center' }}>
                    {OUTREACH_SEQUENCE.map((s) => {
                      const isDone = (step.completedSteps || 0) >= s.step
                      const isCurrent = s.step === step.step
                      return <div key={s.step} style={{ flex: 1, height: isCurrent ? 7 : 4, borderRadius: 3, background: isCurrent ? (step.isOverdue ? C.red : C.orange) : isDone ? C.green : C.border }} />
                    })}
                    <span style={{ fontSize: 9, color: C.sub, flexShrink: 0, marginLeft: 4 }}>
                      {step.isDue ? (step.isOverdue ? `${step.daysOverdue}d overdue` : 'due today') : `in ${step.daysUntil}d`}
                    </span>
                  </div>
                )}

                {/* Contact info + toggles */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', fontSize: 11, color: C.sub }}>
                  {lead.phone && <span>📞 {lead.phone}</span>}
                  {lead.email && <span>✉️ {lead.email}</span>}
                  <span style={{ color: C.faint }}>|</span>
                  <span>Added {dateAdded}</span>
                  {parsed.booked_consultation && <span style={{ color: C.green, fontWeight: 700 }}>📅 Booked</span>}
                  {parsed.committed_package && <span style={{ color: C.green, fontWeight: 700 }}>💪 Committed</span>}
                </div>

                {/* Inline due-today actions */}
                {step && step.isDue && !step.isComplete && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingTop: 8, marginTop: 6, borderTop: `1px solid ${C.border}` }}>
                    <button onClick={() => setAiCoachLead(lead)}
                      style={{ padding: '5px 10px', borderRadius: 8, border: `1.5px solid ${C.accent}44`, background: C.accent + '18', color: C.accent, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, fontSize: 10, cursor: 'pointer' }}>
                      ✨ Write {step?.channel}
                    </button>
                    <button onClick={() => markStepDone(lead)} disabled={busy}
                      style={{ padding: '5px 10px', borderRadius: 8, border: `1.5px solid ${C.green}`, background: C.green + '18', color: C.green, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, fontSize: 10, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}>
                      {busy ? '…' : '✅ Done'}
                    </button>
                    <button onClick={() => directConvert(lead)} disabled={busy}
                      style={{ padding: '5px 10px', borderRadius: 8, border: `1.5px solid ${C.green}`, background: C.green + '18', color: C.green, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, fontSize: 10, cursor: busy ? 'not-allowed' : 'pointer' }}>
                      ⭐ Convert
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Cold leads section */}
      {coldLeads.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <button onClick={() => setShowCold(v => !v)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, color: C.sub, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, fontSize: 12, marginBottom: 10, padding: 0 }}>
            🥶 {coldLeads.length} Cold Lead{coldLeads.length !== 1 ? 's' : ''} {showCold ? '▲' : '▼'}
          </button>
          {showCold && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {coldLeads.map(lead => {
                const busy = advancing === lead.id
                return (
                  <div key={lead.id} style={{ background: C.faint, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <div style={{ cursor: 'pointer' }} onClick={() => openEdit(lead)}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: C.sub }}>{lead.name}</div>
                      {lead.goal && <div style={{ fontSize: 11, color: C.sub, opacity: 0.7 }}>🎯 {lead.goal}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button onClick={() => reactivate(lead)} disabled={busy}
                        style={{ padding: '6px 12px', borderRadius: 8, border: `1.5px solid ${C.accent}`, background: C.accent + '18', color: C.accent, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, fontSize: 11, cursor: busy ? 'not-allowed' : 'pointer' }}>
                        {busy ? '…' : '↺ Reactivate'}
                      </button>
                      <button onClick={e => remove(lead.id, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.sub, fontSize: 16, padding: 0 }}>×</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── CRM BOSS PANEL (floating) ────────────────────────────────────────────────
function CrmBossPanel({ onClose, onGoToCrm }) {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [aiCoachLead, setAiCoachLead] = useState(null)
  const [busy, setBusy] = useState(null)
  const today = new Date().toISOString().split('T')[0]

  const load = () => getAllLeads().then(setLeads).catch(() => {}).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const actionItems = leads
    .map(l => ({ lead: l, step: getOutreachStep(l) }))
    .filter(({ step }) => step && step.isDue && !step.isComplete)
    .sort((a, b) => (b.step.daysOverdue || 0) - (a.step.daysOverdue || 0))

  const markDone = async (lead) => {
    setBusy(lead.id)
    try {
      await saveLead({ ...lead, last_contact_date: today })
      await load()
    } catch (e) { alert('Error: ' + e.message) }
    setBusy(null)
  }

  const markCold = async (lead) => {
    setBusy(lead.id)
    try {
      await saveLead({ ...lead, status: 'Cold', last_contact_date: today })
      await load()
    } catch (e) { alert('Error: ' + e.message) }
    setBusy(null)
  }

  const scheduleConsultation = async (lead, withCommit = false) => {
    setBusy(lead.id)
    try {
      const parsed = parseLeadNotes(lead.notes)
      parsed.booked_consultation = true
      if (withCommit) parsed.committed_package = true
      await saveLead({
        ...lead,
        last_contact_date: today,
        notes: packLeadNotes(parsed.intake_notes, parsed.booked_consultation, parsed.committed_package)
      })
      await load()
    } catch (e) { alert('Error: ' + e.message) }
    setBusy(null)
  }

  const bossConvert = async (lead) => {
    if (!confirm(`Convert ${lead.name} to a full client?\n\nTheir intake data, goal, phone, email and consultation notes will transfer to their client profile.`)) return
    setBusy(lead.id)
    try {
      const parsed = parseLeadNotes(lead.notes)
      const intakeData = { phone: lead.phone || '', email: lead.email || '', source: lead.source || '', intake_notes: parsed.intake_notes, consultation_notes: lead.consultation_notes || '' }
      const result = await saveClient({ name: lead.name, goal: lead.goal || '', dob: '', equipment: '', trainerNotes: JSON.stringify(intakeData) })
      if (!result) throw new Error('Client was not created — check Supabase connection')
      await saveLead({ ...lead, status: 'Client' })
      await load()
      if (onGoToCrm) { onClose(); onGoToCrm() }
    } catch (e) { alert('Error converting lead: ' + e.message) }
    setBusy(null)
  }

  return (
    <>
      {aiCoachLead && <AiCoachModal lead={aiCoachLead} onClose={() => setAiCoachLead(null)} />}
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 900 }} onClick={onClose} />
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: Math.min(420, (typeof window !== 'undefined' ? window.innerWidth : 420) - 16), background: '#fff', zIndex: 901, boxShadow: '-4px 0 24px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', fontFamily: 'Montserrat,sans-serif' }}>
        <div style={{ padding: '20px 20px 16px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: C.text }}>🎯 Boss Mode</div>
              <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>
                {loading ? 'Loading…' : actionItems.length === 0 ? 'All caught up!' : `${actionItems.length} lead${actionItems.length !== 1 ? 's' : ''} need outreach now`}
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: C.sub }}>×</button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 24px' }}>
          {loading ? <Spinner /> : actionItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
              <div style={{ fontWeight: 700, color: C.text, marginBottom: 6 }}>All caught up!</div>
              <div style={{ fontSize: 12, color: C.sub }}>No outreach due right now. Check back tomorrow.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {actionItems.map(({ lead, step }) => {
                const chCol = CHANNEL_COLORS[step.channel] || CHANNEL_COLORS.Text
                const isBusy = busy === lead.id
                const parsed = parseLeadNotes(lead.notes)
                return (
                  <div key={lead.id} style={{ background: C.faint, border: `2px solid ${step.isOverdue ? C.red + '66' : chCol.border}`, borderRadius: 14, padding: '14px' }}>
                    {/* Name + timing */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 15, color: C.text }}>{lead.name}</div>
                        {lead.goal && <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>🎯 {lead.goal}</div>}
                        {lead.phone && <div style={{ fontSize: 11, color: C.sub, marginTop: 1 }}>📞 {lead.phone}</div>}
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: step.isOverdue ? C.red : C.orange }}>
                          {step.isOverdue ? `⚠️ ${step.daysOverdue}d overdue` : '⚡ Due today'}
                        </div>
                        <div style={{ fontSize: 10, color: C.sub, marginTop: 2 }}>Step {step.step}/9 · Day {step.day + 1}/30</div>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div style={{ display: 'flex', gap: 2, marginBottom: 10 }}>
                      {OUTREACH_SEQUENCE.map((s) => {
                        const isDone = (step.completedSteps || 0) >= s.step
                        const isCurrent = s.step === step.step
                        return (
                          <div key={s.step} style={{ flex: 1, height: isCurrent ? 8 : 5, borderRadius: 3, background: isCurrent ? (step.isOverdue ? C.red : C.orange) : isDone ? C.green : C.border }} />
                        )
                      })}
                    </div>

                    {/* Daily task instruction */}
                    <div style={{ background: chCol.bg, border: `1px solid ${chCol.border}`, borderRadius: 8, padding: '8px 12px', marginBottom: 8 }}>
                      <div style={{ fontWeight: 800, fontSize: 12, color: chCol.text, marginBottom: 3 }}>{step.emoji} TODAY'S TASK — {step.channel.toUpperCase()}</div>
                      <div style={{ fontSize: 11, color: chCol.text, lineHeight: 1.5 }}>{step.action}</div>
                      <div style={{ fontSize: 10, color: chCol.text, opacity: 0.7, marginTop: 4, fontStyle: 'italic' }}>{step.why}</div>
                    </div>

                    {/* Status badges */}
                    {(parsed.booked_consultation || parsed.committed_package) && (
                      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                        {parsed.booked_consultation && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: C.green + '22', color: C.green, border: `1px solid ${C.green}44` }}>📅 Consultation Booked</span>}
                        {parsed.committed_package && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: C.green + '22', color: C.green, border: `1px solid ${C.green}44` }}>💪 Committed to Package</span>}
                      </div>
                    )}

                    {/* AI message button */}
                    <button onClick={() => setAiCoachLead(lead)} style={{ width: '100%', marginBottom: 8, padding: '8px 12px', borderRadius: 8, border: `1.5px solid ${C.accent}44`, background: C.accent + '12', color: C.accent, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, fontSize: 11, cursor: 'pointer', textAlign: 'left' }}>
                      ✨ Generate {step.channel} Message to Send
                    </button>

                    {/* Boss action buttons */}
                    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, color: C.sub, textTransform: 'uppercase', marginBottom: 6 }}>Did you complete today's task?</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
                      <button onClick={() => markDone(lead)} disabled={isBusy}
                        style={{ padding: '9px 8px', borderRadius: 8, border: `1.5px solid ${C.green}`, background: C.green + '18', color: C.green, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, fontSize: 11, cursor: isBusy ? 'not-allowed' : 'pointer', opacity: isBusy ? 0.6 : 1 }}>
                        {isBusy ? '…' : '✅ Yes — Done'}
                      </button>
                      <button onClick={() => markCold(lead)} disabled={isBusy}
                        style={{ padding: '9px 8px', borderRadius: 8, border: `1.5px solid ${C.red}55`, background: C.red + '0d', color: C.red, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, fontSize: 11, cursor: isBusy ? 'not-allowed' : 'pointer' }}>
                        ❌ No — Go Cold
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <button onClick={() => scheduleConsultation(lead, false)} disabled={isBusy}
                        style={{ padding: '9px 12px', borderRadius: 8, border: `1.5px solid ${C.accent}`, background: C.accent + '12', color: C.accent, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, fontSize: 11, cursor: isBusy ? 'not-allowed' : 'pointer', textAlign: 'left' }}>
                        📅 Scheduled Consultation
                      </button>
                      <button onClick={() => scheduleConsultation(lead, true)} disabled={isBusy}
                        style={{ padding: '9px 12px', borderRadius: 8, border: `1.5px solid ${C.orange}`, background: C.orange + '12', color: C.orange, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, fontSize: 11, cursor: isBusy ? 'not-allowed' : 'pointer', textAlign: 'left' }}>
                        📅💪 Scheduled Consultation + Committed to FunctionalFit
                      </button>
                      <button onClick={() => bossConvert(lead)} disabled={isBusy}
                        style={{ padding: '9px 12px', borderRadius: 8, border: `1.5px solid ${C.green}`, background: C.green + '18', color: C.green, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, fontSize: 11, cursor: isBusy ? 'not-allowed' : 'pointer', textAlign: 'left' }}>
                        ⭐ Convert to Client
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div style={{ padding: '14px 16px', borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
          <button onClick={onGoToCrm} style={{ width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: C.accent, color: '#fff', fontFamily: 'Montserrat,sans-serif', fontWeight: 800, fontSize: 12, cursor: 'pointer', letterSpacing: 1 }}>
            OPEN FULL CRM →
          </button>
        </div>
      </div>
    </>
  )
}

// ── SUBSCRIPTION TRACKER ─────────────────────────────────────────────────────
const SUB_PACKAGES = [
  { label: 'Signature', sessions: 8 },
  { label: 'Distinct', sessions: 8 },
  { label: 'Classic', sessions: 4 },
  { label: 'Signature (In-Home)', sessions: 8 },
  { label: 'Distinct (In-Home)', sessions: 6 },
  { label: 'Classic (In-Home)', sessions: 4 },
]

function SubscriptionSignaturePad({ value, onChange }) {
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
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 2.5; ctx.strokeStyle = '#1a1a2e'
    ctx.save(); ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1; ctx.setLineDash([4,4])
    ctx.beginPath(); ctx.moveTo(20, rect.height - 20); ctx.lineTo(rect.width - 20, rect.height - 20); ctx.stroke()
    ctx.restore()
    if (value) { const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height); img.src = value }
  }, [])
  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const touch = e.touches ? e.touches[0] : e
    return { x: touch.clientX - rect.left, y: touch.clientY - rect.top }
  }
  const startDraw = (e) => { e.preventDefault(); isDrawing.current = true; const ctx = canvasRef.current.getContext('2d'); ctx.setLineDash([]); ctx.strokeStyle = '#1a1a2e'; ctx.lineWidth = 2.5; const p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y) }
  const draw = (e) => { if (!isDrawing.current) return; e.preventDefault(); const ctx = canvasRef.current.getContext('2d'); const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke() }
  const endDraw = () => { if (!isDrawing.current) return; isDrawing.current = false; onChange(canvasRef.current.toDataURL()) }
  const clear = () => {
    const canvas = canvasRef.current; const ctx = canvas.getContext('2d'); const rect = canvas.getBoundingClientRect()
    ctx.clearRect(0, 0, rect.width * 2, rect.height * 2); onChange('')
    ctx.save(); ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1; ctx.setLineDash([4,4])
    ctx.scale(2,2); ctx.beginPath(); ctx.moveTo(20, rect.height - 20); ctx.lineTo(rect.width - 20, rect.height - 20); ctx.stroke(); ctx.restore()
  }
  return (
    <div>
      <canvas ref={canvasRef} style={{ width: '100%', height: 100, border: `1.5px solid ${C.border}`, borderRadius: 10, background: '#FAFAFA', touchAction: 'none', cursor: 'crosshair', display: 'block' }}
        onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
        onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw} />
      <button type="button" onClick={clear} style={{ marginTop: 6, fontSize: 10, color: C.sub, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Montserrat,sans-serif' }}>Clear</button>
    </div>
  )
}

function SubscriptionTracker({ client, onBack }) {
  const storageKey = `ff_sub_${client.id}`
  const loadSub = () => { try { return JSON.parse(localStorage.getItem(storageKey) || 'null') } catch { return null } }

  const [sub, setSub] = useState(() => loadSub())
  const [setupPkg, setSetupPkg] = useState(SUB_PACKAGES[0].label)
  const [setupDate, setSetupDate] = useState(new Date().toISOString().split('T')[0])
  const [signModal, setSignModal] = useState(null)
  const [sigDate, setSigDate] = useState(new Date().toISOString().split('T')[0])
  const [sigNotes, setSigNotes] = useState('')
  const [signature, setSignature] = useState('')
  const [showCalendar, setShowCalendar] = useState(false)
  const [calYear, setCalYear] = useState(new Date().getFullYear())
  const [calMonth, setCalMonth] = useState(new Date().getMonth())

  const saveSub = (updated) => { localStorage.setItem(storageKey, JSON.stringify(updated)); setSub(updated) }

  const getPeriodDates = (startDate, idx) => {
    const base = new Date(startDate + 'T00:00:00')
    const s = new Date(base); s.setMonth(base.getMonth() + idx)
    const e = new Date(base); e.setMonth(base.getMonth() + idx + 1); e.setDate(e.getDate() - 1)
    return { start: s, end: e }
  }
  const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  const getPeriodCap = (idx) => {
    const base = sub?.sessions || 0
    if (idx % 2 === 0) return base
    const prevUsed = (sub?.periods[idx - 1]?.sessions || []).length
    return base + Math.max(0, base - prevUsed)
  }

  const startSub = () => {
    const pkg = SUB_PACKAGES.find(p => p.label === setupPkg)
    saveSub({
      package: setupPkg,
      sessions: pkg.sessions,
      startDate: setupDate,
      periods: Array.from({ length: 6 }, () => ({ sessions: [], plans: { nutrition: false, macro: false, grocery: false } }))
    })
  }

  const resetSub = () => {
    if (!confirm('Reset this subscription? All session data will be cleared.')) return
    localStorage.removeItem(storageKey); setSub(null)
  }

  const openSignModal = (periodIdx) => {
    setSigDate(new Date().toISOString().split('T')[0]); setSigNotes(''); setSignature('')
    setSignModal(periodIdx)
  }

  const confirmSession = () => {
    if (signModal === null) return
    const updated = { ...sub, periods: sub.periods.map((p, i) => i === signModal ? { ...p, sessions: [...p.sessions, { id: makeId(), date: sigDate, notes: sigNotes, sig: signature }] } : p) }
    saveSub(updated); setSignModal(null)
  }

  const removeSession = (periodIdx, sessionIdx) => {
    if (!confirm('Remove this session?')) return
    const updated = { ...sub, periods: sub.periods.map((p, i) => i === periodIdx ? { ...p, sessions: p.sessions.filter((_, j) => j !== sessionIdx) } : p) }
    saveSub(updated)
  }

  const togglePlan = (periodIdx, key) => {
    const updated = { ...sub, periods: sub.periods.map((p, i) => i === periodIdx ? { ...p, plans: { ...p.plans, [key]: !p.plans[key] } } : p) }
    saveSub(updated)
  }

  const totalSessions = sub ? sub.periods.reduce((acc, p) => acc + p.sessions.length, 0) : 0

  // Setup screen
  if (!sub) return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '0 24px 32px', fontFamily: 'Montserrat,sans-serif' }}>
      <LogoHeader />
      <button onClick={onBack} style={{ background: 'none', border: `1px solid ${C.border}`, color: C.sub, borderRadius: 7, padding: '6px 14px', fontSize: 12, cursor: 'pointer', marginBottom: 24 }}>← Back to {client.name}</button>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: C.accent, textTransform: 'uppercase', marginBottom: 4 }}>SUBSCRIPTION TRACKER</div>
      <div style={{ fontWeight: 800, fontSize: 26, letterSpacing: 3, color: C.text, marginBottom: 24 }}>{client.name}</div>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '24px 24px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 20 }}>Set Up Coaching Subscription</div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: C.sub, letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Package</label>
          <select value={setupPkg} onChange={e => setSetupPkg(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontFamily: 'Montserrat,sans-serif', fontSize: 13, background: C.faint, color: C.text, outline: 'none' }}>
            {SUB_PACKAGES.map(p => <option key={p.label} value={p.label}>{p.label} — {p.sessions} sessions/period</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: C.sub, letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Start Date (P1 begins)</label>
          <input type="date" value={setupDate} onChange={e => setSetupDate(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontFamily: 'Montserrat,sans-serif', fontSize: 13, background: C.faint, color: C.text, outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <div style={{ background: C.faint, borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 12, color: C.sub, lineHeight: 1.6 }}>
          <strong style={{ color: C.text }}>6 monthly billing periods</strong> · Each period = 1 billing cycle (start date to next draft date) · Unused sessions from odd periods (P1, P3, P5) roll over to the following period
        </div>
        <Btn onClick={startSub}>Start Subscription →</Btn>
      </div>
    </div>
  )

  // Calendar view
  const CalendarView = () => {
    const year = calYear, month = calMonth
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const monthName = new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    const getPeriodForDate = (d) => {
      for (let i = 0; i < 6; i++) {
        const { start, end } = getPeriodDates(sub.startDate, i)
        if (d >= start && d <= end) return i
      }
      return -1
    }
    const sessionDates = new Set(sub.periods.flatMap(p => p.sessions.map(s => s.date)))
    const periodColors = ['#EF4444', '#F97316', '#EAB308', '#22C55E', '#8B5CF6', '#EC4899']
    return (
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '20px 20px', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <button onClick={() => { const d = new Date(year, month - 1); setCalYear(d.getFullYear()); setCalMonth(d.getMonth()) }} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: C.sub }}>‹</button>
          <div style={{ fontWeight: 800, fontSize: 14, color: C.text }}>{monthName}</div>
          <button onClick={() => { const d = new Date(year, month + 1); setCalYear(d.getFullYear()); setCalMonth(d.getMonth()) }} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: C.sub }}>›</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 8 }}>
          {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => <div key={d} style={{ textAlign: 'center', fontSize: 9, fontWeight: 700, color: C.sub, padding: '4px 0' }}>{d}</div>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
          {Array.from({ length: firstDay }, (_, i) => <div key={`e${i}`} />)}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1
            const d = new Date(year, month, day)
            const dateStr = d.toISOString().split('T')[0]
            const pIdx = getPeriodForDate(d)
            const hasSession = sessionDates.has(dateStr)
            const today = new Date().toISOString().split('T')[0]
            const isToday = dateStr === today
            return (
              <div key={day} style={{ textAlign: 'center', padding: '5px 2px', borderRadius: 6, fontSize: 11, fontWeight: hasSession ? 800 : 400, background: hasSession ? (pIdx >= 0 ? periodColors[pIdx] + '30' : C.faint) : pIdx >= 0 ? periodColors[pIdx] + '10' : 'transparent', color: pIdx >= 0 ? periodColors[pIdx] : C.sub, border: isToday ? `1.5px solid ${C.accent}` : '1.5px solid transparent', position: 'relative' }}>
                {day}
                {hasSession && <div style={{ width: 5, height: 5, borderRadius: '50%', background: pIdx >= 0 ? periodColors[pIdx] : C.accent, margin: '2px auto 0' }} />}
              </div>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
          {sub.periods.map((_, i) => {
            const { start, end } = getPeriodDates(sub.startDate, i)
            return <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: periodColors[i] }} />
              P{i + 1}: {fmt(start)}–{fmt(end)}
            </div>
          })}
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 24px 32px', fontFamily: 'Montserrat,sans-serif' }}>
      <LogoHeader />
      <button onClick={onBack} style={{ background: 'none', border: `1px solid ${C.border}`, color: C.sub, borderRadius: 7, padding: '6px 14px', fontSize: 12, cursor: 'pointer', marginBottom: 24 }}>← Back to {client.name}</button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: C.accent, textTransform: 'uppercase', marginBottom: 4 }}>SUBSCRIPTION TRACKER</div>
          <div style={{ fontWeight: 800, fontSize: 26, letterSpacing: 3, color: C.text }}>{client.name}</div>
          <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>{sub.package} · {sub.sessions} sessions/period · Started {fmt(new Date(sub.startDate + 'T00:00:00'))}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => setShowCalendar(!showCalendar)} style={{ padding: '7px 14px', borderRadius: 8, border: `1.5px solid ${C.border}`, background: showCalendar ? C.accent + '15' : 'transparent', color: showCalendar ? C.accent : C.sub, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif' }}>
            {showCalendar ? '📅 Hide Calendar' : '📅 Calendar'}
          </button>
          <button onClick={resetSub} style={{ padding: '7px 14px', borderRadius: 8, border: `1.5px solid ${C.red}44`, background: 'transparent', color: C.red, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif' }}>↺ Reset</button>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <div style={{ flex: '1 1 140px', background: C.accent + '10', border: `1.5px solid ${C.accent}33`, borderRadius: 12, padding: '14px 18px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.accent, letterSpacing: 1.5, textTransform: 'uppercase' }}>Total Sessions</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: C.text, marginTop: 2 }}>{totalSessions}</div>
        </div>
        <div style={{ flex: '1 1 140px', background: C.faint, border: `1.5px solid ${C.border}`, borderRadius: 12, padding: '14px 18px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.sub, letterSpacing: 1.5, textTransform: 'uppercase' }}>Package</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.text, marginTop: 2 }}>{sub.package}</div>
        </div>
        <div style={{ flex: '1 1 140px', background: C.faint, border: `1.5px solid ${C.border}`, borderRadius: 12, padding: '14px 18px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.sub, letterSpacing: 1.5, textTransform: 'uppercase' }}>Periods Done</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: C.text, marginTop: 2 }}>{sub.periods.filter(p => { return false }).length} / 6</div>
        </div>
      </div>

      {showCalendar && <CalendarView />}

      {/* Period Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        {sub.periods.map((period, pIdx) => {
          const { start, end } = getPeriodDates(sub.startDate, pIdx)
          const cap = getPeriodCap(pIdx)
          const used = period.sessions.length
          const today = new Date()
          const isActive = today >= start && today <= end
          const isDone = today > end
          const isUpcoming = today < start
          const rollover = pIdx % 2 === 1 ? Math.max(0, sub.sessions - (sub.periods[pIdx - 1]?.sessions?.length || 0)) : 0
          const periodColors = ['#EF4444', '#F97316', '#EAB308', '#22C55E', '#8B5CF6', '#EC4899']
          const color = periodColors[pIdx]
          return (
            <div key={pIdx} style={{ background: C.card, border: `1.5px solid ${isActive ? color : C.border}`, borderRadius: 14, padding: '18px 18px', opacity: isUpcoming ? 0.7 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: color }}>Period {pIdx + 1}</div>
                  <div style={{ fontSize: 10, color: C.sub, marginTop: 2 }}>{fmt(start)} – {fmt(end)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: isActive ? color : C.sub }}>
                    {isActive ? '● Active' : isDone ? '✓ Complete' : '○ Upcoming'}
                  </div>
                  {rollover > 0 && <div style={{ fontSize: 10, color: C.orange, fontWeight: 700 }}>+{rollover} rollover</div>}
                </div>
              </div>

              {/* Session slots */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.sub, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Sessions ({used}/{cap})</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {Array.from({ length: cap }, (_, i) => {
                    const session = period.sessions[i]
                    return (
                      <div key={i} style={{ position: 'relative' }}>
                        {session ? (
                          <div title={`${session.date}${session.notes ? ' — ' + session.notes : ''}`}
                            style={{ width: 32, height: 32, borderRadius: 8, background: color + '20', border: `2px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, cursor: 'pointer' }}
                            onClick={() => removeSession(pIdx, i)}>
                            ✓
                          </div>
                        ) : (
                          <div style={{ width: 32, height: 32, borderRadius: 8, border: `2px dashed ${C.border}`, background: C.faint, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: C.border }} />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Plans checklist */}
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12, marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.sub, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Plans</div>
                {[['nutrition', '🥗 Nutrition Plan'], ['macro', '📊 Macro Plan'], ['grocery', '🛒 Grocery List']].map(([key, label]) => (
                  <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, cursor: 'pointer', fontSize: 12, color: period.plans[key] ? color : C.text, fontWeight: period.plans[key] ? 700 : 400 }}>
                    <input type="checkbox" checked={!!period.plans[key]} onChange={() => togglePlan(pIdx, key)} style={{ width: 15, height: 15, accentColor: color }} />
                    {label}
                  </label>
                ))}
              </div>

              {/* Recent sessions list */}
              {period.sessions.length > 0 && (
                <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12, marginBottom: 12 }}>
                  {period.sessions.slice(-3).map((s, i) => (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 11, color: C.sub }}>
                      <span style={{ color }}>{new Date(s.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      {s.notes && <span>— {s.notes.slice(0, 40)}</span>}
                      {s.sig && <span style={{ fontSize: 9, color: C.green }}>✓ Signed</span>}
                    </div>
                  ))}
                </div>
              )}

              <button onClick={() => openSignModal(pIdx)} disabled={used >= cap}
                style={{ width: '100%', padding: '9px', borderRadius: 8, border: `1.5px solid ${used >= cap ? C.border : color}`, background: used >= cap ? C.faint : color + '12', color: used >= cap ? C.sub : color, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, fontSize: 12, cursor: used >= cap ? 'not-allowed' : 'pointer' }}>
                {used >= cap ? 'Period Full' : '+ Log Session'}
              </button>
            </div>
          )
        })}
      </div>

      {/* Sign-In Modal */}
      {signModal !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
          <div style={{ background: C.panel, borderRadius: 18, maxWidth: 480, width: '100%', padding: 28, boxShadow: '0 12px 40px rgba(0,0,0,0.2)', fontFamily: 'Montserrat,sans-serif' }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: C.text, marginBottom: 4 }}>Log Session — Period {signModal + 1}</div>
            <div style={{ fontSize: 11, color: C.sub, marginBottom: 20 }}>{client.name}</div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: C.sub, letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Session Date</label>
              <input type="date" value={sigDate} onChange={e => setSigDate(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontFamily: 'Montserrat,sans-serif', fontSize: 13, background: C.faint, color: C.text, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: C.sub, letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Notes (optional)</label>
              <input type="text" value={sigNotes} onChange={e => setSigNotes(e.target.value)} placeholder="e.g. Full body, cardio focus..." style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontFamily: 'Montserrat,sans-serif', fontSize: 13, background: C.faint, color: C.text, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: C.sub, letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Client Signature (optional)</label>
              <SubscriptionSignaturePad value={signature} onChange={setSignature} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <Btn onClick={confirmSession} color={C.green}>✓ Confirm Session</Btn>
              <Btn onClick={() => setSignModal(null)} outline color={C.sub}>Cancel</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── SCHEDULE ─────────────────────────────────────────────────────────────────

const HOURS = Array.from({ length: 14 }, (_, i) => i + 6) // 6am–7pm
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const SESSION_TYPES = [
  { label: 'FIT60',                   duration: 60,  color: '#2563EB' },
  { label: 'FIT30',                   duration: 30,  color: '#0891B2' },
  { label: 'In-Person Consultation',  duration: 60,  color: '#059669' },
  { label: 'Phone Consultation',      duration: 30,  color: '#0E7490' },
  { label: 'Video Call',              duration: 30,  color: '#7C3AED' },
  { label: 'Phone Call',              duration: 20,  color: '#D97706' },
  { label: 'Business Call',           duration: 30,  color: '#B45309', hasLink: true, linkLabel: 'Phone Number', linkPlaceholder: 'e.g. +1 (555) 000-0000' },
  { label: 'Business Meeting',        duration: 60,  color: '#1E3A5F', hasLink: true, linkLabel: 'Meeting Link', linkPlaceholder: 'e.g. https://zoom.us/j/...' },
]

function Schedule({ onBack, allClients }) {
  const today = new Date()
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date(today)
    d.setDate(d.getDate() - d.getDay())
    d.setHours(0, 0, 0, 0)
    return d
  })
  const [sessions, setSessions] = useState([])
  const [booking, setBooking] = useState(null) // { date, time } or { session } for editing
  const [form, setForm] = useState({ client_name: '', client_id: null, session_type: 'FIT60', duration: 60, notes: '', link: '' })
  const [recurring, setRecurring] = useState(false)
  const [clientSearch, setClientSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteMode, setDeleteMode] = useState(false)

  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)

  const fmt = d => d.toISOString().slice(0, 10)

  useEffect(() => {
    const load = async () => {
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)
      const [week, allRecurring] = await Promise.all([
        getSessions(fmt(weekStart), fmt(weekEnd)),
        getRecurringSessions()
      ])
      // Project recurring sessions onto current week by day-of-week
      const virtual = []
      for (const r of allRecurring) {
        const origDate = new Date(r.date + 'T12:00:00')
        if (origDate >= weekStart) continue // already in range or future, skip projection
        const dow = origDate.getDay() // 0=Sun
        const projected = new Date(weekStart)
        projected.setDate(projected.getDate() + dow)
        const projStr = fmt(projected)
        const exceptions = Array.isArray(r.exceptions) ? r.exceptions : []
        if (exceptions.includes(projStr)) continue
        const alreadyReal = week.some(s => s.date === projStr && s.time === r.time && s.client_id === r.client_id)
        if (!alreadyReal) virtual.push({ ...r, date: projStr, _virtualOf: r.id })
      }
      setSessions([...week, ...virtual].sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.time < b.time ? -1 : 1))
    }
    load().catch(console.error)
  }, [weekStart])

  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d
  })

  const prevWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d) }
  const nextWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d) }
  const goToday = () => {
    const d = new Date()
    d.setDate(d.getDate() - d.getDay())
    d.setHours(0, 0, 0, 0)
    setWeekStart(d)
  }

  const openNew = (date, hour) => {
    const time = `${String(hour).padStart(2, '0')}:00`
    setForm({ client_name: '', client_id: null, session_type: 'FIT60', duration: 60, notes: '', link: '' })
    setRecurring(false)
    setClientSearch('')
    setBooking({ date: fmt(date), time })
  }

  const openEdit = (session) => {
    // If virtual (projected recurring), find and edit the original session
    const target = session._virtualOf
      ? sessions.find(s => s.id === session._virtualOf) || session
      : session
    setForm({ client_name: target.client_name, client_id: target.client_id, session_type: target.session_type || 'FIT60', duration: target.duration, notes: target.notes || '', link: target.link || '' })
    setRecurring(target.recurring || false)
    setClientSearch(target.client_name)
    setBooking({ session: target })
  }

  const closeBooking = () => { setBooking(null); setDeleteMode(false) }

  const handleSave = async () => {
    if (!form.client_name.trim()) return
    setSaving(true)
    try {
      const payload = booking.session
        ? { ...booking.session, ...form, recurring }
        : { date: booking.date, time: booking.time, ...form, recurring }
      const saved = await saveSession(payload)
      setSessions(prev => {
        const filtered = prev.filter(s => s.id !== saved.id)
        return [...filtered, saved].sort((a, b) => a.time.localeCompare(b.time))
      })
      // Send confirmation email if client has an email on file
      const clientRecord = allClients.find(c => c.id === form.client_id)
      const clientEmail = clientRecord?.email || ''
      if (clientEmail && !booking.session) {
        fetch('/api/send-confirmation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientName: form.client_name,
            clientEmail,
            date: payload.date,
            time: payload.time,
            sessionType: form.session_type,
            notes: form.notes,
            recurring,
          })
        }).catch(() => {}) // fire-and-forget, don't block UI
      }
      closeBooking()
    } catch(e) {
      alert('Failed to save session: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteThis = async () => {
    const session = booking?.session
    if (!session) return
    if (session.recurring) {
      // Add this specific date to exceptions so it's skipped in projection
      const exceptions = Array.isArray(session.exceptions) ? session.exceptions : []
      const dateToSkip = session._virtualOf ? session.date : session.date
      if (!exceptions.includes(dateToSkip)) {
        await saveSession({ ...session, exceptions: [...exceptions, dateToSkip], id: session._virtualOf || session.id })
        setSessions(prev => prev.filter(s => !(s.date === dateToSkip && s.time === session.time && (s.id === session.id || s._virtualOf === session._virtualOf))))
      }
    } else {
      await deleteSession(session.id)
      setSessions(prev => prev.filter(s => s.id !== session.id))
    }
    closeBooking()
  }

  const handleDeleteAll = async () => {
    const session = booking?.session
    if (!session) return
    const id = session._virtualOf || session.id
    await deleteSession(id)
    setSessions(prev => prev.filter(s => s.id !== id && s._virtualOf !== id))
    closeBooking()
  }

  const sessionAt = (date, hour) => sessions.filter(s => s.date === fmt(date) && s.time.startsWith(String(hour).padStart(2, '0')))

  const filteredClients = clientSearch.length > 0
    ? allClients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase())).slice(0, 6)
    : []

  const isToday = d => fmt(d) === fmt(today)

  const monthLabel = (() => {
    const s = weekStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    const e = weekEnd.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    return s === e ? s : `${weekStart.toLocaleDateString('en-US', { month: 'short' })} – ${weekEnd.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
  })()

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 16px 32px' }}>
      <LogoHeader />
      <button onClick={onBack} style={{ background: 'none', border: `1px solid ${C.border}`, color: C.sub, borderRadius: 7, padding: '6px 14px', fontSize: 12, cursor: 'pointer', marginBottom: 20 }}>← Back</button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ fontWeight: 800, fontSize: 22, letterSpacing: 3, color: C.text }}>📅 Schedule</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={prevWeek} style={{ padding: '5px 12px', borderRadius: 7, border: `1px solid ${C.border}`, background: '#fff', color: C.text, fontSize: 14, cursor: 'pointer', fontWeight: 700 }}>‹</button>
          <button onClick={goToday} style={{ padding: '5px 14px', borderRadius: 7, border: `1px solid ${C.border}`, background: '#fff', color: C.sub, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif' }}>Today</button>
          <button onClick={nextWeek} style={{ padding: '5px 12px', borderRadius: 7, border: `1px solid ${C.border}`, background: '#fff', color: C.text, fontSize: 14, cursor: 'pointer', fontWeight: 700 }}>›</button>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginLeft: 4 }}>{monthLabel}</div>
        </div>
      </div>

      {/* Calendar grid */}
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ minWidth: 420 }}>
          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '44px repeat(7, 1fr)', borderBottom: `1px solid ${C.border}` }}>
            <div />
            {weekDates.map((d, i) => (
              <div key={i} style={{ textAlign: 'center', padding: '6px 2px', borderLeft: `1px solid ${C.border}`, minWidth: 0 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: C.sub, letterSpacing: 0.5 }}>{DAYS[i]}</div>
                <div style={{ fontSize: 15, fontWeight: 900, color: isToday(d) ? C.accent : C.text, background: isToday(d) ? C.accent + '18' : 'transparent', borderRadius: 6, width: 26, height: 26, lineHeight: '26px', margin: '2px auto 0' }}>
                  {d.getDate()}
                </div>
              </div>
            ))}
          </div>

          {/* Time rows */}
          <div style={{ maxHeight: 560, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
            {HOURS.map(hour => (
              <div key={hour} style={{ display: 'grid', gridTemplateColumns: '44px repeat(7, 1fr)', borderBottom: `1px solid ${C.border}22` }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: C.sub, padding: '10px 4px 0', textAlign: 'right' }}>
                  {hour === 12 ? '12p' : hour < 12 ? `${hour}a` : `${hour - 12}p`}
                </div>
                {weekDates.map((d, di) => {
                  const slots = sessionAt(d, hour)
                  return (
                    <div key={di} onClick={() => openNew(d, hour)}
                      style={{ borderLeft: `1px solid ${C.border}`, minHeight: 48, padding: 2, cursor: 'pointer', background: isToday(d) ? C.accent + '04' : 'transparent', transition: 'background .1s', overflow: 'hidden', minWidth: 0 }}
                      onMouseEnter={e => { if (!slots.length) e.currentTarget.style.background = C.faint }}
                      onMouseLeave={e => { e.currentTarget.style.background = isToday(d) ? C.accent + '04' : 'transparent' }}>
                      {slots.map(s => {
                        const stype = SESSION_TYPES.find(t => t.label === s.session_type) || SESSION_TYPES[0]
                        return (
                        <div key={s.id} onClick={e => { e.stopPropagation(); openEdit(s) }}
                          style={{ background: stype.color, borderRadius: 5, padding: '3px 4px', marginBottom: 2, cursor: 'pointer', overflow: 'hidden', minWidth: 0 }}>
                          <div style={{ fontSize: 10, fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.client_name || s.session_type}</div>
                          <div style={{ fontSize: 8, color: '#fff', opacity: .85, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.session_type || 'FIT60'}{s.recurring ? ' 🔁' : ''}</div>
                          {s.link && (
                            <a href={s.link.startsWith('http') ? s.link : `tel:${s.link.replace(/\s/g,'')}`}
                              onClick={e => e.stopPropagation()}
                              style={{ fontSize: 8, color: '#fff', opacity: .9, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'underline' }}>
                              {s.link}
                            </a>
                          )}
                        </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Booking modal */}
      {booking && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: 340, boxShadow: '0 8px 40px rgba(0,0,0,0.18)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: 2, color: C.text, marginBottom: 4 }}>
              {booking.session ? 'Edit Session' : 'Book Session'}
            </div>
            <div style={{ fontSize: 12, color: C.sub, marginBottom: 20 }}>
              {booking.session
                ? `${booking.session.date} at ${booking.session.time.slice(0,5)}`
                : `${booking.date} at ${booking.time}`}
            </div>

            {/* Client search */}
            <div style={{ marginBottom: 16, position: 'relative' }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: C.sub, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 5 }}>Client</div>
              <input
                value={clientSearch}
                onChange={e => { setClientSearch(e.target.value); setForm(f => ({ ...f, client_name: e.target.value, client_id: null })) }}
                placeholder="Type client name..."
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 13, fontWeight: 600, fontFamily: 'Montserrat,sans-serif', color: C.text, boxSizing: 'border-box' }}
              />
              {filteredClients.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.10)', zIndex: 10, marginTop: 2 }}>
                  {filteredClients.map(c => (
                    <button key={c.id} onClick={() => { setClientSearch(c.name); setForm(f => ({ ...f, client_name: c.name, client_id: c.id })) }}
                      style={{ display: 'block', width: '100%', padding: '9px 14px', background: 'transparent', border: 'none', borderBottom: `1px solid ${C.border}22`, fontSize: 13, fontWeight: 600, color: C.text, cursor: 'pointer', textAlign: 'left', fontFamily: 'Montserrat,sans-serif' }}
                      onMouseEnter={e => e.currentTarget.style.background = C.faint}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Session Type */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: C.sub, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 7 }}>Session Type</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {SESSION_TYPES.map(t => (
                  <button key={t.label} onClick={() => setForm(f => ({ ...f, session_type: t.label, duration: t.duration }))}
                    style={{ padding: '7px 13px', borderRadius: 7, border: `1.5px solid ${form.session_type === t.label ? t.color : C.border}`, background: form.session_type === t.label ? t.color + '18' : '#fff', color: form.session_type === t.label ? t.color : C.sub, fontWeight: 800, fontSize: 11, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif' }}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Recurring */}
            <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 8, border: `2px solid ${recurring ? C.accent : C.border}`, background: recurring ? C.accent + '15' : C.faint }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="checkbox"
                  id="recurring-toggle"
                  checked={recurring}
                  onChange={() => setRecurring(r => !r)}
                  style={{ width: 22, height: 22, cursor: 'pointer', accentColor: C.accent, flexShrink: 0 }}
                />
                <span onClick={() => setRecurring(r => !r)} style={{ fontSize: 12, fontWeight: 700, color: recurring ? C.accent : C.sub, fontFamily: 'Montserrat,sans-serif', cursor: 'pointer' }}>🔁 Recurring — repeats weekly</span>
              </div>
            </div>

            {/* Link / Phone for Business types */}
            {SESSION_TYPES.find(t => t.label === form.session_type)?.hasLink && (() => {
              const st = SESSION_TYPES.find(t => t.label === form.session_type)
              return (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: C.sub, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 5 }}>{st.linkLabel}</div>
                  <input value={form.link} onChange={e => setForm(f => ({ ...f, link: e.target.value }))}
                    placeholder={st.linkPlaceholder}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 13, fontFamily: 'Montserrat,sans-serif', color: C.text, boxSizing: 'border-box' }} />
                </div>
              )
            })()}

            {/* Notes */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: C.sub, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 5 }}>Notes (optional)</div>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                placeholder="e.g. focus on upper body, bring bands..."
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 12, fontFamily: 'Montserrat,sans-serif', resize: 'vertical', color: C.text, boxSizing: 'border-box' }} />
            </div>

            {/* Actions */}
            {deleteMode ? (
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12, textAlign: 'center' }}>What would you like to delete?</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button type="button" onClick={handleDeleteThis} style={{ padding: '11px 0', borderRadius: 8, border: `1.5px solid ${C.red}`, background: C.red + '10', color: C.red, fontWeight: 800, fontSize: 12, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif' }}>
                    Delete This Session Only
                  </button>
                  {(booking.session?.recurring || booking.session?._virtualOf) && (
                    <button type="button" onClick={handleDeleteAll} style={{ padding: '11px 0', borderRadius: 8, border: 'none', background: C.red, color: '#fff', fontWeight: 800, fontSize: 12, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif' }}>
                      Delete All Future Sessions
                    </button>
                  )}
                  <button type="button" onClick={() => setDeleteMode(false)} style={{ padding: '11px 0', borderRadius: 8, border: `1.5px solid ${C.border}`, background: '#fff', color: C.sub, fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif' }}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                {booking.session && (
                  <button type="button" onClick={() => setDeleteMode(true)} style={{ padding: '9px 14px', borderRadius: 8, border: `1.5px solid ${C.red}`, background: C.red + '10', color: C.red, fontWeight: 800, fontSize: 12, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif' }}>Delete</button>
                )}
                <button type="button" onClick={closeBooking} style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: `1.5px solid ${C.border}`, background: '#fff', color: C.sub, fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif' }}>Cancel</button>
                <button type="button" onClick={handleSave} disabled={!form.client_name.trim() || saving}
                  style={{ flex: 2, padding: '9px 0', borderRadius: 8, border: 'none', background: form.client_name.trim() ? C.accent : C.border, color: '#fff', fontWeight: 800, fontSize: 12, cursor: form.client_name.trim() ? 'pointer' : 'not-allowed', fontFamily: 'Montserrat,sans-serif' }}>
                  {saving ? 'Saving…' : booking.session ? 'Update' : 'Book'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── BLOOD WORK PANEL ─────────────────────────────────────────────────────────

const BLOOD_PANELS = [
  {
    name: 'CBC with Differential',
    color: '#DC2626',
    panelDesc: 'Evaluates your overall blood health — red cells, white cells, and platelets. Detects anemia, infection, immune issues, and hydration status.',
    markers: [
      { name: 'WBC',                  unit: 'K/µL', optimal: [3.8,10.8],  borderline: [2.5,3.8],   desc: 'White blood cells — immune defense. High = infection/inflammation. Low = immune suppression or overtraining.' },
      { name: 'RBC',                  unit: 'M/µL', optimal: [3.8,5.1],   borderline: [3.5,3.8],   desc: 'Red blood cells — oxygen transport. Low signals anemia; high may indicate dehydration or EPO use.' },
      { name: 'Hemoglobin',           unit: 'g/dL', optimal: [11.7,15.5], borderline: [10.0,11.7], desc: 'Oxygen-carrying protein in red cells. Low = anemia, fatigue, and reduced exercise capacity.' },
      { name: 'Hematocrit',           unit: '%',    optimal: [35,45],     borderline: [30,35],      desc: 'Percentage of blood made up of red cells. Key indicator of hydration and oxygen delivery capacity.' },
      { name: 'MCV',                  unit: 'fL',   optimal: [80,100],    borderline: [70,80],      desc: 'Average red cell size. Low = iron deficiency anemia. High = B12 or folate deficiency.' },
      { name: 'MCH',                  unit: 'pg',   optimal: [27,33],     borderline: [24,27],      desc: 'Average hemoglobin per red cell. Reflects iron and B12 status alongside MCV.' },
      { name: 'MCHC',                 unit: 'g/dL', optimal: [32,36],     borderline: [30,32],      desc: 'Hemoglobin concentration in red cells. Low suggests iron deficiency anemia.' },
      { name: 'RDW',                  unit: '%',    optimal: [11,15],     borderline: [15,17],      desc: 'Red cell size variation. High RDW with low MCV = iron deficiency. High RDW with high MCV = B12/folate deficiency.' },
      { name: 'Platelets',            unit: 'K/µL', optimal: [140,400],   borderline: [100,140],    desc: 'Clotting cells. Low raises bleeding risk. High raises clot risk — can follow hard training.' },
      { name: 'MPV',                  unit: 'fL',   optimal: [7.5,12.5],  borderline: [12.5,15.0],  desc: 'Mean platelet volume. High MPV with low platelets = active platelet destruction. Low MPV = bone marrow suppression.' },
      { name: 'Neutrophil Absolute',  unit: 'K/µL', optimal: [1.5,7.8],   borderline: [1.0,1.5],   desc: 'Absolute count of first-responder immune cells. High may signal bacterial infection or chronic inflammation.' },
      { name: 'Lymphocyte Absolute',  unit: 'K/µL', optimal: [0.85,3.9],  borderline: [0.5,0.85],  desc: 'Absolute count of viral fighters and memory cells. Low can indicate immune deficiency or overtraining stress.' },
      { name: 'Monocyte Absolute',    unit: 'K/µL', optimal: [0.2,0.95],  borderline: [0.95,1.5],  desc: 'Absolute count of cells that clean up debris and fight chronic infection. Elevated links to systemic inflammation.' },
      { name: 'Eosinophil Absolute',  unit: 'K/µL', optimal: [0.015,0.5], borderline: [0.5,1.5],   desc: 'Absolute count of allergy/parasite-response cells. High may indicate allergic response or inflammation.' },
      { name: 'Basophils Absolute',   unit: 'K/µL', optimal: [0.0,0.2],   borderline: [0.2,0.5],   desc: 'Absolute count of basophils involved in allergic reactions. Rarely elevated but flags allergy/mast cell issues.' },
      { name: 'Neutrophil %',         unit: '%',    optimal: [50,70],     borderline: [70,80],      desc: 'Percentage of WBC that are neutrophils. High % with high absolute count = active infection or inflammation.' },
      { name: 'Lymphocytes %',        unit: '%',    optimal: [20,40],     borderline: [15,20],      desc: 'Percentage of WBC that are lymphocytes. Low % may indicate stress response or immune suppression.' },
      { name: 'Monocyte %',           unit: '%',    optimal: [2,8],       borderline: [8,12],       desc: 'Percentage of WBC that are monocytes. Elevated with high WBC = chronic infection or inflammatory state.' },
      { name: 'Eosinophils %',        unit: '%',    optimal: [1,4],       borderline: [4,8],        desc: 'Percentage of WBC that are eosinophils. High % = allergic reaction, asthma, or parasitic infection.' },
      { name: 'Basophils %',          unit: '%',    optimal: [0,1],       borderline: [1,3],        desc: 'Percentage of WBC that are basophils. Rarely elevated — flags allergic or inflammatory conditions.' },
    ],
  },
  {
    name: 'Lipid Panel',
    color: '#F97316',
    panelDesc: 'Measures blood fats and cardiovascular risk. Directly linked to heart disease, stroke, and metabolic health — essential context for all fitness clients.',
    markers: [
      { name: 'Total Cholesterol',     unit: 'mg/dL', optimal: [0,200],  borderline: [200,239], desc: 'Overall blood fat load. High levels raise heart disease risk. Exercise and diet are primary movers.' },
      { name: 'HDL',                   unit: 'mg/dL', optimal: [50,999], borderline: [40,50],   desc: '"Good" cholesterol — clears LDL from arteries. Higher is better. Cardio exercise raises HDL.' },
      { name: 'Triglycerides',         unit: 'mg/dL', optimal: [0,150],  borderline: [150,199], desc: 'Blood fats driven by sugar and refined carb excess. High levels drive metabolic syndrome.' },
      { name: 'LDL',                   unit: 'mg/dL', optimal: [0,100],  borderline: [100,159], desc: '"Bad" cholesterol — deposits in artery walls. The primary cardiovascular risk driver.' },
      { name: 'Cholesterol/HDL Ratio', unit: 'ratio',  optimal: [0,5.0], borderline: [5.0,7.0], desc: 'Total cholesterol divided by HDL. Below 5 is ideal. High ratio = elevated cardiovascular risk.' },
      { name: 'Non-HDL',               unit: 'mg/dL', optimal: [0,130],  borderline: [130,159], desc: 'All atherogenic (artery-clogging) cholesterol combined. Better risk predictor than LDL alone.' },
      { name: 'Cholesterol/HDL Ratio',  unit: 'ratio',  optimal: [0,5.0], borderline: [5.0,7.0], desc: 'Total cholesterol divided by HDL. Below 5 is ideal. High ratio = elevated cardiovascular risk.' },
    ],
  },
  {
    name: 'Comprehensive Metabolic Panel',
    color: '#7C3AED',
    panelDesc: 'Assesses kidney function, liver health, electrolyte balance, and blood sugar. Critical for evaluating how the body handles training load and nutrition.',
    markers: [
      { name: 'Glucose',              unit: 'mg/dL', optimal: [65,99],     borderline: [100,125],  desc: 'Fasting blood sugar. Elevated = insulin resistance or pre-diabetes. Key metabolic fitness marker.' },
      { name: 'BUN',                 unit: 'mg/dL', optimal: [7,25],      borderline: [25,30],    desc: 'Kidney waste filter. High may indicate dehydration or very high protein intake post-training.' },
      { name: 'Creatinine',          unit: 'mg/dL', optimal: [0.50,1.03], borderline: [1.03,1.35],desc: 'Kidney filtration byproduct. Naturally higher in muscular athletes — context matters here.' },
      { name: 'eGFR',                unit: 'mL/min',optimal: [60,999],    borderline: [45,60],    desc: 'Estimated kidney filtration rate. Below 60 flags kidney disease risk requiring medical follow-up.' },
      { name: 'BUN/Creatinine Ratio',unit: 'ratio', optimal: [6,22],      borderline: [22,28],    desc: 'Kidney efficiency ratio. High = dehydration or muscle breakdown; low = possible liver stress.' },
      { name: 'Sodium',              unit: 'mEq/L', optimal: [135,146],   borderline: [130,135],  desc: 'Key electrolyte for hydration and nerve function. Critical to monitor in heavy-sweating athletes.' },
      { name: 'Potassium',           unit: 'mEq/L', optimal: [3.5,5.3],   borderline: [3.0,3.5],  desc: 'Heart rhythm and muscle contraction. Low = cramping and fatigue. High = cardiac arrhythmia risk.' },
      { name: 'Chloride',            unit: 'mEq/L', optimal: [98,110],    borderline: [93,98],    desc: 'Electrolyte balance partner to sodium. Reflects hydration and acid-base status.' },
      { name: 'CO2',                 unit: 'mEq/L', optimal: [20,32],     borderline: [18,20],    desc: 'Bicarbonate — measures acid-base balance. Low may indicate overbreathing or kidney issues.' },
      { name: 'Calcium',             unit: 'mg/dL', optimal: [8.6,10.4],  borderline: [8.0,8.6],  desc: 'Bone density, muscle contraction, nerve signals. Low = deficiency; high = parathyroid issue.' },
      { name: 'Total Protein',       unit: 'g/dL',  optimal: [6.1,8.1],   borderline: [5.5,6.1],  desc: 'Overall protein status. Low = malnutrition or liver stress. Key marker for muscle-building clients.' },
      { name: 'Albumin',             unit: 'g/dL',  optimal: [3.6,5.1],   borderline: [3.0,3.6],  desc: 'Main blood protein made by the liver. Low = malnutrition, inflammation, or liver dysfunction.' },
      { name: 'Globulin',            unit: 'g/dL',  optimal: [1.9,3.7],   borderline: [1.5,1.9],  desc: 'Immune proteins and transport proteins. Low = immune deficiency; high = chronic inflammation or infection.' },
      { name: 'A/G Ratio',           unit: 'ratio', optimal: [1.0,2.5],   borderline: [0.8,1.0],  desc: 'Albumin to globulin ratio. Low ratio = elevated globulins from chronic inflammation or liver stress.' },
      { name: 'Total Bilirubin',     unit: 'mg/dL', optimal: [0.2,1.2],   borderline: [1.2,2.0],  desc: 'Liver waste from red cell breakdown. High may indicate liver stress or red cell destruction.' },
      { name: 'Alkaline Phosphatase',unit: 'U/L',   optimal: [37,153],    borderline: [153,220],  desc: 'Liver and bone enzyme. Can rise during heavy training or bone growth.' },
      { name: 'AST',                 unit: 'U/L',   optimal: [10,35],     borderline: [35,80],    desc: 'Liver enzyme also released by muscle damage. Commonly elevated after intense strength training.' },
      { name: 'ALT',                 unit: 'U/L',   optimal: [6,29],      borderline: [29,60],    desc: 'Most specific liver enzyme. Elevated = liver stress, fatty liver disease, or hepatitis.' },
    ],
  },
  {
    name: 'Hemoglobin A1C',
    color: '#059669',
    panelDesc: 'Reflects average blood sugar over the past 90 days. Gold standard for diagnosing pre-diabetes and diabetes — essential for weight loss and metabolic health clients.',
    markers: [
      { name: 'HbA1c',                              unit: '%',       optimal: [0,5.7],    borderline: [5.7,6.4],  desc: '3-month blood sugar average. 5.7–6.4% = pre-diabetic. Above 6.5% = diabetic. Drops with exercise and diet changes.' },
      { name: 'Estimated Average Glucose (mg/dL)', unit: 'mg/dL',  optimal: [70,120],   borderline: [120,154],  desc: 'Calculated 3-month average glucose in mg/dL derived from HbA1c. Below 120 is ideal for non-diabetics.' },
      { name: 'Estimated Average Glucose (mmol/L)',unit: 'mmol/L', optimal: [3.9,6.7],  borderline: [6.7,8.6],  desc: 'Calculated 3-month average glucose in mmol/L derived from HbA1c. International unit equivalent.' },
      { name: 'Fasting Glucose',                   unit: 'mg/dL',  optimal: [70,99],    borderline: [100,125],  desc: 'Same-day fasting blood sugar. Cross-reference with HbA1c to separate daily spikes from chronic elevation.' },
      { name: 'Fasting Insulin',                   unit: 'µIU/mL', optimal: [2,20],     borderline: [20,30],    desc: 'High fasting insulin signals resistance even before glucose rises — the earliest metabolic warning sign.' },
      { name: 'HOMA-IR',                           unit: 'index',  optimal: [0,1.5],    borderline: [1.5,3.0],  desc: 'Calculated insulin resistance score (Glucose × Insulin ÷ 405). Above 1.9 = insulin resistance.' },
    ],
  },
  {
    name: 'Other / Additional',
    color: '#0284C7',
    panelDesc: 'Hormones, vitamins, inflammation markers, and specialty tests. Provides deeper insight into recovery capacity, energy optimization, and long-term health.',
    markers: [
      { name: 'Testosterone',      unit: 'ng/dL',   optimal: [400,1000], borderline: [300,400],  desc: 'Primary male hormone. Low = fatigue, low libido, and muscle loss. Exercise naturally raises testosterone.' },
      { name: 'Free Testosterone', unit: 'pg/mL',   optimal: [9,30],     borderline: [5,9],      desc: 'Unbound, bioavailable testosterone. More relevant than total T for symptoms of low testosterone.' },
      { name: 'SHBG',              unit: 'nmol/L',  optimal: [10,57],    borderline: [57,80],    desc: 'Binds testosterone, making it unavailable to cells. High SHBG can leave low free T even with normal total.' },
      { name: 'Estradiol',         unit: 'pg/mL',   optimal: [10,40],    borderline: [40,60],    desc: 'Estrogen in men — needed for bone and joint health. Too high often means excess fat converting testosterone.' },
      { name: 'TSH',               unit: 'mIU/L',   optimal: [0.4,4.0],  borderline: [4.0,10.0], desc: 'Thyroid stimulating hormone. High = hypothyroid — sluggish metabolism, fatigue, and weight gain.' },
      { name: 'Free T3',           unit: 'pg/mL',   optimal: [2.3,4.2],  borderline: [1.8,2.3],  desc: 'Active thyroid hormone driving metabolism. Low = slow metabolism even when TSH looks normal.' },
      { name: 'Free T4',           unit: 'ng/dL',   optimal: [0.8,1.8],  borderline: [0.6,0.8],  desc: 'Thyroid output hormone that converts to T3. Measures the thyroid gland\'s production capacity.' },
      { name: 'Cortisol',          unit: 'µg/dL',   optimal: [6,23],     borderline: [23,30],    desc: 'Stress hormone. Chronically high = muscle breakdown, fat gain, poor sleep, and immune suppression.' },
      { name: 'DHEA-S',            unit: 'µg/dL',   optimal: [100,400],  borderline: [50,100],   desc: 'Adrenal hormone. Low = adrenal fatigue and low energy. Declines with age and chronic stress.' },
      { name: 'Vitamin D',         unit: 'ng/mL',   optimal: [40,80],    borderline: [20,40],    desc: 'Critical for bone density, immunity, mood, testosterone production, and muscle function. Most people are low.' },
      { name: 'B12',               unit: 'pg/mL',   optimal: [400,900],  borderline: [200,400],  desc: 'Essential for nerve health, energy production, and red cell formation. Often low in plant-based diets.' },
      { name: 'Folate',            unit: 'ng/mL',   optimal: [4,999],    borderline: [2,4],      desc: 'B vitamin needed for DNA repair and red cell production. Works with B12. Low causes anemia and fatigue.' },
      { name: 'Iron',              unit: 'µg/dL',   optimal: [60,170],   borderline: [40,60],    desc: 'Needed to make hemoglobin. Low = iron-deficiency anemia — fatigue, breathlessness, and poor endurance.' },
      { name: 'Ferritin',          unit: 'ng/mL',   optimal: [30,300],   borderline: [12,30],    desc: 'Iron storage protein. Better marker than serum iron alone. Low ferritin = depleted iron reserves.' },
      { name: 'CRP',               unit: 'mg/L',    optimal: [0,1.0],    borderline: [1.0,3.0],  desc: 'High-sensitivity C-reactive protein — systemic inflammation. High = disease risk and poor recovery.' },
      { name: 'Homocysteine',      unit: 'µmol/L',  optimal: [0,10],     borderline: [10,15],    desc: 'Inflammation amino acid. Elevated = cardiovascular risk and B vitamin deficiency.' },
      { name: 'Omega-3 Index',     unit: '%',       optimal: [8,999],    borderline: [4,8],      desc: 'EPA+DHA percentage in red cells. Low = inflammation and poor heart health. Fish oil moves this marker.' },
      { name: 'Magnesium',         unit: 'mg/dL',   optimal: [1.7,2.3],  borderline: [1.5,1.7],  desc: 'Cofactor for 300+ enzymes. Low = cramping, poor sleep, fatigue, anxiety, and insulin resistance.' },
      { name: 'Zinc',              unit: 'µg/dL',   optimal: [60,120],   borderline: [40,60],    desc: 'Immune function, testosterone production, wound healing. Depleted rapidly by heavy sweating.' },
      { name: 'PSA',               unit: 'ng/mL',   optimal: [0,4.0],    borderline: [4.0,10.0], desc: 'Prostate-specific antigen (men 40+). Screens for prostate enlargement or cancer. Important baseline.' },
    ],
  },
]

// Flat lookup map for all markers by name
const MARKERS = Object.fromEntries(BLOOD_PANELS.flatMap(p => p.markers.map(m => [m.name, m])))

const MARKER_CATEGORIES = Object.fromEntries(BLOOD_PANELS.map(p => [p.name, p.markers.map(m => m.name)]))

const HIGHER_IS_BETTER = new Set(['HDL','Hemoglobin','Hematocrit','RBC','eGFR','Testosterone','Free Testosterone','DHEA-S','Free T3','Free T4','Vitamin D','B12','Folate','Iron','Ferritin','Omega-3 Index','Magnesium','Zinc','Total Protein','Albumin'])

function getMarkerStatus(name, value) {
  const m = MARKERS[name]
  if (!m || value === '' || value === null || value === undefined) return 'empty'
  const v = parseFloat(value)
  if (isNaN(v)) return 'empty'
  const [oLow, oHigh] = m.optimal
  const [bLow, bHigh] = m.borderline
  if (v >= oLow && v <= oHigh) return 'optimal'
  if ((v >= bLow && v <= bHigh) || (v > oHigh && v <= bHigh) || (v < oLow && v >= bLow)) return 'borderline'
  return 'out'
}

function statusColor(status) {
  if (status === 'optimal') return C.green
  if (status === 'borderline') return C.orange
  if (status === 'out') return C.red
  return C.border
}

function BloodWorkPieChart({ records }) {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let opt = 0, bord = 0, out = 0
    for (const rec of records) {
      for (const [name, val] of Object.entries(rec.markers || {})) {
        const s = getMarkerStatus(name, val)
        if (s === 'optimal') opt++
        else if (s === 'borderline') bord++
        else if (s === 'out') out++
      }
    }
    const total = opt + bord + out
    if (total === 0) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = C.sub
      ctx.font = '12px Montserrat,sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('No data', 80, 80)
      return
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const slices = [
      { count: opt, color: C.green, label: 'Optimal' },
      { count: bord, color: C.orange, label: 'Borderline' },
      { count: out, color: C.red, label: 'Out of Range' },
    ]
    let startAngle = -Math.PI / 2
    const cx = 80, cy = 80, r = 65
    for (const s of slices) {
      if (s.count === 0) continue
      const angle = (s.count / total) * 2 * Math.PI
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.arc(cx, cy, r, startAngle, startAngle + angle)
      ctx.closePath()
      ctx.fillStyle = s.color
      ctx.fill()
      startAngle += angle
    }
    ctx.beginPath()
    ctx.arc(cx, cy, 30, 0, 2 * Math.PI)
    ctx.fillStyle = C.card
    ctx.fill()
    ctx.fillStyle = C.text
    ctx.font = 'bold 13px Montserrat,sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(total, cx, cy + 5)
  }, [records])

  const counts = { opt: 0, bord: 0, out: 0 }
  for (const rec of records) {
    for (const [name, val] of Object.entries(rec.markers || {})) {
      const s = getMarkerStatus(name, val)
      if (s === 'optimal') counts.opt++
      else if (s === 'borderline') counts.bord++
      else if (s === 'out') counts.out++
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      <canvas ref={canvasRef} width={160} height={160} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[['optimal', C.green, 'Optimal', counts.opt], ['borderline', C.orange, 'Borderline', counts.bord], ['out', C.red, 'Out of Range', counts.out]].map(([k, color, label, count]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: color }} />
            <span style={{ fontSize: 12, color: C.text }}>{label}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color }}>{count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

async function parsePdfBloodWork(file, panel = null) {
  const fd = new FormData()
  fd.append('pdf', file)
  if (panel) fd.append('panel', panel)
  const res = await fetch('/api/parse-bloodwork', { method: 'POST', body: fd })
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return data
}

function BloodWorkPanel({ client, onBack }) {
  const currentYear = new Date().getFullYear()
  const years = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3, currentYear - 4]
  const [frequency, setFrequency] = useState('Annual')
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedYear, setExpandedYear] = useState(currentYear)
  const [expandedPeriod, setExpandedPeriod] = useState(null)
  const [drafts, setDrafts] = useState({})
  const [saving, setSaving] = useState({})
  const [parsing, setParsing] = useState({})
  const [aiResult, setAiResult] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [showComparison, setShowComparison] = useState(false)
  const [showManual, setShowManual] = useState({})
  const fileInputRefs = useRef({})

  const periods = frequency === 'Quarterly' ? ['Q1', 'Q2', 'Q3', 'Q4'] : frequency === 'Semi-Annual' ? ['H1', 'H2'] : ['Annual']

  useEffect(() => {
    setLoading(true)
    getBloodWork(client.id).then(data => {
      setRecords(data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [client.id])

  function getRecord(year, period) {
    return records.find(r => r.year === year && r.period === period) || null
  }

  function getDraftKey(year, period) { return `${year}-${period}` }

  function getDraft(year, period) {
    const key = getDraftKey(year, period)
    if (drafts[key]) return drafts[key]
    const rec = getRecord(year, period)
    return rec ? { ...rec.markers } : {}
  }

  function setMarker(year, period, name, value) {
    const key = getDraftKey(year, period)
    setDrafts(d => ({ ...d, [key]: { ...(d[key] || getDraft(year, period)), [name]: value } }))
  }

  async function handlePdfUpload(year, period, file, panel) {
    if (!file) return
    const key = getDraftKey(year, period)
    const pKey = panel ? `${key}-${panel}` : key
    setParsing(p => ({ ...p, [pKey]: true }))
    try {
      const { markers, count } = await parsePdfBloodWork(file, panel)
      if (!count || count === 0) {
        alert('Could not extract marker values from this PDF. Make sure it is a text-based PDF (not a scan) and contains the expected markers.')
        setParsing(p => ({ ...p, [pKey]: false }))
        return
      }
      setDrafts(d => ({ ...d, [key]: { ...(d[key] || getDraft(year, period)), ...markers } }))
      setExpandedPeriod(key)
    } catch (e) {
      alert('PDF parsing failed: ' + e.message)
    }
    setParsing(p => ({ ...p, [pKey]: false }))
  }

  async function handleSave(year, period) {
    const key = getDraftKey(year, period)
    setSaving(s => ({ ...s, [key]: true }))
    try {
      const existing = getRecord(year, period)
      const saved = await saveBloodWork({
        id: existing?.id,
        client_id: client.id,
        year,
        period,
        frequency,
        markers: drafts[key] || getDraft(year, period),
        notes: existing?.notes || '',
        test_date: existing?.test_date || null,
      })
      setRecords(recs => {
        const others = recs.filter(r => !(r.year === year && r.period === period))
        return saved ? [...others, saved] : others
      })
      setDrafts(d => { const nd = { ...d }; delete nd[key]; return nd })
    } catch (e) {
      alert('Save failed: ' + e.message)
    }
    setSaving(s => ({ ...s, [key]: false }))
  }

  async function handleDelete(year, period) {
    const rec = getRecord(year, period)
    if (!rec) return
    if (!confirm('Delete this blood work record?')) return
    await deleteBloodWork(rec.id)
    setRecords(recs => recs.filter(r => r.id !== rec.id))
  }

  async function handleAiAnalysis() {
    setAiLoading(true)
    setAiResult('')
    try {
      const dataStr = records.map(r => `${r.year} ${r.period}: ${Object.entries(r.markers || {}).map(([k, v]) => `${k}=${v}`).join(', ')}`).join('\n')
      const text = await callClaude([{
        role: 'user',
        content: `You are a health & fitness advisor analyzing blood work for a personal trainer named Freddy.\n\nClient: ${client.name}\nBlood Work History:\n${dataStr || 'No data yet'}\n\nProvide analysis in exactly 4 sections:\n\n✅ WHAT'S IMPROVING\nList markers trending in the right direction and what that means for this client's fitness.\n\n⚠️ NEEDS ATTENTION\nFor each flagged marker: state the value, what it measures, likely contributing causes (lifestyle, diet, training, stress, etc.), and what happens if it stays elevated/low.\n\n🎯 FREDDY'S ACTION PLAN\nSpecific training and nutrition changes Freddy should implement based on these results. Be precise — e.g. "add 3g fish oil daily", "reduce HIIT frequency", "prioritize sleep for cortisol".\n\n📈 YEAR-OVER-YEAR SUMMARY\nThe most important trend across all periods and one headline win or concern.\n\nBe direct, specific, and actionable. No generic advice.`
      }], 2000)
      setAiResult(text)
    } catch (e) {
      setAiResult('Error: ' + e.message)
    }
    setAiLoading(false)
  }

  function getTrendArrow(markerName, vals) {
    if (vals.length < 2) return '→'
    const last = parseFloat(vals[vals.length - 1])
    const prev = parseFloat(vals[vals.length - 2])
    if (isNaN(last) || isNaN(prev)) return '→'
    const diff = last - prev
    if (Math.abs(diff) < 0.001) return '→'
    const higherBetter = HIGHER_IS_BETTER.has(markerName)
    if (higherBetter) return diff > 0 ? '▲' : '▼'
    return diff < 0 ? '▲' : '▼'
  }

  function getTrendColor(markerName, vals) {
    const arrow = getTrendArrow(markerName, vals)
    if (arrow === '→') return C.sub
    if (arrow === '▲') return C.green
    return C.red
  }

  const allPeriodKeys = []
  for (const y of [...years].reverse()) {
    for (const p of periods) {
      if (getRecord(y, p)) allPeriodKeys.push(`${y} ${p}`)
    }
  }

  const allMarkerNames = Object.keys(MARKERS)

  // Per-year pie data for multi-year comparison
  const yearSummaries = years.map(year => {
    const yearRecords = records.filter(r => r.year === year)
    let opt = 0, bord = 0, out = 0
    for (const rec of yearRecords) {
      for (const [name, val] of Object.entries(rec.markers || {})) {
        const s = getMarkerStatus(name, val)
        if (s === 'optimal') opt++
        else if (s === 'borderline') bord++
        else if (s === 'out') out++
      }
    }
    return { year, opt, bord, out, total: opt + bord + out }
  }).filter(s => s.total > 0)

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px', fontFamily: 'Montserrat,sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Btn onClick={onBack} outline small color={C.sub}>← Back</Btn>
        <div style={{ fontWeight: 800, fontSize: 22, letterSpacing: 3, color: C.text }}>🩸 Blood Work</div>
        <div style={{ fontSize: 13, color: C.sub }}>{client.name}</div>
      </div>

      {/* Frequency selector */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '14px 20px', marginBottom: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, color: C.sub, textTransform: 'uppercase', marginBottom: 10 }}>Testing Frequency</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['Quarterly', 'Semi-Annual', 'Annual'].map(f => (
            <button key={f} onClick={() => setFrequency(f)} style={{ padding: '8px 16px', borderRadius: 8, border: `1.5px solid ${frequency === f ? C.accent : C.border}`, background: frequency === f ? C.accent + '18' : 'transparent', color: frequency === f ? C.accent : C.sub, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>{f}</button>
          ))}
        </div>
      </div>

      {/* Multi-year pie comparison */}
      {yearSummaries.length > 0 && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 20px', marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: C.accent, textTransform: 'uppercase', marginBottom: 14 }}>Year-over-Year Snapshot</div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {yearSummaries.map(({ year, opt, bord, out, total }) => (
              <div key={year} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, minWidth: 120 }}>
                <BloodWorkPieChart records={records.filter(r => r.year === year)} />
                <div style={{ fontWeight: 800, fontSize: 13, color: C.text }}>{year}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {opt > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: C.green }}>✅ {opt}</span>}
                  {bord > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: C.orange }}>⚠️ {bord}</span>}
                  {out > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: C.red }}>❌ {out}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Year-over-year marker table */}
      {allPeriodKeys.length > 1 && (
        <div style={{ marginBottom: 16 }}>
          <button onClick={() => setShowComparison(!showComparison)} style={{ padding: '8px 16px', borderRadius: 8, border: `1.5px solid ${C.border}`, background: 'transparent', color: C.sub, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
            {showComparison ? '▲ Hide' : '▼ Show'} Marker Comparison Table
          </button>
        </div>
      )}

      {showComparison && allPeriodKeys.length > 1 && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 20px', marginBottom: 16, overflowX: 'auto' }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: C.accent, textTransform: 'uppercase', marginBottom: 12 }}>All Markers Over Time</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '6px 8px', color: C.sub, fontWeight: 700, borderBottom: `1px solid ${C.border}`, minWidth: 130 }}>Marker</th>
                {allPeriodKeys.map(pk => (
                  <th key={pk} style={{ textAlign: 'center', padding: '6px 8px', color: C.sub, fontWeight: 700, borderBottom: `1px solid ${C.border}`, minWidth: 70 }}>{pk}</th>
                ))}
                <th style={{ textAlign: 'center', padding: '6px 8px', color: C.sub, fontWeight: 700, borderBottom: `1px solid ${C.border}` }}>Trend</th>
              </tr>
            </thead>
            <tbody>
              {allMarkerNames.map(markerName => {
                const vals = allPeriodKeys.map(pk => {
                  const [y, ...rest] = pk.split(' '); const p = rest.join(' ')
                  const rec = getRecord(parseInt(y), p)
                  return rec?.markers?.[markerName] ?? ''
                })
                if (vals.every(v => v === '')) return null
                const numVals = vals.filter(v => v !== '')
                return (
                  <tr key={markerName}>
                    <td style={{ padding: '5px 8px', color: C.text, fontWeight: 600, borderBottom: `1px solid ${C.border}22` }}>{markerName}</td>
                    {vals.map((v, i) => {
                      const s = getMarkerStatus(markerName, v)
                      return (
                        <td key={i} style={{ textAlign: 'center', padding: '5px 8px', borderBottom: `1px solid ${C.border}22` }}>
                          {v !== '' ? <span style={{ color: statusColor(s), fontWeight: 700 }}>{v}</span> : <span style={{ color: C.border }}>—</span>}
                        </td>
                      )
                    })}
                    <td style={{ textAlign: 'center', padding: '5px 8px', borderBottom: `1px solid ${C.border}22`, fontWeight: 800, fontSize: 14, color: getTrendColor(markerName, numVals) }}>
                      {getTrendArrow(markerName, numVals)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* AI Analysis */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 20px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: aiResult ? 12 : 0 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: C.accent, textTransform: 'uppercase', flex: 1 }}>🤖 AI Analysis & Focus Areas</div>
          <Btn onClick={handleAiAnalysis} disabled={aiLoading || records.length === 0} small color={C.accent}>
            {aiLoading ? '⏳ Analyzing…' : records.length === 0 ? 'Upload records first' : '✨ Run Analysis'}
          </Btn>
        </div>
        {aiResult && (
          <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, color: C.text, lineHeight: 1.8, borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>{aiResult}</div>
        )}
      </div>

      {/* Year accordions */}
      {loading ? <Spinner /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {years.map(year => {
            const yearRecords = records.filter(r => r.year === year)
            const isExpanded = expandedYear === year
            return (
              <div key={year} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
                <div onClick={() => setExpandedYear(isExpanded ? null : year)} style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontWeight: 800, fontSize: 16, color: C.text }}>{year}</span>
                    {yearRecords.length > 0 && (
                      <span style={{ fontSize: 10, background: C.green + '18', color: C.green, borderRadius: 10, padding: '2px 10px', fontWeight: 700 }}>✅ {yearRecords.length} record{yearRecords.length > 1 ? 's' : ''}</span>
                    )}
                  </div>
                  <span style={{ fontSize: 11, color: C.sub }}>{isExpanded ? '▲' : '▼'}</span>
                </div>

                {isExpanded && (
                  <div style={{ borderTop: `1px solid ${C.border}`, padding: '16px 20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {periods.map(period => {
                        const rec = getRecord(year, period)
                        const pKey = getDraftKey(year, period)
                        const isExpP = expandedPeriod === pKey
                        const draft = getDraft(year, period)
                        const isDirty = !!drafts[pKey]
                        const isParsing = !!parsing[pKey]
                        const isManual = !!showManual[pKey]
                        const markerCount = Object.keys(draft).filter(k => draft[k] !== '' && draft[k] !== null && draft[k] !== undefined).length

                        return (
                          <div key={period} style={{ border: `1.5px solid ${rec ? C.green + '55' : C.border}`, borderRadius: 10, overflow: 'hidden' }}>
                            <div onClick={() => setExpandedPeriod(isExpP ? null : pKey)} style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', background: rec ? C.green + '08' : C.faint }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{period}</span>
                                {rec && <span style={{ fontSize: 10, color: C.green, fontWeight: 700 }}>● {markerCount} markers saved</span>}
                                {isDirty && !rec && <span style={{ fontSize: 10, color: C.orange, fontWeight: 700 }}>● {markerCount} markers ready to save</span>}
                                {isDirty && rec && <span style={{ fontSize: 10, color: C.orange, fontWeight: 700 }}>● Unsaved changes</span>}
                              </div>
                              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                {rec && (
                                  <button onClick={e => { e.stopPropagation(); handleDelete(year, period) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.red, fontSize: 11, fontWeight: 700 }}>Delete</button>
                                )}
                                <span style={{ fontSize: 11, color: C.sub }}>{isExpP ? '▲' : '▼'}</span>
                              </div>
                            </div>

                            {isExpP && (
                              <div style={{ padding: '16px' }}>
                                {/* Per-panel upload sections */}
                                {BLOOD_PANELS.map(panel => {
                                  const panelParsing = !!parsing[`${pKey}-${panel.name}`]
                                  const panelFileKey = `${pKey}-${panel.name}`
                                  const panelMarkerCount = panel.markers.filter(m => draft[m.name] !== '' && draft[m.name] != null).length
                                  return (
                                    <div key={panel.name} style={{ border: `1.5px solid ${panel.color}33`, borderRadius: 10, marginBottom: 12, overflow: 'hidden' }}>
                                      {/* Panel header with upload button */}
                                      <div style={{ background: panel.color + '0d', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                          <div style={{ width: 10, height: 10, borderRadius: '50%', background: panel.color, flexShrink: 0 }} />
                                          <div style={{ fontWeight: 800, fontSize: 12, color: C.text }}>{panel.name}</div>
                                          {panelMarkerCount > 0 && (
                                            <span style={{ fontSize: 10, fontWeight: 700, color: panel.color, background: panel.color + '18', padding: '1px 8px', borderRadius: 6 }}>
                                              {panelMarkerCount} marker{panelMarkerCount !== 1 ? 's' : ''} filled
                                            </span>
                                          )}
                                        </div>
                                        <div style={{ display: 'flex', align: 'center', gap: 8, flexShrink: 0 }}>
                                          <input
                                            ref={el => { fileInputRefs.current[panelFileKey] = el }}
                                            type="file"
                                            accept=".pdf"
                                            style={{ display: 'none' }}
                                            onChange={e => { if (e.target.files?.[0]) handlePdfUpload(year, period, e.target.files[0], panel.name); e.target.value = '' }}
                                          />
                                          <button
                                            onClick={e => { e.stopPropagation(); fileInputRefs.current[panelFileKey]?.click() }}
                                            disabled={panelParsing}
                                            style={{ padding: '5px 12px', borderRadius: 7, border: `1.5px solid ${panel.color}`, background: panel.color + '18', color: panel.color, fontFamily: 'Montserrat,sans-serif', fontWeight: 700, fontSize: 11, cursor: panelParsing ? 'not-allowed' : 'pointer', opacity: panelParsing ? 0.7 : 1, whiteSpace: 'nowrap' }}>
                                            {panelParsing ? '⏳ Reading…' : panelMarkerCount > 0 ? '↺ Re-upload PDF' : '📄 Upload PDF'}
                                          </button>
                                        </div>
                                      </div>

                                      {/* Panel description */}
                                      <div style={{ padding: '8px 14px', fontSize: 10, color: C.sub, background: C.faint, borderBottom: `1px solid ${panel.color}22` }}>
                                        {panel.panelDesc}
                                      </div>

                                      {/* Marker inputs */}
                                      <div style={{ padding: '12px 14px' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
                                          {panel.markers.map(m => {
                                            const val = draft[m.name] ?? ''
                                            const status = getMarkerStatus(m.name, val)
                                            const borderCol = status === 'empty' ? C.border : statusColor(status)
                                            return (
                                              <div key={m.name} style={{ gridColumn: status !== 'empty' && val !== '' ? 'span 1' : undefined }}>
                                                <div style={{ fontSize: 10, color: C.sub, marginBottom: 3, fontWeight: 600 }}>{m.name} <span style={{ color: C.border }}>({m.unit})</span></div>
                                                <input
                                                  type="number"
                                                  step="any"
                                                  value={val}
                                                  onChange={e => setMarker(year, period, m.name, e.target.value)}
                                                  placeholder={`${m.optimal[0]}–${m.optimal[1] === 999 ? '↑' : m.optimal[1]}`}
                                                  style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: `2px solid ${borderCol}`, background: status !== 'empty' ? statusColor(status) + '0a' : C.bg, color: C.text, fontFamily: 'Montserrat,sans-serif', fontSize: 12, boxSizing: 'border-box', outline: 'none' }}
                                                />
                                                {val !== '' && status !== 'empty' && (
                                                  <div style={{ fontSize: 9, marginTop: 2, color: statusColor(status), fontWeight: 700 }}>
                                                    {status === 'optimal' ? '✅ Optimal' : status === 'borderline' ? '⚠️ Borderline' : '❌ Out of range'}
                                                  </div>
                                                )}
                                                <div style={{ fontSize: 9, color: C.sub, marginTop: 4, lineHeight: 1.4, opacity: 0.85 }}>{m.desc}</div>
                                              </div>
                                            )
                                          })}
                                        </div>
                                      </div>
                                    </div>
                                  )
                                })}

                                <div style={{ marginTop: 8, display: 'flex', gap: 10 }}>
                                  <Btn onClick={() => handleSave(year, period)} disabled={saving[pKey]} small color={C.accent}>
                                    {saving[pKey] ? 'Saving…' : '💾 Save All'}
                                  </Btn>
                                  {isDirty && (
                                    <Btn onClick={() => setDrafts(d => { const nd = { ...d }; delete nd[pKey]; return nd })} outline small color={C.sub}>Discard</Btn>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
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
  const [allClients, setAllClients] = useState([])
  const [forceNewAssessment, setForceNewAssessment] = useState(false)
  const [showBossPanel, setShowBossPanel] = useState(false)
  const [bossCount, setBossCount] = useState(0)

  // Load all clients for linked-client switching
  const refreshAllClients = useCallback(async () => {
    try {
      const all = await getAllClients()
      const withAssessments = await Promise.all(all.map(async c => {
        const assessments = await getAssessmentsForClient(c.id).catch(() => ({}))
        return { ...c, trainerNotes: c.trainer_notes, assessments }
      }))
      setAllClients(withAssessments)
      return withAssessments
    } catch { return [] }
  }, [])

  useEffect(() => {
    fetch('/api/auth').then(r => r.json()).then(d => {
      if (d.authed) { setAuthed(true); refreshAllClients() }
    }).catch(() => {}).finally(() => setCheckingAuth(false))
  }, [refreshAllClients])

  const refreshBossCount = useCallback(() => {
    getAllLeads().then(leads => {
      const count = leads.filter(l => { const s = getOutreachStep(l); return s && s.isDue && !s.isComplete }).length
      setBossCount(count)
    }).catch(() => {})
  }, [])

  useEffect(() => { if (authed) refreshBossCount() }, [authed, refreshBossCount])

  // Prevent iPad/iOS keyboard from pushing the viewport around
  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleResize = () => {
      // Force scroll to top of document when keyboard causes a resize
      window.scrollTo(0, 0)
    }
    // visualViewport API tracks actual visible area (shrinks when keyboard opens)
    const vv = window.visualViewport
    if (vv) {
      vv.addEventListener('resize', handleResize)
      vv.addEventListener('scroll', handleResize)
      return () => {
        vv.removeEventListener('resize', handleResize)
        vv.removeEventListener('scroll', handleResize)
      }
    }
  }, [])

  if (checkingAuth) return null
  if (!authed) return <LoginScreen onLogin={() => { setAuthed(true); refreshAllClients() }} />

  const goToClient = (c) => { setClient(c); setView('client'); refreshAllClients() }
  const updateClient = (c) => { setClient(c); setAllClients(prev => prev.map(p => p.id === c.id ? c : p)) }
  const switchToClient = (c) => { setClient(c); setView('client') }
  const openIntake = () => { setClient(null); setView('intake') }
  const openEditClient = (c) => { setClient(c); setView('editClient') }

  const runAssessment = (a, c, forceNew = false) => {
    setAssessment(a)
    setClient(c)
    setForceNewAssessment(!!forceNew)
    setView('assessment')
  }

  const completeAssessment = (id, answers) => {
    setClient(c => ({ ...c, assessments: { ...(c.assessments || {}), [id]: answers } }))
  }

  return (
    <div style={{ minHeight: '100dvh', background: C.bg, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '8px 12px', borderBottom: `1px solid ${C.border}`, background: C.panel, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', flexShrink: 0 }} className="no-print">
        <button onClick={() => setView('roster')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div>
            <span style={{ fontWeight: 800, fontSize: 14, letterSpacing: 2, color: '#8C9199' }}>FREDDY</span>
            <span style={{ fontWeight: 800, fontSize: 14, letterSpacing: 2, color: C.accent, marginLeft: 3 }}>FIT</span>
          </div>
          <div style={{ width: 1, height: 18, background: C.border }} />
          <div style={{ fontSize: 10, color: C.sub, letterSpacing: 2, fontWeight: 600, textTransform: 'uppercase' }}>TrainDesk</div>
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
          <button onClick={() => setShowBossPanel(true)} style={{ padding: '4px 8px', borderRadius: 6, border: `1.5px solid ${bossCount > 0 ? C.orange : C.border}`, background: bossCount > 0 ? C.orange + '18' : 'transparent', color: bossCount > 0 ? C.orange : C.sub, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif', whiteSpace: 'nowrap' }}>
            🎯 Boss{bossCount > 0 ? ` (${bossCount})` : ''}
          </button>
          <button onClick={() => setView('schedule')} style={{ padding: '4px 8px', borderRadius: 6, border: `1.5px solid ${view === 'schedule' ? C.accent : C.border}`, background: view === 'schedule' ? C.accent + '18' : 'transparent', color: view === 'schedule' ? C.accent : C.sub, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif', whiteSpace: 'nowrap' }}>
            📅 Schedule
          </button>
          <button onClick={() => setView('leads')} style={{ padding: '4px 8px', borderRadius: 6, border: `1.5px solid ${view === 'leads' ? C.accent : C.border}`, background: view === 'leads' ? C.accent + '18' : 'transparent', color: view === 'leads' ? C.accent : C.sub, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif', whiteSpace: 'nowrap' }}>
            CRM
          </button>
          <button onClick={async () => { await fetch('/api/auth', { method: 'DELETE' }); setAuthed(false) }} style={{ padding: '4px 8px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', color: C.sub, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif', whiteSpace: 'nowrap' }}>
            Out
          </button>
        </div>
      </div>

      {/* Scrolling Reminder Ticker */}
      <ReminderTicker clients={allClients} />

      {/* Rest Timer */}
      <RestTimer />

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {view === 'roster' && <ClientRoster onSelectClient={goToClient} onNewClient={openIntake} onOpenSchedule={() => setView('schedule')} />}
        {view === 'client' && client && (
          <ClientProfile
            client={client}
            onUpdate={updateClient}
            onRunAssessment={runAssessment}
            onBuildProgram={c => { setClient(c); setView('program') }}
            onGenerateWorkout={c => { setClient(c); setView('workout') }}
            onProtocolAdvisor={c => { setClient(c); setView('protocols') }}
            onSignInSheet={c => { setClient(c); setView('signin') }}
            onWeightTracker={c => { setClient(c); setView('weightTracker') }}
            onSubscription={c => { setClient(c); setView('subscription') }}
            onBloodWork={c => { setClient(c); setView('bloodWork') }}
            onEditClient={openEditClient}
            onBack={() => setView('roster')}
            allClients={allClients}
            onSwitchClient={switchToClient}
          />
        )}
        {view === 'assessment' && client && assessment && (
          <AssessmentForm
            assessment={assessment}
            client={client}
            onComplete={completeAssessment}
            onBack={() => setView('client')}
            forceNew={forceNewAssessment}
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
        {view === 'weightTracker' && client && (
          <WeightTracker
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
        {view === 'subscription' && client && (
          <SubscriptionTracker
            client={client}
            onBack={() => setView('client')}
          />
        )}
        {view === 'bloodWork' && client && <BloodWorkPanel client={client} onBack={() => setView('client')} />}
        {view === 'leads' && <CrmLeads onBack={() => setView('roster')} onNavigateToRoster={() => setView('roster')} />}
        {view === 'schedule' && <Schedule onBack={() => setView('roster')} allClients={allClients} />}
      </div>
      {showBossPanel && (
        <CrmBossPanel
          onClose={() => setShowBossPanel(false)}
          onGoToCrm={() => { setShowBossPanel(false); setView('leads') }}
        />
      )}
    </div>
  )
}
