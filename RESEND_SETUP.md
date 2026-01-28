# 📧 Resend Email Kurulumu

Otomatik hatırlatma sistemi için Resend email servisini kullanıyoruz.

## 🚀 Resend Hesabı Oluşturma (2 dakika)

### 1. Resend'e Kaydol
1. **[Resend.com](https://resend.com)** adresine git
2. **Sign Up** butonuna tıkla
3. Email ile kayıt ol (GitHub ile de kayıt olabilirsin)

### 2. Email Doğrulama
1. Email'ine gelen doğrulama linkine tıkla
2. Dashboard'a yönlendirileceksin

### 3. API Key Oluştur
1. Dashboard'da sol menüden **"API Keys"** sekmesine git
2. **"Create API Key"** butonuna tıkla
3. Key'e bir isim ver (örn: "Kampanya Takvimi")
4. **Create** butonuna tıkla
5. ⚠️ **ÖNEMLİ:** API key'i **hemen kopyala** (bir daha gösterilmeyecek!)
   - Format: `re_xxxxxxxxxxxxxxxxxxxxx`

### 4. Ücretsiz Kota
✅ **3,000 email/ay ücretsiz**
- Günlük ~100 email
- Kurumsal kullanım için yeterli
- Kredi kartı gerektirmez

---

## ⚙️ Kampanya Takvimi'nde Kurulum

### 1. Ayarlar Sayfasına Git
1. Uygulamaya giriş yap (admin/designer/kampanyaYapan olarak)
2. Üst menüden **"⚙️ AYARLAR"** tab'ına tıkla

### 2. API Key'i Gir
1. **"Resend API Key"** alanına kopyaladığın key'i yapıştır
2. **"Otomatik Hatırlatmaları Aktifleştir"** checkbox'ını işaretle
3. Hatırlatma kurallarını kontrol et:
   - **Very High**: 1 gün sonra hatırlat
   - **High/Medium/Low**: 2 gün sonra hatırlat
4. **"Ayarları Kaydet"** butonuna tıkla

### 3. Test Et
1. **"Test Email Gönder"** bölümüne email adresini yaz
2. **"Test Gönder"** butonuna tıkla
3. Email gelip gelmediğini kontrol et (spam klasörüne de bak)

### 4. Manuel Çalıştır (İsteğe Bağlı)
1. **"Manuel Hatırlatma Kontrolü"** bölümünden
2. **"Şimdi Kontrol Et"** butonuna tıkla
3. Sistemdeki tüm görevler kontrol edilecek ve hatırlatmalar gönderilecek

---

## 📋 Nasıl Çalışır?

### Hatırlatma Mantığı
```
Görev Oluşturuldu: 1 Ocak
Urgency: Very High

→ 2 Ocak (1 gün sonra): Hatırlatma maili gönderilir
→ Bir kez gönderilir (tekrar gönderilmez)
```

```
Görev Oluşturuldu: 1 Ocak
Urgency: High/Medium/Low

→ 3 Ocak (2 gün sonra): Hatırlatma maili gönderilir
→ Bir kez gönderilir (tekrar gönderilmez)
```

### Otomatik Gönderim (Gelecek)
- **Manuel**: "Şimdi Kontrol Et" butonuyla
- **Otomatik** (yakında): Her gün otomatik kontrol edilecek

---

## 🎨 Email Şablonu

Gönderilen email'ler profesyonel template ile gönderilir:
- **Konu**: ⏰ Hatırlatma: {Görev Adı}
- **İçerik**:
  - Atanan kişinin adı
  - Görev başlığı
  - Urgency bilgisi
  - Kaç gün geçtiği
  - "Takvime Git" butonu

---

## 🔒 Güvenlik

### API Key Güvenliği
- ⚠️ API key'ini **kimseyle paylaşma**
- Firestore'da güvenli şekilde saklanır
- Sadece admin/designer/kampanyaYapan kullanıcıları görebilir

### Email Spam Kontrolü
- Her görev için **sadece 1 kez** hatırlatma gönderilir
- Rate limiting: Email'ler arasında 500ms gecikme
- Tamamlanan veya iptal edilen görevler için gönderilmez

---

## 🐛 Sorun Giderme

### Email Gelmiyor
1. **Spam klasörünü** kontrol et
2. **API key** doğru girilmiş mi kontrol et
3. **Hatırlatma sistemi** aktif mi kontrol et
4. **Test email** gönder ve sonucu kontrol et

### API Key Hatası
- `401 Unauthorized`: API key yanlış veya geçersiz
- `429 Too Many Requests`: Günlük kota dolmuş (3,000 email)
- `500 Server Error`: Resend servisi sorunu (birkaç dakika bekle)

### Hatırlatma Gönderilmiyor
1. **Görev atanmış mı?** (assigneeId var mı)
2. **Email adresi var mı?** (Kullanıcının email'i tanımlı mı)
3. **Görev tamamlanmış/iptal mı?** (Sadece aktif görevler için gönderilir)
4. **Daha önce gönderilmiş mi?** (Her görev için 1 kez gönderilir)
5. **Süre dolmuş mu?** (Very High: 1 gün, Diğer: 2 gün)

---

## 📊 Log Görüntüleme

**"Son Gönderilen Mailler"** bölümünde:
- Hangi görev için gönderildi
- Kime gönderildi
- Ne zaman gönderildi
- Başarılı/başarısız durumu

---

## 💡 İpuçları

1. **İlk kurulumda** test email göndererek doğrula
2. **Manuel kontrol** ile mevcut görevleri kontrol et
3. **Gönderim geçmişini** düzenli incele
4. **API key'i** not defterine kaydet (güvenli bir yerde)
5. **Resend Dashboard'dan** detaylı istatistikleri görebilirsin

---

## 🔗 Faydalı Linkler

- **Resend Dashboard**: https://resend.com/dashboard
- **Resend Dökümantasyon**: https://resend.com/docs
- **API Keys**: https://resend.com/api-keys
- **Email Logs**: https://resend.com/emails

---

## 🆘 Destek

Sorun yaşıyorsan:
1. Bu dokümandaki **Sorun Giderme** bölümünü kontrol et
2. **Test email** gönder ve sonucu gör
3. **Resend Dashboard**'dan email loglarını kontrol et
4. Sistem yöneticisine ulaş

---

**Son Güncelleme:** 2026-01-28
