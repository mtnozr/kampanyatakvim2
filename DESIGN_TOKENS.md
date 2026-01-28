# 🎨 Design Tokens Kullanım Kılavuzu

Bu proje artık **Design Token Sistemi** kullanıyor. Tüm tasarım değerleri (renkler, spacing, typography vb.) merkezi olarak `tokens.ts` dosyasında tanımlı.

## 📋 İçindekiler
- [Nedir?](#nedir)
- [Neden Kullanmalıyım?](#neden-kullanmalıyım)
- [Nasıl Kullanılır?](#nasıl-kullanılır)
- [Token Kategorileri](#token-kategorileri)
- [Örnekler](#örnekler)

---

## Nedir?

Design Token Sistemi, tasarım değerlerini (renkler, spacing, font boyutları vb.) merkezi bir yerde sabit değişkenler olarak tanımlama yaklaşımıdır.

### ❌ Önceki Durum (Tutarsız)
```tsx
<button className="px-4 py-2 rounded-lg">Kaydet</button>
<button className="px-3 py-1.5 rounded-xl">İptal</button>
<button className="px-6 py-2 rounded-2xl">Gönder</button>
```

### ✅ Yeni Durum (Tutarlı)
```tsx
<button className="px-md py-sm rounded-md">Kaydet</button>
<button className="px-md py-sm rounded-md">İptal</button>
<button className="px-md py-sm rounded-md">Gönder</button>
```

---

## Neden Kullanmalıyım?

1. **Tutarlılık**: Her yerde aynı değerler kullanılır
2. **Kolay Değişiklik**: Bir değeri değiştirince tüm uygulama güncellenir
3. **Okunabilirlik**: `text-[11px]` yerine `text-sm` daha anlamlı
4. **Bakım Kolaylığı**: Hangi değerlerin kullanılabileceği belli
5. **Tasarımcı-Developer İşbirliği**: Herkes aynı dili konuşur

---

## Nasıl Kullanılır?

### 1️⃣ Tailwind Class'ları ile (Önerilen)

Token'lar Tailwind config'ine entegre edildi. Doğrudan Tailwind class'ları kullanabilirsiniz:

```tsx
// Spacing
<div className="p-md">...</div>
<div className="gap-lg">...</div>

// Border Radius
<button className="rounded-md">...</button>
<div className="rounded-lg">...</div>

// Primary Color
<button className="bg-primary-700 text-white">...</button>
<div className="text-primary-500">...</div>

// Shadow
<div className="shadow-lg">...</div>

// Z-Index
<div className="z-modal">...</div>
```

### 2️⃣ TypeScript ile (İleri Düzey)

Özel durumlar için tokens dosyasından import edebilirsiniz:

```tsx
import { colors, spacing, radius } from './tokens';

// Inline style kullanımı
<div style={{
  backgroundColor: colors.primary[700],
  padding: spacing.md,
  borderRadius: radius.lg
}}>
  ...
</div>

// Dinamik class oluşturma
const buttonClasses = `px-${spacing.md} py-${spacing.sm} rounded-${radius.md}`;
```

---

## Token Kategorileri

### 🎨 COLORS

#### Primary (Mor/Violet - Marka Rengi)
```tsx
<button className="bg-primary-700">Primary Button</button>
<div className="text-primary-500">Primary Text</div>
```

Tonlar: 50, 100, 200, 300, 400, 500, 600, **700** (ana), 800, 900

#### Urgency Renkleri (Aciliyet Seviyeleri)
Otomatik olarak `URGENCY_CONFIGS` ile kullanılır:
- **Very High**: Kırmızı (`red-100`, `red-500`, `red-900`)
- **High**: Turuncu (`orange-100`, `orange-500`, `orange-900`)
- **Medium**: Mavi (`blue-100`, `blue-500`, `blue-900`)
- **Low**: Gri (`gray-100`, `gray-500`, `gray-900`)

#### Status Renkleri
- **Planned**: Sarı (`yellow-100`, `yellow-500`, `yellow-900`)
- **Completed**: Yeşil (`green-100`, `green-500`, `green-900`)
- **Cancelled**: Kırmızı (`red-50`, `red-500`, `red-900`)

#### Semantic Renkleri
```tsx
<div className="text-green-500">Başarılı!</div>      // Success
<div className="text-amber-500">Uyarı!</div>         // Warning
<div className="text-red-500">Hata!</div>            // Error
<div className="text-blue-500">Bilgi</div>           // Info
```

---

### 📏 SPACING

8px tabanlı spacing sistemi:

| Token | Değer | Tailwind Class | Kullanım |
|-------|-------|----------------|----------|
| `xs` | 8px | `p-xs`, `m-xs`, `gap-xs` | Çok küçük boşluklar |
| `sm` | 12px | `p-sm`, `m-sm`, `gap-sm` | Küçük boşluklar |
| **`md`** | **16px** | `p-md`, `m-md`, `gap-md` | **Standart boşluklar** |
| `lg` | 24px | `p-lg`, `m-lg`, `gap-lg` | Büyük boşluklar |
| `xl` | 32px | `p-xl`, `m-xl`, `gap-xl` | Çok büyük boşluklar |
| `2xl` | 48px | `p-2xl`, `m-2xl`, `gap-2xl` | Section arası |
| `3xl` | 64px | `p-3xl`, `m-3xl`, `gap-3xl` | Sayfa arası |

#### Örnekler:
```tsx
// Padding
<div className="p-md">Standart padding</div>
<div className="px-lg py-sm">Yatay büyük, dikey küçük</div>

// Margin
<div className="mb-lg">Altında büyük margin</div>

// Gap (Flexbox/Grid)
<div className="flex gap-md">...</div>
```

---

### 🔲 BORDER RADIUS

| Token | Değer | Tailwind Class | Kullanım |
|-------|-------|----------------|----------|
| `sm` | 6px | `rounded-sm` | Badges, küçük butonlar |
| **`md`** | **8px** | `rounded-md` | **Standart elementler** |
| `lg` | 12px | `rounded-lg` | Kartlar, büyük alanlar |
| `xl` | 16px | `rounded-xl` | Modal'lar |
| `full` | 9999px | `rounded-full` | Avatar'lar, pill butonlar |

#### Örnekler:
```tsx
<button className="rounded-md">Standart Buton</button>
<div className="rounded-lg">Kart</div>
<img className="rounded-full" src="..." />
```

---

### 🌑 SHADOWS

| Token | Tailwind Class | Kullanım |
|-------|----------------|----------|
| `sm` | `shadow-sm` | Kartlar, basit elevation |
| `md` | `shadow-md` | Hover state'ler |
| **`lg`** | `shadow-lg` | **Modal'lar, dropdown'lar** |
| `xl` | `shadow-xl` | Popover'lar, büyük elementler |
| `2xl` | `shadow-2xl` | Maksimum derinlik |

#### Örnekler:
```tsx
<div className="shadow-sm">Hafif gölge</div>
<div className="shadow-lg">Modal gölgesi</div>
```

---

### 🔤 TYPOGRAPHY

#### Font Boyutları

| Token | Boyut | Tailwind Class | Kullanım |
|-------|-------|----------------|----------|
| `xs` | 12px | `text-xs` | Küçük bilgiler, yardımcı metinler |
| **`sm`** | **14px** | `text-sm` | **Standart metin boyutu** |
| `base` | 16px | `text-base` | Body text |
| `lg` | 18px | `text-lg` | Başlıklar (H4-H5) |
| `xl` | 20px | `text-xl` | Başlıklar (H3) |
| `2xl` | 24px | `text-2xl` | Başlıklar (H2) |
| `3xl` | 30px | `text-3xl` | Başlıklar (H1) |

#### Font Weights

| Token | Değer | Tailwind Class | Kullanım |
|-------|-------|----------------|----------|
| `light` | 300 | `font-light` | İnce metinler |
| `normal` | 400 | `font-normal` | Standart metinler |
| **`medium`** | **500** | `font-medium` | **Vurgu** |
| `semibold` | 600 | `font-semibold` | Başlıklar |
| `bold` | 700 | `font-bold` | Güçlü vurgu |

#### Örnekler:
```tsx
<h1 className="text-2xl font-bold">Başlık</h1>
<p className="text-sm font-normal">Açıklama metni</p>
<span className="text-xs text-gray-500">Yardımcı bilgi</span>
```

---

### 🔢 Z-INDEX

| Token | Değer | Tailwind Class | Kullanım |
|-------|-------|----------------|----------|
| `dropdown` | 10 | `z-dropdown` | Dropdown menüler |
| `sticky` | 20 | `z-sticky` | Sticky header'lar |
| `fixed` | 30 | `z-fixed` | Fixed elementler |
| `modal-backdrop` | 40 | `z-modal-backdrop` | Modal arka planı |
| **`modal`** | **50** | `z-modal` | **Modal içerik** |
| `popover` | 60 | `z-popover` | Popover'lar |
| `tooltip` | 70 | `z-tooltip` | Tooltip'ler |

---

### ⏱️ TRANSITIONS

#### Duration
```tsx
<div className="transition-all duration-fast">Hızlı (150ms)</div>
<div className="transition-all duration-normal">Normal (200ms)</div>
<div className="transition-all duration-slow">Yavaş (300ms)</div>
```

---

## Örnekler

### ✅ Buton Örneği

```tsx
// Standart primary button
<button className="
  px-md py-sm
  bg-primary-700 hover:bg-primary-800
  text-white
  rounded-md
  shadow-sm hover:shadow-md
  transition-all duration-normal
">
  Kaydet
</button>

// Secondary button
<button className="
  px-md py-sm
  bg-gray-100 hover:bg-gray-200
  text-gray-700
  rounded-md
  transition-colors duration-fast
">
  İptal
</button>
```

### ✅ Kart Örneği

```tsx
<div className="
  p-lg
  bg-white dark:bg-slate-800
  rounded-lg
  shadow-sm
  border border-gray-200 dark:border-slate-700
">
  <h3 className="text-lg font-semibold mb-sm">Başlık</h3>
  <p className="text-sm text-gray-600">Açıklama</p>
</div>
```

### ✅ Modal Örneği

```tsx
<div className="
  fixed inset-0
  z-modal-backdrop
  bg-black/40
  backdrop-blur-sm
">
  <div className="
    z-modal
    max-w-lg
    p-lg
    bg-white dark:bg-slate-800
    rounded-lg
    shadow-xl
  ">
    <h2 className="text-xl font-bold mb-md">Modal Başlık</h2>
    <p className="text-sm mb-lg">Modal içeriği...</p>
    <div className="flex gap-md justify-end">
      <button className="px-md py-sm rounded-md bg-gray-100">İptal</button>
      <button className="px-md py-sm rounded-md bg-primary-700 text-white">Tamam</button>
    </div>
  </div>
</div>
```

### ✅ Form Input Örneği

```tsx
<input
  type="text"
  className="
    w-full
    px-md py-sm
    border border-gray-300 dark:border-slate-600
    rounded-md
    text-sm
    focus:border-primary-500 focus:ring-2 focus:ring-primary-200
    transition-all duration-fast
  "
  placeholder="Ad Soyad"
/>
```

---

## 🚫 Yapmayın

```tsx
// ❌ Random değerler
<div className="px-4 py-2 rounded-lg">...</div>
<div className="px-3 py-1.5 rounded-xl">...</div>
<div className="px-6 py-2 rounded-2xl">...</div>

// ❌ Custom değerler
<div className="text-[11px]">...</div>
<div className="text-[13px]">...</div>

// ❌ Inline renkler
<div style={{ color: '#7C3AED' }}>...</div>
```

## ✅ Yapın

```tsx
// ✅ Token kullanımı
<div className="px-md py-sm rounded-md">...</div>
<div className="px-md py-sm rounded-md">...</div>
<div className="px-md py-sm rounded-md">...</div>

// ✅ Standart boyutlar
<div className="text-sm">...</div>
<div className="text-base">...</div>

// ✅ Token renkleri
<div className="text-primary-700">...</div>
```

---

## 📚 Ek Kaynaklar

- `tokens.ts` - Tüm token tanımları
- `index.html` - Tailwind config (line 11-61)
- `constants.ts` - Renk kullanım örnekleri

## 🔄 Güncelleme Tarihi

Son güncelleme: 2026-01-28

---

**Not:** Yeni component oluştururken veya mevcut component'leri güncellerken bu kılavuzu takip edin. Tutarlı bir tasarım dili için token sistemini kullanmaya özen gösterin.
