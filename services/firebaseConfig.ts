
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

// Initialize Firebase only if config is present to avoid crash on load
let app;
let auth: any;

try {
    if (firebaseConfig.apiKey) {
        // Check if an app is already initialized to avoid "Firebase App named '[DEFAULT]' already exists" error during HMR
        app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
        auth = getAuth(app);
    } else {
        console.warn("Firebase config missing. OTP will not work. Falling back to simulation mode.");
    }
} catch (e) {
    console.error("Firebase Initialization Error:", e);
}

export { auth };
