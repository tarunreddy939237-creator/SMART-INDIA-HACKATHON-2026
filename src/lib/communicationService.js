/**
 * Communication Service — WhatsApp / SMS abstraction
 *
 * Uses environment variables for provider credentials.
 * Falls back to console logging in dev when no provider is configured.
 *
 * Environment variables:
 * - WHATSAPP_API_URL, WHATSAPP_API_TOKEN, WHATSAPP_FROM_NUMBER
 * - SMS_API_URL, SMS_API_TOKEN, SMS_FROM_NUMBER
 * - FRONTEND_URL (for building secure report links)
 */

/**
 * Mask a phone number for display: +919876543210 → +91****3210
 */
export function maskPhone(phone) {
  if (!phone || typeof phone !== 'string') return '***';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length <= 4) return '*'.repeat(cleaned.length);
  return phone.slice(0, -4).replace(/[0-9]/g, '*') + phone.slice(-4);
}

/**
 * Validate a phone number (basic E.164-like check).
 */
export function isValidPhone(phone) {
  if (!phone || typeof phone !== 'string') return false;
  const cleaned = phone.replace(/[\s\-()]/g, '');
  return /^\+?[0-9]{7,15}$/.test(cleaned);
}

/**
 * Send a WhatsApp message.
 * @param {string} to - Phone number (E.164 format preferred)
 * @param {string} message - Message text
 * @returns {{ success: boolean, messageId?: string, error?: string }}
 */
export async function sendWhatsApp(to, message) {
  const apiUrl = process.env.WHATSAPP_API_URL;
  const apiToken = process.env.WHATSAPP_API_TOKEN;
  const fromNumber = process.env.WHATSAPP_FROM_NUMBER;

  // Dev fallback — log message to console
  if (!apiUrl || !apiToken) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`📱 [WhatsApp DEV] To: ${to}`);
      console.log(`   Message: ${message.substring(0, 100)}...`);
    }
    return { success: true, messageId: 'dev-' + Date.now(), preview: true };
  }

  try {
    // Generic API call — adapt URL/payload to your provider (Twilio, MessageBird, etc.)
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromNumber,
        to,
        type: 'text',
        text: { body: message },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return { success: false, error: `Provider error: ${response.status}` };
    }

    const data = await response.json();
    return { success: true, messageId: data.messages?.[0]?.id || '' };
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[WhatsApp] Send failed:', error.message);
    }
    return { success: false, error: 'Failed to send WhatsApp message.' };
  }
}

/**
 * Send an SMS message.
 * @param {string} to - Phone number
 * @param {string} message - Message text
 * @returns {{ success: boolean, messageId?: string, error?: string }}
 */
export async function sendSMS(to, message) {
  const apiUrl = process.env.SMS_API_URL;
  const apiToken = process.env.SMS_API_TOKEN;
  const fromNumber = process.env.SMS_FROM_NUMBER;

  // Dev fallback
  if (!apiUrl || !apiToken) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`💬 [SMS DEV] To: ${to}`);
      console.log(`   Message: ${message.substring(0, 100)}...`);
    }
    return { success: true, messageId: 'dev-' + Date.now(), preview: true };
  }

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromNumber,
        to,
        message,
      }),
    });

    if (!response.ok) {
      return { success: false, error: `Provider error: ${response.status}` };
    }

    const data = await response.json();
    return { success: true, messageId: data.messageId || data.sid || '' };
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[SMS] Send failed:', error.message);
    }
    return { success: false, error: 'Failed to send SMS.' };
  }
}

/**
 * Build the report message for WhatsApp.
 */
export function buildWhatsAppMessage(studentName, reportUrl) {
  return `📊 EduDev Student Report\n\nThe complete academic report for *${studentName}* is ready.\n\nView the secure report:\n${reportUrl}\n\n🔗 This link expires in 7 days.\n— EduDev Academic Platform`;
}

/**
 * Build the report message for SMS.
 */
export function buildSMSMessage(studentName, reportUrl) {
  return `EduDev: The academic report for ${studentName} is ready. View securely: ${reportUrl} (expires in 7 days)`;
}
