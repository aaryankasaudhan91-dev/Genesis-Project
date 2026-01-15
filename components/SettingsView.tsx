
import React, { useState, useEffect } from 'react';
import { User, NotificationPreferences, UserRole } from '../types';

interface SettingsViewProps {
  user: User;
  onUpdate: (updates: Partial<User>) => void;
  onDelete: () => void;
  onBack: () => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ user, onUpdate, onDelete, onBack }) => {
  const [prefs, setPrefs] = useState<NotificationPreferences>(user.notificationPreferences || {
      newPostings: true,
      missionUpdates: true,
      messages: true
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [language, setLanguage] = useState('English');
  const [searchRadius, setSearchRadius] = useState<number>(user.searchRadius || 10);
  
  // Theme State with persistence
  const [theme, setTheme] = useState(() => {
      return localStorage.getItem('app_theme') || 'Light';
  });

  // Apply Theme Effect
  useEffect(() => {
      const root = document.documentElement;
      const applyTheme = (selectedTheme: string) => {
          const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          const shouldBeDark = selectedTheme === 'Dark' || (selectedTheme === 'System' && isSystemDark);
          
          if (shouldBeDark) {
              root.classList.add('dark');
          } else {
              root.classList.remove('dark');
          }
      };

      applyTheme(theme);
      localStorage.setItem('app_theme', theme);
  }, [theme]);

  const togglePref = (key: keyof NotificationPreferences) => {
      const newPrefs = { ...prefs, [key]: !prefs[key] };
      setPrefs(newPrefs);
      onUpdate({ notificationPreferences: newPrefs });
  };

  const handleRadiusChange = (radius: number) => {
      setSearchRadius(radius);
      onUpdate({ searchRadius: radius });
  };

  return (
    <div className="max-w-2xl mx-auto pb-12 animate-fade-in-up">
      <button onClick={onBack} className="mb-6 flex items-center text-slate-500 font-bold text-sm hover:text-emerald-600 transition-colors">
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
        Back to Dashboard
      </button>

      <div className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden border border-slate-100">
        <div className="bg-slate-900 p-8 text-white">
             <div className="flex items-center gap-4">
                 <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md">
                     <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                 </div>
                 <div>
                     <h2 className="text-2xl font-black">Settings</h2>
                     <p className="text-slate-400 font-medium">Manage preferences and account</p>
                 </div>
             </div>
        </div>

        <div className="p-8 space-y-8">
            <div className="space-y-4">
                <h3 className="font-black text-slate-400 text-xs uppercase tracking-widest">General</h3>
                
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white rounded-xl shadow-sm text-slate-600">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" /></svg>
                        </div>
                        <span className="font-bold text-slate-700">Language</span>
                    </div>
                    <select value={language} onChange={e => setLanguage(e.target.value)} className="bg-white border border-slate-200 text-slate-600 text-sm font-bold rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                        <option>English</option>
                        <option>Hindi</option>
                        <option>Marathi</option>
                    </select>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-3">
                         <div className="p-2 bg-white rounded-xl shadow-sm text-slate-600">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                        </div>
                        <span className="font-bold text-slate-700">Theme</span>
                    </div>
                    <select value={theme} onChange={e => setTheme(e.target.value)} className="bg-white border border-slate-200 text-slate-600 text-sm font-bold rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                        <option>Light</option>
                        <option>Dark</option>
                        <option>System</option>
                    </select>
                </div>

                {(user.role === UserRole.REQUESTER || user.role === UserRole.VOLUNTEER) && (
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white rounded-xl shadow-sm text-slate-600">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            </div>
                            <div className="flex flex-col">
                                <span className="font-bold text-slate-700">Search Radius</span>
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Filter available food</span>
                            </div>
                        </div>
                        <select 
                            value={searchRadius} 
                            onChange={e => handleRadiusChange(Number(e.target.value))} 
                            className="bg-white border border-slate-200 text-slate-600 text-sm font-bold rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                            <option value={1}>1 km</option>
                            <option value={3}>3 km</option>
                            <option value={5}>5 km</option>
                            <option value={10}>10 km</option>
                            <option value={20}>20 km</option>
                            <option value={50}>50 km</option>
                            <option value={100}>100 km</option>
                        </select>
                    </div>
                )}
            </div>

            <div className="space-y-4">
                  <h3 className="font-black text-slate-400 text-xs uppercase tracking-widest">Notifications</h3>
                  
                  <div className="bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden">
                      {user.role === UserRole.VOLUNTEER && (
                          <div className="flex items-center justify-between p-4 border-b border-slate-100">
                              <div>
                                  <p className="font-bold text-sm text-slate-700">New Food Postings</p>
                                  <p className="text-xs text-slate-500">Alerts for nearby donations</p>
                              </div>
                              <button onClick={() => togglePref('newPostings')} className={`w-11 h-6 rounded-full transition-colors flex items-center px-0.5 ${prefs.newPostings ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                                  <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ${prefs.newPostings ? 'translate-x-5' : 'translate-x-0'}`}></div>
                              </button>
                          </div>
                      )}
                      
                      <div className="flex items-center justify-between p-4 border-b border-slate-100">
                          <div>
                              <p className="font-bold text-sm text-slate-700">Mission Updates</p>
                              <p className="text-xs text-slate-500">Status changes & approvals</p>
                          </div>
                          <button onClick={() => togglePref('missionUpdates')} className={`w-11 h-6 rounded-full transition-colors flex items-center px-0.5 ${prefs.missionUpdates ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                              <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ${prefs.missionUpdates ? 'translate-x-5' : 'translate-x-0'}`}></div>
                          </button>
                      </div>

                      <div className="flex items-center justify-between p-4">
                          <div>
                              <p className="font-bold text-sm text-slate-700">Messages</p>
                              <p className="text-xs text-slate-500">Chat notifications</p>
                          </div>
                          <button onClick={() => togglePref('messages')} className={`w-11 h-6 rounded-full transition-colors flex items-center px-0.5 ${prefs.messages ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                              <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ${prefs.messages ? 'translate-x-5' : 'translate-x-0'}`}></div>
                          </button>
                      </div>
                  </div>
            </div>

            <div className="space-y-4">
                <h3 className="font-black text-rose-500 text-xs uppercase tracking-widest">Danger Zone</h3>
                <div className="bg-rose-50 border border-rose-100 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div>
                        <p className="text-slate-800 font-bold text-sm">Delete Account</p>
                        <p className="text-slate-500 text-xs mt-1">Permanently remove your account and data.</p>
                    </div>
                    <button 
                        type="button" 
                        onClick={() => setShowDeleteConfirm(true)} 
                        className="px-5 py-3 bg-white border border-rose-200 text-rose-600 font-black rounded-xl text-xs uppercase tracking-wider hover:bg-rose-600 hover:text-white transition-all shadow-sm"
                    >
                        Delete
                    </button>
                </div>
            </div>
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in-up">
            <div className="bg-white rounded-[2.5rem] p-10 w-full max-w-sm text-center shadow-2xl scale-100 transition-transform">
                <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner border border-rose-100">
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                </div>
                <h3 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">Are you sure?</h3>
                <p className="text-slate-500 font-medium mb-8 leading-relaxed">This action cannot be undone.</p>
                <div className="flex gap-4">
                    <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-2xl transition-colors uppercase text-xs tracking-widest">Cancel</button>
                    <button onClick={() => { setShowDeleteConfirm(false); onDelete(); }} className="flex-1 py-4 bg-rose-500 hover:bg-rose-600 text-white font-black rounded-2xl transition-colors shadow-lg shadow-rose-200 uppercase text-xs tracking-widest">Delete</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default SettingsView;
