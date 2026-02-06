
import React, { useState, useEffect, useRef } from 'react';
import { User, DonationType, FoodStatus, FoodPosting } from '../types';
import { storage } from '../services/storageService';
import { analyzeFoodSafetyImage, analyzeClothesImage, editImage, transcribeAudio } from '../services/geminiService';
import { reverseGeocodeGoogle } from '../services/mapLoader';
import LocationPickerMap from './LocationPickerMap';
import PaymentModal from './PaymentModal';
import { getTranslation } from '../services/translations';

interface AddDonationViewProps {
  user: User;
  initialType?: DonationType;
  onBack: () => void;
  onSuccess: (posting?: FoodPosting) => void;
}

const STEPS = ['TYPE', 'PHOTO', 'DETAILS', 'LOCATION'];

const AddDonationView: React.FC<AddDonationViewProps> = ({ user, initialType = 'FOOD', onBack, onSuccess }) => {
  const [currentStep, setCurrentStep] = useState(0);
  
  // Form State
  const [donationType, setDonationType] = useState<DonationType>(initialType);
  const [foodName, setFoodName] = useState('');
  const [foodDescription, setFoodDescription] = useState('');
  const [quantityNum, setQuantityNum] = useState('');
  const [unit, setUnit] = useState(initialType === 'FOOD' ? 'meals' : 'items');
  const [expiryDate, setExpiryDate] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  
  // Media State
  const [foodImage, setFoodImage] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [safetyVerdict, setSafetyVerdict] = useState<{isSafe: boolean, reasoning: string} | undefined>(undefined);
  const [aiAutofilled, setAiAutofilled] = useState(false);
  
  // Audio State
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Location State
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [landmark, setLandmark] = useState('');
  const [pincode, setPincode] = useState('');
  const [lat, setLat] = useState<number | undefined>(undefined);
  const [lng, setLng] = useState<number | undefined>(undefined);
  const [isAutoDetecting, setIsAutoDetecting] = useState(false);

  // Payment & Upload State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const t = (key: string) => getTranslation(key, user.language);

  // Initial Address Population
  useEffect(() => {
    if (user.address) {
        setLine1(user.address.line1 || '');
        setLine2(user.address.line2 || '');
        setLandmark(user.address.landmark || '');
        setPincode(user.address.pincode || '');
        setLat(user.address.lat);
        setLng(user.address.lng);
    } else {
        navigator.geolocation.getCurrentPosition(pos => {
            setLat(pos.coords.latitude);
            setLng(pos.coords.longitude);
        }, () => {});
    }
  }, [user]);

  // Clean up camera on unmount
  useEffect(() => {
      return () => stopCamera();
  }, []);

  const handleTypeChange = (type: DonationType) => {
      setDonationType(type);
      setUnit(type === 'FOOD' ? 'meals' : 'items');
      if (foodImage) processImage(foodImage, type);
      setCurrentStep(1); // Auto advance
  };

  // --- Helpers for Quick Expiry ---
  const setQuickExpiry = (hours: number) => {
      const date = new Date();
      date.setHours(date.getHours() + hours);
      // Format: YYYY-MM-DDTHH:mm
      const localIso = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
      setExpiryDate(localIso);
  };

  // --- Camera & Image Logic ---
  const startCamera = async () => { 
      setIsCameraOpen(true); 
      setFoodImage(null); 
      setSafetyVerdict(undefined); 
      try { 
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }); 
          if (videoRef.current) { videoRef.current.srcObject = stream; } 
      } catch (err) { 
          alert("Unable to access camera."); 
          setIsCameraOpen(false); 
      } 
  };

  const stopCamera = () => { 
      if (videoRef.current && videoRef.current.srcObject) { 
          (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop()); 
          videoRef.current.srcObject = null; 
      } 
      setIsCameraOpen(false); 
  };

  const capturePhoto = async () => { 
      if (videoRef.current && canvasRef.current) { 
          const v = videoRef.current; 
          const c = canvasRef.current; 
          const s = v.videoWidth > 800 ? 800/v.videoWidth : 1; 
          c.width = v.videoWidth * s; 
          c.height = v.videoHeight * s; 
          c.getContext('2d')?.drawImage(v, 0, 0, c.width, c.height); 
          const b64 = c.toDataURL('image/jpeg', 0.8); 
          stopCamera(); 
          processImage(b64, donationType); 
      } 
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => { 
      const f = e.target.files?.[0]; 
      if (f) { 
          const r = new FileReader(); 
          r.onloadend = () => { 
              const i = new Image(); 
              i.onload = () => { 
                  const c = document.createElement('canvas'); 
                  const s = i.width > 800 ? 800/i.width : 1; 
                  c.width = i.width * s; 
                  c.height = i.height * s; 
                  c.getContext('2d')?.drawImage(i, 0, 0, c.width, c.height); 
                  processImage(c.toDataURL('image/jpeg', 0.8), donationType); 
              }; 
              i.src = r.result as string; 
          }; 
          r.readAsDataURL(f); 
      } 
  };

  const processImage = async (base64: string, type: DonationType) => {
      setFoodImage(base64);
      setIsAnalyzing(true);
      setSafetyVerdict(undefined);
      setAiAutofilled(false);
      
      try {
          let analysis;
          if (type === 'CLOTHES') analysis = await analyzeClothesImage(base64);
          else analysis = await analyzeFoodSafetyImage(base64);
          
          setSafetyVerdict({ isSafe: analysis.isSafe, reasoning: analysis.reasoning });
          
          // Smart Auto-Fill
          if (analysis.detectedFoodName && !analysis.detectedFoodName.includes("Donation")) {
              setFoodName(analysis.detectedFoodName);
              setFoodDescription(analysis.reasoning); // Use reasoning as initial description
              setAiAutofilled(true);
              setTimeout(() => setAiAutofilled(false), 3000); // Hide animation
          }
      } catch (error) {
          console.error("Analysis failed", error);
      } finally {
          setIsAnalyzing(false);
      }
  };

  // --- Audio Logic ---
  const startRecording = async () => { 
      try { 
          const s = await navigator.mediaDevices.getUserMedia({ audio: true }); 
          const mt = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'; 
          const mr = new MediaRecorder(s, { mimeType: mt }); 
          mediaRecorderRef.current = mr; 
          audioChunksRef.current = []; 
          mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); }; 
          mr.onstop = async () => { 
              const b = new Blob(audioChunksRef.current, { type: mt }); 
              const r = new FileReader(); 
              r.readAsDataURL(b); 
              r.onloadend = async () => { 
                  const t = await transcribeAudio(r.result as string, mt); 
                  if (t) setFoodDescription(p => p ? `${p} ${t}` : t); 
              }; 
              s.getTracks().forEach(t => t.stop()); 
          }; 
          mr.start(); 
          setIsRecording(true); 
      } catch (e) { alert("Mic error."); } 
  };

  const stopRecording = () => { 
      if (mediaRecorderRef.current && isRecording) { 
          mediaRecorderRef.current.stop(); 
          setIsRecording(false); 
      } 
  };

  // --- Location Logic ---
  const handleAutoDetectLocation = () => {
    if (!navigator.geolocation) { alert("Geolocation not supported."); return; }
    setIsAutoDetecting(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
        const { latitude, longitude } = pos.coords;
        setLat(latitude); setLng(longitude);
        try { 
            const a = await reverseGeocodeGoogle(latitude, longitude); 
            if (a) { 
                setLine1(a.line1); 
                setLine2(a.line2); 
                setLandmark(a.landmark || ''); 
                setPincode(a.pincode); 
            } else { 
                alert("Address not found."); 
            } 
        } catch { } finally { setIsAutoDetecting(false); }
    }, () => { alert("Location denied."); setIsAutoDetecting(false); }, { enableHighAccuracy: true });
  };

  // --- Submission Logic ---
  const handleNext = () => {
      // Validation for transitions
      if (currentStep === 1 && !foodImage) { alert("Please take a photo first."); return; }
      if (currentStep === 2 && (!foodName || !quantityNum || !expiryDate)) { alert("Please fill in all details."); return; }
      if (currentStep === 3) {
          if(!line1 || !pincode) { alert("Address required"); return; }
          handleInitiatePayment();
          return;
      }
      setCurrentStep(prev => prev + 1);
  };

  const handleInitiatePayment = () => { 
      setIsProcessingPayment(true); 
      setShowPaymentModal(true); 
  };

  const handlePaymentSuccess = async () => {
    setIsUploading(true);
    setUploadProgress(0);

    const newPost: FoodPosting = { 
        id: Math.random().toString(36).substr(2, 9), 
        donationType, 
        donorId: user.id, 
        donorName: user.name || 'Donor', 
        donorOrg: user.orgName,
        isDonorVerified: user.isVerified || false,
        foodName, 
        description: foodDescription, 
        quantity: `${quantityNum} ${unit}`, 
        location: { line1, line2, landmark, pincode, lat, lng }, 
        expiryDate, 
        status: FoodStatus.AVAILABLE, 
        imageUrl: foodImage!, 
        safetyVerdict, 
        foodTags: selectedTags, 
        createdAt: Date.now(), 
        platformFeePaid: true 
    };
    
    // Simulate upload progress
    const interval = setInterval(() => {
        setUploadProgress(prev => {
            if (prev >= 90) {
                clearInterval(interval);
                return 90;
            }
            return prev + 10;
        });
    }, 150);

    // Simulate actual delay for storage/network
    await new Promise(r => setTimeout(r, 2000));
    await storage.savePosting(newPost);
    
    clearInterval(interval);
    setUploadProgress(100);
    
    await new Promise(r => setTimeout(r, 500));

    setIsUploading(false);
    setShowPaymentModal(false);
    setIsProcessingPayment(false);
    onSuccess(newPost);
  };

  return (
    <div className="max-w-3xl mx-auto pb-12 animate-fade-in-up">
        {/* Header & Progress */}
        <div className="flex items-center justify-between mb-4">
            <button onClick={onBack} className="flex items-center text-slate-500 font-bold text-sm hover:text-emerald-600 transition-colors">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                Cancel
            </button>
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-wide">
                {currentStep === 0 ? 'Choose Type' : currentStep === 1 ? 'Snap Photo' : currentStep === 2 ? 'Add Details' : 'Confirm Location'}
            </h2>
            <div className="w-16 text-right text-xs font-bold text-slate-400">Step {currentStep + 1}/4</div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 bg-slate-100 rounded-full mb-8 overflow-hidden">
            <div className="h-full bg-emerald-500 transition-all duration-500 ease-out" style={{ width: `${((currentStep + 1) / 4) * 100}%` }}></div>
        </div>

        <div className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden border border-slate-100 relative min-h-[500px] flex flex-col">
            
            {/* Step 1: Type Selection */}
            {currentStep === 0 && (
                <div className="p-8 flex-1 flex flex-col justify-center animate-fade-in-up">
                    <h3 className="text-2xl font-black text-slate-800 mb-8 text-center">What are you donating today?</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <button 
                            onClick={() => handleTypeChange('FOOD')} 
                            className="p-8 rounded-[2rem] border-2 border-slate-100 hover:border-emerald-500 hover:bg-emerald-50 transition-all group text-left relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-100 rounded-full blur-3xl -mr-16 -mt-16 transition-opacity opacity-0 group-hover:opacity-100"></div>
                            <span className="text-6xl mb-4 block group-hover:scale-110 transition-transform origin-left">🍱</span>
                            <h4 className="text-xl font-black text-slate-800 group-hover:text-emerald-700">Food</h4>
                            <p className="text-sm text-slate-500 font-medium mt-2">Meals, packaged goods, or raw ingredients.</p>
                        </button>
                        <button 
                            onClick={() => handleTypeChange('CLOTHES')} 
                            className="p-8 rounded-[2rem] border-2 border-slate-100 hover:border-indigo-500 hover:bg-indigo-50 transition-all group text-left relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-100 rounded-full blur-3xl -mr-16 -mt-16 transition-opacity opacity-0 group-hover:opacity-100"></div>
                            <span className="text-6xl mb-4 block group-hover:scale-110 transition-transform origin-left">👕</span>
                            <h4 className="text-xl font-black text-slate-800 group-hover:text-indigo-700">Clothes</h4>
                            <p className="text-sm text-slate-500 font-medium mt-2">Wearable items, blankets, or footwear.</p>
                        </button>
                    </div>
                </div>
            )}

            {/* Step 2: Camera & Analysis */}
            {currentStep === 1 && (
                <div className="p-8 flex-1 flex flex-col animate-fade-in-up">
                    <div className="space-y-4 flex-1">
                        {!isCameraOpen && !foodImage && (
                            <div className="h-full flex flex-col items-center justify-center border-4 border-dashed border-slate-200 rounded-[2rem] bg-slate-50 p-8">
                                <div className="mb-8 text-center">
                                    <span className="text-6xl mb-4 block opacity-50">📸</span>
                                    <h3 className="text-lg font-bold text-slate-700">Show us the donation</h3>
                                    <p className="text-sm text-slate-400 max-w-xs mx-auto mt-2">Our AI will analyze the image to ensure safety and auto-fill details.</p>
                                </div>
                                <div className="flex gap-4 w-full max-w-sm">
                                    <button onClick={startCamera} className="flex-1 bg-slate-900 text-white py-4 rounded-2xl font-bold uppercase text-xs tracking-widest hover:bg-slate-800 transition-all shadow-lg">Take Photo</button>
                                    <button onClick={() => fileInputRef.current?.click()} className="flex-1 bg-white text-slate-900 border-2 border-slate-200 py-4 rounded-2xl font-bold uppercase text-xs tracking-widest hover:bg-slate-50 transition-all">Upload</button>
                                </div>
                                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
                            </div>
                        )}

                        {isCameraOpen && (
                            <div className="relative rounded-[2rem] overflow-hidden bg-black aspect-[3/4] md:aspect-video shadow-2xl">
                                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                                <div className="absolute bottom-6 inset-x-0 flex justify-center gap-6">
                                    <button onClick={stopCamera} className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
                                    <button onClick={capturePhoto} className="w-20 h-20 bg-white rounded-full border-4 border-slate-300 shadow-lg hover:scale-105 transition-transform relative">
                                        <div className="absolute inset-1 rounded-full border-2 border-slate-900"></div>
                                    </button>
                                </div>
                            </div>
                        )}
                        
                        {foodImage && (
                            <div className="relative rounded-[2rem] overflow-hidden bg-slate-900 shadow-xl group h-full">
                                <img src={foodImage} className="w-full h-full object-cover opacity-80" />
                                <button onClick={() => setFoodImage(null)} className="absolute top-4 right-4 bg-black/50 text-white p-3 rounded-full hover:bg-black/70 backdrop-blur-md transition-all z-10">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                </button>
                                
                                <div className="absolute bottom-0 inset-x-0 p-6 bg-gradient-to-t from-black via-black/80 to-transparent">
                                    {isAnalyzing ? (
                                        <div className="flex flex-col items-center gap-3 text-white">
                                            <svg className="animate-spin h-8 w-8 text-emerald-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                            <span className="text-sm font-bold uppercase tracking-widest animate-pulse">Analyzing Safety...</span>
                                        </div>
                                    ) : safetyVerdict && (
                                        <div className="animate-fade-in-up">
                                            <div className="flex items-center gap-3 mb-2">
                                                <span className={`text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full ${safetyVerdict.isSafe ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                                                    {safetyVerdict.isSafe ? 'Passed' : 'Issues Detected'}
                                                </span>
                                            </div>
                                            <p className="text-sm text-white/90 font-medium leading-relaxed">{safetyVerdict.reasoning}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                    {/* Next Button */}
                    <div className="mt-6">
                        <button 
                            onClick={handleNext} 
                            disabled={!foodImage || isAnalyzing}
                            className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-800 transition-all"
                        >
                            Continue
                        </button>
                    </div>
                </div>
            )}

            {/* Step 3: Details */}
            {currentStep === 2 && (
                <div className="p-8 flex-1 flex flex-col animate-fade-in-up overflow-y-auto">
                    {aiAutofilled && (
                        <div className="mb-6 bg-blue-50 border border-blue-100 p-3 rounded-xl flex items-center gap-3 animate-fade-in-up">
                            <span className="text-xl">✨</span>
                            <p className="text-xs font-bold text-blue-700">AI automatically filled details from your photo!</p>
                        </div>
                    )}

                    <div className="space-y-6 flex-1">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Title</label>
                            <input type="text" placeholder="e.g. Mixed Veg Curry & Rice" value={foodName} onChange={e => setFoodName(e.target.value)} className="w-full px-5 py-4 border border-slate-200 bg-slate-50/50 rounded-2xl font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-100 transition-all placeholder:text-slate-300" required />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Quantity</label>
                                <div className="flex">
                                    <input type="number" placeholder="0" value={quantityNum} onChange={e => setQuantityNum(e.target.value)} className="w-full px-5 py-4 border border-slate-200 bg-slate-50/50 rounded-l-2xl font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-100 transition-all" required />
                                    <select value={unit} onChange={e => setUnit(e.target.value)} className="px-3 py-4 border-y border-r border-slate-200 bg-slate-100 rounded-r-2xl font-bold text-xs text-slate-600 focus:outline-none uppercase tracking-wider">
                                        <option value="meals">Meals</option>
                                        <option value="kg">Kg</option>
                                        <option value="items">Items</option>
                                        <option value="boxes">Boxes</option>
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">{donationType === 'FOOD' ? 'Expires' : 'Pickup By'}</label>
                                <input type="datetime-local" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} className="w-full px-5 py-4 border border-slate-200 bg-slate-50/50 rounded-2xl font-bold text-slate-800 text-xs focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-100 transition-all" required />
                            </div>
                        </div>

                        {/* Quick Expiry Chips */}
                        {donationType === 'FOOD' && (
                            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                                <button onClick={() => setQuickExpiry(2)} className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-emerald-100 hover:bg-emerald-100 transition-colors">+2 Hours</button>
                                <button onClick={() => setQuickExpiry(4)} className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-emerald-100 hover:bg-emerald-100 transition-colors">+4 Hours</button>
                                <button onClick={() => setQuickExpiry(24)} className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-emerald-100 hover:bg-emerald-100 transition-colors">Tomorrow</button>
                            </div>
                        )}

                        <div className="space-y-1 relative">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Description</label>
                            <textarea placeholder="Ingredients, allergens, or condition..." value={foodDescription} onChange={e => setFoodDescription(e.target.value)} className="w-full px-5 py-4 border border-slate-200 bg-slate-50/50 rounded-2xl font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-100 transition-all resize-none h-24 placeholder:text-slate-300" />
                            <button type="button" onClick={isRecording ? stopRecording : startRecording} className={`absolute bottom-3 right-3 p-2.5 rounded-xl transition-all ${isRecording ? 'bg-rose-500 text-white animate-pulse shadow-lg' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'}`}>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                            </button>
                        </div>
                    </div>

                    <div className="mt-6 flex gap-4">
                        <button onClick={() => setCurrentStep(1)} className="px-6 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-slate-200">Back</button>
                        <button onClick={handleNext} className="flex-1 bg-slate-900 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-slate-800 transition-all">Next</button>
                    </div>
                </div>
            )}

            {/* Step 4: Location */}
            {currentStep === 3 && (
                <div className="flex-1 flex flex-col animate-fade-in-up">
                    <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                        <div className="flex justify-between items-center mb-4">
                            <label className="text-xs font-black uppercase text-slate-800 tracking-widest">Confirm Pickup Location</label>
                            <button type="button" onClick={handleAutoDetectLocation} className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 hover:bg-emerald-100 transition-colors flex items-center gap-1">
                                {isAutoDetecting ? <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : '📍'}
                                Auto Detect
                            </button>
                        </div>
                        <LocationPickerMap lat={lat} lng={lng} onLocationSelect={(newLat, newLng) => { setLat(newLat); setLng(newLng); }} onAddressFound={(addr) => { setLine1(addr.line1); setLine2(addr.line2); setLandmark(addr.landmark || ''); setPincode(addr.pincode); }} />
                    </div>
                    
                    <div className="p-8 space-y-4 flex-1">
                        <input type="text" placeholder="Street / Building Name" value={line1} onChange={e => setLine1(e.target.value)} className="w-full px-5 py-3 border border-slate-200 bg-slate-50/50 rounded-xl font-bold text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500" required />
                        <div className="grid grid-cols-2 gap-3">
                            <input type="text" placeholder="Landmark" value={landmark} onChange={e => setLandmark(e.target.value)} className="w-full px-5 py-3 border border-slate-200 bg-slate-50/50 rounded-xl font-bold text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                            <input type="text" placeholder="Pincode" value={pincode} onChange={e => setPincode(e.target.value)} className="w-full px-5 py-3 border border-slate-200 bg-slate-50/50 rounded-xl font-bold text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500" required />
                        </div>
                    </div>

                    <div className="bg-slate-900 p-6 text-white">
                        <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-lg">₹</div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Platform Fee</p>
                                    <p className="font-bold text-sm">Small contribution</p>
                                </div>
                            </div>
                            <span className="text-2xl font-black">₹5</span>
                        </div>
                        <div className="flex gap-4">
                            <button onClick={() => setCurrentStep(2)} className="px-6 py-4 bg-white/10 text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-white/20">Back</button>
                            <button onClick={handleNext} disabled={isProcessingPayment} className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-70">
                                {isProcessingPayment ? 'Processing...' : 'Pay & Publish'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>

        {showPaymentModal && (
            <PaymentModal 
                amount={5} 
                onSuccess={handlePaymentSuccess} 
                onCancel={() => { setShowPaymentModal(false); setIsProcessingPayment(false); }}
                isUploading={isUploading} 
                uploadProgress={uploadProgress}
            />
        )}
    </div>
  );
};

export default AddDonationView;
