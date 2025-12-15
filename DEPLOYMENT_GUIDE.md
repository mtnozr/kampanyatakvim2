# Vercel Deployment Guide

## Firebase Authentication & Admin Features

Bu proje, kullanıcıları yönetmek (silmek ve tekrar oluşturmak) için Firebase Admin SDK kullanan bir Vercel Serverless Function (`api/admin.ts`) içerir.
Bu özelliğin çalışması için Vercel üzerinde bir Çevre Değişkeni (Environment Variable) tanımlamanız gerekmektedir.

### Adım 1: Firebase Service Account Oluşturma
1. [Firebase Console](https://console.firebase.google.com/) adresine gidin.
2. Projenizi seçin.
3. **Project settings** (Proje ayarları) -> **Service accounts** sekmesine gidin.
4. **Generate new private key** butonuna tıklayın ve indirilen JSON dosyasını açın.

### Adım 2: Vercel Ayarları
1. [Vercel Dashboard](https://vercel.com/dashboard) üzerinden projenizi seçin.
2. **Settings** -> **Environment Variables** menüsüne gidin.
3. Yeni bir değişken ekleyin:
   - **Key:** `FIREBASE_SERVICE_ACCOUNT`
   - **Value:** İndirdiğiniz JSON dosyasının *tüm içeriğini* buraya yapıştırın.
4. **Save** butonuna tıklayın.
5. Değişikliklerin aktif olması için projenizi **Redeploy** yapmanız gerekebilir (veya bir sonraki push ile aktif olur).

### Not
Bu özellik `localhost` üzerinde çalışmaz (Vercel Dev kullanılmadığı sürece). Yerel geliştirmede kullanıcı silme işlemi sadece veritabanından siler, Auth kaydı kalır.
