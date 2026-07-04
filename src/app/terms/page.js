export const metadata = {
  title: 'Terms & Conditions | FreddyFit',
}

const ACCENT = '#2BAADF'
const TEXT = '#1A202C'
const SUB = '#718096'
const BORDER = '#E2E8F0'

export default function TermsAndConditions() {
  return (
    <div style={{ minHeight: '100dvh', background: '#F8F9FA', fontFamily: 'Montserrat, sans-serif', padding: '48px 24px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', background: '#fff', borderRadius: 16, padding: '40px 36px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
        <div style={{ marginBottom: 24 }}>
          <span style={{ fontWeight: 800, fontSize: 22, letterSpacing: 2, color: '#8C9199' }}>FREDDY</span>
          <span style={{ fontWeight: 800, fontSize: 22, letterSpacing: 2, color: ACCENT }}>FIT</span>
        </div>

        <h1 style={{ fontSize: 24, fontWeight: 800, color: TEXT, marginBottom: 4 }}>Terms &amp; Conditions</h1>
        <p style={{ fontSize: 12, color: SUB, marginBottom: 28 }}>Last updated: July 4, 2026</p>

        <Section title="About These Terms">
          These terms apply to your use of the FreddyFit website and communications, including the FreddyFit SMS
          Messaging Program described below.
        </Section>

        <Section title="FreddyFit SMS Messaging Program">
          By submitting your phone number through a form on this site, you consent to receive text messages from
          FreddyFit related to your inquiry and, if you become a client, your training sessions &mdash; including
          lead follow-up, appointment confirmations, scheduling changes, and session reminders.
          <div style={{ marginTop: 12 }}>
            <strong>Message frequency</strong> varies depending on your interactions with FreddyFit (for example, how
            many sessions you have scheduled).
          </div>
          <div style={{ marginTop: 8 }}>
            <strong>Message and data rates may apply.</strong> Carrier fees may apply depending on your mobile plan.
          </div>
          <div style={{ marginTop: 8 }}>
            Reply <strong>STOP</strong> at any time to opt out of text messages. Reply <strong>HELP</strong> for
            assistance, or contact us at{' '}
            <a href="mailto:myfitpro@getfreddyfit.com" style={{ color: ACCENT, fontWeight: 700, textDecoration: 'none' }}>
              myfitpro@getfreddyfit.com
            </a>.
          </div>
          <div style={{ marginTop: 8 }}>
            Text messaging originator opt-in data and consent will not be shared with any third parties for marketing
            purposes.
          </div>
        </Section>

        <Section title="Services">
          FreddyFit provides personal training coaching services, including assessments, program design, and
          in-person or virtual training sessions. Scheduling, program details, and package pricing are communicated
          directly between FreddyFit and the client.
        </Section>

        <Section title="No Medical Advice">
          FreddyFit provides fitness coaching, not medical advice. Consult a physician before beginning any exercise
          program, particularly if you have an existing medical condition or injury.
        </Section>

        <Section title="Changes to These Terms">
          FreddyFit may update these terms from time to time. Continued use of our services or communications after
          changes are posted constitutes acceptance of the updated terms.
        </Section>

        <Section title="Contact Us">
          Questions about these terms can be sent to{' '}
          <a href="mailto:myfitpro@getfreddyfit.com" style={{ color: ACCENT, fontWeight: 700, textDecoration: 'none' }}>
            myfitpro@getfreddyfit.com
          </a>.
        </Section>

        <div style={{ marginTop: 32, paddingTop: 20, borderTop: `1px solid ${BORDER}`, fontSize: 12, color: SUB }}>
          FreddyFit Personal Training &middot; 6047 Telegraph Road, Saint Louis, MO 63129
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', color: ACCENT, marginBottom: 8 }}>
        {title}
      </div>
      <div style={{ fontSize: 14, color: TEXT, lineHeight: 1.7 }}>{children}</div>
    </div>
  )
}
