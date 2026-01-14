
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
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans selection:bg-emerald-100 selection:text-emerald-900">
      <header className="fixed top-0 inset-x-0 z-50 bg-white/90 backdrop-blur-xl border-b border-slate-200/50 shadow-[0_4px_30px_rgba(0,0,0,0.02)] transition-all">
        <div className="max-w-7xl mx-auto px-6 h-24 flex justify-between items-center">
          <div className="flex items-center space-x-3 cursor-pointer group" onClick={onLogoClick}>
            <div className="relative">
                <div className="absolute inset-0 bg-emerald-400 blur-xl opacity-20 rounded-full group-hover:opacity-40 transition-opacity"></div>
                <div className="text-4xl group-hover:scale-110 transition-transform relative z-10 leading-none filter drop-shadow-sm">🍃</div>
            </div>
            <div className="flex flex-col">
              <span className="font-black text-2xl leading-none text-slate-800 tracking-tight group-hover:text-emerald-700 transition-colors">MEALers</span>
              <span className="text-[10px] font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-500 uppercase tracking-[0.3em] leading-none mt-1.5">connect</span>
            </div>
          </div>
          {user && (
            <div className="flex items-center space-x-2 md:space-x-4">
              
              <button onClick={onHelpClick} className="p-3 rounded-full hover:bg-slate-100 text-slate-400 hover:text-emerald-600 transition-all hidden md:block" title="Help & FAQ">
                 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </button>

              <button onClick={onContactClick} className="p-3 rounded-full hover:bg-slate-100 text-slate-400 hover:text-emerald-600 transition-all hidden md:block" title="Contact Us">
                 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              </button>

              <button onClick={onSettingsClick} className="p-3 rounded-full hover:bg-slate-100 text-slate-400 hover:text-emerald-600 transition-all hidden md:block" title="Settings">
                 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </button>

              <div className="relative" ref={dropdownRef}>
                <button onClick={() => setShowNotifications(!showNotifications)} className={`p-3 rounded-full relative transition-all ${showNotifications ? 'bg-slate-100 text-emerald-600 ring-2 ring-emerald-100' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-600'}`}>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                  {unreadCount > 0 && (
                      <span className="absolute top-2.5 right-2.5 h-2.5 w-2.5 bg-rose-500 rounded-full ring-2 ring-white animate-pulse"></span>
                  )}
                </button>
                {showNotifications && (
                   <div className="absolute right-0 mt-6 w-96 bg-white rounded-[2rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.15)] border border-slate-100 overflow-hidden z-[100] origin-top-right animate-fade-in-up ring-1 ring-slate-900/5">
                      <div className="bg-white/80 backdrop-blur-md px-6 py-5 border-b border-slate-50 flex justify-between items-center sticky top-0 z-10">
                          <h4 className="font-black text-xs uppercase text-slate-400 tracking-widest">Notifications</h4>
                          {unreadCount > 0 && <span className="bg-rose-50 text-rose-600 text-[10px] font-black px-2.5 py-1 rounded-lg border border-rose-100">{unreadCount} new</span>}
                      </div>
                      <div className="max-h-[400px] overflow-y-auto custom-scrollbar p-2 space-y-1">
                          {notifications.length === 0 ? (
                              <div className="p-12 text-center">
                                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
                                  </div>
                                  <p className="text-slate-400 text-xs font-bold uppercase tracking-wide">All caught up!</p>
                              </div>
                          ) : (
                              notifications.map(n => (
                                  <div key={n.id} className={`p-5 rounded-2xl transition-all ${!n.isRead ? 'bg-emerald-50/60 hover:bg-emerald-50 border border-emerald-100/50' : 'hover:bg-slate-50 border border-transparent'}`}>
                                      <p className="text-sm font-bold text-slate-700 leading-snug mb-2">{n.message}</p>
                                      <div className="flex justify-between items-center">
                                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${n.type === 'ACTION' ? 'bg-rose-100 text-rose-600' : n.type === 'SUCCESS' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                                              {n.type}
                                          </span>
                                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">{new Date(n.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                                      </div>
                                  </div>
                              ))
                          )}
                      </div>
                   </div>
                )}
              </div>
              
              <div className="h-8 w-px bg-slate-200"></div>

              <button onClick={onProfileClick} className="flex items-center gap-3 hover:bg-white pl-1 pr-2 py-1 rounded-full transition-all group border border-transparent hover:border-slate-100 hover:shadow-sm">
                  {user?.profilePictureUrl ? (
                    <img src={user.profilePictureUrl} className="h-10 w-10 rounded-full object-cover shadow-md shadow-slate-200 group-hover:scale-105 transition-transform ring-2 ring-white" alt="User" />
                  ) : (
                    <div className="h-10 w-10 bg-gradient-to-br from-slate-700 to-slate-900 rounded-full flex items-center justify-center text-white font-black shadow-md shadow-slate-200 group-hover:scale-105 transition-transform ring-2 ring-white text-sm">
                        {user?.name?.charAt(0)}
                    </div>
                  )}
                  <div className="flex flex-col items-start pr-2">
                      <span className="text-xs font-black text-slate-800 uppercase tracking-wide hidden md:block group-hover:text-emerald-700 transition-colors">{user?.name?.split(' ')[0]}</span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase hidden md:block">{user.role}</span>
                  </div>
              </button>
              
              <button onClick={() => setShowLogoutConfirm(true)} className="p-3 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-all" title="Logout">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              </button>
            </div>
          )}
        </div>
      </header>
      
      {/* Spacer for fixed header */}
      <div className="h-32"></div>

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 pb-20">{children}</main>

      <footer className="py-8 text-center border-t border-slate-100/50 mt-8">
        <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">
          &copy; {new Date().getFullYear()} MEALers connect. All rights reserved.
        </p>
      </footer>
      
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in-up">
          <div className="bg-white rounded-[2.5rem] p-10 w-full max-w-sm text-center shadow-2xl scale-100 transition-transform">
            <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner border border-rose-100">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">Log Out?</h3>
            <p className="text-slate-500 font-medium mb-8 leading-relaxed">You'll need to sign back in to access your account details.</p>
            <div className="flex gap-4">
              <button 
                onClick={() => setShowLogoutConfirm(false)} 
                className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-2xl transition-colors uppercase text-xs tracking-widest"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  setShowLogoutConfirm(false);
                  onLogout();
                }} 
                className="flex-1 py-4 bg-rose-500 hover:bg-rose-600 text-white font-black rounded-2xl transition-colors shadow-lg shadow-rose-200 uppercase text-xs tracking-widest hover:-translate-y-0.5 active:translate-y-0"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Layout;
