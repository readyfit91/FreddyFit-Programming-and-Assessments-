import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

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
  const map = { FIT60: '60 minutes', FIT30: '30 minutes', Consultation: '60 minutes', 'Video Call': '30 minutes', 'Phone Call': '20 minutes' }
  return map[type] || '60 minutes'
}

function sessionIcon(type) {
  const map = { FIT60: '🏋️', FIT30: '⚡', Consultation: '📋', 'Video Call': '💻', 'Phone Call': '📞' }
  return map[type] || '📅'
}

export async function POST(request) {
  try {
    const { clientName, clientEmail, date, time, sessionType, notes, recurring } = await request.json()

    if (!clientEmail) return Response.json({ error: 'No client email provided' }, { status: 400 })

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Session Confirmation</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:#0A0A0A;padding:32px 40px;text-align:center;">
              <img src="https://getfreddyfit.com/logo.png" alt="FreddyFit" width="48" height="48" style="border-radius:10px;margin-bottom:12px;display:block;margin-left:auto;margin-right:auto;" onerror="this.style.display='none'" />
              <div style="color:#ffffff;font-size:22px;font-weight:800;letter-spacing:3px;text-transform:uppercase;">FREDDYFIT</div>
              <div style="color:#888888;font-size:11px;letter-spacing:2px;text-transform:uppercase;margin-top:4px;">Professional Fitness Coaching</div>
            </td>
          </tr>

          <!-- Confirmation Banner -->
          <tr>
            <td style="background:#1D4ED8;padding:16px 40px;text-align:center;">
              <div style="color:#ffffff;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">✅ &nbsp; Session Confirmed</div>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding:36px 40px 0;">
              <div style="font-size:22px;font-weight:700;color:#0A0A0A;margin-bottom:8px;">Hi ${clientName},</div>
              <div style="font-size:15px;color:#555555;line-height:1.6;">
                Your upcoming coaching session has been confirmed. Please review the details below and add it to your calendar.
              </div>
            </td>
          </tr>

          <!-- Appointment Card -->
          <tr>
            <td style="padding:28px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fb;border-radius:10px;border:1px solid #e8eaed;overflow:hidden;">

                <tr>
                  <td style="padding:20px 24px;border-bottom:1px solid #e8eaed;background:#f0f4ff;">
                    <div style="font-size:11px;font-weight:700;color:#1D4ED8;letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;">Appointment Details</div>
                  </td>
                </tr>

                <tr>
                  <td style="padding:0;">
                    <table width="100%" cellpadding="0" cellspacing="0">

                      <tr>
                        <td style="padding:18px 24px;border-bottom:1px solid #f0f0f0;">
                          <div style="font-size:11px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Date</div>
                          <div style="font-size:15px;font-weight:700;color:#0A0A0A;">📅 &nbsp;${formatDate(date)}</div>
                        </td>
                      </tr>

                      <tr>
                        <td style="padding:18px 24px;border-bottom:1px solid #f0f0f0;">
                          <div style="font-size:11px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Time</div>
                          <div style="font-size:15px;font-weight:700;color:#0A0A0A;">🕐 &nbsp;${formatTime(time)}</div>
                        </td>
                      </tr>

                      <tr>
                        <td style="padding:18px 24px;border-bottom:1px solid #f0f0f0;">
                          <div style="font-size:11px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Session Type</div>
                          <div style="font-size:15px;font-weight:700;color:#0A0A0A;">${sessionIcon(sessionType)} &nbsp;${sessionType}</div>
                        </td>
                      </tr>

                      <tr>
                        <td style="padding:18px 24px;${notes ? 'border-bottom:1px solid #f0f0f0;' : ''}">
                          <div style="font-size:11px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Duration</div>
                          <div style="font-size:15px;font-weight:700;color:#0A0A0A;">⏱ &nbsp;${sessionDuration(sessionType)}</div>
                        </td>
                      </tr>

                      ${notes ? `
                      <tr>
                        <td style="padding:18px 24px;">
                          <div style="font-size:11px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Notes</div>
                          <div style="font-size:14px;color:#333;line-height:1.5;">📝 &nbsp;${notes}</div>
                        </td>
                      </tr>` : ''}

                    </table>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          ${recurring ? `
          <!-- Recurring Notice -->
          <tr>
            <td style="padding:0 40px 24px;">
              <div style="background:#eff6ff;border-left:4px solid #1D4ED8;border-radius:6px;padding:14px 18px;">
                <div style="font-size:13px;color:#1D4ED8;font-weight:700;">🔁 &nbsp;Recurring Weekly Session</div>
                <div style="font-size:12px;color:#555;margin-top:4px;line-height:1.5;">This session repeats weekly. You will receive a confirmation for each upcoming session.</div>
              </div>
            </td>
          </tr>` : ''}

          <!-- What to Bring -->
          <tr>
            <td style="padding:0 40px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fb;border-radius:10px;border:1px solid #e8eaed;">
                <tr>
                  <td style="padding:18px 24px;border-bottom:1px solid #e8eaed;">
                    <div style="font-size:11px;font-weight:700;color:#555;letter-spacing:2px;text-transform:uppercase;">What to Bring</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:18px 24px;">
                    <div style="font-size:13px;color:#444;line-height:2;">
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

          <!-- Contact -->
          <tr>
            <td style="padding:0 40px 36px;text-align:center;">
              <div style="font-size:13px;color:#666;line-height:1.7;">
                Need to reschedule or have questions?<br/>
                <a href="mailto:myfitpro@getfreddyfit.com" style="color:#1D4ED8;font-weight:700;text-decoration:none;">myfitpro@getfreddyfit.com</a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f4f6f8;padding:24px 40px;text-align:center;border-top:1px solid #e8eaed;">
              <div style="font-size:11px;color:#aaa;letter-spacing:1px;text-transform:uppercase;font-weight:600;">FreddyFit Professional Coaching</div>
              <div style="font-size:11px;color:#bbb;margin-top:4px;">© ${new Date().getFullYear()} FreddyFit. All rights reserved.</div>
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
