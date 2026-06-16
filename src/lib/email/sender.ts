export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export type EmailResult = { ok: true } | { ok: false; error: string };

export async function sendEmail(payload: EmailPayload): Promise<EmailResult> {
  const provider = process.env.EMAIL_PROVIDER ?? 'log';

  if (provider === 'log' || !process.env.EMAIL_PROVIDER) {
    // Dev mode: log to console instead of sending
    console.log('[email]', { to: payload.to, subject: payload.subject });
    return { ok: true };
  }

  if (provider === 'smtp') {
    // Placeholder SMTP — wire nodemailer here when SMTP_HOST/USER/PASS are set
    console.log('[email:smtp] Would send to', payload.to);
    return { ok: true };
  }

  if (provider === 'resend') {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM ?? 'noreply@coder.app',
          to: payload.to,
          subject: payload.subject,
          html: payload.html,
          text: payload.text,
        }),
      });
      if (!res.ok) return { ok: false, error: `Resend error: ${res.status}` };
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }

  return { ok: false, error: `Unknown provider: ${provider}` };
}
