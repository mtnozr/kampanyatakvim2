# Kampanya Takvim Projesi — Claude Bağlamı

Bu dosya, her seferinde projeyi sıfırdan anlatmak zorunda kalmamak için Claude Code'un otomatik okuduğu hafıza dosyasıdır.

## Çalışma Kuralları

- **Her geliştirme oturumu sonunda**, kullanıcı söylemeden, yapılanları ve önemli konuşmaları `Konuşma Geçmişi` bölümüne tarih başlığıyla ekle. Commit hash'lerini de yaz.

---

## Proje Özeti

**Kampanya Takvim**, React + TypeScript ile geliştirilmiş bir kampanya yönetim ve iş takip uygulamasıdır. Türkçe arayüzüyle ekiplerin kampanyalarını, raporlarını ve iş taleplerini yönetmesini sağlar.

- **URL:** https://github.com/mtnozr/kampanyatakvim2
- **Deploy:** Vercel (Serverless)
- **Veritabanı:** Google Firestore
- **Auth:** Firebase Authentication

---

## Tech Stack

| Katman | Teknoloji |
|---|---|
| Frontend | React 18, TypeScript 5, Vite 5 |
| Styling | Tailwind CSS 3, dark mode desteği |
| Backend | Vercel Serverless Functions (Node.js) |
| Veritabanı | Firestore (NoSQL) |
| Email | Resend API |
| SMS | Twilio (opsiyonel) |
| PDF Export | html2canvas + jsPDF |
| Rich Text | React Quill |
| Tarih | date-fns |

---

## Klasör Yapısı

```
kampanya_takvim_proje/
├── App.tsx                  # Ana uygulama (4707 satır)
├── types.ts                 # TypeScript tipleri
├── constants.ts             # Sabitler (tatiller, zorluk seviyeleri)
├── tokens.ts                # Design token sistemi
├── firebase.ts              # Firebase config
├── changelog.ts             # Versiyon geçmişi
│
├── components/              # 38 bileşen
│   ├── Modal'lar (AddEventModal, EventDetailsModal, AdminModal…)
│   ├── Takvimler (ReportCalendarTab, AnalyticsCalendarTab)
│   ├── Widget'lar (PomodoroWidget, WeatherWidget, StickyNoteWidget…)
│   └── mobile/ (MobileShell, MobileBottomNav…)
│
├── api/                     # 8 Vercel serverless endpoint
│   ├── admin.ts             # Kullanıcı yönetimi
│   ├── send-reminder.ts     # Email gönderimi
│   ├── send-sms.ts          # SMS gönderimi
│   ├── cron-daily-digest.ts
│   ├── cron-weekly-digest.ts
│   ├── cron-analytics-bulletin.ts
│   └── cron-personal-bulletin.ts
│
├── utils/                   # 12 yardımcı modül
│   ├── emailService.ts
│   ├── smsService.ts
│   ├── gamification.ts      # Aylık şampiyon sistemi
│   ├── businessDays.ts      # İş günü hesabı
│   └── dailyDigest*.ts / weeklyDigest*.ts
│
└── hooks/                   # useTheme, useDeviceMode, useBrowserNotifications
```

---

## Temel Özellikler

### Kampanya Yönetimi
- Aylık takvim görünümü, drag-and-drop ile tarih değiştirme
- Aciliyet: Very High / High / Medium / Low
- Zorluk: Basit → Çok Zor (5 seviye)
- Durum: Planlandı / Tamamlandı / İptal Edildi
- Kanal: Kampanya / Bilgilendirme
- Assignee ve departman bağlantısı

### Raporlama
- Kampanya tamamlanınca otomatik rapor oluşturma
- 30 iş günü sonra rapor teslim tarihi
- Ayrı rapor takvimi sekmesi
- Gecikme bildirimleri

### Rol Tabanlı Erişim (RBAC)
| Rol | Yetkiler |
|---|---|
| Admin | Tüm yetkiler, kullanıcı yönetimi |
| Tasarımcı | Tasarım odaklı kampanya görünümü |
| Kampanya Yapan | Kampanya girişi |
| İş Birimi | İş talebi gönderme |
| Analitik | Analitik takvim |
| Misafir | Sadece okuma |

### Email / Bildirim Sistemi
- Resend API üzerinden hatırlatma emailleri
- Günlük digest (ekip özeti)
- Haftalık digest
- Kişisel günlük bülten (her kullanıcıya ayrı)
- Analitik bülten
- Tarayıcı bildirimleri (Web Notifications API)
- Twilio SMS (opsiyonel)

### Gamification
- 🏆 En çok kampanya tamamlayan
- 🚀 En hızlı ortalama tamamlama süresi
- 💪 En zor kampanyaları tamamlayan

### Diğer
- Türk resmi tatilleri dahili (2024–2026)
- Doğum günü animasyonu
- Sticky notes (kampanya notları)
- Pomodoro zamanlayıcı
- Telefon rehberi
- Hava durumu widget
- Duyuru panosu
- Aktivite log (audit trail)
- PDF export (A4 landscape)
- Mobil responsive + ayrı mobile UI

---

## Firestore Koleksiyonları

| Koleksiyon | İçerik |
|---|---|
| `events` | Kampanya verileri |
| `reports` | Raporlar |
| `departmentUsers` | Rol + Firebase Auth UID |
| `users` | Temel kullanıcı bilgisi |
| `requests` | İş talepleri |
| `announcements` | Duyurular |
| `departments` | Departmanlar |
| `logs` | Aktivite logları |
| `reminderSettings` | Email/SMS ayarları |
| `reminderLogs` | Email gönderim geçmişi |
| `analyticsTasks` | Analitik ekip görevleri |
| `monthlyChampions` | Aylık şampiyon kayıtları |

---

## API Endpoint'leri

| Endpoint | Açıklama |
|---|---|
| `POST /api/admin` | Kullanıcı oluştur/güncelle/sil |
| `POST /api/send-reminder` | Email gönder (Resend proxy) |
| `POST /api/send-sms` | SMS gönder (Twilio) |
| `GET /api/cron-daily-digest` | Günlük ekip özeti |
| `GET /api/cron-weekly-digest` | Haftalık özet |
| `GET /api/cron-analytics-bulletin` | Analitik günlük bülten |
| `GET /api/cron-personal-bulletin` | Kişisel günlük bülten |

---

## Geliştirme Komutları

```bash
npm run dev                  # Geliştirme sunucusu (port 3000)
npm run build                # Production build
npm run preview              # Build önizleme
npm run changelog:update     # Changelog güncelle
```

---

## Ortam Değişkenleri

```
VITE_FIREBASE_API_KEY
FIREBASE_SERVICE_ACCOUNT   # Firebase Admin SDK JSON
RESEND_API_KEY
TWILIO_*                   # Opsiyonel
```

---

## Konuşma Geçmişi

### 2026-02-19
- Repo `https://github.com/mtnozr/kampanyatakvim2` masaüstüne `kampanya_takvim_proje` olarak klonlandı.
- Masaüstüne `kampanyaproje.command` adlı bir terminal script oluşturuldu. Çift tıklanınca proje klasörüne girip Claude'u başlatıyor.
- Proje incelenerek bu `CLAUDE.md` dosyası oluşturuldu. Her oturumda otomatik okunacak.

### 2026-02-26

#### Ctrl+drag kampanya kopyalama — Resend mail
- `App.tsx` / `handleEventDrop` — Ctrl+drag ile kampanya kopyalandığında atanan kullanıcıya "Kampanya Hatırlatma" maili gönderilir.
  - Kullanıcı React state'inden değil doğrudan `getDoc(doc(db, 'users', assigneeId))` ile Firestore'dan çekilir (not mail mantığıyla aynı).
  - Email: kampanya adı, yeni tarih, kampanya türü, aciliyet bilgisi içerir.
  - Commits: `708b5e8` → `b796fa4` → `3be5e1b`

#### Görevli değişiminde Resend mail (handleEditEvent)
- `App.tsx` / `handleEditEvent` — Kampanya edit edilip `assigneeId` değiştiğinde hem eski hem yeni görevliye mail gönderilir.
  - Eski `mailto:` açma kaldırıldı, yerine Resend geldi.
  - Yeni görevliye: mor header, "Yeni Görev Atandı"; eski görevliye: gri header, "Görev Devredildi".
  - Mail içeriği: kampanya adı, eski/yeni görevli, tarih, aciliyet, referans ID.
  - Commit: `9ae6384`

#### Görevli dropdown'ında son 30 gün tamamlanan kampanya sayısı
- `AddEventModal.tsx` — Yeni kampanya eklerken görevli seçim listesinde her kullanıcının yanına son 30 günde tamamladığı kampanya sayısı eklendi.
  - Format: `🟢 Ali Veli — 3 tamamlandı 🏆`
- `EventDetailsModal.tsx` — Edit modunda da aynı bilgi gösterilir; `events` prop eklendi, emoji kaldırıldı.
  - App.tsx'teki iki `EventDetailsModal` call site'ına `events={events}` geçildi.
  - Commits: `a8e269a` → `9e965d2`
