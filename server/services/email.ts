import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

function getAppUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL;
  if (process.env.RAILWAY_PUBLIC_DOMAIN) return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  return 'http://localhost:5000';
}

export async function sendPasswordResetEmail(toEmail: string, token: string): Promise<void> {
  const resetUrl = `${getAppUrl()}/#/reset-password/${token}`;

  if (!resend) {
    // Development fallback — log to console
    console.log(`[EMAIL] Password reset link for ${toEmail}: ${resetUrl}`);
    return;
  }

  await resend.emails.send({
    from: 'MealPrep <onboarding@resend.dev>',
    to: toEmail,
    subject: 'Reset your MealPrep password',
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff">
        <div style="margin-bottom:24px">
          <span style="font-size:24px">🍳</span>
          <span style="font-size:18px;font-weight:700;color:#111;margin-left:8px">MealPrep</span>
        </div>
        <h1 style="font-size:22px;font-weight:700;color:#111;margin:0 0 8px">Reset your password</h1>
        <p style="color:#6b7280;margin:0 0 28px;line-height:1.6">
          We received a request to reset your password. Click the button below — this link expires in 15 minutes.
        </p>
        <a href="${resetUrl}"
           style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#4f46e5);color:#fff;padding:13px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px">
          Reset Password
        </a>
        <p style="color:#9ca3af;margin-top:28px;font-size:12px;line-height:1.6">
          If you didn't request this you can safely ignore this email.<br/>
          Or copy this link: <span style="color:#7c3aed">${resetUrl}</span>
        </p>
      </div>
    `,
  });
}
