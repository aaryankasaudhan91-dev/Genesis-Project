
import React, { useEffect, useRef, useState } from 'react';
import { FoodPosting, User } from '../types';
import { storage } from '../services/storageService';
import * as L from 'leaflet';

interface LiveTrackingModalProps {
  posting: FoodPosting;
  onClose: () => void;
}

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
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

const LiveTrackingModal: React.FC<LiveTrackingModalProps> = ({ posting, onClose }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layersRef = useRef<{
      volunteerMarker?: L.Marker;
      pickupMarker?: L.Marker;
      dropoffMarker?: L.Marker;
      routeLine?: L.Polyline;
  }>({});
  
  const [livePosting, setLivePosting] = useState<FoodPosting>(posting);
  const [volunteer, setVolunteer] = useState<User | null>(null);
  const [trackingStats, setTrackingStats] = useState<{dist: string, time: string} | null>(null);
  const [progressPercent, setProgressPercent] = useState(0);

  // Fetch Volunteer Details
  useEffect(() => {
      if (posting.volunteerId) {
          storage.getUser(posting.volunteerId).then(setVolunteer);
      }
  }, [posting.volunteerId]);

  // Poll for updates
  useEffect(() => {
    const interval = setInterval(async () => {
      const postings = await storage.getPostings();
      const updated = postings.find(p => p.id === posting.id);
      if (updated) setLivePosting(updated);
    }, 2000);
    return () => clearInterval(interval);
  }, [posting.id]);

  // Initialize Map
  useEffect(() => {
    if (mapContainerRef.current && !mapInstanceRef.current) {
        const centerLat = posting.location.lat || 20.5937;
        const centerLng = posting.location.lng || 78.9629;

        const map = L.map(mapContainerRef.current, {
            center: [centerLat, centerLng],
            zoom: 13,
            zoomControl: false,
            attributionControl: false
        });

        // Use a clean, modern map style
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; CARTO',
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(map);

        mapInstanceRef.current = map;
    }

    return () => {
        if (mapInstanceRef.current) {
            mapInstanceRef.current.remove();
            mapInstanceRef.current = null;
        }
    };
  }, []);

  // Update Markers & Route
  useEffect(() => {
      const map = mapInstanceRef.current;
      if (!map) return;

      const { location: pickup, requesterAddress: dropoff, volunteerLocation, donationType } = livePosting;
      const bounds = L.latLngBounds([]);

      // 1. Pickup Marker (Donor)
      if (pickup?.lat && pickup?.lng) {
          const latLng = L.latLng(pickup.lat, pickup.lng);
          const isClothes = donationType === 'CLOTHES';
          const pickupIcon = isClothes ? '👕' : '🍱';
          const pickupColor = isClothes ? '#6366f1' : '#10b981';

          if (!layersRef.current.pickupMarker) {
              layersRef.current.pickupMarker = L.marker(latLng, {
                  icon: L.divIcon({
                      className: 'pickup-icon',
                      html: `<div style="background-color: ${pickupColor}; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.2); font-size: 18px;">${pickupIcon}</div>`,
                      iconSize: [36, 36],
                      iconAnchor: [18, 18]
                  })
              }).addTo(map).bindPopup("<b>Pickup:</b> " + livePosting.donorName);
          }
          bounds.extend(latLng);
      }

      // 2. Dropoff Marker (Requester)
      if (dropoff?.lat && dropoff?.lng) {
          const latLng = L.latLng(dropoff.lat, dropoff.lng);
          if (!layersRef.current.dropoffMarker) {
              layersRef.current.dropoffMarker = L.marker(latLng, {
                  icon: L.divIcon({
                      className: 'dropoff-icon',
                      html: `<div style="background-color: #f97316; width: 44px; height: 44px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 4px 10px rgba(249,115,22,0.3);"><div style="transform: rotate(45deg); font-size: 22px;">🏠</div></div>`,
                      iconSize: [44, 44],
                      iconAnchor: [22, 44],
                      popupAnchor: [0, -44]
                  })
              }).addTo(map).bindPopup("<b>Dropoff:</b> " + (livePosting.orphanageName || "Requester"));
          }
          bounds.extend(latLng);
      }

      // 3. Volunteer Marker (Moving)
      if (volunteerLocation?.lat && volunteerLocation?.lng) {
          const latLng = L.latLng(volunteerLocation.lat, volunteerLocation.lng);
          
          if (!layersRef.current.volunteerMarker) {
              // Custom Avatar Marker for Volunteer
              const avatarHtml = volunteer?.profilePictureUrl 
                ? `<img src="${volunteer.profilePictureUrl}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" />`
                : `<div style="width: 100%; height: 100%; background: #3b82f6; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; border-radius: 50%;">${volunteer?.name?.charAt(0) || 'V'}</div>`;

              layersRef.current.volunteerMarker = L.marker(latLng, {
                  icon: L.divIcon({
                      className: 'volunteer-marker',
                      html: `
                        <div style="position: relative; width: 56px; height: 56px;">
                            <div style="position: absolute; inset: -4px; background-color: rgba(59, 130, 246, 0.4); border-radius: 50%; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
                            <div style="position: relative; width: 56px; height: 56px; background-color: white; border-radius: 50%; border: 4px solid #3b82f6; box-shadow: 0 10px 20px rgba(59, 130, 246, 0.4); overflow: hidden;">
                                ${avatarHtml}
                            </div>
                            <div style="position: absolute; bottom: -5px; right: -5px; background: #3b82f6; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 14px; border: 2px solid white;">🛵</div>
                        </div>
                      `,
                      iconSize: [56, 56],
                      iconAnchor: [28, 28],
                      popupAnchor: [0, -28]
                  }),
                  zIndexOffset: 1000
              }).addTo(map);
          } else {
              layersRef.current.volunteerMarker.setLatLng(latLng);
          }
          bounds.extend(latLng);

          // Update Polyline & Stats
          if (dropoff?.lat && dropoff?.lng && pickup?.lat && pickup?.lng) {
              const currentDist = calculateDistance(volunteerLocation.lat, volunteerLocation.lng, dropoff.lat, dropoff.lng);
              const totalDist = calculateDistance(pickup.lat, pickup.lng, dropoff.lat, dropoff.lng);
              
              // Calculate Progress (Clamped 0-100)
              const percent = Math.max(0, Math.min(100, ((totalDist - currentDist) / totalDist) * 100));
              setProgressPercent(percent);

              const timeMin = Math.ceil((currentDist / 20) * 60); // Assuming 20km/h avg speed
              setTrackingStats({ dist: currentDist.toFixed(1), time: timeMin.toString() });

              const path = [
                  [volunteerLocation.lat, volunteerLocation.lng],
                  [dropoff.lat, dropoff.lng]
              ] as L.LatLngExpression[];

              if (!layersRef.current.routeLine) {
                  layersRef.current.routeLine = L.polyline(path, {
                      color: '#3b82f6',
                      weight: 5,
                      opacity: 0.8,
                      dashArray: '12, 12',
                      lineCap: 'round',
                      className: 'animated-route' // Defined in styles below
                  }).addTo(map);
              } else {
                  layersRef.current.routeLine.setLatLngs(path);
              }
          }
      }

      // Fit bounds nicely on first load or significant changes
      if (bounds.isValid() && !layersRef.current.volunteerMarker) {
          map.fitBounds(bounds, { padding: [80, 80], maxZoom: 16 });
      }

  }, [livePosting, volunteer]);

  const handleRecenter = () => {
      const map = mapInstanceRef.current;
      const { volunteerLocation } = livePosting;
      if (map && volunteerLocation?.lat && volunteerLocation?.lng) {
          map.flyTo([volunteerLocation.lat, volunteerLocation.lng], 16, { duration: 1.5 });
      }
  };

  const handleCall = () => {
      if (volunteer?.contactNo) {
          window.open(`tel:${volunteer.contactNo}`);
      } else {
          alert("Volunteer contact not available.");
      }
  };

  return (
    <div className="fixed inset-0 z-[1200] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in-up">
      <style>{`
        @keyframes dash-flow {
            to { stroke-dashoffset: -24; }
        }
        .animated-route {
            animation: dash-flow 1s linear infinite;
        }
      `}</style>
      
      <div className="bg-white rounded-[2.5rem] w-full max-w-lg h-[750px] max-h-[90vh] flex flex-col overflow-hidden shadow-2xl relative border border-slate-200">
        
        {/* Header Overlay */}
        <div className="absolute top-0 left-0 right-0 p-6 z-[400] flex justify-between items-start pointer-events-none">
             <div className="bg-white/90 backdrop-blur-md px-4 py-2.5 rounded-2xl shadow-lg border border-slate-100 pointer-events-auto">
                 <h3 className="font-black text-slate-800 text-xs uppercase tracking-wide flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                    </span>
                    Live Order
                 </h3>
                 <p className="text-xs text-slate-500 font-bold mt-0.5 truncate max-w-[150px]">{livePosting.foodName}</p>
             </div>
             <button onClick={onClose} className="bg-white hover:bg-slate-50 text-slate-900 p-3 rounded-full shadow-lg font-bold transition-colors pointer-events-auto border border-slate-100 group">
                <svg className="w-5 h-5 group-hover:rotate-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
             </button>
        </div>
        
        {/* Map Container */}
        <div ref={mapContainerRef} className="flex-1 w-full h-full bg-slate-100 z-0" />
        
        {/* Recenter Button */}
        <div className="absolute bottom-[280px] right-6 z-[400]">
            <button onClick={handleRecenter} className="bg-white hover:bg-blue-50 text-blue-600 p-3.5 rounded-2xl shadow-xl border border-slate-100 transition-transform active:scale-95">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </button>
        </div>

        {/* Bottom Sheet */}
        <div className="bg-white p-6 border-t border-slate-100 z-[400] shadow-[0_-10px_40px_rgba(0,0,0,0.08)] rounded-t-[2.5rem] -mt-6 relative">
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6"></div>
            
            {/* Volunteer Profile */}
            <div className="flex items-center gap-4 mb-6">
                <div className="relative">
                    {volunteer?.profilePictureUrl ? (
                        <img src={volunteer.profilePictureUrl} className="w-14 h-14 rounded-full object-cover border-2 border-slate-100" alt="Volunteer" />
                    ) : (
                        <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center text-xl font-black text-slate-400 border-2 border-slate-50">
                            {volunteer?.name?.charAt(0) || 'V'}
                        </div>
                    )}
                    <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border-2 border-white">
                        {volunteer?.averageRating?.toFixed(1) || '5.0'}★
                    </div>
                </div>
                <div className="flex-1">
                    <h4 className="font-black text-slate-800 text-lg">{volunteer?.name || 'Volunteer'}</h4>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Food Rescue Hero • 🛵 Scooter</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleCall} className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center hover:bg-emerald-200 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                    </button>
                    <button className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center hover:bg-blue-200 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                    </button>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-6">
                <div className="flex justify-between text-[10px] font-black uppercase text-slate-400 mb-2">
                    <span>Picked Up</span>
                    <span>On the way</span>
                    <span>Delivered</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden relative">
                    <div 
                        className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-400 to-emerald-400 transition-all duration-1000 ease-out rounded-full"
                        style={{ width: `${progressPercent}%` }}
                    ></div>
                </div>
            </div>
            
            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col items-center justify-center">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Distance</p>
                    <p className="text-xl font-black text-slate-800">{trackingStats ? trackingStats.dist : '--'}<span className="text-sm text-slate-400 ml-1">km</span></p>
                </div>
                <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex flex-col items-center justify-center">
                    <p className="text-[10px] font-black uppercase text-blue-400 tracking-widest mb-1">Est. Time</p>
                    <p className="text-xl font-black text-blue-600">{trackingStats ? trackingStats.time : '--'}<span className="text-sm text-blue-400 ml-1">min</span></p>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default LiveTrackingModal;
