
import React, { useEffect, useRef, useState } from 'react';
import { FoodPosting } from '../types';
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
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const [livePosting, setLivePosting] = useState<FoodPosting>(posting);
  const [trackingStats, setTrackingStats] = useState<{dist: string, time: string} | null>(null);

  // Poll for updates
  useEffect(() => {
    const interval = setInterval(() => {
      const updated = storage.getPostings().find(p => p.id === posting.id);
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
            zoomControl: true,
            attributionControl: false
        });

        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; CARTO',
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(map);

        mapInstanceRef.current = map;
        layerGroupRef.current = L.layerGroup().addTo(map);
    }
  }, []);

  // Update Markers
  useEffect(() => {
      const map = mapInstanceRef.current;
      const group = layerGroupRef.current;

      if (map && group) {
          group.clearLayers();
          const bounds = L.latLngBounds([]);

          const { location: pickup, requesterAddress: dropoff, volunteerLocation } = livePosting;

          const createIcon = (emoji: string, color: string, isLive = false) => {
              const html = `
                <div style="font-size:24px; background:${color}; width:40px; height:40px; display:flex; align-items:center; justify-content:center; border-radius:50%; border:3px solid white; box-shadow:0 4px 6px rgba(0,0,0,0.1);">
                    ${isLive ? `<div style="position:absolute; top:0; left:0; width:100%; height:100%; border-radius:50%; background:${color}; opacity:0.3; animation:ping 1s cubic-bezier(0,0,0.2,1) infinite;"></div>` : ''}
                    <div style="position:relative; z-index:10;">${emoji}</div>
                </div>`;
              
              return L.divIcon({
                  className: 'live-tracking-icon',
                  html,
                  iconSize: [40, 40],
                  iconAnchor: [20, 20]
              });
          };

          // Pickup
          if (pickup?.lat && pickup?.lng) {
              L.marker([pickup.lat, pickup.lng], { icon: createIcon('🏠', '#10b981') })
               .addTo(group)
               .bindPopup("Pickup");
              bounds.extend([pickup.lat, pickup.lng]);
          }

          // Dropoff
          if (dropoff?.lat && dropoff?.lng) {
              L.marker([dropoff.lat, dropoff.lng], { icon: createIcon('📍', '#f97316') })
               .addTo(group)
               .bindPopup("Dropoff");
              bounds.extend([dropoff.lat, dropoff.lng]);
          }

          // Volunteer
          if (volunteerLocation?.lat && volunteerLocation?.lng) {
              const vMarker = L.marker([volunteerLocation.lat, volunteerLocation.lng], { 
                  icon: createIcon('🚴', '#3b82f6', true),
                  zIndexOffset: 1000
              }).addTo(group).bindPopup("Volunteer");
              
              bounds.extend([volunteerLocation.lat, volunteerLocation.lng]);
              map.panTo([volunteerLocation.lat, volunteerLocation.lng]);

              if (dropoff?.lat && dropoff?.lng) {
                   const dist = calculateDistance(volunteerLocation.lat, volunteerLocation.lng, dropoff.lat, dropoff.lng);
                   const timeMin = Math.ceil((dist / 20) * 60);
                   setTrackingStats({ dist: dist.toFixed(1), time: timeMin.toString() });

                   L.polyline([
                       [volunteerLocation.lat, volunteerLocation.lng],
                       [dropoff.lat, dropoff.lng]
                   ], { color: '#3b82f6', weight: 4, opacity: 0.7, dashArray: '10, 10' }).addTo(group);
              }
          }
      }
  }, [livePosting]);

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-lg h-[600px] flex flex-col overflow-hidden shadow-2xl relative border border-slate-200">
        <div className="absolute top-4 right-4 z-[400]">
             <button onClick={onClose} className="bg-white hover:bg-slate-100 text-slate-900 p-2 rounded-full shadow-lg font-bold transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
             </button>
        </div>
        
        <div ref={mapContainerRef} className="flex-1 w-full h-full bg-slate-100 z-0" />
        
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
        <style>{`
            @keyframes ping {
                75%, 100% { transform: scale(2); opacity: 0; }
            }
        `}</style>
      </div>
    </div>
  );
};

export default LiveTrackingModal;
