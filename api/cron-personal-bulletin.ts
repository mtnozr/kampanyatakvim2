/**
 * Kişisel Günlük Bülten - Cron Job
 *
 * Her kullanıcıya kendi kampanyalarını gönderir:
 * - Geciken kampanyalar (bugünden önce, tamamlanmamış)
 * - Bugünkü kampanyalar
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

// ===== TYPES =====

interface Settings {
    resendApiKey?: string;
    personalBulletinEnabled?: boolean;
    personalBulletinTime?: string;
    personalBulletinRecipients?: string[]; // user IDs from 'users' collection
    personalDailyBulletinEnabled?: boolean;
    personalDailyBulletinTime?: string;
    personalDailyBulletinRecipients?: string[]; // legacy fields
}

interface Campaign {
    id: string;
    title: string;
    date: Date;
    status: string;
    urgency: string;
    assigneeId?: string;
}

interface User {
    id: string;
    name: string;
    email: string;
}

// ===== FIREBASE INIT =====

function initFirebase() {
    if (admin.apps.length) return admin;

    const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!serviceAccountStr) throw new Error('FIREBASE_SERVICE_ACCOUNT missing');

    const serviceAccount = JSON.parse(serviceAccountStr);
    if (serviceAccount.private_key) {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }

    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    return admin;
}

// ===== TURKEY TIMEZONE (UTC+3) =====

const TURKEY_OFFSET = 3 * 60 * 60 * 1000;

function getTurkeyNow(): Date {
    return new Date(Date.now() + TURKEY_OFFSET);
}

function getTurkeyToday(): { year: number; month: number; day: number } {
    const t = getTurkeyNow();
    return { year: t.getUTCFullYear(), month: t.getUTCMonth(), day: t.getUTCDate() };
}

function getTodayRange(): { start: Date; end: Date } {
    const { year, month, day } = getTurkeyToday();
    return {
        start: new Date(Date.UTC(year, month, day, 0, 0, 0) - TURKEY_OFFSET),
        end: new Date(Date.UTC(year, month, day, 23, 59, 59, 999) - TURKEY_OFFSET)
    };
}

function isTimeReached(targetTime: string): boolean {
    const t = getTurkeyNow();
    const [targetH, targetM] = targetTime.split(':').map(Number);
    const currentH = t.getUTCHours();
    const currentM = t.getUTCMinutes();
    return currentH > targetH || (currentH === targetH && currentM >= targetM);
}

function isWeekend(): boolean {
    const day = getTurkeyNow().getUTCDay();
    return day === 0 || day === 6;
}

function isSameTurkeyDay(date: Date, year: number, month: number, day: number): boolean {
    const d = new Date(date.getTime() + TURKEY_OFFSET);
    return d.getUTCFullYear() === year && d.getUTCMonth() === month && d.getUTCDate() === day;
}

function isBeforeTurkeyDay(date: Date, year: number, month: number, day: number): boolean {
    const d = new Date(date.getTime() + TURKEY_OFFSET);
    const campaignDate = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const todayDate = new Date(Date.UTC(year, month, day));
    return campaignDate < todayDate;
}

// ===== EMAIL =====

async function sendEmail(apiKey: string, to: string, subject: string, html: string): Promise<boolean> {
    try {
        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                from: 'Kampanya Takvimi <hatirlatma@kampanyatakvimi.net.tr>',
                to,
                subject,
                html
            })
        });
        return res.ok;
    } catch {
        return false;
    }
}

function getUrgencyLabel(u: string): string {
    const map: Record<string, string> = { 'Very High': 'Çok Yüksek', 'High': 'Yüksek', 'Medium': 'Orta', 'Low': 'Düşük' };
    return map[u] || u;
}

function buildHTML(name: string, overdue: Campaign[], today: Campaign[], dateStr: string): string {
    const overdueSection = overdue.length > 0 ? `
        <div style="margin-bottom: 24px;">
            <h3 style="color: #DC2626; margin-bottom: 12px;">⚠️ Geciken Kampanyalar (${overdue.length})</h3>
            <table style="width: 100%; border-collapse: collapse; background: #FEF2F2; border-radius: 8px;">
                <thead>
                    <tr style="background: #FECACA;">
                        <th style="padding: 10px; text-align: left; color: #991B1B;">Kampanya</th>
                        <th style="padding: 10px; text-align: center; color: #991B1B;">Tarih</th>
                        <th style="padding: 10px; text-align: center; color: #991B1B;">Aciliyet</th>
                    </tr>
                </thead>
                <tbody>
                    ${overdue.map(c => `
                        <tr style="border-top: 1px solid #FCA5A5;">
                            <td style="padding: 10px; color: #991B1B;"><strong>${c.title}</strong></td>
                            <td style="padding: 10px; text-align: center; color: #991B1B;">${c.date.toLocaleDateString('tr-TR')}</td>
                            <td style="padding: 10px; text-align: center; color: #991B1B;">${getUrgencyLabel(c.urgency)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    ` : '';

    const todaySection = today.length > 0 ? `
        <div style="margin-bottom: 24px;">
            <h3 style="color: #7C3AED; margin-bottom: 12px;">📅 Bugünkü Kampanyalar (${today.length})</h3>
            <table style="width: 100%; border-collapse: collapse; background: #F5F3FF; border-radius: 8px;">
                <thead>
                    <tr style="background: #EDE9FE;">
                        <th style="padding: 10px; text-align: left; color: #5B21B6;">Kampanya</th>
                        <th style="padding: 10px; text-align: center; color: #5B21B6;">Aciliyet</th>
                        <th style="padding: 10px; text-align: center; color: #5B21B6;">Durum</th>
                    </tr>
                </thead>
                <tbody>
                    ${today.map(c => `
                        <tr style="border-top: 1px solid #C4B5FD;">
                            <td style="padding: 10px; color: #5B21B6;"><strong>${c.title}</strong></td>
                            <td style="padding: 10px; text-align: center; color: #5B21B6;">${getUrgencyLabel(c.urgency)}</td>
                            <td style="padding: 10px; text-align: center; color: #5B21B6;">${c.status || 'Planlandı'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    ` : '';

    const total = overdue.length + today.length;

    return `
    <!DOCTYPE html>
    <html><head><meta charset="UTF-8"></head>
    <body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background: #F3F4F6;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <div style="background: linear-gradient(135deg, #7C3AED, #5B21B6); color: white; padding: 24px; text-align: center;">
                <h1 style="margin: 0; font-size: 24px;">📋 Kişisel Günlük Bülten</h1>
                <p style="margin: 8px 0 0; opacity: 0.9;">${dateStr}</p>
            </div>
            <div style="padding: 24px;">
                <p style="margin: 0 0 20px; color: #374151;">Merhaba <strong>${name}</strong>,</p>
                <p style="margin: 0 0 20px; color: #6B7280;">Bugün için toplam <strong>${total} kampanyanız</strong> bulunmaktadır.</p>
                ${overdueSection}
                ${todaySection}
                <div style="text-align: center; margin-top: 24px;">
                    <a href="https://www.kampanyatakvimi.net.tr" style="display: inline-block; background: #7C3AED; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">Takvime Git →</a>
                </div>
            </div>
            <div style="background: #F9FAFB; padding: 16px; text-align: center; color: #9CA3AF; font-size: 12px;">
                Bu otomatik bir bildirimdir. Kampanya Takvimi © ${new Date().getFullYear()}
            </div>
        </div>
    </body>
    </html>
    `;
}

// ===== MAIN HANDLER =====

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const logs: string[] = [];
    const log = (msg: string) => { console.log(msg); logs.push(msg); };

    try {
        // Auth
        const key = Array.isArray(req.query.key) ? req.query.key[0] : req.query.key;
        if (key !== process.env.CRON_SECRET_KEY && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        log('=== KİŞİSEL BÜLTEN BAŞLADI ===');

        const db = initFirebase().firestore();

        // Settings
        const settingsDoc = await db.collection('reminderSettings').doc('default').get();
        if (!settingsDoc.exists) {
            log('❌ Ayarlar bulunamadı');
            return res.status(200).json({ success: false, reason: 'no_settings', logs });
        }

        const settings = settingsDoc.data() as Settings;

        const personalBulletinEnabled = settings.personalBulletinEnabled ?? settings.personalDailyBulletinEnabled;
        const personalBulletinTime = settings.personalBulletinTime ?? settings.personalDailyBulletinTime;
        const personalBulletinRecipients = settings.personalBulletinRecipients ?? settings.personalDailyBulletinRecipients ?? [];

        if (!personalBulletinEnabled) {
            log('❌ Kişisel bülten devre dışı');
            return res.status(200).json({ success: false, reason: 'disabled', logs });
        }

        if (!personalBulletinTime) {
            log('❌ Saat ayarlanmamış');
            return res.status(200).json({ success: false, reason: 'no_time', logs });
        }

        if (!settings.resendApiKey) {
            log('❌ API key yok');
            return res.status(200).json({ success: false, reason: 'no_api_key', logs });
        }

        const recipientIds = personalBulletinRecipients;
        if (recipientIds.length === 0) {
            log('❌ Alıcı seçilmemiş');
            return res.status(200).json({ success: false, reason: 'no_recipients', logs });
        }

        if (isWeekend()) {
            log('❌ Hafta sonu - atlanıyor');
            return res.status(200).json({ success: false, reason: 'weekend', logs });
        }

        if (!isTimeReached(personalBulletinTime)) {
            log(`❌ Henüz saat olmadı (hedef: ${personalBulletinTime})`);
            return res.status(200).json({ success: false, reason: 'not_time', logs });
        }

        log(`✅ Kontroller geçti. Alıcı sayısı: ${recipientIds.length}`);

        // Get Turkey today
        const { year, month, day } = getTurkeyToday();
        const turkeyDateStr = `${day}.${month + 1}.${year}`;
        log(`Türkiye tarihi: ${turkeyDateStr}`);

        // Fetch users (recipients)
        const usersSnapshot = await db.collection('users').get();
        const allUsers: User[] = usersSnapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name || 'İsimsiz',
            email: doc.data().email || ''
        }));

        const recipients = allUsers.filter(u => recipientIds.includes(u.id) && u.email);
        log(`Email'li alıcı: ${recipients.length}`);

        if (recipients.length === 0) {
            log('❌ Email adresi olan alıcı yok');
            return res.status(200).json({ success: false, reason: 'no_valid_recipients', logs });
        }

        // Fetch ALL campaigns (we need overdue ones too)
        const campaignsSnapshot = await db.collection('events').get();
        const allCampaigns: Campaign[] = campaignsSnapshot.docs.map(doc => {
            const d = doc.data();
            return {
                id: doc.id,
                title: d.title || '',
                date: d.date?.toDate() || new Date(),
                status: d.status || 'Planlandı',
                urgency: d.urgency || 'Medium',
                assigneeId: d.assigneeId
            };
        });

        log(`Toplam kampanya: ${allCampaigns.length}`);

        // Send to each recipient
        let sent = 0;
        let skipped = 0;

        for (const user of recipients) {
            // Filter campaigns for this user
            const userCampaigns = allCampaigns.filter(c => c.assigneeId === user.id);

            // Overdue: date < today AND not completed/cancelled
            const overdue = userCampaigns.filter(c =>
                isBeforeTurkeyDay(c.date, year, month, day) &&
                c.status !== 'Tamamlandı' &&
                c.status !== 'İptal Edildi'
            );

            // Today: date = today AND not cancelled
            const today = userCampaigns.filter(c =>
                isSameTurkeyDay(c.date, year, month, day) &&
                c.status !== 'İptal Edildi'
            );

            log(`${user.name}: geciken=${overdue.length}, bugün=${today.length}`);

            if (overdue.length === 0 && today.length === 0) {
                log(`  → Kampanya yok, atlanıyor`);
                skipped++;
                continue;
            }

            const html = buildHTML(user.name, overdue, today, turkeyDateStr);
            const total = overdue.length + today.length;
            const subject = `📋 Günlük Bülten - ${turkeyDateStr} (${total} Kampanya${overdue.length > 0 ? ' ⚠️' : ''})`;

            const success = await sendEmail(settings.resendApiKey!, user.email, subject, html);

            if (success) {
                log(`  ✅ Gönderildi: ${user.email}`);
                sent++;

                // Log to Firestore
                await db.collection('reminderLogs').add({
                    eventId: `personal-bulletin-${year}-${month + 1}-${day}-${user.id}`,
                    eventType: 'personal-bulletin',
                    eventTitle: `Kişisel Günlük Bülten`,
                    recipientEmail: user.email,
                    recipientName: user.name,
                    urgency: 'Medium',
                    sentAt: Timestamp.now(),
                    status: 'success',
                    emailProvider: 'resend'
                });
            } else {
                log(`  ❌ Gönderilemedi: ${user.email}`);
            }
        }

        log(`=== TAMAMLANDI: gönderilen=${sent}, atlanan=${skipped} ===`);

        return res.status(200).json({ success: true, sent, skipped, logs });

    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Bilinmeyen hata';
        log(`❌ HATA: ${msg}`);
        return res.status(500).json({ success: false, error: msg, logs });
    }
}
