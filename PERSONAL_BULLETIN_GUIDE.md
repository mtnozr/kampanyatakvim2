# Kişisel Günlük Bülten - Kullanım Kılavuzu

## 🎯 Özellik Açıklaması

Kişisel günlük bülten sistemi, her kullanıcıya o günkü görevlerini içeren özel bir email gönderir.

### Özellikler:
- ✅ Her kişiye **kendi işlerini** içeren bülten
- ✅ **Kampanya**, **Rapor** ve **Analitik** işler ayrı kategorilerde
- ✅ Haftasonları **otomatik atlanır**
- ✅ Admin **saat ayarlayabilir** (örn: 09:00)
- ✅ **Bildirimler panelinden** yönetilebilir
- ✅ Kullanıcı o gün işi yoksa mail **gönderilmez**

## 📋 Kurulum Adımları

### 1. Firestore Ayarları

Firebase Console'da `reminderSettings/default` dokümanına şu alanları ekleyin:

```json
{
  "personalDailyBulletinEnabled": true,
  "personalDailyBulletinTime": "09:00",
  "personalDailyBulletinRecipients": [
    "user-id-1",
    "user-id-2",
    "user-id-3"
  ]
}
```

**personalDailyBulletinRecipients:** `departmentUsers` collection'ındaki kullanıcı ID'leri

### 2. Cron-Job.org Ayarları

1. [cron-job.org](https://cron-job.org) → Hesabınız
2. "Create Cron Job" tıklayın
3. Ayarlar:
   - **Title:** Personal Daily Bulletin
   - **URL:** `https://kampanya-takvimi.vercel.app/api/cron-personal-bulletin?key=supergizli120200`
   - **Schedule:** `0 6-9 * * 1-5` (Pazartesi-Cuma, 06:00-09:00 UTC = 09:00-12:00 Türkiye)
   - **Enabled:** ✅

**Not:** Cron job UTC saatinde çalışır. Türkiye saati (UTC+3) için 3 saat öncesini ayarlayın.

### 3. Firestore Indexes

**Gerekli index'ler:**

```
Collection: events
Fields: date (Ascending)

Collection: reports
Fields: dueDate (Ascending)

Collection: analyticsTasks
Fields: date (Ascending)
```

İlk çalıştırmada Firebase otomatik index linkini verecektir.

## 🎨 UI Entegrasyonu (Opsiyonel)

ReminderSettingsPanel'e şu bölümü ekleyebilirsiniz:

```tsx
{/* Personal Daily Bulletin Settings */}
{activeTab === 'digests' && (
  <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700">
    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
      ☀️ Kişisel Günlük Bülten
    </h3>
    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
      Her kullanıcıya sabah o günkü işlerini gösteren kişisel bülten gönderir.
    </p>

    <div className="space-y-4">
      {/* Enable Toggle */}
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={settings.personalDailyBulletinEnabled || false}
          onChange={(e) => setSettings({ ...settings, personalDailyBulletinEnabled: e.target.checked })}
          className="w-5 h-5"
        />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Kişisel günlük bülteni etkinleştir
        </span>
      </label>

      {/* Time Picker */}
      {settings.personalDailyBulletinEnabled && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Gönderim Saati (Türkiye Saati)
            </label>
            <input
              type="time"
              value={settings.personalDailyBulletinTime || '09:00'}
              onChange={(e) => setSettings({ ...settings, personalDailyBulletinTime: e.target.value })}
              className="px-4 py-2 border rounded-lg"
            />
            <p className="text-xs text-gray-500 mt-1">
              Hafta içi her gün bu saatte gönderilir (haftasonları otomatik atlanır)
            </p>
          </div>

          {/* Recipients Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Bülten Alacak Kişiler
            </label>
            <div className="space-y-2 max-h-60 overflow-y-auto border rounded-lg p-3">
              {departmentUsers.map(user => (
                <label key={user.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 p-2 rounded">
                  <input
                    type="checkbox"
                    checked={(settings.personalDailyBulletinRecipients || []).includes(user.id)}
                    onChange={(e) => {
                      const current = settings.personalDailyBulletinRecipients || [];
                      const updated = e.target.checked
                        ? [...current, user.id]
                        : current.filter(id => id !== user.id);
                      setSettings({ ...settings, personalDailyBulletinRecipients: updated });
                    }}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {user.name || user.username}
                    {user.email && <span className="text-gray-500 ml-2">({user.email})</span>}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  </div>
)}
```

## 📧 Email Şablonu

Bülten şu bölümleri içerir:

1. **Header:** Tarih ve günün adı
2. **Kampanyalar (🎯):** Mor renkte
   - Kampanya adı
   - Aciliyet seviyesi
   - Durum
3. **Raporlar (📊):** Kırmızı renkte
   - Rapor adı
   - Bağlı kampanya
   - Durum
4. **Analitik İşler (📈):** Mavi renkte
   - İş adı
   - Aciliyet seviyesi
   - Durum

**Eğer kullanıcının o gün işi yoksa:**
- "Bugün için göreviniz yok! 🎉" mesajı gösterilir

## 🔄 Çalışma Mantığı

```
09:00 (Türkiye Saati)
    ↓
Cron Job Tetiklenir
    ↓
Haftasonu mu? → Evet → Çık
    ↓ Hayır
Ayarlar aktif mi? → Hayır → Çık
    ↓ Evet
Her alıcı için:
    ↓
    1. Bugün gönderildi mi? → Evet → Atla
    ↓ Hayır
    2. Kullanıcının bugünkü işlerini topla:
       - Kampanyalar (assigneeId === userId)
       - Raporlar (assigneeId === userId)
       - Analitik İşler (assigneeId === userId)
    ↓
    3. İş var mı? → Hayır → Atla
    ↓ Evet
    4. Email gönder
    ↓
    5. Log kaydet
```

## 📊 Firestore Optimizasyonları

API endpoint otomatik olarak optimize edilmiştir:

- ✅ Sadece **bugünün** verileri çekilir (date range query)
- ✅ Sadece **alıcı listesindeki** kullanıcılar çekilir (in query)
- ✅ Duplicate check ile **günde bir kez** gönderim
- ✅ Hafta sonu kontrolü ile **gereksiz çalıştırma engellenir**

**Günlük Maliyet Tahmini:**
- Okuma: ~50-100 (3 collection x alıcı sayısı)
- Yazma: ~10 (log yazma)
- **Toplam:** Ücretsiz limitler içinde

## 🧪 Test

Manuel test için:

```bash
curl "https://kampanya-takvimi.vercel.app/api/cron-personal-bulletin?key=supergizli120200"
```

Başarılı response:

```json
{
  "success": true,
  "result": {
    "sent": 3,
    "failed": 0,
    "skipped": 2
  }
}
```

## 🐛 Troubleshooting

### "Settings not configured"
**Çözüm:** Firestore'da `reminderSettings/default` dokümanı oluşturun.

### "Unauthorized"
**Çözüm:** Cron URL'deki key'i kontrol edin (`supergizli120200`).

### "Quota exceeded"
**Çözüm:** Firebase Blaze plan'a yükseltin.

### Email gitmiyor
**Kontrol listesi:**
1. `personalDailyBulletinEnabled: true` mi?
2. `personalDailyBulletinTime` doğru ayarlı mı?
3. Recipient list'te kullanıcı var mı?
4. Kullanıcının `email` field'ı dolu mu?
5. Kullanıcının bugün işi var mı?
6. Haftasonu değil mi?
7. Vercel logs'da hata var mı?

## 📝 Örnek Kullanım Senaryosu

**Ahmet (Analitik):**
- Bugünkü işleri:
  - 2 Kampanya
  - 1 Rapor
  - 3 Analitik İş
- Saat 09:00'da email alır
- Email'de toplam 6 iş gösterilir, kategorilere ayrılmış

**Ayşe (Designer):**
- Bugünkü işleri:
  - 0 Kampanya
  - 0 Rapor
  - 0 Analitik İş
- Email **gönderilmez** (gereksiz spam önlenir)

**Mehmet (Kampanya Yapan):**
- Haftasonu
- Email **gönderilmez** (haftasonu kontrolü)

---

## 🚀 Sonraki Adımlar

1. ✅ Firestore ayarlarını yapın
2. ✅ Cron job oluşturun
3. ⏳ 1 gün bekleyin ve test edin
4. ⏳ (Opsiyonel) UI panelini ekleyin

İyi kullanımlar! 🎉
