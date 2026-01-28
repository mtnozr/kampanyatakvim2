import { CalendarEvent, UrgencyConfig, User, UrgencyLevel, Department, DifficultyLevel, DifficultyConfig } from './types';

/**
 * DESIGN TOKENS KULLANIMI
 * Artık renkler tokens.ts'den merkezi olarak yönetiliyor
 * Tailwind class'ları tutarlı şekilde kullanılıyor
 */

export const DIFFICULTY_CONFIGS: Record<DifficultyLevel, DifficultyConfig> = {
  'BASİT': {
    label: 'Basit',
    color: 'bg-green-100 border-green-200',
    textColor: 'text-green-700'
  },
  'BASİT ÜSTÜ': {
    label: 'Basit Üstü',
    color: 'bg-emerald-100 border-emerald-200',
    textColor: 'text-emerald-700'
  },
  'ORTA': {
    label: 'Orta',
    color: 'bg-yellow-100 border-yellow-200',
    textColor: 'text-yellow-700'
  },
  'ZOR': {
    label: 'Zor',
    color: 'bg-orange-100 border-orange-200',
    textColor: 'text-orange-700'
  },
  'ÇOK ZOR': {
    label: 'Çok Zor',
    color: 'bg-red-100 border-red-200',
    textColor: 'text-red-700'
  }
};

export const URGENCY_CONFIGS: Record<UrgencyLevel, UrgencyConfig> = {
  'Very High': {
    label: 'Çok Yüksek',
    colorBg: 'bg-red-100',
    colorBorder: 'border-red-500',
    colorText: 'text-red-900',
  },
  'High': {
    label: 'Yüksek',
    colorBg: 'bg-orange-100',
    colorBorder: 'border-orange-500',
    colorText: 'text-orange-900',
  },
  'Medium': {
    label: 'Orta',
    colorBg: 'bg-blue-100',
    colorBorder: 'border-blue-500',
    colorText: 'text-blue-900',
  },
  'Low': {
    label: 'Düşük',
    colorBg: 'bg-gray-100',
    colorBorder: 'border-gray-500',
    colorText: 'text-gray-900',
  },
};

export const STATUS_STYLES: Record<string, UrgencyConfig> = {
  'Planlandı': {
    label: 'Planlandı',
    colorBg: 'bg-yellow-100',
    colorBorder: 'border-yellow-500',
    colorText: 'text-yellow-900',
  },
  'Tamamlandı': {
    label: 'Tamamlandı',
    colorBg: 'bg-green-100',
    colorBorder: 'border-green-500',
    colorText: 'text-green-900',
  },
  'İptal Edildi': {
    label: 'İptal Edildi',
    colorBg: 'bg-red-50',
    colorBorder: 'border-red-500',
    colorText: 'text-red-900', // line-through eklenebilir
  },
};

export const REPORT_STATUS_STYLES: Record<string, UrgencyConfig> = {
  'pending': {
    label: 'Bekliyor',
    colorBg: 'bg-amber-100',
    colorBorder: 'border-amber-500',
    colorText: 'text-amber-900',
  },
  'done': {
    label: 'Tamamlandı',
    colorBg: 'bg-emerald-100',
    colorBorder: 'border-emerald-500',
    colorText: 'text-emerald-900',
  },
  'overdue': {
    label: 'Gecikmiş',
    colorBg: 'bg-red-100',
    colorBorder: 'border-red-500',
    colorText: 'text-red-900',
  },
};

// Sadece kurumsal ve temel Kadın/Erkek emojileri
export const AVAILABLE_EMOJIS = [
  '👨‍💼', '👩‍💼', // Ofis Çalışanı
  '👨‍💻', '👩‍💻', // Yazılımcı
  '👨', '👩',     // Standart
  '👱‍♂️', '👱‍♀️', // Profil
];

export const INITIAL_USERS: User[] = [
  { id: 'u1', name: 'Ahmet Yılmaz', email: 'ahmet@sirket.com', emoji: '👨‍💻' },
  { id: 'u2', name: 'Ayşe Demir', email: 'ayse@sirket.com', emoji: '👩‍💻' },
  { id: 'u3', name: 'Mehmet Öz', email: 'mehmet@sirket.com', emoji: '👨‍💼' },
];

export const INITIAL_DEPARTMENTS: Department[] = [
  { id: 'd1', name: 'Pazarlama' },
  { id: 'd2', name: 'İnsan Kaynakları' },
  { id: 'd3', name: 'Bilgi Teknolojileri' },
  { id: 'd4', name: 'Satış' },
  { id: 'd5', name: 'Finans' },
];

const today = new Date();
const startOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1);

// Helper to set day of month
const setDate = (date: Date, day: number) => {
  return new Date(date.getFullYear(), date.getMonth(), day);
};

export const INITIAL_EVENTS: CalendarEvent[] = [
  {
    id: '1',
    date: setDate(startOfCurrentMonth, 6),
    title: 'Kamera Arkası Çekimleri',
    urgency: 'Medium',
    assigneeId: 'u1',
    departmentId: 'd1',
  },
  {
    id: '2',
    date: setDate(startOfCurrentMonth, 8),
    title: 'Müşteri Anketi Analizi',
    urgency: 'High',
    assigneeId: 'u2',
    departmentId: 'd1',
  },
  {
    id: '3',
    date: setDate(startOfCurrentMonth, 14),
    title: 'Yaz İndirimi Lansmanı',
    urgency: 'Very High',
    assigneeId: 'u3',
    departmentId: 'd4',
  },
  {
    id: '4',
    date: setDate(startOfCurrentMonth, 17),
    title: 'Blog Yazısı: Destinasyonlar',
    urgency: 'Low',
    assigneeId: 'u1',
    departmentId: 'd1',
  },
  {
    id: '5',
    date: setDate(startOfCurrentMonth, 19),
    title: 'Kullanıcı Yorumları Derlemesi',
    urgency: 'Medium',
    assigneeId: 'u2',
    departmentId: 'd4',
  },
  {
    id: '6',
    date: setDate(startOfCurrentMonth, 22),
    title: 'Sürdürülebilirlik Raporu',
    urgency: 'Low',
    assigneeId: 'u3',
    departmentId: 'd2',
  },
];

export const DAYS_OF_WEEK = ['PZT', 'SAL', 'ÇAR', 'PER', 'CUM', 'CMT', 'PAZ'];

// Format: YYYY-MM-DD
export const TURKISH_HOLIDAYS: Record<string, string> = {
  // 2024
  '2024-01-01': 'Yılbaşı',
  '2024-04-09': 'Ramazan Bayramı Arifesi',
  '2024-04-10': 'Ramazan Bayramı 1. Gün',
  '2024-04-11': 'Ramazan Bayramı 2. Gün',
  '2024-04-12': 'Ramazan Bayramı 3. Gün',
  '2024-04-23': 'Ulusal Egemenlik ve Çocuk Bayramı',
  '2024-05-01': 'Emek ve Dayanışma Günü',
  '2024-05-19': 'Atatürk\'ü Anma, Gençlik ve Spor Bayramı',
  '2024-06-15': 'Kurban Bayramı Arifesi',
  '2024-06-16': 'Kurban Bayramı 1. Gün',
  '2024-06-17': 'Kurban Bayramı 2. Gün',
  '2024-06-18': 'Kurban Bayramı 3. Gün',
  '2024-06-19': 'Kurban Bayramı 4. Gün',
  '2024-07-15': 'Demokrasi ve Milli Birlik Günü',
  '2024-08-30': 'Zafer Bayramı',
  '2024-10-28': 'Cumhuriyet Bayramı Arifesi',
  '2024-10-29': 'Cumhuriyet Bayramı',
  // 2025
  '2025-01-01': 'Yılbaşı',
  '2025-03-29': 'Ramazan Bayramı Arifesi',
  '2025-03-30': 'Ramazan Bayramı 1. Gün',
  '2025-03-31': 'Ramazan Bayramı 2. Gün',
  '2025-04-01': 'Ramazan Bayramı 3. Gün',
  '2025-04-23': 'Ulusal Egemenlik ve Çocuk Bayramı',
  '2025-05-01': 'Emek ve Dayanışma Günü',
  '2025-05-19': 'Atatürk\'ü Anma, Gençlik ve Spor Bayramı',
  '2025-06-05': 'Kurban Bayramı Arifesi',
  '2025-06-06': 'Kurban Bayramı 1. Gün',
  '2025-06-07': 'Kurban Bayramı 2. Gün',
  '2025-06-08': 'Kurban Bayramı 3. Gün',
  '2025-06-09': 'Kurban Bayramı 4. Gün',
  '2025-07-15': 'Demokrasi ve Milli Birlik Günü',
  '2025-08-30': 'Zafer Bayramı',
  '2025-10-28': 'Cumhuriyet Bayramı Arifesi',
  '2025-10-29': 'Cumhuriyet Bayramı',
  // 2026
  '2026-01-01': 'Yılbaşı',
  '2026-03-19': 'Ramazan Bayramı Arifesi',
  '2026-03-20': 'Ramazan Bayramı 1. Gün',
  '2026-03-21': 'Ramazan Bayramı 2. Gün',
  '2026-03-22': 'Ramazan Bayramı 3. Gün',
  '2026-04-23': 'Ulusal Egemenlik ve Çocuk Bayramı',
  '2026-05-01': 'Emek ve Dayanışma Günü',
  '2026-05-19': 'Atatürk\'ü Anma, Gençlik ve Spor Bayramı',
  '2026-05-26': 'Kurban Bayramı Arifesi',
  '2026-05-27': 'Kurban Bayramı 1. Gün',
  '2026-05-28': 'Kurban Bayramı 2. Gün',
  '2026-05-29': 'Kurban Bayramı 3. Gün',
  '2026-05-30': 'Kurban Bayramı 4. Gün',
  '2026-07-15': 'Demokrasi ve Milli Birlik Günü',
  '2026-08-30': 'Zafer Bayramı',
  '2026-10-28': 'Cumhuriyet Bayramı Arifesi',
  '2026-10-29': 'Cumhuriyet Bayramı',
};