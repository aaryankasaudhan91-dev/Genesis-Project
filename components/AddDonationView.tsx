
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

const AddDonationView: React.FC<AddDonationViewProps> = ({ user, initialType = 'FOOD', onBack, onSuccess }) => {
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
  const [isImageProcessing, setIsImageProcessing] = useState(false);
  const [imageEditPrompt, setImageEditPrompt] = useState('');
  
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
        // Default fallbacks if needed, or leave empty
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
      // Reset AI verdict if switching types as criteria differ
      if (foodImage) {
          processImage(foodImage, type);
      }
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
      
      try {
          let analysis;
          if (type === 'CLOTHES') analysis = await analyzeClothesImage(base64);
          else analysis = await analyzeFoodSafetyImage(base64);
          
          setSafetyVerdict({ isSafe: analysis.isSafe, reasoning: analysis.reasoning });
          if (!foodName && analysis.detectedFoodName && !analysis.detectedFoodName.includes("Donation")) {
              setFoodName(analysis.detectedFoodName);
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
  const handleInitiatePayment = (e: React.FormEvent) => { 
      e.preventDefault(); 
      if (!foodImage) { alert("Photo required."); return; } 
      if (!line1 || !pincode) { alert("Address required."); return; } 
      setIsProcessingPayment(true); 
      setShowPaymentModal(true); 
  };

  const handlePaymentSuccess = async () => {
    setIsUploading(true);
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
    
    // Simulate slight delay for visual effect (and actual network wait)
    await new Promise(r => setTimeout(r, 1500));
    await storage.savePosting(newPost);
    
    setIsUploading(false);
    setShowPaymentModal(false);
    setIsProcessingPayment(false);
    onSuccess(newPost);
  };

  return (
    <div className="max-w-3xl mx-auto pb-12 animate-fade-in-up">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
            <button onClick={onBack} className="flex items-center text-slate-500 font-bold text-sm hover:text-emerald-600 transition-colors">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                Dashboard
            </button>
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-wide">New Donation</h2>
            <div className="w-16"></div> {/* Spacer for center alignment */}
        </div>

        <div className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden border border-slate-100 relative">
            
            {/* Type Selector */}
            <div className="bg-slate-50 p-2 flex border-b border-slate-100">
                <button 
                    type="button" 
                    onClick={() => handleTypeChange('FOOD')} 
                    className={`flex-1 py-4 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${donationType === 'FOOD' ? 'bg-white text-emerald-700 shadow-md ring-1 ring-emerald-100' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    <span className="text-lg">🍱</span> Donate Food
                </button>
                <button 
                    type="button" 
                    onClick={() => handleTypeChange('CLOTHES')} 
                    className={`flex-1 py-4 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${donationType === 'CLOTHES' ? 'bg-white text-indigo-700 shadow-md ring-1 ring-indigo-100' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    <span className="text-lg">👕</span> Donate Clothes
                </button>
            </div>

            <form onSubmit={handleInitiatePayment} className="p-8 space-y-8">
                
                {/* Image Section */}
                <div className="space-y-4">
                    {!isCameraOpen && !foodImage && (
                        <div className="grid grid-cols-2 gap-4 h-48">
                            <button type="button" onClick={startCamera} className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center text-slate-400 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-600 transition-all group">
                                <span className="text-3xl mb-2 group-hover:scale-110 transition-transform">📸</span>
                                <span className="text-xs font-bold uppercase tracking-widest">Take Photo</span>
                            </button>
                            <button type="button" onClick={() => fileInputRef.current?.click()} className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center text-slate-400 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-all group">
                                <span className="text-3xl mb-2 group-hover:scale-110 transition-transform">🖼️</span>
                                <span className="text-xs font-bold uppercase tracking-widest">Upload</span>
                            </button>
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
                        </div>
                    )}

                    {isCameraOpen && (
                        <div className="relative rounded-3xl overflow-hidden bg-black aspect-video shadow-lg">
                            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                            <div className="absolute bottom-4 inset-x-0 flex justify-center gap-4">
                                <button type="button" onClick={stopCamera} className="px-6 py-2 bg-white/20 backdrop-blur-md rounded-full text-white text-xs font-bold hover:bg-white/30 transition-colors">Cancel</button>
                                <button type="button" onClick={capturePhoto} className="w-16 h-16 bg-white rounded-full border-4 border-slate-300 shadow-lg hover:scale-105 transition-transform"></button>
                            </div>
                            <canvas ref={canvasRef} className="hidden" />
                        </div>
                    )}
                    
                    {foodImage && (
                        <div className="relative rounded-3xl overflow-hidden bg-slate-100 shadow-md group">
                            <img src={foodImage} className="w-full h-64 object-cover" />
                            <button type="button" onClick={() => setFoodImage(null)} className="absolute top-3 right-3 bg-white/90 text-rose-500 p-2 rounded-full shadow-lg hover:bg-white transition-all">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                            
                            {/* Analysis Overlay */}
                            <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
                                {isAnalyzing ? (
                                    <div className="flex items-center gap-3 text-white/90">
                                        <svg className="animate-spin h-5 w-5 text-emerald-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                        <span className="text-xs font-bold uppercase tracking-widest animate-pulse">AI Analysis in progress...</span>
                                    </div>
                                ) : safetyVerdict && (
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-xs font-black uppercase tracking-widest px-2 py-0.5 rounded ${safetyVerdict.isSafe ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                                                {safetyVerdict.isSafe ? 'Safe to Donate' : 'Attention Needed'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-white/90 font-medium leading-relaxed line-clamp-2">{safetyVerdict.reasoning}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Info Fields */}
                <div className="space-y-6">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Title</label>
                        <input type="text" placeholder="e.g. Mixed Veg Curry & Rice" value={foodName} onChange={e => setFoodName(e.target.value)} className="w-full px-5 py-4 border border-slate-200 bg-slate-50/50 rounded-2xl font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-100 transition-all placeholder:text-slate-300" required />
                    </div>

                    <div className="space-y-1 relative">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Description</label>
                        <textarea placeholder="Add details about ingredients, allergens, or condition..." value={foodDescription} onChange={e => setFoodDescription(e.target.value)} className="w-full px-5 py-4 border border-slate-200 bg-slate-50/50 rounded-2xl font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-100 transition-all resize-none h-32 placeholder:text-slate-300" />
                        <button type="button" onClick={isRecording ? stopRecording : startRecording} className={`absolute bottom-3 right-3 p-3 rounded-xl transition-all ${isRecording ? 'bg-rose-500 text-white animate-pulse shadow-lg' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'}`}>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
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
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">{donationType === 'FOOD' ? 'Expires In' : 'Pickup By'}</label>
                            <input type="datetime-local" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} className="w-full px-5 py-4 border border-slate-200 bg-slate-50/50 rounded-2xl font-bold text-slate-800 text-xs focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-100 transition-all" required />
                        </div>
                    </div>
                </div>

                {/* Location Section */}
                <div className="pt-6 border-t border-slate-100">
                    <div className="flex justify-between items-center mb-4">
                        <label className="text-xs font-black uppercase text-slate-800 tracking-widest">Pickup Location</label>
                        <button type="button" onClick={handleAutoDetectLocation} className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 hover:bg-emerald-100 transition-colors flex items-center gap-1">
                            {isAutoDetecting ? <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : '📍'}
                            Auto Detect
                        </button>
                    </div>
                    
                    <LocationPickerMap lat={lat} lng={lng} onLocationSelect={(newLat, newLng) => { setLat(newLat); setLng(newLng); }} onAddressFound={(addr) => { setLine1(addr.line1); setLine2(addr.line2); setLandmark(addr.landmark || ''); setPincode(addr.pincode); }} />
                    
                    <div className="space-y-3 mt-4">
                        <input type="text" placeholder="Street / Building Name" value={line1} onChange={e => setLine1(e.target.value)} className="w-full px-5 py-3 border border-slate-200 bg-slate-50/50 rounded-xl font-bold text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500" required />
                        <div className="grid grid-cols-2 gap-3">
                            <input type="text" placeholder="Landmark (Optional)" value={landmark} onChange={e => setLandmark(e.target.value)} className="w-full px-5 py-3 border border-slate-200 bg-slate-50/50 rounded-xl font-bold text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                            <input type="text" placeholder="Pincode" value={pincode} onChange={e => setPincode(e.target.value)} className="w-full px-5 py-3 border border-slate-200 bg-slate-50/50 rounded-xl font-bold text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500" required />
                        </div>
                    </div>
                </div>

                {/* Footer / Submit */}
                <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl">
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
                    <button type="submit" disabled={isProcessingPayment} className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">
                        {isProcessingPayment ? 'Processing...' : 'Pay & Post Donation'}
                    </button>
                </div>
            </form>
        </div>

        {showPaymentModal && (
            <PaymentModal 
                amount={5} 
                onSuccess={handlePaymentSuccess} 
                onCancel={() => { setShowPaymentModal(false); setIsProcessingPayment(false); }}
                isUploading={isUploading} 
            />
        )}
    </div>
  );
};

export default AddDonationView;
