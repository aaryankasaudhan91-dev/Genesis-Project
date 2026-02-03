
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
  orgCategory?: string; // e.g., Restaurant, Bakery
  orgName?: string;
  favoriteRequesterIds?: string[];
  impactScore?: number;
  averageRating?: number;
  ratingsCount?: number;
  profilePictureUrl?: string;
  notificationPreferences?: NotificationPreferences;
  searchRadius?: number;
  donationTypeFilter?: 'ALL' | 'FOOD' | 'CLOTHES';
  sortBy?: 'NEWEST' | 'CLOSEST' | 'EXPIRY';
  language?: string;
  
  // Volunteer Specific
  volunteerCategory?: 'Student' | 'Individual';
  volunteerIdType?: string;
  isVerified?: boolean; // Generic verified flag for Volunteer & Donor

  // Donor Specific
  donorType?: 'Individual' | 'Restaurant' | 'Corporate' | 'Event';
  
  // Requester (NGO/Orphanage) Specific Verification
  requesterType?: 'Orphanage' | 'OldAgeHome' | 'NGO' | 'Other';
  verificationStatus?: 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
  documentUrls?: {
    registrationCert?: string;
    orgPan?: string;
    darpanId?: string; // Optional
    taxExemptCert?: string; // 12A/80G
    bankProof?: string;
    jjAct?: string; // Orphanage only
    municipalLicense?: string; // Old Age Home only
    facilityVideo?: string; // Level 3 validation
  };
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
  targetId: string; // The user being rated
  rating: number;
  feedback?: string;
  createdAt: number;
}

export type DonationType = 'FOOD' | 'CLOTHES';

export interface FoodPosting {
  id: string;
  donationType?: DonationType; // Defaults to FOOD if undefined
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
  platformFeePaid?: boolean;
}

export interface Notification {
  id: string;
  userId: string;
  message: string;
  isRead: boolean;
  createdAt: number;
  type: 'INFO' | 'ACTION' | 'SUCCESS';
}
