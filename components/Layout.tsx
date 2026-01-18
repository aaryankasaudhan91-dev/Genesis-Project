
import React, { useState, useRef, useEffect } from 'react';
import { User, Notification } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  user: User | null;
  onLogout: () => void;
  onProfileClick: () => void;
  onLogoClick: () => void;
  onContactClick: () => void;
  onHelpClick: () => void;
  onSettingsClick: () => void;
  notifications?: Notification[];
}

const Layout: React.FC<LayoutProps> = ({ 
  children, user, onLogout, onProfileClick, onLogoClick, onContactClick, onHelpClick, onSettingsClick, notifications = [] 
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  
  const unreadCount = notifications.filter(n => !n.isRead).length;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 font-sans selection:bg-emerald-100 selection:text-emerald-900 transition-colors duration-300">
      <header className="fixed top-0 inset-x-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/60 dark:border-slate-800 shadow-[0_4px_30px_rgba(0,0,0,0.03)] transition-all">
        <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
          <div className="flex items-center space-x-3 cursor-pointer group" onClick={onLogoClick}>
            <div className="relative">
                <div className="absolute inset-0 bg-emerald-400 blur-xl opacity-20 rounded-full group-hover:opacity-40 transition-opacity"></div>
                <div className="text-3xl group-hover:scale-110 transition-transform relative z-10 leading-none filter drop-shadow-sm">🍃</div>
            </div>
            <div className="flex flex-col">
              <span className="font-black text-xl leading-none text-slate-800 dark:text-white tracking-tight group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">MEALers</span>
              <span className="text-[9px] font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-500 uppercase tracking-[0.3em] leading-none mt-1">connect</span>
            </div>
          </div>
          {user && (
            <div className="flex items-center space-x-4">
              
              <div className="relative" ref={dropdownRef}>
                <button onClick={() => setShowNotifications(!showNotifications)} className={`p-2.5 rounded-full relative transition-all ${showNotifications ? 'bg-slate-100 text-emerald-600' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-600'}`}>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.836L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                  {unreadCount > 0 && <span className="absolute top-2 right-2 h-2.5 w-2.5 bg-rose-500 rounded-full ring-2 ring-white animate-pulse"></span>}
                </button>
                {showNotifications && (
                   <div className="absolute right-0 mt-4 w-80 bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden z-[100] origin-top-right animate-fade-in-up">
                      <div className="px-6 py-4 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                          <h4 className="font-black text-xs uppercase text-slate-400 tracking-widest">Notifications</h4>
                          {unreadCount > 0 && <span className="bg-rose-50 text-rose-600 text-[10px] font-black px-2 py-0.5 rounded-md">{unreadCount} new</span>}
                      </div>
                      <div className="max-h-80 overflow-y-auto custom-scrollbar p-2">
                        {notifications.length === 0 ? (
                            <div className="text-center py-8 px-6 text-slate-400 text-xs font-bold">All caught up!</div>
                        ) : (
                            notifications.map(n => (
                                <div key={n.id} className={`p-4 rounded-2xl mb-1 transition-colors ${n.isRead ? 'opacity-60' : 'bg-slate-50'}`}>
                                    <p className="text-sm text-slate-700 font-medium mb-1">{n.message}</p>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase">{new Date(n.createdAt).toLocaleTimeString()}</p>
                                </div>
                            ))
                        )}
                      </div>
                   </div>
                )}
              </div>

              {/* Profile Menu */}
              <div className="relative" ref={profileMenuRef}>
                <button 
                    onClick={() => setShowProfileMenu(!showProfileMenu)} 
                    className="flex items-center space-x-2 pl-4 border-l border-slate-200 focus:outline-none group"
                >
                    <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden border-2 border-white shadow-sm ring-2 ring-transparent group-hover:ring-emerald-200 transition-all">
                        {user.profilePictureUrl ? (
                            <img src={user.profilePictureUrl} alt={user.name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold text-lg">{user.name.charAt(0)}</div>
                        )}
                    </div>
                </button>

                {showProfileMenu && (
                    <div className="absolute right-0 mt-4 w-64 bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden z-[100] origin-top-right animate-fade-in-up">
                        <div className="bg-slate-50/50 px-6 py-4 border-b border-slate-50">
                            <p className="text-sm font-black text-slate-800 truncate">{user.name}</p>
                            <p className="text-xs text-slate-500 truncate font-medium">{user.email}</p>
                            <span className="inline-block mt-2 text-[9px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md">{user.role}</span>
                        </div>
                        <div className="p-2 space-y-1">
                            <button onClick={() => { setShowProfileMenu(false); onProfileClick(); }} className="w-full text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-600 hover:bg-slate-50 hover:text-emerald-600 rounded-xl transition-all flex items-center gap-3">
                                <span className="text-lg opacity-70">👤</span> My Profile
                            </button>
                            <button onClick={() => { setShowProfileMenu(false); onSettingsClick(); }} className="w-full text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-600 hover:bg-slate-50 hover:text-emerald-600 rounded-xl transition-all flex items-center gap-3">
                                <span className="text-lg opacity-70">⚙️</span> Settings
                            </button>
                            <button onClick={() => { setShowProfileMenu(false); onContactClick(); }} className="w-full text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-600 hover:bg-slate-50 hover:text-emerald-600 rounded-xl transition-all flex items-center gap-3">
                                <span className="text-lg opacity-70">📞</span> Support
                            </button>
                            <button onClick={() => { setShowProfileMenu(false); onHelpClick(); }} className="w-full text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-600 hover:bg-slate-50 hover:text-emerald-600 rounded-xl transition-all flex items-center gap-3">
                                <span className="text-lg opacity-70">❓</span> Help & FAQ
                            </button>
                        </div>
                        <div className="border-t border-slate-50 p-2">
                            <button onClick={() => { setShowProfileMenu(false); setShowLogoutConfirm(true); }} className="w-full text-left px-4 py-3 text-xs font-black uppercase tracking-wider text-rose-500 hover:bg-rose-50 rounded-xl transition-all flex items-center gap-3">
                                <span className="text-lg opacity-70">🚪</span> Logout
                            </button>
                        </div>
                    </div>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 pt-28 pb-12 px-6 max-w-7xl mx-auto w-full z-0 relative">
        {children}
      </main>

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white rounded-[2.5rem] p-10 w-full max-w-sm text-center shadow-2xl animate-fade-in-up">
                <h3 className="text-2xl font-black text-slate-900 mb-2">Logging Out?</h3>
                <p className="text-slate-500 font-medium mb-8">Come back soon to make a difference.</p>
                <div className="flex gap-4">
                    <button onClick={() => setShowLogoutConfirm(false)} className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-2xl transition-colors uppercase text-xs tracking-widest">Stay</button>
                    <button onClick={() => { setShowLogoutConfirm(false); onLogout(); }} className="flex-1 py-4 bg-rose-500 hover:bg-rose-600 text-white font-black rounded-2xl transition-colors shadow-lg shadow-rose-200 uppercase text-xs tracking-widest">Logout</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Layout;
