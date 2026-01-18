
import React, { useState, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { FoodPosting, User, UserRole, FoodStatus, Rating } from '../types';
import { generateSpeech, askWithMaps } from '../services/geminiService';
import { calculateDistance } from '../services/storageService';
import { getTranslation } from '../services/translations';

interface FoodCardProps {
  posting: FoodPosting;
  user: User;
  onUpdate: (id: string, updates: Partial<FoodPosting>) => void;
  onDelete?: (id: string) => void;
  onClose?: () => void;
  currentLocation?: { lat: number; lng: number };
  onRateUser?: (postingId: string, targetId: string, targetName: string, rating: number, feedback: string) => void;
  onChatClick?: (postingId: string) => void;
  onTrackClick?: (postingId: string) => void;
}

const resizeImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const scale = img.width > MAX_WIDTH ? MAX_WIDTH / img.width : 1;
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', 0.8));
        } else {
            resolve(e.target?.result as string);
        }
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const FoodCard: React.FC<FoodCardProps> = ({ posting, user, onUpdate, onDelete, onClose, currentLocation, onRateUser, onChatClick, onTrackClick }) => {
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);
  const [showAiWarning, setShowAiWarning] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showSafetyDetails, setShowSafetyDetails] = useState(false);
  const [isPickingUp, setIsPickingUp] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [locationInsight, setLocationInsight] = useState<{text: string, sources: any[]} | null>(null);
  const [isLoadingInsight, setIsLoadingInsight] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pickupInputRef = useRef<HTMLInputElement>(null);
  
  const t = (key: string) => getTranslation(key, user?.language);

  const isClothes = posting.donationType === 'CLOTHES';
  const expiryTimestamp = new Date(posting.expiryDate).getTime();
  const creationTimestamp = posting.createdAt || (expiryTimestamp - (12 * 60 * 60 * 1000));
  const totalDuration = expiryTimestamp - creationTimestamp;
  const timeRemaining = expiryTimestamp - Date.now();
  const hoursLeft = timeRemaining / (1000 * 60 * 60);
  const progressPercent = Math.max(0, Math.min(100, (timeRemaining / totalDuration) * 100));
  const isUrgent = posting.status === FoodStatus.AVAILABLE && hoursLeft > 0 && hoursLeft < (isClothes ? 24 : 6);

  const distanceText = useMemo(() => {
    if (currentLocation && posting.location.lat && posting.location.lng) {
      const dist = calculateDistance(currentLocation.lat, currentLocation.lng, posting.location.lat, posting.location.lng);
      return `${dist.toFixed(1)} km`;
    }
    return null;
  }, [currentLocation, posting.location]);

  // Check if current user has already rated for this posting
  const myRating = posting.ratings?.find(r => r.raterId === user.id);

  const initiateRequest = () => {
    if (!user) return;
    setShowAiWarning(true);
  };

  const confirmRequest = () => {
    if (!user) return;
    onUpdate(posting.id, { status: FoodStatus.REQUESTED, orphanageId: user.id, orphanageName: user.orgName || user.name || 'Requester', requesterAddress: user.address });
    setShowAiWarning(false);
  };

  const handleExpressInterest = () => {
    if (!user) return;
    const isAlreadyInterested = posting.interestedVolunteers?.some(v => v.userId === user.id);
    if (isAlreadyInterested) { alert("Already interested."); return; }
    onUpdate(posting.id, { interestedVolunteers: [...(posting.interestedVolunteers || []), { userId: user.id, userName: user.name || 'Volunteer' }] });
    alert("Interest recorded!");
  };

  const handlePickupUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !user) return;
    setIsPickingUp(true);
    try { 
        const base64 = await resizeImage(file); 
        onUpdate(posting.id, { 
            status: FoodStatus.PICKUP_VERIFICATION_PENDING, 
            pickupVerificationImageUrl: base64, 
            volunteerId: user.id, 
            volunteerName: user.name || 'Volunteer', 
            volunteerLocation: currentLocation 
        }); 
    } catch { 
        alert("Failed to upload image");
    } finally { 
        setIsPickingUp(false); 
    }
  };

  const handleVerificationUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !user) return;
    setIsVerifying(true);
    try { 
        const base64 = await resizeImage(file); 
        // Always go to VERIFICATION_PENDING so Donor can approve, regardless of who uploaded it (Volunteer or Requester)
        onUpdate(posting.id, { 
            status: FoodStatus.DELIVERY_VERIFICATION_PENDING, 
            verificationImageUrl: base64 
        }); 
    } catch { 
        alert("Failed to upload image");
    } finally { 
        setIsVerifying(false); 
    }
  };

  const handleRateClick = () => {
      if (!onRateUser) return;
      
      let targetId = '';
      let targetName = '';

      if (user.role === UserRole.REQUESTER) {
          // Requester rates Volunteer
          if (posting.volunteerId) {
              targetId = posting.volunteerId;
              targetName = posting.volunteerName || 'Volunteer';
          }
      } else {
          // Donor or Volunteer rates Requester
          if (posting.orphanageId) {
              targetId = posting.orphanageId;
              targetName = posting.orphanageName || 'Requester';
          }
      }

      if (targetId && targetName) {
          // We trigger the parent handler which will likely open a modal
          // For now, we assume the parent handles the modal opening based on ID
          // But since the modal is likely at the App level, we need a way to pass this info up.
          // The current prop signature is (postingId, targetId, targetName, rating, feedback).
          // Wait, the modal is shown in App.tsx based on state? 
          // Actually, App.tsx needs to know we want to rate someone.
          // Let's assume onRateUser opens the modal.
          // We can't pass rating/feedback yet because we need the UI.
          // So onRateUser should probably just take the context and open the modal.
          // Let's adapt: onRateUser(postingId, targetId, targetName) -> App opens modal -> User submits -> App calls storage.
          
          // However, the interface defined in props is: 
          // onRateUser?: (postingId: string, targetId: string, targetName: string, rating: number, feedback: string) => void;
          // This implies the rating happens HERE.
          // BUT, RatingModal is in App.tsx usually or we can render it here.
          // Ideally, FoodCard shouldn't manage the modal state if it's reused.
          // Let's invoke a callback that signals "I want to rate X".
          // For simplicity in this structure, let's signal the parent with 0 rating to open modal?
          // Or better, let's just use the existing pattern if possible.
          // Ah, I can't change App.tsx logic from here directly.
          // I will use a special signal or assume App.tsx passes a handler that opens the modal.
          // Let's pass dummy rating 0 to indicate "Open Modal".
          onRateUser(posting.id, targetId, targetName, 0, "");
      }
  };

  const handleTTS = async () => {
      if (isPlaying) return;
      setIsPlaying(true);
      const text = `${isClothes ? 'Clothes' : 'Food'} Donation: ${posting.foodName}. ${posting.description || ''}`;
      const audioData = await generateSpeech(text);
      if (audioData) {
          const binaryString = atob(audioData);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
          const audio = new Audio(URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' })));
          audio.onended = () => setIsPlaying(false);
          audio.play();
      } else { setIsPlaying(false); }
  };

  const handleLocationInsight = async () => {
      if (locationInsight) { setLocationInsight(null); return; }
      setIsLoadingInsight(true);
      const query = `Brief summary of location near "${posting.location.line1}, ${posting.location.line2}".`;
      const result = await askWithMaps(query, posting.location.lat && posting.location.lng ? { lat: posting.location.lat, lng: posting.location.lng } : undefined);
      setLocationInsight(result);
      setIsLoadingInsight(false);
  };

  const renderStatus = () => {
      if (posting.status === FoodStatus.AVAILABLE) return isUrgent ? <span className="px-2 py-1 rounded-md bg-rose-500 text-white text-[10px] font-black uppercase">{t('tag_urgent')}</span> : <span className="px-2 py-1 rounded-md bg-emerald-500 text-white text-[10px] font-black uppercase">{t('tag_available')}</span>;
      return <span className="px-2 py-1 rounded-md bg-slate-800 text-white text-[10px] font-black uppercase">{posting.status.replace(/_/g, ' ')}</span>;
  };

  return (
    <>
    <div className="group bg-white rounded-[2rem] overflow-hidden border border-slate-100 shadow-sm hover:shadow-2xl hover:-translate-y-1 hover:scale-[1.01] transition-all duration-300 flex flex-col h-full relative">
      {/* Expiry Progress */}
      {posting.status === FoodStatus.AVAILABLE && hoursLeft > 0 && <div className="h-1 w-full bg-slate-100"><div className={`h-full ${isUrgent ? 'bg-rose-500' : 'bg-emerald-500'} transition-all duration-1000`} style={{ width: `${progressPercent}%` }}></div></div>}

      {/* Image Area */}
      <div className="h-56 relative overflow-hidden bg-slate-50">
        {posting.imageUrl ? <img src={posting.imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt={posting.foodName} /> : <div className="w-full h-full flex items-center justify-center text-4xl opacity-20">{isClothes ? '👕' : '🍲'}</div>}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent"></div>
        <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
            <div className="bg-white/20 backdrop-blur-md px-2 py-1 rounded-lg border border-white/20 text-white text-[10px] font-bold shadow-sm flex items-center gap-1">
                {isClothes ? '👕 Clothes' : '🍲 Food'}
            </div>
            <div className="flex flex-col gap-2 items-end">
                {renderStatus()}
                {distanceText && <span className="text-[10px] font-bold text-white bg-black/30 px-2 py-1 rounded-md backdrop-blur-md">{distanceText} away</span>}
            </div>
        </div>
        <div className="absolute bottom-4 left-4 right-4 text-white">
            <h3 className="font-black text-xl leading-tight mb-1 shadow-black/10 drop-shadow-md">{posting.foodName}</h3>
            <p className="text-xs font-medium opacity-90 truncate">{posting.donorOrg || posting.donorName}</p>
        </div>
      </div>

      {/* Content */}
      <div className="p-5 flex-1 flex flex-col">
          <div className="flex gap-4 mb-4 text-slate-600">
              <div className="flex-1 p-2 bg-slate-50 rounded-xl border border-slate-100 text-center">
                  <p className="text-[9px] font-black uppercase text-slate-400">{t('lbl_quantity')}</p>
                  <p className="text-sm font-bold">{posting.quantity}</p>
              </div>
              <div className="flex-1 p-2 bg-slate-50 rounded-xl border border-slate-100 text-center">
                  <p className="text-[9px] font-black uppercase text-slate-400">{t('lbl_expires')}</p>
                  <p className="text-sm font-bold">{hoursLeft > 0 ? `${Math.ceil(hoursLeft)}h` : t('lbl_expired')}</p>
              </div>
          </div>

          <div className="flex gap-2 mb-4">
              <button onClick={() => setShowSafetyDetails(!showSafetyDetails)} className={`flex-1 py-2 px-3 rounded-xl border text-[10px] font-bold uppercase transition-colors flex items-center justify-center gap-2 ${posting.safetyVerdict?.isSafe ? 'bg-emerald-50 border-emerald-100 text-emerald-700 hover:bg-emerald-100' : 'bg-rose-50 border-rose-100 text-rose-700 hover:bg-rose-100'}`}>
                  {posting.safetyVerdict?.isSafe ? `🛡️ ${t('card_safe')}` : `⚠️ ${t('card_check')}`}
              </button>
              <button onClick={handleLocationInsight} className="flex-1 py-2 px-3 rounded-xl border border-slate-100 bg-slate-50 text-slate-600 text-[10px] font-bold uppercase hover:bg-slate-100 transition-colors flex items-center justify-center gap-2">
                  📍 {t('card_area')}
              </button>
          </div>

          {(showSafetyDetails || locationInsight) && (
              <div className="mb-4 p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600 animate-fade-in-up">
                  {showSafetyDetails && <p className="mb-1">"{posting.safetyVerdict?.reasoning}"</p>}
                  {locationInsight && <p className="text-emerald-700">{locationInsight.text}</p>}
                  {isLoadingInsight && <span className="text-emerald-500 animate-pulse">Loading...</span>}
              </div>
          )}

          <p className="text-sm text-slate-500 font-medium line-clamp-2 mb-4 flex-1">{posting.description}</p>

          <div className="mt-auto space-y-2">
              {/* Primary Actions */}
              {user.role === UserRole.VOLUNTEER && posting.status === FoodStatus.AVAILABLE && (
                  <button onClick={handleExpressInterest} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-200 transition-all">{t('btn_interest')}</button>
              )}
              {user.role === UserRole.REQUESTER && posting.status === FoodStatus.AVAILABLE && (
                  <button onClick={initiateRequest} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-200 transition-all">{t('btn_request')}</button>
              )}
              
              {/* Cancel Button for Donors - Only if not yet picked up (Available or Requested) */}
              {user.role === UserRole.DONOR && posting.donorId === user.id && (posting.status === FoodStatus.AVAILABLE || posting.status === FoodStatus.REQUESTED) && (
                  <button onClick={() => setShowCancelConfirmation(true)} className="w-full py-3 bg-white border border-rose-100 text-rose-500 hover:bg-rose-50 rounded-xl font-black text-xs uppercase tracking-widest transition-all">{t('btn_cancel')}</button>
              )}
              
              {/* Tracking for Requester */}
              {user.role === UserRole.REQUESTER && posting.volunteerId && posting.status !== FoodStatus.DELIVERED && (
                  <button 
                      onClick={() => onTrackClick?.(posting.id)} 
                      className="w-full py-3 bg-white border border-blue-200 text-blue-600 hover:bg-blue-50 rounded-xl font-black text-xs uppercase tracking-widest shadow-sm transition-all flex items-center justify-center gap-2"
                  >
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                      </span>
                      {t('btn_track')}
                  </button>
              )}

              {/* Chat Button for Requesters - Active Missions */}
              {user.role === UserRole.REQUESTER && posting.orphanageId === user.id && posting.status !== FoodStatus.AVAILABLE && posting.status !== FoodStatus.DELIVERED && (
                  <button onClick={() => onChatClick?.(posting.id)} className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2">
                      <span className="text-lg">💬</span> {posting.volunteerId ? t('btn_chat_vol') : t('btn_chat_donor')}
                  </button>
              )}
              
              {/* Chat Button for Volunteers - Active Missions */}
              {user.role === UserRole.VOLUNTEER && posting.volunteerId === user.id && posting.status !== FoodStatus.DELIVERED && (
                  <button onClick={() => onChatClick?.(posting.id)} className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2">
                      <span className="text-lg">💬</span> {t('btn_chat')}
                  </button>
              )}
              
              {/* Verification Actions - Volunteer Pickup */}
              {user.role === UserRole.VOLUNTEER && (posting.status === FoodStatus.REQUESTED || posting.status === FoodStatus.PICKUP_VERIFICATION_PENDING) && posting.volunteerId === user.id && (
                  <div className="relative">
                      <input type="file" className="hidden" ref={pickupInputRef} onChange={handlePickupUpload} accept="image/*" />
                      <button onClick={() => pickupInputRef.current?.click()} disabled={isPickingUp || posting.status === FoodStatus.PICKUP_VERIFICATION_PENDING} className={`w-full py-3 rounded-xl font-black text-xs uppercase tracking-widest text-white shadow-lg transition-all flex items-center justify-center gap-2 ${posting.status === FoodStatus.PICKUP_VERIFICATION_PENDING ? 'bg-amber-400' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'}`}>
                          {isPickingUp ? 'Uploading...' : posting.status === FoodStatus.PICKUP_VERIFICATION_PENDING ? (
                              t('btn_wait_approve')
                          ) : (
                              <><span>📷</span> {t('btn_pickup')}</>
                          )}
                      </button>
                  </div>
              )}

              {/* Verification Actions - Volunteer Delivery */}
              {user.role === UserRole.VOLUNTEER && (posting.status === FoodStatus.IN_TRANSIT || posting.status === FoodStatus.DELIVERY_VERIFICATION_PENDING) && posting.volunteerId === user.id && (
                  <div className="relative">
                      <input type="file" className="hidden" ref={fileInputRef} onChange={handleVerificationUpload} accept="image/*" />
                      <button onClick={() => fileInputRef.current?.click()} disabled={isVerifying || posting.status === FoodStatus.DELIVERY_VERIFICATION_PENDING} className={`w-full py-3 rounded-xl font-black text-xs uppercase tracking-widest text-white shadow-lg transition-all flex items-center justify-center gap-2 ${posting.status === FoodStatus.DELIVERY_VERIFICATION_PENDING ? 'bg-amber-400' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'}`}>
                          {isVerifying ? 'Uploading...' : posting.status === FoodStatus.DELIVERY_VERIFICATION_PENDING ? 'Confirming...' : (
                              <><span>📸</span> {t('btn_confirm')}</>
                          )}
                      </button>
                  </div>
              )}

              {/* Verification Actions - Requester Receipt */}
              {user.role === UserRole.REQUESTER && (posting.status === FoodStatus.IN_TRANSIT || posting.status === FoodStatus.DELIVERY_VERIFICATION_PENDING) && posting.orphanageId === user.id && (
                  <div className="relative">
                      <input type="file" className="hidden" ref={fileInputRef} onChange={handleVerificationUpload} accept="image/*" />
                      <button onClick={() => fileInputRef.current?.click()} disabled={isVerifying || posting.status === FoodStatus.DELIVERY_VERIFICATION_PENDING} className={`w-full py-3 rounded-xl font-black text-xs uppercase tracking-widest text-white shadow-lg transition-all flex items-center justify-center gap-2 ${posting.status === FoodStatus.DELIVERY_VERIFICATION_PENDING ? 'bg-amber-400' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'}`}>
                          {isVerifying ? 'Uploading...' : posting.status === FoodStatus.DELIVERY_VERIFICATION_PENDING ? t('btn_wait_donor') : (
                              <><span>📷</span> {t('btn_received')}</>
                          )}
                      </button>
                  </div>
              )}

              {/* RATING BUTTON - Shown only when delivered and not rated yet */}
              {posting.status === FoodStatus.DELIVERED && onRateUser && (
                  <div className="mt-2">
                      {myRating ? (
                          <div className="w-full py-3 bg-yellow-50 text-yellow-600 rounded-xl font-bold text-xs uppercase tracking-widest text-center border border-yellow-100 flex items-center justify-center gap-2">
                              <span>★</span> You rated {myRating.rating}/5
                          </div>
                      ) : (
                          // Logic to decide who to rate
                          (user.role === UserRole.REQUESTER && posting.volunteerId) ? (
                              <button onClick={handleRateClick} className="w-full py-3 bg-white border border-slate-200 hover:border-yellow-400 hover:text-yellow-600 text-slate-500 rounded-xl font-black text-xs uppercase tracking-widest transition-all">
                                  Rate Volunteer
                              </button>
                          ) : ((user.role === UserRole.VOLUNTEER || user.role === UserRole.DONOR) && posting.orphanageId) ? (
                              <button onClick={handleRateClick} className="w-full py-3 bg-white border border-slate-200 hover:border-yellow-400 hover:text-yellow-600 text-slate-500 rounded-xl font-black text-xs uppercase tracking-widest transition-all">
                                  Rate Requester
                              </button>
                          ) : null
                      )}
                  </div>
              )}
          </div>
      </div>
      
      <button onClick={handleTTS} className={`absolute top-4 right-4 z-10 p-2 rounded-full backdrop-blur-md transition-all ${isPlaying ? 'bg-white text-emerald-600' : 'bg-black/20 text-white hover:bg-white hover:text-slate-900'}`}><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg></button>
      {onClose && <button onClick={onClose} className="absolute bottom-4 right-4 z-20 bg-white shadow-lg text-slate-800 p-2 rounded-full hover:scale-110 transition-transform"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button>}
    </div>

    {showCancelConfirmation && createPortal(
        <div className="fixed inset-0 z-[1000] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full text-center shadow-2xl animate-fade-in-up">
                <h3 className="text-xl font-black text-slate-800 mb-2">Cancel Donation?</h3>
                <p className="text-slate-500 text-sm mb-6">This cannot be undone. Are you sure you want to retract this posting?</p>
                <div className="flex gap-3">
                    <button onClick={() => setShowCancelConfirmation(false)} className="flex-1 py-3 bg-slate-100 rounded-xl font-bold text-xs uppercase tracking-wider text-slate-600 hover:bg-slate-200 transition-colors">Keep It</button>
                    <button onClick={() => { onDelete && onDelete(posting.id); setShowCancelConfirmation(false); }} className="flex-1 py-3 bg-rose-500 rounded-xl font-bold text-xs uppercase tracking-wider text-white shadow-lg shadow-rose-200 hover:bg-rose-600 transition-colors">Yes, Cancel</button>
                </div>
            </div>
        </div>, document.body
    )}

    {showAiWarning && createPortal(
        <div className="fixed inset-0 z-[1100] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl animate-fade-in-up border border-slate-100">
                <div className="flex flex-col items-center text-center">
                    <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mb-4 text-3xl shadow-inner">
                        ⚠️
                    </div>
                    <h3 className="text-xl font-black text-slate-800 mb-2">AI Verification Warning</h3>
                    <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 mb-6">
                        <p className="text-amber-800 text-xs font-bold leading-relaxed">
                            This food donation has been verified <span className="underline decoration-2 decoration-amber-400/50">ONLY by AI algorithms</span> based on images provided by the donor.
                        </p>
                        <p className="text-amber-700/80 text-[10px] font-medium mt-2">
                            No human food inspector has physically checked this item. Please use your own discretion and inspect the food upon receipt.
                        </p>
                    </div>
                    
                    <div className="flex gap-3 w-full">
                        <button 
                            onClick={() => setShowAiWarning(false)} 
                            className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black rounded-2xl text-xs uppercase tracking-widest transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={confirmRequest} 
                            className="flex-1 py-4 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-2xl text-xs uppercase tracking-widest shadow-lg transition-all"
                        >
                            I Understand
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    )}
    </>
  );
};

export default FoodCard;
