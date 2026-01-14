
import { initializeApp } from "firebase/app";
import { 
    getAuth, 
    GoogleAuthProvider, 
    RecaptchaVerifier, 
    signInWithPhoneNumber, 
    signInWithPopup, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    sendPasswordResetEmail, 
    onAuthStateChanged, 
    signOut, 
    updateProfile 
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

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  googleProvider = new GoogleAuthProvider();
} catch (error) {
  console.error("Firebase Initialization Error. Ensure .env variables are set.", error);
}

export { 
    auth, 
    googleProvider, 
    RecaptchaVerifier, 
    signInWithPhoneNumber, 
    signInWithPopup, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    sendPasswordResetEmail, 
    onAuthStateChanged, 
    signOut, 
    updateProfile 
};
