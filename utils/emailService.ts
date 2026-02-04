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
  cc?: string[];  // Array of email addresses to CC
}

interface EmailResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Resend API ile email gönderir (Backend üzerinden)
 */
export async function sendEmailWithResend(
  apiKey: string,
  params: SendEmailParams
): Promise<EmailResponse> {
  try {
    // Backend API endpoint'imizi kullan (CORS sorununu çözer)
    // Vercel dev sunucusu hem dev hem prod için aynı path'i kullanır
    const apiUrl = '/api/send-reminder';

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        apiKey: apiKey,
        to: params.to,
        toName: params.toName,
        subject: params.subject,
        html: params.html,
        cc: params.cc || [],
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('API error:', error);
      return {
        success: false,
        error: error.error || 'Email gönderilemedi',
      };
    }

    const data = await response.json();
    return {
      success: data.success,
      messageId: data.messageId,
      error: data.error,
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
 * Custom email body template'inden HTML oluşturur
 */
export function buildCustomEmailHTML(params: {
  assigneeName: string;
  eventTitle: string;
  eventType: 'campaign' | 'analytics';
  urgency: string;
  daysElapsed: number;
  customBodyTemplate?: string;
}): string {
  const { assigneeName, eventTitle, eventType, urgency, daysElapsed, customBodyTemplate } = params;

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

  // Eğer custom template varsa, değişkenleri değiştir
  let messageContent = customBodyTemplate ||
    `Lütfen görevinizin durumunu kontrol edin ve gerekli aksiyonları alın.
     Herhangi bir sorun veya gecikme varsa lütfen yöneticinizle iletişime geçin.`;

  // Template değişkenlerini değiştir
  messageContent = buildEmailFromTemplate(messageContent, {
    assignee: assigneeName,
    title: eventTitle,
    urgency: urgencyLabel,
    days: daysElapsed.toString(),
    eventType: typeLabel,
  });

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

                  <!-- Custom Message -->
                  <div style="margin: 0 0 24px 0; font-size: 14px; color: #4B5563; line-height: 1.6;">
                    ${messageContent.split('\n').map(line => `<p style="margin: 0 0 12px 0;">${line.trim()}</p>`).join('')}
                  </div>

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
 * Varsayılan email HTML template'i
 * @deprecated Use buildCustomEmailHTML instead
 */
export function getDefaultEmailHTML(params: {
  assigneeName: string;
  eventTitle: string;
  eventType: 'campaign' | 'analytics';
  urgency: string;
  daysElapsed: number;
}): string {
  return buildCustomEmailHTML(params);
}

/**
 * @deprecated - Eski versiyon, kaldırılacak
 */
function getDefaultEmailHTMLOld(params: {
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


/**
 * Build HTML for report delay emails
 */
export function buildReportDelayEmailHTML(params: {
  assigneeName: string;
  reportTitle: string;
  campaignTitle?: string;
  daysOverdue: number;
}): string {
  const { assigneeName, reportTitle, campaignTitle, daysOverdue } = params;

  return `
    <!DOCTYPE html>
    <html lang="tr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Rapor Gecikme Bildirimi</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color: #F8F9FE;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F8F9FE; padding: 40px 20px;">
        <tr>
          <td align="center">
            <!-- Email Container -->
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">

              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #DC2626 0%, #991B1B 100%); padding: 32px; text-align: center;">
                  <h1 style="margin: 0; color: #FFFFFF; font-size: 24px; font-weight: 700;">
                    ⚠️ Rapor Gecikme Bildirimi
                  </h1>
                  <p style="margin: 8px 0 0 0; color: #FEE2E2; font-size: 14px;">
                    Kampanya Takvimi
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
                  <div style="background-color: #FEE2E2; border-left: 4px solid #DC2626; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
                    <p style="margin: 0; font-size: 14px; color: #991B1B;">
                      ⏰ Rapor teslim tarihinden <strong>${daysOverdue} gün</strong> geçti.
                    </p>
                  </div>

                  <!-- Report Info -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F9FAFB; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                    <tr>
                      <td>
                        <p style="margin: 0 0 8px 0; font-size: 12px; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px;">
                          📊 RAPOR
                        </p>
                        <h2 style="margin: 0 0 16px 0; font-size: 20px; color: #1F2937; font-weight: 600;">
                          ${reportTitle}
                        </h2>
                        ${campaignTitle ? `
                        <p style="margin: 0; font-size: 14px; color: #6B7280;">
                          🎯 Kampanya: <strong>${campaignTitle}</strong>
                        </p>
                        ` : ''}

                        <!-- Status Badge -->
                        <div style="display: inline-block; background-color: #FEE2E2; border: 1px solid #DC2626; border-radius: 6px; padding: 6px 12px; margin-top: 12px;">
                          <span style="color: #DC2626; font-size: 12px; font-weight: 600;">
                            ⚠️ GECİKMİŞ
                          </span>
                        </div>
                      </td>
                    </tr>
                  </table>

                  <!-- Message -->
                  <div style="margin: 0 0 24px 0; font-size: 14px; color: #4B5563; line-height: 1.6;">
                    <p style="margin: 0 0 12px 0;">
                      Lütfen bu raporu en kısa sürede tamamlayın.
                    </p>
                    <p style="margin: 0 0 12px 0;">
                      Herhangi bir sorun veya ek süreye ihtiyacınız varsa lütfen yöneticinizle iletişime geçin.
                    </p>
                  </div>

                  <!-- CTA Button -->
                  <div style="text-align: center; margin: 32px 0;">
                    <a href="https://kampanya-takvimi.vercel.app"
                       style="display: inline-block; background: linear-gradient(135deg, #DC2626 0%, #991B1B 100%); color: #FFFFFF; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 6px rgba(220, 38, 38, 0.3);">
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
 * Send report delay notification email
 */
export async function sendReportDelayEmail(
  apiKey: string,
  recipientEmail: string,
  recipientName: string,
  report: { id: string; title: string; campaignTitle?: string },
  daysOverdue: number
): Promise<EmailResponse> {
  const html = buildReportDelayEmailHTML({
    assigneeName: recipientName,
    reportTitle: report.title,
    campaignTitle: report.campaignTitle,
    daysOverdue,
  });

  const subject = `⚠️ Rapor Gecikme Bildirimi: ${report.title}`;

  return sendEmailWithResend(apiKey, {
    to: recipientEmail,
    toName: recipientName,
    subject,
    html,
    eventId: report.id,
    eventTitle: report.title,
    eventType: 'campaign', // Reports are related to campaigns
    urgency: 'High', // Overdue reports are high urgency
  });
}

/**
 * Build HTML for weekly digest emails
 */
export function buildWeeklyDigestHTML(params: {
  recipientName: string;
  digestContent: {
    overdueReports: Array<{
      title: string;
      campaignTitle?: string;
      daysOverdue: number;
      assigneeName: string;
    }>;
    thisWeekCampaigns: Array<{
      title: string;
      date: Date;
      urgencyLabel: string;
      assigneeName: string;
      status?: string;
    }>;
    totalOverdueReports: number;
    totalThisWeekCampaigns: number;
  };
  weekStart: Date;
  weekEnd: Date;
}): string {
  const { recipientName, digestContent, weekStart, weekEnd } = params;

  // Format week range
  const weekRangeStr = `${weekStart.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })} - ${weekEnd.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}`;

  // Build overdue reports table
  let overdueReportsHTML = '';
  if (digestContent.totalOverdueReports > 0) {
    overdueReportsHTML = `
      <h3 style="margin: 24px 0 16px 0; font-size: 18px; color: #DC2626; font-weight: 600;">
        ⚠️ Gecikmiş Raporlar (${digestContent.totalOverdueReports})
      </h3>
      <table width="100%" cellpadding="8" cellspacing="0" style="background-color: #FEE2E2; border: 1px solid #DC2626; border-radius: 8px; margin-bottom: 24px;">
        <thead>
          <tr style="background-color: #FCA5A5;">
            <th style="text-align: left; font-size: 12px; color: #7F1D1D; font-weight: 600; padding: 12px 8px;">Rapor Adı</th>
            <th style="text-align: left; font-size: 12px; color: #7F1D1D; font-weight: 600; padding: 12px 8px;">Kampanya</th>
            <th style="text-align: center; font-size: 12px; color: #7F1D1D; font-weight: 600; padding: 12px 8px;">Gecikme</th>
            <th style="text-align: left; font-size: 12px; color: #7F1D1D; font-weight: 600; padding: 12px 8px;">Atanan</th>
          </tr>
        </thead>
        <tbody>
          ${digestContent.overdueReports.map(report => `
            <tr style="border-top: 1px solid #DC2626;">
              <td style="font-size: 13px; color: #991B1B; padding: 8px;"><strong>${report.title}</strong></td>
              <td style="font-size: 13px; color: #991B1B; padding: 8px;">${report.campaignTitle || '-'}</td>
              <td style="font-size: 13px; color: #991B1B; padding: 8px; text-align: center;"><strong>${report.daysOverdue} gün</strong></td>
              <td style="font-size: 13px; color: #991B1B; padding: 8px;">${report.assigneeName}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } else {
    overdueReportsHTML = `
      <h3 style="margin: 24px 0 16px 0; font-size: 18px; color: #10B981; font-weight: 600;">
        ✅ Gecikmiş Raporlar
      </h3>
      <div style="background-color: #D1FAE5; border: 1px solid #10B981; border-radius: 8px; padding: 16px; margin-bottom: 24px; text-align: center;">
        <p style="margin: 0; font-size: 14px; color: #065F46;">
          🎉 Harika! Gecikmiş rapor bulunmuyor.
        </p>
      </div>
    `;
  }

  // Build this week's campaigns table
  let thisWeekCampaignsHTML = '';
  if (digestContent.totalThisWeekCampaigns > 0) {
    thisWeekCampaignsHTML = `
      <h3 style="margin: 24px 0 16px 0; font-size: 18px; color: #7C3AED; font-weight: 600;">
        📅 Bu Hafta Yapılacak Kampanyalar (${digestContent.totalThisWeekCampaigns})
      </h3>
      <table width="100%" cellpadding="8" cellspacing="0" style="background-color: #F3E8FF; border: 1px solid #7C3AED; border-radius: 8px; margin-bottom: 24px;">
        <thead>
          <tr style="background-color: #DDD6FE;">
            <th style="text-align: left; font-size: 12px; color: #4C1D95; font-weight: 600; padding: 12px 8px;">Tarih</th>
            <th style="text-align: left; font-size: 12px; color: #4C1D95; font-weight: 600; padding: 12px 8px;">Kampanya Adı</th>
            <th style="text-align: center; font-size: 12px; color: #4C1D95; font-weight: 600; padding: 12px 8px;">Aciliyet</th>
            <th style="text-align: left; font-size: 12px; color: #4C1D95; font-weight: 600; padding: 12px 8px;">Atanan</th>
          </tr>
        </thead>
        <tbody>
          ${digestContent.thisWeekCampaigns.map(campaign => {
      const dateStr = campaign.date.toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'short',
        weekday: 'short'
      });
      return `
              <tr style="border-top: 1px solid #A78BFA;">
                <td style="font-size: 13px; color: #6B21A8; padding: 8px; white-space: nowrap;">${dateStr}</td>
                <td style="font-size: 13px; color: #6B21A8; padding: 8px;"><strong>${campaign.title}</strong></td>
                <td style="font-size: 13px; color: #6B21A8; padding: 8px; text-align: center;">${campaign.urgencyLabel}</td>
                <td style="font-size: 13px; color: #6B21A8; padding: 8px;">${campaign.assigneeName}</td>
              </tr>
            `;
    }).join('')}
        </tbody>
      </table>
    `;
  } else {
    thisWeekCampaignsHTML = `
      <h3 style="margin: 24px 0 16px 0; font-size: 18px; color: #6B7280; font-weight: 600;">
        📅 Bu Hafta Yapılacak Kampanyalar
      </h3>
      <div style="background-color: #F3F4F6; border: 1px solid #D1D5DB; border-radius: 8px; padding: 16px; margin-bottom: 24px; text-align: center;">
        <p style="margin: 0; font-size: 14px; color: #4B5563;">
          Bu hafta planlanmış kampanya bulunmuyor.
        </p>
      </div>
    `;
  }

  return `
    <!DOCTYPE html>
    <html lang="tr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Haftalık Bülten</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color: #F8F9FE;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F8F9FE; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="650" cellpadding="0" cellspacing="0" style="background-color: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <tr>
                <td style="background-color: #F9FAFB; padding: 32px; text-align: center; border-bottom: 1px solid #E5E7EB;">
                  <h1 style="margin: 0; color: #1F2937; font-size: 28px; font-weight: 700;">📊 Haftalık Bülten</h1>
                  <p style="margin: 8px 0 0 0; color: #6B7280; font-size: 16px; font-weight: 500;">${weekRangeStr}</p>
                </td>
              </tr>
              <tr>
                <td style="padding: 32px;">
                  <p style="margin: 0 0 24px 0; font-size: 16px; color: #1F2937;">İyi Günler,</p>
                  <p style="margin: 0 0 24px 0; font-size: 14px; color: #4B5563; line-height: 1.6;">İşte bu haftanın özeti:</p>
                  ${overdueReportsHTML}
                  ${thisWeekCampaignsHTML}
                  <div style="text-align: center; margin: 32px 0;">
                    <a href="https://kampanya-takvimi.vercel.app" style="display: inline-block; background: linear-gradient(135deg, #7C3AED 0%, #4338CA 100%); color: #FFFFFF; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 6px rgba(124, 58, 237, 0.3);">Takvime Git →</a>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="background-color: #F9FAFB; padding: 24px; text-align: center; border-top: 1px solid #E5E7EB;">
                  <p style="margin: 0 0 8px 0; font-size: 12px; color: #6B7280;">Bu otomatik bir haftalık bültendir.</p>
                  <p style="margin: 0; font-size: 12px; color: #9CA3AF;">Kampanya Takvimi © ${new Date().getFullYear()}</p>
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
 * Send weekly digest email
 */
export async function sendWeeklyDigestEmail(
  apiKey: string,
  recipientEmail: string,
  recipientName: string,
  digestContent: any,
  weekStart: Date,
  weekEnd: Date
): Promise<EmailResponse> {
  const html = buildWeeklyDigestHTML({
    recipientName,
    digestContent,
    weekStart,
    weekEnd,
  });

  const weekRangeStr = `${weekStart.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })} - ${weekEnd.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}`;
  const subject = `📊 Haftalık Bülten - ${weekRangeStr}`;

  return sendEmailWithResend(apiKey, {
    to: recipientEmail,
    toName: recipientName,
    subject,
    html,
    eventId: `weekly-digest-${weekStart.toISOString().split('T')[0]}`,
    eventTitle: `Haftalık Bülten - ${weekRangeStr}`,
    eventType: 'campaign',
    urgency: 'Medium',
  });
}

/**
 * Build HTML for daily digest emails
 */
export function buildDailyDigestHTML(params: {
  recipientName: string;
  digestContent: {
    completedCampaigns: Array<{
      title: string;
      assigneeName: string;
      status: string;
      urgencyLabel: string;
    }>;
    incompleteCampaigns: Array<{
      title: string;
      assigneeName: string;
      status: string;
      urgencyLabel: string;
    }>;
    date: Date;
    totalCompleted: number;
    totalIncomplete: number;
  };
}): string {
  const { recipientName, digestContent } = params;
  const date = digestContent.date;

  const dateStr = date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' });

  // Build completed campaigns table
  let completedHTML = '';
  if (digestContent.totalCompleted > 0) {
    completedHTML = `
      <h3 style="margin: 24px 0 16px 0; font-size: 18px; color: #059669; font-weight: 600;">
        ✅ Tamamlananlar (${digestContent.totalCompleted})
      </h3>
      <table width="100%" cellpadding="8" cellspacing="0" style="background-color: #ECFDF5; border: 1px solid #059669; border-radius: 8px; margin-bottom: 24px;">
        <thead>
          <tr style="background-color: #D1FAE5;">
            <th style="text-align: left; font-size: 12px; color: #064E3B; font-weight: 600; padding: 12px 8px;">Kampanya</th>
            <th style="text-align: center; font-size: 12px; color: #064E3B; font-weight: 600; padding: 12px 8px;">Aciliyet</th>
            <th style="text-align: left; font-size: 12px; color: #064E3B; font-weight: 600; padding: 12px 8px;">Atanan</th>
          </tr>
        </thead>
        <tbody>
          ${digestContent.completedCampaigns.map(campaign => `
            <tr style="border-top: 1px solid #34D399;">
              <td style="font-size: 13px; color: #065F46; padding: 8px;"><strong>${campaign.title}</strong></td>
              <td style="font-size: 13px; color: #065F46; padding: 8px; text-align: center;">${campaign.urgencyLabel}</td>
              <td style="font-size: 13px; color: #065F46; padding: 8px;">${campaign.assigneeName}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } else {
    completedHTML = `
      <h3 style="margin: 24px 0 16px 0; font-size: 18px; color: #6B7280; font-weight: 600;">
        ✅ Tamamlananlar
      </h3>
      <div style="background-color: #F3F4F6; border: 1px solid #D1D5DB; border-radius: 8px; padding: 16px; margin-bottom: 24px; text-align: center;">
        <p style="margin: 0; font-size: 14px; color: #4B5563;">
          Bugün tamamlanan kampanya bulunmuyor.
        </p>
      </div>
    `;
  }

  // Build incomplete campaigns table
  let incompleteHTML = '';
  if (digestContent.totalIncomplete > 0) {
    incompleteHTML = `
      <h3 style="margin: 24px 0 16px 0; font-size: 18px; color: #BE123C; font-weight: 600;">
        ⏳ Tamamlanmayanlar / Bekleyenler (${digestContent.totalIncomplete})
      </h3>
      <table width="100%" cellpadding="8" cellspacing="0" style="background-color: #FFF1F2; border: 1px solid #BE123C; border-radius: 8px; margin-bottom: 24px;">
        <thead>
          <tr style="background-color: #FFE4E6;">
            <th style="text-align: left; font-size: 12px; color: #881337; font-weight: 600; padding: 12px 8px;">Kampanya</th>
            <th style="text-align: center; font-size: 12px; color: #881337; font-weight: 600; padding: 12px 8px;">Durum</th>
            <th style="text-align: left; font-size: 12px; color: #881337; font-weight: 600; padding: 12px 8px;">Atanan</th>
          </tr>
        </thead>
        <tbody>
          ${digestContent.incompleteCampaigns.map(campaign => `
            <tr style="border-top: 1px solid #FDA4AF;">
              <td style="font-size: 13px; color: #9F1239; padding: 8px;"><strong>${campaign.title}</strong></td>
              <td style="font-size: 13px; color: #9F1239; padding: 8px; text-align: center;">${campaign.status}</td>
              <td style="font-size: 13px; color: #9F1239; padding: 8px;">${campaign.assigneeName}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } else {
    incompleteHTML = `
      <h3 style="margin: 24px 0 16px 0; font-size: 18px; color: #6B7280; font-weight: 600;">
        ⏳ Tamamlanmayanlar
      </h3>
      <div style="background-color: #F3F4F6; border: 1px solid #D1D5DB; border-radius: 8px; padding: 16px; margin-bottom: 24px; text-align: center;">
        <p style="margin: 0; font-size: 14px; color: #4B5563;">
          Bugün için bekleyen kampanya bulunmuyor.
        </p>
      </div>
    `;
  }

  return `
    <!DOCTYPE html>
    <html lang="tr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Gün Sonu Bülteni</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color: #F8F9FE;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F8F9FE; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="650" cellpadding="0" cellspacing="0" style="background-color: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <tr>
                <td style="background-color: #F9FAFB; padding: 32px; text-align: center; border-bottom: 1px solid #E5E7EB;">
                  <h1 style="margin: 0; color: #1F2937; font-size: 28px; font-weight: 700;">🌅 Gün Sonu Bülteni</h1>
                  <p style="margin: 8px 0 0 0; color: #6B7280; font-size: 16px; font-weight: 500;">${dateStr}</p>
                </td>
              </tr>
              <tr>
                <td style="padding: 32px;">
                  <p style="margin: 0 0 24px 0; font-size: 16px; color: #1F2937;">İyi Akşamlar,</p>
                  <p style="margin: 0 0 24px 0; font-size: 14px; color: #4B5563; line-height: 1.6;">Bugünün kampanya özeti aşağıdadır:</p>
                  ${completedHTML}
                  ${incompleteHTML}
                  <div style="text-align: center; margin: 32px 0;">
                    <a href="https://kampanya-takvimi.vercel.app" style="display: inline-block; background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: #FFFFFF; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 6px rgba(5, 150, 105, 0.3);">Takvime Git →</a>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="background-color: #F9FAFB; padding: 24px; text-align: center; border-top: 1px solid #E5E7EB;">
                  <p style="margin: 0 0 8px 0; font-size: 12px; color: #6B7280;">Bu manuel tetiklenen gün sonu özetidir.</p>
                  <p style="margin: 0; font-size: 12px; color: #9CA3AF;">Kampanya Takvimi © ${new Date().getFullYear()}</p>
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
 * Send daily digest email
 */
export async function sendDailyDigestEmail(
  apiKey: string,
  recipientEmail: string,
  recipientName: string,
  digestContent: any
): Promise<EmailResponse> {
  const html = buildDailyDigestHTML({
    recipientName,
    digestContent: digestContent
  });

  const dateStr = digestContent.date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
  const subject = `🌅 Gün Sonu Bülteni - ${dateStr}`;

  return sendEmailWithResend(apiKey, {
    to: recipientEmail,
    toName: recipientName,
    subject,
    html,
    eventId: `daily-digest-${digestContent.date.toISOString().split('T')[0]}`,
    eventTitle: `Gün Sonu Bülteni - ${dateStr}`,
    eventType: 'campaign',
    urgency: 'Medium',
  });
}

// ===== PERSONAL DAILY BULLETIN =====

function getUrgencyLabel(urgency: string): string {
  const labels: Record<string, string> = {
    'Very High': 'Çok Yüksek',
    'High': 'Yüksek',
    'Medium': 'Orta',
    'Low': 'Düşük',
  };
  return labels[urgency] || urgency;
}

export function buildPersonalBulletinHTML(params: {
  recipientName: string;
  campaigns: any[];
  reports: any[];
  analyticsTasks: any[];
  date: Date;
  totalCount: number;
}): string {
  const { recipientName, campaigns, reports, analyticsTasks, date, totalCount } = params;

  const dateStr = date.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    weekday: 'long'
  });

  const campaignsHTML = campaigns.length > 0 ? `
    <h3 style="margin: 24px 0 16px 0; font-size: 18px; color: #8B5CF6; font-weight: 600;">
      🎯 Planlanmış Kampanyalar (${campaigns.length})
    </h3>
    <div style="background-color: #F5F3FF; border: 1px solid #8B5CF6; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
      <div style="background-color: #DDD6FE; padding: 8px 12px; border-radius: 4px; margin-bottom: 12px;">
        <span style="font-size: 12px; color: #5B21B6; font-weight: 600;">📌 Sadece "Planlandı" durumundaki kampanyalar gösterilir</span>
      </div>
      ${campaigns.map(c => `
        <div style="padding: 12px; border-bottom: 1px solid #C4B5FD; margin-bottom: 8px;">
          <strong style="color: #6B21A8;">${c.title}</strong><br/>
          <span style="font-size: 12px; color: #7C3AED;">Aciliyet: ${getUrgencyLabel(c.urgency)}</span>
        </div>
      `).join('')}
    </div>
  ` : '';

  const reportsHTML = reports.length > 0 ? `
    <h3 style="margin: 24px 0 16px 0; font-size: 18px; color: #EF4444; font-weight: 600;">
      📊 Raporlar (${reports.length})
    </h3>
    <div style="background-color: #FEF2F2; border: 1px solid #EF4444; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
      ${reports.map(r => `
        <div style="padding: 12px; border-bottom: 1px solid #FECACA; margin-bottom: 8px;">
          <strong style="color: #991B1B;">${r.title}</strong><br/>
          <span style="font-size: 12px; color: #DC2626;">Kampanya: ${r.campaignTitle || '-'} | Durum: ${r.status === 'pending' ? 'Bekliyor' : 'Tamamlandı'}</span>
        </div>
      `).join('')}
    </div>
  ` : '';

  const analyticsHTML = analyticsTasks.length > 0 ? `
    <h3 style="margin: 24px 0 16px 0; font-size: 18px; color: #3B82F6; font-weight: 600;">
      📈 Analitik İşler (${analyticsTasks.length})
    </h3>
    <div style="background-color: #EFF6FF; border: 1px solid #3B82F6; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
      ${analyticsTasks.map(t => `
        <div style="padding: 12px; border-bottom: 1px solid #93C5FD; margin-bottom: 8px;">
          <strong style="color: #1E40AF;">${t.title}</strong><br/>
          <span style="font-size: 12px; color: #2563EB;">Aciliyet: ${getUrgencyLabel(t.urgency)} | Durum: ${t.status || 'Planlandı'}</span>
        </div>
      `).join('')}
    </div>
  ` : '';

  if (totalCount === 0) {
    return `
      <!DOCTYPE html>
      <html lang="tr">
      <body style="margin: 0; padding: 0; font-family: sans-serif; background-color: #F8F9FE;">
        <div style="max-width: 650px; margin: 40px auto; background: white; border-radius: 12px; padding: 32px;">
          <h1 style="color: #1F2937; text-align: center;">📋 Kişisel Günlük Bülten</h1>
          <p style="text-align: center; color: #6B7280;">${dateStr}</p>
          <p>Günaydın <strong>${recipientName}</strong>,</p>
          <div style="background-color: #F0FDF4; border: 1px solid #86EFAC; border-radius: 8px; padding: 24px; text-align: center;">
            <p style="font-size: 18px; color: #166534; font-weight: 600;">🎉 Bugün için planlanmış işiniz yok!</p>
            <p style="font-size: 13px; color: #065F46; margin-top: 8px;">Sadece "Planlandı" durumundaki işler bu bültende gösterilir.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  return `
    <!DOCTYPE html>
    <html lang="tr">
    <body style="margin: 0; padding: 0; font-family: sans-serif; background-color: #F8F9FE;">
      <div style="max-width: 650px; margin: 40px auto; background: white; border-radius: 12px; padding: 32px;">
        <h1 style="color: #1F2937; text-align: center;">📋 Kişisel Günlük Bülten</h1>
        <p style="text-align: center; color: #6B7280;">${dateStr}</p>
        <p>Günaydın <strong>${recipientName}</strong>,</p>
        <p style="color: #4B5563;">Bugün yapmanız gereken <strong>${totalCount} planlanmış iş</strong> bulunmaktadır:</p>
        ${campaignsHTML}
        ${reportsHTML}
        ${analyticsHTML}
        <div style="text-align: center; margin: 32px 0;">
          <a href="https://www.kampanyatakvimi.net.tr" style="display: inline-block; background: #8B5CF6; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600;">Takvime Git →</a>
        </div>
        <p style="text-align: center; font-size: 12px; color: #6B7280;">Kampanya Takvimi © ${new Date().getFullYear()}</p>
      </div>
    </body>
    </html>
  `;
}

export async function sendPersonalBulletinEmail(
  resendApiKey: string,
  recipientEmail: string,
  recipientName: string,
  bulletinContent: { campaigns: any[]; reports: any[]; analyticsTasks: any[]; date: Date; totalCount: number }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const html = buildPersonalBulletinHTML({
    recipientName,
    ...bulletinContent
  });

  const dateStr = bulletinContent.date.toLocaleDateString('tr-TR');
  const subject = `📋 Kişisel Günlük Bülten - ${dateStr} (${bulletinContent.totalCount} İş)`;

  return sendEmailWithResend(resendApiKey, {
    to: recipientEmail,
    toName: recipientName,
    subject,
    html,
    eventId: `personal-bulletin-${bulletinContent.date.toISOString().split('T')[0]}`,
    eventTitle: `Kişisel Günlük Bülten - ${dateStr}`,
    eventType: 'campaign',
    urgency: 'Medium',
  });
}
