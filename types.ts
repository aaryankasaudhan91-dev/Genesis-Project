
export enum UserRole {
  DONOR = 'DONOR',
  VOLUNTEER = 'VOLUNTEER',
  REQUESTER = 'REQUESTER'
}

export enum FoodStatus {
  AVAILABLE = 'AVAILABLE',
  REQUESTED = 'REQUESTED',
  PICKUP_VERIFICATION_PENDING = 'PICKUP_VERIFICATION_PENDING',
  IN_TRANSIT = 'IN_TRANSIT',
  DELIVERY_VERIFICATION_PENDING = 'DELIVERY_VERIFICATION_PENDING',
  DELIVERED = 'DELIVERED'
}

export interface Address {
  line1: string;
  line2: string;
  landmark?: string;
  pincode: string;
  lat?: number;
  lng?: number;
}

export interface NotificationPreferences {
  newPostings: boolean;
  missionUpdates: boolean;
  messages: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  contactNo?: string;
  password?: string;
  role: UserRole;
  address?: Address;
  orgCategory?: string;
  orgName?: string;
  favoriteRequesterIds?: string[];
  impactScore?: number;
  averageRating?: number;
  ratingsCount?: number;
  profilePictureUrl?: string;
  notificationPreferences?: NotificationPreferences;
}

export interface ChatMessage {
  id: string;
  postingId: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  text: string;
  createdAt: number;
}

export interface Rating {
  raterId: string;
  raterRole: UserRole;
  rating: number;
  feedback?: string;
  createdAt: number;
}

export interface FoodPosting {
  id: string;
  donorId: string;
  donorName: string;
  donorOrg?: string;
  foodName: string;
  description?: string;
  foodCategory?: string;
  quantity: string;
  location: Address;
  expiryDate: string;
  status: FoodStatus;
  imageUrl?: string;
  foodTags?: string[];
  safetyVerdict?: {
    isSafe: boolean;
    reasoning: string;
  };
  orphanageId?: string;
  orphanageName?: string;
  requesterAddress?: Address;
  volunteerId?: string;
  volunteerName?: string;
  volunteerLocation?: { lat: number; lng: number };
  interestedVolunteers?: { userId: string; userName: string }[];
  etaMinutes?: number;
  isPickedUp?: boolean;
  pickupVerificationImageUrl?: string;
  verificationImageUrl?: string;
  volunteerNotes?: string;
  ratings?: Rating[];
  createdAt: number;
}

export interface Notification {
  id: string;
  userId: string;
  message: string;
  isRead: boolean;
  createdAt: number;
  type: 'INFO' | 'ACTION' | 'SUCCESS';
}
