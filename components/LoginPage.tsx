import React, { useState, useEffect, useRef } from 'react';
import { User, UserRole } from '../types';
import { storage } from '../services/storageService';
import { reverseGeocode } from '../services/geminiService';
import { auth, googleProvider } from '../services/firebaseConfig';
import { RecaptchaVerifier, signInWithPhoneNumber, signInWithPopup, ConfirmationResult } from 'firebase/auth';

interface LoginPageProps {
  onLogin: (user: User) => void;
}

declare global {
  interface Window {
    recaptchaVerifier: any;
    grecaptcha: any;
  }
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [view, setView] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  
  // --- LOGIN STATE ---
  const [loginIdentifier, setLoginIdentifier] = useState(''); // Email or Phone
  const [loginPassword, setLoginPassword] = useState('');     // Password or OTP
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  
  // --- REGISTER STATE ---
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
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
  const [isSimulated, setIsSimulated] = useState(!auth); // Default to simulation if auth is missing
  
  const recaptchaContainerRef = useRef<HTMLDivElement>(null);

  // Initialize Recaptcha only if Auth is available
  useEffect(() => {
    const initRecaptcha = async () => {
      if (window.recaptchaVerifier) {
        try { window.recaptchaVerifier.clear(); } catch (e) {}
        window.recaptchaVerifier = undefined;
      }

      if (!auth) return;
      if (!recaptchaContainerRef.current) return;

      try {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, recaptchaContainerRef.current, {
          'size': 'invisible',
          'callback': () => console.log("Recaptcha solved"),
          'expired-callback': () => setError('Recaptcha expired. Please refresh and try again.')
        });
      } catch (err) {
        console.error("Recaptcha Setup Error:", err);
      }
    };
    const timer = setTimeout(initRecaptcha, 500);
    return () => clearTimeout(timer);
  }, [view]);

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation not supported");
      return;
    }
    setDetectingLoc(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      setLatLng({ lat: latitude, lng: longitude });
      const addr = await reverseGeocode(latitude, longitude);
      if (addr) {
        setLine1(addr.line1);
        setLine2(addr.line2);
        setPincode(addr.pincode);
      }
      setDetectingLoc(false);
    }, (err) => {
      setError("Location access denied");
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
      }, 800);
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
        console.error("Google Sign-In Error:", err);
        // Fallback to simulation for any auth error to ensure app is usable
        setIsSimulated(true);
        performSimulationLogin();
    }
  };

  const handleSocialLoginSuccess = (socialUser: { displayName: string | null, email: string | null, photoURL: string | null | undefined }) => {
    const users = storage.getUsers();
    const existingUser = users.find(u => u.email === socialUser.email);

    if (existingUser) {
        onLogin(existingUser);
    } else {
        setRegName(socialUser.displayName || '');
        setRegEmail(socialUser.email || '');
        setRegProfilePic(socialUser.photoURL || undefined);
        setView('REGISTER');
        setError("Welcome! Please complete your profile to continue.");
    }
    setLoading(false);
  };

  const handleSendLoginOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!loginIdentifier || loginIdentifier.length < 10) {
        setError("Please enter a valid phone number");
        setLoading(false);
        return;
    }

    const phoneNumber = loginIdentifier.startsWith('+') ? loginIdentifier : `+91${loginIdentifier}`;
    
    const triggerSimulation = () => {
        setIsSimulated(true);
        setIsOtpSent(true);
        setLoading(false);
        alert(`[DEMO MODE] Your OTP for ${phoneNumber} is 123456`);
    };

    if (!auth || !window.recaptchaVerifier) {
      triggerSimulation();
      return;
    }

    try {
      const confirmation = await signInWithPhoneNumber(auth, phoneNumber, window.recaptchaVerifier);
      setConfirmationResult(confirmation);
      setIsOtpSent(true);
      setLoading(false);
    } catch (err: any) {
      console.warn(`Auth Error: ${err.code}. Falling back to simulation.`);
      triggerSimulation();
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const users = storage.getUsers();
    const checkPhone = loginIdentifier.replace(/\D/g, '').slice(-10);
    const existingUser = users.find(u => 
        u.email === loginIdentifier || 
        (u.contactNo && u.contactNo.replace(/\D/g, '').slice(-10) === checkPhone)
    );

    if (!existingUser) {
        setError("User not found. Please register.");
        setLoading(false);
        return;
    }

    try {
        if (isSimulated) {
            if (loginPassword !== '123456') throw new Error("Invalid Simulation OTP");
        } else if (confirmationResult) {
            await confirmationResult.confirm(loginPassword);
        } else if (existingUser.password && existingUser.password !== loginPassword) {
             throw new Error("Invalid Password");
        }
        
        onLogin(existingUser);
    } catch (err: any) {
        console.error(err);
        setError("Invalid OTP or Password");
        setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!regName || !regPhone || !line1 || !pincode) {
        setError("Please fill all required fields");
        setLoading(false);
        return;
    }

    const newUser: User = {
        id: Math.random().toString(36).substr(2, 9),
        name: regName,
        email: regEmail,
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

  const switchView = (v: 'LOGIN' | 'REGISTER') => {
      setView(v);
      setError('');
      setIsOtpSent(false);
      setLoginIdentifier('');
      setLoginPassword('');
      if (v === 'REGISTER' && !regEmail) {
          setRegName(''); setRegEmail(''); setRegPhone('');
      }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-4xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[600px] animate-fade-in-up">
        
        {/* Left Side */}
        <div className="md:w-1/2 bg-slate-900 p-12 text-white flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
            
            <div className="relative z-10">
                <div className="flex items-center gap-3 mb-8">
                    <div className="text-4xl filter drop-shadow-lg">🍃</div>
                    <div>
                        <h1 className="text-2xl font-black tracking-tighter leading-none">MEALers</h1>
                        <p className="text-[10px] font-bold text-emerald-400 tracking-[0.3em] uppercase">Connect</p>
                    </div>
                </div>
                
                <h2 className="text-4xl font-black leading-tight mb-4">
                    {view === 'LOGIN' ? 'Welcome Back.' : 'Join the Mission.'}
                </h2>
                <p className="text-slate-400 font-medium text-lg leading-relaxed">
                    {view === 'LOGIN' 
                        ? 'Log in to continue rescuing food and feeding communities.' 
                        : 'Create an account to start donating food or volunteering.'}
                </p>
            </div>

            <div className="relative z-10 mt-auto">
                 <div className="flex -space-x-3 mb-4">
                    {[1,2,3,4].map(i => (
                        <div key={i} className={`w-10 h-10 rounded-full border-2 border-slate-900 bg-slate-800 flex items-center justify-center text-xs font-bold`}>
                             {String.fromCharCode(64+i)}
                        </div>
                    ))}
                    <div className="w-10 h-10 rounded-full border-2 border-slate-900 bg-emerald-600 flex items-center justify-center text-xs font-bold">+2k</div>
                 </div>
                 <p className="text-sm font-bold text-slate-300">Join thousands of food heroes today.</p>
            </div>
        </div>

        {/* Right Side */}
        <div className="md:w-1/2 p-8 md:p-12 overflow-y-auto custom-scrollbar relative">
            <div ref={recaptchaContainerRef} id="recaptcha-container"></div>
            
            {view === 'LOGIN' ? (
                <div className="max-w-sm mx-auto mt-6">
                    <form onSubmit={isOtpSent ? handleLoginSubmit : handleSendLoginOtp} className="space-y-6">
                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Phone Number</label>
                            <input 
                                type="tel" 
                                disabled={isOtpSent}
                                value={loginIdentifier} 
                                onChange={e => setLoginIdentifier(e.target.value)} 
                                placeholder="9876543210"
                                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 transition-all disabled:opacity-60"
                            />
                        </div>

                        {isOtpSent && (
                            <div className="animate-fade-in-up">
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Enter OTP</label>
                                <input 
                                    type="text" 
                                    value={loginPassword} 
                                    onChange={e => setLoginPassword(e.target.value)} 
                                    placeholder="123456"
                                    maxLength={6}
                                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 transition-all tracking-widest text-center text-xl"
                                />
                                <div className="text-center mt-2">
                                    <button type="button" onClick={() => setIsOtpSent(false)} className="text-xs font-bold text-emerald-600 hover:underline">Change Number</button>
                                </div>
                            </div>
                        )}

                        {error && <p className="text-rose-500 text-xs font-black text-center bg-rose-50 py-2 rounded-lg">{error}</p>}

                        <button 
                            type="submit" 
                            disabled={loading}
                            className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl uppercase text-xs tracking-widest shadow-xl shadow-slate-200 hover:bg-slate-800 hover:-translate-y-0.5 transition-all disabled:opacity-70 flex justify-center items-center gap-2"
                        >
                            {loading && <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                            {isOtpSent ? 'Verify & Login' : 'Send OTP'}
                        </button>
                    </form>

                    <div className="my-6 flex items-center gap-4">
                        <div className="h-px bg-slate-200 flex-1"></div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">OR</span>
                        <div className="h-px bg-slate-200 flex-1"></div>
                    </div>

                    {auth ? (
                        <button 
                            type="button"
                            onClick={handleGoogleLogin}
                            disabled={loading}
                            className="w-full bg-white text-slate-700 font-bold py-4 rounded-2xl border-2 border-slate-100 hover:border-slate-300 hover:bg-slate-50 transition-all flex items-center justify-center gap-3 disabled:opacity-70"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                            </svg>
                            Sign in with Google
                        </button>
                    ) : (
                        <button 
                            type="button"
                            onClick={handleGoogleLogin}
                            disabled={loading}
                            className="w-full bg-slate-100 text-slate-600 font-bold py-4 rounded-2xl border-2 border-slate-200 hover:bg-slate-200 transition-all flex items-center justify-center gap-3 disabled:opacity-70 group"
                        >
                            <span className="bg-slate-200 p-1 rounded-md text-slate-500 group-hover:bg-white group-hover:text-slate-700 transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                            </span>
                            Demo Login
                        </button>
                    )}

                    <div className="text-center pt-6">
                        <p className="text-slate-400 text-xs font-medium">Don't have an account?</p>
                        <button type="button" onClick={() => switchView('REGISTER')} className="text-emerald-600 font-black text-xs uppercase tracking-wider mt-1 hover:underline">Register Now</button>
                    </div>
                </div>
            ) : (
                <form onSubmit={handleRegister} className="space-y-5 max-w-sm mx-auto">
                    {regProfilePic && (
                        <div className="flex justify-center mb-2">
                             <img src={regProfilePic} alt="Profile" className="w-20 h-20 rounded-full border-4 border-slate-100 shadow-md" />
                        </div>
                    )}
                    
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                        {[UserRole.DONOR, UserRole.VOLUNTEER, UserRole.REQUESTER].map(r => (
                            <button 
                                key={r} 
                                type="button"
                                onClick={() => setRegRole(r)}
                                className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all ${regRole === r ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                {r}
                            </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <input value={regName} onChange={e => setRegName(e.target.value)} placeholder="Full Name" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                        <input value={regPhone} onChange={e => setRegPhone(e.target.value)} placeholder="Phone" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                    
                    <input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} placeholder="Email (Optional)" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />

                    {regRole !== UserRole.VOLUNTEER && (
                         <div className="grid grid-cols-2 gap-4">
                            <input value={regOrgName} onChange={e => setRegOrgName(e.target.value)} placeholder={regRole === UserRole.DONOR ? "Restaurant Name" : "Orphanage Name"} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                            <select value={regOrgCategory} onChange={e => setRegOrgCategory(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                                {regRole === UserRole.DONOR ? (
                                    <>
                                        <option value="Restaurant">Restaurant</option>
                                        <option value="Event">Event</option>
                                        <option value="Individual">Individual</option>
                                    </>
                                ) : (
                                    <>
                                        <option value="Orphanage">Orphanage</option>
                                        <option value="Shelter">Shelter</option>
                                        <option value="Old Age Home">Old Age Home</option>
                                    </>
                                )}
                            </select>
                         </div>
                    )}

                    <div className="space-y-2 pt-2 border-t border-slate-100">
                        <div className="flex justify-between items-center">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Location</label>
                            <button type="button" onClick={handleDetectLocation} className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded hover:bg-emerald-100 transition-colors">
                                {detectingLoc ? 'Detecting...' : 'Use Current'}
                            </button>
                        </div>
                        <input value={line1} onChange={e => setLine1(e.target.value)} placeholder="Address Line 1" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                        <div className="grid grid-cols-2 gap-4">
                            <input value={line2} onChange={e => setLine2(e.target.value)} placeholder="City/Area" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                            <input value={pincode} onChange={e => setPincode(e.target.value)} placeholder="Pincode" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                        </div>
                    </div>

                    {error && <p className="text-rose-500 text-xs font-black text-center bg-rose-50 py-2 rounded-lg">{error}</p>}

                    <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl uppercase text-xs tracking-widest shadow-xl shadow-slate-200 hover:bg-slate-800 hover:-translate-y-0.5 transition-all disabled:opacity-70"
                    >
                         {loading ? 'Creating...' : 'Register Account'}
                    </button>
                    
                    <div className="text-center">
                        <button type="button" onClick={() => switchView('LOGIN')} className="text-slate-400 font-bold text-xs hover:text-slate-600">Back to Login</button>
                    </div>
                </form>
            )}
        </div>
      </div>
    </div>
  );
};