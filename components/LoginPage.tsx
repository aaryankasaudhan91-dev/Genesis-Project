
import React, { useState, useEffect, useRef } from 'react';
import { User, UserRole } from '../types';
import { storage } from '../services/storageService';
import { reverseGeocodeGoogle } from '../services/mapLoader';
import { 
    auth, 
    googleProvider, 
    signInWithPopup, 
    RecaptchaVerifier, 
    signInWithPhoneNumber,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    updateProfile,
    updatePassword,
    PhoneAuthProvider,
    signInWithCredential
} from '../services/firebaseConfig';

interface LoginPageProps {
  onLogin: (user: User) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [view, setView] = useState<'LOGIN' | 'REGISTER' | 'FORGOT_PASSWORD' | 'FORGOT_OTP' | 'NEW_PASSWORD' | 'PHONE_LOGIN' | 'PHONE_OTP'>('LOGIN');
  const [isAnimating, setIsAnimating] = useState(false);
  
  // --- LOGIN STATE ---
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // --- PHONE LOGIN / RECOVERY STATE ---
  const [phoneForAuth, setPhoneForAuth] = useState('');
  const [otp, setOtp] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  const recaptchaVerifierRef = useRef<any>(null);

  // --- NEW PASSWORD STATE ---
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordResetSuccess, setPasswordResetSuccess] = useState(false);
  
  // --- REGISTER STATE ---
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
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

  useEffect(() => {
    // Clean up recaptcha on unmount
    return () => {
        if (recaptchaVerifierRef.current) {
            try {
                recaptchaVerifierRef.current.clear();
            } catch (e) {
                // Ignore clear error
            }
        }
    };
  }, []);

  const switchView = (newView: 'LOGIN' | 'REGISTER' | 'FORGOT_PASSWORD' | 'FORGOT_OTP' | 'NEW_PASSWORD' | 'PHONE_LOGIN' | 'PHONE_OTP') => {
    setError('');
    setIsAnimating(true);
    setTimeout(() => {
      setView(newView);
      if (newView === 'FORGOT_PASSWORD') {
          setPhoneForAuth('');
      }
      if (newView === 'NEW_PASSWORD') {
          setPasswordResetSuccess(false);
          setNewPassword('');
          setConfirmNewPassword('');
      }
      if (newView === 'PHONE_LOGIN') {
          setPhoneForAuth('');
      }
      if (newView === 'PHONE_OTP' || newView === 'FORGOT_OTP') {
          setOtp('');
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
        const addr = await reverseGeocodeGoogle(latitude, longitude);
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

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);

    try {
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;
        handleSocialLoginSuccess({
            displayName: user.displayName,
            email: user.email,
            photoURL: user.photoURL
        });
    } catch (err: any) {
        setLoading(false);
        if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
            return;
        }
        console.error("Google Sign-In Error:", err);
        setError("Google Sign-In failed. Please try again.");
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
        switchView('REGISTER');
        setTimeout(() => setError("Welcome! Please complete your profile to continue."), 600);
        setLoading(false);
    }
  };

  // --- GENERIC OTP SENDER (Used for Login & Reset) ---
  const sendOtp = async (phoneNumber: string, nextView: 'PHONE_OTP' | 'FORGOT_OTP') => {
      setLoading(true);
      setError('');
      try {
          if (!recaptchaVerifierRef.current) {
              recaptchaVerifierRef.current = new RecaptchaVerifier(auth, 'recaptcha-container', {
                  'size': 'invisible',
                  'callback': () => {}
              });
          }
          
          const formattedPhone = `+91${phoneNumber.replace(/\D/g, '')}`;
          const result = await signInWithPhoneNumber(auth, formattedPhone, recaptchaVerifierRef.current);
          
          // Store result globally (for debugging) and in state
          (window as any).confirmationResult = result;
          setConfirmationResult(result);
          
          setLoading(false);
          switchView(nextView);
      } catch (err: any) {
          console.error("OTP Error:", err);
          setLoading(false);
          setError(err.message || "Failed to send OTP. Ensure phone number is valid.");
          
          if (recaptchaVerifierRef.current) {
              // Explicitly reset the grecaptcha widget if available
              try {
                  const widgetId = await recaptchaVerifierRef.current.render();
                  const grecaptcha = (window as any).grecaptcha;
                  if (grecaptcha && grecaptcha.reset) {
                      grecaptcha.reset(widgetId);
                  }
              } catch (e) {
                  // Ignore if render fails or grecaptcha is missing
              }

              // Clear the verifier instance to ensure fresh state
              try { recaptchaVerifierRef.current.clear(); } catch {}
              recaptchaVerifierRef.current = null;
          }
      }
  };

  const handleLoginSendOtp = (e: React.FormEvent) => {
      e.preventDefault();
      if (!phoneForAuth || phoneForAuth.length < 10) {
          setError("Please enter a valid 10-digit phone number");
          return;
      }
      sendOtp(phoneForAuth, 'PHONE_OTP');
  };

  const handleLoginVerifyOtp = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!otp) { setError("Please enter the OTP."); return; }
      if (!confirmationResult) { setError("Session expired. Please send OTP again."); return; }
      
      setLoading(true);
      setError('');

      try {
          // Explicitly create credential
          const credential = PhoneAuthProvider.credential(confirmationResult.verificationId, otp);
          
          // Sign in with the credential
          const result = await signInWithCredential(auth, credential);
          
          // User signed in successfully.
          const user = result.user;
          const phoneNumber = user.phoneNumber || '';

          const users = storage.getUsers();
          const existingUser = users.find(u => {
             const uPhone = (u.contactNo || '').replace(/\D/g, '');
             const inputPhone = phoneNumber.replace(/\D/g, '');
             return uPhone && inputPhone.includes(uPhone);
          });

          if (existingUser) {
              onLogin(existingUser);
          } else {
              const cleanPhone = phoneNumber.replace(/^\+91/, '').replace(/\D/g, '');
              setRegPhone(cleanPhone);
              switchView('REGISTER');
              setTimeout(() => setError("Phone verified! Please complete your profile."), 600);
          }
          setLoading(false);
      } catch (err: any) {
          setLoading(false);
          console.error(err);
          setError("Invalid OTP. Please try again.");
      }
  };

  // --- PASSWORD RESET VIA OTP LOGIC ---
  const handleForgotIdentifyUser = async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setLoading(true);

      if (!phoneForAuth || phoneForAuth.length < 10) {
          setError("Please enter your registered 10-digit phone number.");
          setLoading(false);
          return;
      }

      // Check if phone number is registered locally
      const users = storage.getUsers();
      const existingUser = users.find(u => {
          const uPhone = (u.contactNo || '').replace(/\D/g, '');
          return uPhone && phoneForAuth.includes(uPhone);
      });

      if (!existingUser) {
          setError("This phone number is not registered. Please sign up.");
          setLoading(false);
          return;
      }

      // Send OTP
      sendOtp(phoneForAuth, 'FORGOT_OTP');
  };

  const handleForgotVerifyOtp = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!otp) { setError("Please enter the OTP."); return; }
      if (!confirmationResult) { setError("Session expired. Please send OTP again."); return; }

      setLoading(true);
      setError('');

      try {
          // Explicitly create credential
          const credential = PhoneAuthProvider.credential(confirmationResult.verificationId, otp);
          
          // Sign in with the credential
          const result = await signInWithCredential(auth, credential);
          const user = result.user;
          
          // 2. Now user is auth.currentUser. We can proceed to set password.
          setLoading(false);
          switchView('NEW_PASSWORD');
      } catch (err: any) {
          console.error(err);
          setLoading(false);
          setError("Invalid verification code. Please try again.");
      }
  };

  const handleNewPasswordSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setLoading(true);

      if (newPassword.length < 6) {
          setError("Password must be at least 6 characters.");
          setLoading(false);
          return;
      }
      if (newPassword !== confirmNewPassword) {
          setError("Passwords do not match.");
          setLoading(false);
          return;
      }

      try {
          // Ensure we have an authenticated user (from the OTP step)
          if (!auth.currentUser) {
              throw new Error("Session expired. Please verify OTP again.");
          }

          // Update Password for the currently signed-in user
          await updatePassword(auth.currentUser, newPassword);
          setPasswordResetSuccess(true);
      } catch (e: any) {
          console.error("Update password error:", e);
          if (e.code === 'auth/requires-recent-login') {
             setError("Security timeout. Please verify OTP again.");
             switchView('FORGOT_PASSWORD');
          } else {
             setError("Failed to update password. " + e.message);
          }
      }
      setLoading(false);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
        const userCredential = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
        const firebaseUser = userCredential.user;
        
        const users = storage.getUsers();
        const existingUser = users.find(u => u.id === firebaseUser.uid || u.email === firebaseUser.email);

        if (!existingUser) {
            setRegEmail(loginEmail);
            switchView('REGISTER');
            setTimeout(() => setError("Profile not found locally. Please re-enter details."), 600);
            setLoading(false);
            return;
        }

        onLogin(existingUser);
    } catch (err: any) {
        setLoading(false);
        if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
            setError("Invalid email or password.");
        } else {
            setError("Login failed. Please try again.");
            console.error(err);
        }
    }
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

    try {
        let firebaseUser;
        
        if (auth.currentUser) {
            firebaseUser = auth.currentUser;
            await updateProfile(firebaseUser, {
                displayName: regName,
                photoURL: regProfilePic
            });
        } else {
            const userCredential = await createUserWithEmailAndPassword(auth, regEmail, regPassword);
            firebaseUser = userCredential.user;
            await updateProfile(firebaseUser, {
                displayName: regName,
                photoURL: regProfilePic
            });
        }

        const newUser: User = {
            id: firebaseUser.uid, 
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
        onLogin(newUser);
        setLoading(false);

    } catch (err: any) {
        setLoading(false);
        if (err.code === 'auth/email-already-in-use') {
            setError("Email already registered. Please login.");
        } else {
            setError(err.message || "Registration failed.");
        }
    }
  };

  const renderPasswordToggle = (show: boolean, setShow: (val: boolean) => void) => (
      <button 
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
          title={show ? "Hide password" : "Show password"}
      >
          {show ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
          ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
          )}
      </button>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 md:p-6 font-sans">
      <div id="recaptcha-container"></div>
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
                        <p className="text-slate-400 text-[10px] font-bold tracking-[0.3em] uppercase">Connect</p>
                    </div>
                </div>
                
                <div className={`transition-all duration-500 ${isAnimating ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}>
                    <h2 className="text-4xl md:text-5xl font-black leading-tight mb-6 tracking-tight">
                        {view === 'LOGIN' || view === 'PHONE_LOGIN' || view === 'PHONE_OTP' ? 'Welcome Back.' : 
                         view === 'REGISTER' ? 'Join the Mission.' : 
                         view === 'NEW_PASSWORD' ? 'Secure Your Account.' : 'Verify Identity.'}
                    </h2>
                    <p className="text-slate-400 font-medium text-lg leading-relaxed max-w-xs">
                        {view === 'LOGIN' || view === 'PHONE_LOGIN' || view === 'PHONE_OTP'
                            ? 'Connect to rescue food, feed communities, and create impact.' 
                            : view === 'REGISTER'
                                ? 'Create an account to become a food donor, volunteer, or beneficiary.'
                                : view === 'NEW_PASSWORD' 
                                    ? 'Create a strong new password to protect your account.'
                                    : 'We will help you recover your access via secure authentication.'}
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
        <div className="md:w-7/12 p-8 md:p-12 overflow-y-auto custom-scrollbar relative bg-white flex flex-col">
            <div className={`transition-all duration-500 transform ${isAnimating ? 'opacity-0 scale-95' : 'opacity-100 scale-100'} flex-1`}>
            
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
                            <div className="relative">
                                <input 
                                    type={showLoginPassword ? "text" : "password"}
                                    value={loginPassword} 
                                    onChange={e => setLoginPassword(e.target.value)} 
                                    placeholder="••••••••"
                                    className="w-full pl-5 pr-12 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 focus:bg-white transition-all hover:bg-slate-100"
                                />
                                {renderPasswordToggle(showLoginPassword, setShowLoginPassword)}
                            </div>
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
                        <button 
                            type="button"
                            onClick={() => switchView('PHONE_LOGIN')}
                            disabled={loading}
                            className="w-full bg-white text-slate-600 font-bold py-4 rounded-2xl border-2 border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-all flex items-center justify-center gap-3 disabled:opacity-70 group"
                        >
                            <svg className="w-5 h-5 text-slate-600 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                            Phone Number
                        </button>
                    </div>

                    <p className="mt-8 text-center text-xs font-bold text-slate-400">
                        New to MEALers? <button onClick={() => switchView('REGISTER')} className="text-emerald-600 hover:text-emerald-700 underline decoration-2 underline-offset-4 decoration-emerald-200">Create Account</button>
                    </p>
                </div>
            )}

            {/* --- FORGOT PASSWORD: STEP 1 (Identify) --- */}
            {view === 'FORGOT_PASSWORD' && (
                <div className="max-w-sm mx-auto mt-4">
                    <button onClick={() => switchView('LOGIN')} className="mb-6 text-xs font-bold text-slate-400 hover:text-slate-600 flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                        Back to Login
                    </button>
                    <h3 className="text-2xl font-black text-slate-800 mb-2">Reset Password</h3>
                    <p className="text-slate-500 font-medium text-sm mb-8">Authenticate using your registered phone number to reset your password instantly.</p>
                    
                    <form onSubmit={handleForgotIdentifyUser} className="space-y-5">
                        <div className="space-y-1">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Registered Phone Number</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                                    <span className="text-slate-500 font-bold text-sm border-r border-slate-300 pr-2">+91</span>
                                </div>
                                <input 
                                    type="tel" 
                                    maxLength={10}
                                    value={phoneForAuth} 
                                    onChange={e => setPhoneForAuth(e.target.value.replace(/\D/g, ''))} 
                                    placeholder="9876543210"
                                    className="w-full pl-20 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 focus:bg-white transition-all hover:bg-slate-100"
                                />
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
                            Verify & Proceed
                        </button>
                    </form>
                </div>
            )}

            {/* --- FORGOT PASSWORD: STEP 2 (Verify OTP) --- */}
            {view === 'FORGOT_OTP' && (
                <div className="max-w-sm mx-auto mt-4">
                     <button onClick={() => switchView('FORGOT_PASSWORD')} className="mb-6 text-xs font-bold text-slate-400 hover:text-slate-600 flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                        Change Number
                    </button>
                    <h3 className="text-2xl font-black text-slate-800 mb-2">Verify Identity</h3>
                    <p className="text-slate-500 font-medium text-sm mb-8">Enter the code sent to your phone <span className="font-bold text-slate-800">+91 {phoneForAuth}</span>.</p>
                    
                    <form onSubmit={handleForgotVerifyOtp} className="space-y-5">
                        <div className="space-y-1">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Verification Code</label>
                            <input 
                                type="text" 
                                value={otp} 
                                onChange={e => setOtp(e.target.value)} 
                                placeholder="123456"
                                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 focus:bg-white transition-all hover:bg-slate-100 tracking-widest"
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
                            Verify & Proceed
                        </button>
                    </form>
                </div>
            )}

            {view === 'NEW_PASSWORD' && (
                <div className="max-w-sm mx-auto mt-4">
                    
                    {passwordResetSuccess ? (
                         <div className="text-center animate-fade-in-up">
                            <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-100">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                            </div>
                            <h3 className="text-xl font-black text-slate-800 mb-2">Password Updated!</h3>
                            <p className="text-slate-500 font-medium text-sm mb-8">Your account is secure. You can now sign in with your new password.</p>
                            <button 
                                onClick={() => switchView('LOGIN')} 
                                className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl uppercase text-xs tracking-widest hover:bg-slate-800 transition-all"
                            >
                                Sign In Now
                            </button>
                        </div>
                    ) : (
                        <>
                            <h3 className="text-2xl font-black text-slate-800 mb-2">Create New Password</h3>
                            <p className="text-slate-500 font-medium text-sm mb-8">Identity verified. Please enter a strong new password.</p>

                            <form onSubmit={handleNewPasswordSubmit} className="space-y-5">
                                <div className="space-y-1">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">New Password</label>
                                    <div className="relative">
                                        <input 
                                            type={showNewPassword ? "text" : "password"} 
                                            value={newPassword} 
                                            onChange={e => setNewPassword(e.target.value)} 
                                            placeholder="Min. 6 characters"
                                            className="w-full pl-5 pr-12 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 focus:bg-white transition-all hover:bg-slate-100"
                                        />
                                        {renderPasswordToggle(showNewPassword, setShowNewPassword)}
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Confirm Password</label>
                                    <div className="relative">
                                        <input 
                                            type={showConfirmPassword ? "text" : "password"} 
                                            value={confirmNewPassword} 
                                            onChange={e => setConfirmNewPassword(e.target.value)} 
                                            placeholder="Re-enter password"
                                            className="w-full pl-5 pr-12 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 focus:bg-white transition-all hover:bg-slate-100"
                                        />
                                        {renderPasswordToggle(showConfirmPassword, setShowConfirmPassword)}
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
                                    Update Password
                                </button>
                            </form>
                        </>
                    )}
                </div>
            )}

            {/* Other views (PHONE_LOGIN, PHONE_OTP, REGISTER) remain unchanged */}
            {view === 'PHONE_LOGIN' && (
                <div className="max-w-sm mx-auto mt-4">
                    <button onClick={() => switchView('LOGIN')} className="mb-6 text-xs font-bold text-slate-400 hover:text-slate-600 flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                        Back
                    </button>
                    <h3 className="text-2xl font-black text-slate-800 mb-8">Phone Login</h3>
                    <form onSubmit={handleLoginSendOtp} className="space-y-5">
                        <div className="space-y-1">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Phone Number</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                                    <span className="text-slate-500 font-bold text-sm border-r border-slate-300 pr-2">+91</span>
                                </div>
                                <input 
                                    type="tel" 
                                    value={phoneForAuth} 
                                    maxLength={10}
                                    onChange={e => setPhoneForAuth(e.target.value.replace(/\D/g, ''))} 
                                    placeholder="9876543210"
                                    className="w-full pl-20 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 focus:bg-white transition-all hover:bg-slate-100"
                                />
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
                            Send OTP
                        </button>
                    </form>
                </div>
            )}

            {view === 'PHONE_OTP' && (
                <div className="max-w-sm mx-auto mt-4">
                    <button onClick={() => switchView('PHONE_LOGIN')} className="mb-6 text-xs font-bold text-slate-400 hover:text-slate-600 flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                        Change Number
                    </button>
                    <h3 className="text-2xl font-black text-slate-800 mb-2">Verify OTP</h3>
                    <p className="text-slate-500 font-medium text-sm mb-8">Enter the verification code sent to +91{phoneForAuth}.</p>
                    
                    <form onSubmit={handleLoginVerifyOtp} className="space-y-5">
                        <div className="space-y-1">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">One Time Password</label>
                            <input 
                                type="text" 
                                value={otp} 
                                onChange={e => setOtp(e.target.value)} 
                                placeholder="123456"
                                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 focus:bg-white transition-all hover:bg-slate-100 tracking-widest"
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
                            Verify & Login
                        </button>
                    </form>
                </div>
            )}
            
            {/* Registration View */}
            {view === 'REGISTER' && (
                <div className="max-w-md mx-auto">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-2xl font-black text-slate-800">Create Account</h3>
                        <button onClick={() => switchView('LOGIN')} className="text-xs font-bold text-slate-400 hover:text-slate-600">
                            Already have an account?
                        </button>
                    </div>

                    <form onSubmit={handleRegister} className="space-y-6">
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
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                                            <span className="text-slate-500 font-bold text-sm border-r border-slate-300 pr-2">+91</span>
                                        </div>
                                        <input 
                                            type="tel" 
                                            value={regPhone} 
                                            maxLength={10}
                                            onChange={e => setRegPhone(e.target.value.replace(/\D/g, ''))} 
                                            placeholder="9876543210" 
                                            className="w-full pl-20 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 transition-all" 
                                        />
                                    </div>
                                </div>
                            </div>
                            
                            <div className="space-y-1">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Email</label>
                                <input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} required placeholder="john@example.com" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 transition-all" />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Password</label>
                                <div className="relative">
                                    <input 
                                        type={showRegPassword ? "text" : "password"} 
                                        value={regPassword} 
                                        onChange={e => setRegPassword(e.target.value)} 
                                        required 
                                        placeholder="Create a strong password" 
                                        minLength={6} 
                                        className="w-full pl-5 pr-12 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 transition-all" 
                                    />
                                    {renderPasswordToggle(showRegPassword, setShowRegPassword)}
                                </div>
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
                                                    <option>Oldcarehome</option>
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

            </div>

            <div className="mt-8 text-center">
                <p className="text-slate-300 text-[10px] font-black uppercase tracking-widest">
                    &copy; {new Date().getFullYear()} MEALers connect
                </p>
            </div>
        </div>
      </div>
    </div>
  );
};
