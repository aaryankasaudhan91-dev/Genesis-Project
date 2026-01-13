import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { storage } from '../services/storageService';
import { reverseGeocode } from '../services/geminiService';
import { auth, googleProvider } from '../services/firebaseConfig';
import { signInWithPopup, sendPasswordResetEmail } from 'firebase/auth';

interface LoginPageProps {
  onLogin: (user: User) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [view, setView] = useState<'LOGIN' | 'REGISTER' | 'FORGOT_PASSWORD'>('LOGIN');
  const [isAnimating, setIsAnimating] = useState(false);
  
  // --- LOGIN STATE ---
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // --- FORGOT PASSWORD STATE ---
  const [forgotEmail, setForgotEmail] = useState('');
  const [isResetSent, setIsResetSent] = useState(false);
  
  // --- REGISTER STATE ---
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regRole, setRegRole] = useState<UserRole>(UserRole.DONOR);
  const [regOrgName, setRegOrgName] = useState('');
  const [regOrgCategory, setRegOrgCategory] = useState('Restaurant');
  const [regProfilePic, setRegProfilePic] = useState<string | undefined>(undefined);
  
  // --- LOCATION STATE ---
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [pincode, setPincode] = useState('');
  const [latLng, setLatLng] = useState<{lat: number, lng: number} | undefined>(undefined);
  const [detectingLoc, setDetectingLoc] = useState(false);

  // --- UI STATE ---
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const switchView = (newView: 'LOGIN' | 'REGISTER' | 'FORGOT_PASSWORD') => {
    setError('');
    setIsAnimating(true);
    setTimeout(() => {
      setView(newView);
      if (newView === 'FORGOT_PASSWORD') {
          setForgotEmail('');
          setIsResetSent(false);
      }
      setIsAnimating(false);
    }, 500);
  };

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation not supported");
      return;
    }
    setDetectingLoc(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      setLatLng({ lat: latitude, lng: longitude });
      try {
        const addr = await reverseGeocode(latitude, longitude);
        if (addr) {
          setLine1(addr.line1);
          setLine2(addr.line2);
          setPincode(addr.pincode);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setDetectingLoc(false);
      }
    }, (err) => {
      setError("Location access denied. Please enter manually.");
      setDetectingLoc(false);
    });
  };

  const performSimulationLogin = () => {
      setTimeout(() => {
         handleSocialLoginSuccess({
             displayName: "Demo User",
             email: "demo@mealers.org",
             photoURL: undefined
         });
      }, 1500); 
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);

    if (!auth) {
        console.warn("Auth Not Initialized. Using Simulation.");
        performSimulationLogin();
        return;
    }

    try {
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;
        handleSocialLoginSuccess({
            displayName: user.displayName,
            email: user.email,
            photoURL: user.photoURL
        });
    } catch (err: any) {
        if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
            setLoading(false);
            return;
        }
        console.warn("Google Sign-In Error, falling back to demo:", err);
        performSimulationLogin();
    }
  };

  const handleSocialLoginSuccess = (socialUser: { displayName: string | null, email: string | null, photoURL: string | null | undefined }) => {
    const users = storage.getUsers();
    // Only verify email exists
    const existingUser = users.find(u => u.email === socialUser.email);

    if (existingUser) {
        onLogin(existingUser);
    } else {
        setRegName(socialUser.displayName || '');
        setRegEmail(socialUser.email || '');
        setRegProfilePic(socialUser.photoURL || undefined);
        switchView('REGISTER');
        setTimeout(() => setError("Welcome! Please complete your profile to continue."), 600);
        setLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Artificial delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    if (!forgotEmail) {
        setError("Please enter your email.");
        setLoading(false);
        return;
    }

    // Try Firebase first if available
    if (auth) {
        try {
            await sendPasswordResetEmail(auth, forgotEmail);
            setIsResetSent(true);
            setLoading(false);
            return;
        } catch (e: any) {
            console.log("Firebase reset failed, checking local storage for simulation...", e);
        }
    }

    // Fallback to local storage check for demo purposes
    const users = storage.getUsers();
    const user = users.find(u => u.email.toLowerCase() === forgotEmail.toLowerCase());
    
    if (user) {
        // In a real app without firebase, we'd call an API. 
        // Here we just simulate success for the demo environment.
        setIsResetSent(true);
    } else {
        setError("No account found with that email address.");
    }
    setLoading(false);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Artificial delay for UX smoothness
    await new Promise(resolve => setTimeout(resolve, 800));

    const users = storage.getUsers();
    const existingUser = users.find(u => u.email.toLowerCase() === loginEmail.toLowerCase());

    if (!existingUser) {
        setError("Account not found. Please register.");
        setLoading(false);
        return;
    }

    if (existingUser.password && existingUser.password !== loginPassword) {
        setError("Incorrect password.");
        setLoading(false);
        return;
    }
    
    // For users created via social login who didn't set a password
    if (!existingUser.password) {
        setError("This account uses Google Sign-In.");
        setLoading(false);
        return;
    }

    onLogin(existingUser);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!regName || !regEmail || !regPassword || !line1 || !pincode) {
        setError("Please fill all required fields");
        setLoading(false);
        return;
    }
    
    if (regPassword.length < 6) {
        setError("Password must be at least 6 characters");
        setLoading(false);
        return;
    }

    // Artificial delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    const users = storage.getUsers();
    if (users.find(u => u.email.toLowerCase() === regEmail.toLowerCase())) {
        setError("Email already registered. Please login.");
        setLoading(false);
        return;
    }

    const newUser: User = {
        id: Math.random().toString(36).substr(2, 9),
        name: regName,
        email: regEmail,
        password: regPassword, 
        contactNo: regPhone,
        role: regRole,
        orgName: regRole !== UserRole.VOLUNTEER ? regOrgName : undefined,
        orgCategory: regRole !== UserRole.VOLUNTEER ? regOrgCategory : undefined,
        address: {
            line1,
            line2,
            pincode,
            lat: latLng?.lat,
            lng: latLng?.lng
        },
        profilePictureUrl: regProfilePic,
        impactScore: 0,
        averageRating: 5.0,
        ratingsCount: 0
    };

    storage.saveUser(newUser);
    setLoading(false);
    onLogin(newUser);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 md:p-6 font-sans">
      <div className="w-full max-w-5xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[700px] animate-fade-in-up transition-all duration-500">
        
        {/* Left Side (Visuals) */}
        <div className="md:w-5/12 bg-slate-900 p-10 md:p-12 text-white flex flex-col justify-between relative overflow-hidden group">
            {/* Animated Background Blobs */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-emerald-500/30 transition-colors duration-1000"></div>
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 group-hover:bg-blue-500/30 transition-colors duration-1000"></div>
            
            <div className="relative z-10">
                <div className="flex items-center gap-3 mb-12">
                    <div className="text-4xl filter drop-shadow-lg animate-bounce-slow">🍃</div>
                    <div>
                        <h1 className="text-2xl font-black tracking-tighter leading-none">MEALers</h1>
                        <p className="text-[10px] font-bold text-emerald-400 tracking-[0.3em] uppercase">Connect</p>
                    </div>
                </div>
                
                <div className={`transition-all duration-500 ${isAnimating ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}>
                    <h2 className="text-4xl md:text-5xl font-black leading-tight mb-6 tracking-tight">
                        {view === 'LOGIN' ? 'Welcome Back.' : view === 'REGISTER' ? 'Join the Mission.' : 'Rest Easy.'}
                    </h2>
                    <p className="text-slate-400 font-medium text-lg leading-relaxed max-w-xs">
                        {view === 'LOGIN' 
                            ? 'Connect to rescue food, feed communities, and create impact.' 
                            : view === 'REGISTER'
                                ? 'Create an account to become a food donor, volunteer, or beneficiary.'
                                : 'We will help you recover your access in no time.'}
                    </p>
                </div>
            </div>

            <div className="relative z-10 mt-auto pt-8">
                 <div className="flex -space-x-3 mb-4 pl-2">
                    {[1,2,3,4].map(i => (
                        <div key={i} className={`w-10 h-10 rounded-full border-2 border-slate-900 bg-slate-800 flex items-center justify-center text-xs font-bold ring-2 ring-slate-900 transition-transform hover:-translate-y-1 hover:z-10 cursor-default`}>
                             {String.fromCharCode(64+i)}
                        </div>
                    ))}
                    <div className="w-10 h-10 rounded-full border-2 border-slate-900 bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-xs font-bold ring-2 ring-slate-900 shadow-lg shadow-emerald-500/20">+2k</div>
                 </div>
                 <p className="text-sm font-bold text-slate-300 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    Join thousands of food heroes today.
                 </p>
            </div>
        </div>

        {/* Right Side (Forms) */}
        <div className="md:w-7/12 p-8 md:p-12 overflow-y-auto custom-scrollbar relative bg-white">
            <div className={`transition-all duration-500 transform ${isAnimating ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
            
            {view === 'LOGIN' && (
                <div className="max-w-sm mx-auto mt-4">
                    <h3 className="text-2xl font-black text-slate-800 mb-8">Sign In</h3>
                    <form onSubmit={handleLoginSubmit} className="space-y-5">
                        <div className="space-y-1">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Email</label>
                            <input 
                                type="email" 
                                value={loginEmail} 
                                onChange={e => setLoginEmail(e.target.value)} 
                                placeholder="name@example.com"
                                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 focus:bg-white transition-all hover:bg-slate-100"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Password</label>
                            <input 
                                type="password" 
                                value={loginPassword} 
                                onChange={e => setLoginPassword(e.target.value)} 
                                placeholder="••••••••"
                                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 focus:bg-white transition-all hover:bg-slate-100"
                            />
                            <div className="text-right">
                                <button type="button" onClick={() => switchView('FORGOT_PASSWORD')} className="text-[10px] font-bold text-slate-400 hover:text-emerald-600 transition-colors uppercase tracking-wider">Forgot Password?</button>
                            </div>
                        </div>

                        {error && (
                            <div className="animate-fade-in-up p-3 bg-rose-50 rounded-xl flex items-center gap-3 border border-rose-100">
                                <svg className="w-5 h-5 text-rose-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                <p className="text-rose-600 text-xs font-bold leading-tight">{error}</p>
                            </div>
                        )}

                        <button 
                            type="submit" 
                            disabled={loading}
                            className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl uppercase text-xs tracking-widest shadow-xl shadow-slate-200 hover:bg-slate-800 hover:-translate-y-0.5 hover:shadow-2xl transition-all disabled:opacity-70 disabled:transform-none flex justify-center items-center gap-3"
                        >
                            {loading && <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                            Sign In
                        </button>
                    </form>

                    <div className="my-8 flex items-center gap-4">
                        <div className="h-px bg-slate-100 flex-1"></div>
                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Or Continue With</span>
                        <div className="h-px bg-slate-100 flex-1"></div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                         <button 
                            type="button"
                            onClick={handleGoogleLogin}
                            disabled={loading}
                            className="w-full bg-white text-slate-600 font-bold py-4 rounded-2xl border-2 border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-all flex items-center justify-center gap-3 disabled:opacity-70 group"
                        >
                            <svg className="w-5 h-5 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.45 0 5.38 0 7.7Z" fill="#EA4335"/>
                            </svg>
                            Google
                        </button>
                    </div>

                    <p className="mt-8 text-center text-xs font-bold text-slate-400">
                        New to MEALers? <button onClick={() => switchView('REGISTER')} className="text-emerald-600 hover:text-emerald-700 underline decoration-2 underline-offset-4 decoration-emerald-200">Create Account</button>
                    </p>
                </div>
            )}

            {view === 'REGISTER' && (
                <div className="max-w-md mx-auto">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-2xl font-black text-slate-800">Create Account</h3>
                        <button onClick={() => switchView('LOGIN')} className="text-xs font-bold text-slate-400 hover:text-slate-600">
                            Already have an account?
                        </button>
                    </div>

                    <form onSubmit={handleRegister} className="space-y-6">
                        
                        {/* Role Selection */}
                        <div className="bg-slate-50 p-1.5 rounded-2xl flex border border-slate-100">
                            {[UserRole.DONOR, UserRole.VOLUNTEER, UserRole.REQUESTER].map(role => (
                                <button
                                    key={role}
                                    type="button"
                                    onClick={() => setRegRole(role)}
                                    className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${regRole === role ? 'bg-white text-slate-900 shadow-md ring-1 ring-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    {role}
                                </button>
                            ))}
                        </div>

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                                    <input value={regName} onChange={e => setRegName(e.target.value)} required placeholder="John Doe" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 transition-all" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Phone</label>
                                    <input value={regPhone} onChange={e => setRegPhone(e.target.value)} placeholder="9876543210" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 transition-all" />
                                </div>
                            </div>
                            
                            <div className="space-y-1">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Email</label>
                                <input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} required placeholder="john@example.com" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 transition-all" />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Password</label>
                                <input type="password" value={regPassword} onChange={e => setRegPassword(e.target.value)} required placeholder="Create a strong password" minLength={6} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 transition-all" />
                                <p className="text-[10px] text-slate-400 font-bold px-1">Must be at least 6 characters.</p>
                            </div>

                            {regRole !== UserRole.VOLUNTEER && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Org Name</label>
                                        <input value={regOrgName} onChange={e => setRegOrgName(e.target.value)} placeholder={regRole === UserRole.DONOR ? "Restaurant Name" : "Orphanage Name"} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 transition-all" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Category</label>
                                        <select value={regOrgCategory} onChange={e => setRegOrgCategory(e.target.value)} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 transition-all appearance-none">
                                            {regRole === UserRole.DONOR ? (
                                                <>
                                                    <option>Restaurant</option>
                                                    <option>Bakery</option>
                                                    <option>Individual</option>
                                                    <option>Event</option>
                                                </>
                                            ) : (
                                                <>
                                                    <option>Orphanage</option>
                                                    <option>Shelter</option>
                                                    <option>NGO</option>
                                                </>
                                            )}
                                        </select>
                                    </div>
                                </div>
                            )}

                            <div className="pt-2">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Address</label>
                                    <button type="button" onClick={handleDetectLocation} className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg uppercase tracking-wider hover:bg-emerald-100 transition-colors flex items-center gap-1">
                                        {detectingLoc ? 'Detecting...' : '📍 Detect'}
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    <input value={line1} onChange={e => setLine1(e.target.value)} placeholder="Street / Building" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 transition-all" />
                                    <div className="grid grid-cols-2 gap-4">
                                        <input value={line2} onChange={e => setLine2(e.target.value)} placeholder="Area / City" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 transition-all" />
                                        <input value={pincode} onChange={e => setPincode(e.target.value)} placeholder="Pincode" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 transition-all" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {error && (
                            <div className="animate-fade-in-up p-3 bg-rose-50 rounded-xl flex items-center gap-3 border border-rose-100">
                                <svg className="w-5 h-5 text-rose-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                <p className="text-rose-600 text-xs font-bold leading-tight">{error}</p>
                            </div>
                        )}

                        <button 
                            type="submit" 
                            disabled={loading}
                            className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl uppercase text-xs tracking-widest shadow-xl shadow-slate-200 hover:bg-slate-800 hover:-translate-y-0.5 hover:shadow-2xl transition-all disabled:opacity-70 disabled:transform-none flex justify-center items-center gap-3"
                        >
                             {loading && <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                            Create Account
                        </button>
                    </form>
                </div>
            )}

            {view === 'FORGOT_PASSWORD' && (
                <div className="max-w-sm mx-auto mt-4">
                    <h3 className="text-2xl font-black text-slate-800 mb-2">Reset Password</h3>
                    <p className="text-slate-500 font-medium text-sm mb-8">Enter your email and we'll send you instructions to reset your password.</p>
                    
                    {!isResetSent ? (
                        <form onSubmit={handleForgotSubmit} className="space-y-5">
                            <div className="space-y-1">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Email</label>
                                <input 
                                    type="email" 
                                    value={forgotEmail} 
                                    onChange={e => setForgotEmail(e.target.value)} 
                                    placeholder="name@example.com"
                                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 focus:bg-white transition-all hover:bg-slate-100"
                                />
                            </div>

                            {error && (
                                <div className="animate-fade-in-up p-3 bg-rose-50 rounded-xl flex items-center gap-3 border border-rose-100">
                                    <svg className="w-5 h-5 text-rose-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    <p className="text-rose-600 text-xs font-bold leading-tight">{error}</p>
                                </div>
                            )}

                            <button 
                                type="submit" 
                                disabled={loading}
                                className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl uppercase text-xs tracking-widest shadow-xl shadow-slate-200 hover:bg-slate-800 hover:-translate-y-0.5 hover:shadow-2xl transition-all disabled:opacity-70 disabled:transform-none flex justify-center items-center gap-3"
                            >
                                {loading && <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                                Send Reset Link
                            </button>
                        </form>
                    ) : (
                        <div className="text-center animate-fade-in-up">
                            <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner ring-1 ring-emerald-100">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76" /></svg>
                            </div>
                            <h4 className="text-lg font-black text-slate-800 mb-2">Check your mail</h4>
                            <p className="text-slate-500 font-medium text-sm mb-6">We have sent a password recover instructions to your email.</p>
                        </div>
                    )}
                    
                    <button onClick={() => switchView('LOGIN')} className="mt-8 w-full text-center text-xs font-bold text-slate-400 hover:text-emerald-600 transition-colors uppercase tracking-widest flex items-center justify-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                        Back to Sign In
                    </button>
                </div>
            )}

            </div>
        </div>
      </div>
    </div>
  );
};