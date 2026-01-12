
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";

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

// Initialize Firebase only if config is present and valid
let app;
let auth: any;

const isConfigValid = (config: any) => {
    return config.apiKey && 
           config.apiKey !== 'your_firebase_api_key' && 
           !config.apiKey.includes('INSERT_') &&
           !config.apiKey.includes('placeholder');
};

try {
    if (isConfigValid(firebaseConfig)) {
        // Check if an app is already initialized to avoid "Firebase App named '[DEFAULT]' already exists" error during HMR
        app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
        auth = getAuth(app);
        console.log("✅ Firebase initialized successfully");
    } else {
        console.info("Firebase configuration missing or invalid. App will run in Simulation Mode (OTP will be mocked).");
    }
} catch (e) {
    console.error("Firebase Initialization Error:", e);
}

export { auth };
