
import { User, FoodPosting, ChatMessage, Rating, Notification } from '../types';

// API Base URL (Relative path for proxy)
const API_URL = '/api';

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

// Generic Fetch Helper
const api = async <T>(endpoint: string, options?: RequestInit): Promise<T> => {
    try {
        const response = await fetch(`${API_URL}${endpoint}`, {
            headers: { 'Content-Type': 'application/json' },
            ...options
        });
        if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
        return await response.json();
    } catch (error) {
        console.error(`Error in ${endpoint}:`, error);
        // Return empty array for list endpoints to prevent UI crashes
        if (!options || options.method === 'GET') return [] as any;
        throw error;
    }
};

export const storage = {
  // --- USERS ---
  getUsers: async (): Promise<User[]> => {
    return api<User[]>('/users');
  },
  getUser: async (id: string): Promise<User | undefined> => {
    const user = await api<User>(`/users/${id}`);
    return user || undefined;
  },
  saveUser: async (user: User) => {
    await api('/users', { method: 'POST', body: JSON.stringify(user) });
  },
  updateUser: async (id: string, updates: Partial<User>) => {
    await api(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(updates) });
  },
  deleteUser: async (id: string) => {
    await api(`/users/${id}`, { method: 'DELETE' });
  },

  // --- POSTINGS ---
  getPostings: async (): Promise<FoodPosting[]> => {
    return api<FoodPosting[]>('/postings');
  },
  savePosting: async (posting: FoodPosting) => {
    await api('/postings', { method: 'POST', body: JSON.stringify(posting) });
  },
  updatePosting: async (id: string, updates: Partial<FoodPosting>) => {
    await api(`/postings/${id}`, { method: 'PATCH', body: JSON.stringify(updates) });
  },
  deletePosting: async (id: string) => {
    await api(`/postings/${id}`, { method: 'DELETE' });
  },

  // --- MESSAGES ---
  // Note: For real-time chat in MongoDB without websockets, we use polling (handled in component)
  // or a simple fetch here. The Component calls listenMessages which needs to return an unsubscribe.
  listenMessages: (postingId: string, callback: (msgs: ChatMessage[]) => void) => {
    const fetchMsgs = async () => {
        const msgs = await api<ChatMessage[]>(`/messages/${postingId}`);
        callback(msgs);
    };
    
    fetchMsgs(); // Initial fetch
    const interval = setInterval(fetchMsgs, 3000); // Poll every 3s
    return () => clearInterval(interval);
  },
  saveMessage: async (postingId: string, message: ChatMessage) => {
    await api('/messages', { method: 'POST', body: JSON.stringify(message) });
  },

  // --- RATINGS ---
  submitUserRating: async (postingId: string, rating: Rating) => {
    await api('/ratings', { 
        method: 'POST', 
        body: JSON.stringify({ postingId, ratingData: rating }) 
    });
  },

  // --- NOTIFICATIONS ---
  listenNotifications: (userId: string, callback: (notifications: Notification[]) => void) => {
    const fetchNotifs = async () => {
        const notifs = await api<Notification[]>(`/notifications/${userId}`);
        callback(notifs);
    };
    
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 10000); // Poll every 10s
    return () => clearInterval(interval);
  },

  getNotifications: async (userId: string): Promise<Notification[]> => {
    return api<Notification[]>(`/notifications/${userId}`);
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
    await api('/notifications', { method: 'POST', body: JSON.stringify(n) });
  }
};
