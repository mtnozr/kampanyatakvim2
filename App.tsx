import React, { useState, useMemo, useEffect } from 'react';
import {
  format,
  addMonths,
  endOfMonth,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  isWeekend,
  startOfMonth,
  startOfWeek
} from 'date-fns';
import { tr } from 'date-fns/locale';
import { Bell, ChevronLeft, ChevronRight, Plus, Users, ClipboardList, Loader2, Search, Filter, X, LogIn, LogOut, Database, Download, Lock, Megaphone, PieChart, CheckSquare, StickyNote, Trash2, Flag } from 'lucide-react';
import emailjs from '@emailjs/browser';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { CalendarEvent, UrgencyLevel, User, AppNotification, ToastMessage, ActivityLog, Department, DepartmentUser, Announcement, DifficultyLevel, WorkRequest } from './types';
import { INITIAL_EVENTS, DAYS_OF_WEEK, INITIAL_USERS, URGENCY_CONFIGS, TURKISH_HOLIDAYS, INITIAL_DEPARTMENTS, DIFFICULTY_CONFIGS } from './constants';
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
import { AnnouncementBoard } from './components/AnnouncementBoard';
import { AnnouncementPopup } from './components/AnnouncementPopup';
import { ReportsDashboard } from './components/ReportsDashboard';
import { DesignerCampaignsModal } from './components/DesignerCampaignsModal';
import { MyTasksModal } from './components/MyTasksModal';
import { ThemeToggle } from './components/ThemeToggle';
import { useTheme } from './hooks/useTheme';
import { setCookie, getCookie, deleteCookie } from './utils/cookies';
import { calculateMonthlyChampion } from './utils/gamification';

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


// --- EMAILJS CONFIGURATION ---
const EMAILJS_SERVICE_ID = 'service_q4mufkj';
const EMAILJS_TEMPLATE_ID = 'template_mtdrews';
const EMAILJS_PUBLIC_KEY = 'RBWpN3vQtjsZQGEKl';

// Normalize urgency values coming from Firestore to avoid crashes on bad data
const normalizeUrgency = (urgency: any): UrgencyLevel => {
  const validUrgencies: UrgencyLevel[] = ['Very High', 'High', 'Medium', 'Low'];
  return validUrgencies.includes(urgency) ? urgency : 'Low';
};

function App() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const { theme, toggleTheme, setTheme } = useTheme();
  const [autoThemeConfig, setAutoThemeConfig] = useState<{ enabled: boolean; time: string }>({ enabled: false, time: '20:00' });

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
  const [monthlyChampionId, setMonthlyChampionId] = useState<string | null>(null);
  const [requestSubmissionEnabled, setRequestSubmissionEnabled] = useState(true);

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

  // Derived state for viewEvent
  const viewEvent = useMemo(() => {
    return events.find(e => e.id === viewEventId) || null;
  }, [events, viewEventId]);

  // Link Department User to Personnel User via Email
  const connectedPersonnelUser = useMemo(() => {
    if (!loggedInDeptUser || !loggedInDeptUser.email) return null;
    return users.find(u => u.email?.trim().toLowerCase() === loggedInDeptUser.email?.trim().toLowerCase());
  }, [loggedInDeptUser, users]);

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
            
            // Only show welcome toast if not recently shown (optional, but simple toast is fine)
            // addToast(`Hoşgeldiniz, ${deptUserData.username}`, 'success');
          } else {
            // It is NOT a Department User (It's a Super Admin)
            setLoggedInDeptUser(null); 
            setIsDesigner(true); // Super admins are designers by default
            setIsKampanyaYapan(false);
          }
        } catch (err) {
          console.error("Auth check failed:", err);
        }
      } else {
        // User is logged out
        setLoggedInDeptUser(null);
        setIsDesigner(false);
        setIsKampanyaYapan(false);
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
          urgency,
          assigneeId: data.assigneeId,
          description: data.description,
          departmentId: data.departmentId,
          status: data.status,
          date: data.date instanceof Timestamp ? data.date.toDate() : new Date(data.date),
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : undefined),
          updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : (data.updatedAt ? new Date(data.updatedAt) : undefined),
          note: data.note,
          history
        } as CalendarEvent;
      });
      setEvents(fetchedEvents);
      setIsEventsLoading(false);
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

  // 10. Gamification Check (Monthly Champion)
  useEffect(() => {
    // 1. Listen for Gamification Config (Enable/Disable)
    const unsubscribeConfig = onSnapshot(doc(db, "system_settings", "gamification_config"), (docSnap) => {
      const isEnabled = docSnap.exists() ? docSnap.data().enabled : true; // Default to true if not set
      
      if (isEnabled) {
        // Initial check/calculation only if enabled
        calculateMonthlyChampion();
      } else {
        setMonthlyChampionId(null);
      }
    });

    // 2. Listen for Monthly Champion updates (only relevant if enabled, but we can listen always and filter locally)
    const unsubscribeChampion = onSnapshot(doc(db, "system_settings", "monthly_champion"), async (docSnap) => {
      // Check config again inside this callback or rely on a ref/state if complex.
      // Simpler: Just fetch config or assume if we get an update, we might want to show it.
      // BUT, if disabled, we should force null. 
      // Let's check config one-off here or better, combine logic.
      
      const configSnap = await import('firebase/firestore').then(mod => mod.getDoc(doc(db, "system_settings", "gamification_config")));
      const isEnabled = configSnap.exists() ? configSnap.data()?.enabled : true;

      if (!isEnabled) {
        setMonthlyChampionId(null);
        return;
      }

      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data && data.userId) {
          console.log('🏆 App: Monthly champion updated:', data.userId);
          setMonthlyChampionId(data.userId);
        } else {
          setMonthlyChampionId(null);
        }
      } else {
        setMonthlyChampionId(null);
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

    const updatePresence = async () => {
      try {
        const userRef = doc(db, "departmentUsers", loggedInDeptUser.id);
        await updateDoc(userRef, {
          lastSeen: Timestamp.now()
        });
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

  // --- EmailJS Initialization ---
  useEffect(() => {
    try {
      emailjs.init(EMAILJS_PUBLIC_KEY);
    } catch (error) {
      console.warn('EmailJS Init Error:', error);
    }
  }, []);

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

  const unreadAnnouncementCount = useMemo(() => {
    let userId = loggedInDeptUser ? loggedInDeptUser.id : 'guest';
    if (!loggedInDeptUser && auth.currentUser) {
      userId = auth.currentUser.uid;
    }
    
    if (userId === 'guest') return 0; // Don't show badge for guests

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

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(addMonths(currentDate, -1));
  const resetToToday = () => setCurrentDate(new Date());

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

  const handleAddUser = async (name: string, email: string, emoji: string) => {
    try {
      await addDoc(collection(db, "users"), {
        name,
        email,
        emoji
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
    const calendarElement = document.getElementById('printable-calendar');
    if (!calendarElement) {
      addToast('Takvim alanı bulunamadı.', 'info');
      return;
    }

    try {
      addToast('PDF hazırlanıyor...', 'info');

      // 1. Create a clone to manipulate for export
      const clone = calendarElement.cloneNode(true) as HTMLElement;

      // 2. Wrap it in a container that forces a large width (for landscape) 
      //    and white background.
      const container = document.createElement('div');
      container.style.width = '1600px';
      // Chrome Fix: Use fixed position at top-left but behind everything (z-index) 
      // instead of 'top: -9999px' which causes rendering optimization issues in Chrome
      container.style.position = 'fixed';
      container.style.top = '0';
      container.style.left = '0';
      container.style.zIndex = '-9999'; 
      container.style.backgroundColor = '#ffffff';
      container.style.padding = '20px';
      container.style.fontFamily = 'Arial, Helvetica, sans-serif'; // Use system font for Turkish char support

      // 3. Add Corporate Header
      const header = document.createElement('div');
      header.style.display = 'flex';
      header.style.justifyContent = 'space-between';
      header.style.alignItems = 'flex-end';
      header.style.marginBottom = '30px';
      header.style.borderBottom = '2px solid #e5e7eb';
      header.style.paddingBottom = '20px';

      // Left side: Title and Month
      const headerLeft = document.createElement('div');
      
      const title = document.createElement('h1');
      title.innerText = 'KAMPANYA YÖNETİMİ TAKVİMİ';
      title.style.fontSize = '28px';
      title.style.fontWeight = '800';
      title.style.color = '#111827';
      title.style.margin = '0';
      title.style.lineHeight = '1.2';
      
      const subtitle = document.createElement('div');
      subtitle.innerText = format(currentDate, 'MMMM yyyy', { locale: tr }).toLocaleUpperCase('tr-TR');
      subtitle.style.fontSize = '20px';
      subtitle.style.fontWeight = '600';
      subtitle.style.color = '#374151';
      subtitle.style.marginTop = '8px';

      headerLeft.appendChild(title);
      headerLeft.appendChild(subtitle);

      // Right side: Meta info
      const headerRight = document.createElement('div');
      headerRight.style.textAlign = 'right';

      const createdDate = document.createElement('div');
      createdDate.innerText = `Oluşturulma: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`;
      createdDate.style.fontSize = '14px';
      createdDate.style.color = '#6b7280';
      createdDate.style.marginBottom = '4px';

      const confidential = document.createElement('div');
      confidential.innerText = 'KURUMSAL / GİZLİ';
      confidential.style.fontSize = '12px';
      confidential.style.fontWeight = 'bold';
      confidential.style.color = '#ef4444';
      confidential.style.letterSpacing = '1px';

      headerRight.appendChild(createdDate);
      headerRight.appendChild(confidential);

      header.appendChild(headerLeft);
      header.appendChild(headerRight);

      container.appendChild(header);
      container.appendChild(clone);
      document.body.appendChild(container);

      // Force Arial font on all cloned elements to ensure Turkish chars render correctly
      const allElements = clone.querySelectorAll('*');
      allElements.forEach((el) => {
        (el as HTMLElement).style.fontFamily = 'Arial, Helvetica, sans-serif';
      });

      // 4. Force full height for all scrollable containers in the clone
      const scrollables = clone.querySelectorAll('.event-scroll');
      scrollables.forEach((el) => {
        (el as HTMLElement).style.overflow = 'visible';
        (el as HTMLElement).style.height = 'auto';
        (el as HTMLElement).style.maxHeight = 'none';
      });

      // 5. Expand text truncation for export (Remove line-clamp and truncate)
      const clampedTexts = clone.querySelectorAll('.line-clamp-2, .truncate');
      clampedTexts.forEach((el) => {
        el.classList.remove('line-clamp-2');
        el.classList.remove('truncate');
        (el as HTMLElement).style.display = 'block';
        (el as HTMLElement).style.overflow = 'visible';
        (el as HTMLElement).style.whiteSpace = 'normal'; // Allow wrapping
      });

      // 6. Fix Emoji Alignment for PDF Export
      // html2canvas sometimes misaligns flex items with text/emojis.
      // We force explicit flex centering and line-height.
      const emojiAvatars = clone.querySelectorAll('[role="img"][aria-label="avatar"]');
      emojiAvatars.forEach((el) => {
        (el as HTMLElement).style.display = 'none';
      });

      // Chrome Fix: Wait for fonts to load and give layout engine time to settle
      await document.fonts.ready;
      await new Promise(resolve => setTimeout(resolve, 500));

      // 6. Capture the container
      const canvas = await html2canvas(container, {
        scale: 1.5, // Reduced from 2 to 1.5 for smaller file size while maintaining readability
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
        windowWidth: 1600, // Force specific window width context
        scrollY: 0, // Reset scroll position for capture
        scrollX: 0
      });

      // 6. Clean up
      document.body.removeChild(container);

      // 7. Generate PDF
      // Optimize: Use JPEG with 0.8 quality instead of PNG
      const imgData = canvas.toDataURL('image/jpeg', 0.8);
      const pdf = new jsPDF({
        orientation: 'l',
        unit: 'mm',
        format: 'a4',
        compress: true // Enable internal PDF compression
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      
      // Calculate ratio to fit width with minimal margins (5mm each side)
      const marginX = 5;
      const availableWidth = pdfWidth - (2 * marginX);
      const ratio = Math.min(availableWidth / imgWidth, pdfHeight / imgHeight);

      // Center it horizontally if height is the limiting factor, otherwise use marginX
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 10; // Top margin

      // Use JPEG compression alias 'FAST' (which corresponds to moderate compression) or just specify format
      pdf.addImage(imgData, 'JPEG', imgX, imgY, imgWidth * ratio, imgHeight * ratio, undefined, 'FAST');

      pdf.save(`kampanya-takvimi-${format(currentDate, 'yyyy-MM')}.pdf`);
      addToast('PDF indirildi.', 'success');
    } catch (error) {
      console.error('PDF Export Error:', error);
      addToast('PDF oluşturulurken hata oluştu.', 'info');
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
      
      // Prevent popup for the creator
      localStorage.setItem('dismissed_announcement_id', docRef.id);
      
      // Log action
      await addDoc(collection(db, "logs"), {
        message: `${user} yeni bir duyuru yayınladı: "${title}"`,
        timestamp: Timestamp.now()
      });

      addToast('Duyuru yayınlandı.', 'success');
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
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'API işlemi başarısız');
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

  const handleAddDepartmentUser = async (username: string, password: string, departmentId: string, isDesignerRole: boolean, isKampanyaYapanRole: boolean, isBusinessUnitRole: boolean, email?: string) => {
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
        email: userEmail,
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

      // 1. Update Auth if needed (email or password)
      if (updates.email || updates.password) {
        if (!userToUpdate.uid) {
           throw new Error("Bu kullanıcının UID değeri eksik, Auth güncellemesi yapılamaz.");
        }
        await callAdminApi({
          action: 'updateUser',
          uid: userToUpdate.uid,
          email: updates.email,
          password: updates.password
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
      await updateDoc(eventRef, {
        note: noteContent,
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
    difficulty?: DifficultyLevel
  ) => {

    const eventData = {
      title,
      date: Timestamp.fromDate(date),
      urgency,
      difficulty: difficulty || 'ORTA',
      assigneeId,
      description,
      departmentId,
      status: 'Planlandı',
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

      // Check if we are converting a request
      if (convertingRequest) {
        const reqRef = doc(db, "work_requests", convertingRequest.id);
        await updateDoc(reqRef, { status: 'approved' });
        
        // If assigned and there's a requester email, send notification to requester
        if (assigneeId && convertingRequest.requesterEmail) {
          const formattedRequestDate = format(convertingRequest.createdAt instanceof Timestamp ? convertingRequest.createdAt.toDate() : convertingRequest.createdAt, 'd MMMM yyyy HH:mm', { locale: tr });
          const requesterEmailMessage = `${formattedRequestDate} tarihinde talep ettiğiniz "${title}" kampanya/bilgilendirme için iş planlaması yapılmıştır.`;
          
          const requesterParams = {
            to_email: convertingRequest.requesterEmail,
            cc: 'kampanyayonetimi@vakifbank.com.tr',
            to_name: "İlgili Kişi",
            name: "Kampanya Takvimi",
            email: convertingRequest.requesterEmail,
            title: "Kampanya/Bilgilendirme Talebiniz Atandı",
            message: requesterEmailMessage,
            ref_id: `Ref ID: #${newEventId.substring(0, 6).toUpperCase()}`,
          };

          // We send this asynchronously without blocking or showing toast for it specifically
          // to keep the flow smooth, or we can add a small toast.
          emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, requesterParams, EMAILJS_PUBLIC_KEY)
            .then(() => console.log('✅ Talep edene mail gönderildi'))
            .catch((err) => console.error('❌ Talep edene mail gönderilemedi', err));
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

        await addDoc(collection(db, "logs"), {
          message: `${title} kampanyası için ${assignedUser.name} kişiye görev ataması yapıldı (ID: ${newEventId})`,
          timestamp: Timestamp.now()
        });

        setIsSendingEmail(true);

        let emailMessage = `${format(date, 'd MMMM yyyy', { locale: tr })} tarihindeki "${title}" kampanyası için görevlendirildiniz.\nAciliyet: ${URGENCY_CONFIGS[urgency].label}`;
        if (difficulty) emailMessage += `\nZorluk Seviyesi: ${DIFFICULTY_CONFIGS[difficulty].label}`;
        if (description) emailMessage += `\n\nAçıklama:\n${description}`;

        if (departmentId) {
          const dept = departments.find(d => d.id === departmentId);
          if (dept) emailMessage += `\n\nTalep Eden Birim: ${dept.name}`;
        }

        const footerIdText = `Ref ID: #${newEventId.substring(0, 6).toUpperCase()}`;
        const isVeryHigh = urgency === 'Very High';
        const subjectPrefix = isVeryHigh ? 'ACİL: ' : '';
        const emailSubject = `${subjectPrefix}${title} - Kampanya Görev Ataması`;

        const templateParams = {
          to_email: assignedUser.email,
          cc: 'kampanyayonetimi@vakifbank.com.tr',
          to_name: assignedUser.name,
          name: assignedUser.name,
          email: assignedUser.email,
          title: emailSubject,
          message: emailMessage,
          ref_id: footerIdText,
        };

        try {
          console.log('📧 EmailJS Gönderiliyor...', {
            serviceId: EMAILJS_SERVICE_ID,
            templateId: EMAILJS_TEMPLATE_ID,
            publicKey: EMAILJS_PUBLIC_KEY,
            params: templateParams
          });
          
          const response = await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams, EMAILJS_PUBLIC_KEY);
          
          console.log('✅ EmailJS Başarılı:', response);
          addToast(`✅ E-posta gönderildi: ${assignedUser.email}`, 'success');
        } catch (error: any) {
          console.error('❌ EmailJS Hatası:', error);
          console.error('Hata Detayı:', {
            message: error.message,
            text: error.text,
            status: error.status
          });
          
          const errorMsg = error.text || error.message || 'Bilinmeyen hata';
          addToast(`❌ E-posta hatası: ${errorMsg}`, 'info');
          addToast('Mail istemcisi açılıyor...', 'info');
          
          setTimeout(() => {
            const subject = encodeURIComponent(`${subjectPrefix}Görev Ataması: ${title} - Kampanya Görev Ataması`);
            const body = encodeURIComponent(`Merhaba ${assignedUser.name},\n\n${emailMessage}\n\n----------------\n${footerIdText}`);
            window.location.href = `mailto:${assignedUser.email}?cc=kampanyayonetimi@vakifbank.com.tr&subject=${subject}&body=${body}&importance=${isVeryHigh ? 'High' : 'Normal'}`;
          }, 2000);
        } finally {
          setIsSendingEmail(false);
        }
      }
    }
  };

  const handleDeleteEvent = async (id: string) => {
    try {
      // Fetch event first to get title for notification
      const eventSnap = await getDoc(doc(db, "events", id));
      const eventData = eventSnap.exists() ? eventSnap.data() : null;

      await deleteDoc(doc(db, "events", id));
      
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

      // Convert Date to Timestamp if date is being updated
      if (updates.date && updates.date instanceof Date) {
        updateData.date = Timestamp.fromDate(updates.date);
      }

      // 1. Fetch current document to check status change
      const eventRef = doc(db, "events", eventId);
      const eventSnap = await getDoc(eventRef);
      
      if (eventSnap.exists()) {
        const currentEvent = eventSnap.data() as CalendarEvent;
        
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

        // Check if assignee changed (Send Email to New Assignee)
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

             // 3. Send Email
             setIsSendingEmail(true);

             // Find old assignee name
             const oldAssignee = users.find(u => u.id === currentEvent.assigneeId);
             const oldAssigneeName = oldAssignee ? oldAssignee.name : 'Bilinmeyen Kullanıcı';

             let emailMessage = `"${currentEvent.title}" kampanyası için görevlendirildiniz (Görev Devri).\n\n`;
             emailMessage += `Görevi Devreden: ${oldAssigneeName}\n`;
             emailMessage += `Tarih: ${format(updates.date instanceof Date ? updates.date : (updates.date ? (updates.date as any).toDate() : (currentEvent.date as any).toDate()), 'd MMMM yyyy', { locale: tr })}\n`;
             emailMessage += `Aciliyet: ${URGENCY_CONFIGS[updates.urgency || currentEvent.urgency].label}`;
             
             const diff = updates.difficulty || currentEvent.difficulty;
             if (diff) emailMessage += `\nZorluk Seviyesi: ${DIFFICULTY_CONFIGS[diff].label}`;
             
             const desc = updates.description || currentEvent.description;
             if (desc) emailMessage += `\n\nAçıklama:\n${desc}`;

             const deptId = updates.departmentId || currentEvent.departmentId;
             if (deptId) {
               const dept = departments.find(d => d.id === deptId);
               if (dept) emailMessage += `\n\nTalep Eden Birim: ${dept.name}`;
             }

             const footerIdText = `Ref ID: #${eventId.substring(0, 6).toUpperCase()}`;
             
             const effectiveUrgency = updates.urgency || currentEvent.urgency;
             const isVeryHigh = effectiveUrgency === 'Very High';
             const subjectPrefix = isVeryHigh ? 'ACİL: ' : '';
             const emailSubject = `${subjectPrefix}${currentEvent.title} - Görev Ataması (Güncelleme)`;

             const templateParams = {
               to_email: newAssignee.email,
               cc: 'kampanyayonetimi@vakifbank.com.tr',
               to_name: newAssignee.name,
               name: newAssignee.name,
               email: newAssignee.email,
               title: emailSubject,
               message: emailMessage,
               ref_id: footerIdText,
             };

             try {
               console.log('📧 (Edit) EmailJS Gönderiliyor...', templateParams);
               await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams, EMAILJS_PUBLIC_KEY);
               addToast(`✅ Yeni görevliye e-posta gönderildi: ${newAssignee.name}`, 'success');
             } catch (error: any) {
               console.error('❌ (Edit) EmailJS Hatası:', error);
               addToast(`❌ E-posta hatası: ${error.text || 'Bilinmeyen'}`, 'info');
               
               // Fallback to mailto
               setTimeout(() => {
                 const subject = encodeURIComponent(`${subjectPrefix}Görev Ataması: ${currentEvent.title} - Görev Ataması (Güncelleme)`);
                 const body = encodeURIComponent(`Merhaba ${newAssignee.name},\n\n${emailMessage}\n\n----------------\n${footerIdText}`);
                 window.location.href = `mailto:${newAssignee.email}?cc=kampanyayonetimi@vakifbank.com.tr&subject=${subject}&body=${body}&importance=${isVeryHigh ? 'High' : 'Normal'}`;
               }, 1000);
             } finally {
               setIsSendingEmail(false);
             }
           }
        }
      }

      await setDoc(doc(db, "events", eventId), updateData, { merge: true });
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

  const handleEventDrop = async (event: CalendarEvent, newDate: Date) => {
    if (!isDesigner) return;

    // If dropped on the same day, do nothing
    if (isSameDay(event.date, newDate)) return;

    try {
      // Create a toast to indicate progress
      addToast('Tarih güncelleniyor...', 'info');
      await handleEditEvent(event.id, { date: newDate });
    } catch (error) {
      console.error('Drag drop update failed:', error);
      addToast('Tarih güncellemesi başarısız.', 'info');
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

  // Render Loading State if Initial Data Fetching
  if (isEventsLoading || isUsersLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FE] flex-col gap-4">
        <Loader2 size={40} className="text-violet-600 animate-spin" />
        <p className="text-gray-500 font-medium animate-pulse">Veritabanına bağlanılıyor...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 text-gray-800 dark:text-gray-100 transition-colors duration-300">
      <div className="max-w-[1400px] mx-auto flex flex-col h-[calc(100vh-4rem)]">

        {/* Header Section */}
        <div className="mb-6 flex flex-col xl:flex-row xl:items-start justify-between gap-4">
          
          {/* Left Column: Title & Primary Actions */}
          <div className="flex flex-col gap-3 shrink-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-black tracking-tight flex items-center gap-2 whitespace-nowrap">
                {isDesigner ? (
                  <span className="bg-gradient-to-r from-violet-700 via-indigo-700 to-violet-500 bg-clip-text text-transparent drop-shadow-sm">
                    Kampanya Yönetimi Takvimi (CRM)
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
              <button onClick={resetToToday} className="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 dark:border dark:border-violet-700/50 px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-violet-200 dark:hover:bg-violet-900/50 transition-colors">
                Bugün
              </button>

              <div className="flex items-center gap-1">
                <button onClick={prevMonth} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-full transition-colors text-gray-600 dark:text-gray-300">
                  <ChevronLeft size={20} />
                </button>
                <h2 className="text-lg md:text-xl font-bold min-w-[140px] text-center tabular-nums capitalize text-gray-800 dark:text-gray-100">
                  {format(currentDate, 'MMMM yyyy', { locale: tr })}
                </h2>
                <button onClick={nextMonth} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-full transition-colors text-gray-600 dark:text-gray-300">
                  <ChevronRight size={20} />
                </button>
              </div>

              <div className="h-6 w-px bg-gray-300 dark:bg-slate-600 mx-2 hidden md:block"></div>

              <button
                onClick={() => setIsSearchOpen(!isSearchOpen)}
                className={`p-1.5 transition-colors rounded-lg shadow-sm border ${
                  isSearchOpen || hasActiveFilters 
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

              <button
                onClick={() => setIsAnnBoardOpen(true)}
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
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white dark:border-slate-800">
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
                  {users.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name} {monthlyChampionId === u.id ? '🏆' : ''}
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

          {/* Calendar Grid Header */}
          <div className="grid grid-cols-7 gap-4 mb-4">
            {DAYS_OF_WEEK.map(day => (
              <div key={day} className="text-center text-xs font-bold text-gray-400 uppercase tracking-widest">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid Body */}
          <div className="grid grid-cols-7 gap-4 flex-1 content-start">
            {calendarDays.map((day) => {
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isTodayDate = isToday(day);
              const isDayWeekend = isWeekend(day);
              const dayEvents = getEventsForDay(day);
              const holidayName = getHolidayName(day);
              const isHoliday = !!holidayName;

              return (
                <div
                  key={day.toString()}
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
                      handleEventDrop(draggedEvent, day);
                      setDraggedEvent(null);
                    }
                  }}
                  className={`
                  relative min-h-[140px] p-4 rounded-xl border-2 transition-all duration-200 group
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
                                    monthlyChampionId={monthlyChampionId}
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
          monthlyChampionId={monthlyChampionId}
        />

        <ChangePasswordModal
          isOpen={isChangePasswordOpen}
          onClose={() => setIsChangePasswordOpen(false)}
          currentUser={loggedInDeptUser}
          onChangePassword={handleChangePassword}
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
          monthlyChampionId={monthlyChampionId}
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
          monthlyChampionId={monthlyChampionId}
        />

        <AnnouncementPopup 
          latestAnnouncement={filteredAnnouncements[0]} 
          currentUsername={currentUsername}
          currentUserId={loggedInDeptUser?.id || auth.currentUser?.uid || 'guest'}
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
      </div>

      {/* Footer */}
      <footer className="mt-8 pb-4 text-center">
        <p className="text-xs text-gray-400">
          Designed by <span className="font-medium text-gray-500">Metin Özer</span>
        </p>
      </footer>
    </div>
  );
}

export default App;