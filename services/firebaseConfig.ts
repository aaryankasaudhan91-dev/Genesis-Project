import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";
import { getAnalytics, Analytics } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCt9-_oH0YILXO6kZo5mbr5DXrpsvMDxVo",
  authDomain: "test-7cc74.firebaseapp.com",
  projectId: "test-7cc74",
  storageBucket: "test-7cc74.firebasestorage.app",
  messagingSenderId: "928829556002",
  appId: "1:928829556002:web:aca3a66e76921c9475d17b",
  measurementId: "G-XSKSKT75ZY"
};

// VAPID Key for Messaging/Push Notifications
export const vapidKey = "BKLxgkykgt235tZuMk8G-8fQZtvxph17EAiYZc46Rt5tjbh6F-nd19lWtjLQF1YmuJ4zjvwaiVFGtVRI-GNece0";

// Initialize Firebase services
let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;
let storage: FirebaseStorage | undefined;
let analytics: Analytics | undefined;

const googleProvider = new GoogleAuthProvider();

const isConfigValid = (config: any) => {
    // Check for missing keys
    // We ignore measurementId as it's optional
    const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'appId'];
    
    const missingKeys = requiredKeys.filter(key => {
        const value = config[key];
        return !value || 
               value === 'undefined' || 
               (typeof value === 'string' && (value.includes('INSERT_') || value.includes('placeholder')));
    });

    if (missingKeys.length > 0) {
        if (missingKeys.length === requiredKeys.length) {
            // All missing, probably just not set up yet
            console.info("Firebase Environment Variables not set. Running in Simulation Mode.");
        } else {
            console.warn("Firebase Configuration Incomplete. Missing keys:", missingKeys.join(", "));
        }
        return false;
    }
    return true;
};

try {
    if (isConfigValid(firebaseConfig)) {
        // Check if an app is already initialized to avoid "Firebase App named '[DEFAULT]' already exists" error during HMR
        app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
        
        auth = getAuth(app);
        db = getFirestore(app);
        storage = getStorage(app);
        
        if (typeof window !== 'undefined') {
            try {
                analytics = getAnalytics(app);
            } catch (err) {
                console.warn("Analytics initialization failed (likely due to ad blockers or offline):", err);
            }
        }
        
        console.log("✅ Firebase initialized successfully");
    } else {
        console.log("⚠️ App running in Simulation Mode (Offline/Demo)");
    }
} catch (e) {
    console.error("Firebase Initialization Error:", e);
}

export { auth, googleProvider, db, storage, analytics };