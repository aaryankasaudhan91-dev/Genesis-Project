
import { initializeApp } from "firebase/app";
import { 
    getAuth, 
    GoogleAuthProvider, 
    RecaptchaVerifier as FirebaseRecaptchaVerifier, 
    signInWithPhoneNumber as firebaseSignInWithPhoneNumber, 
    signInWithPopup as firebaseSignInWithPopup, 
    signInWithEmailAndPassword as firebaseSignInWithEmailAndPassword, 
    createUserWithEmailAndPassword as firebaseCreateUserWithEmailAndPassword, 
    updatePassword as firebaseUpdatePassword,
    onAuthStateChanged as firebaseOnAuthStateChanged, 
    signOut as firebaseSignOut, 
    updateProfile as firebaseUpdateProfile,
    PhoneAuthProvider as FirebasePhoneAuthProvider,
    signInWithCredential as firebaseSignInWithCredential
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

let app;
// Initialize with a mock object so 'auth' is never undefined
let auth: any = { currentUser: null }; 
let db: any;
let storage: any;
let googleProvider: any;
let isConfigured = false;

try {
  // Strict check: Ensure key exists, is not "undefined" string, AND is not the default placeholder
  const apiKey = firebaseConfig.apiKey;
  const isValidKey = apiKey && 
                     apiKey !== "undefined" && 
                     !apiKey.includes("your_firebase_api_key");

  if (isValidKey) {
      app = initializeApp(firebaseConfig);
      auth = getAuth(app);
      db = getFirestore(app);
      storage = getStorage(app);
      googleProvider = new GoogleAuthProvider();
      isConfigured = true;
      console.log("Firebase initialized successfully.");
  } else {
      console.log("Running in Simulation Mode (Firebase keys missing or invalid).");
  }
} catch (error) {
  console.warn("Firebase initialization failed. Using simulation mode.", error);
  isConfigured = false;
}

// --- Simulation Mode Helpers ---
const mockUser = {
    uid: "simulated-user-123",
    email: "demo@mealers.connect",
    displayName: "Demo User",
    photoURL: null,
    phoneNumber: "+919876543210",
    emailVerified: true
};

// Helper to update auth state safely
const updateMockAuthState = (user: any) => {
    if (auth) {
        auth.currentUser = user;
    } else {
        auth = { currentUser: user };
    }
};

// Wrapper functions that switch between Real Firebase and Simulation

const signInWithPopup = async (authArg: any, provider: any) => {
    if (isConfigured) return firebaseSignInWithPopup(authArg, provider);
    
    await new Promise(r => setTimeout(r, 1000));
    console.log("[Simulation] Google Sign In Successful");
    const user = { ...mockUser };
    updateMockAuthState(user);
    return { user } as any;
};

const signInWithEmailAndPassword = async (authArg: any, email: string, pass: string) => {
    if (isConfigured) return firebaseSignInWithEmailAndPassword(authArg, email, pass);
    
    await new Promise(r => setTimeout(r, 1000));
    console.log(`[Simulation] Login with ${email}`);
    const user = { ...mockUser, email };
    updateMockAuthState(user);
    return { user } as any;
};

const createUserWithEmailAndPassword = async (authArg: any, email: string, pass: string) => {
    if (isConfigured) return firebaseCreateUserWithEmailAndPassword(authArg, email, pass);
    
    await new Promise(r => setTimeout(r, 1000));
    console.log(`[Simulation] Register with ${email}`);
    const user = { ...mockUser, email, uid: `sim-${Date.now()}` };
    updateMockAuthState(user);
    return { user } as any;
};

const signInWithPhoneNumber = async (authArg: any, phone: string, verifier: any) => {
    if (isConfigured) return firebaseSignInWithPhoneNumber(authArg, phone, verifier);
    
    await new Promise(r => setTimeout(r, 800));
    console.log(`[Simulation] OTP sent to ${phone}`);
    return {
        confirm: async (otp: string) => {
            if (otp === "123456") {
                const user = { ...mockUser, phoneNumber: phone };
                updateMockAuthState(user);
                return { user };
            }
            throw new Error("Invalid OTP (Simulation: Use 123456)");
        },
        verificationId: "sim-vid-123"
    } as any;
};

const signInWithCredential = async (authArg: any, credential: any) => {
    if (isConfigured) return firebaseSignInWithCredential(authArg, credential);

    await new Promise(r => setTimeout(r, 800));
    
    // Simulate OTP validation
    if (credential && credential.smsCode && credential.smsCode !== '123456') {
        throw new Error("Invalid OTP (Simulation: Use 123456)");
    }

    console.log(`[Simulation] Signed in with credential`);
    const user = { ...mockUser };
    updateMockAuthState(user);
    return { user } as any;
};

const updatePassword = async (user: any, newPassword: string) => {
    if (isConfigured) return firebaseUpdatePassword(user, newPassword);

    await new Promise(r => setTimeout(r, 800));
    console.log(`[Simulation] Password updated to ${newPassword}`);
    return;
};

const signOut = async (authArg: any) => {
    if (isConfigured) return firebaseSignOut(authArg);
    console.log("[Simulation] Signed Out");
    updateMockAuthState(null);
    return;
};

const updateProfile = async (user: any, profile: any) => {
    if (isConfigured) return firebaseUpdateProfile(user, profile);
    // In mock, just mutate the object locally for current session
    Object.assign(user, profile);
    if (auth && auth.currentUser && auth.currentUser.uid === user.uid) {
        Object.assign(auth.currentUser, profile);
    }
    return;
};

const onAuthStateChanged = (authArg: any, callback: any) => {
    if (isConfigured) return firebaseOnAuthStateChanged(authArg, callback);
    // In simulation mode, do not auto-login to mock user on refresh to allow Login Page testing
    // The App's localStorage logic handles the user persistence
    callback(null);
    return () => {};
};

// Mock Recaptcha
class MockRecaptchaVerifier {
    constructor() {}
    render() { return Promise.resolve(0); }
    verify() { return Promise.resolve(""); }
    clear() {}
}

const RecaptchaVerifier = isConfigured ? FirebaseRecaptchaVerifier : MockRecaptchaVerifier;

// PhoneAuthProvider Wrapper
const PhoneAuthProvider = isConfigured ? FirebasePhoneAuthProvider : class {
    static credential(verificationId: string, smsCode: string) {
        return { verificationId, smsCode, providerId: 'phone' };
    }
} as any;

export { 
    auth, 
    db,
    storage,
    googleProvider, 
    RecaptchaVerifier, 
    signInWithPhoneNumber, 
    signInWithPopup, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    updatePassword, 
    onAuthStateChanged, 
    signOut, 
    updateProfile,
    PhoneAuthProvider,
    signInWithCredential
};
