export const metadata = {
  title: 'Privacy Policy | FreddyFit',
}

const ACCENT = '#2BAADF'
const TEXT = '#1A202C'
const SUB = '#718096'
const BORDER = '#E2E8F0'

export default function PrivacyPolicy() {
  return (
    <div style={{ minHeight: '100dvh', background: '#F8F9FA', fontFamily: 'Montserrat, sans-serif', padding: '48px 24px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', background: '#fff', borderRadius: 16, padding: '40px 36px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
        <div style={{ marginBottom: 24 }}>
          <span style={{ fontWeight: 800, fontSize: 22, letterSpacing: 2, color: '#8C9199' }}>FREDDY</span>
          <span style={{ fontWeight: 800, fontSize: 22, letterSpacing: 2, color: ACCENT }}>FIT</span>
        </div>

        <h1 style={{ fontSize: 24, fontWeight: 800, color: TEXT, marginBottom: 4 }}>Privacy Policy</h1>
        <p style={{ fontSize: 12, color: SUB, marginBottom: 28 }}>Last updated: July 4, 2026</p>

        <Section title="Information We Collect">
          When you submit a form on this site (lead inquiry, performance assessment, or consultation request), we collect
          the information you provide, which may include your name, phone number, email address, fitness goals,
          training preferences, and relevant medical or injury history you choose to share. If you become a client,
          we also maintain records related to your training program, workout history, weight and body composition
          logs, and session scheduling.
        </Section>

        <Section title="How We Use Your Information">
          We use your information to respond to your inquiry, schedule and confirm training sessions, communicate
          with you about your fitness program, and provide coaching services. This includes contacting you by email,
          phone call, or SMS text message.
        </Section>

        <Section title="Text Messaging (SMS)">
          If you provide your phone number, FreddyFit may send you text messages related to your inquiry or your
          training sessions, such as lead follow-up, appointment confirmations, and scheduling reminders. Message
          and data rates may apply. Message frequency varies based on your interactions with us. You can opt out of
          text messages at any time by replying <strong>STOP</strong>. For help, reply <strong>HELP</strong> or contact
          us at the email below.
        </Section>

        <Section title="Information Sharing">
          We do not sell, rent, or share your personal information with third parties for marketing purposes.
          Your information is used solely to operate FreddyFit's coaching services and is only shared with the
          service providers we rely on to run this application (such as our database, email, and payment processors),
          solely to the extent necessary to provide those services.
        </Section>

        <Section title="Payments">
          Package payments are processed through Stripe, a third-party payment processor. We do not store your
          payment card details on our servers.
        </Section>

        <Section title="Data Retention">
          We retain client and lead information for as long as needed to provide our services and maintain business
          records, or until you request deletion.
        </Section>

        <Section title="Your Choices">
          You may request access to, correction of, or deletion of your personal information at any time by
          contacting us using the information below.
        </Section>

        <Section title="Contact Us">
          Questions about this policy or your information can be sent to{' '}
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
