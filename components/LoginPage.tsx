
import React, { useState, useEffect, useRef } from 'react';
import { User, UserRole } from '../types';
import { storage } from '../services/storageService';
import { reverseGeocodeGoogle } from '../services/mapLoader';
import { verifyVolunteerId, verifyRequesterDocument } from '../services/geminiService';
import LocationPickerMap from './LocationPickerMap';
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

const resizeImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const scale = img.width > MAX_WIDTH ? MAX_WIDTH / img.width : 1;
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;
          const ctx = canvas.getContext('2d');
          if (ctx) {
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              resolve(canvas.toDataURL('image/jpeg', 0.8));
          } else {
              resolve(e.target?.result as string);
          }
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
};

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [view, setView] = useState<'LOGIN' | 'REGISTER' | 'FORGOT_PASSWORD' | 'FORGOT_OTP' | 'NEW_PASSWORD' | 'PHONE_LOGIN' | 'PHONE_OTP'>('LOGIN');
  const [isAnimating, setIsAnimating] = useState(false);

  // --- LOGIN STATE ---
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // --- PHONE LOGIN / RECOVERY STATE ---
  const [phoneForAuth, setPhoneForAuth] = useState('');
  const [recoveryInput, setRecoveryInput] = useState(''); // Email or Phone for recovery
  const [recoveryMethod, setRecoveryMethod] = useState<'PHONE' | 'EMAIL' | null>(null);
  const [generatedRecoveryOtp, setGeneratedRecoveryOtp] = useState('');
  
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
  
  // Volunteer Specific Register State
  const [volCategory, setVolCategory] = useState<'Student' | 'Individual'>('Individual');
  const [volIdType, setVolIdType] = useState<string>('aadhaar'); // aadhaar, pan, driving_license, student_id
  const [volIdImage, setVolIdImage] = useState<string | null>(null);
  const [isVerifyingId, setIsVerifyingId] = useState(false);
  const [idVerificationResult, setIdVerificationResult] = useState<{isValid: boolean, feedback: string} | null>(null);
  const idFileInputRef = useRef<HTMLInputElement>(null);

  // Donor Specific Register State
  const [donorType, setDonorType] = useState<'Individual' | 'Restaurant' | 'Corporate' | 'Event'>('Individual');
  const [wantTaxBenefits, setWantTaxBenefits] = useState(false); // Used as "Get Verified" toggle
  
  // OTP Verification State for Donor
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  
  const [showPhoneOtpInput, setShowPhoneOtpInput] = useState(false);
  const [showEmailOtpInput, setShowEmailOtpInput] = useState(false);
  const [phoneOtp, setPhoneOtp] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [generatedEmailOtp, setGeneratedEmailOtp] = useState(''); // For simulation
  const [isSendingPhoneOtp, setIsSendingPhoneOtp] = useState(false);
  const [isSendingEmailOtp, setIsSendingEmailOtp] = useState(false);

  // Requester (NGO/Orphanage) Specific Verification State
  const [requesterType, setRequesterType] = useState<'Orphanage' | 'OldAgeHome' | 'NGO' | 'Other'>('Orphanage');
  const [reqDocuments, setReqDocuments] = useState<Record<string, string>>({}); // Stores base64 of docs
  const [reqDocStatus, setReqDocStatus] = useState<Record<string, {verified: boolean, feedback: string}>>({});
  const [verifyingDoc, setVerifyingDoc] = useState<string | null>(null); // Which doc is being AI verified
  const docInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

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
          setRecoveryInput('');
          setRecoveryMethod(null);
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
      // Reset Registration Specifics
      if (newView !== 'REGISTER') {
          // Volunteer
          setVolIdImage(null);
          setIdVerificationResult(null);
          setVolCategory('Individual');
          setVolIdType('aadhaar');
          // Requester
          setReqDocuments({});
          setReqDocStatus({});
          // Donor
          setDonorType('Individual');
          setWantTaxBenefits(false);
          setIsPhoneVerified(false);
          setIsEmailVerified(false);
          setShowPhoneOtpInput(false);
          setShowEmailOtpInput(false);
          setPhoneOtp('');
          setEmailOtp('');
      }
      setIsAnimating(false);
    }, 500);
  };

  const handleVolunteerCategoryChange = (category: 'Student' | 'Individual') => {
      setVolCategory(category);
      setVolIdImage(null);
      setIdVerificationResult(null);
      setVolIdType(category === 'Student' ? 'student_id' : 'aadhaar');
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
      setError("Location access denied. Please use the map.");
      setDetectingLoc(false);
    });
  };

  // Volunteer ID Upload
  const handleIdUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsVerifyingId(true);
      setError('');
      try {
          const base64 = await resizeImage(file);
          setVolIdImage(base64);
          
          const result = await verifyVolunteerId(base64, volIdType);
          setIdVerificationResult(result);
          if (!result.isValid) {
              setError(result.feedback || "Verification failed. Please upload a clear ID.");
          }
      } catch (err) {
          console.error(err);
          setError("Failed to process image.");
          setIdVerificationResult({ isValid: false, feedback: "Error processing image." });
      } finally {
          setIsVerifyingId(false);
      }
  };

  // --- Donor Verification Handlers ---

  const handleSendPhoneOtp = async () => {
      if (!regPhone || regPhone.length < 10) { setError("Enter valid phone first."); return; }
      setIsSendingPhoneOtp(true);
      setError('');
      try {
          if (!recaptchaVerifierRef.current) {
              recaptchaVerifierRef.current = new RecaptchaVerifier(auth, 'recaptcha-container', {
                  'size': 'invisible',
                  'callback': () => {}
              });
          }
          const formattedPhone = `+91${regPhone.replace(/\D/g, '')}`;
          const result = await signInWithPhoneNumber(auth, formattedPhone, recaptchaVerifierRef.current);
          setConfirmationResult(result);
          setShowPhoneOtpInput(true);
          // In simulation, code is 123456
          // If real, sms is sent
      } catch (err: any) {
          console.error("Phone OTP Error:", err);
          setError(err.message || "Failed to send OTP.");
          // Clear captcha to reset
          if(recaptchaVerifierRef.current) {
              try { recaptchaVerifierRef.current.clear(); } catch {}
              recaptchaVerifierRef.current = null;
          }
      } finally {
          setIsSendingPhoneOtp(false);
      }
  };

  const handleVerifyPhoneOtp = async () => {
      if (!phoneOtp) { setError("Enter OTP"); return; }
      if (!confirmationResult) { setError("Session expired. Resend OTP."); return; }
      
      try {
          const credential = PhoneAuthProvider.credential(confirmationResult.verificationId, phoneOtp);
          await signInWithCredential(auth, credential);
          
          setIsPhoneVerified(true);
          setShowPhoneOtpInput(false);
      } catch (e: any) {
          setError("Invalid OTP");
      }
  };

  const handleSendEmailOtp = () => {
      if (!regEmail || !regEmail.includes('@')) { setError("Enter valid email first."); return; }
      setIsSendingEmailOtp(true);
      // Simulating Email OTP
      setTimeout(() => {
          const code = Math.floor(100000 + Math.random() * 900000).toString();
          setGeneratedEmailOtp(code);
          alert(`(Simulation) Email OTP for ${regEmail}: ${code}`);
          setShowEmailOtpInput(true);
          setIsSendingEmailOtp(false);
      }, 1000);
  };

  const handleVerifyEmailOtp = () => {
      if (emailOtp === generatedEmailOtp) {
          setIsEmailVerified(true);
          setShowEmailOtpInput(false);
      } else {
          setError("Invalid Email OTP");
      }
  };

  // Requester Document Upload & Verify
  const handleRequesterDocUpload = async (e: React.ChangeEvent<HTMLInputElement>, docKey: string) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!regOrgName) { setError("Please enter Organization Name first."); return; }

      setVerifyingDoc(docKey);
      try {
          const base64 = await resizeImage(file);
          setReqDocuments(prev => ({ ...prev, [docKey]: base64 }));
          
          // Verify with AI
          const result = await verifyRequesterDocument(base64, docKey, regOrgName);
          
          setReqDocStatus(prev => ({
              ...prev,
              [docKey]: { verified: result.isValid, feedback: result.feedback }
          }));

      } catch (err) {
          console.error(err);
          setError("Failed to upload/verify document.");
      } finally {
          setVerifyingDoc(null);
      }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);

    try {
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;
        await handleSocialLoginSuccess({
            uid: user.uid,
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

  const handleSocialLoginSuccess = async (socialUser: { uid?: string, displayName: string | null, email: string | null, photoURL: string | null | undefined }) => {
    // 1. Try finding by UID first if available
    if (socialUser.uid) {
        const existingUser = await storage.getUser(socialUser.uid);
        if (existingUser) {
            onLogin(existingUser);
            return;
        }
    }

    // 2. Fallback to Email search (Legacy support)
    const users = await storage.getUsers();
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

          (window as any).confirmationResult = result;
          setConfirmationResult(result);

          setLoading(false);
          switchView(nextView);
      } catch (err: any) {
          console.error("OTP Error:", err);
          setLoading(false);
          setError(err.message || "Failed to send OTP. Ensure phone number is valid.");

          if (recaptchaVerifierRef.current) {
              try {
                  const widgetId = await recaptchaVerifierRef.current.render();
                  const grecaptcha = (window as any).grecaptcha;
                  if (grecaptcha && grecaptcha.reset) {
                      grecaptcha.reset(widgetId);
                  }
              } catch (e) {}
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
          const credential = PhoneAuthProvider.credential(confirmationResult.verificationId, otp);
          const result = await signInWithCredential(auth, credential);
          const user = result.user;
          
          // 1. Try finding by UID
          let existingUser = await storage.getUser(user.uid);

          // 2. Fallback to Phone Search
          if (!existingUser) {
              const phoneNumber = user.phoneNumber || '';
              const users = await storage.getUsers();
              existingUser = users.find(u => {
                 const uPhone = (u.contactNo || '').replace(/\D/g, '');
                 const inputPhone = phoneNumber.replace(/\D/g, '');
                 return uPhone && inputPhone.includes(uPhone);
              });
          }

          if (existingUser) {
              onLogin(existingUser);
          } else {
              setError("User doesn't exist. Try by sign up");
          }
          setLoading(false);
      } catch (err: any) {
          setLoading(false);
          console.error(err);
          setError("Invalid OTP. Please try again.");
      }
  };

  const handleForgotIdentifyUser = async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setLoading(true);

      const input = recoveryInput.trim();
      const isEmail = input.includes('@');
      const isPhone = /^\d{10}$/.test(input.replace(/\D/g, ''));

      if (!isEmail && !isPhone) {
          setError("Please enter a valid Email or 10-digit Phone number.");
          setLoading(false);
          return;
      }

      const users = await storage.getUsers();
      const existingUser = users.find(u => {
          if (isEmail) return u.email.toLowerCase() === input.toLowerCase();
          const uPhone = (u.contactNo || '').replace(/\D/g, '');
          return uPhone && input.replace(/\D/g, '').includes(uPhone);
      });

      if (!existingUser) {
          setError("Account not found. Please sign up.");
          setLoading(false);
          return;
      }

      if (isEmail) {
          setRecoveryMethod('EMAIL');
          // Simulation for Email OTP
          const code = Math.floor(100000 + Math.random() * 900000).toString();
          setGeneratedRecoveryOtp(code);
          console.log("Password Reset OTP:", code);
          // Simulate network delay
          setTimeout(() => {
              alert(`(Simulation) Your Password Reset OTP is: ${code}`);
              setLoading(false);
              switchView('FORGOT_OTP');
          }, 1000);
      } else {
          setRecoveryMethod('PHONE');
          sendOtp(input, 'FORGOT_OTP');
      }
  };

  const handleForgotVerifyOtp = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!otp) { setError("Please enter the OTP."); return; }
      
      setLoading(true);
      setError('');

      if (recoveryMethod === 'EMAIL') {
          if (otp === generatedRecoveryOtp) {
              setLoading(false);
              switchView('NEW_PASSWORD');
          } else {
              setLoading(false);
              setError("Invalid Email OTP. Please try again.");
          }
      } else {
          // Phone Verification
          if (!confirmationResult) { setError("Session expired. Please send OTP again."); return; }
          try {
              const credential = PhoneAuthProvider.credential(confirmationResult.verificationId, otp);
              await signInWithCredential(auth, credential);
              setLoading(false);
              switchView('NEW_PASSWORD');
          } catch (err: any) {
              console.error(err);
              setLoading(false);
              setError("Invalid verification code. Please try again.");
          }
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
          if (recoveryMethod === 'PHONE') {
              if (!auth || !auth.currentUser) {
                  throw new Error("Session expired. Please verify OTP again.");
              }
              await updatePassword(auth.currentUser, newPassword);
          } else if (recoveryMethod === 'EMAIL') {
              const users = await storage.getUsers();
              const user = users.find(u => u.email.toLowerCase() === recoveryInput.toLowerCase());
              if (user) {
                  await storage.updateUser(user.id, { password: newPassword }); 
              }
          }
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

        // 1. Try to find user by ID first (Optimized)
        let existingUser = await storage.getUser(firebaseUser.uid);

        // 2. Fallback: Try by Email if ID lookup fails
        if (!existingUser) {
             const users = await storage.getUsers();
             existingUser = users.find(u => u.email === firebaseUser.email);
        }

        if (!existingUser) {
            setLoading(false);
            setError("User doesn't exist. Try by sign up");
            return;
        }

        onLogin(existingUser);
    } catch (err: any) {
        setLoading(false);
        if (err.code === 'auth/user-not-found') {
            setError("User doesn't exist. Try by sign up");
        } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
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

    // Basic Validation
    if (!regName || !regEmail || !regPassword || !regPhone || !line1 || !pincode) {
        setError("Please fill all required fields, including phone number and address.");
        setLoading(false);
        return;
    }

    if (regPhone.length !== 10) {
        setError("Please enter a valid 10-digit phone number.");
        setLoading(false);
        return;
    }

    if (regPassword.length < 6) {
        setError("Password must be at least 6 characters");
        setLoading(false);
        return;
    }

    // Role Specific Validations
    let isVerified = false;
    let verificationStatus: 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED' = 'UNVERIFIED';

    if (regRole === UserRole.VOLUNTEER) {
        if (!idVerificationResult?.isValid) {
            setError("Please upload a valid ID card for verification.");
            setLoading(false);
            return;
        }
        isVerified = true;
    }

    if (regRole === UserRole.DONOR) {
        if (donorType !== 'Individual' && !regOrgName) {
            setError("Organization Name is required for businesses.");
            setLoading(false);
            return;
        }
        if (wantTaxBenefits) {
            if (!isPhoneVerified || !isEmailVerified) {
                setError("Please complete both Phone and Email verification for verified status.");
                setLoading(false);
                return;
            }
            isVerified = true;
        }
    }

    if (regRole === UserRole.REQUESTER) {
        if (!regOrgName) {
            setError("Organization Name is required.");
            setLoading(false);
            return;
        }
        if (!reqDocuments.org_pan || !reqDocStatus.org_pan?.verified) {
            setError("Valid Organization PAN is required.");
            setLoading(false);
            return;
        }
        if (requesterType === 'Orphanage' && (!reqDocuments.jj_act || !reqDocStatus.jj_act?.verified)) {
            setError("JJ Act Registration is mandatory for Orphanages.");
            setLoading(false);
            return;
        }
        verificationStatus = 'VERIFIED';
    }

    // Helper to create user data object
    const createUserData = (uid: string): User => {
        return {
            id: uid,
            name: regName,
            email: regEmail,
            contactNo: regPhone,
            role: regRole,
            orgName: (regRole !== UserRole.VOLUNTEER && donorType !== 'Individual' ? regOrgName : undefined),
            orgCategory: (regRole !== UserRole.VOLUNTEER ? regOrgCategory : undefined),
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
            ratingsCount: 0,
            volunteerCategory: regRole === UserRole.VOLUNTEER ? volCategory : undefined,
            volunteerIdType: regRole === UserRole.VOLUNTEER ? volIdType : undefined,
            isVerified: isVerified,
            donorType: regRole === UserRole.DONOR ? donorType : undefined,
            requesterType: regRole === UserRole.REQUESTER ? requesterType : undefined,
            verificationStatus: regRole === UserRole.REQUESTER ? verificationStatus : undefined,
            documentUrls: regRole === UserRole.REQUESTER ? {
                orgPan: reqDocuments.org_pan,
                registrationCert: reqDocuments.registration_cert,
                jjAct: reqDocuments.jj_act,
                municipalLicense: reqDocuments.municipal_license,
                taxExemptCert: reqDocuments['12a_80g'],
                facilityVideo: reqDocuments.facility_video
            } : undefined
        };
    };

    try {
        let firebaseUser;

        if (auth && auth.currentUser && auth.currentUser.email === regEmail) {
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

        const newUser = createUserData(firebaseUser.uid);
        storage.saveUser(newUser);
        onLogin(newUser);
        setLoading(false);

    } catch (err: any) {
        if (err.code === 'auth/email-already-in-use') {
            // DIRECT LOGIN HANDLER
            // If email is already registered, try to sign in and proceed
            try {
                const userCredential = await signInWithEmailAndPassword(auth, regEmail, regPassword);
                const firebaseUser = userCredential.user;
                
                // Optimized check
                let existingUser = await storage.getUser(firebaseUser.uid);
                if (!existingUser) {
                     const users = await storage.getUsers();
                     existingUser = users.find(u => u.id === firebaseUser.uid);
                }
                
                if (existingUser) {
                    onLogin(existingUser);
                } else {
                    // Create profile if missing
                    const newUser = createUserData(firebaseUser.uid);
                    await storage.saveUser(newUser);
                    onLogin(newUser);
                }
                setLoading(false);
            } catch (loginErr) {
                setLoading(false);
                setError("Email registered, but password incorrect. Please try again or use Forgot Password.");
            }
        } else {
            setLoading(false);
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

        <div className="md:w-5/12 bg-slate-900 p-10 md:p-12 text-white flex flex-col justify-between relative overflow-hidden group">
            {/* ... Left Side Content ... */}
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

        <div className="md:w-7/12 p-8 md:p-12 overflow-y-auto custom-scrollbar relative bg-white flex flex-col">
            <div className={`transition-all duration-500 transform ${isAnimating ? 'opacity-0 scale-95' : 'opacity-100 scale-100'} flex-1`}>

            {view === 'LOGIN' && (
                <div className="max-w-sm mx-auto mt-4">
                    {/* ... Login Form Content ... */}
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

            {view === 'PHONE_LOGIN' && (
                <div className="max-w-sm mx-auto mt-8">
                    <div className="mb-8">
                        <button onClick={() => switchView('LOGIN')} className="flex items-center text-slate-400 hover:text-slate-600 transition-colors text-xs font-bold mb-4">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                            Back to Login
                        </button>
                        <h3 className="text-2xl font-black text-slate-800">Phone Login</h3>
                        <p className="text-slate-500 font-medium text-sm mt-2">Enter your phone number to receive a verification code.</p>
                    </div>

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
                                    placeholder="9xxxxxxxxx"
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
                            className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl uppercase text-xs tracking-widest shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all disabled:opacity-70 flex justify-center items-center gap-3"
                        >
                            {loading && <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                            Send Code
                        </button>
                    </form>
                </div>
            )}

            {view === 'FORGOT_PASSWORD' && (
                <div className="max-w-sm mx-auto mt-8">
                    <div className="mb-8">
                        <button onClick={() => switchView('LOGIN')} className="flex items-center text-slate-400 hover:text-slate-600 transition-colors text-xs font-bold mb-4">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                            Back to Login
                        </button>
                        <h3 className="text-2xl font-black text-slate-800">Forgot Password?</h3>
                        <p className="text-slate-500 font-medium text-sm mt-2">Enter your registered email or phone number to receive a verification code.</p>
                    </div>

                    <form onSubmit={handleForgotIdentifyUser} className="space-y-5">
                        <div className="space-y-1">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Email or Phone</label>
                            <input
                                type="text"
                                value={recoveryInput}
                                onChange={e => setRecoveryInput(e.target.value)}
                                placeholder="name@example.com or 9876543210"
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
                            className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl uppercase text-xs tracking-widest shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all disabled:opacity-70 flex justify-center items-center gap-3"
                        >
                            {loading && <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                            Send Code
                        </button>
                    </form>
                </div>
            )}

            {(view === 'FORGOT_OTP' || view === 'PHONE_OTP') && (
                <div className="max-w-sm mx-auto mt-8">
                    <div className="mb-8">
                        <button onClick={() => switchView(view === 'PHONE_OTP' ? 'PHONE_LOGIN' : 'FORGOT_PASSWORD')} className="flex items-center text-slate-400 hover:text-slate-600 transition-colors text-xs font-bold mb-4">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                            Back
                        </button>
                        <h3 className="text-2xl font-black text-slate-800">Verification</h3>
                        <p className="text-slate-500 font-medium text-sm mt-2">
                            Enter the code sent to your {recoveryMethod === 'EMAIL' ? 'email' : 'phone'}.
                        </p>
                    </div>

                    <form onSubmit={view === 'PHONE_OTP' ? handleLoginVerifyOtp : handleForgotVerifyOtp} className="space-y-5">
                        <div className="space-y-1">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">OTP Code</label>
                            <input
                                type="text"
                                value={otp}
                                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0,6))}
                                placeholder="123456"
                                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 text-center tracking-[0.5em] text-lg focus:outline-none focus:ring-4 focus:ring-emerald-100 focus:bg-white transition-all"
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
                            className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl uppercase text-xs tracking-widest shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all disabled:opacity-70 flex justify-center items-center gap-3"
                        >
                            {loading && <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                            Verify
                        </button>
                    </form>
                </div>
            )}

            {view === 'NEW_PASSWORD' && (
                <div className="max-w-sm mx-auto mt-8">
                    {passwordResetSuccess ? (
                        <div className="text-center animate-fade-in-up">
                            <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner ring-1 ring-emerald-100">
                                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                            </div>
                            <h3 className="text-2xl font-black text-slate-800 mb-2">Password Reset!</h3>
                            <p className="text-slate-500 font-medium text-sm mb-8">You can now login with your new password.</p>
                            <button onClick={() => switchView('LOGIN')} className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl uppercase text-xs tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-200">
                                Go to Login
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="mb-8">
                                <h3 className="text-2xl font-black text-slate-800">New Password</h3>
                                <p className="text-slate-500 font-medium text-sm mt-2">Create a secure password for your account.</p>
                            </div>

                            <form onSubmit={handleNewPasswordSubmit} className="space-y-5">
                                <div className="space-y-1">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">New Password</label>
                                    <div className="relative">
                                        <input
                                            type={showNewPassword ? "text" : "password"}
                                            value={newPassword}
                                            onChange={e => setNewPassword(e.target.value)}
                                            placeholder="••••••••"
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
                                            placeholder="••••••••"
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
                                    className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl uppercase text-xs tracking-widest shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all disabled:opacity-70 flex justify-center items-center gap-3"
                                >
                                    {loading && <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                                    Update Password
                                </button>
                            </form>
                        </>
                    )}
                </div>
            )}

            {/* Other views omitted for brevity, showing REGISTER */}

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
                                    {role === UserRole.REQUESTER ? 'NGO / ORG' : role}
                                </button>
                            ))}
                        </div>

                        <div className="space-y-4">
                            {/* Common Fields */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                                    <input value={regName} onChange={e => setRegName(e.target.value)} required placeholder="John Doe" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 transition-all" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Phone *</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                                            <span className="text-slate-500 font-bold text-sm border-r border-slate-300 pr-2">+91</span>
                                        </div>
                                        <input
                                            type="tel"
                                            value={regPhone}
                                            maxLength={10}
                                            required
                                            onChange={e => setRegPhone(e.target.value.replace(/\D/g, ''))}
                                            placeholder="9xxxxxxxxx"
                                            className="w-full pl-20 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 transition-all"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Email {regRole === UserRole.REQUESTER && <span className="text-rose-500">* (Official preferred)</span>}</label>
                                <input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} required placeholder="contact@org.com" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 transition-all" />
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
                            </div>

                                            {/* Volunteer Verification Logic */}
                            {regRole === UserRole.VOLUNTEER && (
                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-4">
                                    <div className="flex justify-between items-center">
                                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest">I am a:</label>
                                        <div className="flex bg-white p-1 rounded-lg border border-slate-200">
                                            <button type="button" onClick={() => handleVolunteerCategoryChange('Student')} className={`px-3 py-1 text-[10px] font-bold uppercase rounded-md transition-all ${volCategory === 'Student' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>Student</button>
                                            <button type="button" onClick={() => handleVolunteerCategoryChange('Individual')} className={`px-3 py-1 text-[10px] font-bold uppercase rounded-md transition-all ${volCategory === 'Individual' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>Individual</button>
                                        </div>
                                    </div>

                                    {volCategory === 'Individual' && (
                                        <div className="space-y-1">
                                            <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Document Type</label>
                                            <select 
                                                value={volIdType} 
                                                onChange={(e) => { setVolIdType(e.target.value); setVolIdImage(null); setIdVerificationResult(null); }}
                                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 appearance-none cursor-pointer"
                                            >
                                                <option value="aadhaar">Aadhaar Card</option>
                                                <option value="pan">PAN Card</option>
                                                <option value="driving_license">Driving License</option>
                                            </select>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest">
                                            Upload {volCategory === 'Student' ? 'Student ID' : volIdType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                        </label>
                                        <div 
                                            className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${idVerificationResult?.isValid ? 'border-emerald-400 bg-emerald-50' : 'border-slate-300 hover:bg-slate-100'}`}
                                            onClick={() => idFileInputRef.current?.click()}
                                        >
                                            <input type="file" ref={idFileInputRef} className="hidden" accept="image/*" onChange={handleIdUpload} />
                                            
                                            {isVerifyingId ? (
                                                <div className="flex flex-col items-center py-2 text-slate-500">
                                                    <svg className="animate-spin w-6 h-6 mb-2" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                                    <span className="text-xs font-bold">Verifying ID with AI...</span>
                                                </div>
                                            ) : idVerificationResult?.isValid ? (
                                                <div className="flex flex-col items-center py-2 text-emerald-600">
                                                    <svg className="w-8 h-8 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                    <span className="text-xs font-black uppercase">Verified Successfully</span>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center py-2 text-slate-400">
                                                    <span className="text-2xl mb-1">🪪</span>
                                                    <span className="text-xs font-bold">Click to upload image</span>
                                                </div>
                                            )}
                                        </div>
                                        {idVerificationResult && !idVerificationResult.isValid && (
                                            <p className="text-[10px] font-bold text-rose-500 text-center">{idVerificationResult.feedback}</p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* DONOR Verification Logic */}
                            {regRole === UserRole.DONOR && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Type</label>
                                            <select value={donorType} onChange={e => setDonorType(e.target.value as any)} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 transition-all appearance-none">
                                                <option value="Individual">Individual</option>
                                                <option value="Restaurant">Restaurant</option>
                                                <option value="Corporate">Corporate</option>
                                                <option value="Event">Event</option>
                                            </select>
                                        </div>
                                        {donorType !== 'Individual' && (
                                            <div className="space-y-1">
                                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Org Name</label>
                                                <input value={regOrgName} onChange={e => setRegOrgName(e.target.value)} placeholder="Business Name" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 transition-all" />
                                            </div>
                                        )}
                                        {donorType === 'Individual' && <div className="hidden md:block"></div>}
                                    </div>

                                    {/* Optional Contact Verification (Get Verified) */}
                                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                                        <div className="flex items-center justify-between mb-3">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="checkbox" checked={wantTaxBenefits} onChange={e => setWantTaxBenefits(e.target.checked)} className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 border-gray-300" />
                                                <div>
                                                    <span className="text-xs font-black text-slate-700 uppercase tracking-wide block">Get Verified (Recommended)</span>
                                                    <span className="text-[9px] text-slate-400 font-bold">Verify Phone & Email for Trusted Badge</span>
                                                </div>
                                            </label>
                                            {(isPhoneVerified && isEmailVerified) && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-1 rounded">Verified</span>}
                                        </div>

                                        {wantTaxBenefits && (
                                            <div className="space-y-3 pt-2 border-t border-slate-200">
                                                {/* Phone Verification */}
                                                <div>
                                                    <div className="flex justify-between items-center mb-1">
                                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Phone Verification</label>
                                                        {isPhoneVerified && <span className="text-[10px] font-bold text-emerald-600">✔ Verified</span>}
                                                    </div>
                                                    {!isPhoneVerified && (
                                                        <div className="flex gap-2">
                                                            {!showPhoneOtpInput ? (
                                                                <button 
                                                                    type="button" 
                                                                    onClick={handleSendPhoneOtp}
                                                                    disabled={isSendingPhoneOtp || !regPhone}
                                                                    className="w-full py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                                                                >
                                                                    {isSendingPhoneOtp ? 'Sending OTP...' : 'Send OTP to Phone'}
                                                                </button>
                                                            ) : (
                                                                <div className="flex gap-2 w-full">
                                                                    <input 
                                                                        type="text" 
                                                                        placeholder="OTP" 
                                                                        value={phoneOtp}
                                                                        onChange={e => setPhoneOtp(e.target.value)}
                                                                        className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold"
                                                                    />
                                                                    <button 
                                                                        type="button" 
                                                                        onClick={handleVerifyPhoneOtp}
                                                                        className="px-3 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold"
                                                                    >
                                                                        Verify
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Email Verification */}
                                                <div>
                                                    <div className="flex justify-between items-center mb-1">
                                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Email Verification</label>
                                                        {isEmailVerified && <span className="text-[10px] font-bold text-emerald-600">✔ Verified</span>}
                                                    </div>
                                                    {!isEmailVerified && (
                                                        <div className="flex gap-2">
                                                            {!showEmailOtpInput ? (
                                                                <button 
                                                                    type="button" 
                                                                    onClick={handleSendEmailOtp}
                                                                    disabled={isSendingEmailOtp || !regEmail}
                                                                    className="w-full py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                                                                >
                                                                    {isSendingEmailOtp ? 'Sending...' : 'Send OTP to Email'}
                                                                </button>
                                                            ) : (
                                                                <div className="flex gap-2 w-full">
                                                                    <input 
                                                                        type="text" 
                                                                        placeholder="OTP" 
                                                                        value={emailOtp}
                                                                        onChange={e => setEmailOtp(e.target.value)}
                                                                        className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold"
                                                                    />
                                                                    <button 
                                                                        type="button" 
                                                                        onClick={handleVerifyEmailOtp}
                                                                        className="px-3 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold"
                                                                    >
                                                                        Verify
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* REQUESTER (NGO) Verification Logic */}
                            {regRole === UserRole.REQUESTER && (
                                <div className="space-y-4">
                                    {/* Org Details */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Org Name</label>
                                            <input value={regOrgName} onChange={e => setRegOrgName(e.target.value)} placeholder="Sunshine Orphanage" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 transition-all" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Type</label>
                                            <select value={requesterType} onChange={e => setRequesterType(e.target.value as any)} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 transition-all appearance-none">
                                                <option value="Orphanage">Orphanage (JJ Act)</option>
                                                <option value="OldAgeHome">Old Age Home</option>
                                                <option value="NGO">General NGO</option>
                                                <option value="Other">Other</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Document Uploads Accordion Style */}
                                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                                        <h4 className="text-xs font-black uppercase text-slate-500 tracking-widest mb-4">Required Documents</h4>
                                        
                                        {/* Mandatory: Org PAN */}
                                        <div className="mb-4">
                                            <div className="flex justify-between mb-1">
                                                <label className="text-[10px] font-bold text-slate-600 uppercase">Organization PAN *</label>
                                                {reqDocStatus.org_pan?.verified && <span className="text-[10px] font-bold text-emerald-600">✔ Verified</span>}
                                            </div>
                                            <div className="relative">
                                                <input 
                                                    type="file" 
                                                    accept="image/*"
                                                    onChange={(e) => handleRequesterDocUpload(e, 'org_pan')}
                                                    className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-slate-200 file:text-slate-700 hover:file:bg-slate-300"
                                                />
                                                {verifyingDoc === 'org_pan' && <div className="absolute right-2 top-2 text-[10px] font-bold text-blue-500 animate-pulse">Checking...</div>}
                                            </div>
                                            {reqDocStatus.org_pan && !reqDocStatus.org_pan.verified && <p className="text-[10px] text-rose-500 font-bold mt-1">{reqDocStatus.org_pan.feedback}</p>}
                                        </div>

                                        {/* Type Specific */}
                                        {requesterType === 'Orphanage' && (
                                            <div className="mb-4">
                                                <div className="flex justify-between mb-1">
                                                    <label className="text-[10px] font-bold text-slate-600 uppercase">JJ Act Registration *</label>
                                                    {reqDocStatus.jj_act?.verified && <span className="text-[10px] font-bold text-emerald-600">✔ Verified</span>}
                                                </div>
                                                <input 
                                                    type="file" 
                                                    accept="image/*"
                                                    onChange={(e) => handleRequesterDocUpload(e, 'jj_act')}
                                                    className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-slate-200 file:text-slate-700 hover:file:bg-slate-300"
                                                />
                                                {verifyingDoc === 'jj_act' && <span className="text-[10px] text-blue-500 font-bold ml-2">Verifying...</span>}
                                            </div>
                                        )}

                                        {/* Optional/Common */}
                                        <div className="mb-4">
                                            <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Registration Cert (Society/Trust)</label>
                                            <input 
                                                type="file" 
                                                accept="image/*"
                                                onChange={(e) => handleRequesterDocUpload(e, 'registration_cert')}
                                                className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-slate-200 file:text-slate-700 hover:file:bg-slate-300"
                                            />
                                        </div>

                                        {/* Physical Validation */}
                                        <div className="pt-2 border-t border-slate-200">
                                            <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Facility Photo / Video Tour (Optional)</label>
                                            <input 
                                                type="file" 
                                                accept="image/*,video/*"
                                                onChange={(e) => handleRequesterDocUpload(e, 'facility_video')}
                                                className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-slate-200 file:text-slate-700 hover:file:bg-slate-300"
                                            />
                                            <p className="text-[9px] text-slate-400 font-medium mt-1">Upload a photo or short video of the premises entrance.</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Address Section (Common) */}
                            <div className="pt-2">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Address</label>
                                    <button type="button" onClick={handleDetectLocation} className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg uppercase tracking-wider hover:bg-emerald-100 transition-colors flex items-center gap-1">
                                        {detectingLoc ? 'Detecting...' : '📍 Detect Current Location'}
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    <LocationPickerMap
                                        lat={latLng?.lat}
                                        lng={latLng?.lng}
                                        onLocationSelect={(lat, lng) => setLatLng({ lat, lng })}
                                        onAddressFound={(addr) => {
                                            setLine1(addr.line1);
                                            setLine2(addr.line2);
                                            setPincode(addr.pincode);
                                        }}
                                    />

                                    <input value={line1} onChange={e => setLine1(e.target.value)} required placeholder="Street / Building" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 transition-all" />
                                    <div className="grid grid-cols-2 gap-4">
                                        <input value={line2} onChange={e => setLine2(e.target.value)} required placeholder="Area / City" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 transition-all" />
                                        <input
                                            value={pincode}
                                            required
                                            onChange={e => setPincode(e.target.value.replace(/\D/g, ''))}
                                            placeholder="Pincode (6 digits)"
                                            maxLength={6}
                                            pattern="\d{6}"
                                            inputMode="numeric"
                                            title="Please enter a valid 6-digit Pincode"
                                            className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 transition-all"
                                        />
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