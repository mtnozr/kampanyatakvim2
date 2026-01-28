/**
 * Email Service - Resend Integration
 * Otomatik hatırlatma maili gönderir
 */

import { ReminderSettings, ReminderLog } from '../types';

interface SendEmailParams {
  to: string;
  toName: string;
  subject: string;
  html: string;
  eventId: string;
  eventTitle: string;
  eventType: 'campaign' | 'analytics';
  urgency: string;
}

interface EmailResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Resend API ile email gönderir
 */
export async function sendEmailWithResend(
  apiKey: string,
  params: SendEmailParams
): Promise<EmailResponse> {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Kampanya Takvimi <onboarding@resend.dev>', // Resend ücretsiz test email
        to: params.to,
        subject: params.subject,
        html: params.html,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Resend API error:', error);
      return {
        success: false,
        error: error.message || 'Email gönderilemedi',
      };
    }

    const data = await response.json();
    return {
      success: true,
      messageId: data.id,
    };
  } catch (error) {
    console.error('Email send error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
    };
  }
}

/**
 * Email template'ini oluşturur (değişkenleri değiştirir)
 */
export function buildEmailFromTemplate(
  template: string,
  variables: Record<string, string>
): string {
  let result = template;

  Object.entries(variables).forEach(([key, value]) => {
    const placeholder = `{${key}}`;
    result = result.replace(new RegExp(placeholder, 'g'), value);
  });

  return result;
}

/**
 * Varsayılan email HTML template'i
 */
export function getDefaultEmailHTML(params: {
  assigneeName: string;
  eventTitle: string;
  eventType: 'campaign' | 'analytics';
  urgency: string;
  daysElapsed: number;
}): string {
  const { assigneeName, eventTitle, eventType, urgency, daysElapsed } = params;

  const urgencyColors: Record<string, string> = {
    'Very High': '#EF4444',
    'High': '#F97316',
    'Medium': '#3B82F6',
    'Low': '#6B7280',
  };

  const urgencyLabels: Record<string, string> = {
    'Very High': 'Çok Yüksek',
    'High': 'Yüksek',
    'Medium': 'Orta',
    'Low': 'Düşük',
  };

  const color = urgencyColors[urgency] || '#6B7280';
  const urgencyLabel = urgencyLabels[urgency] || urgency;
  const typeLabel = eventType === 'campaign' ? 'Kampanya' : 'Analitik Görev';

  return `
    <!DOCTYPE html>
    <html lang="tr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Hatırlatma</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color: #F8F9FE;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F8F9FE; padding: 40px 20px;">
        <tr>
          <td align="center">
            <!-- Email Container -->
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">

              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #7C3AED 0%, #4338CA 100%); padding: 32px; text-align: center;">
                  <h1 style="margin: 0; color: #FFFFFF; font-size: 24px; font-weight: 700;">
                    📅 Kampanya Takvimi
                  </h1>
                  <p style="margin: 8px 0 0 0; color: #E9D5FF; font-size: 14px;">
                    Hatırlatma Bildirimi
                  </p>
                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td style="padding: 32px;">

                  <!-- Greeting -->
                  <p style="margin: 0 0 24px 0; font-size: 16px; color: #1F2937;">
                    Merhaba <strong>${assigneeName}</strong>,
                  </p>

                  <!-- Alert Box -->
                  <div style="background-color: #FEF3C7; border-left: 4px solid ${color}; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
                    <p style="margin: 0; font-size: 14px; color: #78350F;">
                      ⏰ Atanan göreviniz üzerinden <strong>${daysElapsed} gün</strong> geçti.
                    </p>
                  </div>

                  <!-- Event Info -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F9FAFB; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                    <tr>
                      <td>
                        <p style="margin: 0 0 8px 0; font-size: 12px; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px;">
                          ${typeLabel}
                        </p>
                        <h2 style="margin: 0 0 16px 0; font-size: 20px; color: #1F2937; font-weight: 600;">
                          ${eventTitle}
                        </h2>

                        <!-- Urgency Badge -->
                        <div style="display: inline-block; background-color: ${color}15; border: 1px solid ${color}; border-radius: 6px; padding: 6px 12px;">
                          <span style="color: ${color}; font-size: 12px; font-weight: 600;">
                            ${urgencyLabel} Öncelik
                          </span>
                        </div>
                      </td>
                    </tr>
                  </table>

                  <!-- Message -->
                  <p style="margin: 0 0 24px 0; font-size: 14px; color: #4B5563; line-height: 1.6;">
                    Lütfen görevinizin durumunu kontrol edin ve gerekli aksiyonları alın.
                    Herhangi bir sorun veya gecikme varsa lütfen yöneticinizle iletişime geçin.
                  </p>

                  <!-- CTA Button -->
                  <div style="text-align: center; margin: 32px 0;">
                    <a href="https://kampanya-takvimi.vercel.app"
                       style="display: inline-block; background: linear-gradient(135deg, #7C3AED 0%, #4338CA 100%); color: #FFFFFF; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 6px rgba(124, 58, 237, 0.3);">
                      Takvime Git →
                    </a>
                  </div>

                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #F9FAFB; padding: 24px; text-align: center; border-top: 1px solid #E5E7EB;">
                  <p style="margin: 0 0 8px 0; font-size: 12px; color: #6B7280;">
                    Bu otomatik bir hatırlatma mailidir.
                  </p>
                  <p style="margin: 0; font-size: 12px; color: #9CA3AF;">
                    Kampanya Takvimi © ${new Date().getFullYear()}
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

/**
 * Test email gönderir
 */
export async function sendTestEmail(
  apiKey: string,
  recipientEmail: string
): Promise<EmailResponse> {
  const testHTML = getDefaultEmailHTML({
    assigneeName: 'Test Kullanıcı',
    eventTitle: 'Test Kampanyası',
    eventType: 'campaign',
    urgency: 'High',
    daysElapsed: 2,
  });

  return sendEmailWithResend(apiKey, {
    to: recipientEmail,
    toName: 'Test Kullanıcı',
    subject: '🧪 Test Email - Kampanya Takvimi Hatırlatma',
    html: testHTML,
    eventId: 'test-event-id',
    eventTitle: 'Test Kampanyası',
    eventType: 'campaign',
    urgency: 'High',
  });
}
