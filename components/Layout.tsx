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
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const unreadCount = notifications.filter(n => !n.isRead).length;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 font-sans selection:bg-emerald-100 selection:text-emerald-900 transition-colors duration-300">
      <header className="fixed top-0 inset-x-0 z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800 shadow-[0_4px_30px_rgba(0,0,0,0.02)] transition-all">
        <div className="max-w-7xl mx-auto px-6 h-24 flex justify-between items-center">
          <div className="flex items-center space-x-3 cursor-pointer group" onClick={onLogoClick}>
            <div className="relative">
                <div className="absolute inset-0 bg-emerald-400 blur-xl opacity-20 rounded-full group-hover:opacity-40 transition-opacity"></div>
                <div className="text-4xl group-hover:scale-110 transition-transform relative z-10 leading-none filter drop-shadow-sm">🍃</div>
            </div>
            <div className="flex flex-col">
              <span className="font-black text-2xl leading-none text-slate-800 dark:text-white tracking-tight group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">MEALers</span>
              <span className="text-[10px] font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-500 uppercase tracking-[0.3em] leading-none mt-1.5">connect</span>
            </div>
          </div>
          {user && (
            <div className="flex items-center space-x-2 md:space-x-4">
              
              <button onClick={onHelpClick} className="p-3 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all hidden md:block" title="Help & FAQ">
                 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </button>

              <button onClick={onContactClick} className="p-3 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all hidden md:block" title="Contact Us">
                 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              </button>

              <button onClick={onSettingsClick} className="p-3 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all hidden md:block" title="Settings">
                 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </button>

              <div className="relative" ref={dropdownRef}>
                <button onClick={() => setShowNotifications(!showNotifications)} className={`p-3 rounded-full relative transition-all ${showNotifications ? 'bg-slate-100 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 ring-2 ring-emerald-100 dark:ring-emerald-900' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                  {unreadCount > 0 && (
                      <span className="absolute top-2.5 right-2.5 h-2.5 w-2.5 bg-rose-500 rounded-full ring-2 ring-white dark:ring-slate-900 animate-pulse"></span>
                  )}
                </button>
                {showNotifications && (
                   <div className="absolute right-0 mt-6 w-96 bg-white dark:bg-slate-900 rounded-[2rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.15)] border border-slate-100 dark:border-slate-800 overflow-hidden z-[100] origin-top-right animate-fade-in-up ring-1 ring-slate-900/5">
                      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-6 py-5 border-b border-slate-50 dark:border-slate-800 flex justify-between items-center sticky top-0 z-10">
                          <h4 className="font-black text-xs uppercase text-slate-400 dark:text-slate-500 tracking-widest">Notifications</h4>
                          {unreadCount > 0 && <span className="bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-[10px] font-black px-2.5 py-1 rounded-lg border border-rose-100 dark:border-rose-500/30">{unreadCount} new</span>}
                      </div>
                      <div className="max-h-96 overflow-y-auto custom-scrollbar p-2">
                        {notifications.length === 0 ? (
                            <div className="text-center py-10 px-6">
                                <p className="text-slate-300 dark:text-slate-600 font-medium">No new notifications</p>
                            </div>
                        ) : (
                            notifications.map(n => (
                                <div key={n.id} className={`p-4 rounded-2xl mb-1 ${n.isRead ? 'bg-transparent opacity-60' : 'bg-slate-50 dark:bg-slate-800'}`}>
                                    <p className="text-sm text-slate-700 dark:text-slate-300 mb-1">{n.message}</p>
                                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase">{new Date(n.createdAt).toLocaleString()}</p>
                                </div>
                            ))
                        )}
                      </div>
                   </div>
                )}
              </div>

              <div className="relative group">
                <button onClick={onProfileClick} className="flex items-center space-x-2 pl-2 md:pl-4 border-l border-slate-200 dark:border-slate-700">
                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden border-2 border-white dark:border-slate-800 shadow-sm ring-2 ring-transparent group-hover:ring-emerald-200 dark:group-hover:ring-emerald-900 transition-all">
                        {user.profilePictureUrl ? (
                            <img src={user.profilePictureUrl} alt={user.name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400 dark:text-slate-500 font-bold text-lg">{user.name.charAt(0)}</div>
                        )}
                    </div>
                </button>
              </div>

              <button onClick={() => setShowLogoutConfirm(true)} className="p-3 rounded-full hover:bg-rose-50 dark:hover:bg-rose-900/20 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition-all" title="Logout">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 pt-32 pb-12 px-6 max-w-7xl mx-auto w-full z-0 relative">
        {children}
      </main>

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in-up">
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-10 w-full max-w-sm text-center shadow-2xl scale-100 transition-transform">
                <div className="w-20 h-20 bg-rose-50 dark:bg-rose-900/20 text-rose-500 dark:text-rose-400 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner border border-rose-100 dark:border-rose-900/30">
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                </div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">Logging Out?</h3>
                <p className="text-slate-500 dark:text-slate-400 font-medium mb-8 leading-relaxed">We'll miss you! Come back soon to make a difference.</p>
                <div className="flex gap-4">
                    <button onClick={() => setShowLogoutConfirm(false)} className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-black rounded-2xl transition-colors uppercase text-xs tracking-widest">Stay</button>
                    <button onClick={() => { setShowLogoutConfirm(false); onLogout(); }} className="flex-1 py-4 bg-rose-500 hover:bg-rose-600 text-white font-black rounded-2xl transition-colors shadow-lg shadow-rose-200 dark:shadow-rose-900/20 uppercase text-xs tracking-widest">Logout</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Layout;