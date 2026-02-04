# Cron Job Optimizasyonları

Bu dokuman, daily digest cron job'ındaki Firestore optimizasyonlarını açıklar.

## ✅ Yapılan Optimizasyonlar

### 1. **Event Filtreleme (En Büyük Kazanç)**
**Öncesi:** Tüm events collection'ı çekiliyordu (potansiyel olarak binlerce doküman)
```typescript
db.collection('events').get()  // ❌ Tüm events'leri çeker
```

**Sonrası:** Sadece bugünün events'leri çekiliyor
```typescript
db.collection('events')
    .where('date', '>=', startOfDay)
    .where('date', '<=', endOfDay)
    .get()  // ✅ Sadece bugünkü events'ler
```

**Kazanç:** Eğer 1000 event varsa ve günde 10 event oluyorsa, **990 okuma tasarrufu** (99% azalma)

---

### 2. **Selective User Fetching**
**Öncesi:** Tüm users collection'ı çekiliyordu
```typescript
db.collection('users').get()  // ❌ Tüm kullanıcılar
```

**Sonrası:** Sadece bugünün kampanyalarına atanmış kullanıcılar çekiliyor
```typescript
db.collection('users')
    .where(FieldPath.documentId(), 'in', assigneeIds)
    .get()  // ✅ Sadece atanan kullanıcılar
```

**Kazanç:** Eğer 50 kullanıcı varsa ve bugün 5 kullanıcı atanmışsa, **45 okuma tasarrufu** (90% azalma)

---

### 3. **Selective Department Users Fetching**
**Öncesi:** Tüm departmentUsers collection'ı çekiliyordu
```typescript
db.collection('departmentUsers').get()  // ❌ Tüm department users
```

**Sonrası:** Sadece email alacak olanlar çekiliyor
```typescript
db.collection('departmentUsers')
    .where(FieldPath.documentId(), 'in', recipientIds)
    .get()  // ✅ Sadece email alacaklar
```

**Kazanç:** Eğer 30 department user varsa ve 5'i email alıyorsa, **25 okuma tasarrufu** (83% azalma)

---

### 4. **Batch Logging**
**Öncesi:** Her email için ayrı bir log yazılıyordu
```typescript
for (const designer of designers) {
    await logDailyDigest(db, ...);  // ❌ Her biri ayrı yazma
}
```

**Sonrası:** Tüm loglar bir batch ile yazılıyor
```typescript
const batch = db.batch();
for (const log of logs) {
    batch.set(logRef, log);  // ✅ Tek seferde yazma
}
await batch.commit();
```

**Kazanç:** 5 email gönderilirse, **4 yazma tasarrufu** (80% azalma)

---

## 📊 Toplam Tasarruf Örneği

### Senaryo: Ortalama bir gün
- **1000 total events**, bugün **10 event**
- **50 total users**, bugün **5 atanan**
- **30 total dept users**, **5 email alacak**
- **5 email gönderilecek**

### Önceki Okuma/Yazma:
```
Okuma:
- Events: 1000 okuma
- Users: 50 okuma
- Dept Users: 30 okuma
- Lock check: 1 okuma
- Settings: 1 okuma
TOPLAM: 1082 okuma

Yazma:
- Lock: 1 yazma
- Logs: 5 yazma (her email için)
TOPLAM: 6 yazma
```

### Yeni Okuma/Yazma:
```
Okuma:
- Events: 10 okuma (sadece bugünkiler)
- Users: 5 okuma (sadece atananlar)
- Dept Users: 5 okuma (sadece email alacaklar)
- Lock check: 1 okuma
- Settings: 1 okuma
TOPLAM: 22 okuma ✅ 98% azalma!

Yazma:
- Lock: 1 yazma
- Logs: 1 yazma (batch)
TOPLAM: 2 yazma ✅ 67% azalma!
```

---

## 🔥 Firestore Index Gereksinimleri

Yaptığımız optimizasyonlar için Firestore index'leri gerekiyor.

### Gerekli Index:

#### 1. Events Collection - Date Range Query
```
Collection: events
Fields:
  - date (Ascending)
  - __name__ (Ascending)
```

**Index oluşturma:**
1. Firebase Console → Firestore Database
2. Indexes sekmesi
3. "Create Index" tıklayın
4. Collection ID: `events`
5. Field 1: `date` - Ascending
6. Query Scope: Collection

Veya ilk çalıştırmada Firebase otomatik olarak index linki verecek.

---

## 📈 Maliyet Hesaplaması

### Blaze Plan Fiyatlandırma (2026):
- **İlk 50,000 okuma/gün: ÜCRETSİZ**
- **İlk 20,000 yazma/gün: ÜCRETSİZ**
- Sonrası: $0.06 per 100K okuma, $0.18 per 100K yazma

### Optimizasyon Sonrası:
- Günlük cron: ~22 okuma, ~2 yazma
- Aylık: ~660 okuma, ~60 yazma
- **SONUÇ: Tamamen ücretsiz limitler içinde! 🎉**

---

## 🚀 Deployment

Değişiklikler otomatik olarak Vercel'e deploy edilecek. Manuel deployment için:

```bash
vercel --prod
```

---

## ✅ Test

Optimize edilmiş endpoint'i test etmek için:

```bash
curl "https://kampanya-takvimi.vercel.app/api/cron-daily-digest?key=YOUR_SECRET_KEY"
```

Veya simple test endpoint:

```bash
curl "https://kampanya-takvimi.vercel.app/api/cron-daily-digest-simple?key=YOUR_SECRET_KEY"
```

---

## 📝 Notlar

- Index'ler oluşturulmadan query'ler **çalışmayacaktır**
- Firebase Console'da index oluşturma linki otomatik verilecek
- Index oluşturma ~5-10 dakika sürebilir
- Blaze plan gereklidir ama çok küçük maliyetli (muhtemelen $0/ay)
