/**
 * Design Tokens
 * Merkezi tasarım değerleri sistemi
 * Tüm renkler, spacing, typography vb. bu dosyada tanımlanır
 */

// ==================== COLORS ====================
export const colors = {
  // Primary Brand Colors
  primary: {
    50: '#FAF5FF',   // violet-50
    100: '#F3E8FF',  // violet-100
    200: '#E9D5FF',  // violet-200
    300: '#D8B4FE',  // violet-300
    400: '#C084FC',  // violet-400
    500: '#A855F7',  // violet-500
    600: '#9333EA',  // violet-600
    700: '#7C3AED',  // violet-700 - Main brand color
    800: '#6D28D9',  // violet-800
    900: '#5B21B6',  // violet-900
  },

  // Secondary Brand Colors (Indigo for gradients)
  secondary: {
    700: '#4338CA',  // indigo-700
  },

  // Urgency Level Colors
  urgency: {
    veryHigh: {
      bg: '#FEE2E2',      // red-100
      border: '#EF4444',  // red-500
      text: '#7F1D1D',    // red-900
    },
    high: {
      bg: '#FFEDD5',      // orange-100
      border: '#F97316',  // orange-500
      text: '#7C2D12',    // orange-900
    },
    medium: {
      bg: '#DBEAFE',      // blue-100
      border: '#3B82F6',  // blue-500
      text: '#1E3A8A',    // blue-900
    },
    low: {
      bg: '#F3F4F6',      // gray-100
      border: '#6B7280',  // gray-500
      text: '#111827',    // gray-900
    },
  },

  // Status Colors
  status: {
    planned: {
      bg: '#FEF3C7',      // yellow-100
      border: '#EAB308',  // yellow-500
      text: '#713F12',    // yellow-900
    },
    completed: {
      bg: '#D1FAE5',      // green-100
      border: '#10B981',  // green-500
      text: '#064E3B',    // green-900
    },
    cancelled: {
      bg: '#FEE2E2',      // red-50
      border: '#EF4444',  // red-500
      text: '#7F1D1D',    // red-900
    },
  },

  // Report Status Colors
  reportStatus: {
    pending: {
      bg: '#FEF3C7',      // amber-100
      border: '#F59E0B',  // amber-500
      text: '#78350F',    // amber-900
    },
    done: {
      bg: '#D1FAE5',      // emerald-100
      border: '#10B981',  // emerald-500
      text: '#064E3B',    // emerald-900
    },
    overdue: {
      bg: '#FEE2E2',      // red-100
      border: '#EF4444',  // red-500
      text: '#7F1D1D',    // red-900
    },
  },

  // Difficulty Colors
  difficulty: {
    simple: {
      bg: '#D1FAE5',      // green-100
      border: '#D1FAE5',  // green-200
      text: '#15803D',    // green-700
    },
    aboveSimple: {
      bg: '#D1FAE5',      // emerald-100
      border: '#A7F3D0',  // emerald-200
      text: '#047857',    // emerald-700
    },
    medium: {
      bg: '#FEF3C7',      // yellow-100
      border: '#FDE68A',  // yellow-200
      text: '#A16207',    // yellow-700
    },
    hard: {
      bg: '#FFEDD5',      // orange-100
      border: '#FED7AA',  // orange-200
      text: '#C2410C',    // orange-700
    },
    veryHard: {
      bg: '#FEE2E2',      // red-100
      border: '#FECACA',  // red-200
      text: '#B91C1C',    // red-700
    },
  },

  // Neutral Colors (Gray scale)
  gray: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
  },

  // Dark Mode Colors (Slate)
  dark: {
    50: '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A',
  },

  // Background Colors
  background: {
    light: '#F8F9FE',
    dark: '#0F172A',    // slate-900
  },

  // Semantic Colors
  success: '#10B981',   // green-500
  warning: '#F59E0B',   // amber-500
  error: '#EF4444',     // red-500
  info: '#3B82F6',      // blue-500
} as const;

// ==================== SPACING ====================
/**
 * Spacing Scale (8px base unit)
 * Kullanım: padding, margin, gap
 */
export const spacing = {
  0: '0',
  xs: '0.5rem',   // 8px
  sm: '0.75rem',  // 12px
  md: '1rem',     // 16px
  lg: '1.5rem',   // 24px
  xl: '2rem',     // 32px
  '2xl': '3rem',  // 48px
  '3xl': '4rem',  // 64px
} as const;

// ==================== BORDER RADIUS ====================
/**
 * Border Radius Scale
 * 3 ana boyut: küçük, orta, büyük
 */
export const radius = {
  none: '0',
  sm: '0.375rem',  // 6px - Küçük elementler (badges, small buttons)
  md: '0.5rem',    // 8px - Standart elementler (buttons, inputs, cards)
  lg: '0.75rem',   // 12px - Büyük elementler (modals, large cards)
  xl: '1rem',      // 16px - Çok büyük elementler
  full: '9999px',  // Tamamen yuvarlak (avatar, pills)
} as const;

// ==================== SHADOWS ====================
/**
 * Shadow Scale
 * Derinlik hiyerarşisi için
 */
export const shadows = {
  none: 'none',
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',                                      // Hafif gölge - cards
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)', // Orta gölge
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)', // Büyük gölge - modals
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', // Çok büyük gölge - dropdowns
  '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',                             // Maksimum gölge
} as const;

// ==================== TYPOGRAPHY ====================
/**
 * Typography Scale
 * Font boyutları ve ağırlıkları
 */
export const typography = {
  // Font Sizes
  fontSize: {
    xs: ['0.75rem', { lineHeight: '1rem' }],      // 12px
    sm: ['0.875rem', { lineHeight: '1.25rem' }],  // 14px
    base: ['1rem', { lineHeight: '1.5rem' }],     // 16px
    lg: ['1.125rem', { lineHeight: '1.75rem' }],  // 18px
    xl: ['1.25rem', { lineHeight: '1.75rem' }],   // 20px
    '2xl': ['1.5rem', { lineHeight: '2rem' }],    // 24px
    '3xl': ['1.875rem', { lineHeight: '2.25rem' }], // 30px
  },

  // Font Weights
  fontWeight: {
    light: '300',
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },

  // Font Family
  fontFamily: {
    sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
  },
} as const;

// ==================== Z-INDEX ====================
/**
 * Z-Index Scale
 * Katman hiyerarşisi
 */
export const zIndex = {
  base: 0,
  dropdown: 10,
  sticky: 20,
  fixed: 30,
  modalBackdrop: 40,
  modal: 50,
  popover: 60,
  tooltip: 70,
} as const;

// ==================== TRANSITIONS ====================
/**
 * Transition/Animation değerleri
 */
export const transitions = {
  duration: {
    fast: '150ms',
    normal: '200ms',
    slow: '300ms',
  },
  timing: {
    ease: 'ease',
    easeIn: 'ease-in',
    easeOut: 'ease-out',
    easeInOut: 'ease-in-out',
  },
} as const;

// ==================== BREAKPOINTS ====================
/**
 * Responsive Breakpoints
 */
export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

// ==================== OPACITY ====================
/**
 * Opacity Scale
 */
export const opacity = {
  0: '0',
  5: '0.05',
  10: '0.1',
  20: '0.2',
  30: '0.3',
  40: '0.4',
  50: '0.5',
  60: '0.6',
  70: '0.7',
  80: '0.8',
  90: '0.9',
  100: '1',
} as const;

// ==================== EXPORTED DESIGN TOKENS ====================
export const tokens = {
  colors,
  spacing,
  radius,
  shadows,
  typography,
  zIndex,
  transitions,
  breakpoints,
  opacity,
} as const;

export default tokens;
