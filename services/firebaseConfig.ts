
import { initializeApp } from "firebase/app";
import { 
    getAuth, 
    GoogleAuthProvider, 
    RecaptchaVerifier as FirebaseRecaptchaVerifier, 
    signInWithPhoneNumber as firebaseSignInWithPhoneNumber, 
    signInWithPopup as firebaseSignInWithPopup, 
    signInWithEmailAndPassword as firebaseSignInWithEmailAndPassword, 
    createUserWithEmailAndPassword as firebaseCreateUserWithEmailAndPassword, 
    sendPasswordResetEmail as firebaseSendPasswordResetEmail, 
    confirmPasswordReset as firebaseConfirmPasswordReset,
    onAuthStateChanged as firebaseOnAuthStateChanged, 
    signOut as firebaseSignOut, 
    updateProfile as firebaseUpdateProfile 
} from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

let app;
let auth: any;
let googleProvider: any;
let isConfigured = false;

try {
  // Strict check: Ensure key exists, is not "undefined" string, AND is not the default placeholder
  const apiKey = firebaseConfig.apiKey;
  const isValidKey = apiKey && 
                     apiKey !== "undefined" && 
                     !apiKey.includes("your_firebase_api_key"); // Check for placeholder

  if (isValidKey) {
      app = initializeApp(firebaseConfig);
      auth = getAuth(app);
      googleProvider = new GoogleAuthProvider();
      isConfigured = true;
      console.log("Firebase initialized successfully.");
  } else {
      console.warn("Firebase API key is missing or invalid. App will run in Simulation Mode.");
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

// Wrapper functions that switch between Real Firebase and Simulation

const signInWithPopup = async (authArg: any, provider: any) => {
    if (isConfigured) return firebaseSignInWithPopup(authArg, provider);
    
    // Simulate latency
    await new Promise(r => setTimeout(r, 1000));
    console.log("[Simulation] Google Sign In Successful");
    return { user: { ...mockUser } } as any;
};

const signInWithEmailAndPassword = async (authArg: any, email: string, pass: string) => {
    if (isConfigured) return firebaseSignInWithEmailAndPassword(authArg, email, pass);
    
    await new Promise(r => setTimeout(r, 1000));
    console.log(`[Simulation] Login with ${email}`);
    // Simulate user
    return { user: { ...mockUser, email } } as any;
};

const createUserWithEmailAndPassword = async (authArg: any, email: string, pass: string) => {
    if (isConfigured) return firebaseCreateUserWithEmailAndPassword(authArg, email, pass);
    
    await new Promise(r => setTimeout(r, 1000));
    console.log(`[Simulation] Register with ${email}`);
    return { user: { ...mockUser, email, uid: `sim-${Date.now()}` } } as any;
};

const signInWithPhoneNumber = async (authArg: any, phone: string, verifier: any) => {
    if (isConfigured) return firebaseSignInWithPhoneNumber(authArg, phone, verifier);
    
    await new Promise(r => setTimeout(r, 800));
    console.log(`[Simulation] OTP sent to ${phone}`);
    return {
        confirm: async (otp: string) => {
            if (otp === "123456") return { user: { ...mockUser, phoneNumber: phone } };
            throw new Error("Invalid OTP (Simulation: Use 123456)");
        },
        verificationId: "sim-vid-123"
    } as any;
};

const sendPasswordResetEmail = async (authArg: any, email: string) => {
    if (isConfigured) return firebaseSendPasswordResetEmail(authArg, email);
    
    await new Promise(r => setTimeout(r, 800));
    console.log(`[Simulation] Password reset link sent to ${email}`);
    return;
};

const confirmPasswordReset = async (authArg: any, oobCode: string, newPassword: string) => {
    if (isConfigured) return firebaseConfirmPasswordReset(authArg, oobCode, newPassword);

    await new Promise(r => setTimeout(r, 800));
    console.log(`[Simulation] Password reset confirmed with code ${oobCode}`);
    return;
};

const signOut = async (authArg: any) => {
    if (isConfigured) return firebaseSignOut(authArg);
    console.log("[Simulation] Signed Out");
    return;
};

const updateProfile = async (user: any, profile: any) => {
    if (isConfigured) return firebaseUpdateProfile(user, profile);
    // In mock, just mutate the object locally for current session
    Object.assign(user, profile);
    return;
};

const onAuthStateChanged = (authArg: any, callback: any) => {
    if (isConfigured) return firebaseOnAuthStateChanged(authArg, callback);
    // In simulation mode, we don't automatically restore session on reload in this simple implementation
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

export { 
    auth, 
    googleProvider, 
    RecaptchaVerifier, 
    signInWithPhoneNumber, 
    signInWithPopup, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    sendPasswordResetEmail, 
    confirmPasswordReset,
    onAuthStateChanged, 
    signOut, 
    updateProfile 
};
