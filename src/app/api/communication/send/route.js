import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/multiTenant.js';
import connectToDatabase from '@/lib/mongodb.js';
import User from '@/lib/models/User.js';
import CommunicationLog from '@/lib/models/CommunicationLog.js';
import SecureReportLink from '@/lib/models/SecureReportLink.js';
import crypto from 'crypto';
import {
  sendWhatsApp, sendSMS, isValidPhone, maskPhone,
  buildWhatsAppMessage, buildSMSMessage,
} from '@/lib/communicationService.js';
import { buildRateLimit } from '@/lib/rateLimit.js';
import { logSecurityEvent, AuditActions } from '@/lib/auditLog.js';

/**
 * POST /api/communication/send
 * Send a student report to a parent via WhatsApp or SMS.
 * Body: { studentId, channel: 'whatsapp' | 'sms' }
 *
 * Rate limited: 5 sends per 10 minutes per faculty.
 */
export async function POST(request) {
  // Rate limit: prevent spam sends
  const { result: rl } = buildRateLimit(request, 'comm-send', {
    max: 5,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Too many send requests. Please try again in ${Math.ceil(rl.retryAfterMs / 1000)} seconds.` },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  try {
    const auth = await getAuthUser(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    // Only faculty and admin can send reports
    const allowedRoles = ['faculty', 'admin', 'college_admin', 'super_admin'];
    if (!allowedRoles.includes(auth.user.role)) {
      return NextResponse.json({ error: 'Faculty access required.' }, { status: 403 });
    }

    const body = await request.json();
    const { studentId, channel } = body;

    if (!studentId || !channel) {
      return NextResponse.json({ error: 'studentId and channel are required.' }, { status: 400 });
    }

    if (!['whatsapp', 'sms'].includes(channel)) {
      return NextResponse.json({ error: 'Channel must be whatsapp or sms.' }, { status: 400 });
    }

    await connectToDatabase();

    // Get student info
    const student = await User.findById(studentId).lean();
    if (!student) {
      return NextResponse.json({ error: 'Student not found.' }, { status: 404 });
    }

    // Get parent contact info
    const phone = student.guardianContact?.phone || student.guardianPhone;
    if (!phone || !isValidPhone(phone)) {
      return NextResponse.json({
        error: 'No valid parent phone number found for this student.',
        studentName: student.name,
      }, { status: 400 });
    }

    // Generate secure report link
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await SecureReportLink.create({
      token,
      studentId,
      createdBy: auth.user._id,
      collegeId: auth.user.collegeId || null,
      expiresAt,
      maxViews: 10,
      purpose: channel,
    });

    const baseUrl = process.env.FRONTEND_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const reportUrl = `${baseUrl}/parent/report/view?token=${token}`;

    // Build message
    const message = channel === 'whatsapp'
      ? buildWhatsAppMessage(student.name, reportUrl)
      : buildSMSMessage(student.name, reportUrl);

    // Send via the appropriate channel
    let sendResult;
    if (channel === 'whatsapp') {
      sendResult = await sendWhatsApp(phone, message);
    } else {
      sendResult = await sendSMS(phone, message);
    }

    // Log the communication
    const logEntry = await CommunicationLog.create({
      studentId,
      parentUserId: null, // We don't have a parent user account linked yet
      collegeId: auth.user.collegeId || null,
      channel,
      sentBy: auth.user._id,
      messagePreview: message.substring(0, 200),
      reportLinkToken: token,
      status: sendResult.success ? 'sent' : 'failed',
      providerMessageId: sendResult.messageId || '',
      failureReason: sendResult.error || '',
      sentAt: sendResult.success ? new Date() : null,
    });

    logSecurityEvent({
      action: AuditActions.ADMIN_ACTION,
      actor: auth.user.email || auth.user._id,
      target: student.email,
      meta: { action: 'send_report', channel, success: sendResult.success },
      status: sendResult.success ? 'success' : 'failure',
    });

    if (sendResult.success) {
      return NextResponse.json({
        success: true,
        message: `Report sent successfully to ${maskPhone(phone)} via ${channel}.`,
        logId: logEntry._id,
        maskedPhone: maskPhone(phone),
      });
    } else {
      return NextResponse.json({
        success: false,
        error: 'Report could not be sent. Please try again.',
        detail: process.env.NODE_ENV !== 'production' ? sendResult.error : undefined,
      }, { status: 500 });
    }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[communication/send] Error:', error.message);
    }
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}
