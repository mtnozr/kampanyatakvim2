import React, { useState, useEffect } from 'react';
import { X, Trash2, Plus, ShieldCheck, Lock, Users, Calendar, AlertTriangle, Building, UserPlus, LogOut, FileText, Download, Megaphone, Settings, Trophy, Activity, History, Edit2, Save } from 'lucide-react';
import { User, CalendarEvent, Department, DepartmentUser, Announcement, AnalyticsUser } from '../types';
import { calculateMonthlyChampion } from '../utils/gamification';
import { AVAILABLE_EMOJIS, URGENCY_CONFIGS } from '../constants';
import { changelog } from '../changelog';
import { format, addMonths } from 'date-fns';
import { tr } from 'date-fns/locale';
import { auth, db } from '../firebase';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, query, collection, where, getDocs } from 'firebase/firestore';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  events: CalendarEvent[];
  departments: Department[];
  onAddUser: (name: string, email: string, emoji: string, phone?: string) => void;
  onUpdateUser?: (id: string, updates: Partial<User>) => void;
  onDeleteUser: (id: string) => void;
  onDeleteEvent: (id: string) => void;
  onDeleteAllEvents: () => void;
  onAddDepartment: (name: string) => void;
  onDeleteDepartment: (id: string) => void;
  departmentUsers: DepartmentUser[];
  onAddDepartmentUser: (username: string, password: string, departmentId: string, isDesigner: boolean, isKampanyaYapan: boolean, isBusinessUnit: boolean, isAnalitik: boolean, email?: string) => void;
  onDeleteDepartmentUser: (id: string) => void;
  onUpdateDepartmentUser?: (id: string, updates: Partial<DepartmentUser> & { password?: string }) => void;
  onBulkAddEvents: (events: Partial<CalendarEvent>[]) => Promise<void>;
  onSetIsDesigner: (value: boolean) => void;
  announcements: Announcement[];
  onAddAnnouncement: (title: string, content: string, visibleTo: 'admin' | 'kampanya' | 'all') => void;
  onDeleteAnnouncement: (id: string) => void;
  autoThemeConfig: { enabled: boolean; time: string };
  onUpdateAutoThemeConfig: (config: { enabled: boolean; time: string }) => Promise<void>;
  monthlyChampionId?: string | null;
  // Analytics Personnel Props
  analyticsUsers?: AnalyticsUser[];
  onAddAnalyticsUser?: (name: string, email: string, emoji: string) => void;
  onDeleteAnalyticsUser?: (id: string) => void;
}

export const AdminModal: React.FC<AdminModalProps> = ({
  isOpen,
  onClose,
  users,
  events,
  departments,
  onAddUser,
  onUpdateUser,
  onDeleteUser,
  onDeleteEvent,
  onDeleteAllEvents,
  onAddDepartment,
  onDeleteDepartment,
  departmentUsers,
  onAddDepartmentUser,
  onDeleteDepartmentUser,
  onUpdateDepartmentUser,
  onBulkAddEvents,
  onSetIsDesigner,
  announcements,
  onAddAnnouncement,
  onDeleteAnnouncement,
  autoThemeConfig,
  onUpdateAutoThemeConfig,
  monthlyChampionId,
  analyticsUsers = [],
  onAddAnalyticsUser,
  onDeleteAnalyticsUser
}) => {
  const [localThemeConfig, setLocalThemeConfig] = useState(autoThemeConfig);
  const [authUser, setAuthUser] = useState<FirebaseUser | null>(null);

  useEffect(() => {
    setLocalThemeConfig(autoThemeConfig);
  }, [autoThemeConfig]);

  const handleThemeConfigChange = (newConfig: { enabled: boolean; time: string }) => {
    setLocalThemeConfig(newConfig);
    onUpdateAutoThemeConfig(newConfig);
  };

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState<'users' | 'events' | 'departments' | 'dept-users' | 'import-export' | 'announcements' | 'settings' | 'active-users' | 'changelog' | 'analytics-users'>('users');
  const [importText, setImportText] = useState('');

  // Loading state for auth check
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // User Form States
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('');

  // Edit User States
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUserName, setEditUserName] = useState('');
  const [editUserEmail, setEditUserEmail] = useState('');
  const [editUserPhone, setEditUserPhone] = useState('');
  const [editUserEmoji, setEditUserEmoji] = useState('');

  // Analytics Personnel Form States
  const [newAnalyticsName, setNewAnalyticsName] = useState('');
  const [newAnalyticsEmail, setNewAnalyticsEmail] = useState('');
  const [selectedAnalyticsEmoji, setSelectedAnalyticsEmoji] = useState('');

  // Announcement Form States
  const [newAnnTitle, setNewAnnTitle] = useState('');
  const [newAnnContent, setNewAnnContent] = useState('');
  const [newAnnVisibleTo, setNewAnnVisibleTo] = useState<'admin' | 'kampanya' | 'all'>('all');

  // Department Form States
  const [newDeptName, setNewDeptName] = useState('');

  // Department User Form States
  const [newDeptUsername, setNewDeptUsername] = useState('');
  const [newDeptPassword, setNewDeptPassword] = useState('');
  const [newDeptEmail, setNewDeptEmail] = useState('');
  const [newDeptUserDeptId, setNewDeptUserDeptId] = useState('');
  const [newDeptUserIsDesigner, setNewDeptUserIsDesigner] = useState(false);
  const [newDeptUserIsKampanyaYapan, setNewDeptUserIsKampanyaYapan] = useState(false);
  const [newDeptUserIsBusinessUnit, setNewDeptUserIsBusinessUnit] = useState(false);
  const [newDeptUserIsAnalitik, setNewDeptUserIsAnalitik] = useState(false);

  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  const [error, setError] = useState('');

  // Delete All Confirmation State
  const [isDeleteConfirming, setIsDeleteConfirming] = useState(false);
  const [gamificationMsg, setGamificationMsg] = useState('');
  const [gamificationEnabled, setGamificationEnabled] = useState(true);
  const [requestSubmissionEnabled, setRequestSubmissionEnabled] = useState(true);

  // Fetch initial gamification & request submission config
  useEffect(() => {
    if (isOpen && activeTab === 'settings') {
      const fetchConfig = async () => {
        try {
          // Gamification Config
          const docRef = doc(db, "system_settings", "gamification_config");
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setGamificationEnabled(docSnap.data().enabled);
          }

          // Request Submission Config
          const reqDocRef = doc(db, "system_settings", "request_submission_config");
          const reqDocSnap = await getDoc(reqDocRef);
          if (reqDocSnap.exists()) {
            setRequestSubmissionEnabled(reqDocSnap.data().enabled);
          }
        } catch (e) {
          console.error("Failed to fetch settings config", e);
        }
      };
      fetchConfig();
    }
  }, [isOpen, activeTab]);

  const handleGamificationToggle = async (enabled: boolean) => {
    setGamificationEnabled(enabled);
    try {
      await setDoc(doc(db, "system_settings", "gamification_config"), { enabled });
    } catch (e) {
      console.error("Failed to save gamification config", e);
      setGamificationEnabled(!enabled); // Revert on error
    }
  };

  const handleRequestSubmissionToggle = async (enabled: boolean) => {
    setRequestSubmissionEnabled(enabled);
    try {
      await setDoc(doc(db, "system_settings", "request_submission_config"), { enabled });
    } catch (e) {
      console.error("Failed to save request submission config", e);
      setRequestSubmissionEnabled(!enabled); // Revert on error
    }
  };

  const handleForceCalculate = async () => {
    setGamificationMsg('Hesaplanıyor (Bu ayın verileriyle)...');
    // Test için: Bir sonraki ayı referans veriyoruz ki, fonksiyon "geçen ay" (yani bu ay) olarak hesaplasın.
    const result = await calculateMonthlyChampion(true, addMonths(new Date(), 1));
    if (result) {
      const winner = users.find(u => u.id === result.userId);
      setGamificationMsg(`BU AYIN Şampiyonu: ${winner ? winner.name : 'Bilinmeyen'} (${result.campaignCount} kampanya)`);
    } else {
      setGamificationMsg('Şampiyon belirlenemedi (Yetersiz kampanya veya beraberlik)');
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Check permissions
        const q = query(collection(db, "departmentUsers"), where("uid", "==", user.uid));
        try {
          const snap = await getDocs(q);
          if (!snap.empty) {
            // This is a Department User - NOT authorized for Admin Panel
            // Even Designer role users cannot access Admin Panel (only Super Admin can)
            setAuthUser(null);
          } else {
            // No department user record found -> Assume Super Admin
            setAuthUser(user);
            onSetIsDesigner(true);
          }
        } catch (e) {
          console.error("Admin auth check failed", e);
          setAuthUser(null);
        }
      } else {
        setAuthUser(null);
      }
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, [onSetIsDesigner]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Success is handled by onAuthStateChanged
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        setError('Hatalı e-posta veya şifre.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Çok fazla başarısız deneme. Lütfen bekleyin.');
      } else {
        setError('Giriş yapılamadı: ' + err.message);
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error(e);
    }
  };



  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newName.trim() || !newEmail.trim()) {
      setError('Lütfen isim ve e-posta alanlarını doldurunuz.');
      return;
    }

    if (!selectedEmoji) {
      setError('Lütfen bir emoji seçiniz.');
      return;
    }

    try {
      await onAddUser(newName, newEmail, selectedEmoji, newPhone || undefined);

      // Reset form
      setNewName('');
      setNewEmail('');
      setNewPhone('');
      setSelectedEmoji('');
      setError('');
    } catch (err: any) {
      console.error(err);
      setError('Kullanıcı eklenirken hata oluştu: ' + err.message);
    }
  };

  const startEditUser = (user: User) => {
    setEditingUser(user);
    setEditUserName(user.name);
    setEditUserEmail(user.email);
    setEditUserPhone(user.phone || '');
    setEditUserEmoji(user.emoji || '');
  };

  const handleEditUser = async () => {
    if (!editingUser || !onUpdateUser) return;
    if (!editUserName.trim() || !editUserEmail.trim()) {
      setError('Ad ve e-posta zorunludur.');
      return;
    }

    try {
      await onUpdateUser(editingUser.id, {
        name: editUserName.trim(),
        email: editUserEmail.trim(),
        phone: editUserPhone.trim() || undefined,
        emoji: editUserEmoji || undefined
      });
      setEditingUser(null);
      setError('');
    } catch (err: any) {
      console.error(err);
      setError('Güncelleme hatası: ' + err.message);
    }
  };

  const handleAddDeptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName.trim()) {
      setError('Birim adı boş olamaz.');
      return;
    }
    onAddDepartment(newDeptName);
    setNewDeptName('');
    setError('');
  };

  const handleAnnSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnTitle.trim() || !newAnnContent.trim()) {
      setError('Başlık ve içerik alanları zorunludur.');
      return;
    }
    onAddAnnouncement(newAnnTitle, newAnnContent, newAnnVisibleTo);
    setNewAnnTitle('');
    setNewAnnContent('');
    setNewAnnVisibleTo('all');
    setError('');
  };

  const handleEditDeptUser = (user: DepartmentUser) => {
    setEditingUserId(user.id);
    setNewDeptUsername(user.username);
    const email = user.email || '';
    setNewDeptEmail(email.endsWith('@kampanyatakvim.com') ? email.replace('@kampanyatakvim.com', '') : email);
    setNewDeptUserDeptId(user.departmentId);
    setNewDeptUserIsDesigner(!!user.isDesigner);
    setNewDeptUserIsKampanyaYapan(!!user.isKampanyaYapan);
    setNewDeptUserIsBusinessUnit(!!user.isBusinessUnit);
    setNewDeptUserIsAnalitik(!!user.isAnalitik);
    setNewDeptPassword(''); // Clear password field
    setError('');
  };

  const handleCancelEdit = () => {
    setEditingUserId(null);
    setNewDeptUsername('');
    setNewDeptPassword('');
    setNewDeptEmail('');
    setNewDeptUserDeptId('');
    setNewDeptUserIsDesigner(false);
    setNewDeptUserIsKampanyaYapan(false);
    setNewDeptUserIsBusinessUnit(false);
    setNewDeptUserIsAnalitik(false);
    setError('');
  };

  // --- Department User Management Handler ---
  const handleAddDeptUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptUsername.trim()) {
      setError('Ad Soyad gereklidir.');
      return;
    }
    if (!newDeptEmail.trim()) {
      setError('Kullanıcı adı gereklidir.');
      return;
    }
    // Password validation only for new users or if password is provided
    if (!editingUserId && !newDeptPassword.trim()) {
      setError('Şifre gereklidir.');
      return;
    }
    if (!newDeptUserDeptId) {
      setError('Birim seçimi gereklidir.');
      return;
    }

    const finalEmail = newDeptEmail.includes('@') ? newDeptEmail : `${newDeptEmail.trim().toLowerCase().replace(/\s+/g, '')}@kampanyatakvim.com`;

    if (editingUserId) {
      if (onUpdateDepartmentUser) {
        const updates: any = {
          username: newDeptUsername,
          departmentId: newDeptUserDeptId,
          isDesigner: newDeptUserIsDesigner,
          isKampanyaYapan: newDeptUserIsKampanyaYapan,
          isBusinessUnit: newDeptUserIsBusinessUnit,
          isAnalitik: newDeptUserIsAnalitik,
          email: finalEmail
        };
        if (newDeptPassword.trim()) {
          updates.password = newDeptPassword.trim();
        }
        onUpdateDepartmentUser(editingUserId, updates);
        handleCancelEdit(); // Reset form
      }
    } else {
      // Check if email already exists
      const existingUser = departmentUsers.find(
        u => u.email && u.email.toLowerCase() === finalEmail.toLowerCase()
      );
      if (existingUser) {
        setError('Bu kullanıcı adı zaten kullanılıyor.');
        return;
      }

      onAddDepartmentUser(newDeptUsername, newDeptPassword, newDeptUserDeptId, newDeptUserIsDesigner, newDeptUserIsKampanyaYapan, newDeptUserIsBusinessUnit, newDeptUserIsAnalitik, finalEmail);
      // Reset form
      setNewDeptUsername('');
      setNewDeptPassword('');
      setNewDeptEmail('');
      setNewDeptUserDeptId('');
      setNewDeptUserIsDesigner(false);
      setNewDeptUserIsKampanyaYapan(false);
      setNewDeptUserIsBusinessUnit(false);
      setNewDeptUserIsAnalitik(false);
      setError('');
    }
  };

  // --- Import / Export Handlers ---
  const handleExportCSV = () => {
    // Header
    let csvContent = "Title,Date,Urgency,Description,Department,Assignee\n";

    events.forEach(ev => {
      const dept = departments.find(d => d.id === ev.departmentId)?.name || '';
      const user = users.find(u => u.id === ev.assigneeId)?.name || '';
      const dateStr = format(ev.date, 'yyyy-MM-dd');
      // Escape commas in content
      const safeTitle = `"${ev.title.replace(/"/g, '""')}"`;
      const safeDesc = `"${(ev.description || '').replace(/"/g, '""')}"`;
      const safeDept = `"${dept.replace(/"/g, '""')}"`;
      const safeUser = `"${user.replace(/"/g, '""')}"`;

      csvContent += `${safeTitle},${dateStr},${ev.urgency},${safeDesc},${safeDept},${safeUser}\n`;
    });

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `kampanya_takvimi_export_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportCSV = async () => {
    if (!importText.trim()) {
      setError('Lütfen CSV verisi giriniz.');
      return;
    }

    try {
      const lines = importText.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase()); // Title, Date, Urgency...

      // Basic validation
      if (lines.length < 2) {
        setError('CSV içeriği boş veya sadece başlıktan oluşuyor.');
        return;
      }

      const newEvents: Partial<CalendarEvent>[] = [];

      // Helper to parse CSV line respecting quotes
      const parseCSVLine = (line: string) => {
        const result = [];
        let start = 0;
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          if (line[i] === '"') inQuotes = !inQuotes;
          else if (line[i] === ',' && !inQuotes) {
            result.push(line.substring(start, i).replace(/^"|"$/g, '').replace(/""/g, '"'));
            start = i + 1;
          }
        }
        result.push(line.substring(start).replace(/^"|"$/g, '').replace(/""/g, '"'));
        return result;
      };

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const cols = parseCSVLine(line);
        // Map based on index assuming standard order: Title, Date, Urgency, Desc, Dept, Assignee
        // Or strictly strictly follow the order we export: Title,Date,Urgency,Description,Department,Assignee

        if (cols.length < 3) continue; // Skip invalid lines

        const title = cols[0];
        const dateStr = cols[1];
        const urgency = cols[2] as any;
        const description = cols[3];
        const deptName = cols[4];
        const userName = cols[5];

        // Resolve IDs
        const deptId = departments.find(d => d.name === deptName)?.id;
        const assigneeId = users.find(u => u.name === userName)?.id;

        newEvents.push({
          title,
          date: new Date(dateStr),
          urgency: URGENCY_CONFIGS[urgency] ? urgency : 'Medium',
          description,
          departmentId: deptId,
          assigneeId: assigneeId
        });
      }

      await onBulkAddEvents(newEvents);
      setImportText('');
      setError('');

    } catch (e) {
      console.error(e);
      setError('Import hatası: CSV formatını kontrol ediniz.');
    }
  };

  const handleDeleteAllClick = () => {
    if (isDeleteConfirming) {
      onDeleteAllEvents();
      setIsDeleteConfirming(false);
    } else {
      setIsDeleteConfirming(true);
      // Reset confirmation state after 3 seconds
      setTimeout(() => setIsDeleteConfirming(false), 3000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col h-[80vh] md:h-auto md:max-h-[90vh] transition-colors">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 shrink-0 transition-colors">
          <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100">
            <ShieldCheck className="text-violet-600 dark:text-violet-400" size={24} />
            <h2 className="text-lg font-bold">Yönetici Paneli</h2>
          </div>
          <div className="flex items-center gap-2">
            {authUser && (
              <button
                onClick={handleLogout}
                className="text-xs bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-3 py-1.5 rounded-lg font-medium hover:bg-red-100 dark:hover:bg-red-900/30 flex items-center gap-1 transition-colors"
              >
                <LogOut size={14} /> Çıkış
              </button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        {!authUser ? (
          // Login View
          <form onSubmit={handleLogin} className="p-8 flex flex-col gap-4 items-center justify-center flex-1">
            <div className="p-4 bg-violet-50 dark:bg-violet-900/20 rounded-full text-violet-500 dark:text-violet-400 mb-2 transition-colors">
              <Lock size={32} />
            </div>
            <h3 className="text-xl font-semibold text-gray-800 dark:text-white">Admin Girişi</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-xs">
              Yönetim paneline erişmek için yetkili e-posta ve şifrenizi giriniz.
            </p>

            <div className="w-full max-w-xs space-y-3">
              <input
                type="email"
                placeholder="E-posta"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-violet-500 outline-none text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
                autoFocus
              />
              <input
                type="password"
                placeholder="Şifre"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-violet-500 outline-none text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
              />
              {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs rounded-lg text-center transition-colors">{error}</div>}
            </div>

            <button type="submit" className="w-full max-w-xs bg-violet-600 hover:bg-violet-700 dark:bg-violet-600 dark:hover:bg-violet-700 text-white py-2 rounded-lg font-medium transition shadow-lg shadow-violet-200 dark:shadow-none mt-2">
              Giriş Yap
            </button>
          </form>
        ) : (
          // Authenticated View
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-gray-100 dark:border-slate-700 shrink-0 overflow-x-auto p-1 transition-colors">
              <button
                onClick={() => setActiveTab('users')}
                className={`flex-1 py-3 px-2 text-xs md:text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'users' ? 'border-violet-600 text-violet-600 dark:text-violet-400 bg-violet-50/50 dark:bg-violet-900/20' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
              >
                <Users size={16} /> Personel
              </button>
              <button
                onClick={() => setActiveTab('departments')}
                className={`flex-1 py-3 px-2 text-xs md:text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'departments' ? 'border-violet-600 text-violet-600 dark:text-violet-400 bg-violet-50/50 dark:bg-violet-900/20' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
              >
                <Building size={16} /> Birimler
              </button>
              <button
                onClick={() => setActiveTab('dept-users')}
                className={`flex-1 py-3 px-2 text-xs md:text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'dept-users' ? 'border-violet-600 text-violet-600 dark:text-violet-400 bg-violet-50/50 dark:bg-violet-900/20' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
              >
                <UserPlus size={16} /> Birim Kullanıcıları
              </button>
              <button
                onClick={() => setActiveTab('import-export')}
                className={`flex-1 py-3 px-2 text-xs md:text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'import-export' ? 'border-violet-600 text-violet-600 dark:text-violet-400 bg-violet-50/50 dark:bg-violet-900/20' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
              >
                <FileText size={16} /> İçe/Dışa Aktar
              </button>
              <button
                onClick={() => setActiveTab('events')}
                className={`flex-1 py-3 px-2 text-xs md:text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'events' ? 'border-violet-600 text-violet-600 dark:text-violet-400 bg-violet-50/50 dark:bg-violet-900/20' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
              >
                <Calendar size={16} /> Kampanyalar
              </button>
              <button
                onClick={() => setActiveTab('announcements')}
                className={`flex-1 py-3 px-2 text-xs md:text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'announcements' ? 'border-violet-600 text-violet-600 dark:text-violet-400 bg-violet-50/50 dark:bg-violet-900/20' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
              >
                <Megaphone size={16} /> Duyurular
              </button>
              <button
                onClick={() => setActiveTab('active-users')}
                className={`flex-1 py-3 px-2 text-xs md:text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'active-users' ? 'border-violet-600 text-violet-600 dark:text-violet-400 bg-violet-50/50 dark:bg-violet-900/20' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
              >
                <Activity size={16} /> Aktif Kullanıcılar
              </button>
              <button
                onClick={() => setActiveTab('changelog')}
                className={`flex-1 py-3 px-2 text-xs md:text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'changelog' ? 'border-violet-600 text-violet-600 dark:text-violet-400 bg-violet-50/50 dark:bg-violet-900/20' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
              >
                <History size={16} /> Sürüm Notları
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`flex-1 py-3 px-2 text-xs md:text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'settings' ? 'border-violet-600 text-violet-600 dark:text-violet-400 bg-violet-50/50 dark:bg-violet-900/20' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
              >
                <Settings size={16} /> Ayarlar
              </button>
              <button
                onClick={() => setActiveTab('analytics-users')}
                className={`flex-1 py-3 px-2 text-xs md:text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'analytics-users' ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/20' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
              >
                📊 Analitik Personel
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-slate-900/50 relative transition-colors">

              {/* --- USERS TAB --- */}
              {activeTab === 'users' && (
                <div className="flex flex-col h-full">
                  {/* Add User Form */}
                  <div className="p-6 bg-white dark:bg-slate-800 border-b dark:border-slate-700 space-y-4 shrink-0 transition-colors">
                    <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Yeni Personel Ekle</h3>
                    <form onSubmit={handleAddSubmit} className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block">İsim Soyisim</label>
                          <input
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder="Örn: Ali Veli"
                            className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-violet-500 outline-none text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block">E-posta</label>
                          <input
                            type="email"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                            placeholder="ali@mail.com"
                            className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-violet-500 outline-none text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block">Telefon (Jabber)</label>
                          <input
                            type="tel"
                            value={newPhone}
                            onChange={(e) => setNewPhone(e.target.value)}
                            placeholder="5551234567"
                            className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-violet-500 outline-none text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 block">Emoji Seçimi</label>

                        <div className="grid grid-cols-8 gap-2 p-3 bg-gray-50 dark:bg-slate-900/50 rounded-lg border border-gray-100 dark:border-slate-700 max-h-32 overflow-y-auto custom-scrollbar transition-colors">
                          {AVAILABLE_EMOJIS.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => setSelectedEmoji(emoji)}
                              className={`
                                w-8 h-8 flex items-center justify-center rounded-full text-lg transition-all
                                ${selectedEmoji === emoji
                                  ? 'bg-violet-600 ring-2 ring-violet-300 dark:ring-violet-500/50 transform scale-110 shadow-md'
                                  : 'bg-white dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600'}
                              `}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex justify-between items-center pt-2">
                        <p className="text-red-500 text-xs h-4">{error}</p>
                        <button
                          type="submit"
                          className="px-6 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 flex items-center gap-2 shadow-lg shadow-violet-200 dark:shadow-none text-sm transition-colors"
                        >
                          <Plus size={16} /> Ekle
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Users List */}
                  <div className="p-6">
                    <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-4">Mevcut Personel ({users.length})</h3>
                    <div className="space-y-2">
                      {users.map(user => (
                        <div key={user.id} className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-gray-100 dark:border-slate-700 flex items-center justify-between group hover:shadow-sm transition-all">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-xl shadow-sm">
                              {user.emoji}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-800 dark:text-gray-200 text-sm">
                                {user.name} {monthlyChampionId === user.id ? '🏆' : ''}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                              {user.phone && (
                                <p className="text-[10px] text-green-600 dark:text-green-400">📞 {user.phone}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {onUpdateUser && (
                              <button
                                onClick={() => startEditUser(user)}
                                className="p-2 text-gray-300 dark:text-gray-600 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                title="Düzenle"
                              >
                                <Edit2 size={16} />
                              </button>
                            )}
                            <button
                              onClick={() => onDeleteUser(user.id)}
                              className="p-2 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                              title="Personeli Sil"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                      {users.length === 0 && (
                        <p className="text-gray-400 dark:text-gray-500 text-center py-4 text-sm">Henüz personel eklenmemiş.</p>
                      )}
                    </div>
                  </div>

                  {/* Edit User Modal */}
                  {editingUser && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
                      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md m-4 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-blue-50/50 dark:bg-slate-800/50">
                          <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                            <Edit2 size={20} className="text-blue-600" />
                            Personeli Düzenle
                          </h3>
                          <button onClick={() => setEditingUser(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                            <X size={20} />
                          </button>
                        </div>
                        <div className="p-6 space-y-4">
                          <div>
                            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block">İsim Soyisim</label>
                            <input
                              type="text"
                              value={editUserName}
                              onChange={(e) => setEditUserName(e.target.value)}
                              className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block">E-posta</label>
                            <input
                              type="email"
                              value={editUserEmail}
                              onChange={(e) => setEditUserEmail(e.target.value)}
                              className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block">Telefon (Jabber)</label>
                            <input
                              type="tel"
                              value={editUserPhone}
                              onChange={(e) => setEditUserPhone(e.target.value)}
                              placeholder="5551234567"
                              className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 block">Emoji</label>
                            <div className="grid grid-cols-8 gap-2 p-3 bg-gray-50 dark:bg-slate-900/50 rounded-lg border border-gray-100 dark:border-slate-700 max-h-32 overflow-y-auto">
                              {AVAILABLE_EMOJIS.map((emoji) => (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={() => setEditUserEmoji(emoji)}
                                  className={`w-8 h-8 flex items-center justify-center rounded-full text-lg transition-all ${editUserEmoji === emoji ? 'bg-blue-600 ring-2 ring-blue-300 transform scale-110 shadow-md' : 'bg-white dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600'}`}
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </div>
                          {error && <p className="text-red-500 text-xs">{error}</p>}
                          <div className="flex justify-end gap-3 pt-2">
                            <button
                              onClick={() => setEditingUser(null)}
                              className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                            >
                              İptal
                            </button>
                            <button
                              onClick={handleEditUser}
                              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm flex items-center gap-2 transition-colors"
                            >
                              <Save size={16} /> Kaydet
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* --- DEPARTMENTS TAB --- */}
              {activeTab === 'departments' && (
                <div className="flex flex-col h-full">
                  {/* Add Department Form */}
                  <div className="p-6 bg-white dark:bg-slate-800 border-b dark:border-slate-700 space-y-4 shrink-0 transition-colors">
                    <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Yeni İş Birimi Ekle</h3>
                    <form onSubmit={handleAddDeptSubmit} className="flex gap-3 items-start">
                      <div className="flex-1">
                        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block">Birim Adı</label>
                        <input
                          type="text"
                          value={newDeptName}
                          onChange={(e) => setNewDeptName(e.target.value)}
                          placeholder="Örn: Pazarlama, İK..."
                          className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-violet-500 outline-none text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
                        />
                      </div>
                      <button type="submit" className="mt-5 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 flex items-center gap-2 shadow-lg shadow-violet-200 dark:shadow-none text-sm transition-colors">
                        <Plus size={16} /> Ekle
                      </button>
                    </form>
                    {error && <p className="text-red-500 text-xs">{error}</p>}
                  </div>

                  {/* Departments List */}
                  <div className="p-6">
                    <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-4">Tanımlı Birimler ({departments.length})</h3>
                    <div className="space-y-2">
                      {departments.map(dept => (
                        <div key={dept.id} className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-gray-100 dark:border-slate-700 flex items-center justify-between group hover:shadow-sm transition-all">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-500 dark:text-blue-400 flex items-center justify-center shadow-sm">
                              <Building size={18} />
                            </div>
                            <p className="font-semibold text-gray-800 dark:text-gray-200 text-sm">{dept.name}</p>
                          </div>
                          <button
                            onClick={() => onDeleteDepartment(dept.id)}
                            className="p-2 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Birimi Sil"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                      {departments.length === 0 && (
                        <p className="text-gray-400 dark:text-gray-500 text-center py-4 text-sm">Henüz birim eklenmemiş.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* --- DEPARTMENT USERS TAB --- */}
              {activeTab === 'dept-users' && (
                <div className="flex flex-col h-full">
                  {/* Add Department User Form */}
                  <div className="p-6 bg-white dark:bg-slate-800 border-b dark:border-slate-700 space-y-4 shrink-0 transition-colors">
                    <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide flex items-center gap-2">
                      {editingUserId ? (
                        <>
                          <Edit2 size={14} /> Kullanıcı Düzenle
                        </>
                      ) : (
                        <>
                          <UserPlus size={14} /> Yeni Birim Kullanıcısı Ekle
                        </>
                      )}
                    </h3>

                    <form onSubmit={handleAddDeptUser} className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block">Ad Soyad</label>
                          <input
                            type="text"
                            value={newDeptUsername}
                            onChange={(e) => setNewDeptUsername(e.target.value)}
                            placeholder="Örn: Ali Yılmaz"
                            className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-violet-500 outline-none text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block">
                            Şifre {editingUserId && <span className="font-normal text-gray-400">(Değişmeyecekse boş bırakın)</span>}
                          </label>
                          <input
                            type="text"
                            value={newDeptPassword}
                            onChange={(e) => setNewDeptPassword(e.target.value)}
                            placeholder={editingUserId ? "Değiştirmek için yeni şifre girin" : "sifre123"}
                            className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-violet-500 outline-none text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block">Kullanıcı Adı</label>
                          <input
                            type="text"
                            value={newDeptEmail}
                            onChange={(e) => setNewDeptEmail(e.target.value)}
                            placeholder="ornek_kullanici"
                            className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-violet-500 outline-none text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block">Birim</label>
                          <select
                            value={newDeptUserDeptId}
                            onChange={(e) => setNewDeptUserDeptId(e.target.value)}
                            className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-violet-500 outline-none text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white transition-colors"
                          >
                            <option value="">Seçiniz</option>
                            {departments.map(d => (
                              <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newDeptUserIsDesigner}
                            onChange={(e) => {
                              setNewDeptUserIsDesigner(e.target.checked);
                            }}
                            className="w-4 h-4 rounded border-gray-300 dark:border-slate-600 text-violet-600 focus:ring-violet-500 bg-white dark:bg-slate-700"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Designer Yetkisi Ver</span>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">(Kampanya düzenleme izni)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newDeptUserIsKampanyaYapan}
                            onChange={(e) => {
                              setNewDeptUserIsKampanyaYapan(e.target.checked);
                            }}
                            className="w-4 h-4 rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 bg-white dark:bg-slate-700"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Kampanya Yapan Yetkisi Ver</span>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">(Tüm kampanyaları görüntüleme izni)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newDeptUserIsBusinessUnit}
                            onChange={(e) => {
                              setNewDeptUserIsBusinessUnit(e.target.checked);
                            }}
                            className="w-4 h-4 rounded border-gray-300 dark:border-slate-600 text-orange-600 focus:ring-orange-500 bg-white dark:bg-slate-700"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">İş Birimi Yetkisi Ver</span>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">(İş talebi oluşturma izni)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newDeptUserIsAnalitik}
                            onChange={(e) => {
                              setNewDeptUserIsAnalitik(e.target.checked);
                            }}
                            className="w-4 h-4 rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 bg-white dark:bg-slate-700"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Analitik Yetkisi Ver</span>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">(Analitik görevleri görüntüleme izni)</span>
                        </label>
                      </div>
                      <div className="flex justify-between items-center">
                        <p className="text-red-500 text-xs h-4">{error}</p>
                        <div className="flex gap-2">
                          {editingUserId && (
                            <button
                              type="button"
                              onClick={handleCancelEdit}
                              className="px-4 py-2 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600 text-sm flex items-center gap-2 transition-colors"
                            >
                              <X size={16} /> İptal
                            </button>
                          )}
                          <button
                            type="submit"
                            className={`px-4 py-2 rounded-lg text-white text-sm flex items-center gap-2 shadow-lg dark:shadow-none transition-colors ${editingUserId
                              ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'
                              : 'bg-violet-600 hover:bg-violet-700 shadow-violet-200'
                              }`}
                          >
                            {editingUserId ? <><Edit2 size={16} /> Güncelle</> : <><Plus size={16} /> Ekle</>}
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>

                  {/* Department Users List */}
                  <div className="p-6 flex-1 overflow-y-auto">
                    <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-4">
                      Mevcut Kullanıcılar ({departmentUsers.length})
                    </h3>
                    <div className="space-y-2">
                      {departmentUsers.map(user => {
                        const dept = departments.find(d => d.id === user.departmentId);
                        return (
                          <div key={user.id} className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-gray-100 dark:border-slate-700 flex items-center justify-between group hover:shadow-sm transition-all">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${user.isDesigner
                                ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400'
                                : user.isKampanyaYapan
                                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                                  : user.isBusinessUnit
                                    ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'
                                    : 'bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400'
                                }`}>
                                {user.username.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-semibold text-gray-800 dark:text-gray-200 text-sm">{user.username}</p>
                                  {user.isDesigner && (
                                    <span className="text-[10px] bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 px-1.5 py-0.5 rounded font-medium">Designer</span>
                                  )}
                                  {user.isKampanyaYapan && (
                                    <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded font-medium">Kampanya Yapan</span>
                                  )}
                                  {user.isBusinessUnit && (
                                    <span className="text-[10px] bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-1.5 py-0.5 rounded font-medium">İş Birimi</span>
                                  )}
                                  {user.isAnalitik && (
                                    <span className="text-[10px] bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400 px-1.5 py-0.5 rounded font-medium">Analitik</span>
                                  )}
                                  {user.hasDefaultPassword !== false && (
                                    <span className="text-[10px] bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-1.5 py-0.5 rounded font-medium" title="Varsayılan şifre kullanıyor olabilir">⚠️ Varsayılan Şifre</span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{dept ? dept.name : 'Silinmiş Birim'} • {user.email || 'E-posta yok'}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleEditDeptUser(user)}
                                className="p-2 text-gray-300 dark:text-gray-600 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                title="Düzenle"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                onClick={() => onDeleteDepartmentUser(user.id)}
                                className="p-2 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                title="Kullanıcıyı Sil"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      {departmentUsers.length === 0 && (
                        <p className="text-gray-400 dark:text-gray-500 text-center py-4 text-sm">Henüz birim kullanıcısı eklenmemiş.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* --- EVENTS TAB --- */}
              {activeTab === 'events' && (
                <div className="flex flex-col h-full">
                  <div className="p-6 bg-red-50 dark:bg-red-900/10 border-b border-red-100 dark:border-red-900/20 flex items-center justify-between shrink-0 transition-colors">
                    <div className="flex items-center gap-3 text-red-800 dark:text-red-400">
                      <AlertTriangle size={20} />
                      <div>
                        <h4 className="font-bold text-sm">Toplu İşlem</h4>
                        <p className="text-xs text-red-600 dark:text-red-400/80 opacity-80">Tüm takvimi sıfırlamak için kullanılır.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleDeleteAllClick}
                      disabled={events.length === 0}
                      className={`
                          px-4 py-2 text-white text-xs font-bold rounded-lg shadow-sm transition-all
                          ${isDeleteConfirming
                          ? 'bg-red-800 hover:bg-red-900 ring-2 ring-red-400 ring-offset-1 dark:ring-offset-slate-800'
                          : 'bg-red-600 hover:bg-red-700'} 
                          disabled:opacity-50 disabled:cursor-not-allowed
                        `}
                    >
                      {isDeleteConfirming ? 'EMİN MİSİN?' : 'TÜMÜNÜ SİL'}
                    </button>
                  </div>

                  <div className="p-6">
                    <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-4">Aktif Kampanyalar ({events.length})</h3>
                    <div className="space-y-2 pb-6">
                      {events.length === 0 ? (
                        <div className="text-center py-10 opacity-50">
                          <Calendar size={48} className="mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                          <p className="text-gray-500 dark:text-gray-400 text-sm">Henüz kampanya bulunmuyor.</p>
                        </div>
                      ) : (
                        [...events].sort((a, b) => b.date.getTime() - a.date.getTime()).map(event => {
                          const config = URGENCY_CONFIGS[event.urgency];
                          return (
                            <div key={event.id} className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-gray-100 dark:border-slate-700 flex items-center justify-between group hover:shadow-sm transition-all">
                              <div className="flex items-center gap-4">
                                <div className={`w-2 h-10 rounded-full ${config.colorBg} border border-opacity-20 ${config.colorBorder}`}></div>
                                <div>
                                  <h4 className="font-semibold text-gray-800 dark:text-gray-200 text-sm">{event.title}</h4>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-slate-700 px-2 py-0.5 rounded">
                                      {format(event.date, 'd MMMM yyyy', { locale: tr })}
                                    </span>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${config.colorBg} ${config.colorText} border border-opacity-20 ${config.colorBorder}`}>
                                      {config.label}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <button
                                onClick={() => onDeleteEvent(event.id)}
                                className="p-2 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                title="Kampanyayı Sil"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* --- IMPORT / EXPORT TAB --- */}
              {activeTab === 'import-export' && (
                <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900/50 transition-colors">
                  <div className="p-6 space-y-8">

                    {/* Export Section */}
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm transition-colors">
                      <div className="flex items-start gap-4">
                        <div className="p-3 bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 rounded-lg">
                          <Download size={24} />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-1">Dışa Aktar (CSV)</h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                            Mevcut tüm kampanyaları, birimleri ve atanan kişileri içeren bir CSV dosyası indirir.
                            Yedekleme veya Excel'de raporlama için kullanabilirsiniz.
                          </p>
                          <button
                            onClick={handleExportCSV}
                            className="px-4 py-2 bg-slate-800 dark:bg-slate-700 text-white rounded-lg text-sm font-medium hover:bg-slate-900 dark:hover:bg-slate-600 flex items-center gap-2 transition-colors"
                          >
                            <Download size={16} /> İndir (.csv)
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Import Section */}
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm transition-colors">
                      <div className="flex items-start gap-4">
                        <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg">
                          <FileText size={24} />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-1">İçe Aktar (CSV Yükle)</h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                            CSV formatındaki verileri yapıştırarak toplu kampanya ekleyebilirsiniz.
                            Format: `Title, Date, Urgency, Description, Department, Assignee`
                          </p>
                          <textarea
                            value={importText}
                            onChange={(e) => setImportText(e.target.value)}
                            className="w-full h-32 p-3 text-xs font-mono border dark:border-slate-600 rounded-lg mb-3 focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
                            placeholder='Örn: "Yaz Kampanyası",2024-06-01,High,"Açıklama","Pazarlama","Ahmet Yılmaz"'
                          />
                          <div className="flex justify-between items-center">
                            {error && <span className="text-red-500 text-xs">{error}</span>}
                            <button
                              onClick={handleImportCSV}
                              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 flex items-start gap-2 ml-auto shadow-lg shadow-emerald-200 dark:shadow-none transition-colors"
                            >
                              <FileText size={16} /> İçe Aktar
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              )}

              {/* --- ANNOUNCEMENTS TAB --- */}
              {activeTab === 'announcements' && (
                <div className="flex flex-col h-full">
                  {/* Add Announcement Form */}
                  <div className="p-6 bg-white dark:bg-slate-800 border-b dark:border-slate-700 space-y-4 shrink-0 transition-colors">
                    <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Yeni Duyuru Ekle</h3>
                    <form onSubmit={handleAnnSubmit} className="space-y-3">
                      <div>
                        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block">Başlık</label>
                        <input
                          type="text"
                          value={newAnnTitle}
                          onChange={(e) => setNewAnnTitle(e.target.value)}
                          placeholder="Duyuru başlığı..."
                          className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-violet-500 outline-none text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block">İçerik</label>
                        <textarea
                          value={newAnnContent}
                          onChange={(e) => setNewAnnContent(e.target.value)}
                          placeholder="Duyuru detayı..."
                          rows={3}
                          className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-violet-500 outline-none text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block">Görünürlük</label>
                        <select
                          value={newAnnVisibleTo}
                          onChange={(e) => setNewAnnVisibleTo(e.target.value as any)}
                          className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-violet-500 outline-none text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white transition-colors"
                        >
                          <option value="all">Tüm Herkes</option>
                          <option value="kampanya">Kampanya Yapan ve Admin</option>
                        </select>
                      </div>
                      <div className="flex justify-between items-center pt-2">
                        <p className="text-red-500 text-xs h-4">{error}</p>
                        <button
                          type="submit"
                          className="px-6 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 flex items-center gap-2 shadow-lg shadow-violet-200 dark:shadow-none text-sm transition-colors"
                        >
                          <Plus size={16} /> Ekle
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Announcements List */}
                  <div className="p-6 flex-1 overflow-y-auto">
                    <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-4">Yayınlanan Duyurular ({announcements.length})</h3>
                    <div className="space-y-3">
                      {announcements.map(ann => (
                        <div key={ann.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-all">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-bold text-gray-800 dark:text-gray-200 text-sm mb-1">{ann.title}</h4>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 whitespace-pre-wrap">{ann.content}</p>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full">
                                  {format(ann.createdAt, 'd MMM yyyy HH:mm', { locale: tr })}
                                </span>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${ann.visibleTo === 'all' ? 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 border-green-100 dark:border-green-900/30' :
                                  'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/30'
                                  }`}>
                                  {ann.visibleTo === 'all' ? 'Tüm Herkes' : 'Kampanya Yapan ve Admin'}
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={() => onDeleteAnnouncement(ann.id)}
                              className="p-2 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                              title="Duyuruyu Sil"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                      {announcements.length === 0 && (
                        <p className="text-gray-400 dark:text-gray-500 text-center py-4 text-sm">Henüz duyuru eklenmemiş.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* --- ACTIVE USERS TAB --- */}
              {activeTab === 'active-users' && (
                <div className="p-6">
                  <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/50 flex justify-between items-center">
                      <h3 className="font-bold text-gray-800 dark:text-gray-200">Çevrimiçi Kullanıcılar</h3>
                      <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full font-medium">
                        {departmentUsers.filter(u => u.lastSeen && new Date().getTime() - new Date(u.lastSeen).getTime() < 5 * 60 * 1000).length} Çevrimiçi
                      </span>
                    </div>

                    <div className="divide-y divide-gray-100 dark:divide-slate-700">
                      {departmentUsers
                        .sort((a, b) => (b.lastSeen ? new Date(b.lastSeen).getTime() : 0) - (a.lastSeen ? new Date(a.lastSeen).getTime() : 0))
                        .map(user => {
                          const isOnline = user.lastSeen && new Date().getTime() - new Date(user.lastSeen).getTime() < 5 * 60 * 1000;
                          const lastSeenText = user.lastSeen
                            ? format(new Date(user.lastSeen), 'HH:mm', { locale: tr })
                            : 'Görülmedi';
                          const deptName = departments.find(d => d.id === user.departmentId)?.name || 'Bilinmiyor';

                          return (
                            <div key={user.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                              <div className="flex items-center gap-3">
                                <div className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-300 dark:bg-slate-600'}`} />
                                <div>
                                  <h4 className="font-medium text-gray-900 dark:text-white text-sm">{user.username}</h4>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">{deptName}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <span className={`text-xs font-medium px-2 py-1 rounded-full ${isOnline ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-gray-400'}`}>
                                  {isOnline ? 'Çevrimiçi' : `Son görülme: ${lastSeenText}`}
                                </span>
                              </div>
                            </div>
                          );
                        })}

                      {departmentUsers.length === 0 && (
                        <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                          Kullanıcı bulunamadı.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* --- CHANGELOG TAB --- */}
              {activeTab === 'changelog' && (
                <div className="p-6 h-full overflow-y-auto">
                  <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-4">Sürüm Geçmişi</h3>
                  <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-6 shadow-sm space-y-6">
                    {changelog.map((version, index) => (
                      <div key={version.version} className={`${index > 0 ? 'border-t border-gray-100 dark:border-slate-700 pt-6' : ''}`}>
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="font-bold text-gray-800 dark:text-gray-200">{version.version}</h4>
                          <span className="text-xs bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full">
                            {version.date}
                          </span>
                        </div>
                        <ul className="space-y-2 text-xs text-gray-500 dark:text-gray-400">
                          {version.notes.map((note, noteIndex) => (
                            <li key={noteIndex} className="flex items-start gap-2">
                              <span className="text-violet-500 mt-1">•</span>
                              <span>{note}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* --- SETTINGS TAB --- */}
              {activeTab === 'settings' && (
                <div className="p-6 h-full overflow-y-auto">
                  <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-4">Genel Ayarlar</h3>

                  <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-6 shadow-sm space-y-6">

                    <div className="flex items-start justify-between border-b border-gray-100 dark:border-slate-700 pb-6">
                      <div>
                        <h4 className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                          <Trophy size={18} className="text-yellow-500" />
                          Gamification / Rozet Sistemi
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Sistemi aktif ederek en çok kampanya tamamlayan kullanıcıya aylık şampiyonluk rozeti (🏆) verilir.
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 italic">
                          Not: Test butonu ile anlık hesaplama yapabilirsiniz.
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                            {gamificationEnabled ? 'Aktif' : 'Pasif'}
                          </span>
                          <input
                            type="checkbox"
                            checked={gamificationEnabled}
                            onChange={(e) => handleGamificationToggle(e.target.checked)}
                            className="w-5 h-5 text-violet-600 rounded focus:ring-violet-500 border-gray-300 dark:border-slate-600 dark:bg-slate-700"
                          />
                        </div>
                        <button
                          onClick={handleForceCalculate}
                          disabled={!gamificationEnabled}
                          className={`px-4 py-2 text-white text-xs font-bold rounded-lg transition-colors ${gamificationEnabled ? 'bg-violet-600 hover:bg-violet-700' : 'bg-gray-300 cursor-not-allowed dark:bg-slate-600'}`}
                        >
                          Bu Ayı Hesapla (Test)
                        </button>
                      </div>
                    </div>
                    {gamificationMsg && (
                      <div className="p-3 -mt-4 mb-4 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 text-sm rounded-lg font-medium border border-violet-100 dark:border-violet-800/50">
                        {gamificationMsg}
                      </div>
                    )}

                    <div className="flex items-start justify-between border-b border-gray-100 dark:border-slate-700 pb-6">
                      <div>
                        <h4 className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                          <FileText size={18} className="text-blue-500" />
                          İş Birimi Talep Girişi
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          İş birimi kullanıcılarının kampanya talebi oluşturabilmesini aktif/pasif yapın.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 h-6">
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                          {requestSubmissionEnabled ? 'Aktif' : 'Pasif'}
                        </span>
                        <input
                          type="checkbox"
                          checked={requestSubmissionEnabled}
                          onChange={(e) => handleRequestSubmissionToggle(e.target.checked)}
                          className="w-5 h-5 text-violet-600 rounded focus:ring-violet-500 border-gray-300 dark:border-slate-600 dark:bg-slate-700"
                        />
                      </div>
                    </div>

                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-gray-800 dark:text-gray-200">Otomatik Karanlık Mod</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Belirlenen saatte tüm kullanıcılar için karanlık modu aktif et.</p>
                      </div>
                      <div className="flex items-center h-6">
                        <input
                          type="checkbox"
                          id="autoDarkMode"
                          checked={localThemeConfig.enabled}
                          onChange={(e) => handleThemeConfigChange({ ...localThemeConfig, enabled: e.target.checked })}
                          className="w-5 h-5 text-violet-600 rounded focus:ring-violet-500 border-gray-300 dark:border-slate-600 dark:bg-slate-700"
                        />
                      </div>
                    </div>

                    {localThemeConfig.enabled && (
                      <div className="pt-4 border-t dark:border-slate-700 animate-in fade-in slide-in-from-top-2 duration-300">
                        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 block">Aktif Olma Saati</label>
                        <input
                          type="time"
                          value={localThemeConfig.time}
                          onChange={(e) => handleThemeConfigChange({ ...localThemeConfig, time: e.target.value })}
                          className="px-4 py-2 border dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-violet-500 outline-none text-sm bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-white transition-colors"
                        />
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                          Sistem saati <strong>{localThemeConfig.time}</strong> olduğunda karanlık mod otomatik olarak açılacaktır. Kullanıcılar manuel olarak kapatabilirler.
                        </p>
                      </div>
                    )}

                  </div>
                </div>
              )}

              {/* --- ANALYTICS PERSONNEL TAB --- */}
              {activeTab === 'analytics-users' && (
                <div className="flex flex-col h-full">
                  {/* Add Analytics Personnel Form */}
                  <div className="p-6 bg-white dark:bg-slate-800 border-b dark:border-slate-700 space-y-4 shrink-0 transition-colors">
                    <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Yeni Analitik Personel Ekle</h3>
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      if (!newAnalyticsName.trim() || !newAnalyticsEmail.trim() || !selectedAnalyticsEmoji) {
                        setError('Lütfen tüm alanları doldurunuz.');
                        return;
                      }
                      if (onAddAnalyticsUser) {
                        onAddAnalyticsUser(newAnalyticsName, newAnalyticsEmail, selectedAnalyticsEmoji);
                        setNewAnalyticsName('');
                        setNewAnalyticsEmail('');
                        setSelectedAnalyticsEmoji('');
                        setError('');
                      }
                    }} className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block">İsim Soyisim</label>
                          <input
                            type="text"
                            value={newAnalyticsName}
                            onChange={(e) => setNewAnalyticsName(e.target.value)}
                            placeholder="Örn: Zeynep Kaya"
                            className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block">E-posta</label>
                          <input
                            type="email"
                            value={newAnalyticsEmail}
                            onChange={(e) => setNewAnalyticsEmail(e.target.value)}
                            placeholder="zeynep@mail.com"
                            className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 block">Emoji Seçimi</label>
                        <div className="grid grid-cols-8 gap-2 p-3 bg-gray-50 dark:bg-slate-900/50 rounded-lg border border-gray-100 dark:border-slate-700 max-h-32 overflow-y-auto custom-scrollbar transition-colors">
                          {AVAILABLE_EMOJIS.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => setSelectedAnalyticsEmoji(emoji)}
                              className={`
                                w-8 h-8 flex items-center justify-center rounded-full text-lg transition-all
                                ${selectedAnalyticsEmoji === emoji
                                  ? 'bg-blue-600 ring-2 ring-blue-300 dark:ring-blue-500/50 transform scale-110 shadow-md'
                                  : 'bg-white dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600'}
                              `}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex justify-between items-center pt-2">
                        <p className="text-red-500 text-xs h-4">{error}</p>
                        <button
                          type="submit"
                          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 shadow-lg shadow-blue-200 dark:shadow-none text-sm transition-colors"
                        >
                          <Plus size={16} /> Ekle
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Analytics Personnel List */}
                  <div className="p-6">
                    <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-4">Mevcut Analitik Personel ({analyticsUsers.length})</h3>
                    <div className="space-y-2">
                      {analyticsUsers.map(user => (
                        <div key={user.id} className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-gray-100 dark:border-slate-700 flex items-center justify-between group hover:shadow-sm transition-all">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-xl shadow-sm">
                              {user.emoji}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-800 dark:text-gray-200 text-sm">{user.name}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                            </div>
                          </div>
                          {onDeleteAnalyticsUser && (
                            <button
                              onClick={() => onDeleteAnalyticsUser(user.id)}
                              className="p-2 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                              title="Personeli Sil"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      ))}
                      {analyticsUsers.length === 0 && (
                        <p className="text-gray-400 dark:text-gray-500 text-center py-4 text-sm">Henüz analitik personel eklenmemiş.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};