
import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { storage } from '../services/storageService';
import { reverseGeocode } from '../services/geminiService';

interface LoginPageProps {
  onLogin: (user: User) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [view, setView] = useState<'LOGIN' | 'REGISTER' | 'SOCIAL_SETUP'>('LOGIN');
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  
  // --- LOGIN STATE ---
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // --- SOCIAL LOGIN STATE ---
  const [isSocialProcessing, setIsSocialProcessing] = useState<string | null>(null);
  const [socialProfile, setSocialProfile] = useState<{name: string, email: string, provider: string, picture?: string} | null>(null);

  // --- REGISTER STATE (WIZARD) & SOCIAL SETUP ---
  const [currentStep, setCurrentStep] = useState(1);
  const [totalSteps, setTotalSteps] = useState(3);
  
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regContactNo, setRegContactNo] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState<UserRole>(UserRole.DONOR);
  
  // Requester Specific
  const [regOrgName, setRegOrgName] = useState('');
  const [regOrgCategory, setRegOrgCategory] = useState('Orphanage');
  const [regLine1, setRegLine1] = useState('');
  const [regLine2, setRegLine2] = useState('');
  const [regLandmark, setRegLandmark] = useState('');
  const [regPincode, setRegPincode] = useState('');
  const [isAutoDetecting, setIsAutoDetecting] = useState(false);

  // Update total steps based on role for normal registration
  useEffect(() => {
    if (view === 'REGISTER') {
        if (regRole === UserRole.REQUESTER) {
            setTotalSteps(4);
        } else {
            setTotalSteps(3);
        }
    }
  }, [regRole, view]);

  // --- HANDLERS ---

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const users = storage.getUsers();
    
    // Allow login by Name OR Email
    const existing = users.find(u => 
        u.name.toLowerCase() === loginIdentifier.toLowerCase() || 
        u.email.toLowerCase() === loginIdentifier.toLowerCase()
    );

    if (existing) {
      if (existing.password && existing.password !== loginPassword) {
        alert("Invalid password.");
        return;
      }
      onLogin(existing);
    } else {
        alert("User not found. Please check your username/email or register.");
    }
  };

  const handleDemoLogin = (role: UserRole) => {
    // Always create a fresh demo user for this session to ensure 0 stats (Impact Score / Donations)
    // Using Date.now() in ID ensures it doesn't link to previous demo user data/postings.
    const demoUser = {
        id: `demo-${role.toLowerCase()}-${Date.now()}`,
        name: `Demo ${role.charAt(0) + role.slice(1).toLowerCase()}`,
        email: `demo.${role.toLowerCase()}@sharemeal.com`,
        contactNo: '9876543210',
        password: 'demo',
        role: role,
        impactScore: 0, // Reset Impact Score to 0
        averageRating: 0,
        ratingsCount: 0,
        address: role === UserRole.REQUESTER ? {
            line1: "12 Sunshine Orphanage",
            line2: "Happy Valley, MG Road",
            landmark: "Near Central Park",
            pincode: "560001"
        } : undefined,
        orgName: role === UserRole.REQUESTER ? "Sunshine Orphanage" : undefined,
        orgCategory: role === UserRole.REQUESTER ? "Orphanage" : undefined
    };
    storage.saveUser(demoUser);
    onLogin(demoUser);
  };

  const handleSocialAuth = (provider: string) => {
      setIsSocialProcessing(provider);
      
      // Simulate API Network Delay
      setTimeout(() => {
          const mockEmail = `user.${provider.toLowerCase()}@example.com`;
          const mockName = `${provider} User`;
          const mockPic = provider === 'Google' 
            ? 'https://lh3.googleusercontent.com/a/default-user=s96-c' 
            : 'https://graph.facebook.com/123456789/picture?type=large'; // Mock FB URL

          const users = storage.getUsers();
          const existingUser = users.find(u => u.email === mockEmail);

          if (existingUser) {
              // DETECTED EXISTING USER -> LOGIN DIRECTLY
              onLogin(existingUser);
          } else {
              // NEW USER -> GO TO SETUP
              setSocialProfile({
                  name: mockName,
                  email: mockEmail,
                  provider: provider,
                  picture: mockPic
              });
              setRegName(mockName);
              setRegEmail(mockEmail);
              setView('SOCIAL_SETUP');
          }
          setIsSocialProcessing(null);
      }, 1500);
  };

  const completeSocialRegistration = () => {
     if (!socialProfile) return;

     // Validation for social flow
     if (regRole === UserRole.REQUESTER && (!regOrgName || !regLine1 || !regPincode)) {
         alert("Please provide Organization Name and Location details.");
         return;
     }

     const newUser: User = {
         id: `social-${socialProfile.provider.toLowerCase()}-${Math.random().toString(36).substr(2, 9)}`,
         name: regName || socialProfile.name,
         email: socialProfile.email,
         contactNo: regContactNo, // Optional for social login usually, but good to have
         role: regRole,
         profilePictureUrl: socialProfile.picture,
         impactScore: 0,
         averageRating: 0,
         ratingsCount: 0,
         orgName: regRole === UserRole.REQUESTER ? regOrgName : undefined,
         orgCategory: regRole === UserRole.REQUESTER ? regOrgCategory : undefined,
         address: regRole === UserRole.REQUESTER ? {
             line1: regLine1,
             line2: regLine2,
             landmark: regLandmark,
             pincode: regPincode
         } : undefined
     };

     storage.saveUser(newUser);
     onLogin(newUser);
  };

  const handleNextStep = () => {
      // Validation per step
      if (currentStep === 2) {
          if (!regName || !regEmail || !regPassword) {
              alert("Please fill in all fields.");
              return;
          }
          // Check duplicate email
          const users = storage.getUsers();
          if (users.some(u => u.email.toLowerCase() === regEmail.toLowerCase())) {
              alert("This email is already registered.");
              return;
          }
      }
      if (currentStep === 3) {
          if (!/^\d{10}$/.test(regContactNo)) {
              alert("Please enter a valid 10-digit Contact Number.");
              return;
          }
          if (regRole === UserRole.REQUESTER && !regOrgName) {
              alert("Please enter your Organization Name.");
              return;
          }
      }

      if (currentStep < totalSteps) {
          setCurrentStep(currentStep + 1);
      } else {
          completeRegistration();
      }
  };

  const handlePrevStep = () => {
      if (currentStep > 1) {
          setCurrentStep(currentStep - 1);
      } else {
          setView('LOGIN');
      }
  };

  const completeRegistration = () => {
      // Final Validation for Requester Address
      if (regRole === UserRole.REQUESTER && (!regLine1 || !regPincode)) {
          alert("Please provide at least Address Line 1 and Pincode.");
          return;
      }

      const newUser: User = { 
        id: Math.random().toString(36).substr(2, 9), 
        name: regName, 
        email: regEmail, 
        contactNo: regContactNo,
        password: regPassword,
        role: regRole,
        orgName: regRole === UserRole.REQUESTER ? regOrgName : undefined,
        orgCategory: regRole === UserRole.REQUESTER ? regOrgCategory : undefined,
        address: regRole === UserRole.REQUESTER ? {
            line1: regLine1,
            line2: regLine2,
            landmark: regLandmark,
            pincode: regPincode
        } : undefined,
        averageRating: 0,
        ratingsCount: 0,
        impactScore: 0
    };
    storage.saveUser(newUser);
    onLogin(newUser);
  };

  const handleAutoDetectLocation = () => {
    if (!navigator.geolocation) {
        alert("Geolocation is not supported by your browser.");
        return;
    }
    setIsAutoDetecting(true);
    navigator.geolocation.getCurrentPosition(
        async (pos) => {
            const { latitude, longitude } = pos.coords;
            try {
                const address = await reverseGeocode(latitude, longitude);
                if (address) {
                    setRegLine1(address.line1);
                    setRegLine2(address.line2);
                    setRegLandmark(address.landmark || '');
                    setRegPincode(address.pincode);
                } else {
                    alert("Could not detect detailed address. Please fill manually.");
                }
            } catch (e) {
                console.error(e);
                alert("Error detecting address.");
            } finally {
                setIsAutoDetecting(false);
            }
        },
        (err) => {
            console.error(err);
            alert("Location permission denied. Please enable location or enter manually.");
            setIsAutoDetecting(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // --- RENDER HELPERS ---

  const renderRegisterStep = () => {
      switch(currentStep) {
          case 1: // Role Selection
            return (
                <div className="space-y-4 animate-fade-in-up">
                    <h3 className="text-xl font-black text-slate-800 text-center mb-6">Who are you?</h3>
                    <div className="grid grid-cols-1 gap-4">
                        {[
                            { role: UserRole.DONOR, label: 'Food Donor', icon: '🎁', desc: 'I have surplus food to share.' },
                            { role: UserRole.VOLUNTEER, label: 'Volunteer', icon: '🚴', desc: 'I want to help deliver food.' },
                            { role: UserRole.REQUESTER, label: 'Requester', icon: '🏠', desc: 'My organization needs food.' }
                        ].map(({ role, label, icon, desc }) => (
                            <button 
                                key={role}
                                type="button"
                                onClick={() => setRegRole(role)}
                                className={`flex items-center p-4 rounded-2xl border-2 transition-all duration-200 text-left group hover:scale-[1.02] active:scale-[0.98] ${regRole === role ? 'border-emerald-500 bg-emerald-50/50 ring-1 ring-emerald-500 shadow-md' : 'border-slate-100 bg-white hover:border-emerald-200'}`}
                            >
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl mr-4 transition-colors ${regRole === role ? 'bg-emerald-200 text-emerald-800' : 'bg-slate-100 text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-600'}`}>
                                    {icon}
                                </div>
                                <div>
                                    <div className="font-black text-slate-800 text-sm uppercase tracking-wide">{label}</div>
                                    <div className="text-xs text-slate-500 font-medium mt-0.5">{desc}</div>
                                </div>
                                <div className={`ml-auto w-5 h-5 rounded-full border-2 flex items-center justify-center ${regRole === role ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300'}`}>
                                    {regRole === role && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            );
          case 2: // Credentials
            return (
                <div className="space-y-4 animate-fade-in-up">
                    <h3 className="text-xl font-black text-slate-800 text-center mb-6">Create Login</h3>
                    <div className="space-y-4">
                        <div className="group">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                            <input type="text" placeholder="e.g. Jane Doe" className="w-full px-5 py-4 border border-slate-200 bg-white/50 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 transition-all" value={regName} onChange={e => setRegName(e.target.value)} autoFocus />
                        </div>
                        <div className="group">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                            <input type="email" placeholder="name@example.com" className="w-full px-5 py-4 border border-slate-200 bg-white/50 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 transition-all" value={regEmail} onChange={e => setRegEmail(e.target.value)} />
                        </div>
                        <div className="group">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Password</label>
                            <input type="password" placeholder="••••••••" className="w-full px-5 py-4 border border-slate-200 bg-white/50 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 transition-all" value={regPassword} onChange={e => setRegPassword(e.target.value)} />
                        </div>
                    </div>
                </div>
            );
          case 3: // Contact & Org Details
             return (
                 <div className="space-y-4 animate-fade-in-up">
                     <h3 className="text-xl font-black text-slate-800 text-center mb-6">More Details</h3>
                     <div className="space-y-4">
                        <div className="group">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Mobile Number</label>
                            <div className="relative">
                                <span className="absolute left-5 top-4 font-bold text-slate-400">+91</span>
                                <input type="tel" maxLength={10} placeholder="9876543210" className="w-full pl-14 pr-5 py-4 border border-slate-200 bg-white/50 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 transition-all" value={regContactNo} onChange={e => { const v = e.target.value.replace(/\D/g, ''); if(v.length<=10) setRegContactNo(v); }} />
                            </div>
                        </div>

                        {regRole === UserRole.REQUESTER && (
                            <>
                                <div className="h-px bg-slate-100 my-2"></div>
                                <div className="group">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Organization Name</label>
                                    <input type="text" placeholder="e.g. Sunrise Shelter" className="w-full px-5 py-4 border border-slate-200 bg-white/50 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 transition-all" value={regOrgName} onChange={e => setRegOrgName(e.target.value)} />
                                </div>
                                <div className="group">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Category</label>
                                    <div className="relative">
                                        <select className="w-full px-5 py-4 border border-slate-200 bg-white/50 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 transition-all appearance-none" value={regOrgCategory} onChange={e => setRegOrgCategory(e.target.value)}>
                                            <option>Orphanage</option>
                                            <option>Old Age Home</option>
                                            <option>Shelter</option>
                                            <option>Community Center</option>
                                        </select>
                                        <div className="absolute right-5 top-5 pointer-events-none text-slate-500">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                     </div>
                 </div>
             );
          case 4: // Location (Requester Only)
             return (
                 <div className="space-y-4 animate-fade-in-up">
                     <h3 className="text-xl font-black text-slate-800 text-center mb-6">Location</h3>
                     <div className="flex justify-end mb-2">
                        <button type="button" onClick={handleAutoDetectLocation} className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors">
                            {isAutoDetecting ? 'Detecting...' : '📍 Auto-Detect'}
                        </button>
                     </div>
                     <div className="space-y-3">
                        <input type="text" placeholder="Line 1 (e.g. Building, Street)" className="w-full px-5 py-4 border border-slate-200 bg-white/50 rounded-2xl font-bold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-emerald-100 transition-all" value={regLine1} onChange={e => setRegLine1(e.target.value)} />
                        <input type="text" placeholder="Line 2 (e.g. Area, City)" className="w-full px-5 py-4 border border-slate-200 bg-white/50 rounded-2xl font-bold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-emerald-100 transition-all" value={regLine2} onChange={e => setRegLine2(e.target.value)} />
                        <div className="flex gap-3">
                            <input type="text" placeholder="Landmark" className="flex-1 px-5 py-4 border border-slate-200 bg-white/50 rounded-2xl font-bold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-emerald-100 transition-all" value={regLandmark} onChange={e => setRegLandmark(e.target.value)} />
                            <input type="text" placeholder="Pincode" maxLength={6} className="w-32 px-5 py-4 border border-slate-200 bg-white/50 rounded-2xl font-bold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-emerald-100 transition-all" value={regPincode} onChange={e => { const v = e.target.value.replace(/\D/g, ''); if(v.length<=6) setRegPincode(v); }} />
                        </div>
                     </div>
                 </div>
             );
          default:
              return null;
      }
  };

  return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-slate-100 to-teal-50 flex items-center justify-center p-4 md:p-6 relative overflow-hidden">
        {/* Animated Background Decor */}
        <div className="absolute top-[-20%] left-[-10%] w-[800px] h-[800px] bg-emerald-300/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[800px] h-[800px] bg-cyan-200/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute top-[30%] left-[20%] w-[600px] h-[600px] bg-teal-100/30 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-4000"></div>

        <div className="glass-panel p-8 md:p-12 rounded-[2.5rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] w-full max-w-lg relative z-10 max-h-[90vh] overflow-y-auto custom-scrollbar border border-white/60 flex flex-col">
            {showForgotPasswordModal && (
                <div className="absolute inset-0 z-50 bg-white flex flex-col items-center justify-center p-8 animate-fade-in-up rounded-[2.5rem]">
                    <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-6 text-emerald-600 shadow-sm border border-emerald-100">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                    </div>
                    <h3 className="text-2xl font-black text-slate-800 mb-2 tracking-tight">Reset Password</h3>
                    <p className="text-slate-500 font-medium text-center mb-8 text-sm leading-relaxed">Enter your email address and we'll send you a link to reset your password.</p>
                    <input type="email" placeholder="name@example.com" className="w-full px-5 py-4 border border-slate-200 bg-slate-50 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 transition-all mb-4" />
                    <button onClick={() => { alert('Password reset link sent to your email!'); setShowForgotPasswordModal(false); }} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-xs shadow-lg mb-4 transition-colors">Send Reset Link</button>
                    <button onClick={() => setShowForgotPasswordModal(false)} className="text-slate-400 font-bold text-xs uppercase hover:text-slate-600 transition-colors">Cancel</button>
                </div>
            )}
            
          <div className="text-center mb-8 shrink-0">
              <div className="inline-block p-4 bg-gradient-to-br from-emerald-50 to-white rounded-[2rem] mb-4 shadow-sm ring-1 ring-emerald-100">
                  <div className="text-4xl filter drop-shadow-sm">🍃</div>
              </div>
              <h1 className="text-3xl font-black text-slate-800 tracking-tight leading-tight">MEALers <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500">connect</span></h1>
              <p className="text-slate-500 font-medium mt-2 text-sm">
                  {view === 'LOGIN' ? 'Welcome back! Ready to make a difference?' : view === 'SOCIAL_SETUP' ? 'Almost there! Complete your profile.' : 'Join the community and start helping.'}
              </p>
          </div>
          
          {view === 'SOCIAL_SETUP' && socialProfile ? (
              <div className="animate-fade-in-up">
                  <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl mb-6 border border-slate-100">
                     {socialProfile.picture ? (
                         <img src={socialProfile.picture} alt="Profile" className="w-12 h-12 rounded-full border-2 border-white shadow-sm" />
                     ) : (
                         <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-lg">{socialProfile.name.charAt(0)}</div>
                     )}
                     <div>
                         <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Connected via {socialProfile.provider}</p>
                         <p className="text-sm font-black text-slate-800">{socialProfile.name}</p>
                     </div>
                  </div>

                  <h3 className="text-lg font-black text-slate-800 mb-4 text-center">How do you want to help?</h3>
                  
                  <div className="grid grid-cols-1 gap-3 mb-6">
                        {[
                            { role: UserRole.DONOR, label: 'Food Donor', icon: '🎁', desc: 'Donate surplus food' },
                            { role: UserRole.VOLUNTEER, label: 'Volunteer', icon: '🚴', desc: 'Deliver food to needy' },
                            { role: UserRole.REQUESTER, label: 'Requester', icon: '🏠', desc: 'Request food assistance' }
                        ].map(({ role, label, icon, desc }) => (
                            <button 
                                key={role}
                                type="button"
                                onClick={() => setRegRole(role)}
                                className={`flex items-center p-3 rounded-2xl border-2 transition-all duration-200 text-left ${regRole === role ? 'border-emerald-500 bg-emerald-50/50 shadow-sm' : 'border-slate-100 bg-white hover:border-emerald-200'}`}
                            >
                                <div className="text-2xl mr-3">{icon}</div>
                                <div>
                                    <div className="font-bold text-slate-800 text-xs uppercase tracking-wide">{label}</div>
                                    <div className="text-[10px] text-slate-500 font-medium">{desc}</div>
                                </div>
                                <div className={`ml-auto w-4 h-4 rounded-full border-2 flex items-center justify-center ${regRole === role ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300'}`}>
                                    {regRole === role && <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>}
                                </div>
                            </button>
                        ))}
                  </div>

                  {regRole === UserRole.REQUESTER && (
                      <div className="space-y-4 mb-6 pt-4 border-t border-slate-100 animate-fade-in-up">
                          <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest text-center mb-2">Organization Details</h4>
                          <input type="text" placeholder="Organization Name" className="w-full px-5 py-3 border border-slate-200 bg-white/50 rounded-xl font-bold text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500" value={regOrgName} onChange={e => setRegOrgName(e.target.value)} />
                          <div className="grid grid-cols-2 gap-3">
                              <input type="text" placeholder="Address Line 1" className="w-full px-5 py-3 border border-slate-200 bg-white/50 rounded-xl font-bold text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500" value={regLine1} onChange={e => setRegLine1(e.target.value)} />
                              <input type="text" placeholder="Pincode" className="w-full px-5 py-3 border border-slate-200 bg-white/50 rounded-xl font-bold text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500" value={regPincode} onChange={e => setRegPincode(e.target.value)} />
                          </div>
                      </div>
                  )}

                  <button 
                      onClick={completeSocialRegistration}
                      className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-xs shadow-xl shadow-slate-200 hover:bg-slate-800 hover:-translate-y-0.5 transition-all"
                  >
                      Complete Signup
                  </button>
                  <button 
                      onClick={() => { setView('LOGIN'); setSocialProfile(null); }}
                      className="w-full text-center mt-4 text-slate-400 font-bold text-xs uppercase hover:text-slate-600"
                  >
                      Cancel
                  </button>
              </div>
          ) : view === 'LOGIN' ? (
            <div className="animate-fade-in-up">
              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-2">
                   <label className="text-xs font-black text-slate-400 uppercase ml-1 tracking-widest">Username or Email</label>
                   <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-emerald-500 transition-colors">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                      </div>
                      <input type="text" className="w-full pl-14 pr-5 py-4 border border-slate-200 bg-white/50 rounded-2xl font-bold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 transition-all hover:bg-white" placeholder="john@example.com" value={loginIdentifier} onChange={e => setLoginIdentifier(e.target.value)} required />
                   </div>
                </div>
                <div className="space-y-2">
                   <label className="text-xs font-black text-slate-400 uppercase ml-1 tracking-widest">Password</label>
                   <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-emerald-500 transition-colors">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                      </div>
                      <input type="password" className="w-full pl-14 pr-5 py-4 border border-slate-200 bg-white/50 rounded-2xl font-bold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 transition-all hover:bg-white" placeholder="••••••••" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required />
                   </div>
                </div>

                <div className="flex justify-end">
                    <button type="button" onClick={() => setShowForgotPasswordModal(true)} className="text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors">Forgot Password?</button>
                </div>
                
                <button className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-xs shadow-xl shadow-emerald-200/50 hover:shadow-emerald-300/50 transform hover:-translate-y-0.5 active:translate-y-0 transition-all mt-6">
                    Sign In
                </button>

                <div className="mt-6">
                    <div className="relative flex py-2 items-center">
                        <div className="flex-grow border-t border-slate-200"></div>
                        <span className="flex-shrink-0 mx-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Or login with</span>
                        <div className="flex-grow border-t border-slate-200"></div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 mt-2">
                        <button type="button" onClick={() => handleSocialAuth('Google')} disabled={!!isSocialProcessing} className="flex items-center justify-center gap-2 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all hover:shadow-sm disabled:opacity-70">
                            {isSocialProcessing === 'Google' ? (
                                <svg className="animate-spin h-4 w-4 text-slate-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            ) : (
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M23.766 12.2764C23.766 11.4607 23.6999 10.6406 23.5588 9.83807H12.24V14.4591H18.7217C18.4528 15.9494 17.5885 17.2678 16.323 18.1056V21.1039H20.19C22.4608 19.0139 23.766 15.9274 23.766 12.2764Z" fill="#4285F4"/>
                                    <path d="M12.2401 24.0008C15.4766 24.0008 18.2059 22.9382 20.1945 21.1039L16.3275 18.1055C15.2517 18.8375 13.8627 19.252 12.2445 19.252C9.11388 19.252 6.45946 17.1399 5.50705 14.3003H1.5166V17.3912C3.55371 21.4434 7.7029 24.0008 12.2401 24.0008Z" fill="#34A853"/>
                                    <path d="M5.50253 14.3003C5.00236 12.8099 5.00236 11.1961 5.50253 9.70575V6.61481H1.51649C-0.18551 10.0056 -0.18551 14.0004 1.51649 17.3912L5.50253 14.3003Z" fill="#FBBC05"/>
                                    <path d="M12.2401 4.74966C13.9509 4.7232 15.6044 5.36697 16.8434 6.54867L20.2695 3.12262C18.1001 1.0855 15.2208 -0.034466 12.2401 0.000808666C7.7029 0.000808666 3.55371 2.55822 1.5166 6.61481L5.50264 9.70575C6.45064 6.86173 9.10947 4.74966 12.2401 4.74966Z" fill="#EA4335"/>
                                </svg>
                            )}
                            {isSocialProcessing === 'Google' ? 'Connecting...' : 'Google'}
                        </button>
                        <button type="button" onClick={() => handleSocialAuth('Facebook')} disabled={!!isSocialProcessing} className="flex items-center justify-center gap-2 py-3 bg-[#1877F2] text-white rounded-xl text-xs font-bold hover:bg-[#166fe5] transition-all hover:shadow-sm disabled:opacity-70">
                            {isSocialProcessing === 'Facebook' ? (
                                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            ) : (
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                                </svg>
                            )}
                            {isSocialProcessing === 'Facebook' ? 'Connecting...' : 'Facebook'}
                        </button>
                    </div>
                </div>
              </form>
              
              <div className="my-8 flex items-center gap-4">
                  <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent flex-1"></div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Quick Demo Access</span>
                  <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent flex-1"></div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => handleDemoLogin(UserRole.DONOR)} className="py-3 bg-white border border-emerald-100 text-emerald-700 rounded-xl text-[10px] font-black uppercase hover:bg-emerald-50 hover:scale-105 transition-all shadow-sm">Donor</button>
                  <button onClick={() => handleDemoLogin(UserRole.VOLUNTEER)} className="py-3 bg-white border border-blue-100 text-blue-700 rounded-xl text-[10px] font-black uppercase hover:bg-blue-50 hover:scale-105 transition-all shadow-sm">Volunteer</button>
                  <button onClick={() => handleDemoLogin(UserRole.REQUESTER)} className="py-3 bg-white border border-orange-100 text-orange-700 rounded-xl text-[10px] font-black uppercase hover:bg-orange-50 hover:scale-105 transition-all shadow-sm">Requester</button>
              </div>
              
              <div className="text-center mt-10">
                <span className="text-slate-500 text-sm font-medium">New here? </span>
                <button type="button" onClick={() => { setView('REGISTER'); setCurrentStep(1); }} className="text-emerald-600 font-black text-sm hover:underline decoration-2 underline-offset-4 decoration-emerald-200">Create Account</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-full animate-fade-in-up">
              {/* Progress Bar */}
              <div className="mb-6">
                <div className="flex justify-between text-[10px] font-bold uppercase text-slate-400 tracking-widest mb-2">
                    <span>Step {currentStep} of {totalSteps}</span>
                    <span>{Math.round((currentStep / totalSteps) * 100)}%</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500 ease-out rounded-full"
                        style={{ width: `${(currentStep / totalSteps) * 100}%` }}
                    ></div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar px-1 py-1">
                  {renderRegisterStep()}
              </div>

              {/* Navigation Buttons */}
              <div className="pt-6 mt-4 border-t border-slate-100 flex gap-3">
                  <button 
                    type="button" 
                    onClick={handlePrevStep}
                    className="flex-1 py-4 bg-slate-100 text-slate-500 font-black rounded-2xl uppercase tracking-widest text-xs hover:bg-slate-200 transition-colors"
                  >
                    {currentStep === 1 ? 'Login' : 'Back'}
                  </button>
                  <button 
                    type="button" 
                    onClick={handleNextStep}
                    className="flex-[2] py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black rounded-2xl uppercase tracking-widest text-xs shadow-lg shadow-emerald-200 hover:shadow-emerald-300 hover:-translate-y-0.5 transition-all"
                  >
                    {currentStep === totalSteps ? 'Complete' : 'Next Step'}
                  </button>
              </div>
              
              {currentStep === 1 && (
                  <div className="text-center mt-6">
                    <span className="text-slate-500 text-sm font-medium">Already have an account? </span>
                    <button type="button" onClick={() => setView('LOGIN')} className="text-emerald-600 font-black text-sm hover:underline decoration-2 underline-offset-4 decoration-emerald-200">Sign In</button>
                  </div>
              )}
            </div>
          )}
        </div>
      </div>
  );
};
