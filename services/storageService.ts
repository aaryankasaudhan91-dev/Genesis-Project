
import { User, FoodPosting, ChatMessage, Rating, Notification, FoodStatus, UserRole } from '../types';

const API_URL = '/api';

// --- MOCK DATA FOR FALLBACK ---
const MOCK_POSTINGS: FoodPosting[] = [
  {
    id: 'mock-1',
    donorId: 'd1',
    donorName: 'Fresh Bites Restaurant',
    donorOrg: 'Fresh Bites',
    isDonorVerified: true,
    foodName: 'Vegetable Biryani & Curry',
    quantity: '15 meals',
    location: { line1: 'Main Street', line2: 'Downtown', pincode: '400001', lat: 20.5937, lng: 78.9629 },
    expiryDate: new Date(Date.now() + 86400000).toISOString(),
    status: FoodStatus.AVAILABLE,
    foodCategory: 'Veg',
    createdAt: Date.now(),
    description: 'Freshly prepared surplus food from lunch service. Packed in aluminum containers.',
    donationType: 'FOOD',
    safetyVerdict: { isSafe: true, reasoning: 'Verified by AI' }
  }
];

const MOCK_USERS: User[] = [
    {
        id: 'd1', name: 'Fresh Bites Owner', email: 'owner@freshbites.com', role: UserRole.DONOR, orgName: 'Fresh Bites',
        address: { line1: '123 Food St', line2: 'City', pincode: '123456' }
    }
];

// Helper to manage local storage
const getLocal = (key: string, defaultVal: any) => {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultVal;
    } catch { return defaultVal; }
};
const setLocal = (key: string, val: any) => localStorage.setItem(key, JSON.stringify(val));

const handleMockRequest = async (endpoint: string, options?: RequestInit): Promise<any> => {
    console.log(`[Mock Mode] Handling ${options?.method || 'GET'} ${endpoint}`);
    await new Promise(resolve => setTimeout(resolve, 300)); // Simulate latency

    // POSTINGS
    if (endpoint === '/postings') {
        if (options?.method === 'POST') {
            const body = JSON.parse(options.body as string);
            const current = getLocal('mock_postings', MOCK_POSTINGS);
            const newPost = { ...body, id: `mock-${Date.now()}` };
            setLocal('mock_postings', [newPost, ...current]);
            return newPost;
        }
        return getLocal('mock_postings', MOCK_POSTINGS);
    }
    
    if (endpoint.startsWith('/postings/')) { 
        const id = endpoint.split('/')[2];
        const current = getLocal('mock_postings', MOCK_POSTINGS);
        
        if (options?.method === 'PATCH') {
            const updates = JSON.parse(options.body as string);
            const updated = current.map((p: any) => p.id === id ? { ...p, ...updates } : p);
            setLocal('mock_postings', updated);
            return updated.find((p: any) => p.id === id) || { ...updates, id };
        }
        if (options?.method === 'DELETE') {
            const filtered = current.filter((p: any) => p.id !== id);
            setLocal('mock_postings', filtered);
            return { success: true };
        }
    }

    // USERS
    if (endpoint === '/users' && options?.method === 'POST') {
        const body = JSON.parse(options.body as string);
        const users = getLocal('mock_users', MOCK_USERS);
        // Update or Add
        const existingIdx = users.findIndex((u: any) => u.id === body.id);
        if(existingIdx >= 0) {
            users[existingIdx] = { ...users[existingIdx], ...body };
        } else {
            users.push(body);
        }
        setLocal('mock_users', users);
        return body;
    }
    
    if (endpoint.startsWith('/users/')) {
        const id = endpoint.split('/')[2];
        const users = getLocal('mock_users', MOCK_USERS);
        if(options?.method === 'PATCH') {
             const updates = JSON.parse(options.body as string);
             const updatedUsers = users.map((u:any) => u.id === id ? {...u, ...updates} : u);
             setLocal('mock_users', updatedUsers);
             return updatedUsers.find((u:any) => u.id === id);
        }
        if(options?.method === 'DELETE') {
             const filtered = users.filter((u:any) => u.id !== id);
             setLocal('mock_users', filtered);
             return { success: true };
        }
        return users.find((u: any) => u.id === id) || null;
    }

    if (endpoint === '/users') return getLocal('mock_users', MOCK_USERS);

    // NOTIFICATIONS
    if (endpoint.startsWith('/notifications')) {
        if (options?.method === 'POST') {
            const body = JSON.parse(options.body as string);
            // In a real app we'd save this, but for mock just return it
            return body;
        }
        // Mock notifications
        return [];
    }

    // MESSAGES
    if (endpoint.startsWith('/messages')) {
        if (options?.method === 'POST') return JSON.parse(options.body as string);
        return [];
    }

    // RATINGS
    if (endpoint.startsWith('/ratings')) {
        return { success: true };
    }

    return {};
};

const api = async <T>(endpoint: string, options?: RequestInit): Promise<T> => {
    try {
        // Attempt fetch
        const response = await fetch(`${API_URL}${endpoint}`, {
            headers: { 'Content-Type': 'application/json' },
            ...options
        });
        
        // If response is not OK, throw error to trigger mock fallback
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") === -1) {
             throw new Error("Invalid JSON Response");
        }
        
        return await response.json();
    } catch (error) {
        console.warn(`Backend unreachable at ${endpoint}. Switching to Mock Mode.`);
        // Fallback to Mock
        return await handleMockRequest(endpoint, options);
    }
};

export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; 
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
  return R * c; 
};

export const storage = {
  getUsers: async (): Promise<User[]> => api<User[]>('/users'),
  getUser: async (id: string): Promise<User | undefined> => api<User>(`/users/${id}`),
  saveUser: async (user: User) => api('/users', { method: 'POST', body: JSON.stringify(user) }),
  updateUser: async (id: string, updates: Partial<User>) => api(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }),
  deleteUser: async (id: string) => api(`/users/${id}`, { method: 'DELETE' }),

  getPostings: async (): Promise<FoodPosting[]> => api<FoodPosting[]>('/postings'),
  savePosting: async (posting: FoodPosting) => api('/postings', { method: 'POST', body: JSON.stringify(posting) }),
  updatePosting: async (id: string, updates: Partial<FoodPosting>) => api(`/postings/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }),
  deletePosting: async (id: string) => api(`/postings/${id}`, { method: 'DELETE' }),

  listenMessages: (postingId: string, callback: (msgs: ChatMessage[]) => void) => {
    const fetchMsgs = async () => {
        try {
            const msgs = await api<ChatMessage[]>(`/messages/${postingId}`);
            callback(msgs || []);
        } catch { callback([]); }
    };
    fetchMsgs();
    const interval = setInterval(fetchMsgs, 3000);
    return () => clearInterval(interval);
  },
  saveMessage: async (postingId: string, message: ChatMessage) => {
      await api('/messages', { method: 'POST', body: JSON.stringify(message) });
  },

  submitUserRating: async (postingId: string, rating: Rating) => {
      await api('/ratings', { method: 'POST', body: JSON.stringify({ postingId, ratingData: rating }) });
  },

  listenNotifications: (userId: string, callback: (notifications: Notification[]) => void) => {
    const fetchNotifs = async () => {
        try {
            const notifs = await api<Notification[]>(`/notifications/${userId}`);
            callback(notifs || []);
        } catch { callback([]); }
    };
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 10000);
    return () => clearInterval(interval);
  },

  getNotifications: async (userId: string): Promise<Notification[]> => api<Notification[]>(`/notifications/${userId}`),
  createNotification: async (userId: string, message: string, type: 'INFO' | 'ACTION' | 'SUCCESS') => {
    const n = { id: Math.random().toString(36).substr(2, 9), userId, message, type, isRead: false, createdAt: Date.now() };
    await api('/notifications', { method: 'POST', body: JSON.stringify(n) });
  }
};
