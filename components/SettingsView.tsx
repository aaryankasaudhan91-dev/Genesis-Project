
import React, { useState, useEffect } from 'react';
import { User, NotificationPreferences, UserRole } from '../types';

interface SettingsViewProps {
  user: User;
  onUpdate: (updates: Partial<User>) => void;
  onDelete: () => void;
  onBack: () => void;
  onAboutClick?: () => void; // Added prop
}

const SettingsView: React.FC<SettingsViewProps> = ({ user, onUpdate, onDelete, onBack, onAboutClick }) => {
  const [prefs, setPrefs] = useState<NotificationPreferences>(user.notificationPreferences || { newPostings: true, missionUpdates: true, messages: true });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [language, setLanguage] = useState(user.language || 'English');
  const [searchRadius, setSearchRadius] = useState<number>(user.searchRadius || 10);
  const [donationFilter, setDonationFilter] = useState<'ALL' | 'FOOD' | 'CLOTHES'>(user.donationTypeFilter || 'ALL');
  const [sortBy, setSortBy] = useState<'NEWEST' | 'CLOSEST' | 'EXPIRY'>(user.sortBy || 'NEWEST');
  const [theme, setTheme] = useState(() => localStorage.getItem('app_theme') || 'Light');

  useEffect(() => {
      const root = document.documentElement;
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

      const applyTheme = () => {
          const isSystemDark = mediaQuery.matches;
          if (theme === 'Dark' || (theme === 'System' && isSystemDark)) {
              root.classList.add('dark');
          } else {
              root.classList.remove('dark');
          }
      };

      applyTheme();
      localStorage.setItem('app_theme', theme);

      // Listen for system theme changes if 'System' is selected
      if (theme === 'System') {
          mediaQuery.addEventListener('change', applyTheme);
      }

      return () => mediaQuery.removeEventListener('change', applyTheme);
  }, [theme]);

  const togglePref = (key: keyof NotificationPreferences) => { const newPrefs = { ...prefs, [key]: !prefs[key] }; setPrefs(newPrefs); onUpdate({ notificationPreferences: newPrefs }); };
  const handleRadiusChange = (r: number) => { setSearchRadius(r); onUpdate({ searchRadius: r }); };
  const handleFilterChange = (f: 'ALL' | 'FOOD' | 'CLOTHES') => { setDonationFilter(f); onUpdate({ donationTypeFilter: f }); };
  const handleSortChange = (s: 'NEWEST' | 'CLOSEST' | 'EXPIRY') => { setSortBy(s); onUpdate({ sortBy: s }); };
  const handleLanguageChange = (l: string) => { setLanguage(l); onUpdate({ language: l }); localStorage.setItem('app_language', l); };

  const SettingRow = ({ icon, label, sub, children }: { icon: string, label: string, sub?: string, children: React.ReactNode }) => (
      <div className="flex items-center justify-between py-4 border-b border-slate-50 last:border-0">
          <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-500 flex items-center justify-center text-lg">{icon}</div>
              <div>
                  <p className="text-sm font-bold text-slate-800">{label}</p>
                  {sub && <p className="text-[10px] font-medium text-slate-400">{sub}</p>}
              </div>
          </div>
          {children}
      </div>
  );

  return (
    <div className="max-w-2xl mx-auto pb-20 animate-fade-in-up">
      <button onClick={onBack} className="mb-8 flex items-center text-slate-400 font-bold text-xs uppercase tracking-widest hover:text-slate-800 transition-colors gap-2"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg> Back</button>
      
      <h2 className="text-3xl font-black text-slate-900 mb-8 tracking-tight">Settings</h2>

      {/* About Creators Link */}
      {onAboutClick && (
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-[2rem] shadow-xl p-6 mb-8 text-white flex items-center justify-between cursor-pointer hover:scale-[1.01] transition-transform" onClick={onAboutClick}>
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-2xl backdrop-blur-md">👨‍💻</div>
                <div>
                    <h3 className="text-lg font-black tracking-tight">Meet the Creators</h3>
                    <p className="text-slate-400 text-xs font-medium">Akshay, Surbhi & Aaryan</p>
                </div>
            </div>
            <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-md">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            </div>
        </div>
      )}

      <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden mb-8">
          <div className="px-6 py-2">
              <SettingRow icon="🌐" label="Language">
                  <select value={language} onChange={e => handleLanguageChange(e.target.value)} className="bg-slate-50 border-0 text-slate-600 text-xs font-bold rounded-lg px-3 py-2 focus:ring-0 cursor-pointer hover:bg-slate-100 transition-colors">
                      <option value="English">English</option><option value="Hindi">Hindi</option><option value="Marathi">Marathi</option>
                  </select>
              </SettingRow>
              <SettingRow icon="🌗" label="Theme">
                  <select value={theme} onChange={e => setTheme(e.target.value)} className="bg-slate-50 border-0 text-slate-600 text-xs font-bold rounded-lg px-3 py-2 focus:ring-0 cursor-pointer hover:bg-slate-100 transition-colors">
                      <option>Light</option><option>Dark</option><option>System</option>
                  </select>
              </SettingRow>
          </div>
      </div>

      {(user.role === UserRole.REQUESTER || user.role === UserRole.VOLUNTEER) && (
          <div className="mb-8">
              <h3 className="px-4 mb-3 text-xs font-black uppercase tracking-widest text-slate-400">Discovery Preferences</h3>
              <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                  <div className="px-6 py-2">
                      <SettingRow icon="📍" label="Search Radius" sub="Distance limit">
                          <select value={searchRadius} onChange={e => handleRadiusChange(Number(e.target.value))} className="bg-slate-50 text-slate-600 text-xs font-bold rounded-lg px-3 py-2 cursor-pointer hover:bg-slate-100"><option value={1}>1 km</option><option value={5}>5 km</option><option value={10}>10 km</option><option value={20}>20 km</option><option value={50}>50 km</option></select>
                      </SettingRow>
                      <SettingRow icon="🔃" label="Sort By" sub="Order of items">
                          <select value={sortBy} onChange={e => handleSortChange(e.target.value as any)} className="bg-slate-50 text-slate-600 text-xs font-bold rounded-lg px-3 py-2 cursor-pointer hover:bg-slate-100"><option value="NEWEST">Newest</option><option value="CLOSEST">Closest</option><option value="EXPIRY">Expiring Soon</option></select>
                      </SettingRow>
                      <SettingRow icon="🍱" label="Item Type" sub="Filter category">
                          <select value={donationFilter} onChange={e => handleFilterChange(e.target.value as any)} className="bg-slate-50 text-slate-600 text-xs font-bold rounded-lg px-3 py-2 cursor-pointer hover:bg-slate-100"><option value="ALL">All Items</option><option value="FOOD">Food Only</option><option value="CLOTHES">Clothes Only</option></select>
                      </SettingRow>
                  </div>
              </div>
          </div>
      )}

      <div className="mb-8">
          <h3 className="px-4 mb-3 text-xs font-black uppercase tracking-widest text-slate-400">Notifications</h3>
          <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
              <div className="px-6 py-2">
                  {user.role === UserRole.VOLUNTEER && (
                      <SettingRow icon="🔔" label="New Postings" sub="Alerts for nearby food">
                          <button onClick={() => togglePref('newPostings')} className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${prefs.newPostings ? 'bg-emerald-500' : 'bg-slate-200'}`}><div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${prefs.newPostings ? 'translate-x-4' : 'translate-x-0'}`}></div></button>
                      </SettingRow>
                  )}
                  <SettingRow icon="🚀" label="Mission Updates" sub="Status changes">
                      <button onClick={() => togglePref('missionUpdates')} className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${prefs.missionUpdates ? 'bg-emerald-500' : 'bg-slate-200'}`}><div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${prefs.missionUpdates ? 'translate-x-4' : 'translate-x-0'}`}></div></button>
                  </SettingRow>
                  <SettingRow icon="💬" label="Messages" sub="Chat alerts">
                      <button onClick={() => togglePref('messages')} className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${prefs.messages ? 'bg-emerald-500' : 'bg-slate-200'}`}><div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${prefs.messages ? 'translate-x-4' : 'translate-x-0'}`}></div></button>
                  </SettingRow>
              </div>
          </div>
      </div>

      <div className="bg-rose-50 rounded-[2rem] border border-rose-100 p-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
              <p className="text-rose-900 font-bold text-sm">Delete Account</p>
              <p className="text-rose-700/70 text-xs mt-1">Permanently remove your data.</p>
          </div>
          <button onClick={() => setShowDeleteConfirm(true)} className="px-5 py-2 bg-white text-rose-600 font-black rounded-xl text-xs uppercase tracking-wider shadow-sm hover:bg-rose-600 hover:text-white transition-all">Delete</button>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white rounded-[2.5rem] p-10 w-full max-w-sm text-center shadow-2xl animate-fade-in-up">
                <h3 className="text-xl font-black text-slate-900 mb-2">Are you sure?</h3>
                <p className="text-slate-500 text-sm mb-8">This action cannot be undone.</p>
                <div className="flex gap-3">
                    <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-3 bg-slate-100 rounded-xl font-bold text-xs uppercase tracking-widest text-slate-600">Cancel</button>
                    <button onClick={() => { setShowDeleteConfirm(false); onDelete(); }} className="flex-1 py-3 bg-rose-500 rounded-xl font-bold text-xs uppercase tracking-widest text-white shadow-lg shadow-rose-200">Yes, Delete</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default SettingsView;
