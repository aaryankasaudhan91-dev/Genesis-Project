
import mongoose from 'mongoose';

const AddressSchema = new mongoose.Schema({
  line1: String,
  line2: String,
  landmark: String,
  pincode: String,
  lat: Number,
  lng: Number
});

const UserSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true }, // Firebase UID
  name: String,
  email: String,
  contactNo: String,
  role: { type: String, enum: ['DONOR', 'VOLUNTEER', 'REQUESTER'] },
  address: AddressSchema,
  orgCategory: String,
  orgName: String,
  favoriteRequesterIds: [String],
  impactScore: { type: Number, default: 0 },
  averageRating: { type: Number, default: 5.0 },
  ratingsCount: { type: Number, default: 0 },
  profilePictureUrl: String,
  notificationPreferences: {
    newPostings: { type: Boolean, default: true },
    missionUpdates: { type: Boolean, default: true },
    messages: { type: Boolean, default: true }
  },
  searchRadius: { type: Number, default: 10 },
  donationTypeFilter: { type: String, default: 'ALL' },
  sortBy: { type: String, default: 'NEWEST' },
  language: { type: String, default: 'English' },
  
  // Role Specifics
  volunteerCategory: String,
  volunteerIdType: String,
  isVerified: { type: Boolean, default: false },
  donorType: String,
  requesterType: String,
  verificationStatus: String,
  documentUrls: {
    registrationCert: String,
    orgPan: String,
    darpanId: String,
    taxExemptCert: String,
    bankProof: String,
    jjAct: String,
    municipalLicense: String,
    facilityVideo: String
  }
}, { timestamps: true });

const RatingSchema = new mongoose.Schema({
  raterId: String,
  raterRole: String,
  targetId: String,
  rating: Number,
  feedback: String,
  createdAt: Number
});

const FoodPostingSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  donationType: { type: String, default: 'FOOD' },
  donorId: String,
  donorName: String,
  donorOrg: String,
  isDonorVerified: Boolean,
  foodName: String,
  description: String,
  foodCategory: String,
  quantity: String,
  location: AddressSchema,
  expiryDate: String,
  status: { type: String, default: 'AVAILABLE' },
  imageUrl: String,
  foodTags: [String],
  safetyVerdict: {
    isSafe: Boolean,
    reasoning: String
  },
  orphanageId: String,
  orphanageName: String,
  requesterAddress: AddressSchema,
  volunteerId: String,
  volunteerName: String,
  volunteerLocation: { lat: Number, lng: Number },
  interestedVolunteers: [{ userId: String, userName: String }],
  etaMinutes: Number,
  isPickedUp: Boolean,
  pickupVerificationImageUrl: String,
  verificationImageUrl: String,
  donorReceiptImageUrl: String,
  volunteerNotes: String,
  ratings: [RatingSchema],
  platformFeePaid: Boolean,
  createdAt: Number
});

const ChatMessageSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  postingId: String,
  senderId: String,
  senderName: String,
  senderRole: String,
  text: String,
  createdAt: Number
});

const NotificationSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  userId: String,
  message: String,
  isRead: { type: Boolean, default: false },
  type: String,
  createdAt: Number
});

export const User = mongoose.model('User', UserSchema);
export const FoodPosting = mongoose.model('FoodPosting', FoodPostingSchema);
export const ChatMessage = mongoose.model('ChatMessage', ChatMessageSchema);
export const Notification = mongoose.model('Notification', NotificationSchema);
