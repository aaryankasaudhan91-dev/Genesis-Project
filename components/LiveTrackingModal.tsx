
import React, { useEffect, useRef, useState } from 'react';
import { FoodPosting, FoodStatus } from '../types';
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
  const [trackingStats, setTrackingStats] = useState<{dist: string, time: string} | null>(null);

  // Poll for updates
  useEffect(() => {
    const interval = setInterval(async () => {
      // Fix: Await storage.getPostings() before calling .find() to correctly handle Promise return type
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
            zoomControl: false, // We'll add custom control or rely on gestures
            attributionControl: false
        });

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

      const { location: pickup, requesterAddress: dropoff, volunteerLocation } = livePosting;
      const bounds = L.latLngBounds([]);

      // --- Helper to create HTML Icons ---
      const createIcon = (emoji: string, bgColor: string, ringColor: string, pulse: boolean = false) => {
          return L.divIcon({
              className: 'custom-map-icon',
              html: `
                <div class="relative w-10 h-10 flex items-center justify-center">
                    ${pulse ? `<div class="absolute inset-0 bg-${ringColor} rounded-full animate-ping opacity-75"></div>` : ''}
                    <div class="relative w-10 h-10 bg-${bgColor} rounded-full border-4 border-white shadow-lg flex items-center justify-center text-xl z-10">
                        ${emoji}
                    </div>
                    <div class="absolute -bottom-1 w-2 h-2 bg-slate-400 rotate-45"></div>
                </div>
              `,
              iconSize: [40, 40],
              iconAnchor: [20, 42], // Tip of the "pin"
              popupAnchor: [0, -45]
          });
      };

      // 1. Pickup Marker
      if (pickup?.lat && pickup?.lng) {
          const latLng = L.latLng(pickup.lat, pickup.lng);
          if (!layersRef.current.pickupMarker) {
              layersRef.current.pickupMarker = L.marker(latLng, {
                  icon: L.divIcon({
                      className: '',
                      html: `<div style="background-color: #10b981; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">🏠</div>`,
                      iconSize: [32, 32],
                      iconAnchor: [16, 16]
                  })
              }).addTo(map).bindPopup("<b>Pickup:</b> " + livePosting.donorName);
          } else {
              layersRef.current.pickupMarker.setLatLng(latLng);
          }
          bounds.extend(latLng);
      }

      // 2. Dropoff Marker
      if (dropoff?.lat && dropoff?.lng) {
          const latLng = L.latLng(dropoff.lat, dropoff.lng);
          if (!layersRef.current.dropoffMarker) {
              layersRef.current.dropoffMarker = L.marker(latLng, {
                  icon: L.divIcon({
                      className: '',
                      html: `<div style="background-color: #f97316; width: 40px; height: 40px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 4px 6px rgba(0,0,0,0.1);"><div style="transform: rotate(45deg); font-size: 20px;">📍</div></div>`,
                      iconSize: [40, 40],
                      iconAnchor: [20, 40],
                      popupAnchor: [0, -40]
                  })
              }).addTo(map).bindPopup("<b>Dropoff:</b> " + (livePosting.orphanageName || "Requester"));
          } else {
              layersRef.current.dropoffMarker.setLatLng(latLng);
          }
          bounds.extend(latLng);
      }

      // 3. Volunteer Marker (Moving)
      if (volunteerLocation?.lat && volunteerLocation?.lng) {
          const latLng = L.latLng(volunteerLocation.lat, volunteerLocation.lng);
          
          if (!layersRef.current.volunteerMarker) {
              layersRef.current.volunteerMarker = L.marker(latLng, {
                  icon: L.divIcon({
                      className: '',
                      html: `
                        <div style="position: relative; width: 48px; height: 48px;">
                            <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(59, 130, 246, 0.3); border-radius: 50%; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
                            <div style="position: relative; width: 48px; height: 48px; background-color: #3b82f6; border-radius: 50%; border: 4px solid white; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3); display: flex; align-items: center; justify-content: center; font-size: 24px;">
                                🚴
                            </div>
                        </div>
                      `,
                      iconSize: [48, 48],
                      iconAnchor: [24, 24],
                      popupAnchor: [0, -24]
                  }),
                  zIndexOffset: 1000
              }).addTo(map).bindPopup("<b>Volunteer:</b> " + (livePosting.volunteerName || "On the way"));
          } else {
              layersRef.current.volunteerMarker.setLatLng(latLng);
          }
          bounds.extend(latLng);

          // Update Polyline (Volunteer -> Dropoff)
          if (dropoff?.lat && dropoff?.lng) {
              const dist = calculateDistance(volunteerLocation.lat, volunteerLocation.lng, dropoff.lat, dropoff.lng);
              const timeMin = Math.ceil((dist / 20) * 60); // Assuming 20km/h avg speed
              setTrackingStats({ dist: dist.toFixed(1), time: timeMin.toString() });

              const path = [
                  [volunteerLocation.lat, volunteerLocation.lng],
                  [dropoff.lat, dropoff.lng]
              ] as L.LatLngExpression[];

              if (!layersRef.current.routeLine) {
                  layersRef.current.routeLine = L.polyline(path, {
                      color: '#3b82f6',
                      weight: 5,
                      opacity: 0.6,
                      dashArray: '10, 10',
                      lineCap: 'round'
                  }).addTo(map);
              } else {
                  layersRef.current.routeLine.setLatLngs(path);
              }
          }
      }

      // Fit bounds nicely
      if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [80, 80], maxZoom: 16 });
      }

  }, [livePosting]);

  const handleRecenter = () => {
      const map = mapInstanceRef.current;
      const { volunteerLocation } = livePosting;
      if (map && volunteerLocation?.lat && volunteerLocation?.lng) {
          map.flyTo([volunteerLocation.lat, volunteerLocation.lng], 16, { duration: 1.5 });
      }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in-up">
      <div className="bg-white rounded-[2.5rem] w-full max-w-lg h-[700px] max-h-[90vh] flex flex-col overflow-hidden shadow-2xl relative border border-slate-200">
        
        {/* Header Overlay */}
        <div className="absolute top-0 left-0 right-0 p-6 z-[400] flex justify-between items-start pointer-events-none">
             <div className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-2xl shadow-lg border border-slate-100 pointer-events-auto">
                 <h3 className="font-black text-slate-800 text-sm uppercase tracking-wide flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                    Live Tracking
                 </h3>
                 <p className="text-xs text-slate-500 font-bold">{livePosting.foodName}</p>
             </div>
             <button onClick={onClose} className="bg-white hover:bg-slate-100 text-slate-900 p-3 rounded-full shadow-lg font-bold transition-colors pointer-events-auto border border-slate-100">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
             </button>
        </div>
        
        {/* Map Container */}
        <div ref={mapContainerRef} className="flex-1 w-full h-full bg-slate-100 z-0" />
        
        {/* Recenter Button */}
        <div className="absolute bottom-64 right-6 z-[400]">
            <button onClick={handleRecenter} className="bg-white hover:bg-blue-50 text-blue-600 p-3 rounded-2xl shadow-xl border border-slate-100 transition-transform active:scale-95">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </button>
        </div>

        {/* Bottom Sheet */}
        <div className="bg-white p-6 border-t border-slate-100 z-[400] shadow-[0_-10px_40px_rgba(0,0,0,0.05)] rounded-t-[2.5rem] -mt-6 relative">
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6"></div>
            
            {trackingStats ? (
                <div className="flex items-center gap-4 mb-6">
                    <div className="flex-1 bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col items-center justify-center">
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Distance</p>
                        <p className="text-2xl font-black text-slate-800">{trackingStats.dist}<span className="text-sm text-slate-400 ml-1">km</span></p>
                    </div>
                    <div className="flex-1 bg-blue-50 p-4 rounded-2xl border border-blue-100 flex flex-col items-center justify-center">
                        <p className="text-[10px] font-black uppercase text-blue-400 tracking-widest mb-1">Est. Time</p>
                        <p className="text-2xl font-black text-blue-600">{trackingStats.time}<span className="text-sm text-blue-400 ml-1">min</span></p>
                    </div>
                </div>
            ) : (
                <div className="text-center py-4">
                    <p className="text-slate-400 text-sm font-bold animate-pulse">Calculating delivery stats...</p>
                </div>
            )}

            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 flex items-center gap-4">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-2xl shadow-sm">
                    {livePosting.volunteerLocation ? '🚴' : '⏳'}
                </div>
                <div>
                    <p className="text-xs font-black uppercase text-slate-400 tracking-wider mb-0.5">Status Update</p>
                    <p className="text-slate-800 text-sm font-bold">
                        {livePosting.volunteerLocation ? (
                            `Volunteer is moving towards ${livePosting.orphanageName || "Destination"}`
                        ) : (
                            "Waiting for volunteer location signal..."
                        )}
                    </p>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default LiveTrackingModal;
