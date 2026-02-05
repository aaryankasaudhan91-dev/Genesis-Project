
import React, { useState, useEffect, useRef, useMemo } from 'react';
import Layout from './components/Layout';
import { LoginPage } from './components/LoginPage';
import FoodCard from './components/FoodCard';
import PostingsMap from './components/PostingsMap';
import ContactUs from './components/ContactUs';
import HelpFAQ from './components/HelpFAQ';
import ProfileView from './components/ProfileView';
import SettingsView from './components/SettingsView';
import SplashScreen from './components/SplashScreen';
import ChatModal from './components/ChatModal';
import LiveTrackingModal from './components/LiveTrackingModal';
import VerificationRequestModal from './components/VerificationRequestModal';
import RoutePlannerModal from './components/RoutePlannerModal';
import AddDonationView from './components/AddDonationView';
import RatingModal from './components/RatingModal';
import { User, UserRole, FoodPosting, FoodStatus, Notification, DonationType } from './types';
import { storage, calculateDistance } from './services/storageService';
import { optimizeMultiStopRoute, MultiStopRouteResult } from './services/geminiService';
import { auth, onAuthStateChanged, signOut } from './services/firebaseConfig';
import { getTranslation } from './services/translations';

const QUOTES = [
    "No one has ever become poor by giving.",
    "We make a living by what we get, but we make a life by what we give.",
    "The best way to find yourself is to lose yourself in the service of others.",
    "Happiness doesn't result from what we get, but from what we give."
];

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<'LOGIN' | 'DASHBOARD' | 'PROFILE' | 'SETTINGS' | 'CONTACT' | 'HELP' | 'ADD_DONATION'>('LOGIN');
  const [showSplash, setShowSplash] = useState(true);
  
  // Data State
  const [postings, setPostings] = useState<FoodPosting[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  
  // UI State
  const [activeTab, setActiveTab] = useState<string>('active');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | undefined>(undefined);
  const [selectedPostingId, setSelectedPostingId] = useState<string | null>(null);
  const [activeChatPostingId, setActiveChatPostingId] = useState<string | null>(null);
  const [activeTrackingPostingId, setActiveTrackingPostingId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dailyQuote, setDailyQuote] = useState(QUOTES[0]);
  const [initialDonationType, setInitialDonationType] = useState<DonationType>('FOOD');

  // Rating State
  const [activeRatingSession, setActiveRatingSession] = useState<{ postingId: string, targetId: string, targetName: string } | null>(null);

  // Route Planning State
  const [isOptimizingRoute, setIsOptimizingRoute] = useState(false);
  const [optimizedRoute, setOptimizedRoute] = useState<MultiStopRouteResult | null>(null);

  // Pending Verification State for Donors
  const [pendingVerificationPosting, setPendingVerificationPosting] = useState<FoodPosting | null>(null);

  // Data Fetching
  const refreshData = async () => {
      if (isRefreshing) return;
      setIsRefreshing(true);
      try {
          const freshPostings = await storage.getPostings();
          setPostings(freshPostings);
          if (user) {
              const freshNotifs = await storage.getNotifications(user.id);
              setNotifications(freshNotifs);
          }
      } catch (error) {
          console.error("Error refreshing data:", error);
      } finally {
          setTimeout(() => setIsRefreshing(false), 600);
      }
  };

  // Auth Persistence
  useEffect(() => {
    if (auth) {
        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            if (firebaseUser) {
                storage.getUsers().then(storedUsers => {
                    let matchedUser = storedUsers.find(u => u.id === firebaseUser.uid);
                    if (!matchedUser && firebaseUser.email) {
                        matchedUser = storedUsers.find(u => u.email === firebaseUser.email);
                    }
                    if (!matchedUser && firebaseUser.phoneNumber) {
                         const fPhone = firebaseUser.phoneNumber.replace(/\D/g, '');
                         matchedUser = storedUsers.find(u => {
                             const uPhone = (u.contactNo || '').replace(/\D/g, '');
                             return uPhone && fPhone.includes(uPhone);
                         });
                    }
                    if (matchedUser && !user) {
                        setUser(matchedUser);
                        setView('DASHBOARD');
                    }
                });
            }
        });
        return () => unsubscribe();
    }
  }, [user]);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2500);
    setDailyQuote(QUOTES[Math.floor(Math.random() * QUOTES.length)]);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    refreshData();
    if (user) {
        if (user.role === UserRole.DONOR) setActiveTab('active');
        else if (user.role === UserRole.VOLUNTEER) setActiveTab('opportunities');
        else setActiveTab('browse');
    }

    const interval = setInterval(() => {
        storage.getPostings().then(setPostings);
        if (user) storage.getNotifications(user.id).then(setNotifications);
    }, 10000);

    let watchId: number;
    if (user?.role === UserRole.VOLUNTEER) {
        watchId = navigator.geolocation.watchPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords;
                setUserLocation({ lat: latitude, lng: longitude });
                storage.getPostings().then(allPostings => {
                    const activePostings = allPostings.filter(p =>
                        (p.status === FoodStatus.IN_TRANSIT ||
                        p.status === FoodStatus.PICKUP_VERIFICATION_PENDING ||
                        p.status === FoodStatus.DELIVERY_VERIFICATION_PENDING) &&
                        p.volunteerId === user.id
                    );
                    if (activePostings.length > 0) {
                        activePostings.forEach(p => {
                            storage.updatePosting(p.id, { volunteerLocation: { lat: latitude, lng: longitude } });
                        });
                    }
                });
            },
            (err) => console.log("Location tracking denied", err),
            { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
        );
    } else {
        navigator.geolocation.getCurrentPosition(
            (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            (err) => console.log("Location access denied", err)
        );
    }
    return () => {
        clearInterval(interval);
        if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [user]);

  useEffect(() => {
      if (!user || user.role !== UserRole.DONOR) return;
      const checkPendingVerifications = async () => {
          const currentPostings = await storage.getPostings();
          const pending = currentPostings.find(p =>
              p.donorId === user.id &&
              (p.status === FoodStatus.PICKUP_VERIFICATION_PENDING || p.status === FoodStatus.DELIVERY_VERIFICATION_PENDING)
          );
          if (pending) {
               if (!pendingVerificationPosting || pendingVerificationPosting.id !== pending.id || pendingVerificationPosting.status !== pending.status) {
                   setPendingVerificationPosting(pending);
               }
          } else {
               if (pendingVerificationPosting) {
                   setPendingVerificationPosting(null);
               }
          }
      };
      checkPendingVerifications();
      const interval = setInterval(checkPendingVerifications, 5000);
      return () => clearInterval(interval);
  }, [user, pendingVerificationPosting]);

  const handleStartDonation = (type: DonationType) => {
      setInitialDonationType(type);
      setView('ADD_DONATION');
  };

  const filteredPostings = useMemo(() => {
    if (!user) return [];
    let filtered = [...postings];

    const sortPostings = (list: FoodPosting[]) => {
        const sortOption = user.sortBy || 'NEWEST';
        return list.sort((a, b) => {
            if (sortOption === 'EXPIRY') {
                return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
            }
            if (sortOption === 'CLOSEST' && userLocation) {
                const distA = a.location.lat && a.location.lng ? calculateDistance(userLocation.lat, userLocation.lng, a.location.lat, a.location.lng) : Infinity;
                const distB = b.location.lat && b.location.lng ? calculateDistance(userLocation.lat, userLocation.lng, b.location.lat, b.location.lng) : Infinity;
                return distA - distB;
            }
            return b.createdAt - a.createdAt; 
        });
    };

    if (user.role === UserRole.DONOR) {
        if (activeTab === 'active') return filtered.filter(p => p.donorId === user.id && p.status !== FoodStatus.DELIVERED);
        else if (activeTab === 'history') return filtered.filter(p => p.donorId === user.id && p.status === FoodStatus.DELIVERED);
    } else if (user.role === UserRole.VOLUNTEER) {
        if (activeTab === 'opportunities') {
            let opportunities = filtered.filter(p => (p.status === FoodStatus.AVAILABLE || (p.status === FoodStatus.REQUESTED && !p.volunteerId)));
            if (user.donationTypeFilter && user.donationTypeFilter !== 'ALL') {
                 opportunities = opportunities.filter(p => (p.donationType || 'FOOD') === user.donationTypeFilter);
            }
            const radius = user.searchRadius || 10;
            if (userLocation) {
                opportunities = opportunities.filter(p => {
                    if (p.location.lat && p.location.lng) {
                        const dist = calculateDistance(userLocation.lat, userLocation.lng, p.location.lat, p.location.lng);
                        return dist <= radius;
                    }
                    return true;
                });
            }
            return sortPostings(opportunities);
        }
        else if (activeTab === 'mytasks') return filtered.filter(p => p.volunteerId === user.id && p.status !== FoodStatus.DELIVERED);
        else if (activeTab === 'history') return filtered.filter(p => p.volunteerId === user.id && p.status === FoodStatus.DELIVERED);
    } else if (user.role === UserRole.REQUESTER) {
        if (activeTab === 'browse') {
            let available = filtered.filter(p => p.status === FoodStatus.AVAILABLE);
            if (user.donationTypeFilter && user.donationTypeFilter !== 'ALL') {
                 available = available.filter(p => (p.donationType || 'FOOD') === user.donationTypeFilter);
            }
            const radius = user.searchRadius || 10;
            if (userLocation) {
                available = available.filter(p => {
                    if (p.location.lat && p.location.lng) {
                        const dist = calculateDistance(userLocation.lat, userLocation.lng, p.location.lat, p.location.lng);
                        return dist <= radius;
                    }
                    return true;
                });
            }
            return sortPostings(available);
        } else if (activeTab === 'myrequests') return filtered.filter(p => p.orphanageId === user.id);
    }
    return [];
  }, [postings, user, activeTab, userLocation]);

  const handleRateUser = (pid: string, targetId: string, targetName: string, rating: number, feedback: string) => {
      // If called with rating 0, it means open the modal
      if (rating === 0) {
          setActiveRatingSession({ postingId: pid, targetId, targetName });
      } else {
          // Actual submission logic if needed directly (not used currently as modal handles submission)
      }
  };

  const submitRating = (rating: number, feedback: string) => {
      if (!user || !activeRatingSession) return;
      
      storage.submitUserRating(activeRatingSession.postingId, { 
          raterId: user.id, 
          raterRole: user.role, 
          targetId: activeRatingSession.targetId,
          rating: rating, 
          feedback: feedback, 
          createdAt: Date.now() 
      });
      
      refreshData();
      alert("Rating Submitted! Thank you.");
      setActiveRatingSession(null);
  };

  const handleDeletePosting = (id: string) => { storage.deletePosting(id); refreshData(); };

  // --- Optimize Route Handler ---
  const handleOptimizeRoute = async () => {
      if (!userLocation || filteredPostings.length === 0) return;
      setIsOptimizingRoute(true);
      
      const stops = filteredPostings
          .filter(p => p.location.lat && p.location.lng)
          .map(p => ({
              id: p.id,
              name: p.foodName,
              lat: p.location.lat!,
              lng: p.location.lng!,
              expiry: p.expiryDate
          }));

      const result = await optimizeMultiStopRoute(userLocation, stops);
      if (result) {
          setOptimizedRoute(result);
      } else {
          alert("Could not generate optimized route. Please try again.");
      }
      setIsOptimizingRoute(false);
  };

  const handleDonorApprove = () => { if (pendingVerificationPosting) { storage.updatePosting(pendingVerificationPosting.id, { status: pendingVerificationPosting.status === FoodStatus.PICKUP_VERIFICATION_PENDING ? FoodStatus.IN_TRANSIT : FoodStatus.DELIVERED }); setPendingVerificationPosting(null); refreshData(); } };
  const handleDonorReject = () => { 
      if (pendingVerificationPosting) { 
          storage.updatePosting(pendingVerificationPosting.id, { 
              status: pendingVerificationPosting.status === FoodStatus.PICKUP_VERIFICATION_PENDING ? FoodStatus.REQUESTED : FoodStatus.IN_TRANSIT, 
              pickupVerificationImageUrl: pendingVerificationPosting.status === FoodStatus.PICKUP_VERIFICATION_PENDING ? undefined : pendingVerificationPosting.pickupVerificationImageUrl,
              verificationImageUrl: pendingVerificationPosting.status === FoodStatus.DELIVERY_VERIFICATION_PENDING ? undefined : pendingVerificationPosting.verificationImageUrl
          }); 
          setPendingVerificationPosting(null); 
          refreshData(); 
          alert("Verification Rejected. The volunteer has been notified to re-upload."); 
      } 
  };
  const handleDeleteAccount = () => { if (user) { storage.deleteUser(user.id); if (auth) signOut(auth); setUser(null); setView('LOGIN'); } };

  const t = (key: string) => getTranslation(key, user?.language);

  // --- HELPER: Time Greeting ---
  const getGreeting = () => {
      const hour = new Date().getHours();
      if (hour < 12) return "Good Morning";
      if (hour < 18) return "Good Afternoon";
      return "Good Evening";
  };

  // --- REFINED RENDER HELPERS ---
  const renderStatsCard = (label: string, value: string | number, icon: string, bgClass: string, textClass: string) => (
    <div className={`flex-1 min-w-[140px] p-5 rounded-[2rem] border shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group cursor-default ${bgClass} border-transparent`}>
        <div className="flex items-center justify-between mb-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl bg-white shadow-sm`}>
                {icon}
            </div>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                <svg className={`w-5 h-5 ${textClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
            </div>
        </div>
        <div>
            <p className={`text-3xl font-black tracking-tight mb-1 ${textClass}`}>{value}</p>
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 opacity-80">{label}</p>
        </div>
    </div>
  );

  const renderDashboardHeader = () => {
    if (!user) return null;
    return (
        <div className="flex flex-col gap-8 mb-8 animate-fade-in-up">
            {/* Hero Section */}
            <div className="relative overflow-hidden rounded-[2.5rem] bg-slate-900 p-8 md:p-10 shadow-2xl">
                {/* Abstract Background */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3"></div>
                
                <div className="relative z-10">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <span className="px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-widest text-emerald-300 border border-white/10">
                                    {user.role} Dashboard
                                </span>
                            </div>
                            <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight leading-none mb-3">
                                {t('greeting')}, <br/>
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-200">{user.name?.split(' ')[0]}</span>.
                            </h2>
                            <p className="text-slate-400 font-medium text-sm md:text-base max-w-lg leading-relaxed">
                                "{dailyQuote}"
                            </p>
                        </div>
                        
                        {/* Quick Actions for Donors inside Header */}
                        {user.role === UserRole.DONOR && (
                            <div className="flex gap-3 w-full md:w-auto">
                                <button 
                                    onClick={() => handleStartDonation('FOOD')}
                                    className="flex-1 md:flex-none py-4 px-6 bg-emerald-500 hover:bg-emerald-400 text-white rounded-2xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-emerald-500/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                                >
                                    <span>🍱</span> Donate Food
                                </button>
                                <button 
                                    onClick={() => handleStartDonation('CLOTHES')}
                                    className="flex-1 md:flex-none py-4 px-6 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-2xl font-bold text-xs uppercase tracking-widest backdrop-blur-md transition-all active:scale-95 flex items-center justify-center gap-2"
                                >
                                    <span>👕</span> Donate Clothes
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {user.role === UserRole.DONOR && (
                    <>
                        {renderStatsCard(t('stat_impact'), user.impactScore || 0, "✨", "bg-orange-50/50", "text-orange-600")}
                        {renderStatsCard(t('stat_donations'), postings.filter(p => p.donorId === user.id).length, "🎁", "bg-emerald-50/50", "text-emerald-600")}
                        {renderStatsCard("Active", postings.filter(p => p.donorId === user.id && p.status !== FoodStatus.DELIVERED).length, "⏳", "bg-blue-50/50", "text-blue-600")}
                        {renderStatsCard("Completed", postings.filter(p => p.donorId === user.id && p.status === FoodStatus.DELIVERED).length, "✅", "bg-purple-50/50", "text-purple-600")}
                    </>
                )}
                {user.role === UserRole.VOLUNTEER && (
                    <>
                         {renderStatsCard(t('stat_reputation'), user.averageRating?.toFixed(1) || "5.0", "⭐", "bg-amber-50/50", "text-amber-600")}
                         {renderStatsCard(t('stat_missions'), postings.filter(p => p.volunteerId === user.id && p.status === FoodStatus.DELIVERED).length, "🚴", "bg-blue-50/50", "text-blue-600")}
                         {renderStatsCard("In Progress", postings.filter(p => p.volunteerId === user.id && p.status !== FoodStatus.DELIVERED).length, "🔥", "bg-rose-50/50", "text-rose-600")}
                         {renderStatsCard("Badges", 2, "🏅", "bg-teal-50/50", "text-teal-600")}
                    </>
                )}
                 {user.role === UserRole.REQUESTER && (
                    <>
                         {renderStatsCard(t('stat_requests'), postings.filter(p => p.orphanageId === user.id).length, "📝", "bg-purple-50/50", "text-purple-600")}
                         {renderStatsCard(t('stat_received'), postings.filter(p => p.orphanageId === user.id && p.status === FoodStatus.DELIVERED).length, "🥣", "bg-teal-50/50", "text-teal-600")}
                         {renderStatsCard("Volunteers", 5, "🤝", "bg-indigo-50/50", "text-indigo-600")}
                         {renderStatsCard("Saved", "₹2k", "💰", "bg-emerald-50/50", "text-emerald-600")}
                    </>
                )}
            </div>
        </div>
    );
  };

  const renderTabs = () => {
    if (!user) return null;
    const isActive = (tab: string) => activeTab === tab;
    // New tab style: Floating pills
    const btnClass = (active: boolean) => `flex-1 py-3 px-4 text-xs font-black uppercase tracking-widest transition-all rounded-2xl relative overflow-hidden ${active ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20' : 'text-slate-500 hover:bg-slate-100'}`;
    
    return (
        <div className="flex items-center justify-between mb-8 sticky top-24 z-30 py-4 -mx-6 px-6 transition-all bg-gradient-to-b from-slate-50 via-slate-50/95 to-transparent">
            <div className="bg-white/80 backdrop-blur-xl p-1.5 rounded-[20px] border border-white/50 shadow-lg shadow-slate-200/50 flex flex-1 max-w-lg ring-1 ring-slate-100">
                {user.role === UserRole.DONOR && (
                    <>
                        <button onClick={() => setActiveTab('active')} className={btnClass(isActive('active'))}>{t('tab_active')}</button>
                        <button onClick={() => setActiveTab('history')} className={btnClass(isActive('history'))}>{t('tab_history')}</button>
                    </>
                )}
                {user.role === UserRole.VOLUNTEER && (
                    <>
                        <button onClick={() => setActiveTab('opportunities')} className={btnClass(isActive('opportunities'))}>{t('tab_find')}</button>
                        <button onClick={() => setActiveTab('mytasks')} className={btnClass(isActive('mytasks'))}>{t('tab_tasks')}</button>
                        <button onClick={() => setActiveTab('history')} className={btnClass(isActive('history'))}>{t('tab_history')}</button>
                    </>
                )}
                {user.role === UserRole.REQUESTER && (
                    <>
                        <button onClick={() => setActiveTab('browse')} className={btnClass(isActive('browse'))}>{t('tab_browse')}</button>
                        <button onClick={() => setActiveTab('myrequests')} className={btnClass(isActive('myrequests'))}>{t('tab_myreq')}</button>
                    </>
                )}
            </div>

            <div className="flex items-center gap-3 shrink-0 ml-4">
                {/* Volunteer Route Optimize Button */}
                {user.role === UserRole.VOLUNTEER && activeTab === 'opportunities' && (
                    <button 
                        onClick={handleOptimizeRoute}
                        disabled={isOptimizingRoute || filteredPostings.length === 0}
                        className="h-12 px-4 flex items-center justify-center bg-purple-600 hover:bg-purple-700 text-white rounded-2xl shadow-lg shadow-purple-200 transition-all active:scale-95 disabled:opacity-50"
                    >
                        {isOptimizingRoute ? (
                            <svg className="animate-spin w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        ) : (
                            <div className="flex items-center gap-2">
                                <span className="text-lg">✨</span>
                                <span className="text-xs font-black uppercase tracking-widest hidden md:inline">{t('btn_smart_route')}</span>
                            </div>
                        )}
                    </button>
                )}

                <button 
                    onClick={refreshData} 
                    disabled={isRefreshing}
                    className="w-12 h-12 flex items-center justify-center bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-emerald-600 hover:border-emerald-200 hover:shadow-lg transition-all active:scale-95 group"
                >
                    <svg className={`w-5 h-5 group-hover:rotate-180 transition-transform duration-700 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </button>

                {(user.role === UserRole.VOLUNTEER && activeTab === 'opportunities') || (user.role === UserRole.REQUESTER && activeTab === 'browse') ? (
                    <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
                        <button onClick={() => setViewMode('list')} className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${viewMode === 'list' ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-600'}`}>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
                        </button>
                        <button onClick={() => setViewMode('map')} className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${viewMode === 'map' ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-slate-600'}`}>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                        </button>
                    </div>
                ) : null}
            </div>
        </div>
    );
  };

  const renderContent = () => {
      if (filteredPostings.length === 0) {
          return (
            <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in-up bg-white rounded-[2.5rem] border border-slate-100 border-dashed shadow-sm">
                <div className="w-32 h-32 bg-slate-50 rounded-full flex items-center justify-center mb-6 shadow-inner relative">
                    <span className="text-6xl grayscale opacity-30 select-none">🍃</span>
                    <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-md text-2xl border border-slate-100">✨</div>
                </div>
                <h3 className="text-2xl font-black text-slate-800 mb-2 tracking-tight">{t('nothing_title')}</h3>
                <p className="text-slate-500 font-medium max-w-xs mx-auto leading-relaxed mb-8">
                    {user?.role === UserRole.DONOR ? t('nothing_desc_donor') : t('nothing_desc_other')}
                </p>
                
                {user?.role === UserRole.DONOR && activeTab === 'active' && (
                    <button onClick={() => handleStartDonation('FOOD')} className="px-8 py-4 bg-slate-900 text-white font-black rounded-2xl uppercase text-xs tracking-widest shadow-xl hover:bg-slate-800 hover:scale-105 transition-all">
                        {t('btn_donate')}
                    </button>
                )}
            </div>
          );
      }

      if (viewMode === 'map' && ((user?.role === UserRole.VOLUNTEER && activeTab === 'opportunities') || (user?.role === UserRole.REQUESTER && activeTab === 'browse'))) {
          return (
              <div className="h-[650px] w-full rounded-[2.5rem] overflow-hidden shadow-2xl border border-white ring-4 ring-slate-100 relative z-0">
                  <PostingsMap
                    postings={filteredPostings}
                    userLocation={userLocation}
                    onPostingSelect={(id) => { setSelectedPostingId(id); }}
                  />
                  <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/50 to-transparent pointer-events-none"></div>
              </div>
          );
      }

      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
            {filteredPostings.map((post, idx) => (
                <div key={post.id} className="animate-fade-in-up" style={{ animationDelay: `${idx * 75}ms` }}>
                    <FoodCard
                        posting={post}
                        user={user!}
                        onUpdate={(id, updates) => { storage.updatePosting(id, updates); refreshData(); }}
                        onDelete={handleDeletePosting}
                        currentLocation={userLocation}
                        onRateUser={handleRateUser}
                        onChatClick={(id) => setActiveChatPostingId(id)}
                        onTrackClick={(id) => setActiveTrackingPostingId(id)}
                    />
                </div>
            ))}
        </div>
      );
  };

  if (showSplash) return <SplashScreen />;
  if (!user || view === 'LOGIN') return <LoginPage onLogin={(user) => { setUser(user); setView('DASHBOARD'); }} />;
  if (view === 'PROFILE' && user) return <Layout user={user} onLogout={() => { if (auth) signOut(auth); setUser(null); setView('LOGIN'); }} onProfileClick={() => {}} onLogoClick={() => setView('DASHBOARD')} onContactClick={() => setView('CONTACT')} onHelpClick={() => setView('HELP')} onSettingsClick={() => setView('SETTINGS')} notifications={notifications}><ProfileView user={user} onUpdate={(updates) => { storage.updateUser(user.id, updates); setUser({ ...user, ...updates }); }} onBack={() => setView('DASHBOARD')} /></Layout>;
  if (view === 'SETTINGS' && user) return <Layout user={user} onLogout={() => { if (auth) signOut(auth); setUser(null); setView('LOGIN'); }} onProfileClick={() => setView('PROFILE')} onLogoClick={() => setView('DASHBOARD')} onContactClick={() => setView('CONTACT')} onHelpClick={() => setView('HELP')} onSettingsClick={() => {}} notifications={notifications}><SettingsView user={user} onUpdate={(updates) => { storage.updateUser(user.id, updates); setUser({ ...user, ...updates }); }} onDelete={handleDeleteAccount} onBack={() => setView('DASHBOARD')} /></Layout>;
  if (view === 'CONTACT' && user) return <Layout user={user} onLogout={() => { if (auth) signOut(auth); setUser(null); setView('LOGIN'); }} onProfileClick={() => setView('PROFILE')} onLogoClick={() => setView('DASHBOARD')} onContactClick={() => {}} onHelpClick={() => setView('HELP')} onSettingsClick={() => setView('SETTINGS')} notifications={notifications}><ContactUs user={user} onBack={() => setView('DASHBOARD')} /></Layout>;
  if (view === 'HELP' && user) return <Layout user={user} onLogout={() => { if (auth) signOut(auth); setUser(null); setView('LOGIN'); }} onProfileClick={() => setView('PROFILE')} onLogoClick={() => setView('DASHBOARD')} onContactClick={() => setView('CONTACT')} onHelpClick={() => {}} onSettingsClick={() => setView('SETTINGS')} notifications={notifications}><HelpFAQ onBack={() => setView('DASHBOARD')} onContact={() => setView('CONTACT')} /></Layout>;
  if (view === 'ADD_DONATION' && user) return <Layout user={user} onLogout={() => { if (auth) signOut(auth); setUser(null); setView('LOGIN'); }} onProfileClick={() => setView('PROFILE')} onLogoClick={() => setView('DASHBOARD')} onContactClick={() => setView('CONTACT')} onHelpClick={() => setView('HELP')} onSettingsClick={() => setView('SETTINGS')} notifications={notifications}><AddDonationView user={user} initialType={initialDonationType} onBack={() => setView('DASHBOARD')} onSuccess={(posting) => { 
      setView('DASHBOARD'); 
      if (posting) {
          setPostings(prev => [posting, ...prev]);
          setSelectedPostingId(posting.id);
      }
      refreshData(); 
  }} /></Layout>;

  return (
    <Layout
        user={user}
        onLogout={() => { if (auth) signOut(auth); setUser(null); setView('LOGIN'); }}
        onProfileClick={() => setView('PROFILE')}
        onLogoClick={() => setView('DASHBOARD')}
        onContactClick={() => setView('CONTACT')}
        onHelpClick={() => setView('HELP')}
        onSettingsClick={() => setView('SETTINGS')}
        notifications={notifications}
    >
        {user && !selectedPostingId && (
            <div className="space-y-4">
                {renderDashboardHeader()}
                {renderTabs()}
                {renderContent()}
            </div>
        )}

        {/* Detail Page View */}
        {user && selectedPostingId && (
            <div className="animate-fade-in-up pb-10">
                <button 
                    onClick={() => setSelectedPostingId(null)} 
                    className="mb-6 flex items-center text-slate-500 font-bold text-sm hover:text-emerald-600 transition-colors"
                >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                    Back to Dashboard
                </button>
                
                {(() => { 
                     const p = postings.find(p => p.id === selectedPostingId); 
                     if (!p) return <div className="text-center py-10 text-slate-400 font-bold">Posting not found</div>; 
                     return (
                        <div className="max-w-2xl mx-auto">
                            <FoodCard 
                                posting={p} 
                                user={user} 
                                onUpdate={(id, updates) => { storage.updatePosting(id, updates); refreshData(); }} 
                                onDelete={handleDeletePosting}
                                currentLocation={userLocation} 
                                onRateUser={handleRateUser} 
                                onChatClick={(id) => setActiveChatPostingId(id)} 
                                onTrackClick={(id) => setActiveTrackingPostingId(id)}
                            />
                        </div>
                     ); 
                 })()}
            </div>
        )}

        {/* Floating Action Button */}
        {user?.role === UserRole.DONOR && !selectedPostingId && (
            <button
                onClick={() => handleStartDonation('FOOD')}
                className="fixed bottom-10 right-10 w-16 h-16 bg-slate-900 text-white rounded-full shadow-2xl shadow-slate-900/40 flex items-center justify-center transition-all hover:scale-110 active:scale-95 z-40 group border-4 border-white hover:rotate-90 md:hidden"
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
            </button>
        )}

        {pendingVerificationPosting && <VerificationRequestModal posting={pendingVerificationPosting} onApprove={handleDonorApprove} onReject={handleDonorReject} />}
        
        {activeChatPostingId && <ChatModal posting={postings.find(p => p.id === activeChatPostingId)!} user={user!} onClose={() => setActiveChatPostingId(null)} />}
        {activeTrackingPostingId && <LiveTrackingModal posting={postings.find(p => p.id === activeTrackingPostingId)!} onClose={() => setActiveTrackingPostingId(null)} />}
        
        {/* Rating Modal */}
        {activeRatingSession && (
            <RatingModal
                targetName={activeRatingSession.targetName}
                title={`Rate ${activeRatingSession.targetName}`}
                onSubmit={submitRating}
                onClose={() => setActiveRatingSession(null)}
            />
        )}

        {/* Optimized Route Modal */}
        {optimizedRoute && (
            <RoutePlannerModal 
                orderedPostings={optimizedRoute.orderedStopIds.map(id => postings.find(p => p.id === id)!).filter(Boolean)} 
                routeOverview={optimizedRoute.overview}
                totalTime={optimizedRoute.totalEstimatedTime}
                stopReasoning={optimizedRoute.stopReasoning}
                onClose={() => setOptimizedRoute(null)}
                onSelectPosting={(id) => { setOptimizedRoute(null); setSelectedPostingId(id); }}
                language={user?.language}
            />
        )}
    </Layout>
  );
};

export default App;
