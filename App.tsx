import React, { useState, useMemo, useEffect } from 'react';
import {
  format,
  addMonths,
  addWeeks,
  addDays,
  endOfMonth,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  isTomorrow,
  isWeekend,
  startOfMonth,
  startOfWeek,
  startOfDay
} from 'date-fns';
import { tr } from 'date-fns/locale';
import { Bell, Smartphone, SmartphoneNfc, ChevronLeft, ChevronRight, Plus, Users, ClipboardList, Loader2, Search, Filter, X, LogIn, LogOut, Database, Download, Lock, Megaphone, PieChart, CheckSquare, StickyNote, Trash2, Flag } from 'lucide-react';
import jsPDF from 'jspdf';
import { CalendarEvent, UrgencyLevel, User, AppNotification, ToastMessage, ActivityLog, Department, DepartmentUser, Announcement, DifficultyLevel, WorkRequest, Report, AnalyticsUser, AnalyticsTask, CampaignStatus, ReminderSettings, SendType, CampaignType } from './types';
import { INITIAL_EVENTS, DAYS_OF_WEEK, INITIAL_USERS, URGENCY_CONFIGS, TURKISH_HOLIDAYS, INITIAL_DEPARTMENTS, DIFFICULTY_CONFIGS } from './constants';
import { sendSMSWithTwilio, buildSMSFromTemplate, formatPhoneNumber } from './utils/smsService';
import { EventBadge } from './components/EventBadge';
import { AddEventModal } from './components/AddEventModal';
import { RequestWorkModal } from './components/RequestWorkModal';
import { IncomingRequestsModal } from './components/IncomingRequestsModal';
import { AdminModal } from './components/AdminModal';
import { NotificationPopover } from './components/NotificationPopover';
import { LogPopover } from './components/LogPopover';
import { ToastContainer } from './components/Toast';
import { EventDetailsModal } from './components/EventDetailsModal';
import { DepartmentLoginModal } from './components/DepartmentLoginModal';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { AdminChangePasswordModal } from './components/AdminChangePasswordModal';
import { AnnouncementBoard } from './components/AnnouncementBoard';
import { AnnouncementPopup } from './components/AnnouncementPopup';
import { ReportsDashboard } from './components/ReportsDashboard';
import { DesignerCampaignsModal } from './components/DesignerCampaignsModal';
import { MyTasksModal } from './components/MyTasksModal';
import { ReportCalendarTab } from './components/ReportCalendarTab';
import { AddReportModal } from './components/AddReportModal';
import { ReportDetailsModal } from './components/ReportDetailsModal';
import { AnalyticsCalendarTab } from './components/AnalyticsCalendarTab';
import { AddAnalyticsTaskModal } from './components/AddAnalyticsTaskModal';
import { AnalyticsTaskDetailsModal } from './components/AnalyticsTaskDetailsModal';
import { Sidebar } from './components/Sidebar';
import { ThemeToggle } from './components/ThemeToggle';
import { BackgroundTheme, ThemeType } from './components/BackgroundTheme';
import { BirthdayAnimation } from './components/BirthdayAnimation';
import { BirthdayReminder } from './components/BirthdayReminder';
import ReminderSettingsPanel from './components/ReminderSettingsPanel';
import { useTheme } from './hooks/useTheme';
import { useBrowserNotifications } from './hooks/useBrowserNotifications';
import { useDeviceMode } from './hooks/useDeviceMode';
import { MobileShell } from './components/mobile/MobileShell';
import { MobileTabKey } from './components/mobile/MobileBottomNav';
import { setCookie, getCookie, deleteCookie } from './utils/cookies';
import { calculateMonthlyChampion } from './utils/gamification';
import { calculateReportDueDate } from './utils/businessDays';

// --- FIREBASE IMPORTS ---
import { db, firebaseConfig } from './firebase';
import {
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  Timestamp,
  setDoc,
  writeBatch,
  arrayUnion,
  where,
  getDocs,
  getDoc
} from 'firebase/firestore';
import { auth } from './firebase';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';


// Normalize urgency values coming from Firestore to avoid crashes on bad data
const normalizeUrgency = (urgency: any): UrgencyLevel => {
  const validUrgencies: UrgencyLevel[] = ['Very High', 'High', 'Medium', 'Low'];
  return validUrgencies.includes(urgency) ? urgency : 'Low';
};

// Convert HTML to plain text for email bodies
const stripHtml = (html: string): string => {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
};

function App() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const { isPhoneOnly } = useDeviceMode();
  const [viewMode, setViewMode] = useState<'month' | 'week'>(() => {
    const saved = localStorage.getItem('calendarViewMode');
    if (saved) return saved === 'week' ? 'week' : 'month';

    const isPhoneUA = /Android|iPhone|iPod|Windows Phone|IEMobile|Opera Mini|BlackBerry|webOS/i.test(navigator.userAgent);
    return isPhoneUA ? 'week' : 'month';
  });
  const { theme, toggleTheme, setTheme } = useTheme();
  const {
    permission: notificationPermission,
    isSupported: notificationsSupported,
    isGranted: notificationsGranted,
    requestPermission: requestNotificationPermission,
    notifyNewCampaign,
    notifyTaskAssignment,
    notifyNewAnnouncement,
    notifyCampaignReminder,
  } = useBrowserNotifications();

  // Persist viewMode to localStorage
  useEffect(() => {
    localStorage.setItem('calendarViewMode', viewMode);
  }, [viewMode]);
  const [autoThemeConfig, setAutoThemeConfig] = useState<{ enabled: boolean; time: string }>({ enabled: false, time: '20:00' });
  const [backgroundTheme, setBackgroundTheme] = useState<ThemeType>('none');
  const [customThemeImage, setCustomThemeImage] = useState<string>('');

  // --- STATE MANAGEMENT (Pure Firestore) ---
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  // Loading States
  const [isEventsLoading, setIsEventsLoading] = useState(true);
  const [isUsersLoading, setIsUsersLoading] = useState(true);

  // Department Users for login system (stored in Firestore)
  const [departmentUsers, setDepartmentUsers] = useState<DepartmentUser[]>([]);
  const [loggedInDeptUser, setLoggedInDeptUser] = useState<DepartmentUser | null>(null);
  const [isDeptLoginOpen, setIsDeptLoginOpen] = useState(false);

  // Logs and Notifications
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [requests, setRequests] = useState<WorkRequest[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [monthlyBadges, setMonthlyBadges] = useState<{ trophy: string[], rocket: string[], power: string[] }>({ trophy: [], rocket: [], power: [] });
  const [requestSubmissionEnabled, setRequestSubmissionEnabled] = useState(true);
  const [isAddReportModalOpen, setIsAddReportModalOpen] = useState(false);
  const [selectedReportDate, setSelectedReportDate] = useState<Date | undefined>(undefined);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  // Local UI State
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [isAnnBoardOpen, setIsAnnBoardOpen] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  // Search & Filter State
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAssignee, setFilterAssignee] = useState<string>('');
  const [filterUrgency, setFilterUrgency] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterDepartment, setFilterDepartment] = useState<string>('');

  // Calendar Tab State (KAMPANYA, RAPOR, ANALİTİK, or AYARLAR)
  const [activeTab, setActiveTab] = useState<'kampanya' | 'rapor' | 'analitik' | 'ayarlar'>('kampanya');
  const [mobileTab, setMobileTab] = useState<MobileTabKey>('kampanya');

  // Analytics State
  const [analyticsUsers, setAnalyticsUsers] = useState<AnalyticsUser[]>([]);
  const [analyticsTasks, setAnalyticsTasks] = useState<AnalyticsTask[]>([]);
  const [isAnalitik, setIsAnalitik] = useState(false);
  const [selectedAnalyticsTask, setSelectedAnalyticsTask] = useState<AnalyticsTask | null>(null);
  const [isAddAnalyticsModalOpen, setIsAddAnalyticsModalOpen] = useState(false);
  const [selectedAnalyticsDate, setSelectedAnalyticsDate] = useState<Date | undefined>(undefined);

  // Modals State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isIncomingRequestsModalOpen, setIsIncomingRequestsModalOpen] = useState(false);
  const [isDesignerCampaignsModalOpen, setIsDesignerCampaignsModalOpen] = useState(false);
  const [requestModalDate, setRequestModalDate] = useState<Date | undefined>(undefined);
  const [convertingRequest, setConvertingRequest] = useState<WorkRequest | null>(null);

  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isMyTasksOpen, setIsMyTasksOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isAdminPasswordOpen, setIsAdminPasswordOpen] = useState(false);
  const [isReportsOpen, setIsReportsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  // Refactor: Store ID instead of object to ensure reactivity
  const [viewEventId, setViewEventId] = useState<string | null>(null);
  const [draggedEvent, setDraggedEvent] = useState<CalendarEvent | null>(null);

  // Refresh Key for manual data reload
  const [refreshKey, setRefreshKey] = useState(0);

  // Notes State
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [selectedEventIdForNote, setSelectedEventIdForNote] = useState<string | null>(null);
  const [noteContent, setNoteContent] = useState('');

  // Birthday State - reactive date tracking for automatic midnight updates
  const [todayDateStr, setTodayDateStr] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [showBirthdayAnimation, setShowBirthdayAnimation] = useState(false);
  const [birthdayAnimationShown, setBirthdayAnimationShown] = useState(() => {
    const stored = localStorage.getItem('birthdayAnimationShown');
    return stored === format(new Date(), 'yyyy-MM-dd');
  });
  const [birthdayReminderDismissed, setBirthdayReminderDismissed] = useState(() => {
    const stored = localStorage.getItem('birthdayReminderDismissed');
    return stored === format(new Date(), 'yyyy-MM-dd');
  });

  // Derived values from todayDateStr
  const todayKey = todayDateStr;
  const todayMMDD = todayDateStr.slice(5); // Extract MM-dd from yyyy-MM-dd

  // Check for date change every minute (handles midnight transition automatically)
  useEffect(() => {
    const checkDateChange = () => {
      const newDate = format(new Date(), 'yyyy-MM-dd');
      if (newDate !== todayDateStr) {
        setTodayDateStr(newDate);
        // Reset birthday states for new day
        const storedAnimation = localStorage.getItem('birthdayAnimationShown');
        const storedReminder = localStorage.getItem('birthdayReminderDismissed');
        setBirthdayAnimationShown(storedAnimation === newDate);
        setBirthdayReminderDismissed(storedReminder === newDate);
      }
    };

    // Check every minute
    const interval = setInterval(checkDateChange, 60000);
    return () => clearInterval(interval);
  }, [todayDateStr]);

  // Derived state for viewEvent
  const viewEvent = useMemo(() => {
    return events.find(e => e.id === viewEventId) || null;
  }, [events, viewEventId]);

  // Link Department User to Personnel User via Email
  const connectedPersonnelUser = useMemo(() => {
    if (!loggedInDeptUser || !loggedInDeptUser.email) return null;
    return users.find(u => u.email?.trim().toLowerCase() === loggedInDeptUser.email?.trim().toLowerCase());
  }, [loggedInDeptUser, users]);

  // Check if logged in user has birthday today
  const isMyBirthday = useMemo(() => {
    if (!loggedInDeptUser?.birthday) return false;
    return loggedInDeptUser.birthday === todayMMDD;
  }, [loggedInDeptUser, todayMMDD]);

  // Get all people with birthdays today (excluding current user)
  const birthdayPeopleToday = useMemo(() => {
    const people: Array<{ name: string; emoji?: string }> = [];

    // Check department users
    departmentUsers.forEach(deptUser => {
      if (deptUser.birthday === todayMMDD && deptUser.id !== loggedInDeptUser?.id) {
        // Find connected personnel user by email to get full name
        const personnelUser = deptUser.email
          ? users.find(u => u.email?.trim().toLowerCase() === deptUser.email?.trim().toLowerCase())
          : null;
        const displayName = personnelUser?.name || deptUser.username;
        const emoji = personnelUser?.emoji;
        people.push({ name: displayName, emoji });
      }
    });

    // Check analytics users
    analyticsUsers.forEach(user => {
      if (user.birthday === todayMMDD) {
        people.push({ name: user.name, emoji: user.emoji });
      }
    });

    return people;
  }, [departmentUsers, analyticsUsers, users, todayMMDD, loggedInDeptUser]);

  // Show birthday animation if it's user's birthday (shown once per day)
  useEffect(() => {
    if (isMyBirthday && loggedInDeptUser && !birthdayAnimationShown) {
      // Small delay to let the UI settle
      const timer = setTimeout(() => {
        setShowBirthdayAnimation(true);
        setBirthdayAnimationShown(true);
        localStorage.setItem('birthdayAnimationShown', todayKey);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isMyBirthday, loggedInDeptUser, birthdayAnimationShown, todayKey]);

  // Save reminder dismissed state to localStorage
  useEffect(() => {
    if (birthdayReminderDismissed) {
      localStorage.setItem('birthdayReminderDismissed', todayKey);
    }
  }, [birthdayReminderDismissed, todayKey]);

  // --- FIREBASE LISTENERS (REAL-TIME SYNC) ---

  // 0. Auth State Listener (Global)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // User is logged in
        // Check if they are a Department User
        const q = query(collection(db, "departmentUsers"), where("uid", "==", user.uid));
        try {
          const querySnapshot = await getDocs(q);

          if (!querySnapshot.empty) {
            // It IS a Department User
            const deptUserDoc = querySnapshot.docs[0];
            const deptUserData = { ...deptUserDoc.data(), id: deptUserDoc.id } as DepartmentUser;

            setLoggedInDeptUser(deptUserData);
            setIsDesigner(!!deptUserData.isDesigner);
            setIsKampanyaYapan(!!deptUserData.isKampanyaYapan);
            setIsAnalitik(!!deptUserData.isAnalitik);

            // Only show welcome toast if not recently shown (optional, but simple toast is fine)
            // addToast(`Hoşgeldiniz, ${deptUserData.username}`, 'success');
          } else {
            // It is NOT a Department User (It's a Super Admin)
            setLoggedInDeptUser(null);
            setIsDesigner(true); // Super admins are designers by default
            setIsKampanyaYapan(false);
            setIsAnalitik(false);
          }
        } catch (err) {
          console.error("Auth check failed:", err);
        }
      } else {
        // User is logged out
        setLoggedInDeptUser(null);
        setIsDesigner(false);
        setIsKampanyaYapan(false);
        setIsAnalitik(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // 1. Sync Events
  useEffect(() => {
    if (refreshKey === 0) setIsEventsLoading(true);
    const q = query(collection(db, "events"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedEvents: CalendarEvent[] = snapshot.docs.map(doc => {
        const data = doc.data();
        const urgency = normalizeUrgency(data.urgency);

        // Map history to convert Timestamps to Dates
        const history = data.history?.map((h: any) => ({
          ...h,
          date: h.date instanceof Timestamp ? h.date.toDate() : new Date(h.date)
        })) || [];

        return {
          ...data, // Spread other fields like createdAt, updatedAt
          id: doc.id,
          title: data.title,
          sendType: data.sendType === 'Bilgilendirme' ? 'Bilgilendirme' : 'Kampanya',
          campaignType: data.campaignType === 'Kampanya Hatırlatması' ? 'Kampanya Hatırlatması' : 'Yeni Kampanya',
          urgency,
          assigneeId: data.assigneeId,
          description: data.description,
          departmentId: data.departmentId,
          status: data.status,
          date: data.date instanceof Timestamp ? data.date.toDate() : new Date(data.date),
          originalDate: data.originalDate instanceof Timestamp ? data.originalDate.toDate() : (data.originalDate ? new Date(data.originalDate) : undefined),
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : undefined),
          updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : (data.updatedAt ? new Date(data.updatedAt) : undefined),
          note: data.note,
          noteAuthorName: data.noteAuthorName,
          noteAddedAt: data.noteAddedAt instanceof Timestamp ? data.noteAddedAt.toDate() : (data.noteAddedAt ? new Date(data.noteAddedAt) : undefined),
          history
        } as CalendarEvent;
      });
      setEvents(fetchedEvents);
      setIsEventsLoading(false);
    }, (error) => {
      console.error("Firebase events subscription error:", error);
      setIsEventsLoading(false); // Stop loading even on error
    });
    return () => unsubscribe();
  }, [refreshKey]);

  // 2. Sync Users
  useEffect(() => {
    if (refreshKey === 0) setIsUsersLoading(true);
    const unsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
      const fetchedUsers: User[] = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
      setUsers(fetchedUsers);
      setIsUsersLoading(false);
    }, (error) => {
      console.error("Firebase users subscription error:", error);
      setIsUsersLoading(false); // Stop loading even on error
    });
    return () => unsubscribe();
  }, [refreshKey]);

  // 3. Sync Departments
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "departments"), (snapshot) => {
      const fetchedDepts: Department[] = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Department));
      setDepartments(fetchedDepts);
    });
    return () => unsubscribe();
  }, [refreshKey]);

  // 4. Sync Department Users (for login system)
  useEffect(() => {
    const q = query(collection(db, "departmentUsers"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedUsers: DepartmentUser[] = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        createdAt: doc.data().createdAt instanceof Timestamp ? doc.data().createdAt.toDate() : new Date(),
        lastSeen: doc.data().lastSeen instanceof Timestamp ? doc.data().lastSeen.toDate() : undefined
      } as DepartmentUser));
      setDepartmentUsers(fetchedUsers);
    });
    return () => unsubscribe();
  }, [refreshKey]);

  // 5. Sync Notifications
  useEffect(() => {
    const q = query(collection(db, "notifications"), orderBy("date", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedNotifs: AppNotification[] = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        date: doc.data().date instanceof Timestamp ? doc.data().date.toDate() : new Date()
      } as AppNotification));
      setNotifications(fetchedNotifs);
    });
    return () => unsubscribe();
  }, [refreshKey]);

  // 6. Sync Logs
  useEffect(() => {
    const q = query(collection(db, "logs"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedLogs: ActivityLog[] = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        timestamp: doc.data().timestamp instanceof Timestamp ? doc.data().timestamp.toDate() : new Date()
      } as ActivityLog));
      setLogs(fetchedLogs);
    });
    return () => unsubscribe();
  }, [refreshKey]);

  // 7. Sync Announcements
  useEffect(() => {
    const q = query(collection(db, "announcements"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedAnns: Announcement[] = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        readBy: doc.data().readBy || [], // Ensure readBy exists
        createdAt: doc.data().createdAt instanceof Timestamp ? doc.data().createdAt.toDate() : new Date()
      } as Announcement));
      setAnnouncements(fetchedAnns);
    });
    return () => unsubscribe();
  }, [refreshKey]);

  // 8. Sync Work Requests
  useEffect(() => {
    const q = query(collection(db, "work_requests"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedRequests: WorkRequest[] = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        createdAt: doc.data().createdAt instanceof Timestamp ? doc.data().createdAt.toDate() : new Date(),
        targetDate: doc.data().targetDate instanceof Timestamp ? doc.data().targetDate.toDate() : new Date()
      } as WorkRequest));
      setRequests(fetchedRequests);
    });
    return () => unsubscribe();
  }, [refreshKey]);

  // 9. Sync Reports
  useEffect(() => {
    const q = query(collection(db, "reports"), orderBy("dueDate", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedReports: Report[] = snapshot.docs.map(docSnap => ({
        ...docSnap.data(),
        id: docSnap.id,
        dueDate: docSnap.data().dueDate instanceof Timestamp ? docSnap.data().dueDate.toDate() : new Date(docSnap.data().dueDate),
        createdAt: docSnap.data().createdAt instanceof Timestamp ? docSnap.data().createdAt.toDate() : new Date(),
        updatedAt: docSnap.data().updatedAt instanceof Timestamp ? docSnap.data().updatedAt.toDate() : undefined,
        completedAt: docSnap.data().completedAt instanceof Timestamp ? docSnap.data().completedAt.toDate() : undefined
      } as Report));
      setReports(fetchedReports);
    });
    return () => unsubscribe();
  }, [refreshKey]);

  // 10. Sync Analytics Users
  useEffect(() => {
    const q = query(collection(db, "analyticsUsers"), orderBy("name", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedUsers: AnalyticsUser[] = snapshot.docs.map(docSnap => ({
        ...docSnap.data(),
        id: docSnap.id
      } as AnalyticsUser));
      setAnalyticsUsers(fetchedUsers);
    });
    return () => unsubscribe();
  }, [refreshKey]);

  // 11. Sync Analytics Tasks
  useEffect(() => {
    const q = query(collection(db, "analyticsTasks"), orderBy("date", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedTasks: AnalyticsTask[] = snapshot.docs.map(docSnap => ({
        ...docSnap.data(),
        id: docSnap.id,
        date: docSnap.data().date instanceof Timestamp ? docSnap.data().date.toDate() : new Date(docSnap.data().date),
        createdAt: docSnap.data().createdAt instanceof Timestamp ? docSnap.data().createdAt.toDate() : undefined,
        updatedAt: docSnap.data().updatedAt instanceof Timestamp ? docSnap.data().updatedAt.toDate() : undefined
      } as AnalyticsTask));
      setAnalyticsTasks(fetchedTasks);
    });
    return () => unsubscribe();
  }, [refreshKey]);

  // 10. Cleanup duplicate reports (one-time check)
  // NOTE: Migration logic DISABLED - was causing deleted reports to reappear
  // Reports should only be created when:
  // 1. Campaign status changes to "Tamamlandı" (handled in handleUpdateEvent)
  // 2. Manually via the Add Report modal
  const migrationDone = React.useRef(false);

  useEffect(() => {
    const cleanupDuplicates = async () => {
      // Prevent multiple runs
      if (migrationDone.current) return;

      // Only run if we have reports loaded
      if (reports.length === 0) return;

      // Mark as done immediately to prevent race conditions
      migrationDone.current = true;

      // ONLY clean up duplicates - DO NOT auto-create reports
      // This was causing deleted reports to reappear on page refresh
      const campaignReportsMap = new Map<string, string[]>();

      reports.forEach(report => {
        if (report.campaignId) {
          const existing = campaignReportsMap.get(report.campaignId) || [];
          existing.push(report.id);
          campaignReportsMap.set(report.campaignId, existing);
        }
      });

      // Delete duplicates (keep the first one)
      for (const [campaignId, reportIds] of campaignReportsMap.entries()) {
        if (reportIds.length > 1) {
          // Keep first, delete rest
          const toDelete = reportIds.slice(1);
          for (const reportId of toDelete) {
            try {
              await deleteDoc(doc(db, "reports", reportId));
              console.log(`Deleted duplicate report: ${reportId} for campaign ${campaignId}`);
            } catch (err) {
              console.error('Failed to delete duplicate:', err);
            }
          }
        }
      }

      // MIGRATION DISABLED: The following code was causing deleted reports to reappear
      // because it would run on every page load and recreate reports for campaigns
      // that had their reports deleted by users.
      // 
      // If you need to bulk-create reports for old campaigns, run a one-time script
      // instead of having this logic run on every page load.
    };

    // Run cleanup once reports are loaded
    if (reports.length > 0) {
      cleanupDuplicates();
    }
  }, [reports]);

  // 9. Sync System Settings (Theme)
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, "system_settings", "theme_config"), (doc) => {
      if (doc.exists()) {
        const data = doc.data() as { enabled: boolean; time: string };
        setAutoThemeConfig(data);

        // Check if we should switch theme right now
        if (data.enabled && data.time) {
          const now = new Date();
          const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
          if (currentTime === data.time && theme === 'light') {
            setTheme('dark');
          }
        }
      }
    });
    return () => unsubscribe();
  }, []); // Run once on mount

  // 9b. Sync Background Theme Config
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, "system_settings", "background_theme_config"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as { theme: ThemeType; customImage?: string };
        setBackgroundTheme(data.theme || 'none');
        setCustomThemeImage(data.customImage || '');
      } else {
        setBackgroundTheme('none');
        setCustomThemeImage('');
      }
    });
    return () => unsubscribe();
  }, []);

  // 10. Gamification Check (Monthly Champion)
  useEffect(() => {
    // 1. Listen for Gamification Config (Enable/Disable)
    const unsubscribeConfig = onSnapshot(doc(db, "system_settings", "gamification_config"), (docSnap) => {
      const isEnabled = docSnap.exists() ? docSnap.data().enabled : true; // Default to true if not set

      if (isEnabled) {
        // Initial check/calculation only if enabled
        calculateMonthlyChampion();
      } else {
        setMonthlyBadges({ trophy: [], rocket: [], power: [] });
      }
    });

    // 2. Listen for Monthly Champion updates
    const unsubscribeChampion = onSnapshot(doc(db, "system_settings", "monthly_champion"), async (docSnap) => {
      const configSnap = await import('firebase/firestore').then(mod => mod.getDoc(doc(db, "system_settings", "gamification_config")));
      const isEnabled = configSnap.exists() ? configSnap.data()?.enabled : true;

      if (!isEnabled) {
        setMonthlyBadges({ trophy: [], rocket: [], power: [] });
        return;
      }

      if (docSnap.exists()) {
        const data = docSnap.data();
        const badges = {
          trophy: data?.userIds || (data?.userId ? [data.userId] : []),
          rocket: data?.fastestUserIds || [],
          power: data?.hardestUserIds || []
        };
        console.log('🏆 App: Badges updated:', badges);
        setMonthlyBadges(badges);
      } else {
        setMonthlyBadges({ trophy: [], rocket: [], power: [] });
      }
    });

    return () => {
      unsubscribeConfig();
      unsubscribeChampion();
    };
  }, []);

  // 11. Request Submission Config Listener
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, "system_settings", "request_submission_config"), (docSnap) => {
      if (docSnap.exists()) {
        setRequestSubmissionEnabled(docSnap.data().enabled);
      } else {
        setRequestSubmissionEnabled(true); // Default to true
      }
    });
    return () => unsubscribe();
  }, []);

  // 12. User Presence Heartbeat
  useEffect(() => {
    if (!loggedInDeptUser) return;

    const updatePresence = async () => {
      try {
        await updateDoc(doc(db, "departmentUsers", loggedInDeptUser.id), {
          lastSeen: Timestamp.now()
        });
      } catch (e) {
        console.error("Presence update failed", e);
      }
    };

    // Initial update
    updatePresence();

    // Update every 60 seconds
    const interval = setInterval(updatePresence, 60000);

    return () => clearInterval(interval);
  }, [loggedInDeptUser?.id]); // Only re-run if user ID changes

  // Check time every minute for auto theme switch
  useEffect(() => {
    if (!autoThemeConfig.enabled) return;

    const checkTime = () => {
      const now = new Date();
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();
      const currentTimeInMinutes = currentHours * 60 + currentMinutes;

      // Parse configured time
      const [configHours, configMinutes] = autoThemeConfig.time.split(':').map(Number);
      const configTimeInMinutes = configHours * 60 + configMinutes;

      // Default end time is 09:00
      const endTimeInMinutes = 9 * 60; // 09:00

      // Case 1: Start time is before midnight (e.g. 16:00) and end time is next day (09:00)
      // Range: [Start, 24:00) OR [00:00, End)
      const isNightShift = configTimeInMinutes > endTimeInMinutes;

      let shouldBeDark = false;

      if (isNightShift) {
        // Example: 16:00 to 09:00
        // Current time must be >= 16:00 OR < 09:00
        shouldBeDark = currentTimeInMinutes >= configTimeInMinutes || currentTimeInMinutes < endTimeInMinutes;
      } else {
        // Case 2: Start time is early morning (unlikely for dark mode but possible)
        // Example: 01:00 to 09:00
        shouldBeDark = currentTimeInMinutes >= configTimeInMinutes && currentTimeInMinutes < endTimeInMinutes;
      }

      // Check for manual override
      const manualOverrideTimeStr = localStorage.getItem('theme_manual_override_time');
      const manualOverrideTime = manualOverrideTimeStr ? parseInt(manualOverrideTimeStr) : 0;

      if (shouldBeDark) {
        // Calculate the start time of the current dark session
        let lastStartPoint = new Date(now);
        lastStartPoint.setHours(configHours, configMinutes, 0, 0);

        // If currently it's early morning (e.g. 01:00) and start time was 20:00, 
        // then the start point was yesterday.
        if (isNightShift && currentTimeInMinutes < endTimeInMinutes) {
          lastStartPoint.setDate(lastStartPoint.getDate() - 1);
        }

        // If user manually changed it AFTER the start point, respect it.
        if (manualOverrideTime > lastStartPoint.getTime()) {
          return;
        }

        if (theme === 'light') {
          setTheme('dark');
          // Only show toast if it's exactly the switch time to avoid spamming on reload
          if (currentTimeInMinutes === configTimeInMinutes) {
            addToast('Otomatik karanlık mod aktif edildi.', 'info');
          }
        }
      } else if (!shouldBeDark && theme === 'dark') {
        // Should be light.
        // Check if user manually set it to Dark recently.

        // Calculate the start time of the current "light session" (which starts at 09:00)
        let lastLightStart = new Date(now);
        lastLightStart.setHours(9, 0, 0, 0);

        // If we are before 09:00, but !shouldBeDark (meaning config time is later),
        // actually this block executes when we are NOT in the dark window.

        // If we are before 09:00, we normally WOULD be in dark window (if night shift).
        // So usually this runs after 09:00.

        // If manual override happened after 09:00 today, respect it.
        // If manual override happened yesterday, ignore it (new day, new light).

        if (manualOverrideTime > lastLightStart.getTime()) {
          return;
        }

        setTheme('light');
      }
    };

    // Run immediately
    checkTime();

    // Run every minute
    const interval = setInterval(checkTime, 60000);

    return () => clearInterval(interval);
  }, [autoThemeConfig, theme]);

  // --- Derived Permissions based on Login ---
  // Designer = logged in via Firebase Auth in AdminModal
  // Department User = logged in via DepartmentLoginModal
  // Guest = not logged in

  const currentDepartmentId = loggedInDeptUser?.departmentId || undefined;
  const currentDepartmentName = useMemo(() => {
    if (currentDepartmentId) {
      return departments.find(d => d.id === currentDepartmentId)?.name;
    }
    return null;
  }, [currentDepartmentId, departments]);

  // For now, isDesigner is determined by whether user clicks admin button and logs in with Firebase Auth
  // The main calendar is public by default, but edit functions are protected
  const [isDesigner, setIsDesigner] = useState(false);
  const [isKampanyaYapan, setIsKampanyaYapan] = useState(false);

  // --- Cookie-based Auto Login ---
  // Restore designer and kampanya yapan state from cookie (runs once on mount)
  useEffect(() => {
    const savedDesignerAuth = getCookie('designer_auth');
    const savedKampanyaYapanAuth = getCookie('kampanya_yapan_auth');
    console.log('🍪 Cookie Check - designer_auth:', savedDesignerAuth, 'kampanya_yapan_auth:', savedKampanyaYapanAuth);
    if (savedDesignerAuth === 'true') {
      console.log('✅ Setting isDesigner to true from cookie');
      setIsDesigner(true);
    }
    if (savedKampanyaYapanAuth === 'true') {
      console.log('✅ Setting isKampanyaYapan to true from cookie');
      setIsKampanyaYapan(true);
    }
  }, []);

  // Restore user from cookie when departmentUsers loads
  useEffect(() => {
    const savedDeptUserId = getCookie('dept_user_id');
    if (savedDeptUserId && departmentUsers.length > 0) {
      const user = departmentUsers.find(u => u.id === savedDeptUserId);
      if (user) {
        setLoggedInDeptUser(user);
        // Sync roles explicitly to fix issues where cookie might be missing but user is logged in
        if (user.isDesigner) setIsDesigner(true);
        if (user.isKampanyaYapan) setIsKampanyaYapan(true);
      }
    }
  }, [departmentUsers]);

  // --- Presence Logic: Update lastSeen every minute ---
  useEffect(() => {
    if (!loggedInDeptUser) return;

    let isFirstUpdate = true;

    const updatePresence = async () => {
      try {
        const userRef = doc(db, "departmentUsers", loggedInDeptUser.id);
        const updateData: any = {
          lastSeen: Timestamp.now()
        };

        // Fetch IP address only on first update
        if (isFirstUpdate) {
          try {
            const ipResponse = await fetch('https://api.ipify.org?format=json');
            const ipData = await ipResponse.json();
            updateData.ipAddress = ipData.ip;
          } catch (ipError) {
            console.error("Error fetching IP:", ipError);
          }
          isFirstUpdate = false;
        }

        await updateDoc(userRef, updateData);
      } catch (error) {
        console.error("Error updating presence:", error);
      }
    };

    // Update immediately on mount/login
    updatePresence();

    // Update every minute
    const intervalId = setInterval(updatePresence, 60 * 1000);

    return () => clearInterval(intervalId);
  }, [loggedInDeptUser?.id]); // Depend on ID to avoid unnecessary re-runs if other fields change

  // --- Filter Logic ---
  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      // 1. Search & UI Filters ONLY (Access control is handled at render time)
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        event.title.toLowerCase().includes(query) ||
        event.id.toLowerCase().includes(query);

      const matchesAssignee = filterAssignee ? event.assigneeId === filterAssignee : true;
      const matchesUrgency = filterUrgency ? event.urgency === filterUrgency : true;
      const matchesStatus = filterStatus ? (event.status || 'Planlandı') === filterStatus : true;
      const matchesDepartment = filterDepartment ? event.departmentId === filterDepartment : true;

      // If a department user searches, they shouldn't find blurred events by content content,
      // but we still need them in the list to render them as "blurred".
      // So if search is active, we might need to filter strict. 
      // BUT for now, let's allow basic filtering and handle "blur" logic in rendering loop.

      return matchesSearch && matchesAssignee && matchesUrgency && matchesStatus && matchesDepartment;
    });
  }, [events, searchQuery, filterAssignee, filterUrgency, filterStatus, filterDepartment]);

  // Filter reports similar to events
  const filteredReports = useMemo(() => {
    return reports.filter(report => {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        report.title.toLowerCase().includes(query) ||
        (report.campaignTitle && report.campaignTitle.toLowerCase().includes(query)) ||
        report.id.toLowerCase().includes(query);

      const matchesAssignee = filterAssignee ? report.assigneeId === filterAssignee : true;
      const matchesStatus = filterStatus ?
        (filterStatus === 'Tamamlandı' ? report.status === 'done' :
          filterStatus === 'Planlandı' ? report.status === 'pending' : true) : true;

      return matchesSearch && matchesAssignee && matchesStatus;
    });
  }, [reports, searchQuery, filterAssignee, filterStatus]);

  const filteredAnnouncements = useMemo(() => {
    return announcements.filter(ann => {
      // 1. Admin (Firebase Auth) sees all
      if (!loggedInDeptUser && auth.currentUser) return true;

      // 2. Designer (Department User with role) sees all
      if (isDesigner) return true;

      // 3. Kampanya Yapan (Department User with role) sees 'all' and 'kampanya'
      if (isKampanyaYapan) {
        return ann.visibleTo === 'all' || ann.visibleTo === 'kampanya';
      }

      // 4. Business Unit (Department User without above roles) sees only 'all'
      // Note: If you want Business Units to see 'kampanya' announcements, add logic here.
      // Currently strictly following the label "Kampanya Yapan ve Admin"
      return ann.visibleTo === 'all';
    });
  }, [announcements, isDesigner, isKampanyaYapan, loggedInDeptUser]);

  // Determine current username for popup logic
  const currentUsername = useMemo(() => {
    if (loggedInDeptUser) return loggedInDeptUser.username;
    if (auth.currentUser) return 'Admin';
    return null;
  }, [loggedInDeptUser, auth.currentUser]);

  // Count unread announcements for badge
  const unreadAnnouncementCount = useMemo(() => {
    if (!loggedInDeptUser) return 0;
    const userId = loggedInDeptUser.id;
    return filteredAnnouncements.filter(ann => !ann.readBy || !ann.readBy.includes(userId)).length;
  }, [filteredAnnouncements, loggedInDeptUser]);

  // --- Calendar Logic ---
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

    return eachDayOfInterval({
      start: startDate,
      end: endDate,
    });
  }, [currentDate]);

  // Weekly view days calculation
  const weekDays = useMemo(() => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: weekStart, end: weekEnd });
  }, [currentDate]);

  // Display days based on viewMode
  const displayDays = viewMode === 'week' ? weekDays : calendarDays;

  // Navigation functions
  const nextPeriod = () => {
    if (viewMode === 'week') {
      setCurrentDate(addWeeks(currentDate, 1));
    } else {
      setCurrentDate(addMonths(currentDate, 1));
    }
  };
  const prevPeriod = () => {
    if (viewMode === 'week') {
      setCurrentDate(addWeeks(currentDate, -1));
    } else {
      setCurrentDate(addMonths(currentDate, -1));
    }
  };

  // Swipe gesture state and handlers
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX - touchEndX;
    const threshold = 50;

    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        nextPeriod(); // Swipe left → next
      } else {
        prevPeriod(); // Swipe right → prev
      }
    }
    setTouchStartX(null);
  };

  // Ref for today cell to enable scrolling
  const todayCellRef = React.useRef<HTMLDivElement>(null);

  const resetToToday = () => {
    setCurrentDate(new Date());
    // Use setTimeout to ensure the DOM is updated before scrolling
    setTimeout(() => {
      todayCellRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  // Mobile shell always navigates by month to keep header and list behavior consistent.
  const nextMobileMonth = () => {
    setCurrentDate((prev) => addMonths(prev, 1));
  };

  const prevMobileMonth = () => {
    setCurrentDate((prev) => addMonths(prev, -1));
  };

  // Auto-scroll to today when page loads
  useEffect(() => {
    // Only scroll after loading is complete
    if (isEventsLoading || isUsersLoading) return;

    // Retry mechanism to ensure DOM is ready
    let attempts = 0;
    const maxAttempts = 10;

    const scrollToToday = () => {
      if (todayCellRef.current) {
        todayCellRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (attempts < maxAttempts) {
        attempts++;
        setTimeout(scrollToToday, 200);
      }
    };

    // Start after initial render
    const timer = setTimeout(scrollToToday, 300);
    return () => clearTimeout(timer);
  }, [isEventsLoading, isUsersLoading]);

  // Campaign reminder notifications (1 day before)
  useEffect(() => {
    if (!notificationsGranted || isEventsLoading || events.length === 0) return;

    // Check once when events load and then every hour
    const checkReminders = () => {
      const notifiedKey = 'notified_campaign_reminders';
      const notifiedIds: string[] = JSON.parse(localStorage.getItem(notifiedKey) || '[]');
      const today = startOfDay(new Date());

      events.forEach(event => {
        // Skip if already notified
        if (notifiedIds.includes(event.id)) return;

        const eventDate = event.date instanceof Timestamp
          ? event.date.toDate()
          : new Date(event.date);

        // Check if event is tomorrow
        if (isTomorrow(eventDate)) {
          notifyCampaignReminder(event.title, 1);
          notifiedIds.push(event.id);
        }
      });

      // Save notified IDs (clean up old ones monthly)
      localStorage.setItem(notifiedKey, JSON.stringify(notifiedIds.slice(-100)));
    };

    // Initial check
    checkReminders();

    // Check every 5 minutes
    const interval = setInterval(checkReminders, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [notificationsGranted, isEventsLoading, events, notifyCampaignReminder]);

  const getHolidayName = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return TURKISH_HOLIDAYS[dateStr];
  };

  const addToast = (message: string, type: 'success' | 'info' = 'info') => {
    const newToast: ToastMessage = {
      id: Math.random().toString(36).substr(2, 9),
      message,
      type
    };
    setToasts((prev) => [...prev, newToast]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter(t => t.id !== id));
  };

  // --- FIREBASE ACTIONS ---

  const seedDatabase = async () => {
    try {
      if (users.length === 0) {
        for (const user of INITIAL_USERS) {
          await setDoc(doc(db, "users", user.id), user);
        }
      }
      if (departments.length === 0) {
        for (const dept of INITIAL_DEPARTMENTS) {
          await setDoc(doc(db, "departments", dept.id), dept);
        }
      }
      if (events.length === 0) {
        for (const event of INITIAL_EVENTS) {
          const { id, ...eventData } = event;
          await setDoc(doc(db, "events", id), {
            ...eventData,
            date: Timestamp.fromDate(event.date)
          });
        }
      }
      addToast('Veritabanı varsayılan verilerle dolduruldu.', 'success');
    } catch (error) {
      console.error("Seeding error:", error);
      addToast('Veri yükleme hatası!', 'info');
    }
  };

  const handleAddUser = async (name: string, email: string, emoji: string, phone?: string) => {
    try {
      await addDoc(collection(db, "users"), {
        name,
        email,
        emoji,
        phone: phone || null
      });
      addToast(`${name} başarıyla eklendi.`, 'success');
    } catch (e) {
      addToast('Hata oluştu.', 'info');
    }
  };

  const handleDeleteUser = async (id: string) => {
    try {
      await deleteDoc(doc(db, "users", id));
      addToast('Personel silindi.', 'info');
    } catch (e) {
      addToast('Silme hatası.', 'info');
    }
  };

  const handleUpdateUser = async (id: string, updates: Partial<User>) => {
    try {
      await updateDoc(doc(db, "users", id), updates);
      addToast('Personel güncellendi.', 'success');
    } catch (e) {
      console.error('Update user error:', e);
      addToast('Güncelleme hatası.', 'info');
    }
  };

  // === ANALYTICS USER HANDLERS ===
  const handleAddAnalyticsUser = async (name: string, email: string, emoji: string, phone?: string) => {
    try {
      await addDoc(collection(db, "analyticsUsers"), {
        name,
        email,
        emoji,
        phone: phone || null
      });
      addToast(`${name} (Analitik) başarıyla eklendi.`, 'success');
    } catch (e) {
      addToast('Analitik personel ekleme hatası.', 'info');
    }
  };

  const handleUpdateAnalyticsUser = async (id: string, updates: Partial<AnalyticsUser>) => {
    try {
      await updateDoc(doc(db, "analyticsUsers", id), updates);
      addToast('Analitik personel güncellendi.', 'success');
    } catch (e) {
      console.error('Update analytics user error:', e);
      addToast('Güncelleme hatası.', 'info');
    }
  };

  const handleDeleteAnalyticsUser = async (id: string) => {
    try {
      await deleteDoc(doc(db, "analyticsUsers", id));
      addToast('Analitik personel silindi.', 'info');
    } catch (e) {
      addToast('Analitik silme hatası.', 'info');
    }
  };

  const handleAddDepartment = async (name: string) => {
    try {
      await addDoc(collection(db, "departments"), { name });
      addToast(`${name} birimi eklendi.`, 'success');
    } catch (e) {
      addToast('Hata oluştu.', 'info');
    }
  };

  const handleDeleteDepartment = async (id: string) => {
    try {
      await deleteDoc(doc(db, "departments", id));
      addToast('Birim silindi.', 'info');
    } catch (e) {
      addToast('Silme hatası.', 'info');
    }
  };

  const handleExportPdf = async () => {
    try {
      addToast('PDF hazırlanıyor...', 'info');

      // Turkish character to ASCII converter for PDF compatibility
      const toAscii = (text: string): string => {
        if (!text) return '';
        return text
          .replace(/ğ/g, 'g').replace(/Ğ/g, 'G')
          .replace(/ü/g, 'u').replace(/Ü/g, 'U')
          .replace(/ş/g, 's').replace(/Ş/g, 'S')
          .replace(/ı/g, 'i').replace(/İ/g, 'I')
          .replace(/ö/g, 'o').replace(/Ö/g, 'O')
          .replace(/ç/g, 'c').replace(/Ç/g, 'C');
      };

      // Create PDF in landscape A4
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      const pageWidth = pdf.internal.pageSize.getWidth(); // 297mm
      const pageHeight = pdf.internal.pageSize.getHeight(); // 210mm
      const margin = 10;
      const usableWidth = pageWidth - (2 * margin);
      // cellWidth will be recalculated after checking weekend events

      // Status colors
      const statusColors: Record<string, { bg: number[], text: number[] }> = {
        'Planlandı': { bg: [219, 234, 254], text: [30, 64, 175] },      // blue
        'Bekleme': { bg: [254, 243, 199], text: [180, 83, 9] },         // amber
        'Tamamlandı': { bg: [220, 252, 231], text: [22, 101, 52] },     // green
        'İptal Edildi': { bg: [254, 226, 226], text: [185, 28, 28] }    // red
      };

      // Calculate calendar days first
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);

      // Filter events for current month only
      const monthEvents = events.filter(ev => {
        const evDate = ev.date instanceof Date ? ev.date : (ev.date as any).toDate();
        return isSameMonth(evDate, currentDate);
      });

      // Calculate statistics for current month
      const completedCount = monthEvents.filter(ev => ev.status === 'Tamamlandı').length;
      const plannedCount = monthEvents.filter(ev => ev.status === 'Planlandı').length;
      const waitingCount = monthEvents.filter(ev => ev.status === 'Bekleme').length;
      const cancelledCount = monthEvents.filter(ev => ev.status === 'İptal Edildi').length;

      // Header - compact
      pdf.setFillColor(139, 92, 246); // violet-500
      pdf.rect(0, 0, pageWidth, 16, 'F');

      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      const monthYearText = toAscii(format(currentDate, 'MMMM yyyy', { locale: tr }).toUpperCase());
      pdf.text(`KAMPANYA TAKVIMI - ${monthYearText}`, margin, 10);

      // Statistics in header
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'normal');
      const statsText = `Tamamlandi: ${completedCount} | Planlandi: ${plannedCount} | Bekleme: ${waitingCount} | Iptal: ${cancelledCount}`;
      pdf.text(statsText, margin, 14);

      // Right side info
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`${format(new Date(), 'dd.MM.yyyy HH:mm')}`, pageWidth - margin, 10, { align: 'right' });
      const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
      const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
      const allDays = eachDayOfInterval({ start: calStart, end: calEnd });

      // Check if there are any weekend events in this month's view
      const hasWeekendEvents = events.some(ev => {
        const evDate = ev.date instanceof Date ? ev.date : (ev.date as any).toDate();
        return isWeekend(evDate) && allDays.some(d => isSameDay(d, evDate));
      });

      // Determine columns - 5 if no weekend events, 7 otherwise
      const numCols = hasWeekendEvents ? 7 : 5;
      const dayNames = hasWeekendEvents
        ? ['Pzt', 'Sal', 'Car', 'Per', 'Cum', 'Cmt', 'Paz']
        : ['Pzt', 'Sal', 'Car', 'Per', 'Cum'];

      // Filter out weekends if not needed
      const days = hasWeekendEvents
        ? allDays
        : allDays.filter(d => !isWeekend(d));

      // Recalculate cell width based on columns
      const actualCellWidth = usableWidth / numCols;

      // Day headers
      const dayHeaderY = 22;

      pdf.setFillColor(249, 250, 251); // gray-50
      pdf.rect(margin, dayHeaderY - 4, usableWidth, 6, 'F');

      pdf.setTextColor(100, 100, 100);
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'bold');

      dayNames.forEach((day, i) => {
        const x = margin + (i * actualCellWidth) + (actualCellWidth / 2);
        pdf.text(day, x, dayHeaderY, { align: 'center' });
      });

      // Grid settings
      const gridStartY = 26;
      const numRows = Math.ceil(days.length / numCols);
      const cellHeight = (pageHeight - gridStartY - 8) / numRows;

      // Draw calendar grid
      days.forEach((day, index) => {
        const col = index % numCols;
        const row = Math.floor(index / numCols);
        const x = margin + (col * actualCellWidth);
        const y = gridStartY + (row * cellHeight);
        const isCurrentMonth = isSameMonth(day, currentDate);
        const isTodayDate = isToday(day);
        const isWeekendDay = isWeekend(day);

        // Cell background
        if (!isCurrentMonth) {
          pdf.setFillColor(243, 244, 246); // gray-100
        } else if (isTodayDate) {
          pdf.setFillColor(237, 233, 254); // violet-100
        } else if (isWeekendDay) {
          pdf.setFillColor(254, 242, 242); // red-50
        } else {
          pdf.setFillColor(255, 255, 255);
        }
        pdf.rect(x, y, actualCellWidth, cellHeight, 'F');

        // Cell border
        pdf.setDrawColor(229, 231, 235); // gray-200
        pdf.setLineWidth(0.2);
        pdf.rect(x, y, actualCellWidth, cellHeight, 'S');

        // Day number - small, top right corner
        pdf.setFontSize(7);
        pdf.setFont('helvetica', isTodayDate ? 'bold' : 'normal');
        pdf.setTextColor(isTodayDate ? 139 : (isCurrentMonth ? 80 : 180), isTodayDate ? 92 : (isCurrentMonth ? 80 : 180), isTodayDate ? 246 : (isCurrentMonth ? 80 : 180));
        pdf.text(format(day, 'd'), x + actualCellWidth - 2, y + 4, { align: 'right' });

        // Get events for this day
        const dayEvents = events.filter(ev => {
          const evDate = ev.date instanceof Date ? ev.date : (ev.date as any).toDate();
          return isSameDay(evDate, day);
        });

        // Draw events - use 2 columns when we have 5-day layout (wider cells)
        const eventHeight = 3;
        const eventsPerColumn = Math.floor((cellHeight - 6) / (eventHeight + 0.5));
        const useDoubleColumn = !hasWeekendEvents && actualCellWidth > 50;
        const maxEvents = useDoubleColumn ? eventsPerColumn * 2 : eventsPerColumn;
        const colWidth = useDoubleColumn ? (actualCellWidth - 2) / 2 : actualCellWidth - 1;

        dayEvents.slice(0, maxEvents).forEach((ev, evIndex) => {
          const status = ev.status || 'Planlandı';
          const colors = statusColors[status] || statusColors['Planlandı'];

          // Calculate position based on single or double column layout
          let eventX: number;
          let eventY: number;
          if (useDoubleColumn) {
            const col = evIndex < eventsPerColumn ? 0 : 1;
            const rowInCol = evIndex < eventsPerColumn ? evIndex : evIndex - eventsPerColumn;
            eventX = x + 1 + (col * (colWidth + 1));
            eventY = y + 2 + (rowInCol * (eventHeight + 0.5));
          } else {
            eventX = x + 1;
            eventY = y + 2 + (evIndex * (eventHeight + 0.5));
          }

          // Small color indicator line
          pdf.setFillColor(colors.text[0], colors.text[1], colors.text[2]);
          pdf.rect(eventX, eventY, 1, eventHeight, 'F');

          // Event text - dark gray for readability
          pdf.setTextColor(50, 50, 50);
          pdf.setFontSize(5);
          pdf.setFont('helvetica', 'normal');

          // Truncate title to fit column width
          let title = toAscii(ev.title || '');
          const maxChars = Math.floor((colWidth - 2) / 1.1);
          if (title.length > maxChars) {
            title = title.substring(0, maxChars - 1) + '..';
          }
          pdf.text(title, eventX + 1.5, eventY + 2.2);
        });

        // Show "+X" if there are more events
        if (dayEvents.length > maxEvents) {
          pdf.setTextColor(139, 92, 246);
          pdf.setFontSize(5);
          pdf.setFont('helvetica', 'bold');
          pdf.text(`+${dayEvents.length - maxEvents}`, x + actualCellWidth - 2, y + cellHeight - 1, { align: 'right' });
        }
      });

      // Legend at bottom - minimal
      const legendY = pageHeight - 3;
      pdf.setFontSize(6);
      pdf.setFont('helvetica', 'normal');

      let legendX = margin;
      const legendItems = [
        { label: 'Planlandi', color: statusColors['Planlandı'] },
        { label: 'Bekleme', color: statusColors['Bekleme'] },
        { label: 'Tamamlandi', color: statusColors['Tamamlandı'] },
        { label: 'Iptal', color: statusColors['İptal Edildi'] }
      ];

      legendItems.forEach((item) => {
        pdf.setFillColor(item.color.text[0], item.color.text[1], item.color.text[2]);
        pdf.rect(legendX, legendY - 2, 2, 2, 'F');
        pdf.setTextColor(100, 100, 100);
        pdf.text(item.label, legendX + 3, legendY);
        legendX += 22;
      });

      // Total events count for current month
      pdf.setTextColor(100, 100, 100);
      pdf.text(`${monthEvents.length} kampanya`, pageWidth - margin, legendY, { align: 'right' });

      // Save
      pdf.save(`kampanya-takvimi-${format(currentDate, 'yyyy-MM')}.pdf`);
      addToast('PDF indirildi.', 'success');
    } catch (error) {
      console.error('PDF Export Error:', error);
      addToast('PDF olusturulurken hata olustu.', 'info');
    }
  };

  const handleAddAnnouncement = async (title: string, content: string, visibleTo: 'admin' | 'kampanya' | 'all') => {
    try {
      const user = loggedInDeptUser ? loggedInDeptUser.username : 'Admin';
      const docRef = await addDoc(collection(db, "announcements"), {
        title,
        content,
        visibleTo,
        createdAt: Timestamp.now(),
        createdBy: user,
        readBy: []
      });

      // Log action
      await addDoc(collection(db, "logs"), {
        message: `${user} yeni bir duyuru yayınladı: "${title}"`,
        timestamp: Timestamp.now()
      });

      addToast('Duyuru yayınlandı.', 'success');

      // Browser notification for new announcement
      notifyNewAnnouncement(title);
    } catch (e) {
      addToast('Duyuru eklenemedi.', 'info');
    }
  };

  const handleMarkAsRead = async (ids: string[]) => {
    // Determine user ID
    let userId = loggedInDeptUser ? loggedInDeptUser.id : 'guest';
    // If Admin (Firebase Auth) but not Dept User, use uid
    if (!loggedInDeptUser && auth.currentUser) {
      userId = auth.currentUser.uid;
    }

    if (userId === 'guest') return; // Don't track guests in Firestore

    // Filter only those not already read by this user
    const unreadIds = ids.filter(id => {
      const ann = announcements.find(a => a.id === id);
      return ann && (!ann.readBy || !ann.readBy.includes(userId));
    });

    if (unreadIds.length === 0) return;

    // Batch update
    const batch = writeBatch(db);
    unreadIds.forEach(id => {
      const ref = doc(db, "announcements", id);
      batch.update(ref, {
        readBy: arrayUnion(userId)
      });
    });

    try {
      await batch.commit();
    } catch (e) {
      console.error("Error marking announcements as read:", e);
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    try {
      const user = loggedInDeptUser ? loggedInDeptUser.username : 'Admin';
      await deleteDoc(doc(db, "announcements", id));

      // Log action
      await addDoc(collection(db, "logs"), {
        message: `${user} bir duyuruyu sildi.`,
        timestamp: Timestamp.now()
      });

      addToast('Duyuru silindi.', 'info');
    } catch (e) {
      addToast('Silme hatası.', 'info');
    }
  };

  const callAdminApi = async (data: any) => {
    try {
      const response = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const raw = await response.text();
      const contentType = response.headers.get('content-type') || '';

      let result: any = null;
      if (raw && contentType.includes('application/json')) {
        try {
          result = JSON.parse(raw);
        } catch {
          result = null;
        }
      } else if (raw) {
        try {
          result = JSON.parse(raw);
        } catch {
          result = null;
        }
      }

      if (!response.ok) {
        const fallback = raw ? raw.slice(0, 180).replace(/\s+/g, ' ').trim() : 'Boş yanıt';
        throw new Error(result?.error || `API ${response.status}: ${fallback}`);
      }

      if (!result) {
        const fallback = raw ? raw.slice(0, 180).replace(/\s+/g, ' ').trim() : 'Boş yanıt';
        throw new Error(`API geçersiz yanıt döndü: ${fallback}`);
      }

      return result;
    } catch (error: any) {
      console.error("API Call Error:", error);
      if (error instanceof SyntaxError && error.message.includes('JSON')) {
        // This usually happens when Vercel returns an HTML 500 page instead of JSON
        throw new Error("Sunucu hatası (API): Geçersiz yanıt formatı. (Environment variable sorunu olabilir)");
      }
      // Check if we are on localhost
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        throw new Error("Localhost üzerinde API çalışmaz. Lütfen Vercel veya 'vercel dev' kullanın.");
      }
      throw error;
    }
  };

  const handleAddDepartmentUser = async (username: string, password: string, departmentId: string, isDesignerRole: boolean, isKampanyaYapanRole: boolean, isBusinessUnitRole: boolean, isAnalitikRole: boolean, email?: string) => {
    try {
      // Enforce email
      const userEmail = email || `${username.toLowerCase().replace(/\s+/g, '')}@kampanyatakvim.com`;
      const cleanPassword = password.trim();

      let uid = "";
      let serverProjectId = "unknown";

      try {
        // Create user via Server-Side API (Reliable)
        // This avoids client-side auth conflicts
        const result = await callAdminApi({
          action: 'createUser',
          email: userEmail,
          password: cleanPassword
        });

        // Verify Project ID
        serverProjectId = result.projectId;
        const serverEmail = result.serviceAccountEmail;
        const clientProjectId = firebaseConfig.projectId;

        if (serverProjectId === 'unknown') {
          alert(`UYARI: Sunucu tarafındaki Firebase Proje ID'si doğrulanamadı.\n\nClient: ${clientProjectId}\nServer: Bilinmiyor\n\nKullanıcı oluşturulmuş olabilir ancak yanlış projede olabilir.`);
        } else if (serverProjectId !== clientProjectId) {
          alert(`KRİTİK HATA: Proje Uyuşmazlığı!\n\nClient (Tarayıcı): ${clientProjectId}\nServer (API): ${serverProjectId}\nServer Email: ${serverEmail}\n\nBu durum, Vercel'deki 'FIREBASE_SERVICE_ACCOUNT' değişkeninin yanlış projeye ait olduğunu gösterir. Lütfen Vercel ayarlarını düzeltin.`);
          throw new Error(`Project ID mismatch: Client=${clientProjectId}, API=${serverProjectId}`);
        }

        uid = result.uid;
      } catch (authError: any) {
        // Check if error message contains "already in use" or similar code passed from API
        const errStr = authError.message || authError.toString();
        if (errStr.includes('auth/email-already-in-use') || errStr.includes('already in use') || errStr.includes('zaten kullanımda')) {
          // Ask admin if they want to overwrite the old auth user
          if (confirm('Bu e-posta adresi (' + userEmail + ') ile kayıtlı eski bir kullanıcı (Auth) bulundu. Veritabanı kaydı yoksa bu "hayalet" bir kayıt olabilir.\n\nEski Auth kaydını silip yenisini oluşturmak ister misiniz?')) {
            try {
              addToast('Eski Auth kaydı temizleniyor...', 'info');
              await callAdminApi({ action: 'deleteUser', email: userEmail });

              // Retry creation
              addToast('Kullanıcı yeniden oluşturuluyor...', 'info');
              const result = await callAdminApi({
                action: 'createUser',
                email: userEmail,
                password: cleanPassword
              });
              uid = result.uid;
            } catch (retryError: any) {
              const msg = retryError.message || retryError.toString();
              throw new Error('Temizleme ve yeniden oluşturma başarısız: ' + msg);
            }
          } else {
            throw new Error('Bu e-posta adresi zaten kullanımda.');
          }
        } else {
          throw authError;
        }
      }

      await addDoc(collection(db, "departmentUsers"), {
        username,
        // password, // REMOVED FOR SECURITY
        uid,
        departmentId,
        isDesigner: isDesignerRole,
        isKampanyaYapan: isKampanyaYapanRole,
        isBusinessUnit: isBusinessUnitRole,
        isAnalitik: isAnalitikRole,
        email: userEmail,
        hasDefaultPassword: cleanPassword === '123456', // Flag for default password
        createdAt: Timestamp.now()
      });
      addToast(`${username} kullanıcısı eklendi. (Server: ${serverProjectId})`, 'success');
    } catch (e: any) {
      console.error(e);
      addToast(`Kullanıcı eklenemedi: ${e.message}`, 'info');
    }
  };

  const handleDeleteDepartmentUser = async (id: string) => {
    try {
      const userToDelete = departmentUsers.find(u => u.id === id);

      // 1. Try to delete from Auth via API
      if (userToDelete?.uid || userToDelete?.email) {
        try {
          await callAdminApi({
            action: 'deleteUser',
            uid: userToDelete.uid,
            email: userToDelete.email
          });
          addToast('Auth kaydı silindi.', 'success');
        } catch (apiErr: any) {
          console.warn("Auth deletion failed:", apiErr);
          addToast('Auth silinemedi (API hatası). Sadece veritabanından siliniyor.', 'info');
        }
      }

      await deleteDoc(doc(db, "departmentUsers", id));
      addToast('Kullanıcı veritabanından silindi.', 'info');
    } catch (e) {
      addToast('Silme hatası.', 'info');
    }
  };

  const handleUpdateDepartmentUser = async (id: string, updates: Partial<DepartmentUser> & { password?: string }) => {
    try {
      const userToUpdate = departmentUsers.find(u => u.id === id);
      if (!userToUpdate) throw new Error("Kullanıcı bulunamadı");
      const cleanPassword = updates.password?.trim();

      // 1. Update Auth if needed (email or password)
      if (updates.email || cleanPassword) {
        if (!userToUpdate.uid) {
          throw new Error("Bu kullanıcının UID değeri eksik, Auth güncellemesi yapılamaz.");
        }
        await callAdminApi({
          action: 'updateUser',
          uid: userToUpdate.uid,
          email: updates.email,
          password: cleanPassword
        });
        addToast('Kullanıcı Auth bilgileri güncellendi.', 'success');
      }

      // 2. Update Firestore
      // Extract password so it doesn't go to Firestore
      const { password, ...firestoreUpdates } = updates;

      if (Object.keys(firestoreUpdates).length > 0) {
        await updateDoc(doc(db, "departmentUsers", id), firestoreUpdates);
        addToast('Kullanıcı bilgileri güncellendi.', 'success');
      }
    } catch (e: any) {
      console.error(e);
      addToast(`Güncelleme hatası: ${e.message}`, 'info'); // Using 'info' for consistency with other errors in this file or 'error' if available
    }
  };

  const handleDepartmentLogin = (user: DepartmentUser) => {
    // Legacy handler - logic moved to onAuthStateChanged but keeping for now if needed by modal
    // But modal should now do auth login.
    // We'll update this to just do nothing or be deprecated.
  };

  const handleDepartmentLogout = async () => {
    await signOut(auth);
    setLoggedInDeptUser(null);
    setIsDesigner(false);
    setIsKampanyaYapan(false);
    setIsAnalitik(false);
    // Clear cookies
    deleteCookie('designer_auth');
    deleteCookie('kampanya_yapan_auth');
    deleteCookie('dept_user_id');
    addToast('Çıkış yapıldı.', 'info');
  };

  const handleChangePassword = async (currentPassword: string, newPassword: string) => {
    if (!loggedInDeptUser || !auth.currentUser || !auth.currentUser.email) {
      throw new Error("Oturum bilgisi eksik. Lütfen sayfayı yenileyip tekrar giriş yapın.");
    }

    try {
      // Update in Firebase Auth
      const { updatePassword, EmailAuthProvider, reauthenticateWithCredential } = await import('firebase/auth');

      // Re-authenticate user before changing password
      const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);

      await updatePassword(auth.currentUser, newPassword);

      // Clear the hasDefaultPassword flag in Firestore
      if (loggedInDeptUser.id) {
        await updateDoc(doc(db, "departmentUsers", loggedInDeptUser.id), {
          hasDefaultPassword: false
        });
      }

      addToast('Şifreniz başarıyla güncellendi.', 'success');
    } catch (error: any) {
      console.error("Error updating password:", error);
      if (error.code === 'auth/wrong-password') {
        throw new Error('Mevcut şifre hatalı.');
      } else if (error.code === 'auth/requires-recent-login') {
        throw new Error('Güvenlik nedeniyle yeniden giriş yapmalısınız.');
      } else {
        throw new Error('Şifre güncellenemedi.');
      }
    }
  };

  // Admin password change - for super admin (Firebase Auth only)
  const handleAdminChangePassword = async (currentPassword: string, newPassword: string) => {
    if (!auth.currentUser || !auth.currentUser.email) {
      throw new Error("Oturum bilgisi eksik. Lütfen sayfayı yenileyip tekrar giriş yapın.");
    }

    try {
      const { updatePassword, EmailAuthProvider, reauthenticateWithCredential } = await import('firebase/auth');

      // Re-authenticate user before changing password
      const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);

      await updatePassword(auth.currentUser, newPassword);
      addToast('Admin şifreniz başarıyla güncellendi.', 'success');
    } catch (error: any) {
      console.error("Error updating admin password:", error);
      if (error.code === 'auth/wrong-password') {
        throw new Error('Mevcut şifre hatalı.');
      } else if (error.code === 'auth/requires-recent-login') {
        throw new Error('Güvenlik nedeniyle yeniden giriş yapmalısınız.');
      } else {
        throw new Error('Şifre güncellenemedi.');
      }
    }
  };

  const handleUpdateAutoThemeConfig = async (config: { enabled: boolean; time: string }) => {
    try {
      await setDoc(doc(db, "system_settings", "theme_config"), config);
      addToast('Tema ayarları güncellendi.', 'success');
    } catch (e) {
      console.error(e);
      addToast('Ayarlar güncellenemedi.', 'info');
    }
  };

  const handleAddRequest = async (title: string, urgency: UrgencyLevel, date: Date, description?: string, requesterEmail?: string) => {
    if (!loggedInDeptUser?.isBusinessUnit) return;
    try {
      const emailToUse = requesterEmail || loggedInDeptUser.email || '';
      await addDoc(collection(db, "work_requests"), {
        title,
        urgency,
        targetDate: Timestamp.fromDate(date),
        description: description || '',
        departmentId: loggedInDeptUser.departmentId,
        requesterEmail: emailToUse,
        status: 'pending',
        createdAt: Timestamp.now()
      });
      addToast('İş talebi oluşturuldu.', 'success');
      setIsRequestModalOpen(false);
    } catch (e) {
      console.error(e);
      addToast('Talep oluşturulamadı.', 'info');
    }
  };

  const handleAcceptRequest = (request: WorkRequest) => {
    setConvertingRequest(request);
    // Ensure we pass a Date object
    const targetDate = request.targetDate instanceof Date ? request.targetDate : (request.targetDate as any).toDate();
    setSelectedDate(targetDate);
    setIsIncomingRequestsModalOpen(false);
    setIsAddModalOpen(true);
  };

  const handleRejectRequest = async (request: WorkRequest) => {
    if (!confirm('Bu talebi reddetmek istediğinize emin misiniz?')) return;
    try {
      await updateDoc(doc(db, "work_requests", request.id), { status: 'rejected' });
      addToast('Talep reddedildi.', 'info');
    } catch (e) {
      addToast('İşlem başarısız.', 'info');
    }
  };

  const handleAddNote = async () => {
    if (!selectedEventIdForNote || !noteContent.trim()) return;

    try {
      const eventRef = doc(db, "events", selectedEventIdForNote);
      const adminEmail = auth.currentUser?.email?.trim().toLowerCase();
      const adminDisplayName = auth.currentUser?.displayName?.trim();
      const matchedUser = adminEmail
        ? users.find(u => u.email?.trim().toLowerCase() === adminEmail)
        : null;
      const adminEmailName = adminEmail ? adminEmail.split('@')[0] : '';
      const noteAuthorName =
        loggedInDeptUser?.username?.trim() ||
        matchedUser?.name?.trim() ||
        adminDisplayName ||
        adminEmailName ||
        (isDesigner ? 'Admin' : 'Bilinmeyen Kullanıcı');
      await updateDoc(eventRef, {
        note: noteContent.trim(),
        noteAuthorName,
        noteAddedAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      addToast('Not eklendi.', 'success');
      setIsNoteModalOpen(false);
      setNoteContent('');
      setSelectedEventIdForNote(null);
    } catch (e) {
      console.error(e);
      addToast('Not eklenemedi.', 'info');
    }
  };

  const handleDeleteNote = async (eventId: string) => {
    if (!confirm('Notu silmek istediğinize emin misiniz?')) return;
    try {
      const eventRef = doc(db, "events", eventId);
      await updateDoc(eventRef, {
        note: '',
        noteAuthorName: '',
        noteAddedAt: null,
        updatedAt: Timestamp.now()
      });
      addToast('Not silindi.', 'success');
    } catch (e) {
      addToast('Silme işlemi başarısız.', 'info');
    }
  };

  const handleAddEvent = async (
    title: string,
    urgency: UrgencyLevel,
    date: Date,
    assigneeId?: string,
    description?: string,
    departmentId?: string,
    difficulty?: DifficultyLevel,
    requiresReport?: boolean,
    reportDueDate?: Date,
    channels?: { push?: boolean; sms?: boolean; popup?: boolean; email?: boolean; mimCCO?: boolean; mimCCI?: boolean; atm?: boolean; sube?: boolean; },
    sendType?: SendType,
    campaignType?: CampaignType
  ) => {
    const effectiveCampaignType: CampaignType = campaignType || 'Yeni Kampanya';
    const effectiveRequiresReport = effectiveCampaignType === 'Kampanya Hatırlatması' ? false : (requiresReport !== false);

    const eventData = {
      title,
      date: Timestamp.fromDate(date),
      originalDate: Timestamp.fromDate(date), // Store first assigned date for duration calculation
      urgency,
      sendType: sendType || 'Kampanya',
      campaignType: effectiveCampaignType,
      difficulty: difficulty || 'ORTA',
      assigneeId,
      description,
      departmentId,
      status: 'Planlandı',
      requiresReport: effectiveRequiresReport,
      channels: channels || {},
      createdAt: Timestamp.now(),
      history: [{
        date: Timestamp.now(),
        action: 'created',
        newStatus: 'Planlandı',
        changedBy: loggedInDeptUser?.username || 'System'
      }]
    };

    let newEventId = "";

    try {
      const docRef = await addDoc(collection(db, "events"), eventData);
      newEventId = docRef.id;
      addToast('Kampanya oluşturuldu.', 'success');

      // Browser notification for new campaign
      notifyNewCampaign(title);

      // Check if we are converting a request
      if (convertingRequest) {
        const reqRef = doc(db, "work_requests", convertingRequest.id);
        await updateDoc(reqRef, { status: 'approved' });

        // If assigned and there's a requester email, send notification to requester
        if (assigneeId && convertingRequest.requesterEmail) {
          const formattedRequestDate = format(convertingRequest.createdAt instanceof Timestamp ? convertingRequest.createdAt.toDate() : convertingRequest.createdAt, 'd MMMM yyyy HH:mm', { locale: tr });
          const requesterEmailMessage = `${formattedRequestDate} tarihinde talep ettiğiniz "${title}" kampanya/bilgilendirme için iş planlaması yapılmıştır.`;
        }

        setConvertingRequest(null);
      }
    } catch (e) {
      console.error(e);
      addToast('Hata: Kampanya kaydedilemedi.', 'info');
      return;
    }

    if (assigneeId) {
      const assignedUser = users.find(u => u.id === assigneeId);
      if (assignedUser) {

        await addDoc(collection(db, "notifications"), {
          title: 'Görev Ataması Yapıldı',
          message: `${assignedUser.name} kişisine "${title}" görevi atandı.`,
          date: Timestamp.now(),
          isRead: false,
          type: 'email'
        });

        // Browser notification for task assignment
        notifyTaskAssignment(title, loggedInDeptUser?.username || 'Sistem');

        await addDoc(collection(db, "logs"), {
          message: `${title} kampanyası için ${assignedUser.name} kişiye görev ataması yapıldı (ID: ${newEventId})`,
          timestamp: Timestamp.now()
        });

        // Create report if required and due date provided
        if (effectiveRequiresReport && reportDueDate) {
          try {
            await addDoc(collection(db, "reports"), {
              title: `${title} - Rapor`,
              campaignId: newEventId,
              campaignTitle: title,
              assigneeId: assigneeId,
              dueDate: Timestamp.fromDate(reportDueDate),
              status: 'pending',
              createdAt: Timestamp.now(),
              isAutoGenerated: true
            });
          } catch (reportError) {
            console.error('Error creating report:', reportError);
          }
        }

        setIsSendingEmail(true);

        let emailMessage = `${format(date, 'd MMMM yyyy', { locale: tr })} tarihindeki "${title}" kampanyası için görevlendirildiniz.\nAciliyet: ${URGENCY_CONFIGS[urgency].label}`;
        if (description) emailMessage += `\n\nAçıklama:\n${stripHtml(description)}`;

        if (departmentId) {
          const dept = departments.find(d => d.id === departmentId);
          if (dept) emailMessage += `\n\nTalep Eden Birim: ${dept.name}`;
        }

        // Add channels if any selected
        if (channels && Object.values(channels).some(v => v)) {
          const selectedChannels: string[] = [];
          if (channels.push) selectedChannels.push('Push');
          if (channels.sms) selectedChannels.push('SMS');
          if (channels.popup) selectedChannels.push('Pop-Up');
          if (channels.email) selectedChannels.push('E-mail');
          if (channels.mimCCO || channels.mimCCI) {
            const mimSubChannels: string[] = [];
            if (channels.mimCCO) mimSubChannels.push('CCO (Inbound)');
            if (channels.mimCCI) mimSubChannels.push('CCI (Outbound)');
            selectedChannels.push(`MİM (${mimSubChannels.join(', ')})`);
          }
          if (channels.atm) selectedChannels.push('ATM');
          if (channels.sube) selectedChannels.push('Şube');

          if (selectedChannels.length > 0) {
            emailMessage += `\n\nKanallar: ${selectedChannels.join(', ')}`;
          }
        }

        const footerIdText = `Ref ID: #${newEventId.substring(0, 6).toUpperCase()}`;
        const isVeryHigh = urgency === 'Very High';
        const subjectPrefix = isVeryHigh ? 'ACİL: ' : '';

        // Send SMS if Twilio is enabled and user has phone number
        try {
          const settingsDoc = await getDoc(doc(db, 'reminderSettings', 'default'));
          if (settingsDoc.exists()) {
            const smsSettings = settingsDoc.data() as ReminderSettings;

            if (smsSettings.twilioEnabled &&
              smsSettings.twilioAccountSid &&
              smsSettings.twilioAuthToken &&
              smsSettings.twilioPhoneNumber &&
              assignedUser.phone) {

              const smsMessage = buildSMSFromTemplate(
                smsSettings.smsTemplate || '{title} görevi size atandı.',
                {
                  title,
                  assignee: assignedUser.name,
                  urgency: URGENCY_CONFIGS[urgency].label
                }
              );

              await sendSMSWithTwilio(
                smsSettings.twilioAccountSid,
                smsSettings.twilioAuthToken,
                smsSettings.twilioPhoneNumber,
                {
                  toNumber: formatPhoneNumber(assignedUser.phone),
                  message: smsMessage
                }
              );

              console.log('SMS sent successfully to:', assignedUser.phone);
            }
          }
        } catch (smsError) {
          console.error('SMS send error (non-blocking):', smsError);
          // Don't block the flow if SMS fails
        }

        // Open mailto directly for task assignment
        const subject = encodeURIComponent(`${subjectPrefix}${title} - Kampanya Görev Ataması`);
        const body = encodeURIComponent(`Merhaba ${assignedUser.name},\n\n${emailMessage}\n\n----------------\n${footerIdText}`);
        window.location.href = `mailto:${assignedUser.email}?cc=kampanyayonetimi@vakifbank.com.tr&subject=${subject}&body=${body}`;

        addToast('Mail istemcisi açılıyor...', 'info');
        setIsSendingEmail(false);
      }
    }
  };

  const handleDeleteEvent = async (id: string) => {
    try {
      // Fetch event first to get title for notification
      const eventSnap = await getDoc(doc(db, "events", id));
      const eventData = eventSnap.exists() ? eventSnap.data() : null;

      await deleteDoc(doc(db, "events", id));

      // Delete related reports
      try {
        const reportsQuery = query(collection(db, "reports"), where("campaignId", "==", id));
        const reportsSnapshot = await getDocs(reportsQuery);
        const deletePromises = reportsSnapshot.docs.map(reportDoc => deleteDoc(reportDoc.ref));
        await Promise.all(deletePromises);

        if (reportsSnapshot.docs.length > 0) {
          console.log(`${reportsSnapshot.docs.length} ilişkili rapor silindi`);
        }
      } catch (reportError) {
        console.error('İlişkili raporlar silinirken hata:', reportError);
      }

      if (eventData) {
        // Find assignee name
        const assignee = users.find(u => u.id === eventData.assigneeId);
        const assigneeName = assignee ? assignee.name : 'Bilinmeyen Kullanıcı';

        await addDoc(collection(db, "notifications"), {
          title: 'Kampanya Silindi',
          message: `${assigneeName} kişisine atanan "${eventData.title}" kampanyası silindi.`,
          date: Timestamp.now(),
          isRead: false,
          type: 'alert'
        });
      }

      addToast('Kampanya silindi.', 'info');
    } catch (e) {
      addToast('Silme hatası.', 'info');
    }
  };

  const handleEditEvent = async (eventId: string, updates: Partial<CalendarEvent>) => {
    try {
      const updateData: any = { ...updates };
      let shouldSyncReport = false;
      let syncLinkedReport: null | (() => Promise<void>) = null;

      // Convert Date to Timestamp if date is being updated
      if (updates.date && updates.date instanceof Date) {
        updateData.date = Timestamp.fromDate(updates.date);
      }

      if (updates.noteAddedAt && updates.noteAddedAt instanceof Date) {
        updateData.noteAddedAt = Timestamp.fromDate(updates.noteAddedAt);
      }

      if (updates.note !== undefined && !updates.note.trim()) {
        updateData.note = '';
        updateData.noteAuthorName = '';
        updateData.noteAddedAt = null;
      }

      // 1. Fetch current document to check status change
      const eventRef = doc(db, "events", eventId);
      const eventSnap = await getDoc(eventRef);

      if (eventSnap.exists()) {
        const currentEvent = eventSnap.data() as CalendarEvent;
        const toDateSafe = (value: any): Date => {
          if (value instanceof Date) return value;
          if (value?.toDate && typeof value.toDate === 'function') return value.toDate();
          return new Date(value);
        };

        const effectiveTitle = updates.title ?? currentEvent.title;
        const effectiveAssigneeId = updates.assigneeId !== undefined ? updates.assigneeId : currentEvent.assigneeId;
        const effectiveCampaignType = updates.campaignType ?? currentEvent.campaignType ?? 'Yeni Kampanya';
        const effectiveRequiresReport = updates.requiresReport !== undefined ? updates.requiresReport : currentEvent.requiresReport;
        const effectiveDate = updates.date instanceof Date ? updates.date : toDateSafe(currentEvent.date);
        const shouldHaveReport = effectiveCampaignType !== 'Kampanya Hatırlatması' && effectiveRequiresReport !== false;

        syncLinkedReport = async () => {
          const reportsQuery = query(collection(db, "reports"), where("campaignId", "==", eventId));
          const reportsSnapshot = await getDocs(reportsQuery);

          if (!shouldHaveReport) {
            if (!reportsSnapshot.empty) {
              await Promise.all(reportsSnapshot.docs.map(reportDoc => deleteDoc(reportDoc.ref)));
              console.log(`[REPORT SYNC] Deleted ${reportsSnapshot.size} linked report(s) for campaign ${eventId}`);
            }
            return;
          }

          const calculatedDueDate = calculateReportDueDate(effectiveDate);
          const existingReportDocs = reportsSnapshot.docs;

          if (existingReportDocs.length === 0) {
            await addDoc(collection(db, "reports"), {
              title: `${effectiveTitle} - Rapor`,
              campaignId: eventId,
              campaignTitle: effectiveTitle,
              assigneeId: effectiveAssigneeId || null,
              dueDate: Timestamp.fromDate(calculatedDueDate),
              status: 'pending',
              createdAt: Timestamp.now(),
              isAutoGenerated: true
            });
            console.log(`[REPORT SYNC] Created linked report for campaign ${eventId}`);
            return;
          }

          const [primaryReport, ...duplicates] = existingReportDocs;
          await updateDoc(primaryReport.ref, {
            title: `${effectiveTitle} - Rapor`,
            campaignTitle: effectiveTitle,
            assigneeId: effectiveAssigneeId || null,
            dueDate: Timestamp.fromDate(calculatedDueDate),
            updatedAt: Timestamp.now()
          });

          if (duplicates.length > 0) {
            await Promise.all(duplicates.map(reportDoc => deleteDoc(reportDoc.ref)));
            console.log(`[REPORT SYNC] Removed ${duplicates.length} duplicate linked report(s) for campaign ${eventId}`);
          }
        };

        // Add Updated At
        updateData.updatedAt = Timestamp.now();

        // Check if status changed
        if (updates.status && updates.status !== currentEvent.status) {
          const historyItem = {
            date: Timestamp.now(),
            action: 'status_changed',
            oldStatus: currentEvent.status,
            newStatus: updates.status,
            changedBy: loggedInDeptUser?.username || 'System'
          };
          updateData.history = arrayUnion(historyItem);

          // Add Notification for Status Change (ALL statuses)
          let notifTitle = '';
          let notifMsg = '';
          let notifType: 'info' | 'success' | 'alert' | 'warning' = 'info';

          if (updates.status === 'Tamamlandı') {
            notifTitle = 'Kampanya Tamamlandı';
            notifMsg = `"${currentEvent.title}" kampanyası tamamlandı.`;
            notifType = 'success';

            // Auto-create report for completed campaign (only if requiresReport is true)
            if (currentEvent.requiresReport !== false && currentEvent.campaignType !== 'Kampanya Hatırlatması') {
              try {
                // Check if a report already exists for this campaign
                const existingReportsQuery = query(
                  collection(db, "reports"),
                  where("campaignId", "==", eventId)
                );
                const existingReportsSnapshot = await getDocs(existingReportsQuery);

                if (existingReportsSnapshot.empty) {
                  // No existing report, create one
                  // Use campaign calendar date instead of completion date
                  const reportDueDate = calculateReportDueDate(currentEvent.date);
                  await addDoc(collection(db, "reports"), {
                    title: `${currentEvent.title} Raporu`,
                    campaignId: eventId,
                    campaignTitle: currentEvent.title,
                    assigneeId: currentEvent.assigneeId || null,
                    dueDate: Timestamp.fromDate(reportDueDate),
                    status: 'pending',
                    createdAt: Timestamp.now(),
                    isAutoGenerated: true
                  });
                  console.log(`Auto-created report for campaign: ${currentEvent.title}`);
                } else {
                  console.log(`Report already exists for campaign: ${currentEvent.title}, skipping creation`);
                }
              } catch (reportError) {
                console.error('Auto-report creation failed:', reportError);
              }
            }
          } else if (updates.status === 'İptal Edildi') {
            notifTitle = 'Kampanya İptal Edildi';
            notifMsg = `"${currentEvent.title}" kampanyası iptal edildi.`;
            notifType = 'alert';
          } else if (updates.status === 'Planlandı') {
            notifTitle = 'Kampanya Tekrar Planlandı';
            notifMsg = `"${currentEvent.title}" kampanyası tekrar planlandı statüsüne alındı.`;
            notifType = 'warning';
          } else {
            // Generic fallback for other statuses if any
            notifTitle = 'Kampanya Durumu Değişti';
            notifMsg = `"${currentEvent.title}" kampanyası durumu "${updates.status}" olarak güncellendi.`;
            notifType = 'info';
          }

          if (notifTitle) {
            await addDoc(collection(db, "notifications"), {
              title: notifTitle,
              message: notifMsg,
              date: Timestamp.now(),
              isRead: false,
              type: notifType
            });
          }
        }

        // Check if assignee changed (Send Email to New Assignee via mailto)
        if (updates.assigneeId && updates.assigneeId !== currentEvent.assigneeId) {
          const newAssignee = users.find(u => u.id === updates.assigneeId);

          if (newAssignee) {
            // 1. Add Notification
            await addDoc(collection(db, "notifications"), {
              title: 'Görev Size Atandı (Devir)',
              message: `"${currentEvent.title}" görevi size devredildi/atandı.`,
              date: Timestamp.now(),
              isRead: false,
              type: 'email'
            });

            // 2. Add Log
            await addDoc(collection(db, "logs"), {
              message: `"${currentEvent.title}" görevi ${newAssignee.name} kişisine devredildi.`,
              timestamp: Timestamp.now()
            });

            // 3. Open mailto for task reassignment
            const oldAssignee = users.find(u => u.id === currentEvent.assigneeId);
            const oldAssigneeName = oldAssignee ? oldAssignee.name : 'Bilinmeyen Kullanıcı';

            let emailMessage = `"${currentEvent.title}" kampanyası için görevlendirildiniz (Görev Devri).\n\n`;
            emailMessage += `Görevi Devreden: ${oldAssigneeName}\n`;
            emailMessage += `Tarih: ${format(updates.date instanceof Date ? updates.date : (updates.date ? (updates.date as any).toDate() : (currentEvent.date as any).toDate()), 'd MMMM yyyy', { locale: tr })}\n`;
            emailMessage += `Aciliyet: ${URGENCY_CONFIGS[updates.urgency || currentEvent.urgency].label}`;

            const diff = updates.difficulty || currentEvent.difficulty;
            if (diff) emailMessage += `\nZorluk Seviyesi: ${DIFFICULTY_CONFIGS[diff].label}`;

            const desc = updates.description || currentEvent.description;
            if (desc) emailMessage += `\n\nAçıklama:\n${stripHtml(desc)}`;

            const deptId = updates.departmentId || currentEvent.departmentId;
            if (deptId) {
              const dept = departments.find(d => d.id === deptId);
              if (dept) emailMessage += `\n\nTalep Eden Birim: ${dept.name}`;
            }

            const footerIdText = `Ref ID: #${eventId.substring(0, 6).toUpperCase()}`;
            const effectiveUrgency = updates.urgency || currentEvent.urgency;
            const isVeryHigh = effectiveUrgency === 'Very High';
            const subjectPrefix = isVeryHigh ? 'ACİL: ' : '';

            const subject = encodeURIComponent(`${subjectPrefix}${currentEvent.title} - Görev Ataması (Güncelleme)`);
            const body = encodeURIComponent(`Merhaba ${newAssignee.name},\n\n${emailMessage}\n\n----------------\n${footerIdText}`);
            window.location.href = `mailto:${newAssignee.email}?cc=kampanyayonetimi@vakifbank.com.tr&subject=${subject}&body=${body}`;

            addToast('Mail istemcisi açılıyor...', 'info');
          }
        }

        shouldSyncReport =
          updates.requiresReport !== undefined ||
          updates.campaignType !== undefined ||
          updates.date !== undefined ||
          updates.title !== undefined ||
          updates.assigneeId !== undefined;

      }

      await setDoc(doc(db, "events", eventId), updateData, { merge: true });

      if (shouldSyncReport && syncLinkedReport) {
        await syncLinkedReport();
      }

      addToast('Kampanya güncellendi.', 'success');

      // Do NOT close the modal here to allow seeing the status change
      // setViewEventId(null); 

      // Log the edit
      await addDoc(collection(db, "logs"), {
        message: `Kampanya güncellendi: ${updates.title || 'Başlık değiştirilmedi'} (ID: ${eventId.substring(0, 6).toUpperCase()})`,
        timestamp: Timestamp.now()
      });
    } catch (e) {
      console.error('Edit error:', e);
      addToast('Güncelleme hatası.', 'info');
    }
  };

  const handleEventDrop = async (event: CalendarEvent, newDate: Date, ctrlKey: boolean = false) => {
    if (!isDesigner) return;

    // If dropped on the same day without Ctrl, do nothing
    if (isSameDay(event.date, newDate) && !ctrlKey) return;

    try {
      if (ctrlKey) {
        const shouldCopy = confirm('Bu kampanyayı yeni tarihe kopyalamak istiyor musunuz?');
        if (!shouldCopy) return;

        const copyAsReminder = confirm('Kampanya Hatırlatması olarak kopyalamak için "Tamam", Yeni Kampanya olarak kopyalamak için "İptal" seçin.');
        const selectedCampaignType: CampaignType = copyAsReminder ? 'Kampanya Hatırlatması' : 'Yeni Kampanya';

        // COPY: Create a new campaign with the same data but new date
        addToast('Kampanya kopyalanıyor...', 'info');

        // Extract only the fields we want to copy (exclude IDs, dates that need conversion, report data)
        const {
          id,
          createdAt,
          updatedAt,
          history,
          date,
          reportStatus,
          reportDueDate,
          reportCompletedAt,
          reportCompletedBy,
          ...eventData
        } = event;

        // Remove undefined values - Firestore doesn't accept undefined
        const cleanEventData = Object.fromEntries(
          Object.entries(eventData).filter(([_, value]) => value !== undefined)
        );

        const effectiveRequiresReport = selectedCampaignType === 'Kampanya Hatırlatması'
          ? false
          : (event.requiresReport !== false);

        await addDoc(collection(db, "events"), {
          ...cleanEventData,
          date: Timestamp.fromDate(newDate),
          campaignType: selectedCampaignType,
          requiresReport: effectiveRequiresReport,
          status: 'Planlandı', // Reset status for copied campaign
          createdAt: Timestamp.now(),
          history: [{
            date: Timestamp.now(),
            action: `Kopyalandı (${format(event.date, 'd MMM', { locale: tr })} → ${format(newDate, 'd MMM', { locale: tr })})`
          }]
        });
        addToast('Kampanya kopyalandı!', 'success');
      } else {
        // MOVE: Update existing campaign date
        addToast('Tarih güncelleniyor...', 'info');
        await handleEditEvent(event.id, { date: newDate });
      }
    } catch (error) {
      console.error('Drag drop update failed:', error);
      addToast('İşlem başarısız.', 'info');
    }
  };

  const handleBulkAddEvents = async (newEvents: Partial<CalendarEvent>[]) => {
    try {
      const batch = writeBatch(db);

      newEvents.forEach(evt => {
        const docRef = doc(collection(db, "events"));
        // Ensure date is a proper Date object or Timestamp
        const eventData = {
          ...evt,
          date: evt.date instanceof Date ? Timestamp.fromDate(evt.date) : evt.date,
        };
        batch.set(docRef, eventData);
      });

      await batch.commit();
      addToast(`${newEvents.length} kampanya başarıyla eklendi.`, 'success');

      // Log generic bulk action
      await addDoc(collection(db, "logs"), {
        message: `${newEvents.length} adet kampanya toplu olarak içe aktarıldı via CSV.`,
        timestamp: Timestamp.now()
      });

    } catch (e) {
      console.error(e);
      addToast('Toplu ekleme sırasında hata oluştu.', 'info');
      throw e; // Propagate error to caller
    }
  };

  const handleDeleteAllEvents = async () => {
    try {
      events.forEach(async (ev) => {
        await deleteDoc(doc(db, "events", ev.id));
      });
      addToast('Tüm kampanyalar siliniyor...', 'info');
    } catch (e) {
      addToast('Toplu silme hatası.', 'info');
    }
  };

  const openAddModal = (date?: Date) => {
    if (isDesigner) {
      setSelectedDate(date || new Date());
      setIsAddModalOpen(true);
      return;
    }
    if (loggedInDeptUser?.isBusinessUnit) {
      if (!requestSubmissionEnabled) {
        return;
      }
      setRequestModalDate(date || new Date());
      setIsRequestModalOpen(true);
      return;
    }
  };

  const getEventsForDay = (date: Date) => {
    return filteredEvents.filter(event => isSameDay(event.date, date));
  };

  const clearFilters = () => {
    setSearchQuery('');
    setFilterAssignee('');
    setFilterUrgency('');
    setFilterStatus('');
  };

  const hasActiveFilters = searchQuery || filterAssignee || filterUrgency || filterStatus;

  const handleDashboardRefresh = async () => {
    setRefreshKey(prev => prev + 1);
    // Short delay to allow effects to re-trigger and loading state to appear
    await new Promise(resolve => setTimeout(resolve, 500));
  };

  // Handle marking a report as done (uses reports collection)
  const handleMarkReportDone = async (reportId: string) => {
    const report = reports.find(r => r.id === reportId);
    if (!report) return;

    const reporterId = loggedInDeptUser?.id || auth.currentUser?.uid || 'unknown';

    try {
      await updateDoc(doc(db, "reports", reportId), {
        status: 'done',
        completedAt: Timestamp.now(),
        completedBy: reporterId,
        updatedAt: Timestamp.now()
      });

      addToast('Rapor tamamlandı olarak işaretlendi.', 'success');

      // Log the action
      await addDoc(collection(db, "logs"), {
        message: `Rapor tamamlandı: ${report.title} (ID: ${reportId.substring(0, 6).toUpperCase()})`,
        timestamp: Timestamp.now()
      });
    } catch (e) {
      console.error('Report mark done error:', e);
      addToast('Rapor güncelleme hatası.', 'info');
    }
  };

  // Handle updating report due date (drag-drop) - uses reports collection
  const handleUpdateReportDueDate = async (reportId: string, newDate: Date) => {
    if (!isDesigner) return;

    const report = reports.find(r => r.id === reportId);
    if (!report) return;

    try {
      await updateDoc(doc(db, "reports", reportId), {
        dueDate: Timestamp.fromDate(newDate),
        updatedAt: Timestamp.now()
      });

      addToast(`Rapor tarihi güncellendi: ${format(newDate, 'd MMMM yyyy', { locale: tr })}`, 'success');

      // Log the action
      await addDoc(collection(db, "logs"), {
        message: `Rapor tarihi değiştirildi: ${report.title} -> ${format(newDate, 'd MMMM yyyy', { locale: tr })}`,
        timestamp: Timestamp.now()
      });
    } catch (e) {
      console.error('Report date update error:', e);
      addToast('Rapor tarihi güncelleme hatası.', 'info');
    }
  };

  // Handle day click in report calendar (opens AddReportModal)
  const handleReportDayClick = (date: Date) => {
    if (!isDesigner) return;
    setSelectedReportDate(date);
    setIsAddReportModalOpen(true);
  };

  // Handle adding a new report
  const handleAddReport = async (title: string, assigneeId: string | undefined, dueDate: Date) => {
    try {
      await addDoc(collection(db, "reports"), {
        title,
        assigneeId: assigneeId || null,
        dueDate: Timestamp.fromDate(dueDate),
        status: 'pending',
        createdAt: Timestamp.now(),
        isAutoGenerated: false
      });

      addToast(`Rapor "${title}" başarıyla eklendi.`, 'success');

      // Log the action
      await addDoc(collection(db, "logs"), {
        message: `Yeni rapor eklendi: ${title}`,
        timestamp: Timestamp.now()
      });
    } catch (e) {
      console.error('Add report error:', e);
      addToast('Rapor ekleme hatası.', 'info');
    }
  };

  // Handle report click - opens details modal
  const handleReportClick = (report: Report) => {
    setSelectedReport(report);
  };

  // Handle updating a report
  const handleUpdateReport = async (reportId: string, updates: Partial<Report>) => {
    try {
      const updateData: any = { updatedAt: Timestamp.now() };
      if (updates.title !== undefined) updateData.title = updates.title;
      if (updates.assigneeId !== undefined) updateData.assigneeId = updates.assigneeId || null;
      if (updates.dueDate !== undefined) updateData.dueDate = Timestamp.fromDate(updates.dueDate);

      await updateDoc(doc(db, "reports", reportId), updateData);

      addToast('Rapor güncellendi.', 'success');

      // Refresh selected report if it matches
      if (selectedReport?.id === reportId) {
        const updatedReport = reports.find(r => r.id === reportId);
        if (updatedReport) {
          setSelectedReport({ ...updatedReport, ...updates });
        }
      }
    } catch (e) {
      console.error('Report update error:', e);
      addToast('Rapor güncelleme hatası.', 'info');
    }
  };

  // Handle deleting a report
  const handleDeleteReport = async (reportId: string) => {
    try {
      console.log('[DELETE REPORT] Starting deletion for report:', reportId);

      // Find the report before deletion for logging
      const reportToDelete = reports.find(r => r.id === reportId);
      console.log('[DELETE REPORT] Report details:', {
        id: reportId,
        title: reportToDelete?.title,
        status: reportToDelete?.status,
        campaignId: reportToDelete?.campaignId
      });

      // Delete from Firestore
      await deleteDoc(doc(db, "reports", reportId));
      console.log('[DELETE REPORT] Successfully deleted from Firestore');

      // IMPORTANT: If this report was linked to a campaign, mark that campaign
      // as "no longer needs report" to prevent auto-recreation on page refresh
      if (reportToDelete?.campaignId) {
        try {
          const campaignRef = doc(db, "events", reportToDelete.campaignId);
          await updateDoc(campaignRef, {
            requiresReport: false,
            reportDeletedAt: Timestamp.now(),
            reportDeletedBy: auth.currentUser?.uid || loggedInDeptUser?.id || 'unknown'
          });
          console.log('[DELETE REPORT] Marked campaign as not requiring report:', reportToDelete.campaignId);
        } catch (campaignError) {
          console.warn('[DELETE REPORT] Could not update campaign (may not exist):', campaignError);
        }
      }

      // Clear the selected report to close the modal
      setSelectedReport(null);

      addToast('Rapor silindi.', 'success');

      // Log the action
      await addDoc(collection(db, "logs"), {
        message: `Rapor silindi: "${reportToDelete?.title || 'Bilinmeyen'}" (ID: ${reportId.substring(0, 6).toUpperCase()})`,
        timestamp: Timestamp.now(),
        type: 'report_delete',
        userId: auth.currentUser?.uid || loggedInDeptUser?.id,
        reportId: reportId,
        campaignId: reportToDelete?.campaignId
      });

      console.log('[DELETE REPORT] Deletion complete');
    } catch (e) {
      console.error('[DELETE REPORT] Error deleting report:', e);
      console.error('[DELETE REPORT] Error details:', {
        message: e instanceof Error ? e.message : 'Unknown error',
        code: (e as any).code,
        reportId: reportId
      });
      addToast(`Rapor silme hatası: ${e instanceof Error ? e.message : 'Bilinmeyen hata'}`, 'info');
    }
  };

  // Handle updating report status
  const handleUpdateReportStatus = async (reportId: string, status: 'pending' | 'done' | 'cancelled') => {
    const report = reports.find(r => r.id === reportId);
    if (!report) return;

    const reporterId = loggedInDeptUser?.id || auth.currentUser?.uid || 'unknown';

    try {
      const updateData: any = {
        status,
        updatedAt: Timestamp.now()
      };

      // If marking as done, add completion info
      if (status === 'done') {
        updateData.completedAt = Timestamp.now();
        updateData.completedBy = reporterId;
      }

      // If reverting from done, clear completion info
      if (status !== 'done') {
        updateData.completedAt = null;
        updateData.completedBy = null;
      }

      await updateDoc(doc(db, "reports", reportId), updateData);

      const statusLabels: Record<string, string> = {
        'pending': 'Bekliyor',
        'done': 'Tamamlandı',
        'cancelled': 'İptal Edildi'
      };

      addToast(`Rapor durumu "${statusLabels[status]}" olarak güncellendi.`, 'success');

      // Log the action
      await addDoc(collection(db, "logs"), {
        message: `Rapor durumu değişti: ${report.title} -> ${statusLabels[status]}`,
        timestamp: Timestamp.now()
      });
    } catch (e) {
      console.error('Report status update error:', e);
      addToast('Rapor durumu güncelleme hatası.', 'info');
    }
  };

  // === ANALYTICS HANDLERS ===

  // Handle adding analytics task
  const handleAddAnalyticsTask = async (title: string, urgency: UrgencyLevel, date: Date, assigneeId?: string, notes?: string, difficulty?: 'Kolay' | 'Orta' | 'Zor') => {
    try {
      const taskDoc = await addDoc(collection(db, "analyticsTasks"), {
        title,
        urgency,
        difficulty: difficulty || 'Orta',
        date: Timestamp.fromDate(date),
        assigneeId: assigneeId || null,
        notes: notes || null,
        status: 'Planlandı',
        createdAt: Timestamp.now()
      });

      addToast('Analitik iş eklendi.', 'success');

      // Log the action
      await addDoc(collection(db, "logs"), {
        message: `Analitik iş eklendi: ${title}`,
        timestamp: Timestamp.now()
      });

      // Send email notification if assignee has email
      if (assigneeId) {
        const assignee = analyticsUsers.find(u => u.id === assigneeId);
        if (assignee?.email) {
          const subject = `${title} - Analitik Görev Ataması`;
          const body = `"${title}" adlı analitik görevi size verildi.\n\nTarih: ${format(date, 'd MMMM yyyy', { locale: tr })}\nAciliyet: ${URGENCY_CONFIGS[urgency].label}${notes ? `\n\nNotlar: ${notes}` : ''}`;
          window.location.href = `mailto:${assignee.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        }
      }
    } catch (e) {
      console.error('Analytics task add error:', e);
      addToast('Analitik iş ekleme hatası.', 'info');
    }
  };

  // Handle deleting analytics task
  const handleDeleteAnalyticsTask = async (taskId: string) => {
    try {
      await deleteDoc(doc(db, "analyticsTasks", taskId));
      setSelectedAnalyticsTask(null);
      addToast('Analitik iş silindi.', 'success');

      await addDoc(collection(db, "logs"), {
        message: `Analitik iş silindi (ID: ${taskId.substring(0, 6).toUpperCase()})`,
        timestamp: Timestamp.now()
      });
    } catch (e) {
      console.error('Analytics task delete error:', e);
      addToast('Analitik iş silme hatası.', 'info');
    }
  };

  // Handle updating analytics task
  const handleUpdateAnalyticsTask = async (taskId: string, updates: Partial<AnalyticsTask>) => {
    try {
      const updateData: any = { updatedAt: Timestamp.now() };
      if (updates.title !== undefined) updateData.title = updates.title;
      if (updates.urgency !== undefined) updateData.urgency = updates.urgency;
      if (updates.assigneeId !== undefined) updateData.assigneeId = updates.assigneeId || null;
      if (updates.notes !== undefined) updateData.notes = updates.notes || null;
      if (updates.date !== undefined) updateData.date = Timestamp.fromDate(updates.date);

      await updateDoc(doc(db, "analyticsTasks", taskId), updateData);
      addToast('Analitik iş güncellendi.', 'success');

      // Refresh selected task if it matches
      if (selectedAnalyticsTask?.id === taskId) {
        const updatedTask = analyticsTasks.find(t => t.id === taskId);
        if (updatedTask) {
          setSelectedAnalyticsTask({ ...updatedTask, ...updates });
        }
      }
    } catch (e) {
      console.error('Analytics task update error:', e);
      addToast('Analitik iş güncelleme hatası.', 'info');
    }
  };

  // Handle updating analytics task status
  const handleUpdateAnalyticsTaskStatus = async (taskId: string, status: CampaignStatus) => {
    try {
      const updateData: any = {
        status,
        updatedAt: Timestamp.now()
      };

      await updateDoc(doc(db, "analyticsTasks", taskId), updateData);

      const statusLabels = {
        'Planlandı': 'Planlandı',
        'Tamamlandı': 'Tamamlandı',
        'İptal Edildi': 'İptal Edildi'
      };

      addToast(`İş durumu "${statusLabels[status]}" olarak güncellendi.`, 'success');

      // Log the action
      const task = analyticsTasks.find(t => t.id === taskId);
      if (task) {
        await addDoc(collection(db, "logs"), {
          message: `Analitik iş durumu değişti: ${task.title} -> ${statusLabels[status]}`,
          timestamp: Timestamp.now()
        });
      }

      // Refresh selected task
      if (selectedAnalyticsTask?.id === taskId) {
        setSelectedAnalyticsTask({ ...selectedAnalyticsTask, status });
      }
    } catch (e) {
      console.error('Analytics task status update error:', e);
      addToast('İş durumu güncelleme hatası.', 'info');
    }
  };

  // Handle updating analytics task date (drag-and-drop)
  const handleUpdateAnalyticsTaskDate = async (taskId: string, newDate: Date) => {
    try {
      await updateDoc(doc(db, "analyticsTasks", taskId), {
        date: Timestamp.fromDate(newDate),
        updatedAt: Timestamp.now()
      });
      addToast(`İş tarihi ${format(newDate, 'd MMMM yyyy', { locale: tr })} olarak güncellendi.`, 'success');
    } catch (e) {
      console.error('Analytics task date update error:', e);
      addToast('Tarih güncelleme hatası.', 'info');
    }
  };

  // Handle analytics task click
  const handleAnalyticsTaskClick = (task: AnalyticsTask) => {
    setSelectedAnalyticsTask(task);
  };

  // Handle analytics day click
  const handleAnalyticsDayClick = (date: Date) => {
    if (isDesigner) {
      setSelectedAnalyticsDate(date);
      setIsAddAnalyticsModalOpen(true);
    }
  };

  // Calculate pending counts based on user role
  const myPendingCampaigns = useMemo(() => {
    // Designer sees all pending campaigns, Kampanya Yapan sees only their own
    const allPending = events.filter(e => e.status === 'Planlandı');
    if (isDesigner) return allPending;
    if (isKampanyaYapan && connectedPersonnelUser) {
      return allPending.filter(e => e.assigneeId === connectedPersonnelUser.id);
    }
    return allPending;
  }, [events, isDesigner, isKampanyaYapan, connectedPersonnelUser]);

  const myPendingReports = useMemo(() => {
    // Designer sees all pending reports, Kampanya Yapan sees only their own
    const allPending = reports.filter(r => r.status === 'pending');
    if (isDesigner) return allPending;
    if (isKampanyaYapan && connectedPersonnelUser) {
      return allPending.filter(r => r.assigneeId === connectedPersonnelUser.id);
    }
    return allPending;
  }, [reports, isDesigner, isKampanyaYapan, connectedPersonnelUser]);

  // Connected Analytics User (for role-based filtering)
  const connectedAnalyticsUser = useMemo(() => {
    if (!loggedInDeptUser || !loggedInDeptUser.email) return null;
    return analyticsUsers.find(u => u.email?.trim().toLowerCase() === loggedInDeptUser.email?.trim().toLowerCase());
  }, [loggedInDeptUser, analyticsUsers]);

  const myPendingAnalyticsTasks = useMemo(() => {
    // Designer sees all pending tasks, Analitik sees only their own
    const allPending = analyticsTasks.filter(t => t.status === 'Planlandı');
    if (isDesigner) return allPending;
    if (isAnalitik && connectedAnalyticsUser) {
      return allPending.filter(t => t.assigneeId === connectedAnalyticsUser.id);
    }
    return allPending;
  }, [analyticsTasks, isDesigner, isAnalitik, connectedAnalyticsUser]);

  // Check if user is ONLY Analitik (not Designer) - they can only see Analytics tab
  const isOnlyAnalitik = isAnalitik && !isDesigner && !isKampanyaYapan;

  // Check if user can see Report tab (Analitik-only users cannot)
  const canSeeReportTab = (isDesigner || isKampanyaYapan || !!connectedPersonnelUser) && !isOnlyAnalitik;

  // Check if user can see Analytics tab (only Super Admin or Analitik role)
  // Super Admin = isDesigner but NOT a departmentUser
  const isSuperAdmin = isDesigner && !loggedInDeptUser;
  const canSeeAnalyticsTab = isSuperAdmin || isAnalitik;

  // Check if user can see Kampanya tab (everyone except only-Analitik users)
  const canSeeKampanyaTab = !isOnlyAnalitik;

  // Check if user can see Settings tab (ONLY Super Admin)
  // Super Admin = Firebase Auth admin kullanıcısı (departmentUser değil)
  const canSeeSettingsTab = isSuperAdmin;

  const mobileCampaignEvents = useMemo(() => {
    const monthEvents = filteredEvents.filter(e => isSameMonth(e.date, currentDate));

    if (isDesigner || isKampanyaYapan) return monthEvents;
    if (connectedPersonnelUser) {
      return monthEvents.filter(e => e.assigneeId === connectedPersonnelUser.id || e.departmentId === currentDepartmentId);
    }
    if (currentDepartmentId) {
      return monthEvents.filter(e => e.departmentId === currentDepartmentId);
    }
    return [];
  }, [filteredEvents, currentDate, isDesigner, isKampanyaYapan, connectedPersonnelUser, currentDepartmentId]);

  const mobileReports = useMemo(() => {
    const monthReports = filteredReports.filter(r => isSameMonth(r.dueDate, currentDate));

    if (isDesigner) return monthReports;
    if (isKampanyaYapan && connectedPersonnelUser) {
      return monthReports.filter(r => r.assigneeId === connectedPersonnelUser.id);
    }
    if (connectedPersonnelUser) {
      return monthReports.filter(r => r.assigneeId === connectedPersonnelUser.id);
    }
    return [];
  }, [filteredReports, currentDate, isDesigner, isKampanyaYapan, connectedPersonnelUser]);

  const mobileAnalyticsTasks = useMemo(() => {
    const monthTasks = analyticsTasks.filter(task => isSameMonth(task.date, currentDate));

    if (isDesigner) return monthTasks;
    if (isAnalitik && connectedAnalyticsUser) {
      return monthTasks.filter(task => task.assigneeId === connectedAnalyticsUser.id);
    }
    return [];
  }, [analyticsTasks, currentDate, isDesigner, isAnalitik, connectedAnalyticsUser]);

  const openMobileReport = (reportId: string) => {
    const report = reports.find(r => r.id === reportId);
    if (report) setSelectedReport(report);
  };

  const openMobileAnalyticsTask = (taskId: string) => {
    const task = analyticsTasks.find(t => t.id === taskId);
    if (task) setSelectedAnalyticsTask(task);
  };

  useEffect(() => {
    if (mobileTab === 'kampanya' && !canSeeKampanyaTab) {
      setMobileTab(canSeeReportTab ? 'rapor' : canSeeAnalyticsTab ? 'analitik' : 'islerim');
      return;
    }
    if (mobileTab === 'rapor' && !canSeeReportTab) {
      setMobileTab(canSeeKampanyaTab ? 'kampanya' : canSeeAnalyticsTab ? 'analitik' : 'islerim');
      return;
    }
    if (mobileTab === 'analitik' && !canSeeAnalyticsTab) {
      setMobileTab(canSeeKampanyaTab ? 'kampanya' : canSeeReportTab ? 'rapor' : 'islerim');
    }
  }, [mobileTab, canSeeKampanyaTab, canSeeReportTab, canSeeAnalyticsTab]);

  // Auto-switch to analytics tab for Analitik-only users
  useEffect(() => {
    if (isOnlyAnalitik && activeTab !== 'analitik') {
      setActiveTab('analitik');
    }
  }, [isOnlyAnalitik, activeTab]);

  // Render Loading State if Initial Data Fetching
  if (isEventsLoading || isUsersLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FE] flex-col gap-4">
        <Loader2 size={40} className="text-violet-600 animate-spin" />
        <p className="text-gray-500 font-medium animate-pulse">Veritabanına bağlanılıyor...</p>
      </div>
    );
  }

  if (isPhoneOnly) {
    return (
      <div className="min-h-screen text-gray-800 dark:text-gray-100 transition-colors duration-300 relative">
        <BackgroundTheme activeTheme={backgroundTheme} customImage={customThemeImage} />
        <div className="relative z-10">
          <MobileShell
            currentDate={currentDate}
            onPrevPeriod={prevMobileMonth}
            onNextPeriod={nextMobileMonth}
            onResetToToday={resetToToday}
            events={mobileCampaignEvents}
            reports={mobileReports}
            analyticsTasks={mobileAnalyticsTasks}
            users={users}
            analyticsUsers={analyticsUsers}
            activeTab={mobileTab}
            onChangeTab={setMobileTab}
            canSeeKampanyaTab={canSeeKampanyaTab}
            canSeeReportTab={canSeeReportTab}
            canSeeAnalyticsTab={canSeeAnalyticsTab}
            canAddCampaign={isDesigner}
            canAddAnalytics={isDesigner}
            onOpenEvent={(eventId) => setViewEventId(eventId)}
            onOpenReport={openMobileReport}
            onOpenAnalyticsTask={openMobileAnalyticsTask}
            onOpenAddCampaign={() => openAddModal()}
            onOpenAddAnalytics={() => {
              setSelectedAnalyticsDate(new Date());
              setIsAddAnalyticsModalOpen(true);
            }}
            onOpenMyTasks={() => setIsMyTasksOpen(true)}
            onOpenLogin={() => setIsDeptLoginOpen(true)}
            isLoggedIn={!!loggedInDeptUser || isDesigner}
          />
        </div>

        <AddEventModal
          isOpen={isAddModalOpen}
          onClose={() => {
            setIsAddModalOpen(false);
            setConvertingRequest(null);
          }}
          onAdd={handleAddEvent}
          initialDate={selectedDate}
          initialData={convertingRequest ? {
            title: convertingRequest.title,
            urgency: convertingRequest.urgency,
            description: convertingRequest.description,
            departmentId: convertingRequest.departmentId
          } : undefined}
          users={users}
          departments={departments}
          events={events}
          isKampanyaYapan={isKampanyaYapan}
        />

        <AddAnalyticsTaskModal
          isOpen={isAddAnalyticsModalOpen}
          onClose={() => {
            setIsAddAnalyticsModalOpen(false);
            setSelectedAnalyticsDate(undefined);
          }}
          onAdd={handleAddAnalyticsTask}
          initialDate={selectedAnalyticsDate}
          users={analyticsUsers}
          tasks={analyticsTasks}
        />

        <EventDetailsModal
          event={viewEvent}
          onClose={() => setViewEventId(null)}
          assignee={users.find(u => u.id === viewEvent?.assigneeId)}
          departments={departments}
          users={users}
          isDesigner={isDesigner}
          isKampanyaYapan={isKampanyaYapan}
          onEdit={handleEditEvent}
          onDelete={handleDeleteEvent}
          monthlyBadges={monthlyBadges}
        />

        <ReportDetailsModal
          isOpen={!!selectedReport}
          report={selectedReport}
          users={users}
          onClose={() => setSelectedReport(null)}
          onUpdate={handleUpdateReport}
          onDelete={handleDeleteReport}
          onMarkDone={handleMarkReportDone}
          onUpdateStatus={handleUpdateReportStatus}
          canEdit={isDesigner || isKampanyaYapan}
        />

        <AnalyticsTaskDetailsModal
          isOpen={!!selectedAnalyticsTask}
          task={selectedAnalyticsTask}
          users={analyticsUsers}
          onClose={() => setSelectedAnalyticsTask(null)}
          onUpdate={handleUpdateAnalyticsTask}
          onDelete={handleDeleteAnalyticsTask}
          onUpdateStatus={handleUpdateAnalyticsTaskStatus}
          canEdit={isDesigner}
          canChangeStatus={isDesigner || isAnalitik}
        />

        <DepartmentLoginModal
          isOpen={isDeptLoginOpen}
          onClose={() => setIsDeptLoginOpen(false)}
          departmentUsers={departmentUsers}
          departments={departments}
          onLogin={handleDepartmentLogin}
        />

        <MyTasksModal
          isOpen={isMyTasksOpen}
          onClose={() => setIsMyTasksOpen(false)}
          tasks={events.filter(e => {
            if (!loggedInDeptUser) return false;
            if (e.assigneeId === loggedInDeptUser.id) return true;
            if (connectedPersonnelUser && e.assigneeId === connectedPersonnelUser.id) return true;
            return false;
          })}
          onUpdateStatus={(id, status) => handleEditEvent(id, { status })}
        />

        <ToastContainer toasts={toasts} removeToast={removeToast} />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 text-gray-800 dark:text-gray-100 transition-colors duration-300 relative">
      {/* Background Theme Overlay */}
      <BackgroundTheme activeTheme={backgroundTheme} customImage={customThemeImage} />

      <div className="max-w-[1400px] mx-auto flex flex-col h-[calc(100vh-4rem)] relative z-10">

        {/* Header Section */}
        <div className="mb-6 flex flex-col xl:flex-row xl:items-start justify-between gap-4">

          {/* Left Column: Title & Primary Actions */}
          <div className="flex flex-col gap-3 shrink-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-black tracking-tight flex items-center gap-2 whitespace-nowrap">
                {isDesigner ? (
                  <span className="bg-gradient-to-r from-violet-700 via-indigo-700 to-violet-500 bg-clip-text text-transparent drop-shadow-sm">
                    Kampanya/Analitik Yönetim Takvimi
                  </span>
                ) : isKampanyaYapan ? (
                  <span className="bg-gradient-to-r from-violet-700 via-indigo-700 to-violet-500 bg-clip-text text-transparent drop-shadow-sm">
                    Kampanya Yapan Görünümü
                  </span>
                ) : (
                  <span className="bg-gradient-to-r from-violet-700 via-indigo-700 to-violet-500 bg-clip-text text-transparent drop-shadow-sm font-black">
                    {`Takvim: ${(currentDepartmentName || 'Misafir Görünümü').toLocaleUpperCase('tr-TR')}`}
                  </span>
                )}
              </h1>

              {/* Badges */}
              {!isDesigner && !isKampanyaYapan && (
                <span className="text-xs bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400 px-2 py-0.5 rounded-md font-normal lowercase whitespace-nowrap">salt okunur</span>
              )}
              {isKampanyaYapan && (
                <span className="text-xs bg-blue-200 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-0.5 rounded-md font-normal lowercase whitespace-nowrap">görüntüleme</span>
              )}

              {/* Action Buttons Moved Out of H1 */}
              <div className="flex items-center gap-2">
                {isDesigner && (
                  <button
                    onClick={() => setIsIncomingRequestsModalOpen(true)}
                    className="relative text-xs bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 dark:border dark:border-violet-700/50 px-3 py-1.5 rounded-lg hover:bg-violet-200 dark:hover:bg-violet-900/50 transition-colors flex items-center gap-2 font-medium whitespace-nowrap"
                  >
                    <ClipboardList size={14} />
                    <span className="hidden sm:inline">İş Talepleri</span>
                    {requests.filter(r => r.status === 'pending').length > 0 && (
                      <span className="bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full">
                        {requests.filter(r => r.status === 'pending').length}
                      </span>
                    )}
                  </button>
                )}

                {/* {isDesigner && (
                  <button
                    onClick={() => setIsDesignerCampaignsModalOpen(true)}
                    className="relative text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 dark:border dark:border-blue-700/50 px-3 py-1.5 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors flex items-center gap-2 font-medium whitespace-nowrap"
                  >
                    <CheckSquare size={14} />
                    <span className="hidden sm:inline">Kampanyalar</span>
                  </button>
                )} */}

                {isDesigner && users.length === 0 && events.length === 0 && (
                  <button
                    onClick={seedDatabase}
                    className="text-[10px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 dark:border dark:border-green-700/50 px-2 py-1 rounded flex items-center gap-1 hover:bg-green-200 dark:hover:bg-green-900/50 whitespace-nowrap"
                    title="Veritabanı boş görünüyor. Örnek verileri yüklemek için tıkla."
                  >
                    <Database size={12} /> Verileri Yükle
                  </button>
                )}

                {(isDesigner || isKampanyaYapan) && !loggedInDeptUser && (
                  <button
                    onClick={handleDepartmentLogout}
                    className="text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 dark:border dark:border-red-700/50 px-3 py-1.5 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors flex items-center gap-1 font-medium whitespace-nowrap"
                    title="Çıkış Yap"
                  >
                    <LogOut size={14} /> Çıkış
                  </button>
                )}
              </div>
            </div>

            {/* Sub-header: Login Info */}
            {loggedInDeptUser && (
              <div className="flex items-center flex-wrap gap-2 text-xs text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-transparent px-2 py-1 rounded w-fit border border-transparent dark:border-teal-800/50">
                <LogIn size={12} />
                <span className="font-medium">
                  {currentDepartmentName} <span className="opacity-75">| {loggedInDeptUser.username}</span>
                </span>
                <div className="flex items-center gap-1 ml-2 border-l pl-2 border-teal-200 dark:border-teal-800">
                  <button
                    onClick={() => setIsChangePasswordOpen(true)}
                    className="text-[10px] bg-teal-100 text-teal-700 dark:bg-transparent dark:text-teal-400 dark:border dark:border-teal-700 px-2 py-0.5 rounded hover:bg-teal-200 dark:hover:bg-teal-900/50 flex items-center gap-1 transition-colors whitespace-nowrap"
                    title="Şifre Değiştir"
                  >
                    <Lock size={10} /> Şifre
                  </button>
                  <button
                    onClick={handleDepartmentLogout}
                    className="text-[10px] bg-red-100 text-red-700 dark:bg-transparent dark:text-red-400 dark:border dark:border-red-800 px-2 py-0.5 rounded hover:bg-red-200 dark:hover:bg-red-900/50 flex items-center gap-1 transition-colors whitespace-nowrap"
                  >
                    <LogOut size={10} /> Çıkış
                  </button>
                </div>
              </div>
            )}

            {isSendingEmail && (
              <div className="flex items-center gap-2 text-violet-600 text-xs font-bold animate-pulse">
                <Loader2 size={12} className="animate-spin" />
                E-posta deneniyor...
              </div>
            )}
          </div>

          {/* Right Column: Toolbar */}
          <div className="flex items-center gap-1 bg-white/50 dark:bg-slate-800/50 p-1 rounded-2xl backdrop-blur-sm shadow-sm flex-wrap relative z-20 transition-colors justify-end">
            <ThemeToggle theme={theme} toggleTheme={toggleTheme} />

            {/* Browser Notification Toggle */}
            {notificationsSupported && (
              <button
                onClick={requestNotificationPermission}
                className={`p-1.5 transition-colors rounded-lg shadow-sm border ${notificationsGranted
                  ? 'text-green-600 bg-green-50 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700/50'
                  : notificationPermission === 'denied'
                    ? 'text-red-400 bg-red-50 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700/50 cursor-not-allowed'
                    : 'bg-white border-gray-100 text-gray-500 hover:text-violet-600 hover:bg-violet-50 dark:bg-transparent dark:border-slate-600 dark:text-gray-400 dark:hover:text-violet-300 dark:hover:bg-slate-700'
                  }`}
                title={
                  notificationsGranted
                    ? 'Bildirimler aktif'
                    : notificationPermission === 'denied'
                      ? 'Bildirimler engellendi (tarayıcı ayarlarından izin verin)'
                      : 'Bildirimleri etkinleştir'
                }
                disabled={notificationPermission === 'denied'}
              >
                {notificationsGranted ? (
                  <SmartphoneNfc size={20} />
                ) : (
                  <Smartphone size={20} />
                )}
              </button>
            )}

            {/* View Mode Toggle - Only show for main calendar tab */}
            {activeTab === 'kampanya' && (
              <div className="flex items-center bg-gray-100 dark:bg-slate-700 rounded-lg p-0.5">
                <button
                  onClick={() => setViewMode('month')}
                  className={`px-2 py-1 text-xs font-semibold rounded-md transition-colors ${viewMode === 'month'
                    ? 'bg-white dark:bg-slate-600 text-violet-700 dark:text-violet-300 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                    }`}
                >
                  Ay
                </button>
                <button
                  onClick={() => setViewMode('week')}
                  className={`px-2 py-1 text-xs font-semibold rounded-md transition-colors ${viewMode === 'week'
                    ? 'bg-white dark:bg-slate-600 text-violet-700 dark:text-violet-300 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                    }`}
                >
                  Hafta
                </button>
              </div>
            )}

            <button onClick={resetToToday} className="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 dark:border dark:border-violet-700/50 px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-violet-200 dark:hover:bg-violet-900/50 transition-colors">
              Bugün
            </button>

            <div className="flex items-center gap-1">
              <button onClick={prevPeriod} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-full transition-colors text-gray-600 dark:text-gray-300">
                <ChevronLeft size={20} />
              </button>
              <h2 className="text-lg md:text-xl font-bold min-w-[140px] text-center tabular-nums capitalize text-gray-800 dark:text-gray-100">
                {viewMode === 'week'
                  ? `${format(weekDays[0], 'd')}-${format(weekDays[6], 'd MMMM yyyy', { locale: tr })}`
                  : format(currentDate, 'MMMM yyyy', { locale: tr })}
              </h2>
              <button onClick={nextPeriod} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-full transition-colors text-gray-600 dark:text-gray-300">
                <ChevronRight size={20} />
              </button>
            </div>

            <div className="h-6 w-px bg-gray-300 dark:bg-slate-600 mx-2 hidden md:block"></div>

            <button
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className={`p-1.5 transition-colors rounded-lg shadow-sm border ${isSearchOpen || hasActiveFilters
                ? 'text-violet-600 bg-violet-50 border-violet-100 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-700/50'
                : 'bg-white border-gray-100 text-gray-500 hover:text-violet-600 dark:bg-transparent dark:border-slate-600 dark:text-gray-400 dark:hover:text-violet-300 dark:hover:bg-slate-700'
                }`}
              title="Arama ve Filtrele"
            >
              <Search size={20} />
              {hasActiveFilters && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-violet-500 rounded-full animate-pulse"></span>
              )}
            </button>

            <button
              onClick={handleExportPdf}
              className="p-1.5 text-gray-500 hover:text-pink-600 hover:bg-pink-50 transition-colors bg-white border border-gray-100 rounded-lg shadow-sm dark:bg-transparent dark:border-slate-600 dark:text-gray-400 dark:hover:text-pink-300 dark:hover:bg-pink-900/30"
              title="PDF Olarak İndir"
            >
              <Download size={20} />
            </button>

            {isDesigner && (
              <button
                onClick={() => setIsReportsOpen(true)}
                className="p-1.5 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors bg-white border border-gray-100 rounded-lg shadow-sm dark:bg-transparent dark:border-slate-600 dark:text-gray-400 dark:hover:text-emerald-300 dark:hover:bg-emerald-900/30"
                title="Raporlar ve Dashboard"
              >
                <PieChart size={20} />
              </button>
            )}

            {/* User info moved to left header */}

            {loggedInDeptUser && (
              <button
                onClick={() => {
                  setIsAnnBoardOpen(true);
                  // Mark all announcements as read when opening
                  const allIds = filteredAnnouncements.map(a => a.id);
                  if (allIds.length > 0) {
                    handleMarkAsRead(allIds);
                  }
                }}
                className="p-1.5 text-gray-500 hover:text-violet-600 hover:bg-violet-50 transition-colors bg-white border border-gray-100 rounded-lg shadow-sm relative dark:bg-transparent dark:border-slate-600 dark:text-gray-400 dark:hover:text-violet-300 dark:hover:bg-violet-900/30"
                title="Duyurular"
              >
                <Megaphone size={20} />
                {unreadAnnouncementCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white dark:border-slate-800">
                    {unreadAnnouncementCount}
                  </span>
                )}
              </button>
            )}

            {loggedInDeptUser && (
              <button
                onClick={() => setIsMyTasksOpen(true)}
                className="p-1.5 text-gray-500 hover:text-violet-600 hover:bg-violet-50 transition-colors bg-white border border-gray-100 rounded-lg shadow-sm dark:bg-transparent dark:border-slate-600 dark:text-gray-400 dark:hover:text-violet-300 dark:hover:bg-violet-900/30"
                title="İşlerim"
              >
                <CheckSquare size={20} />
              </button>
            )}

            <button
              onClick={() => setIsAdminOpen(true)}
              className="p-1.5 text-gray-500 hover:text-violet-600 hover:bg-violet-50 transition-colors bg-white border border-gray-100 rounded-lg shadow-sm dark:bg-transparent dark:border-slate-600 dark:text-gray-400 dark:hover:text-violet-300 dark:hover:bg-violet-900/30"
              title="Yönetici Paneli"
            >
              <Users size={20} />
            </button>

            {/* Admin Password Change Button */}
            {isDesigner && (
              <button
                onClick={() => setIsAdminPasswordOpen(true)}
                className="p-1.5 text-gray-500 hover:text-amber-600 hover:bg-amber-50 transition-colors bg-white border border-gray-100 rounded-lg shadow-sm dark:bg-transparent dark:border-slate-600 dark:text-gray-400 dark:hover:text-amber-300 dark:hover:bg-amber-900/30"
                title="Admin Şifre Değiştir"
              >
                <Lock size={20} />
              </button>
            )}

            {/* Settings Button */}
            {canSeeSettingsTab && (
              <button
                onClick={() => setActiveTab('ayarlar')}
                className={`
                  p-1.5 transition-colors rounded-lg shadow-sm border text-lg
                  ${activeTab === 'ayarlar'
                    ? 'text-blue-700 bg-blue-50 border-blue-200 dark:bg-blue-700/30 dark:text-blue-300 dark:border-blue-600'
                    : 'bg-white border-gray-100 text-gray-400 hover:text-blue-700 hover:bg-blue-50 dark:bg-transparent dark:border-slate-600 dark:text-gray-400 dark:hover:text-blue-300 dark:hover:bg-blue-700/30'}
                `}
                title="Mail Gönderim Ayarları"
              >
                @
              </button>
            )}

            {isDesigner && (
              <>
                <div className="relative">
                  <button
                    onClick={() => {
                      setIsLogOpen(!isLogOpen);
                      setIsNotifOpen(false);
                    }}
                    className={`
                                    p-1.5 transition-colors rounded-lg shadow-sm border
                                    ${isLogOpen
                        ? 'text-orange-600 bg-orange-50 border-orange-100 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700/50'
                        : 'bg-white border-gray-100 text-gray-400 hover:text-orange-600 dark:bg-transparent dark:border-slate-600 dark:text-gray-400 dark:hover:text-orange-300 dark:hover:bg-orange-900/30'}
                                `}
                    title="İşlem Kütüğü"
                  >
                    <ClipboardList size={20} />
                  </button>

                  <LogPopover
                    isOpen={isLogOpen}
                    logs={logs}
                    onClose={() => setIsLogOpen(false)}
                    onClear={() => {
                      logs.forEach(l => deleteDoc(doc(db, "logs", l.id)));
                    }}
                  />
                </div>

                <div className="relative">
                  <button
                    onClick={() => {
                      setIsNotifOpen(!isNotifOpen);
                      setIsLogOpen(false);
                    }}
                    className={`
                                    p-1.5 transition-colors rounded-lg shadow-sm border
                                    ${isNotifOpen
                        ? 'text-violet-600 bg-violet-50 border-violet-100 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-700/50'
                        : 'bg-white border-gray-100 text-gray-400 hover:text-violet-600 dark:bg-transparent dark:border-slate-600 dark:text-gray-400 dark:hover:text-violet-300 dark:hover:bg-violet-900/30'}
                                `}
                  >
                    <Bell size={20} />
                    {notifications.length > 0 && (
                      <span className="absolute -top-2 -right-2 min-w-5 h-5 px-1 bg-red-500 text-white text-[11px] font-bold flex items-center justify-center rounded-full border-2 border-white dark:border-slate-800">
                        {notifications.length}
                      </span>
                    )}
                  </button>

                  <NotificationPopover
                    isOpen={isNotifOpen}
                    notifications={notifications}
                    onClose={() => setIsNotifOpen(false)}
                    onMarkAllRead={() => {
                      notifications.forEach(n => deleteDoc(doc(db, "notifications", n.id)));
                    }}
                  />
                </div>

                <button
                  onClick={() => openAddModal()}
                  className="flex items-center gap-2 bg-violet-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg shadow-violet-200 dark:shadow-none hover:bg-violet-700 transition-transform active:scale-95"
                >
                  <Plus size={18} />
                  <span>Ekle</span>
                </button>
              </>
            )}


          </div>
        </div>

        {/* Search Bar Panel */}
        {isSearchOpen && (
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-lg border border-violet-100 dark:border-slate-700 grid grid-cols-1 md:grid-cols-4 gap-4 animate-in fade-in slide-in-from-top-4">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Başlık veya Ref ID ile ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-slate-700 dark:text-white dark:border-slate-600 border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-200 focus:border-violet-500 outline-none transition-all text-sm"
              />
            </div>

            <div className="relative">
              <Filter className="absolute left-3 top-2.5 text-gray-400" size={18} />
              <select
                value={filterAssignee}
                onChange={(e) => setFilterAssignee(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-slate-700 dark:text-white dark:border-slate-600 border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-200 focus:border-violet-500 outline-none transition-all text-sm appearance-none"
              >
                <option value="">Tüm Personel</option>
                {[...users].sort((a, b) => a.name.localeCompare(b.name, 'tr')).map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name} {monthlyBadges.trophy.includes(u.id) ? '🏆' : ''}{monthlyBadges.rocket.includes(u.id) ? '🚀' : ''}{monthlyBadges.power.includes(u.id) ? '💪' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative">
              <div className="absolute left-3 top-2.5 w-4 h-4 rounded-full border-2 border-gray-300"></div>
              <select
                value={filterUrgency}
                onChange={(e) => setFilterUrgency(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-slate-700 dark:text-white dark:border-slate-600 border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-200 focus:border-violet-500 outline-none transition-all text-sm appearance-none"
              >
                <option value="">Tüm Öncelikler</option>
                {(Object.keys(URGENCY_CONFIGS) as UrgencyLevel[]).map(level => (
                  <option key={level} value={level}>{URGENCY_CONFIGS[level].label}</option>
                ))}
              </select>
            </div>

            <div className="relative">
              <div className="absolute left-3 top-2.5 w-4 h-4 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-gray-400"></div>
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-slate-700 dark:text-white dark:border-slate-600 border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-200 focus:border-violet-500 outline-none transition-all text-sm appearance-none"
              >
                <option value="">Tüm Durumlar</option>
                <option value="Planlandı">Planlandı</option>
                <option value="Tamamlandı">Tamamlandı</option>
                <option value="İptal Edildi">İptal Edildi</option>
              </select>
            </div>

            <button
              onClick={clearFilters}
              disabled={!hasActiveFilters}
              className={`
                            flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                            ${hasActiveFilters
                  ? 'bg-red-50 text-red-600 hover:bg-red-100'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'}
                        `}
            >
              <X size={16} /> Filtreleri Temizle
            </button>
          </div>
        )}

        {/* Printable Area Wrapper */}
        <div id="printable-calendar" className="p-1">

          {/* Tab Navigation */}
          <div className="flex items-center gap-2 mb-6">
            {canSeeKampanyaTab && (
              <button
                onClick={() => setActiveTab('kampanya')}
                className={`
                  px-6 py-2.5 rounded-lg font-semibold text-sm transition-all duration-200 relative
                  ${activeTab === 'kampanya'
                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-200 dark:shadow-none'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-violet-50 hover:text-violet-600 hover:border-violet-200 dark:bg-slate-800 dark:text-gray-300 dark:border-slate-600 dark:hover:bg-slate-700'}
                `}
              >
                📅 KAMPANYA
                {myPendingCampaigns.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white dark:border-slate-800">
                    {myPendingCampaigns.length}
                  </span>
                )}
              </button>
            )}
            {canSeeReportTab && (
              <button
                onClick={() => setActiveTab('rapor')}
                className={`
                  px-6 py-2.5 rounded-lg font-semibold text-sm transition-all duration-200 relative
                  ${activeTab === 'rapor'
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200 dark:shadow-none'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 dark:bg-slate-800 dark:text-gray-300 dark:border-slate-600 dark:hover:bg-slate-700'}
                `}
              >
                📊 RAPOR
                {myPendingReports.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white dark:border-slate-800">
                    {myPendingReports.length}
                  </span>
                )}
              </button>
            )}
            {canSeeAnalyticsTab && (
              <button
                onClick={() => setActiveTab('analitik')}
                className={`
                  px-6 py-2.5 rounded-lg font-semibold text-sm transition-all duration-200 relative
                  ${activeTab === 'analitik'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-none'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 dark:bg-slate-800 dark:text-gray-300 dark:border-slate-600 dark:hover:bg-slate-700'}
                `}
              >
                📈 ANALİTİK
                {myPendingAnalyticsTasks.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white dark:border-slate-800">
                    {myPendingAnalyticsTasks.length}
                  </span>
                )}
              </button>
            )}
          </div>

          {/* Conditional Content Based on Active Tab */}
          {activeTab === 'kampanya' ? (
            <>
              {/* Calendar Grid Header */}
              <div className="grid grid-cols-7 gap-4 mb-4">
                {DAYS_OF_WEEK.map(day => (
                  <div key={day} className="text-center text-xs font-bold text-gray-400 uppercase tracking-widest">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Grid Body */}
              <div
                className="grid grid-cols-7 gap-4 flex-1 content-start"
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
              >
                {displayDays.map((day) => {
                  // In weekly view, all days are "current" (no fading)
                  const isCurrentMonth = viewMode === 'week' ? true : isSameMonth(day, currentDate);
                  const isTodayDate = isToday(day);
                  const isDayWeekend = isWeekend(day);
                  const dayEvents = getEventsForDay(day);
                  const holidayName = getHolidayName(day);
                  const isHoliday = !!holidayName;

                  return (
                    <div
                      key={day.toString()}
                      ref={isTodayDate ? todayCellRef : undefined}
                      onClick={() => openAddModal(day)}
                      onDragOver={(e) => {
                        if (isDesigner) {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                        }
                      }}
                      onDrop={(e) => {
                        if (isDesigner && draggedEvent) {
                          e.preventDefault();
                          handleEventDrop(draggedEvent, day, e.ctrlKey || e.metaKey);
                          setDraggedEvent(null);
                        }
                      }}
                      className={`
                  relative ${viewMode === 'week' ? 'min-h-[400px]' : 'min-h-[140px]'} p-4 rounded-xl border-2 transition-all duration-200 group
                  flex flex-col
                  ${isCurrentMonth
                          ? (isHoliday
                            ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-800/50 shadow-sm'
                            : isDayWeekend
                              ? 'bg-[#E2E8F0] dark:bg-[#0f172a] border-slate-400 dark:border-slate-700/50 shadow-md'
                              : 'bg-white dark:bg-slate-800 border-zinc-300 dark:border-slate-600 shadow-sm hover:bg-violet-50 dark:hover:bg-slate-700 hover:border-violet-400')
                          : 'bg-gray-200/50 dark:bg-slate-900/50 border-transparent opacity-40'}
                  ${isTodayDate ? 'ring-2 ring-red-500 ring-offset-2 dark:ring-offset-slate-900 z-10' : 'border-solid'}
                  ${!isDesigner && !loggedInDeptUser?.isBusinessUnit ? 'cursor-default' : 'cursor-pointer'}
                `}
                    >
                      <div className="flex justify-between items-start mb-3">
                        {isHoliday && isCurrentMonth ? (
                          <span className="text-[11px] font-extrabold text-red-700 bg-red-100 px-2 py-0.5 rounded leading-tight max-w-[70%] line-clamp-2 border border-red-200">
                            {holidayName}
                          </span>
                        ) : <div></div>}

                        <span className={`
                    text-xl font-normal w-10 h-10 flex items-center justify-center rounded-full leading-none
                    ${isTodayDate
                            ? 'bg-red-600 text-white shadow-lg shadow-red-200'
                            : isHoliday && isCurrentMonth ? 'text-red-700'
                              : isDayWeekend && isCurrentMonth ? 'text-slate-500 dark:text-slate-400'
                                : isCurrentMonth ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-600'}
                  `}>
                          {format(day, 'd')}
                        </span>
                      </div>

                      <div className="flex-1 overflow-y-auto event-scroll">
                        {dayEvents.map(event => {
                          // Visibility Logic
                          const isMyDeptInfo = currentDepartmentId && event.departmentId === currentDepartmentId;

                          // Designer: Everything clear, everything clickable
                          // Kampanya Yapan: Everything clear, clickable to view (but not edit)
                          // Department User: 
                          //    - Own Dept: Clear, NOT clickable (read-only)
                          //    - Other Dept: Blurred, NOT clickable
                          // Guest: Blurred, NOT clickable

                          let isBlurred = false;
                          let isClickable = false;

                          if (isDesigner) {
                            isBlurred = false;
                            isClickable = true;
                          } else if (isKampanyaYapan) {
                            // Kampanya Yapan: Can see all events, can click to view details (but not edit)
                            isBlurred = false;
                            isClickable = true;
                          } else if (loggedInDeptUser) {
                            if (isMyDeptInfo) {
                              // My department: Clear but Read-Only
                              isBlurred = false;
                              isClickable = false;
                            } else {
                              // Other department: Blurred and Read-Only
                              isBlurred = true;
                              isClickable = false;
                            }
                          } else {
                            // Guest
                            isBlurred = true;
                            isClickable = false;
                          }

                          return (
                            <div
                              key={event.id}
                              draggable={isDesigner}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (loggedInDeptUser || isDesigner || isKampanyaYapan) {
                                  setSelectedEventIdForNote(event.id);
                                  setNoteContent(event.note || '');
                                  setIsNoteModalOpen(true);
                                }
                              }}
                              onDragStart={(e) => {
                                if (isDesigner) {
                                  setDraggedEvent(event);
                                  e.dataTransfer.effectAllowed = "move";
                                  // Optional: Set drag image or data if needed
                                  e.dataTransfer.setData("text/plain", event.id);
                                }
                              }}
                              className={isDesigner ? 'cursor-grab active:cursor-grabbing' : ''}
                            >
                              <div className="relative">
                                <EventBadge
                                  event={event}
                                  user={users.find(u => u.id === event.assigneeId)}
                                  onClick={(e) => setViewEventId(e.id)}
                                  isBlurred={isBlurred}
                                  isClickable={isClickable}
                                  monthlyBadges={monthlyBadges}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {(isDesigner || loggedInDeptUser?.isBusinessUnit) && (
                        <>
                          <div className="absolute inset-0 bg-violet-50/0 group-hover:bg-violet-50/30 rounded-2xl pointer-events-none transition-colors" />
                          <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="bg-white p-1 rounded-full shadow-sm text-violet-500">
                              <Plus size={14} />
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          ) : activeTab === 'rapor' ? (
            <ReportCalendarTab
              currentDate={currentDate}
              reports={filteredReports}
              users={users}
              departments={departments}
              onReportClick={handleReportClick}
              onUpdateReportDueDate={handleUpdateReportDueDate}
              onDayClick={handleReportDayClick}
              loggedInUserId={connectedPersonnelUser?.id}
              isDesigner={isDesigner}
              isKampanyaYapan={isKampanyaYapan}
            />
          ) : activeTab === 'analitik' ? (
            <AnalyticsCalendarTab
              currentDate={currentDate}
              tasks={analyticsTasks}
              users={analyticsUsers}
              onTaskClick={handleAnalyticsTaskClick}
              onUpdateTaskDate={handleUpdateAnalyticsTaskDate}
              onDayClick={handleAnalyticsDayClick}
              loggedInUserId={connectedAnalyticsUser?.id}
              isDesigner={isDesigner}
              isAnalitik={isAnalitik}
            />
          ) : activeTab === 'ayarlar' ? (
            <ReminderSettingsPanel />
          ) : null}

          {/* Minimal Footer */}
          <p className="text-center text-[10px] text-gray-300 dark:text-gray-600 mt-4 select-none">
            Metin Özer
          </p>
        </div> {/* End of printable-calendar */}

        {/* Login Button (Bottom Left) - Only show when not logged in */}
        <div className="fixed bottom-4 left-4 z-40 flex gap-2">
          {!loggedInDeptUser && !isDesigner && (
            <button
              onClick={() => setIsDeptLoginOpen(true)}
              className="px-3 py-2 rounded-lg shadow-lg flex items-center gap-2 text-xs font-medium bg-teal-600 text-white hover:bg-teal-700 transition-colors"
            >
              <LogIn size={14} /> Kullanıcı Girişi
            </button>
          )}
        </div>

        {/* Right Sidebar - Designer and Kampanya Yapan */}
        {(isDesigner || isKampanyaYapan) && (
          <Sidebar users={users} analyticsUsers={analyticsUsers} />
        )}

        <AddEventModal
          isOpen={isAddModalOpen}
          onClose={() => {
            setIsAddModalOpen(false);
            setConvertingRequest(null);
          }}
          onAdd={handleAddEvent}
          initialDate={selectedDate}
          initialData={convertingRequest ? {
            title: convertingRequest.title,
            urgency: convertingRequest.urgency,
            description: convertingRequest.description,
            departmentId: convertingRequest.departmentId
          } : undefined}
          users={users}
          departments={departments}
          events={events} // Pass events for workload indicators
          isKampanyaYapan={isKampanyaYapan}
        />

        <AddReportModal
          isOpen={isAddReportModalOpen}
          onClose={() => {
            setIsAddReportModalOpen(false);
            setSelectedReportDate(undefined);
          }}
          onAdd={handleAddReport}
          initialDate={selectedReportDate}
          users={users}
        />

        <ReportDetailsModal
          isOpen={!!selectedReport}
          report={selectedReport}
          users={users}
          onClose={() => setSelectedReport(null)}
          onUpdate={handleUpdateReport}
          onDelete={handleDeleteReport}
          onMarkDone={handleMarkReportDone}
          onUpdateStatus={handleUpdateReportStatus}
          canEdit={isDesigner || isKampanyaYapan}
        />

        <AddAnalyticsTaskModal
          isOpen={isAddAnalyticsModalOpen}
          onClose={() => {
            setIsAddAnalyticsModalOpen(false);
            setSelectedAnalyticsDate(undefined);
          }}
          onAdd={handleAddAnalyticsTask}
          initialDate={selectedAnalyticsDate}
          users={analyticsUsers}
          tasks={analyticsTasks}
        />

        <AnalyticsTaskDetailsModal
          isOpen={!!selectedAnalyticsTask}
          task={selectedAnalyticsTask}
          users={analyticsUsers}
          onClose={() => setSelectedAnalyticsTask(null)}
          onUpdate={handleUpdateAnalyticsTask}
          onDelete={handleDeleteAnalyticsTask}
          onUpdateStatus={handleUpdateAnalyticsTaskStatus}
          canEdit={isDesigner}
          canChangeStatus={isDesigner || isAnalitik}
        />

        <RequestWorkModal
          isOpen={isRequestModalOpen}
          onClose={() => setIsRequestModalOpen(false)}
          onRequest={handleAddRequest}
          initialDate={requestModalDate}
          defaultEmail={loggedInDeptUser?.email}
        />

        <IncomingRequestsModal
          isOpen={isIncomingRequestsModalOpen}
          onClose={() => setIsIncomingRequestsModalOpen(false)}
          requests={requests}
          onAccept={handleAcceptRequest}
          onReject={handleRejectRequest}
          departments={departments}
        />

        <AdminModal
          isOpen={isAdminOpen}
          onClose={() => setIsAdminOpen(false)}
          users={users}
          events={events}
          departments={departments}
          onAddUser={handleAddUser}
          onUpdateUser={handleUpdateUser}
          onDeleteUser={handleDeleteUser}
          onDeleteEvent={handleDeleteEvent}
          onDeleteAllEvents={handleDeleteAllEvents}
          onAddDepartment={handleAddDepartment}
          onDeleteDepartment={handleDeleteDepartment}
          departmentUsers={departmentUsers}
          onAddDepartmentUser={handleAddDepartmentUser}
          onDeleteDepartmentUser={handleDeleteDepartmentUser}
          onUpdateDepartmentUser={handleUpdateDepartmentUser}
          onBulkAddEvents={handleBulkAddEvents}
          onSetIsDesigner={setIsDesigner}
          announcements={announcements}
          onAddAnnouncement={handleAddAnnouncement}
          onDeleteAnnouncement={handleDeleteAnnouncement}
          autoThemeConfig={autoThemeConfig}
          onUpdateAutoThemeConfig={handleUpdateAutoThemeConfig}
          monthlyBadges={monthlyBadges}
          analyticsUsers={analyticsUsers}
          onAddAnalyticsUser={handleAddAnalyticsUser}
          onUpdateAnalyticsUser={handleUpdateAnalyticsUser}
          onDeleteAnalyticsUser={handleDeleteAnalyticsUser}
        />

        <ChangePasswordModal
          isOpen={isChangePasswordOpen}
          onClose={() => setIsChangePasswordOpen(false)}
          currentUser={loggedInDeptUser}
          onChangePassword={handleChangePassword}
        />

        <AdminChangePasswordModal
          isOpen={isAdminPasswordOpen}
          onClose={() => setIsAdminPasswordOpen(false)}
          onChangePassword={handleAdminChangePassword}
        />

        <DesignerCampaignsModal
          isOpen={isDesignerCampaignsModalOpen}
          onClose={() => setIsDesignerCampaignsModalOpen(false)}
          events={events}
          users={users}
          departments={departments}
        />

        <EventDetailsModal
          event={viewEvent}
          onClose={() => setViewEventId(null)}
          assignee={users.find(u => u.id === viewEvent?.assigneeId)}
          departments={departments}
          users={users}
          isDesigner={isDesigner}
          isKampanyaYapan={isKampanyaYapan}
          onEdit={handleEditEvent}
          onDelete={handleDeleteEvent}
          monthlyBadges={monthlyBadges}
        />

        <DepartmentLoginModal
          isOpen={isDeptLoginOpen}
          onClose={() => setIsDeptLoginOpen(false)}
          departmentUsers={departmentUsers}
          departments={departments}
          onLogin={handleDepartmentLogin}
        />

        <AnnouncementBoard
          isOpen={isAnnBoardOpen}
          onClose={() => setIsAnnBoardOpen(false)}
          announcements={filteredAnnouncements}
          canManage={(!loggedInDeptUser && !!auth.currentUser) || isDesigner}
          onAddAnnouncement={handleAddAnnouncement}
          onDeleteAnnouncement={handleDeleteAnnouncement}
          onMarkAsRead={handleMarkAsRead}
        />

        {/* Note Add Modal */}
        {isNoteModalOpen && selectedEventIdForNote && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-gray-100 dark:border-slate-700 animate-in fade-in zoom-in duration-200">
              <div className="p-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gray-50/50 dark:bg-slate-900/50">
                <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                  <StickyNote size={18} className="text-yellow-500" />
                  Not Ekle / Düzenle
                </h3>
                <button
                  onClick={() => setIsNoteModalOpen(false)}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg transition-colors text-gray-500"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Not / Açıklama
                  </label>
                  <textarea
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    placeholder="Kampanya gecikme nedeni veya not..."
                    className="w-full h-32 px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 outline-none transition-all resize-none bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-white text-sm"
                    autoFocus
                  />
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setIsNoteModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    İptal
                  </button>
                  {/* Delete Button - Only if there is content */}
                  {noteContent.trim() && (
                    <button
                      onClick={() => {
                        if (selectedEventIdForNote) {
                          handleDeleteNote(selectedEventIdForNote);
                          setIsNoteModalOpen(false);
                        }
                      }}
                      className="px-4 py-2 rounded-xl text-sm font-medium bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 transition-colors flex items-center gap-2"
                    >
                      <Trash2 size={16} />
                      Sil
                    </button>
                  )}
                  <button
                    onClick={handleAddNote}
                    disabled={!noteContent.trim()}
                    className="px-4 py-2 rounded-xl text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-violet-200 dark:shadow-none flex items-center gap-2"
                  >
                    <Plus size={16} />
                    Kaydet
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <ReportsDashboard
          isOpen={isReportsOpen}
          onClose={() => setIsReportsOpen(false)}
          events={events}
          departments={departments}
          users={users}
          onRefresh={handleDashboardRefresh}
          monthlyBadges={monthlyBadges}
        />

        <AnnouncementPopup
          latestAnnouncement={filteredAnnouncements[0]}
          currentUsername={currentUsername}
          currentUserId={loggedInDeptUser?.id || auth.currentUser?.uid || 'guest'}
          onMarkAsRead={(id) => handleMarkAsRead([id])}
        />

        <MyTasksModal
          isOpen={isMyTasksOpen}
          onClose={() => setIsMyTasksOpen(false)}
          tasks={events.filter(e => {
            if (!loggedInDeptUser) return false;
            // 1. Direct match (DepartmentUser ID)
            if (e.assigneeId === loggedInDeptUser.id) return true;
            // 2. Linked match (Personnel User ID via Email)
            if (connectedPersonnelUser && e.assigneeId === connectedPersonnelUser.id) return true;
            return false;
          })}
          onUpdateStatus={(id, status) => handleEditEvent(id, { status })}
        />

        <ToastContainer toasts={toasts} removeToast={removeToast} />

        {/* Birthday Animation - shown to the birthday person */}
        {showBirthdayAnimation && loggedInDeptUser && (
          <BirthdayAnimation
            userName={connectedPersonnelUser?.name || loggedInDeptUser.username}
            onClose={() => setShowBirthdayAnimation(false)}
          />
        )}

        {/* Birthday Reminder - shown to others when someone has a birthday */}
        {birthdayPeopleToday.length > 0 && !birthdayReminderDismissed && loggedInDeptUser && (
          <BirthdayReminder
            birthdayPeople={birthdayPeopleToday}
            onDismiss={() => setBirthdayReminderDismissed(true)}
          />
        )}
      </div>
    </div>
  );
}

export default App;
