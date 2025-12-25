import React, { useState } from 'react';
import { X, Lock, Save, ShieldCheck } from 'lucide-react';

interface AdminChangePasswordModalProps {
    isOpen: boolean;
    onClose: () => void;
    onChangePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

export const AdminChangePasswordModal: React.FC<AdminChangePasswordModalProps> = ({
    isOpen,
    onClose,
    onChangePassword
}) => {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!currentPassword || !newPassword || !confirmPassword) {
            setError('Lütfen tüm alanları doldurunuz.');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('Yeni şifreler eşleşmiyor.');
            return;
        }

        if (newPassword.length < 6) {
            setError('Yeni şifre en az 6 karakter olmalıdır.');
            return;
        }

        setIsLoading(true);
        try {
            await onChangePassword(currentPassword, newPassword);
            onClose();
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (err: any) {
            setError(err.message || 'Şifre değiştirilirken bir hata oluştu.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setError('');
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden transform transition-all animate-in fade-in zoom-in duration-200 flex flex-col">
                <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gradient-to-r from-violet-600 to-indigo-600 shrink-0">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <ShieldCheck size={20} />
                        Admin Şifre Değiştir
                    </h2>
                    <button onClick={handleClose} className="text-white/80 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
                        <p className="text-xs text-amber-700 dark:text-amber-400">
                            🔐 Firebase Authentication admin şifrenizi değiştiriyorsunuz.
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Mevcut Şifre
                        </label>
                        <input
                            type="password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 outline-none transition-all bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                            autoComplete="current-password"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Yeni Şifre
                        </label>
                        <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 outline-none transition-all bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                            autoComplete="new-password"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Yeni Şifre (Tekrar)
                        </label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 outline-none transition-all bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                            autoComplete="new-password"
                        />
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs rounded-lg border border-red-100 dark:border-red-900/30">
                            {error}
                        </div>
                    )}

                    <div className="pt-2 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={handleClose}
                            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        >
                            İptal
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="px-6 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg shadow-lg shadow-violet-200 dark:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isLoading ? 'Kaydediliyor...' : <><Save size={16} /> Kaydet</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AdminChangePasswordModal;
