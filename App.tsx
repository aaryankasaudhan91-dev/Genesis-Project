
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User, UserRole, FoodPosting, FoodStatus, Notification, Rating, DonationType } from './types';
import { storage, calculateDistance } from './services/storageService';
import { analyzeFoodSafetyImage, analyzeClothesImage, editImage, transcribeAudio } from './services/geminiService';
import { reverseGeocodeGoogle } from './services/mapLoader';
import { auth, onAuthStateChanged, signOut } from './services/firebaseConfig';
import Layout from './components/Layout';
import FoodCard from './components/FoodCard';
import PostingsMap from './components/PostingsMap';
import ProfileView from './components/ProfileView';
import SettingsView from './components/SettingsView';
import ContactUs from './components/ContactUs';
import HelpFAQ from './components/HelpFAQ';
import { LoginPage } from './components/LoginPage';
import VerificationRequestModal from './components/VerificationRequestModal';
import ChatModal from './components/ChatModal';
import SplashScreen from './components/SplashScreen';
import LocationPickerMap from './components/LocationPickerMap';
import PaymentModal from './components/PaymentModal';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [postings, setPostings] = useState<FoodPosting[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [view, setView] = useState<'LOGIN' | 'DASHBOARD' | 'PROFILE' | 'SETTINGS' | 'CONTACT' | 'HELP'>('LOGIN');
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<string>('default');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [selectedPostingId, setSelectedPostingId] = useState<string | null>(null);
  const [activeChatPostingId, setActiveChatPostingId] = useState<string | null>(null);

  // Pending Verification State for Donors
  const [pendingVerificationPosting, setPendingVerificationPosting] = useState<FoodPosting | null>(null);

  // Post Donation Modal State
  const [isAddingFood, setIsAddingFood] = useState(false);
  const [donationType, setDonationType] = useState<DonationType>('FOOD');
  const [foodName, setFoodName] = useState('');
  const [foodDescription, setFoodDescription] = useState('');
  const [quantityNum, setQuantityNum] = useState('');
  const [unit, setUnit] = useState('meals');
  const [expiryDate, setExpiryDate] = useState('');
  const [foodImage, setFoodImage] = useState<string | null>(null);
  const [safetyVerdict, setSafetyVerdict] = useState<{isSafe: boolean, reasoning: string} | undefined>(undefined);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Image Editing State
  const [isEditingImage, setIsEditingImage] = useState(false);
  const [imageEditPrompt, setImageEditPrompt] = useState('');
  const [isImageProcessing, setIsImageProcessing] = useState(false);

  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [recordingMimeType, setRecordingMimeType] = useState<string>('audio/webm');

  // Post Food - Address State
  const [foodLine1, setFoodLine1] = useState('');
  const [foodLine2, setFoodLine2] = useState('');
  const [foodLandmark, setFoodLandmark] = useState('');
  const [foodPincode, setFoodPincode] = useState('');
  const [foodLat, setFoodLat] = useState<number | undefined>(undefined);
  const [foodLng, setFoodLng] = useState<number | undefined>(undefined);
  const [isFoodAutoDetecting, setIsFoodAutoDetecting] = useState(false);

  // Camera State
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tags Options
  const foodTagsOptions = ['Veg', 'Non-Veg', 'Home-cooked', 'Packaged', 'No Dairy', 'No Nuts'];
  const clothesTagsOptions = ['Men', 'Women', 'Kids', 'Unisex', 'Winter', 'Summer', 'Bedding', 'Mixed'];

  // Auth Persistence
  useEffect(() => {
    if (auth) {
        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            if (firebaseUser) {
                // Link Firebase User to Local Storage User
                const storedUsers = storage.getUsers();
                let matchedUser = storedUsers.find(u => u.id === firebaseUser.uid);
                if (!matchedUser && firebaseUser.email) {
                    matchedUser = storedUsers.find(u => u.email === firebaseUser.email);
                }
                if (!matchedUser && firebaseUser.phoneNumber) {
                     const fPhone = firebaseUser.phoneNumber.replace(/\D/g, '');
                     matchedUser = storedUsers.find(u => {
                         const uPhone = (u.contactNo || '').replace(/\D/g, '');
                         return uPhone && fPhone.includes(uPhone);
                     });
                }
                if (matchedUser && !user) {
                    setUser(matchedUser);
                    setView('DASHBOARD');
                }
            }
        });
        return () => unsubscribe();
    }
  }, [user]);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    setPostings(storage.getPostings());
    if (user) {
        setNotifications(storage.getNotifications(user.id));
        if (user.role === UserRole.DONOR) setActiveTab('active');
        else if (user.role === UserRole.VOLUNTEER) setActiveTab('opportunities');
        else setActiveTab('browse');
    }
    const interval = setInterval(() => {
        setPostings(storage.getPostings());
        if (user) setNotifications(storage.getNotifications(user.id));
    }, 2000);

    let watchId: number;
    if (user?.role === UserRole.VOLUNTEER) {
        watchId = navigator.geolocation.watchPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords;
                setUserLocation({ lat: latitude, lng: longitude });
                const activePostings = storage.getPostings().filter(p =>
                    (p.status === FoodStatus.IN_TRANSIT ||
                     p.status === FoodStatus.PICKUP_VERIFICATION_PENDING ||
                     p.status === FoodStatus.DELIVERY_VERIFICATION_PENDING) &&
                    p.volunteerId === user.id
                );
                if (activePostings.length > 0) {
                    activePostings.forEach(p => {
                        storage.updatePosting(p.id, { volunteerLocation: { lat: latitude, lng: longitude } });
                    });
                }
            },
            (err) => console.log("Location tracking denied", err),
            { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
        );
    } else {
        navigator.geolocation.getCurrentPosition(
            (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            (err) => console.log("Location access denied", err)
        );
    }
    return () => {
        clearInterval(interval);
        if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [user]);

  // Poll for postings that require Donor Verification
  useEffect(() => {
      if (!user || user.role !== UserRole.DONOR) return;
      const checkPendingVerifications = () => {
          const currentPostings = storage.getPostings();
          const pending = currentPostings.find(p =>
              p.donorId === user.id &&
              (p.status === FoodStatus.PICKUP_VERIFICATION_PENDING || p.status === FoodStatus.DELIVERY_VERIFICATION_PENDING)
          );
          if (pending) {
               if (!pendingVerificationPosting || pendingVerificationPosting.id !== pending.id || pendingVerificationPosting.status !== pending.status) {
                   setPendingVerificationPosting(pending);
               }
          } else {
               if (pendingVerificationPosting) {
                   setPendingVerificationPosting(null);
               }
          }
      };
      checkPendingVerifications();
      const interval = setInterval(checkPendingVerifications, 2000);
      return () => clearInterval(interval);
  }, [user, pendingVerificationPosting]);

  useEffect(() => {
    if (!isAddingFood) stopCamera();
  }, [isAddingFood]);

  useEffect(() => {
    if (isAddingFood) {
        if (user?.address) {
            setFoodLine1(user.address.line1 || '');
            setFoodLine2(user.address.line2 || '');
            setFoodLandmark(user.address.landmark || '');
            setFoodPincode(user.address.pincode || '');
            setFoodLat(user.address.lat);
            setFoodLng(user.address.lng);
        } else {
            setFoodLine1('');
            setFoodLine2('');
            setFoodLandmark('');
            setFoodPincode('');
            setFoodLat(userLocation?.lat);
            setFoodLng(userLocation?.lng);
        }
        // Default to Food, but allow user to change
        setDonationType('FOOD');
        setUnit('meals');
        setSafetyVerdict(undefined);
        setSelectedTags([]);
        setImageEditPrompt('');
        setIsEditingImage(false);
        setShowPaymentModal(false);
        setIsProcessingPayment(false);
    }
  }, [isAddingFood, user]);

  const filteredPostings = useMemo(() => {
    if (!user) return [];
    let filtered = [...postings];
    if (user.role === UserRole.DONOR) {
        if (activeTab === 'active') return filtered.filter(p => p.donorId === user.id && p.status !== FoodStatus.DELIVERED);
        else if (activeTab === 'history') return filtered.filter(p => p.donorId === user.id && p.status === FoodStatus.DELIVERED);
    } else if (user.role === UserRole.VOLUNTEER) {
        if (activeTab === 'opportunities') {
            let opportunities = filtered.filter(p => (p.status === FoodStatus.AVAILABLE || (p.status === FoodStatus.REQUESTED && !p.volunteerId)));

            // Apply Type Filter
            if (user.donationTypeFilter && user.donationTypeFilter !== 'ALL') {
                 opportunities = opportunities.filter(p => (p.donationType || 'FOOD') === user.donationTypeFilter);
            }

            // Apply Search Radius Filter
            const radius = user.searchRadius || 10;
            if (userLocation) {
                opportunities = opportunities.filter(p => {
                    if (p.location.lat && p.location.lng) {
                        const dist = calculateDistance(userLocation.lat, userLocation.lng, p.location.lat, p.location.lng);
                        return dist <= radius;
                    }
                    return true;
                });
            }
            return opportunities;
        }
        else if (activeTab === 'mytasks') return filtered.filter(p => p.volunteerId === user.id && p.status !== FoodStatus.DELIVERED);
        else if (activeTab === 'history') return filtered.filter(p => p.volunteerId === user.id && p.status === FoodStatus.DELIVERED);
    } else if (user.role === UserRole.REQUESTER) {
        if (activeTab === 'browse') {
            let available = filtered.filter(p => p.status === FoodStatus.AVAILABLE);

            // Apply Type Filter
            if (user.donationTypeFilter && user.donationTypeFilter !== 'ALL') {
                 available = available.filter(p => (p.donationType || 'FOOD') === user.donationTypeFilter);
            }

            // Apply Search Radius Filter
            const radius = user.searchRadius || 10;
            if (userLocation) {
                available = available.filter(p => {
                    if (p.location.lat && p.location.lng) {
                        const dist = calculateDistance(userLocation.lat, userLocation.lng, p.location.lat, p.location.lng);
                        return dist <= radius;
                    }
                    return true;
                });
            }
            return available;
        } else if (activeTab === 'myrequests') return filtered.filter(p => p.orphanageId === user.id);
    }
    return [];
  }, [postings, user, activeTab, userLocation]);

  const startCamera = async () => {
    setIsCameraOpen(true);
    setFoodImage(null);
    setSafetyVerdict(undefined);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      alert("Unable to access camera. Please ensure permissions are granted.");
      setIsCameraOpen(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = async () => {
    if (videoRef.current && canvasRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const MAX_WIDTH = 800;
        const scale = video.videoWidth > MAX_WIDTH ? MAX_WIDTH / video.videoWidth : 1;
        canvas.width = video.videoWidth * scale;
        canvas.height = video.videoHeight * scale;

        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const base64 = canvas.toDataURL('image/jpeg', 0.8);
            stopCamera();
            processImage(base64);
        }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const img = new Image();
        img.onload = async () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 800;
            const scale = img.width > MAX_WIDTH ? MAX_WIDTH / img.width : 1;
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
            const base64 = canvas.toDataURL('image/jpeg', 0.8);
            processImage(base64);
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const processImage = async (base64: string) => {
      setFoodImage(base64);
      setIsAnalyzing(true);
      setSafetyVerdict(undefined);

      let analysis;
      if (donationType === 'CLOTHES') {
          analysis = await analyzeClothesImage(base64);
      } else {
          analysis = await analyzeFoodSafetyImage(base64);
      }

      setIsAnalyzing(false);
      setSafetyVerdict({ isSafe: analysis.isSafe, reasoning: analysis.reasoning });

      // Auto-fill title if empty and analysis provided a guess
      if (!foodName && analysis.detectedFoodName && analysis.detectedFoodName !== "Food Donation" && analysis.detectedFoodName !== "Clothes Donation") {
          setFoodName(analysis.detectedFoodName);
      }

      if (!analysis.isSafe) {
          const keep = window.confirm(`Safety Warning: ${analysis.reasoning}.\n\nDo you want to keep this photo anyway?`);
          if (!keep) {
              setFoodImage(null);
              setSafetyVerdict(undefined);
              if(fileInputRef.current) fileInputRef.current.value = '';
          }
      }
  };

  const handleImageEdit = async () => {
      if (!foodImage || !imageEditPrompt.trim()) return;
      setIsImageProcessing(true);
      const newImage = await editImage(foodImage, imageEditPrompt);
      setIsImageProcessing(false);

      if (newImage) {
          setFoodImage(newImage);
          setIsEditingImage(false);
          setImageEditPrompt('');
          // Re-analyze safety for edited image? Optional, skipping for better UX flow
      } else {
          alert("Failed to edit image. Please try a different prompt.");
      }
  };

  const startRecording = async () => {
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          // Determine a supported mime type (prefer webm, fallback to mp4 for Safari)
          const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
          setRecordingMimeType(mimeType);

          const mediaRecorder = new MediaRecorder(stream, { mimeType });
          mediaRecorderRef.current = mediaRecorder;
          audioChunksRef.current = [];

          mediaRecorder.ondataavailable = (event) => {
              if (event.data.size > 0) {
                  audioChunksRef.current.push(event.data);
              }
          };

          mediaRecorder.onstop = async () => {
              const audioBlob = new Blob(audioChunksRef.current, { type: recordingMimeType });
              const reader = new FileReader();
              reader.readAsDataURL(audioBlob);
              reader.onloadend = async () => {
                  const base64Audio = reader.result as string;
                  const text = await transcribeAudio(base64Audio, recordingMimeType);
                  if (text) {
                      setFoodDescription(prev => prev ? `${prev} ${text}` : text);
                  }
              };
              stream.getTracks().forEach(track => track.stop());
          };

          mediaRecorder.start();
          setIsRecording(true);
      } catch (err) {
          console.error("Mic error", err);
          alert("Could not access microphone.");
      }
  };

  const stopRecording = () => {
      if (mediaRecorderRef.current && isRecording) {
          mediaRecorderRef.current.stop();
          setIsRecording(false);
      }
  };

  const handleFoodAutoDetectLocation = () => {
    if (!navigator.geolocation) {
        alert("Geolocation is not supported by your browser.");
        return;
    }
    setIsFoodAutoDetecting(true);
    navigator.geolocation.getCurrentPosition(
        async (pos) => {
            const { latitude, longitude } = pos.coords;
            setFoodLat(latitude);
            setFoodLng(longitude);
            try {
                const address = await reverseGeocodeGoogle(latitude, longitude);
                if (address) {
                    setFoodLine1(address.line1);
                    setFoodLine2(address.line2);
                    setFoodLandmark(address.landmark || '');
                    setFoodPincode(address.pincode);
                } else {
                    alert("Could not detect detailed address. Please check map pin.");
                }
            } catch (e) {
                console.error(e);
            } finally {
                setIsFoodAutoDetecting(false);
            }
        },
        (err) => {
            console.error(err);
            alert("Location permission denied. Please use the map to pick location.");
            setIsFoodAutoDetecting(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleRateVolunteer = (postingId: string, ratingValue: number, feedback: string) => {
     if (!user) return;
     const rating: Rating = {
         raterId: user.id,
         raterRole: user.role,
         rating: ratingValue,
         feedback,
         createdAt: Date.now()
     };
     storage.addVolunteerRating(postingId, rating);
     setPostings(storage.getPostings());
     alert("Thank you for your feedback!");
  };

  const handleRefresh = () => {
    setPostings(storage.getPostings());
    if (user) setNotifications(storage.getNotifications(user.id));
  };

  const handleDeletePosting = (id: string) => {
      storage.deletePosting(id);
      handleRefresh();
  };

  const toggleTag = (tag: string) => {
      if (selectedTags.includes(tag)) {
          setSelectedTags(selectedTags.filter(t => t !== tag));
      } else {
          setSelectedTags([...selectedTags, tag]);
      }
  };

  const handleInitiatePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!foodImage) { alert("Please take a photo of the item."); return; }
    if (!foodLine1 || !foodLine2 || !foodPincode) { alert("Please enter a valid pickup address."); return; }

    setIsProcessingPayment(true);
    // Show Payment Modal instead of direct processing
    setShowPaymentModal(true);
  };

  const handlePaymentSuccess = () => {
    if (!user) return;

    const newPost: FoodPosting = {
        id: Math.random().toString(36).substr(2, 9),
        donationType: donationType, // Save type
        donorId: user.id,
        donorName: user?.name || 'Unknown Donor',
        donorOrg: user.orgName,
        foodName,
        description: foodDescription,
        quantity: `${quantityNum} ${unit}`,
        location: {
            line1: foodLine1,
            line2: foodLine2,
            landmark: foodLandmark,
            pincode: foodPincode,
            lat: foodLat || userLocation?.lat,
            lng: foodLng || userLocation?.lng
        },
        expiryDate,
        status: FoodStatus.AVAILABLE,
        imageUrl: foodImage,
        safetyVerdict,
        foodTags: selectedTags,
        createdAt: Date.now(),
        platformFeePaid: true
    };

    storage.savePosting(newPost);
    setPostings(storage.getPostings());

    // Reset Form
    setFoodName(''); setFoodDescription(''); setQuantityNum(''); setFoodImage(null); setSafetyVerdict(undefined);
    setExpiryDate(''); setFoodLine1(''); setFoodLine2(''); setFoodLandmark(''); setFoodPincode(''); setSelectedTags([]);
    setFoodLat(undefined); setFoodLng(undefined);
    // Note: donationType is kept as is for consecutive same-type donations

    setShowPaymentModal(false);
    setIsProcessingPayment(false);
    setIsAddingFood(false);
  };

  const handleDonorApprove = () => {
      if (pendingVerificationPosting) {
          if (pendingVerificationPosting.status === FoodStatus.PICKUP_VERIFICATION_PENDING) {
             storage.updatePosting(pendingVerificationPosting.id, { status: FoodStatus.IN_TRANSIT });
          } else if (pendingVerificationPosting.status === FoodStatus.DELIVERY_VERIFICATION_PENDING) {
             storage.updatePosting(pendingVerificationPosting.id, { status: FoodStatus.DELIVERED });
          }
          setPendingVerificationPosting(null);
          handleRefresh();
      }
  };

  const handleDonorReject = () => {
      if (pendingVerificationPosting) {
          if (pendingVerificationPosting.status === FoodStatus.PICKUP_VERIFICATION_PENDING) {
              storage.updatePosting(pendingVerificationPosting.id, {
                  status: FoodStatus.REQUESTED,
                  pickupVerificationImageUrl: undefined,
                  volunteerId: undefined,
                  volunteerName: undefined
              });
              alert("Pickup Verification Rejected. The volunteer has been notified.");
          } else if (pendingVerificationPosting.status === FoodStatus.DELIVERY_VERIFICATION_PENDING) {
              storage.updatePosting(pendingVerificationPosting.id, {
                  status: FoodStatus.IN_TRANSIT,
                  verificationImageUrl: undefined
              });
              alert("Delivery Verification Rejected. The requester has been notified.");
          }
          setPendingVerificationPosting(null);
          handleRefresh();
      }
  };

  const handleDeleteAccount = () => {
      if (user) {
          storage.deleteUser(user.id);
          if (auth) signOut(auth);
          setUser(null);
          setView('LOGIN');
      }
  };

  // --- RENDER HELPERS ---
  const renderStatsCard = (label: string, value: string | number, icon: string, colorClass: string) => (
    <div className={`p-5 rounded-[2rem] bg-white border border-slate-100 shadow-sm flex items-center gap-4 transition-transform hover:scale-105 flex-1 md:flex-none min-w-[150px] ${colorClass}`}>
        <div className="w-12 h-12 rounded-2xl bg-white/40 flex items-center justify-center text-2xl shadow-sm backdrop-blur-sm shrink-0">
            {icon}
        </div>
        <div className="min-w-0">
            <p className="text-[10px] font-black uppercase opacity-70 tracking-widest truncate">{label}</p>
            <p className="text-2xl font-black truncate">{value}</p>
        </div>
    </div>
  );

  const renderDashboardHeader = () => {
    if (!user) return null;
    return (
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
            <div>
                <h2 className="text-4xl font-black text-slate-800 tracking-tight leading-none mb-2">
                    Hello, <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500">{user.name?.split(' ')[0]}</span>.
                </h2>
                <p className="text-slate-500 font-medium text-lg">
                    {user.role === UserRole.DONOR && "What are we giving today? 🎁"}
                    {user.role === UserRole.VOLUNTEER && "Ready to be a hero? 🦸"}
                    {user.role === UserRole.REQUESTER && "Find help nearby. 🏠"}
                </p>
            </div>
            <div className="flex flex-wrap md:flex-nowrap gap-3 w-full md:w-auto">
                {user.role === UserRole.DONOR && (
                    <>
                        {renderStatsCard("Impact Score", user.impactScore || 0, "✨", "bg-gradient-to-br from-amber-50 to-orange-50 text-orange-900")}
                        {renderStatsCard("Donations", postings.filter(p => p.donorId === user.id).length, "📦", "bg-gradient-to-br from-emerald-50 to-teal-50 text-emerald-900")}
                    </>
                )}
                {user.role === UserRole.VOLUNTEER && (
                    <>
                         {renderStatsCard("Reputation", user.averageRating?.toFixed(1) || "5.0", "⭐", "bg-gradient-to-br from-yellow-50 to-amber-50 text-amber-900")}
                         {renderStatsCard("Missions", postings.filter(p => p.volunteerId === user.id && p.status === FoodStatus.DELIVERED).length, "🚴", "bg-gradient-to-br from-blue-50 to-indigo-50 text-indigo-900")}
                    </>
                )}
                 {user.role === UserRole.REQUESTER && (
                    <>
                         {renderStatsCard("Requests", postings.filter(p => p.orphanageId === user.id).length, "📝", "bg-gradient-to-br from-purple-50 to-pink-50 text-purple-900")}
                         {renderStatsCard("Received", postings.filter(p => p.orphanageId === user.id && p.status === FoodStatus.DELIVERED).length, "🥣", "bg-gradient-to-br from-emerald-50 to-teal-50 text-teal-900")}
                    </>
                )}
            </div>
        </div>
    );
  };

  const renderTabs = () => {
    if (!user) return null;
    const tabClass = (active: boolean) => `px-6 py-2.5 rounded-full text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${active ? 'bg-slate-900 text-white shadow-lg shadow-slate-200' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`;

    return (
        <div className="flex items-center justify-between mb-6">
            <div className="bg-white p-1.5 rounded-full border border-slate-200 shadow-sm inline-flex">
                {user.role === UserRole.DONOR && (
                    <>
                    <button onClick={() => setActiveTab('active')} className={tabClass(activeTab === 'active')}>Active</button>
                    <button onClick={() => setActiveTab('history')} className={tabClass(activeTab === 'history')}>History</button>
                    </>
                )}
                {user.role === UserRole.VOLUNTEER && (
                    <>
                    <button onClick={() => setActiveTab('opportunities')} className={tabClass(activeTab === 'opportunities')}>Find Requests</button>
                    <button onClick={() => setActiveTab('mytasks')} className={tabClass(activeTab === 'mytasks')}>My Tasks</button>
                    <button onClick={() => setActiveTab('history')} className={tabClass(activeTab === 'history')}>History</button>
                    </>
                )}
                {user.role === UserRole.REQUESTER && (
                    <>
                    <button onClick={() => setActiveTab('browse')} className={tabClass(activeTab === 'browse')}>Browse</button>
                    <button onClick={() => setActiveTab('myrequests')} className={tabClass(activeTab === 'myrequests')}>My Requests</button>
                    </>
                )}
            </div>

            {(user.role === UserRole.VOLUNTEER && activeTab === 'opportunities') || (user.role === UserRole.REQUESTER && activeTab === 'browse') ? (
                <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm ml-4">
                    <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-slate-100 text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
                    </button>
                    <button onClick={() => setViewMode('map')} className={`p-2 rounded-lg transition-colors ${viewMode === 'map' ? 'bg-emerald-100 text-emerald-700' : 'text-slate-400 hover:text-slate-600'}`}>
                         <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                    </button>
                </div>
            ) : null}
        </div>
    );
  };

  const renderContent = () => {
      if (filteredPostings.length === 0) {
          return (
            <div className="bg-white/60 backdrop-blur-sm rounded-[2.5rem] p-16 text-center border border-dashed border-slate-300 flex flex-col items-center justify-center min-h-[400px]">
                <div className="w-24 h-24 bg-gradient-to-br from-slate-100 to-white rounded-full flex items-center justify-center mb-6 shadow-inner border border-white">
                        <span className="text-4xl filter grayscale opacity-50">🍃</span>
                </div>
                <h3 className="text-2xl font-black text-slate-800 mb-3 tracking-tight">Nothing to see here... yet!</h3>
                <p className="text-slate-500 font-medium max-w-md mx-auto leading-relaxed">
                    {user?.role === UserRole.DONOR ? "Your active donations will appear here. Start by posting some food or clothes!" : "No active items found in this category. Check back soon!"}
                </p>
                {user?.role === UserRole.DONOR && activeTab === 'active' && (
                        <button onClick={() => setIsAddingFood(true)} className="mt-8 px-8 py-4 bg-emerald-600 text-white font-black rounded-2xl uppercase text-xs tracking-widest shadow-xl shadow-emerald-200/50 hover:bg-emerald-700 hover:scale-110 transition-all">
                            Donate Now
                        </button>
                )}
            </div>
          );
      }

      if (viewMode === 'map' && ((user?.role === UserRole.VOLUNTEER && activeTab === 'opportunities') || (user?.role === UserRole.REQUESTER && activeTab === 'browse'))) {
          return (
              <div className="h-[600px] w-full rounded-[2.5rem] overflow-hidden shadow-lg border border-slate-200">
                  <PostingsMap
                    postings={filteredPostings}
                    userLocation={userLocation}
                    onPostingSelect={(id) => { setSelectedPostingId(id); }}
                  />
              </div>
          );
      }

      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredPostings.map((post, idx) => (
                <div key={post.id} className="animate-fade-in-up" style={{ animationDelay: `${idx * 100}ms` }}>
                    <FoodCard
                        posting={post}
                        user={user!}
                        onUpdate={(id, updates) => { storage.updatePosting(id, updates); handleRefresh(); }}
                        onDelete={handleDeletePosting}
                        currentLocation={userLocation}
                        onRateVolunteer={handleRateVolunteer}
                        onChatClick={(id) => setActiveChatPostingId(id)}
                        volunteerProfile={post.volunteerId ? storage.getUser(post.volunteerId) : undefined}
                        requesterProfile={post.orphanageId ? storage.getUser(post.orphanageId) : undefined}
                    />
                </div>
            ))}
        </div>
      );
  };

  if (showSplash) return <SplashScreen />;
  if (!user || view === 'LOGIN') return <LoginPage onLogin={(user) => { setUser(user); setView('DASHBOARD'); }} />;
  if (view === 'PROFILE' && user) return <Layout user={user} onLogout={() => { if (auth) signOut(auth); setUser(null); setView('LOGIN'); }} onProfileClick={() => {}} onLogoClick={() => setView('DASHBOARD')} onContactClick={() => setView('CONTACT')} onHelpClick={() => setView('HELP')} onSettingsClick={() => setView('SETTINGS')} notifications={notifications}><ProfileView user={user} onUpdate={(updates) => { storage.updateUser(user.id, updates); setUser({ ...user, ...updates }); }} onBack={() => setView('DASHBOARD')} /></Layout>;
  if (view === 'SETTINGS' && user) return <Layout user={user} onLogout={() => { if (auth) signOut(auth); setUser(null); setView('LOGIN'); }} onProfileClick={() => setView('PROFILE')} onLogoClick={() => setView('DASHBOARD')} onContactClick={() => setView('CONTACT')} onHelpClick={() => setView('HELP')} onSettingsClick={() => {}} notifications={notifications}><SettingsView user={user} onUpdate={(updates) => { storage.updateUser(user.id, updates); setUser({ ...user, ...updates }); }} onDelete={handleDeleteAccount} onBack={() => setView('DASHBOARD')} /></Layout>;
  if (view === 'CONTACT' && user) return <Layout user={user} onLogout={() => { if (auth) signOut(auth); setUser(null); setView('LOGIN'); }} onProfileClick={() => setView('PROFILE')} onLogoClick={() => setView('DASHBOARD')} onContactClick={() => {}} onHelpClick={() => setView('HELP')} onSettingsClick={() => setView('SETTINGS')} notifications={notifications}><ContactUs user={user} onBack={() => setView('DASHBOARD')} /></Layout>;
  if (view === 'HELP' && user) return <Layout user={user} onLogout={() => { if (auth) signOut(auth); setUser(null); setView('LOGIN'); }} onProfileClick={() => setView('PROFILE')} onLogoClick={() => setView('DASHBOARD')} onContactClick={() => setView('CONTACT')} onHelpClick={() => {}} onSettingsClick={() => setView('SETTINGS')} notifications={notifications}><HelpFAQ onBack={() => setView('DASHBOARD')} onContact={() => setView('CONTACT')} /></Layout>;

  return (
    <Layout
        user={user}
        onLogout={() => { if (auth) signOut(auth); setUser(null); setView('LOGIN'); }}
        onProfileClick={() => setView('PROFILE')}
        onLogoClick={() => setView('DASHBOARD')}
        onContactClick={() => setView('CONTACT')}
        onHelpClick={() => setView('HELP')}
        onSettingsClick={() => setView('SETTINGS')}
        notifications={notifications}
    >
        {user && (
            <div className="space-y-4 animate-fade-in-up">
                {renderDashboardHeader()}
                {renderTabs()}
                {renderContent()}
            </div>
        )}

        {user?.role === UserRole.DONOR && !isAddingFood && (
            <button
                onClick={() => setIsAddingFood(true)}
                className="fixed bottom-10 right-10 w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-full shadow-[0_20px_40px_-10px_rgba(16,185,129,0.5)] flex items-center justify-center transition-all hover:scale-110 active:scale-95 z-40 group hover:rotate-90 border-4 border-white"
            >
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
            </button>
        )}

        {/* Post Donation Modal */}
        {isAddingFood && (
            <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
                <div className={`bg-white rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl relative animate-fade-in-up my-auto border-t-8 ${donationType === 'CLOTHES' ? 'border-indigo-500' : 'border-emerald-500'}`}>
                    <div className="bg-white/80 backdrop-blur-xl p-6 flex justify-between items-center sticky top-0 z-50 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${donationType === 'CLOTHES' ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                {donationType === 'CLOTHES' ? '👕' : '🍱'}
                            </div>
                            <h3 className="font-black text-lg uppercase tracking-wider text-slate-800">New Donation</h3>
                        </div>
                        <button onClick={() => setIsAddingFood(false)} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full transition-colors">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>

                    <form onSubmit={handleInitiatePayment} className="p-8 space-y-8 max-h-[80vh] overflow-y-auto custom-scrollbar">

                        {/* Donation Type Toggle */}
                        <div className="bg-slate-50 p-1.5 rounded-2xl flex border border-slate-100">
                            <button
                                type="button"
                                onClick={() => { setDonationType('FOOD'); setUnit('meals'); setSelectedTags([]); }}
                                className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${donationType === 'FOOD' ? 'bg-white text-emerald-700 shadow-md ring-1 ring-emerald-100' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                🍱 Food
                            </button>
                            <button
                                type="button"
                                onClick={() => { setDonationType('CLOTHES'); setUnit('items'); setSelectedTags([]); }}
                                className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${donationType === 'CLOTHES' ? 'bg-white text-indigo-700 shadow-md ring-1 ring-indigo-100' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                👕 Clothes
                            </button>
                        </div>

                        {/* Image Capture Section */}
                        <div className="space-y-4">
                            <label className="text-xs font-black uppercase text-slate-400 tracking-widest block">
                                {donationType === 'CLOTHES' ? 'Clothes Quality Check' : 'Food Safety Check'}
                            </label>

                            {!isCameraOpen && !foodImage && (
                                <div className="grid grid-cols-2 gap-4">
                                    <button type="button" onClick={startCamera} className={`h-40 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center text-slate-400 transition-all group ${donationType === 'CLOTHES' ? 'hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600' : 'hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-600'}`}>
                                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm mb-3 group-hover:scale-110 transition-transform">
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                        </div>
                                        <span className="text-xs font-bold uppercase tracking-wide">Take Photo</span>
                                    </button>
                                    <button type="button" onClick={() => fileInputRef.current?.click()} className={`h-40 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center text-slate-400 transition-all group ${donationType === 'CLOTHES' ? 'hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600' : 'hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-600'}`}>
                                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm mb-3 group-hover:scale-110 transition-transform">
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                        </div>
                                        <span className="text-xs font-bold uppercase tracking-wide">Upload Image</span>
                                    </button>
                                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
                                </div>
                            )}

                            {isCameraOpen && (
                                <div className="relative rounded-3xl overflow-hidden bg-black aspect-video shadow-2xl">
                                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                                    <div className="absolute bottom-6 inset-x-0 flex justify-center gap-6">
                                        <button type="button" onClick={stopCamera} className="px-6 py-3 bg-white/20 backdrop-blur-md rounded-full text-white font-bold text-xs uppercase tracking-wider hover:bg-white/30 border border-white/20">Cancel</button>
                                        <button type="button" onClick={capturePhoto} className="w-16 h-16 bg-white rounded-full border-4 border-slate-200 shadow-lg flex items-center justify-center hover:scale-105 transition-transform">
                                            <div className="w-12 h-12 bg-rose-500 rounded-full"></div>
                                        </button>
                                    </div>
                                    <canvas ref={canvasRef} className="hidden" />
                                </div>
                            )}

                            {foodImage && (
                                <div className="relative rounded-3xl overflow-hidden bg-slate-100 border border-slate-200 group">
                                    <img src={foodImage} alt="Donation" className="w-full h-64 object-cover" />

                                    <div className="absolute top-4 right-4 flex gap-2">
                                        {/* Edit Button */}
                                        <button type="button" onClick={() => setIsEditingImage(!isEditingImage)} className="bg-white/80 text-blue-600 p-2 rounded-full hover:bg-white transition-colors backdrop-blur-sm shadow-sm opacity-0 group-hover:opacity-100" title="Edit with AI">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                        </button>
                                        <button type="button" onClick={() => { setFoodImage(null); setSafetyVerdict(undefined); }} className="bg-white/80 text-rose-500 p-2 rounded-full hover:bg-white transition-colors backdrop-blur-sm shadow-sm opacity-0 group-hover:opacity-100">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    </div>

                                    {/* AI Edit UI */}
                                    {isEditingImage && (
                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white/90 backdrop-blur-xl p-4 rounded-2xl shadow-xl w-3/4 animate-fade-in-up">
                                            <p className="text-xs font-black text-slate-500 uppercase tracking-wide mb-2">AI Magic Edit</p>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={imageEditPrompt}
                                                    onChange={(e) => setImageEditPrompt(e.target.value)}
                                                    placeholder="E.g., 'Make it brighter'"
                                                    className="flex-1 px-3 py-2 rounded-xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleImageEdit}
                                                    disabled={isImageProcessing || !imageEditPrompt}
                                                    className="bg-blue-600 text-white p-2 rounded-xl disabled:opacity-50"
                                                >
                                                    {isImageProcessing ? <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* AI Analysis Result Overlay */}
                                    {!isEditingImage && (
                                    <div className="absolute bottom-0 inset-x-0 bg-white/95 backdrop-blur-md p-4 border-t border-slate-100">
                                        {isAnalyzing ? (
                                            <div className="flex items-center gap-3 text-slate-600">
                                                <svg className="animate-spin h-5 w-5 text-emerald-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                                <span className="text-xs font-bold uppercase tracking-wide">Analyzing with Gemini AI...</span>
                                            </div>
                                        ) : safetyVerdict ? (
                                            <div className={`flex items-start gap-3 ${safetyVerdict.isSafe ? 'text-emerald-800' : 'text-rose-800'}`}>
                                                <div className={`p-2 rounded-full shrink-0 ${safetyVerdict.isSafe ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                                    {safetyVerdict.isSafe ? (
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                                                    ) : (
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="text-xs font-black uppercase tracking-wide mb-1">{safetyVerdict.isSafe ? 'Looks Good!' : 'Warning'}</p>
                                                    <p className="text-sm font-medium leading-snug">{safetyVerdict.reasoning}</p>
                                                </div>
                                            </div>
                                        ) : null}
                                    </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Details Inputs */}
                        <div className="space-y-4">
                            <label className="text-xs font-black uppercase text-slate-400 tracking-widest block">Item Details</label>
                            <input type="text" placeholder={donationType === 'CLOTHES' ? "e.g. Winter Jackets" : "e.g. Rice & Curry"} className="w-full px-5 py-4 border border-slate-200 bg-slate-50/50 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 transition-all" value={foodName} onChange={e => setFoodName(e.target.value)} required />

                            <div className="relative">
                                <textarea placeholder="Description (size, condition, ingredients...)" className="w-full px-5 py-4 border border-slate-200 bg-slate-50/50 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 transition-all h-28 resize-none" value={foodDescription} onChange={e => setFoodDescription(e.target.value)} />
                                <button
                                    type="button"
                                    onClick={isRecording ? stopRecording : startRecording}
                                    className={`absolute bottom-3 right-3 p-2 rounded-full transition-all ${isRecording ? 'bg-rose-500 text-white animate-pulse' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'}`}
                                    title="Speak Description"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                                </button>
                            </div>

                            <div className="flex gap-4">
                                <input type="number" placeholder="Qty" className="flex-1 px-5 py-4 border border-slate-200 bg-slate-50/50 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 transition-all" value={quantityNum} onChange={e => setQuantityNum(e.target.value)} required />
                                <select className="w-32 px-5 py-4 border border-slate-200 bg-slate-50/50 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 transition-all" value={unit} onChange={e => setUnit(e.target.value)}>
                                    {donationType === 'FOOD' ? (
                                        <>
                                            <option value="meals">Meals</option>
                                            <option value="kg">kg</option>
                                            <option value="items">Items</option>
                                        </>
                                    ) : (
                                        <>
                                            <option value="items">Items</option>
                                            <option value="bags">Bags</option>
                                            <option value="boxes">Boxes</option>
                                            <option value="sets">Sets</option>
                                        </>
                                    )}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <p className="text-xs font-bold text-slate-500 uppercase ml-1">{donationType === 'CLOTHES' ? 'Pickup Deadline' : 'Expires In'}</p>
                                <input type="datetime-local" className="w-full px-5 py-4 border border-slate-200 bg-slate-50/50 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 transition-all" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} required />
                            </div>

                            <div className="flex flex-wrap gap-2 pt-2">
                                {(donationType === 'CLOTHES' ? clothesTagsOptions : foodTagsOptions).map(tag => (
                                    <button
                                        key={tag}
                                        type="button"
                                        onClick={() => toggleTag(tag)}
                                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${selectedTags.includes(tag) ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                                    >
                                        {tag}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Location Section */}
                        <div className="space-y-4 pt-6 border-t border-slate-100">
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-xs font-black uppercase text-slate-400 tracking-widest block">Pickup Location</label>
                                <button type="button" onClick={handleFoodAutoDetectLocation} className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors">
                                    {isFoodAutoDetecting ? 'Detecting...' : 'Detect Current Location'}
                                </button>
                            </div>

                            {/* Location Picker Map */}
                            <LocationPickerMap
                                lat={foodLat}
                                lng={foodLng}
                                onLocationSelect={(lat, lng) => {
                                    setFoodLat(lat);
                                    setFoodLng(lng);
                                }}
                                onAddressFound={(addr) => {
                                    setFoodLine1(addr.line1);
                                    setFoodLine2(addr.line2);
                                    setFoodLandmark(addr.landmark || '');
                                    setFoodPincode(addr.pincode);
                                }}
                            />

                            <input type="text" placeholder="Line 1" className="w-full px-5 py-4 border border-slate-200 bg-slate-50/50 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 transition-all" value={foodLine1} onChange={e => setFoodLine1(e.target.value)} required />
                            <input type="text" placeholder="Line 2" className="w-full px-5 py-4 border border-slate-200 bg-slate-50/50 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 transition-all" value={foodLine2} onChange={e => setFoodLine2(e.target.value)} required />

                            <div className="flex gap-4">
                                <input type="text" placeholder="Landmark" className="flex-1 px-5 py-4 border border-slate-200 bg-slate-50/50 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 transition-all" value={foodLandmark} onChange={e => setFoodLandmark(e.target.value)} />
                                <input
                                    type="text"
                                    placeholder="Pincode (6 digits)"
                                    maxLength={6}
                                    pattern="\d{6}"
                                    inputMode="numeric"
                                    title="Please enter a valid 6-digit Pincode"
                                    className="w-40 px-5 py-4 border border-slate-200 bg-slate-50/50 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 transition-all"
                                    value={foodPincode}
                                    onChange={e => setFoodPincode(e.target.value.replace(/\D/g, ''))}
                                    required
                                />
                            </div>
                        </div>

                        {/* Platform Fee Notice */}
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                </div>
                                <div>
                                    <p className="text-xs font-black text-slate-700 uppercase tracking-wide">Platform Fee</p>
                                    <p className="text-[10px] text-slate-400 font-bold">Standard listing charge</p>
                                </div>
                            </div>
                            <div className="text-xl font-black text-slate-800 tracking-tight">₹5</div>
                        </div>

                        <button
                            type="submit"
                            disabled={isProcessingPayment}
                            className={`w-full text-white font-black py-5 rounded-2xl uppercase tracking-widest text-xs shadow-xl shadow-slate-200 transform hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-3 ${donationType === 'CLOTHES' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-slate-900 hover:bg-slate-800'}`}
                        >
                            {isProcessingPayment ? (
                                <>
                                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Processing...
                                </>
                            ) : (
                                'Pay ₹5 & Post Donation'
                            )}
                        </button>
                    </form>
                </div>
            </div>
        )}

        {/* Global Modal for Donor Verification Request */}
        {pendingVerificationPosting && (
            <VerificationRequestModal
                posting={pendingVerificationPosting}
                onApprove={handleDonorApprove}
                onReject={handleDonorReject}
            />
        )}

        {/* Selected Posting Detail Modal (from Map View) */}
        {selectedPostingId && (
            <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in-up" onClick={() => setSelectedPostingId(null)}>
                <div className="w-full max-w-md max-h-[90vh] overflow-y-auto custom-scrollbar bg-transparent" onClick={e => e.stopPropagation()}>
                    {(() => {
                        const p = postings.find(p => p.id === selectedPostingId);
                        if (!p) return null;
                        return (
                            <div className="relative">
                                <button onClick={() => setSelectedPostingId(null)} className="absolute top-4 right-4 z-50 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full backdrop-blur-md transition-colors shadow-lg border border-white/10">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                                <FoodCard
                                    posting={p}
                                    user={user!}
                                    onUpdate={(id, updates) => { storage.updatePosting(id, updates); handleRefresh(); }}
                                    currentLocation={userLocation}
                                    onRateVolunteer={handleRateVolunteer}
                                    onChatClick={(id) => setActiveChatPostingId(id)}
                                    volunteerProfile={p.volunteerId ? storage.getUser(p.volunteerId) : undefined}
                                    requesterProfile={p.orphanageId ? storage.getUser(p.orphanageId) : undefined}
                                />
                            </div>
                        );
                    })()}
                </div>
            </div>
        )}

        {/* Chat Modal */}
        {activeChatPostingId && (
            <ChatModal
                posting={postings.find(p => p.id === activeChatPostingId)!}
                user={user!}
                onClose={() => setActiveChatPostingId(null)}
            />
        )}

        {/* Payment Modal */}
        {showPaymentModal && (
            <PaymentModal
                amount={5}
                onSuccess={handlePaymentSuccess}
                onCancel={() => { setShowPaymentModal(false); setIsProcessingPayment(false); }}
            />
        )}
    </Layout>
  );
}

