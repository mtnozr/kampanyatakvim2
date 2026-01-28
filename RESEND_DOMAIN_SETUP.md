# 🌐 Resend Domain Verification (Production Kullanım)

Ücretsiz Resend hesabı sadece kayıtlı email'e gönderim yapar. **Herhangi bir email adresine** göndermek için domain doğrulaması gerekiyor.

---

## 🎯 Neden Gerekli?

**Şu anda:**
- ✅ Test email: Sadece Resend hesabınıza kayıtlı email'e gider
- ❌ Diğer kullanıcılara: Mail gönderilemiyor

**Domain doğrulaması sonrası:**
- ✅ Herhangi bir email adresine gönderim
- ✅ Şirket domain'iniz ile profesyonel görünüm
- ✅ Spam klasörüne düşme riski azalır

---

## 📝 Kurulum Adımları

### 1️⃣ Resend Dashboard'a Gidin
- https://resend.com/domains

### 2️⃣ Domain Ekleyin
1. **"Add Domain"** butonuna tıklayın
2. Domain'inizi girin (örn: `sirket.com`)
3. **"Add Domain"** ile onaylayın

### 3️⃣ DNS Kayıtlarını Alın
Resend size 3 DNS kaydı verecek:

#### A) SPF Record (TXT)
```
Type: TXT
Name: @
Value: v=spf1 include:amazonses.com ~all
```

#### B) DKIM Record (TXT)
```
Type: TXT
Name: resend._domainkey
Value: [Resend'den alacağınız uzun key]
```

#### C) DMARC Record (TXT) - İsteğe Bağlı
```
Type: TXT
Name: _dmarc
Value: v=DMARC1; p=none
```

### 4️⃣ DNS Kayıtlarını Domain Sağlayıcınıza Ekleyin

Domain'inizi nereden aldıysanız oraya gidin:

#### **GoDaddy:**
1. DNS Management → DNS Records
2. "Add" → TXT Record
3. Resend'deki değerleri girin

#### **Cloudflare:**
1. DNS → Add Record
2. Type: TXT
3. Name ve Value'ları girin

#### **Namecheap:**
1. Advanced DNS → Add New Record
2. TXT Record seçin
3. Host ve Value girin

### 5️⃣ Doğrulamayı Bekleyin
- DNS değişiklikleri **15 dakika - 48 saat** arası yayılır
- Resend otomatik kontrol eder
- Doğrulandığında yeşil ✅ işareti görürsünuz

### 6️⃣ Email Adresini Güncelleyin

Domain doğrulandıktan sonra `api/send-reminder.ts` dosyasını güncelleyin:

```typescript
// Önceki (test):
from: 'Kampanya Takvimi <onboarding@resend.dev>'

// Yeni (production):
from: 'Kampanya Takvimi <hatirlatma@sirket.com>'
```

---

## 🧪 Test Etme (Domain Sonrası)

### Test 1: Manuel Email
1. Ayarlar → Test Email Gönder
2. **Herhangi bir email** adresine gönder
3. ✅ Başarılı olmalı

### Test 2: Gerçek Görev
1. Kampanya oluştur
2. Herhangi bir kullanıcıya ata
3. Firebase'de tarihi 2 gün öncesine al
4. "Şimdi Kontrol Et"
5. ✅ Email gitmeli

---

## 💰 Maliyet

**Ücretsiz Plan (Domain Doğrulamalı):**
- 3,000 email/ay
- Herhangi bir email adresine gönderim
- Kredi kartı gerekmez

---

## ⚠️ Sorun Giderme

### DNS Doğrulama Başarısız
1. DNS kayıtlarını tekrar kontrol edin
2. 24 saat bekleyin (DNS propagation)
3. DNS checker kullanın: https://dnschecker.org

### Email Gönderilmiyor
1. Domain verified mı kontrol edin (Resend dashboard)
2. From email domain ile eşleşmeli
3. SPF/DKIM kayıtları doğru mu?

### Spam Klasörüne Düşüyor
1. DMARC kaydı ekleyin
2. Domain reputation'ı artırın (zaman alır)
3. Email içeriğini optimize edin (spam kelimeleri yok)

---

## 🚀 Hızlı Alternatif (Domain Olmadan Test)

Domain doğrulaması yapmadan test etmek için:

### Yöntem: Firestore Manuel Tarih Değiştirme

1. **Firebase Console** → Firestore Database
2. `events` koleksiyonu
3. Test görevini bulun
4. `createdAt` → 2 gün önceki tarihe değiştir
5. Ayarlar → "Şimdi Kontrol Et"
6. Sadece **sizin email'inize** gidecek ama sistem çalışıyor demektir

---

## 📊 Domain Önerileri

### Subdomain Kullanın (Önerilen)
```
hatirlatma@sirket.com
bildirim@sirket.com
takvim@sirket.com
```

### Ana Domain
```
info@sirket.com
admin@sirket.com
```

---

## 🔗 Faydalı Linkler

- **Resend Domains**: https://resend.com/domains
- **DNS Checker**: https://dnschecker.org
- **SPF Record Checker**: https://mxtoolbox.com/spf.aspx
- **DKIM Validator**: https://dkimvalidator.com

---

**Özet:** Domain doğrulaması yapmadan sadece kayıtlı email'e gönderim yapabilirsiniz. Production için mutlaka domain verification gerekli!
