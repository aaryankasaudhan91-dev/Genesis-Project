
import { db } from './firebaseConfig';
import { 
  collection, getDocs, doc, setDoc, updateDoc, deleteDoc, 
  onSnapshot, query, where, orderBy, getDoc 
} from 'firebase/firestore';
import { User, FoodPosting, ChatMessage, Rating, Notification } from '../types';

// --- Fallback for Simulation Mode ---
const isSim = !db;

// In-memory storage for simulation
let simUsers: User[] = [];
let simPostings: FoodPosting[] = [];
let simMessages: Record<string, ChatMessage[]> = {};
let simNotifications: Notification[] = [];

// Helper for distance calculation
export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
  return R * c; // Distance in km
};

export const storage = {
  // --- USERS ---
  getUsers: async (): Promise<User[]> => {
    if (isSim) return simUsers;
    try {
        const snap = await getDocs(collection(db, 'users'));
        return snap.docs.map(d => d.data() as User);
    } catch (e) { console.error(e); return []; }
  },
  getUser: async (id: string): Promise<User | undefined> => {
    if (isSim) return simUsers.find(u => u.id === id);
    try {
        const snap = await getDoc(doc(db, 'users', id));
        return snap.exists() ? snap.data() as User : undefined;
    } catch (e) { console.error(e); return undefined; }
  },
  saveUser: async (user: User) => {
    if (isSim) {
      const idx = simUsers.findIndex(u => u.id === user.id);
      if (idx >= 0) simUsers[idx] = user; else simUsers.push(user);
      return;
    }
    await setDoc(doc(db, 'users', user.id), user);
  },
  updateUser: async (id: string, updates: Partial<User>) => {
    if (isSim) {
      const u = simUsers.find(u => u.id === id);
      if (u) Object.assign(u, updates);
      return;
    }
    await updateDoc(doc(db, 'users', id), updates);
  },
  deleteUser: async (id: string) => {
    if (isSim) {
      simUsers = simUsers.filter(u => u.id !== id);
      return;
    }
    await deleteDoc(doc(db, 'users', id));
  },

  // --- POSTINGS ---
  getPostings: async (): Promise<FoodPosting[]> => {
    if (isSim) return simPostings;
    try {
        const snap = await getDocs(query(collection(db, 'postings'), orderBy('createdAt', 'desc')));
        return snap.docs.map(d => d.data() as FoodPosting);
    } catch (e) { console.error(e); return []; }
  },
  savePosting: async (posting: FoodPosting) => {
    if (isSim) {
      simPostings.push(posting);
      return;
    }
    await setDoc(doc(db, 'postings', posting.id), posting);
  },
  updatePosting: async (id: string, updates: Partial<FoodPosting>) => {
    if (isSim) {
      const p = simPostings.find(p => p.id === id);
      if (p) Object.assign(p, updates);
      return;
    }
    await updateDoc(doc(db, 'postings', id), updates);
  },
  deletePosting: async (id: string) => {
    if (isSim) {
      simPostings = simPostings.filter(p => p.id !== id);
      return;
    }
    await deleteDoc(doc(db, 'postings', id));
  },

  // --- MESSAGES ---
  listenMessages: (postingId: string, callback: (msgs: ChatMessage[]) => void) => {
    if (isSim) {
      callback(simMessages[postingId] || []);
      return () => {};
    }
    const q = query(collection(db, 'postings', postingId, 'messages'), orderBy('createdAt', 'asc'));
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map(d => d.data() as ChatMessage));
    });
  },
  saveMessage: async (postingId: string, message: ChatMessage) => {
    if (isSim) {
      if (!simMessages[postingId]) simMessages[postingId] = [];
      simMessages[postingId].push(message);
      return;
    }
    await setDoc(doc(db, 'postings', postingId, 'messages', message.id), message);
  },

  // --- RATINGS ---
  submitUserRating: async (postingId: string, rating: Rating) => {
    // 1. Update the Posting (store rating in array)
    if (isSim) {
        const posting = simPostings.find(p => p.id === postingId);
        if (posting) {
            if (!posting.ratings) posting.ratings = [];
            posting.ratings.push(rating);
        }
        
        // 2. Update the Target User (Aggregate stats)
        const targetUser = simUsers.find(u => u.id === rating.targetId);
        if (targetUser) {
            const count = targetUser.ratingsCount || 0;
            const avg = targetUser.averageRating || 5.0;
            const newCount = count + 1;
            const newAvg = ((avg * count) + rating.rating) / newCount;
            targetUser.averageRating = newAvg;
            targetUser.ratingsCount = newCount;
        }
        return;
    }

    // Real Firestore Implementation
    // Note: In production, this should be a Transaction or Cloud Function to avoid race conditions
    try {
        // A. Update Posting
        const postingRef = doc(db, 'postings', postingId);
        const postingSnap = await getDoc(postingRef);
        if (postingSnap.exists()) {
            const currentRatings = postingSnap.data().ratings || [];
            await updateDoc(postingRef, {
                ratings: [...currentRatings, rating]
            });
        }

        // B. Update Target User
        const userRef = doc(db, 'users', rating.targetId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            const userData = userSnap.data() as User;
            const count = userData.ratingsCount || 0;
            const avg = userData.averageRating || 0;
            
            // If first rating, start fresh. Otherwise, weighted average.
            const newCount = count + 1;
            // Handle case where avg might be undefined or 0 initially
            const currentTotal = (count > 0) ? avg * count : 0;
            const newAvg = (currentTotal + rating.rating) / newCount;

            await updateDoc(userRef, {
                averageRating: newAvg,
                ratingsCount: newCount
            });
        }
    } catch (e) {
        console.error("Error submitting rating:", e);
    }
  },

  // --- NOTIFICATIONS ---
  listenNotifications: (userId: string, callback: (notifications: Notification[]) => void) => {
    if (isSim) {
      callback(simNotifications.filter(n => n.userId === userId));
      return () => {};
    }
    const q = query(collection(db, 'notifications'), where('userId', '==', userId), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map(d => d.data() as Notification));
    });
  },

  getNotifications: async (userId: string): Promise<Notification[]> => {
    if (isSim) return simNotifications.filter(n => n.userId === userId);
    try {
        const q = query(collection(db, 'notifications'), where('userId', '==', userId), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data() as Notification);
    } catch (e) { console.error(e); return []; }
  },

  createNotification: async (userId: string, message: string, type: 'INFO' | 'ACTION' | 'SUCCESS') => {
    const n: Notification = {
        id: Math.random().toString(36).substr(2, 9),
        userId,
        message,
        type,
        isRead: false,
        createdAt: Date.now()
    };
    if (isSim) {
        simNotifications.push(n);
        return;
    }
    await setDoc(doc(db, 'notifications', n.id), n);
  }
};
