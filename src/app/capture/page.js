'use client'
import { useState } from 'react'

const ACCENT = '#2BAADF'
const TEXT = '#1A202C'
const SUB = '#718096'
const BORDER = '#E2E8F0'
const FAINT = '#EDF2F7'
const RED = '#EF4444'
const GREEN = '#059669'

export default function LeadCapture() {
  const [form, setForm] = useState({ name: '', phone: '', email: '', goal: '' })
  const [status, setStatus] = useState('idle') // idle | submitting | success | error
  const [errorMsg, setErrorMsg] = useState('')

  const update = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setStatus('submitting')
    setErrorMsg('')
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...form, source: 'Instagram / Facebook' })
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Something went wrong')
      }
      setStatus('success')
    } catch (err) {
      setErrorMsg(err.message)
      setStatus('error')
    }
  }

  const inputStyle = {
    width: '100%',
    background: FAINT,
    border: `1px solid ${BORDER}`,
    borderRadius: 10,
    padding: '13px 16px',
    fontFamily: 'Montserrat, sans-serif',
    fontSize: 14,
    color: TEXT,
    outline: 'none',
    boxSizing: 'border-box',
  }

  const labelStyle = {
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: 2,
    color: SUB,
    textTransform: 'uppercase',
    marginBottom: 6,
    display: 'block',
  }

  if (status === 'success') {
    return (
      <div style={{ minHeight: '100dvh', background: '#F8F9FA', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'Montserrat, sans-serif' }}>
        <div style={{ maxWidth: 440, width: '100%', background: '#fff', borderRadius: 20, padding: 40, boxShadow: '0 4px 24px rgba(0,0,0,0.08)', textAlign: 'center' }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>🎉</div>
          <div style={{ fontWeight: 800, fontSize: 22, color: TEXT, marginBottom: 10, letterSpacing: 1 }}>You're on the list!</div>
          <div style={{ fontSize: 14, color: SUB, lineHeight: 1.6 }}>Thanks for reaching out! Freddy will be in touch with you soon to talk about your goals.</div>
        </div>
      </div>
    )
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&display=swap');
        * { box-sizing: border-box; }
        input::placeholder, textarea::placeholder { color: ${SUB}; opacity: .7; }
        input:focus, textarea:focus, select:focus { border-color: ${ACCENT} !important; box-shadow: 0 0 0 3px ${ACCENT}22; }
      `}</style>
      <div style={{ minHeight: '100dvh', background: 'linear-gradient(135deg, #F8F9FA 0%, #EDF2F7 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'Montserrat, sans-serif' }}>
        <div style={{ maxWidth: 460, width: '100%' }}>
          {/* Logo / Brand */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontWeight: 800, fontSize: 24, letterSpacing: 3, color: '#8C9199' }}>FREDDY</span>
              <span style={{ fontWeight: 800, fontSize: 24, letterSpacing: 3, color: ACCENT }}>FIT</span>
            </div>
            <div style={{ fontSize: 11, color: SUB, letterSpacing: 2, fontWeight: 600, textTransform: 'uppercase' }}>Personal Training</div>
          </div>

          <div style={{ background: '#fff', borderRadius: 20, padding: '36px 32px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
            <div style={{ fontWeight: 800, fontSize: 20, color: TEXT, letterSpacing: 1, marginBottom: 6 }}>Let's Get Started 💪</div>
            <div style={{ fontSize: 13, color: SUB, marginBottom: 28, lineHeight: 1.5 }}>Fill out the form below and Freddy will reach out to chat about your goals.</div>

            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <label style={labelStyle}>Name *</label>
                <input type="text" value={form.name} onChange={update('name')} placeholder="Your full name" required style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Phone</label>
                <input type="tel" value={form.phone} onChange={update('phone')} placeholder="Your phone number" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Email</label>
                <input type="email" value={form.email} onChange={update('email')} placeholder="Your email address" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>What's your goal?</label>
                <textarea value={form.goal} onChange={update('goal')} placeholder="e.g. Lose weight, build muscle, get stronger…" rows={3}
                  style={{ ...inputStyle, resize: 'vertical', fontFamily: 'Montserrat, sans-serif' }} />
              </div>

              {status === 'error' && (
                <div style={{ background: RED + '12', border: `1px solid ${RED}33`, borderRadius: 8, padding: '10px 14px', fontSize: 12, color: RED, fontWeight: 600 }}>
                  {errorMsg || 'Something went wrong. Please try again.'}
                </div>
              )}

              <button type="submit" disabled={status === 'submitting' || !form.name.trim()}
                style={{ padding: '14px', borderRadius: 10, border: 'none', background: status === 'submitting' ? '#CBD5E0' : ACCENT, color: '#fff', fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 14, cursor: status === 'submitting' ? 'not-allowed' : 'pointer', letterSpacing: 1, marginTop: 4, transition: 'background .15s' }}>
                {status === 'submitting' ? 'Sending…' : 'Submit →'}
              </button>
            </form>
          </div>

          <div style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: SUB }}>
            🔒 Your info is kept private and never shared.
          </div>
        </div>
      </div>
    </>
  )
}
