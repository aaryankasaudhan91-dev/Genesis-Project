
import React, { useEffect, useRef, useState } from 'react';
import { FoodPosting } from '../types';
import { storage } from '../services/storageService';
import { loadGoogleMaps } from '../services/mapLoader';

declare const google: any;

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
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polylineRef = useRef<any>(null);
  const [livePosting, setLivePosting] = useState<FoodPosting>(posting);
  const [trackingStats, setTrackingStats] = useState<{dist: string, time: string} | null>(null);
  const [error, setError] = useState(false);

  // Poll for updates
  useEffect(() => {
    const interval = setInterval(() => {
      const updated = storage.getPostings().find(p => p.id === posting.id);
      if (updated) setLivePosting(updated);
    }, 2000);
    return () => clearInterval(interval);
  }, [posting.id]);

  // Initialize Google Map
  useEffect(() => {
    let mounted = true;
    const handleAuthError = () => { if (mounted) setError(true); };
    window.addEventListener('google-maps-auth-failure', handleAuthError);

    loadGoogleMaps().then(() => {
        if (!mounted) return;
        if (mapContainerRef.current && !mapInstanceRef.current) {
            try {
                const centerLat = posting.location.lat || 20.5937;
                const centerLng = posting.location.lng || 78.9629;

                const map = new google.maps.Map(mapContainerRef.current, {
                    center: { lat: centerLat, lng: centerLng },
                    zoom: 13,
                    disableDefaultUI: true,
                    zoomControl: true,
                });
                mapInstanceRef.current = map;
                updateMap();
            } catch (e) {
                console.error("Map init failed", e);
                setError(true);
            }
        }
    }).catch((e) => {
        if (mounted) {
            console.warn("Google Maps load failed", e);
            setError(true);
        }
    });

    return () => {
        mounted = false;
        window.removeEventListener('google-maps-auth-failure', handleAuthError);
    };
  }, []);

  // Update Markers
  useEffect(() => {
      if (mapInstanceRef.current && !error) {
          updateMap();
      }
  }, [livePosting, error]);

  const updateMap = () => {
      const map = mapInstanceRef.current;
      if (!map) return;

      // Clear existing items
      markersRef.current.forEach(m => m.setMap(null));
      markersRef.current = [];
      if (polylineRef.current) polylineRef.current.setMap(null);

      const { location: pickup, requesterAddress: dropoff, volunteerLocation } = livePosting;

      const addMarker = (lat: number, lng: number, iconEmoji: string, color: string, title: string, isLive = false) => {
           const svgIcon = `
            <svg width="40" height="48" viewBox="0 0 40 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 48L4 28C-1.33333 21.3333 0 10 4 6C8 2 14 0 20 0C26 0 32 2 36 6C40 10 41.3333 21.3333 36 28L20 48Z" fill="${color}" stroke="white" stroke-width="2"/>
                <text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" font-size="20">${iconEmoji}</text>
            </svg>`;

           const marker = new google.maps.Marker({
               position: { lat, lng },
               map: map,
               title: title,
               icon: {
                   url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svgIcon),
                   scaledSize: new google.maps.Size(40, 48),
                   anchor: new google.maps.Point(20, 48)
               },
               zIndex: isLive ? 1000 : 1,
               animation: isLive ? google.maps.Animation.BOUNCE : null
           });
           
           // Stop bouncing after a few seconds to not be annoying
           if (isLive) setTimeout(() => marker.setAnimation(null), 3000);

           markersRef.current.push(marker);
      };

      // Pickup Marker
      if (pickup?.lat && pickup?.lng) {
          addMarker(pickup.lat, pickup.lng, '🏠', '#10b981', 'Pickup');
      }

      // Dropoff Marker
      if (dropoff?.lat && dropoff?.lng) {
          addMarker(dropoff.lat, dropoff.lng, '📍', '#f97316', 'Dropoff');
      }

      // Volunteer Marker & Polyline
      if (volunteerLocation?.lat && volunteerLocation?.lng) {
          addMarker(volunteerLocation.lat, volunteerLocation.lng, '🚴', '#3b82f6', 'Volunteer', true);
          
          // Pan map to volunteer
          map.panTo({ lat: volunteerLocation.lat, lng: volunteerLocation.lng });

          // Calculate stats and draw line if dropoff exists
          if (dropoff?.lat && dropoff?.lng) {
               const dist = calculateDistance(volunteerLocation.lat, volunteerLocation.lng, dropoff.lat, dropoff.lng);
               const timeMin = Math.ceil((dist / 20) * 60); // Approx 20km/h
               setTrackingStats({ dist: dist.toFixed(1), time: timeMin.toString() });

               const line = new google.maps.Polyline({
                   path: [
                       { lat: volunteerLocation.lat, lng: volunteerLocation.lng },
                       { lat: dropoff.lat, lng: dropoff.lng }
                   ],
                   geodesic: true,
                   strokeColor: '#3b82f6',
                   strokeOpacity: 0.7,
                   strokeWeight: 4,
                   icons: [{
                       icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3 },
                       offset: '0',
                       repeat: '20px'
                   }],
                   map: map
               });
               polylineRef.current = line;
          }
      }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-lg h-[600px] flex flex-col overflow-hidden shadow-2xl relative border border-slate-200">
        <div className="absolute top-4 right-4 z-[400]">
             <button onClick={onClose} className="bg-white hover:bg-slate-100 text-slate-900 p-2 rounded-full shadow-lg font-bold transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
             </button>
        </div>
        
        {error ? (
             <div className="flex-1 w-full h-full bg-slate-100 flex flex-col items-center justify-center text-center p-8">
                  <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mb-4 text-3xl">🗺️</div>
                  <h3 className="text-slate-700 font-bold mb-2">Map Unavailable</h3>
                  <p className="text-slate-500 text-sm">Please check your internet or API configuration.</p>
             </div>
        ) : (
             <div ref={mapContainerRef} className="flex-1 w-full h-full bg-slate-100" />
        )}
        
        <div className="bg-white p-6 border-t border-slate-100 z-[400] shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
            <h3 className="font-black text-lg uppercase mb-3 tracking-wide">Live Delivery Tracking</h3>
            
            {trackingStats ? (
                <div className="flex items-center gap-4 mb-4">
                    <div className="flex-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Distance</p>
                        <p className="text-xl font-black text-slate-800">{trackingStats.dist} km</p>
                    </div>
                    <div className="flex-1 bg-blue-50 p-3 rounded-xl border border-blue-100">
                        <p className="text-[10px] font-black uppercase text-blue-400 tracking-widest">Est. Time</p>
                        <p className="text-xl font-black text-blue-700">{trackingStats.time} min</p>
                    </div>
                </div>
            ) : null}

            <div className="flex items-center justify-between text-xs font-bold text-slate-600 mb-4">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-emerald-100"></div> Donor
                </div>
                <div className="flex items-center gap-2">
                     <div className="w-3 h-3 rounded-full bg-blue-500 ring-2 ring-blue-100"></div> Volunteer
                </div>
                <div className="flex items-center gap-2">
                     <div className="w-3 h-3 rounded-full bg-orange-500 ring-2 ring-orange-100"></div> You
                </div>
            </div>
            
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <p className="text-slate-800 text-sm font-bold flex items-center gap-2">
                    {livePosting.volunteerLocation ? (
                        <>
                            <span className="relative flex h-3 w-3 shrink-0">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                            </span>
                            <span className="truncate">Volunteer is {trackingStats ? `approx ${trackingStats.dist}km away` : 'moving'}.</span>
                        </>
                    ) : (
                        <>
                             <span className="w-3 h-3 rounded-full bg-slate-300"></span>
                             Waiting for volunteer signal...
                        </>
                    )}
                </p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default LiveTrackingModal;
