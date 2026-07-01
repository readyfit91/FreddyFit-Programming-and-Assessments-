import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const BRAND = {
  black:   '#0A0A0A',
  accent:  '#2563EB',
  accentD: '#1D4ED8',
  white:   '#FFFFFF',
  light:   '#F0F4FF',
  border:  '#E2E8F0',
  sub:     '#64748B',
  faint:   '#F8FAFC',
}

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
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

function sessionDuration(type) {
  const map = {
    'FIT60': '60 minutes', 'FIT30': '30 minutes',
    'In-Person Consultation': '60 minutes', 'Phone Consultation': '30 minutes',
    'Video Call': '30 minutes', 'Phone Call': '20 minutes',
    'Business Call': '30 minutes', 'Business Meeting': '60 minutes',
  }
  return map[type] || '60 minutes'
}

function sessionIcon(type) {
  const map = {
    'FIT60': '🏋️', 'FIT30': '⚡',
    'In-Person Consultation': '📋', 'Phone Consultation': '📞',
    'Video Call': '💻', 'Phone Call': '📞',
  }
  return map[type] || '📅'
}

export async function POST(request) {
  try {
    const { clientName, clientEmail, date, time, sessionType, notes, recurring } = await request.json()

    if (!clientEmail) return Response.json({ error: 'No client email provided' }, { status: 400 })

    const logoUrl = 'https://getfreddyfit.com/logo.png'

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Session Confirmation</title>
</head>
<body style="margin:0;padding:0;background:#EEF2F7;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#EEF2F7;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">

          <!-- Header -->
          <tr>
            <td style="background:${BRAND.black};padding:36px 40px;text-align:center;">
              <img src="${logoUrl}" alt="FreddyFit" width="120" height="auto"
                style="display:block;margin:0 auto 16px;max-width:120px;" />
              <div style="color:${BRAND.white};font-size:11px;letter-spacing:4px;text-transform:uppercase;font-weight:700;">Professional Fitness Coaching</div>
            </td>
          </tr>

          <!-- Confirmed Banner -->
          <tr>
            <td style="background:${BRAND.accent};padding:14px 40px;text-align:center;">
              <div style="color:${BRAND.white};font-size:13px;font-weight:800;letter-spacing:2px;text-transform:uppercase;">✅ &nbsp; Session Confirmed</div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:${BRAND.white};padding:36px 40px 0;">
              <div style="font-size:22px;font-weight:700;color:${BRAND.black};margin-bottom:8px;">Hi ${clientName},</div>
              <div style="font-size:14px;color:${BRAND.sub};line-height:1.7;">
                Your coaching session has been confirmed. Please review the details below and don't hesitate to reach out if you need to make any changes.
              </div>
            </td>
          </tr>

          <!-- Appointment Card -->
          <tr>
            <td style="background:${BRAND.white};padding:24px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:12px;overflow:hidden;border:1.5px solid ${BRAND.border};">

                <!-- Card Header -->
                <tr>
                  <td style="background:${BRAND.light};padding:16px 24px;border-bottom:1.5px solid ${BRAND.border};">
                    <div style="font-size:10px;font-weight:800;color:${BRAND.accentD};letter-spacing:2px;text-transform:uppercase;">Appointment Details</div>
                  </td>
                </tr>

                <!-- Date -->
                <tr>
                  <td style="padding:18px 24px;border-bottom:1px solid ${BRAND.border};">
                    <div style="font-size:10px;color:${BRAND.sub};font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:5px;">Date</div>
                    <div style="font-size:15px;font-weight:800;color:${BRAND.black};">📅 &nbsp;${formatDate(date)}</div>
                  </td>
                </tr>

                <!-- Time -->
                <tr>
                  <td style="padding:18px 24px;border-bottom:1px solid ${BRAND.border};">
                    <div style="font-size:10px;color:${BRAND.sub};font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:5px;">Time</div>
                    <div style="font-size:15px;font-weight:800;color:${BRAND.black};">🕐 &nbsp;${formatTime(time)}</div>
                  </td>
                </tr>

                <!-- Session Type -->
                <tr>
                  <td style="padding:18px 24px;border-bottom:1px solid ${BRAND.border};">
                    <div style="font-size:10px;color:${BRAND.sub};font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:5px;">Session Type</div>
                    <div style="font-size:15px;font-weight:800;color:${BRAND.black};">${sessionIcon(sessionType)} &nbsp;${sessionType}</div>
                  </td>
                </tr>

                <!-- Duration -->
                <tr>
                  <td style="padding:18px 24px;${notes ? 'border-bottom:1px solid ' + BRAND.border + ';' : ''}">
                    <div style="font-size:10px;color:${BRAND.sub};font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:5px;">Duration</div>
                    <div style="font-size:15px;font-weight:800;color:${BRAND.black};">⏱ &nbsp;${sessionDuration(sessionType)}</div>
                  </td>
                </tr>

                ${notes ? `
                <!-- Notes -->
                <tr>
                  <td style="padding:18px 24px;">
                    <div style="font-size:10px;color:${BRAND.sub};font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:5px;">Notes</div>
                    <div style="font-size:14px;color:${BRAND.black};line-height:1.6;">📝 &nbsp;${notes}</div>
                  </td>
                </tr>` : ''}

              </table>
            </td>
          </tr>

          ${recurring ? `
          <!-- Recurring -->
          <tr>
            <td style="background:${BRAND.white};padding:0 40px 24px;">
              <div style="background:${BRAND.light};border-left:4px solid ${BRAND.accent};border-radius:8px;padding:14px 18px;">
                <div style="font-size:13px;color:${BRAND.accentD};font-weight:800;">🔁 &nbsp;Recurring Weekly Session</div>
                <div style="font-size:12px;color:${BRAND.sub};margin-top:4px;line-height:1.5;">This session repeats every week at the same time.</div>
              </div>
            </td>
          </tr>` : ''}

          <!-- What to Bring -->
          <tr>
            <td style="background:${BRAND.white};padding:0 40px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:12px;border:1.5px solid ${BRAND.border};overflow:hidden;">
                <tr>
                  <td style="background:${BRAND.black};padding:14px 24px;">
                    <div style="font-size:10px;font-weight:800;color:${BRAND.white};letter-spacing:2px;text-transform:uppercase;">What to Bring</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:18px 24px;background:${BRAND.white};">
                    <div style="font-size:13px;color:${BRAND.black};line-height:2.2;">
                      💧 &nbsp;Water bottle<br/>
                      👟 &nbsp;Athletic footwear<br/>
                      🏃 &nbsp;Comfortable workout attire<br/>
                      📱 &nbsp;Any questions or goals for your trainer
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Questions -->
          <tr>
            <td style="background:${BRAND.white};padding:0 40px 36px;text-align:center;">
              <div style="font-size:13px;color:${BRAND.sub};line-height:1.8;">
                Need to reschedule or have questions?<br/>
                <a href="mailto:myfitpro@getfreddyfit.com" style="color:${BRAND.accent};font-weight:800;text-decoration:none;">myfitpro@getfreddyfit.com</a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:${BRAND.black};padding:28px 40px;text-align:center;">
              <img src="${logoUrl}" alt="FreddyFit" width="80" height="auto"
                style="display:block;margin:0 auto 14px;max-width:80px;opacity:0.85;" />
              <div style="font-size:11px;color:#888;letter-spacing:2px;text-transform:uppercase;font-weight:700;margin-bottom:6px;">FreddyFit Professional Coaching</div>
              <div style="font-size:11px;color:#666;margin-bottom:4px;">6047 Telegraph Road, Saint Louis, MO 63129</div>
              <div style="font-size:10px;color:#555;margin-top:8px;">© ${new Date().getFullYear()} FreddyFit. All rights reserved.</div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`

    const { data, error } = await resend.emails.send({
      from: 'FreddyFit <myfitpro@getfreddyfit.com>',
      to: [clientEmail],
      subject: `✅ Session Confirmed — ${formatDate(date)} at ${formatTime(time)}`,
      html,
    })

    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ success: true, id: data.id })
  } catch (err) {
    console.error('send-confirmation error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
