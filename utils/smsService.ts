/**
 * SMS Service - Twilio Integration
 * Kampanya atamalarında SMS bildirimi gönderir
 */

interface SendSMSParams {
  toNumber: string;
  message: string;
}

interface SMSResponse {
  success: boolean;
  messageSid?: string;
  error?: string;
}

/**
 * Twilio API ile SMS gönderir (Backend üzerinden)
 */
export async function sendSMSWithTwilio(
  accountSid: string,
  authToken: string,
  fromNumber: string,
  params: SendSMSParams
): Promise<SMSResponse> {
  try {
    // Backend API endpoint'imizi kullan (güvenlik için)
    const apiUrl = '/api/send-sms';

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        accountSid,
        authToken,
        fromNumber,
        toNumber: params.toNumber,
        message: params.message,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('SMS API error:', error);
      return {
        success: false,
        error: error.error || 'SMS gönderilemedi',
      };
    }

    const data = await response.json();
    return {
      success: data.success,
      messageSid: data.messageSid,
      error: data.error,
    };
  } catch (error) {
    console.error('SMS send error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
    };
  }
}

/**
 * SMS template'ini oluşturur (değişkenleri değiştirir)
 */
export function buildSMSFromTemplate(
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
 * Telefon numarasını Twilio formatına çevirir (+90...)
 */
export function formatPhoneNumber(phone: string): string {
  // Temizle (boşluk, tire, parantez kaldır)
  let cleaned = phone.replace(/[\s\-()]/g, '');

  // Eğer başında + yoksa ekle
  if (!cleaned.startsWith('+')) {
    // Eğer 0 ile başlıyorsa kaldır ve +90 ekle (Türkiye)
    if (cleaned.startsWith('0')) {
      cleaned = '+90' + cleaned.substring(1);
    } else if (!cleaned.startsWith('90')) {
      // 90 yoksa ekle
      cleaned = '+90' + cleaned;
    } else {
      // 90 varsa + ekle
      cleaned = '+' + cleaned;
    }
  }

  return cleaned;
}

/**
 * Test SMS gönderir
 */
export async function sendTestSMS(
  accountSid: string,
  authToken: string,
  fromNumber: string,
  toNumber: string
): Promise<SMSResponse> {
  const testMessage = '🧪 Test SMS - Kampanya Takvimi\n\nTwilio entegrasyonu başarıyla çalışıyor!';

  return sendSMSWithTwilio(accountSid, authToken, fromNumber, {
    toNumber: formatPhoneNumber(toNumber),
    message: testMessage,
  });
}
