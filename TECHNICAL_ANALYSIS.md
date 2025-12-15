# Kampanya Takvimi (CRM) - Teknik Analiz ve Dokümantasyon

## 1. Proje Genel Bakışı
Bu proje, kampanya yönetimi ve iş takibi amacıyla geliştirilmiş, **React + TypeScript** tabanlı bir Single Page Application (SPA) çözümüdür. Veri tabanı ve kimlik doğrulama işlemleri için **Firebase** ekosistemini, sunucu tarafı işlemleri (Serverless Functions) için **Vercel** altyapısını kullanır.

Uygulama; takvim yönetimi, talep (iş isteği) toplama, rol tabanlı yetkilendirme ve raporlama modüllerini içerir.

## 2. Teknoloji Yığını (Tech Stack)

### Frontend
*   **Framework:** React 18
*   **Dil:** TypeScript
*   **Build Tool:** Vite
*   **Styling:** Tailwind CSS (Responsive & Dark Mode desteği)
*   **İkon Seti:** Lucide React
*   **Tarih İşlemleri:** date-fns
*   **PDF Export:** html2canvas + jsPDF

### Backend & Database (Serverless)
*   **Database:** Google Firestore (NoSQL)
*   **Authentication:** Firebase Authentication (Email/Password)
*   **Server Side:** Vercel Serverless Functions (Node.js)
*   **Admin SDK:** firebase-admin (Backend işlemleri için)

## 3. Mimari ve Güvenlik

### Kimlik Doğrulama (Authentication)
Sistem **Hibrit Kimlik Doğrulama** yapısını kullanır:
1.  **Firebase Auth:** Kullanıcıların güvenli bir şekilde oturum açmasını sağlar (Email/Şifre).
2.  **Firestore `departmentUsers` Koleksiyonu:** Kullanıcıların rollerini ve ek bilgilerini (Departman, Yetkiler) tutar.
3.  **Senkronizasyon:** Bir kullanıcı oluşturulduğunda hem Firebase Auth tarafında (UID ile) hem de Firestore tarafında kayıt açılır.

### Rol Yönetimi (RBAC)
Uygulama aşağıdaki rolleri destekler:
*   **Admin:** Tam yetki. Kullanıcı ekleme/silme, tüm olayları yönetme, duyuru yapma.
*   **Designer:** Tasarım odaklı işleri görüntüleme/düzenleme yetkisi.
*   **Kampanya Yapan:** Kampanya girişleri yapma yetkisi.
*   **Business Unit:** İş birimi yetkisi (Genellikle talep oluşturma).
*   **Guest:** Sadece görüntüleme (Kısıtlı yetki).

### API Güvenliği
*   Kritik işlemler (Örn: Kullanıcı silme) client-side yerine `/api/admin` endpoint'i üzerinden yapılır.
*   Bu endpoint, Vercel üzerinde çalışır ve `firebase-admin` SDK kullanarak yetkili işlem gerçekleştirir.
*   Environment Variable (`FIREBASE_SERVICE_ACCOUNT`) ile güvenli servis hesabı yönetimi sağlanır.

## 4. Modüller ve Özellikler

### A. Takvim Modülü
*   **Aylık Görünüm:** Dinamik olarak ay değiştirme.
*   **Olay (Event) Yönetimi:**
    *   CRUD işlemleri (Ekle/Düzenle/Sil).
    *   **Drag & Drop:** Olayların gününü sürükle-bırak ile değiştirme.
    *   **Kategorizasyon:** Kampanya, Özel Gün, İzin vb. tipler.
    *   **Aciliyet Durumu:** Very High, High, Medium, Low (Renk kodlu).
    *   **Atama:** İşin kime atandığı (Assignee).
*   **Filtreleme:** Kişiye, aciliyete veya duruma göre gelişmiş filtreleme.

### B. Talep (Request) Yönetimi
*   **Talep Oluşturma:** Kullanıcılar takvim dışından iş talebi oluşturabilir.
*   **Onay Mekanizması:** Yetkili kullanıcılar gelen talepleri onaylayıp takvime "Olay" olarak dönüştürebilir.
*   **Reddetme:** Talepler reddedilebilir ve arşivlenir.

### C. Bildirim ve Loglama
*   **Real-time Bildirimler:** Firestore listener'lar ile anlık değişiklikler (yeni talep, olay değişimi) kullanıcılara bildirilir.
*   **Aktivite Logları:** Kimin ne zaman ne işlem yaptığı (Event ekleme, silme vb.) kayıt altına alınır ve "Son Aktiviteler" panelinde gösterilir.
*   **Duyuru Sistemi:** Admin tüm kullanıcılara "Okundu" takibi yapılabilen duyurular yayınlayabilir.

### D. Raporlama ve Çıktı
*   **PDF Export:** Takvim görünümü, özel bir render motoru ile (HTML -> Canvas -> PDF) A4 yatay formatında dışa aktarılabilir.
*   **Ayın Şampiyonu:** Tamamlanan iş sayısına göre ayın en aktif personeli otomatik hesaplanır.

### E. UI/UX Özellikleri
*   **Tema Desteği:** Açık/Koyu mod ve zamana bağlı otomatik tema değişimi.
*   **Responsive:** Mobil ve masaüstü uyumlu tasarım.
*   **Toast Mesajları:** Kullanıcı işlemlerinde anlık geri bildirimler.

## 5. Veri Modeli (Firestore Schema)

*   `events`: Takvim olayları (title, date, type, urgency, status, assignee...).
*   `departmentUsers`: Sistem kullanıcıları ve rolleri (uid, username, role flags...).
*   `requests`: İş talepleri (title, description, status: pending/approved/rejected).
*   `logs`: Sistem logları (message, timestamp, user).
*   `announcements`: Duyurular (title, content, visibleTo, readBy[]).
*   `departments`: Departman tanımları.
*   `users`: (Legacy) Personel listesi (Avatar/Emoji yönetimi için).

## 6. Kurulum ve Dağıtım (Deployment)

### Geliştirme Ortamı
```bash
npm install       # Bağımlılıkları yükle
npm run dev       # Local sunucuyu başlat (Vite)
```

### Production (Vercel)
*   **Build Command:** `npm run build` (TSC + Vite Build)
*   **API:** `/api` klasörü altındaki dosyalar Vercel Serverless Function olarak derlenir.
*   **Env Variables:**
    *   Firebase Config (Client): `VITE_FIREBASE_API_KEY`, vb.
    *   Firebase Admin (Server): `FIREBASE_SERVICE_ACCOUNT` (JSON).

## 7. Bilinen Kısıtlamalar ve Notlar
*   **Localhost API:** `/api/admin` endpoint'i sadece Vercel ortamında veya `vercel dev` komutu ile çalışır. Standart `npm run dev` ile bu endpoint'e erişilemez (CORS ve Serverless yapısı gereği).
*   **PDF Export:** Client-side render edildiği için çok büyük veri setlerinde tarayıcı performansına bağlıdır.
