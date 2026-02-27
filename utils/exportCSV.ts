import { format } from 'date-fns';
import { CalendarEvent, User, Department } from '../types';

// Helper to safely convert date (handles both Date and Firestore Timestamp)
const toDate = (val: any): Date | null => {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (val.toDate && typeof val.toDate === 'function') return val.toDate();
  if (typeof val === 'string' || typeof val === 'number') return new Date(val);
  return null;
};

const stripHtml = (html: string): string => {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
};

const escapeField = (str: string): string => {
  if (!str) return '';
  if (str.includes(';') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

export function exportEventsToCSV(
  events: CalendarEvent[],
  users: User[],
  departments: Department[]
): void {
  console.log('Export started, events count:', events.length);

  const headers = [
    "Başlık",
    "Tarih",
    "Orijinal Tarih",
    "Aciliyet",
    "Zorluk",
    "Açıklama",
    "Birim",
    "Atanan Kişi",
    "Durum",
    "Not",
    "Rapor Gerekli",
    "Oluşturulma Tarihi",
    "Güncellenme Tarihi"
  ].join(";");

  let csvContent = headers + "\n";

  events.forEach(ev => {
    const dept = departments.find(d => d.id === ev.departmentId)?.name || '';
    const user = users.find(u => u.id === ev.assigneeId)?.name || '';

    const evDate = toDate(ev.date);
    const evOriginalDate = toDate(ev.originalDate);
    const evCreatedAt = toDate(ev.createdAt);
    const evUpdatedAt = toDate(ev.updatedAt);

    const dateStr = evDate ? format(evDate, 'yyyy-MM-dd') : '';
    const originalDateStr = evOriginalDate ? format(evOriginalDate, 'yyyy-MM-dd') : '';
    const createdAtStr = evCreatedAt ? format(evCreatedAt, 'yyyy-MM-dd HH:mm') : '';
    const updatedAtStr = evUpdatedAt ? format(evUpdatedAt, 'yyyy-MM-dd HH:mm') : '';

    const row = [
      escapeField(ev.title),
      dateStr,
      originalDateStr,
      ev.urgency || '',
      ev.difficulty || '',
      escapeField(stripHtml(ev.description || '')),
      escapeField(dept),
      escapeField(user),
      ev.status || 'Planlandı',
      escapeField(ev.note || ''),
      ev.requiresReport ? 'Evet' : 'Hayır',
      createdAtStr,
      updatedAtStr
    ].join(";");

    csvContent += row + "\n";
  });

  console.log('CSV content generated, length:', csvContent.length);

  const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `kampanya_takvimi_export_${format(new Date(), 'yyyy-MM-dd')}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  console.log('Download triggered');
}
