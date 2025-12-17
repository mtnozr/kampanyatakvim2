import React, { useState } from 'react';
import { X, LogIn, User as UserIcon, Lock, Eye, EyeOff } from 'lucide-react';
import { DepartmentUser, Department } from '../types';
import { auth } from '../firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';

interface DepartmentLoginModalProps {
    isOpen: boolean;
    onClose: () => void;
    departmentUsers: DepartmentUser[];
    departments: Department[];
    onLogin: (user: DepartmentUser) => void;
}

export const DepartmentLoginModal: React.FC<DepartmentLoginModalProps> = ({
    isOpen,
    onClose,
    departmentUsers,
    departments,
    onLogin
}) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!username.trim() || !password.trim()) {
            setError('Kullanıcı adı ve şifre gereklidir.');
            return;
        }

        setIsLoading(true);

        // Try to construct email if not provided as email
        let email = username.trim();
        if (!email.includes('@')) {
            email = `${email.toLowerCase().replace(/\s+/g, '')}@kampanyatakvim.com`;
        }

        // Check if user exists in Firestore (for better error messages)
        const targetUser = departmentUsers.find(u => 
            u.username.toLowerCase() === username.trim().toLowerCase() || 
            (u.email && u.email.toLowerCase() === email.toLowerCase())
        );

        try {
            await signInWithEmailAndPassword(auth, email, password);
            // Login successful
            setUsername('');
            setPassword('');
            onClose();
        } catch (err: any) {
            console.error("Login error:", err);
            
            if (err.code === 'auth/user-not-found') {
                if (targetUser) {
                     setError('Kullanıcı veritabanında var fakat giriş yetkisi (Auth) bulunamadı. Lütfen yönetici panelinden kullanıcıyı silip tekrar oluşturun.');
                } else {
                     setError('Kullanıcı bulunamadı.');
                }
            } else if (err.code === 'auth/wrong-password') {
                setError('Şifre hatalı.');
            } else if (err.code === 'auth/invalid-credential') {
                // This could be either wrong password or user not found in some configs
                if (targetUser) {
                    setError('Giriş başarısız. Şifre hatalı olabilir veya kullanıcı kaydı bozuk (silip tekrar oluşturmayı deneyin).');
                } else {
                    setError('Kullanıcı adı veya şifre hatalı.');
                }
            } else if (err.code === 'auth/too-many-requests') {
                setError('Çok fazla başarısız deneme. Lütfen biraz bekleyin.');
            } else {
                setError('Giriş başarısız: ' + err.message);
            }
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden transition-colors">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-teal-50 dark:bg-slate-700/50">
                    <div className="flex items-center gap-2 text-teal-800 dark:text-teal-400">
                        <LogIn size={24} />
                        <h2 className="text-lg font-bold">Birim Girişi</h2>
                    </div>
                    <button onClick={onClose} className="text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                        <X size={20} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                        Biriminize ait kullanıcı bilgileri ile giriş yapınız.
                    </p>

                    <div>
                        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block">Kullanıcı Adı</label>
                        <div className="relative">
                            <UserIcon className="absolute left-3 top-2.5 text-gray-400 dark:text-gray-500" size={18} />
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="kullanici_adi"
                                className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
                                autoFocus
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block">Şifre</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-2.5 text-gray-400 dark:text-gray-500" size={18} />
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="******"
                                className="w-full pl-10 pr-10 py-2 border border-gray-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs rounded-lg text-center border border-red-100 dark:border-red-900/30">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-teal-600 hover:bg-teal-700 dark:bg-teal-600 dark:hover:bg-teal-700 text-white py-2 rounded-lg font-medium transition shadow-lg shadow-teal-200 dark:shadow-none flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {isLoading ? 'Giriş Yapılıyor...' : 'Giriş Yap'}
                    </button>
                </form>
            </div>
        </div>
    );
};
