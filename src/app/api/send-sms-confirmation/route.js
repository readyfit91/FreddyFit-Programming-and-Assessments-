import { sendSMS } from '../../../lib/twilio'

function formatTime(time) {
  if (!time) return ''
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export async function POST(request) {
  try {
    const { clientName, clientPhone, date, time, sessionType, recurring } = await request.json()
    if (!clientPhone) return Response.json({ error: 'No client phone number provided' }, { status: 400 })

    const body = `Hi ${clientName}, this confirms your FreddyFit ${sessionType || 'session'} on ${formatDate(date)} at ${formatTime(time)}.${recurring ? ' This session repeats weekly.' : ''} Reply to reschedule or email myfitpro@getfreddyfit.com.`

    const result = await sendSMS(clientPhone, body)
    if (!result.success) return Response.json({ error: result.error }, { status: 500 })
    return Response.json({ success: true, sid: result.sid })
  } catch (err) {
    console.error('send-sms-confirmation error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
