
import React, { useState, useRef } from 'react';
import { FoodPosting, User, UserRole, FoodStatus } from '../types';
import DirectionsModal from './DirectionsModal';
import LiveTrackingModal from './LiveTrackingModal';
import RatingModal from './RatingModal';
import VerificationRequestModal from './VerificationRequestModal';

interface FoodCardProps {
  posting: FoodPosting;
  user: User;
  onUpdate: (id: string, updates: Partial<FoodPosting>) => void;
  onDelete?: (id: string) => void;
  currentLocation?: { lat: number; lng: number };
  onRateVolunteer?: (postingId: string, rating: number, feedback: string) => void;
  onChatClick?: (postingId: string) => void;
  volunteerProfile?: User;
  requesterProfile?: User;
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

const FoodCard: React.FC<FoodCardProps> = ({ posting, user, onUpdate, onDelete, currentLocation, onRateVolunteer, onChatClick, volunteerProfile, requesterProfile }) => {
  const [showDirections, setShowDirections] = useState(false);
  const [showTracking, setShowTracking] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isPickingUp, setIsPickingUp] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isConfirmingStart, setIsConfirmingStart] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pickupInputRef = useRef<HTMLInputElement>(null);
  
  const expiryTimestamp = new Date(posting.expiryDate).getTime();
  const hoursLeft = (expiryTimestamp - Date.now()) / (1000 * 60 * 60);
  const isUrgent = posting.status === FoodStatus.AVAILABLE && hoursLeft > 0 && hoursLeft < 12;

  const getExpiryStatus = () => {
      if (hoursLeft <= 0) return { color: 'text-slate-400', label: 'Expired' };
      if (hoursLeft < 4) return { color: 'text-rose-600', label: 'Critical' };
      if (hoursLeft < 12) return { color: 'text-orange-600', label: 'Urgent' };
      if (hoursLeft < 24) return { color: 'text-amber-600', label: 'Soon' };
      return { color: 'text-emerald-600', label: 'Fresh' };
  };
  
  const expiryStatus = getExpiryStatus();
  const hasRated = posting.ratings?.some(r => r.raterId === user?.id);
  const isSafetyUnknownOrUnsafe = posting.safetyVerdict && !posting.safetyVerdict.isSafe;

  // Determine if the user is involved in this posting to allow chat
  const isInvolved = user && (
    user.id === posting.donorId || 
    user.id === posting.volunteerId || 
    user.id === posting.orphanageId
  );

  const handleRequest = () => {
    if (!user) return;
    onUpdate(posting.id, {
      status: FoodStatus.REQUESTED,
      orphanageId: user.id,
      orphanageName: user.orgName || user.name || 'Requester',
      requesterAddress: user.address
    });
  };

  const handleExpressInterest = () => {
    if (!user) return;
    const updated = [...(posting.interestedVolunteers || []), { userId: user.id, userName: user.name || 'Volunteer' }];
    onUpdate(posting.id, { interestedVolunteers: updated });
    alert("Interest recorded! You'll be notified if a requester selects you, or wait for the status to change to Requested.");
  };

  const confirmStartVolunteering = () => {
      if (!user) return;
      onUpdate(posting.id, {
          volunteerId: user.id,
          volunteerName: user.name || 'Volunteer'
      });
      setIsConfirmingStart(false);
  };

  const handleManualSafetyOverride = () => {
    if (confirm("Are you sure you want to mark this food as safe? This will override the AI safety warning.")) {
        onUpdate(posting.id, {
            safetyVerdict: {
                isSafe: true,
                reasoning: "Manually verified by donor as safe."
            }
        });
    }
  };

  const handleRetractVerification = () => {
      if (confirm("Do you want to cancel the current verification request and re-upload the proof?")) {
          onUpdate(posting.id, {
              status: FoodStatus.REQUESTED,
              pickupVerificationImageUrl: undefined
          });
      }
  };
  
  const handleApprove = () => {
      // Check current status to decide next state
      if (posting.status === FoodStatus.PICKUP_VERIFICATION_PENDING) {
         onUpdate(posting.id, { status: FoodStatus.IN_TRANSIT });
      } else if (posting.status === FoodStatus.DELIVERY_VERIFICATION_PENDING) {
         onUpdate(posting.id, { status: FoodStatus.DELIVERED });
      }
      setShowVerificationModal(false);
  };

  const handleReject = () => {
      if (posting.status === FoodStatus.PICKUP_VERIFICATION_PENDING) {
          if (confirm("Are you sure you want to reject this pickup proof?")) {
              onUpdate(posting.id, {
                  status: FoodStatus.REQUESTED,
                  pickupVerificationImageUrl: undefined,
              });
              setShowVerificationModal(false);
          }
      } else if (posting.status === FoodStatus.DELIVERY_VERIFICATION_PENDING) {
          if (confirm("Are you sure you want to reject this delivery proof?")) {
              onUpdate(posting.id, {
                  status: FoodStatus.IN_TRANSIT,
                  verificationImageUrl: undefined,
              });
              setShowVerificationModal(false);
          }
      }
  };

  const handleConfirmDelete = () => {
      if (onDelete) {
          onDelete(posting.id);
      }
      setShowCancelConfirmation(false);
  };

  const handleShare = async () => {
    const shareData = {
      title: `Food Rescue: ${posting.foodName}`,
      text: `Help rescue food! ${posting.quantity} of ${posting.foodName} available at ${posting.location.line1}.`,
      url: window.location.href
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.log('Share cancelled or failed');
      }
    } else {
      try {
        await navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}\n${shareData.url}`);
        alert('Details copied to clipboard!');
      } catch (err) {
        alert('Unable to copy details. Please share the URL manually.');
      }
    }
  };

  const handlePickupUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

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
        alert("Pickup proof uploaded! Sent to Donor for final approval.");
    } catch (error) {
        console.error(error);
        alert("Error processing pickup image.");
    } finally {
        setIsPickingUp(false);
        if (pickupInputRef.current) pickupInputRef.current.value = '';
    }
  };

  const handleVerificationUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsVerifying(true);
    try {
        const base64 = await resizeImage(file);
        
        // If Requester uploads, they are confirming receipt directly.
        if (user.role === UserRole.REQUESTER) {
            onUpdate(posting.id, { 
                status: FoodStatus.DELIVERED, 
                verificationImageUrl: base64 
            });
            alert("Delivery confirmed! Thank you.");
        } else {
            // Volunteer upload -> Pending Requester Verification
            onUpdate(posting.id, { 
                status: FoodStatus.DELIVERY_VERIFICATION_PENDING, 
                verificationImageUrl: base64 
            });
            alert("Proof uploaded! Sent to Requester for confirmation.");
        }
    } catch (error) {
        console.error(error);
        alert("Error processing image.");
    } finally {
        setIsVerifying(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const getOriginString = () => {
      if (currentLocation) return `${currentLocation.lat},${currentLocation.lng}`;
      if (user?.address) return `${user.address.line1}, ${user.address.line2}, ${user.address.pincode}`;
      return '';
  };

  const getDestinationString = () => {
      if (posting.requesterAddress) {
          const addr = posting.requesterAddress;
          return `${addr.line1}, ${addr.line2}, ${addr.landmark || ''}, ${addr.pincode}`;
      }
      return '';
  };

  const getPickupString = () => {
      const addr = posting.location;
      return `${addr.line1}, ${addr.line2}, ${addr.landmark || ''}, ${addr.pincode}`;
  };

  const mapsQuery = encodeURIComponent(`${posting.location.line1}, ${posting.location.line2}, ${posting.location.landmark || ''}, ${posting.location.pincode}`);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;

  const renderStatusPill = () => {
      switch (posting.status) {
          case FoodStatus.AVAILABLE:
              return <span className="px-3 py-1.5 rounded-full bg-emerald-100/90 backdrop-blur-md text-emerald-800 text-[10px] font-black uppercase tracking-wider border border-emerald-200/50 shadow-sm">Available</span>;
          case FoodStatus.REQUESTED:
              return <span className="px-3 py-1.5 rounded-full bg-blue-100/90 backdrop-blur-md text-blue-800 text-[10px] font-black uppercase tracking-wider border border-blue-200/50 shadow-sm">Requested</span>;
          case FoodStatus.PICKUP_VERIFICATION_PENDING:
              return <span className="px-3 py-1.5 rounded-full bg-amber-100/90 backdrop-blur-md text-amber-800 text-[10px] font-black uppercase tracking-wider border border-amber-200/50 shadow-sm">Verifying Pickup</span>;
          case FoodStatus.IN_TRANSIT:
              return <span className="px-3 py-1.5 rounded-full bg-indigo-100/90 backdrop-blur-md text-indigo-800 text-[10px] font-black uppercase tracking-wider border border-indigo-200/50 shadow-sm">On The Way</span>;
          case FoodStatus.DELIVERY_VERIFICATION_PENDING:
              return <span className="px-3 py-1.5 rounded-full bg-purple-100/90 backdrop-blur-md text-purple-800 text-[10px] font-black uppercase tracking-wider border border-purple-200/50 shadow-sm">Verifying Delivery</span>;
          case FoodStatus.DELIVERED:
              return <span className="px-3 py-1.5 rounded-full bg-slate-100/90 backdrop-blur-md text-slate-500 text-[10px] font-black uppercase tracking-wider border border-slate-200/50 shadow-sm">Delivered</span>;
          default:
              return null;
      }
  };

  return (
    <div className={`group rounded-[2.5rem] bg-white transition-all duration-500 relative overflow-hidden flex flex-col h-full ${isUrgent ? 'ring-2 ring-rose-100 shadow-[0_20px_50px_-12px_rgba(244,63,94,0.2)]' : 'shadow-[0_20px_40px_-12px_rgba(0,0,0,0.05)] hover:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)]'} hover:-translate-y-1`}>
      
      {/* Image Header */}
      <div className="h-64 relative overflow-hidden shrink-0">
        {posting.imageUrl ? (
            <img src={posting.imageUrl} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
        ) : (
            <div className="w-full h-full bg-slate-50 flex flex-col items-center justify-center text-slate-300">
                <svg className="w-16 h-16 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </div>
        )}
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/20 to-transparent"></div>
        
        {/* Top Badges */}
        <div className="absolute top-5 right-5 flex flex-col gap-2 items-end z-20">
             {renderStatusPill()}
             {posting.etaMinutes && (
                 <span className="px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest backdrop-blur-md shadow-lg bg-blue-600 text-white flex items-center gap-1 border border-blue-400/30">
                    <svg className="w-3 h-3 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    ETA: {posting.etaMinutes}m
                 </span>
             )}
        </div>

        {/* Chat Button (Only if involved) */}
        {isInvolved && onChatClick && (
            <div className="absolute top-5 left-5 z-20">
                <button 
                    onClick={() => onChatClick(posting.id)}
                    className="p-3 rounded-full bg-white/20 backdrop-blur-md text-white hover:bg-white hover:text-emerald-600 border border-white/20 transition-all shadow-lg"
                    title="Chat with group"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                </button>
            </div>
        )}

        {/* Bottom Content Info */}
        <div className="absolute bottom-6 left-6 right-6 text-white z-20">
            <div className="flex items-center gap-2 mb-2">
                 <span className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-lg text-[10px] font-bold uppercase border border-white/20 tracking-wider shadow-sm flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                    {posting.quantity}
                 </span>
                 {hoursLeft > 0 && (
                    <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase backdrop-blur-md border border-white/10 shadow-sm flex items-center gap-1 ${hoursLeft < 12 ? 'bg-rose-500/80 text-white' : 'bg-black/30 text-slate-200'}`}>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        {hoursLeft < 24 ? `${Math.floor(hoursLeft)}h left` : `${Math.floor(hoursLeft / 24)}d left`}
                    </span>
                 )}
            </div>
            <h3 className="font-black text-2xl leading-tight text-white line-clamp-2 drop-shadow-md mb-2">{posting.foodName}</h3>
            
            <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
                <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px] text-white font-bold uppercase">
                    {posting.donorName.charAt(0)}
                </div>
                <span>{posting.donorOrg || posting.donorName}</span>
            </div>
        </div>

        {/* Safety Warning Overlay */}
        {isSafetyUnknownOrUnsafe && (
             <div className="absolute inset-0 bg-rose-950/90 backdrop-blur-sm flex items-center justify-center p-8 text-center z-30">
                 <div>
                     <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 text-rose-500 shadow-2xl animate-pulse">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                     </div>
                     <h4 className="text-white font-black text-xl mb-2">Safety Check Failed</h4>
                     <p className="text-rose-200 text-sm mb-6 font-medium leading-relaxed">{posting.safetyVerdict?.reasoning}</p>
                     
                     {user?.role === UserRole.DONOR && posting.donorId === user?.id && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); handleManualSafetyOverride(); }}
                            className="bg-white text-rose-600 px-6 py-3 rounded-xl text-xs font-black hover:bg-rose-50 transition-colors shadow-lg uppercase tracking-wide"
                        >
                            Mark Verified Safe
                        </button>
                     )}
                 </div>
             </div>
        )}
      </div>

      {/* Main Body */}
      <div className={`p-6 flex-1 flex flex-col ${isSafetyUnknownOrUnsafe ? 'opacity-50 pointer-events-none' : ''}`}>
          
          {posting.description && (
            <p className="text-sm text-slate-500 font-medium leading-relaxed mb-6 line-clamp-2">{posting.description}</p>
          )}

          {posting.foodTags && (
                <div className="flex flex-wrap gap-2 mb-6">
                    {posting.foodTags.slice(0, 3).map(tag => (
                        <span key={tag} className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2.5 py-1 rounded-md uppercase tracking-wide border border-slate-200">{tag}</span>
                    ))}
                </div>
          )}
          
          <div className="mt-auto space-y-4">
              
              {/* Location Row */}
              <div className="flex items-start gap-3 group/loc cursor-pointer" onClick={() => window.open(mapsUrl, '_blank')}>
                 <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center shrink-0 text-slate-400 group-hover/loc:bg-emerald-50 group-hover/loc:text-emerald-600 transition-colors border border-slate-100">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                 </div>
                 <div className="flex-1 min-w-0 py-0.5">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Pickup Location</p>
                     <p className="text-sm font-bold text-slate-700 leading-snug line-clamp-1 group-hover/loc:text-emerald-700 transition-colors">
                        {posting.location.line1}
                     </p>
                 </div>
              </div>

              {/* Volunteer Row */}
              {posting.volunteerName && (
                  <div className="flex items-center gap-3 bg-blue-50/50 p-3 rounded-2xl border border-blue-100/50">
                     {volunteerProfile?.profilePictureUrl ? (
                       <img src={volunteerProfile.profilePictureUrl} className="w-10 h-10 rounded-full object-cover shadow-sm shrink-0 ring-2 ring-white" alt={posting.volunteerName} />
                     ) : (
                       <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 font-black text-xs ring-2 ring-white">
                          {posting.volunteerName.charAt(0)}
                       </div>
                     )}
                     <div className="flex-1">
                         <p className="text-[9px] font-black text-blue-400 uppercase tracking-wider mb-0.5">Volunteer</p>
                         <p className="text-sm font-bold text-slate-800 leading-snug">{posting.volunteerName}</p>
                     </div>
                  </div>
              )}

              {/* Status Specific UI - Waiting for Pickup Verification */}
              {user?.role === UserRole.VOLUNTEER && posting.status === FoodStatus.PICKUP_VERIFICATION_PENDING && (
                 <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100">
                     <div className="flex items-center gap-2 mb-2 text-amber-800 font-black text-[10px] uppercase tracking-widest">
                         <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                         Pending Pickup Approval
                     </div>
                     <p className="text-slate-600 text-xs font-medium leading-relaxed">
                         Proof sent to <span className="font-bold text-slate-900">{posting.donorOrg || posting.donorName}</span>.
                     </p>
                     <div className="mt-3 flex gap-2">
                        <button onClick={() => setShowPreview(true)} className="text-[10px] font-bold text-amber-700 underline decoration-amber-300/50">View Proof</button>
                        <button onClick={handleRetractVerification} className="text-[10px] font-bold text-rose-600 ml-auto hover:underline">Retract</button>
                     </div>
                 </div>
              )}

              {/* Status Specific UI - Waiting for Delivery Verification */}
              {user?.role === UserRole.REQUESTER && posting.status === FoodStatus.DELIVERY_VERIFICATION_PENDING && (
                 <div className="bg-purple-50 p-4 rounded-2xl border border-purple-100">
                     <div className="flex items-center gap-2 mb-2 text-purple-800 font-black text-[10px] uppercase tracking-widest">
                         <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></div>
                         Pending Delivery Approval
                     </div>
                     <p className="text-slate-600 text-xs font-medium leading-relaxed">
                         Delivery proof sent by <span className="font-bold text-slate-900">{posting.volunteerName || 'Volunteer'}</span>. Please verify.
                     </p>
                     <div className="mt-3 flex gap-2">
                         <button onClick={() => setShowPreview(true)} className="text-[10px] font-bold text-purple-700 underline decoration-purple-300/50">View Proof</button>
                         <button onClick={() => setShowVerificationModal(true)} className="text-[10px] font-bold text-emerald-600 ml-auto bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 hover:bg-emerald-100 transition-colors">Verify Now</button>
                     </div>
                 </div>
              )}
          </div>

          {/* Action Buttons Area */}
          <div className="pt-6 mt-6 border-t border-slate-100 grid gap-3">
            {user?.role === UserRole.REQUESTER && posting.status === FoodStatus.AVAILABLE && (
              <button onClick={handleRequest} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded-2xl uppercase text-xs tracking-widest transition-all shadow-lg shadow-emerald-200 hover:shadow-emerald-300 hover:-translate-y-0.5 flex items-center justify-center gap-2">
                Request Pickup
              </button>
            )}
            
            {user?.role === UserRole.REQUESTER && posting.status === FoodStatus.IN_TRANSIT && (
              <button onClick={() => setShowTracking(true)} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-4 rounded-2xl uppercase text-xs tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-orange-200 animate-pulse hover:animate-none transition-all">
                Track Live Delivery
              </button>
            )}

            {user?.role === UserRole.VOLUNTEER && posting.status === FoodStatus.AVAILABLE && (
              <button onClick={handleExpressInterest} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-black py-4 rounded-2xl uppercase text-xs tracking-widest transition-all shadow-lg shadow-purple-200 hover:shadow-purple-300 hover:-translate-y-0.5">
                Volunteer Interest
              </button>
            )}

            {user?.role === UserRole.VOLUNTEER && posting.status === FoodStatus.REQUESTED && !posting.volunteerId && (
               !isConfirmingStart ? (
                  <button onClick={() => setIsConfirmingStart(true)} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded-2xl uppercase text-xs tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-emerald-200 transition-all hover:-translate-y-0.5">
                    Start Delivery Mission
                  </button>
               ) : (
                  <div className="flex gap-2 animate-fade-in-up">
                      <button onClick={() => setIsConfirmingStart(false)} className="flex-1 py-3 bg-slate-100 text-slate-500 font-bold rounded-xl text-xs uppercase tracking-wider hover:bg-slate-200 transition-colors">Cancel</button>
                      <button onClick={confirmStartVolunteering} className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-xl text-xs uppercase tracking-wider hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200">Confirm</button>
                  </div>
               )
            )}

            {user?.role === UserRole.VOLUNTEER && posting.status === FoodStatus.REQUESTED && posting.volunteerId === user?.id && (
                <div className="flex flex-col gap-2">
                    <button onClick={() => pickupInputRef.current?.click()} disabled={isPickingUp} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-2xl uppercase text-xs tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 transition-all hover:-translate-y-0.5 disabled:opacity-50">
                        {isPickingUp ? 'Uploading...' : 'Upload Pickup Proof'}
                    </button>
                    {requesterProfile?.contactNo && (
                        <a href={`tel:${requesterProfile.contactNo}`} className="w-full bg-white border-2 border-slate-100 hover:border-blue-200 text-slate-600 hover:text-blue-600 font-bold py-3 rounded-2xl uppercase text-xs tracking-widest flex items-center justify-center gap-2 transition-all">
                            Call Requester
                        </a>
                    )}
                </div>
            )}

            {user?.role === UserRole.VOLUNTEER && posting.volunteerId === user?.id && posting.status === FoodStatus.IN_TRANSIT && (
                <div className="flex gap-2">
                    {posting.requesterAddress && (
                        <button onClick={() => setShowDirections(true)} className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 rounded-xl uppercase text-[10px] tracking-widest shadow-md hover:-translate-y-0.5 transition-all">
                            Directions
                        </button>
                    )}
                    {/* Volunteer can also initiate verification if Requester is unable */}
                    <button onClick={() => !posting.verificationImageUrl && fileInputRef.current?.click()} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl uppercase text-[10px] tracking-widest shadow-md hover:-translate-y-0.5 transition-all">
                        Verify Delivery
                    </button>
                </div>
            )}

            {/* Donor Actions */}
            {user?.role === UserRole.DONOR && (
                <>
                    {posting.status === FoodStatus.PICKUP_VERIFICATION_PENDING && (
                        <button onClick={() => setShowVerificationModal(true)} className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black py-4 rounded-2xl uppercase text-xs tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-amber-200 animate-pulse transition-all">
                            Review Pickup Proof
                        </button>
                    )}
                    
                    {/* Cancel Donation Button (For Donors when Available or Requested) */}
                    {(posting.status === FoodStatus.AVAILABLE || posting.status === FoodStatus.REQUESTED) && (
                         <button onClick={() => setShowCancelConfirmation(true)} className="w-full bg-rose-50 hover:bg-rose-100 border-2 border-rose-100 text-rose-500 hover:text-rose-600 font-black py-4 rounded-2xl uppercase text-xs tracking-widest flex items-center justify-center gap-2 transition-all shadow-sm">
                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                             Cancel Donation
                         </button>
                    )}
                </>
            )}

            {/* Requester Actions: Upload Verification */}
            {user?.role === UserRole.REQUESTER && posting.status === FoodStatus.IN_TRANSIT && (
                <button 
                  onClick={() => !posting.verificationImageUrl && fileInputRef.current?.click()} 
                  disabled={isVerifying}
                  className={`w-full font-black py-4 rounded-2xl uppercase text-xs tracking-widest flex items-center justify-center gap-2 shadow-lg transition-all bg-teal-600 hover:bg-teal-700 text-white shadow-teal-200 hover:-translate-y-0.5`}
                >
                  {isVerifying ? 'Uploading...' : 'Confirm Receipt & Upload Proof'}
                </button>
            )}
            
            {/* Requester Verification of Volunteer Upload */}
            {user?.role === UserRole.REQUESTER && posting.status === FoodStatus.DELIVERY_VERIFICATION_PENDING && (
                <button onClick={() => setShowVerificationModal(true)} className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white font-black py-4 rounded-2xl uppercase text-xs tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-purple-200 animate-pulse transition-all">
                    Review Delivery Proof
                </button>
            )}
            
            {user?.role === UserRole.REQUESTER && posting.status === FoodStatus.DELIVERED && !hasRated && onRateVolunteer && posting.volunteerId && (
                <button onClick={() => setShowRating(true)} className="w-full bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-black py-4 rounded-2xl uppercase text-xs tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-yellow-200 hover:-translate-y-0.5 transition-all">
                    Rate Volunteer
                </button>
            )}

            {/* Inputs */}
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleVerificationUpload} />
            <input type="file" ref={pickupInputRef} className="hidden" accept="image/*" onChange={handlePickupUpload} />
          </div>
      </div>

      {/* Modals */}
      {showDirections && (
          <DirectionsModal 
            origin={getOriginString()} 
            destination={getDestinationString()} 
            waypoint={getPickupString()}
            onClose={() => setShowDirections(false)} 
          />
      )}
      {showTracking && (
          <LiveTrackingModal
            posting={posting}
            onClose={() => setShowTracking(false)}
          />
      )}
      {showRating && posting.volunteerName && onRateVolunteer && (
          <RatingModal
             volunteerName={posting.volunteerName}
             onClose={() => setShowRating(false)}
             onSubmit={(rating, feedback) => {
                 onRateVolunteer(posting.id, rating, feedback);
                 setShowRating(false);
             }}
          />
      )}
      {showPreview && (posting.pickupVerificationImageUrl || posting.verificationImageUrl) && (
          <div className="fixed inset-0 z-[300] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in-up" onClick={() => setShowPreview(false)}>
              <div className="relative max-w-5xl max-h-[90vh] w-full flex items-center justify-center">
                  <img src={posting.status === FoodStatus.DELIVERY_VERIFICATION_PENDING ? posting.verificationImageUrl : posting.pickupVerificationImageUrl} className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl ring-1 ring-white/10" onClick={(e) => e.stopPropagation()} />
                  <button onClick={() => setShowPreview(false)} className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors bg-white/10 hover:bg-white/20 p-3 rounded-full backdrop-blur-md">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
              </div>
          </div>
      )}
      {showVerificationModal && (
          <VerificationRequestModal 
             posting={posting}
             onApprove={handleApprove}
             onReject={handleReject}
          />
      )}
      {showCancelConfirmation && (
        <div className="fixed inset-0 z-[300] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in-up">
            <div className="bg-white rounded-3xl w-full max-w-sm p-8 shadow-2xl text-center">
                <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </div>
                <h3 className="text-xl font-black text-slate-800 mb-2">Cancel Donation?</h3>
                <p className="text-slate-500 text-sm font-medium mb-8 leading-relaxed">
                    Are you sure? This will remove the posting and notify any assigned volunteers or requesters.
                </p>
                <div className="flex gap-3">
                    <button onClick={() => setShowCancelConfirmation(false)} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl transition-colors uppercase text-xs tracking-wider">Keep It</button>
                    <button onClick={handleConfirmDelete} className="flex-1 py-3 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-2xl transition-colors shadow-lg shadow-rose-200 uppercase text-xs tracking-wider">Yes, Cancel</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default FoodCard;
