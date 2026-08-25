import nodemailer from 'nodemailer';

function getTransporter() {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host:   process.env.SMTP_HOST,
      port:   Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_PASS;
  if (
    gmailUser && gmailPass &&
    !gmailUser.includes('your_') && !gmailPass.includes('your_') &&
    gmailUser.includes('@') && gmailPass.length >= 8
  ) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user: gmailUser, pass: gmailPass },
    });
  }
  return null;
}

/**
 * Sanitize name for use in HTML emails — prevent HTML injection in emails.
 */
function sanitizeName(name) {
  if (!name || typeof name !== 'string') return 'there';
  return name.replace(/[<>&"']/g, '').slice(0, 100).trim() || 'there';
}

export async function sendOTPEmail(to, otp, name = '') {
  const transporter = getTransporter();
  const safeName = sanitizeName(name);

  const html = `
    <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;background:#fff;border:1px solid #E4E7EC;border-radius:16px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#3E4C8A,#6366F1);padding:28px 32px">
        <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700">EduVision</h1>
        <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:13px">Academic Intelligence Platform</p>
      </div>
      <div style="padding:32px">
        <p style="color:#1A1D23;font-size:15px;margin:0 0 8px">Hi ${safeName},</p>
        <p style="color:#6B7280;font-size:14px;margin:0 0 24px">Your one-time verification code is:</p>
        <div style="background:#F7F8FA;border:2px dashed #C7D2FE;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px">
          <span style="font-size:36px;font-weight:800;letter-spacing:10px;color:#3E4C8A;font-family:monospace">${otp}</span>
        </div>
        <p style="color:#6B7280;font-size:13px;margin:0 0 4px">⏱ This code expires in <strong>10 minutes</strong>.</p>
        <p style="color:#9CA3AF;font-size:12px;margin:0">If you didn't request this, please ignore this email.</p>
      </div>
      <div style="background:#F7F8FA;padding:16px 32px;border-top:1px solid #E4E7EC">
        <p style="color:#9CA3AF;font-size:11px;margin:0">© 2026 EduVision · SIH Academic Platform</p>
      </div>
    </div>
  `;

  if (!transporter) {
    // Dev fallback — log that OTP was sent, but never log the actual OTP value
    if (process.env.NODE_ENV !== 'production') {
      console.log(`📧 [OTP Email] Sent to: ${to} (code length: ${otp?.length || 0})`);
    }
    return { success: true, preview: 'OTP email queued (dev mode)' };
  }

  await transporter.sendMail({
    from: `"EduVision" <${process.env.SMTP_USER || process.env.GMAIL_USER || 'noreply@eduvision.ai'}>`,
    to,
    subject: `Your EduVision Verification Code`,
    html,
  });

  return { success: true };
}

export async function sendAccountApprovedEmail(to, name = '') {
  const transporter = getTransporter();
  const safeName = sanitizeName(name);
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

  const html = `
    <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;background:#fff;border:1px solid #E4E7EC;border-radius:16px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#059669,#10B981);padding:28px 32px">
        <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700">EduVision</h1>
        <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:13px">Account Approved</p>
      </div>
      <div style="padding:32px">
        <div style="text-align:center;margin-bottom:24px">
          <div style="width:56px;height:56px;border-radius:50%;background:#ECFDF5;border:2px solid #10B981;display:inline-flex;align-items:center;justify-content:center;font-size:28px">✅</div>
        </div>
        <p style="color:#1A1D23;font-size:15px;margin:0 0 8px">Hi ${safeName},</p>
        <p style="color:#6B7280;font-size:14px;margin:0 0 20px;line-height:1.6">Your account has been approved successfully. Your EduVision account is now active. You can now log in using your registered email and password.</p>
        <div style="text-align:center;margin-bottom:24px">
          <a href="${baseUrl}/login" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#0D9488,#4F46E5);color:#fff;text-decoration:none;border-radius:12px;font-weight:700;font-size:14px">Sign In to EduVision</a>
        </div>
        <div style="background:#F7F8FA;border-radius:8px;padding:12px 16px;border-left:3px solid #10B981">
          <p style="color:#065F46;font-size:12px;margin:0;line-height:1.5">Your registration has been verified and approved by the administrator. Welcome to the platform!</p>
        </div>
      </div>
      <div style="background:#F7F8FA;padding:16px 32px;border-top:1px solid #E4E7EC">
        <p style="color:#9CA3AF;font-size:11px;margin:0">© 2026 EduVision · SIH Academic Platform</p>
      </div>
    </div>
  `;

  if (!transporter) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`📧 [Account Approved] Email sent to: ${to}`);
    }
    return { success: true };
  }

  await transporter.sendMail({
    from: `"EduVision" <${process.env.SMTP_USER || process.env.GMAIL_USER || 'noreply@eduvision.ai'}>`,
    to,
    subject: 'Your EduVision Account Has Been Approved',
    html,
  });

  return { success: true };
}

export async function sendAccountRejectedEmail(to, name = '', reason = '') {
  const transporter = getTransporter();
  const safeName = sanitizeName(name);
  const safeReason = sanitizeName(reason);
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

  const html = `
    <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;background:#fff;border:1px solid #E4E7EC;border-radius:16px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#DC2626,#EF4444);padding:28px 32px">
        <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700">EduVision</h1>
        <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:13px">Registration Update</p>
      </div>
      <div style="padding:32px">
        <p style="color:#1A1D23;font-size:15px;margin:0 0 8px">Hi ${safeName},</p>
        <p style="color:#6B7280;font-size:14px;margin:0 0 20px;line-height:1.6">We regret to inform you that your registration request was not approved by the administrator.</p>
        ${safeReason ? `<div style="background:#FEF2F2;border-radius:8px;padding:12px 16px;border-left:3px solid #EF4444;margin-bottom:20px">
          <p style="color:#991B1B;font-size:12px;margin:0 0 4px;font-weight:600">Reason:</p>
          <p style="color:#991B1B;font-size:13px;margin:0">${safeReason}</p>
        </div>` : ''}
        <p style="color:#6B7280;font-size:13px;margin:0 0 16px;line-height:1.6">Please contact the administrator for further assistance, or try registering again with the correct information.</p>
        <div style="text-align:center;margin-bottom:16px">
          <a href="${baseUrl}/register" style="display:inline-block;padding:12px 24px;background:#F7F8FA;color:#374151;text-decoration:none;border-radius:10px;font-weight:600;font-size:13px;border:1px solid #E5E7EB">Register Again</a>
        </div>
      </div>
      <div style="background:#F7F8FA;padding:16px 32px;border-top:1px solid #E4E7EC">
        <p style="color:#9CA3AF;font-size:11px;margin:0">© 2026 EduVision · SIH Academic Platform</p>
      </div>
    </div>
  `;

  if (!transporter) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`📧 [Account Rejected] Email sent to: ${to}`);
    }
    return { success: true };
  }

  await transporter.sendMail({
    from: `"EduVision" <${process.env.SMTP_USER || process.env.GMAIL_USER || 'noreply@eduvision.ai'}>`,
    to,
    subject: 'Your EduVision Registration — Action Required',
    html,
  });

  return { success: true };
}

export async function sendResetEmail(to, name, resetUrl) {
  const transporter = getTransporter();
  const safeName = sanitizeName(name);
  // Never log the full reset URL in production
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

  const html = `
    <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;background:#fff;border:1px solid #E4E7EC;border-radius:16px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#0C1222,#1A2535);padding:28px 32px">
        <h1 style="color:#0D9488;margin:0;font-size:22px;font-weight:700">EduVision</h1>
        <p style="color:rgba(255,255,255,0.6);margin:4px 0 0;font-size:13px">Password Reset Request</p>
      </div>
      <div style="padding:32px">
        <p style="color:#1A1D23;font-size:15px;margin:0 0 8px">Hi ${safeName},</p>
        <p style="color:#6B7280;font-size:14px;margin:0 0 24px;line-height:1.6">We received a request to reset your password. Click the button below to set a new password:</p>
        <div style="text-align:center;margin-bottom:24px">
          <a href="${resetUrl}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#0D9488,#4F46E5);color:#fff;text-decoration:none;border-radius:12px;font-weight:700;font-size:14px">Reset Password</a>
        </div>
        <p style="color:#6B7280;font-size:13px;margin:0 0 4px">⏱ This link expires in <strong>15 minutes</strong>.</p>
        <p style="color:#9CA3AF;font-size:12px;margin:0 0 16px">If you didn't request this, you can safely ignore this email. Your password will remain unchanged.</p>
        <div style="background:#F7F8FA;border-radius:8px;padding:12px 16px;border-left:3px solid #D97706">
          <p style="color:#92400E;font-size:12px;margin:0;font-weight:600">🔒 Security tip: Never share this link with anyone. EduVision staff will never ask for your password.</p>
        </div>
      </div>
      <div style="background:#F7F8FA;padding:16px 32px;border-top:1px solid #E4E7EC">
        <p style="color:#9CA3AF;font-size:11px;margin:0">© 2026 EduVision · SIH Academic Platform</p>
      </div>
    </div>
  `;

  if (!transporter) {
    // NEVER log the reset URL — it's a security token
    if (process.env.NODE_ENV !== 'production') {
      console.log(`📧 [Password Reset] Email queued for: ${to}`);
    }
    return { success: true };
  }

  await transporter.sendMail({
    from: `"EduVision" <${process.env.SMTP_USER || process.env.GMAIL_USER || 'noreply@eduvision.ai'}>`,
    to,
    subject: 'Reset your EduVision password',
    html,
  });

  return { success: true };
}
