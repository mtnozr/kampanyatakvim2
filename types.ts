export type UrgencyLevel = 'Very High' | 'High' | 'Medium' | 'Low';
export type DifficultyLevel = 'BASİT' | 'BASİT ÜSTÜ' | 'ORTA' | 'ZOR' | 'ÇOK ZOR';

export interface User {
  id: string;
  name: string;
  email: string;
  emoji?: string;     // New property for selected emoji
  role?: string;      // Optional role for reporting
}

export interface Department {
  id: string;
  name: string;
}

export type CampaignStatus = 'Planlandı' | 'Tamamlandı' | 'İptal Edildi';

export interface EventHistoryItem {
  date: Date;
  action: string;
  oldStatus?: CampaignStatus;
  newStatus?: CampaignStatus;
  changedBy?: string;
}

export interface CalendarEvent {
  id: string;
  date: Date;
  title: string;
  description?: string;
  urgency: UrgencyLevel; // Changed from platform
  difficulty?: DifficultyLevel; // New property for campaign difficulty
  assigneeId?: string; // ID of the assigned User
  departmentId?: string; // ID of the requesting Department
  status?: CampaignStatus;
  createdAt?: Date;
  updatedAt?: Date;
  history?: EventHistoryItem[];
}

export interface UrgencyConfig {
  label: string;
  colorBg: string;
  colorBorder: string;
  colorText: string;
}

export interface DifficultyConfig {
  label: string;
  color: string;
  textColor: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  date: Date;
  isRead: boolean;
  type: 'email' | 'system';
}

export interface ActivityLog {
  id: string;
  message: string;
  timestamp: Date;
}

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'info';
}

export interface DepartmentUser {
  id: string;
  username: string;
  // password: string; // DEPRECATED: Moved to Firebase Auth
  uid?: string; // Firebase Auth UID
  departmentId: string;
  isDesigner?: boolean;
  isKampanyaYapan?: boolean;
  isBusinessUnit?: boolean; // New role for requesting work
  email?: string; // Contact email for notifications
  createdAt: Date;
  lastSeen?: Date; // For tracking online status
}

export interface WorkRequest {
  id: string;
  title: string;
  description?: string;
  urgency: UrgencyLevel;
  targetDate: Date;
  departmentId: string; // The department making the request
  requesterEmail?: string; // Email of the requester for notifications
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  rejectedReason?: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  createdBy: string;
  visibleTo: 'admin' | 'kampanya' | 'all';
  readBy: string[];
}

export interface MonthlyChampion {
  userId: string;
  month: string; // Format: YYYY-MM
  campaignCount: number;
  calculatedAt: Date;
}