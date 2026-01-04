
import React, { useEffect, useRef } from 'react';
import { FoodPosting, FoodStatus } from '../types';

declare const L: any;

interface PostingsMapProps {
  postings: FoodPosting[];
  onPostingSelect?: (postingId: string) => void;
  userLocation?: { lat: number; lng: number };
}

// Haversine formula for client-side distance calc
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

const PostingsMap: React.FC<PostingsMapProps> = ({ postings, onPostingSelect, userLocation }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polylinesRef = useRef<any[]>([]);

  useEffect(() => {
    if (mapContainerRef.current && !mapInstanceRef.current) {
      const initialLat = userLocation?.lat || 20.5937;
      const initialLng = userLocation?.lng || 78.9629;
      const map = L.map(mapContainerRef.current, { zoomControl: false }).setView([initialLat, initialLng], 12);
      
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19
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

  // Update map center if user location changes significantly
  useEffect(() => {
      if (mapInstanceRef.current && userLocation) {
          mapInstanceRef.current.setView([userLocation.lat, userLocation.lng], 13);
      }
  }, [userLocation]);

  // Update markers and active tracking
  useEffect(() => {
      if (!mapInstanceRef.current) return;
      const map = mapInstanceRef.current;

      // Clear existing layers
      markersRef.current.forEach(marker => map.removeLayer(marker));
      markersRef.current = [];
      polylinesRef.current.forEach(line => map.removeLayer(line));
      polylinesRef.current = [];

      // Add User Location Marker
      if (userLocation) {
          const userIcon = L.divIcon({
              className: 'custom-user-marker',
              html: `<div style="width: 20px; height: 20px; background-color: #3b82f6; border: 3px solid white; border-radius: 50%; box-shadow: 0 4px 6px rgba(0,0,0,0.2);"></div>`,
              iconSize: [20, 20],
              iconAnchor: [10, 10]
          });
          const userMarker = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
            .addTo(map)
            .bindPopup("You are here");
          markersRef.current.push(userMarker);
      }

      postings.forEach(post => {
          // --- 1. Posting Marker (Food Location) ---
          if (post.location?.lat && post.location?.lng) {
              const isUrgent = new Date(post.expiryDate).getTime() - Date.now() < 12 * 60 * 60 * 1000;
              const color = isUrgent ? '#f43f5e' : '#10b981'; // Rose for urgent, Emerald for normal
              const iconEmoji = post.foodCategory === 'Veg' ? '🥗' : '🍱';

              const customIcon = L.divIcon({
                  className: 'custom-map-marker',
                  html: `
                    <div style="position: relative;">
                        <div style="background-color: ${color}; width: 40px; height: 40px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.2);">
                            <div style="transform: rotate(45deg); font-size: 20px;">${iconEmoji}</div>
                        </div>
                    </div>
                  `,
                  iconSize: [40, 40],
                  iconAnchor: [20, 40],
                  popupAnchor: [0, -40]
              });

              const popupContent = `
                <div class="font-sans min-w-[220px] bg-white rounded-xl overflow-hidden shadow-sm">
                    <div class="relative h-28 w-full bg-slate-100">
                        <img src="${post.imageUrl || ''}" class="w-full h-full object-cover" style="display: block;" onerror="this.style.display='none'"/>
                        <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                        <span class="absolute top-2 right-2 bg-white/90 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide text-slate-800 shadow-sm">${post.quantity}</span>
                        <div class="absolute bottom-2 left-2 text-white">
                            <p class="text-[10px] font-bold opacity-90 uppercase tracking-wider mb-0.5">${post.foodCategory || 'Food'}</p>
                            <h3 class="font-bold text-sm leading-tight text-white shadow-black drop-shadow-md line-clamp-1">${post.foodName}</h3>
                        </div>
                    </div>
                    <div class="p-3">
                        <div class="flex items-start gap-2 mb-3">
                            <div class="mt-0.5 text-slate-400">
                                <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                            </div>
                            <p class="text-xs text-slate-600 font-medium leading-snug line-clamp-2">${post.location.line1}</p>
                        </div>
                        <div class="flex justify-between items-center gap-2">
                             <div class="flex items-center gap-1.5 ${isUrgent ? 'text-rose-600 bg-rose-50' : 'text-emerald-600 bg-emerald-50'} px-2 py-1 rounded-md">
                                <div class="w-1.5 h-1.5 rounded-full ${isUrgent ? 'bg-rose-500' : 'bg-emerald-500'}"></div>
                                <span class="text-[10px] font-black uppercase tracking-wide">${isUrgent ? 'Urgent' : 'Available'}</span>
                             </div>
                            <button onclick="document.dispatchEvent(new CustomEvent('selectPosting', { detail: '${post.id}' }))" class="flex-1 bg-slate-900 text-white text-[10px] font-bold px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors shadow-lg shadow-slate-200">
                                View Details
                            </button>
                        </div>
                    </div>
                </div>
              `;

              const marker = L.marker([post.location.lat, post.location.lng], { icon: customIcon })
                .addTo(map)
                .bindPopup(popupContent, { minWidth: 220, maxWidth: 220, closeButton: false });
              
              marker.on('click', () => {
                  marker.openPopup();
              });

              markersRef.current.push(marker);
          }

          // --- 2. Live Volunteer Marker (Active Missions) ---
          if (post.volunteerLocation?.lat && post.volunteerLocation?.lng && 
             (post.status === FoodStatus.IN_TRANSIT || post.status === FoodStatus.PICKUP_VERIFICATION_PENDING || post.status === FoodStatus.DELIVERY_VERIFICATION_PENDING)) {
              
              const vLat = post.volunteerLocation.lat;
              const vLng = post.volunteerLocation.lng;
              
              // Strong pulsing icon for active tracking
              const pulsingIcon = L.divIcon({
                className: 'volunteer-live-marker',
                html: `
                  <div style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">
                      <div style="position: absolute; inset: 0; background-color: #3b82f6; border-radius: 50%; opacity: 0.4; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
                      <div style="position: absolute; inset: -4px; background-color: #3b82f6; border-radius: 50%; opacity: 0.2; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite; animation-delay: 0.5s;"></div>
                      <div style="position: relative; z-index: 10; background-color: #3b82f6; width: 36px; height: 36px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2); font-size: 18px;">
                          🚴
                      </div>
                      <div style="position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background-color: #ef4444; color: white; font-size: 8px; font-weight: 900; padding: 2px 6px; border-radius: 99px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.1); white-space: nowrap; z-index: 20;">
                          LIVE
                      </div>
                  </div>
                  <style>
                    @keyframes ping {
                      75%, 100% { transform: scale(1.5); opacity: 0; }
                    }
                  </style>
                `,
                iconSize: [44, 44],
                iconAnchor: [22, 22]
              });

              const vMarker = L.marker([vLat, vLng], { icon: pulsingIcon, zIndexOffset: 1000 })
                  .addTo(map);

              // Calculate ETA and Draw Line
              let targetLat = post.location.lat!;
              let targetLng = post.location.lng!;
              let targetLabel = "Pickup Point";
              let statusLabel = "Heading to Pickup";

              // Determine destination based on flow
              // If status is IN_TRANSIT, it usually implies post-pickup in this simplified model, 
              // or we need a flag. For this app logic:
              // If we have verification pending or if requesterAddress is set and status is IN_TRANSIT, we might be delivering.
              // A simple heuristic: if status is IN_TRANSIT and pickup is done (implicit), target is dropoff.
              // To correspond with FoodCard logic:
              if (post.requesterAddress?.lat && post.requesterAddress?.lng && post.status !== FoodStatus.PICKUP_VERIFICATION_PENDING) {
                   targetLat = post.requesterAddress.lat;
                   targetLng = post.requesterAddress.lng;
                   targetLabel = "Dropoff Point";
                   statusLabel = "Delivering Order";
              }
              
              if (post.status === FoodStatus.PICKUP_VERIFICATION_PENDING) {
                  statusLabel = "Verifying Pickup";
              } else if (post.status === FoodStatus.DELIVERY_VERIFICATION_PENDING) {
                  statusLabel = "Verifying Delivery";
              }

              const distanceKm = calculateDistance(vLat, vLng, targetLat, targetLng);
              const etaMins = Math.ceil((distanceKm / 20) * 60); // Approx 20km/h avg speed for city delivery

              vMarker.bindPopup(`
                 <div class="text-center min-w-[140px] font-sans p-1">
                    <p class="text-[10px] font-black uppercase text-blue-600 tracking-widest mb-1">Live Tracking</p>
                    <p class="font-bold text-sm text-slate-800 mb-1">${post.volunteerName}</p>
                    <p class="text-[10px] text-slate-500 font-bold uppercase mb-2">${statusLabel}</p>
                    
                    <div class="flex items-center justify-center gap-2 text-xs border-t border-slate-100 pt-2 mt-2">
                        <div class="text-center">
                            <span class="block font-black text-slate-800">${distanceKm.toFixed(1)} km</span>
                            <span class="text-[9px] text-slate-400 font-bold uppercase">Dist</span>
                        </div>
                        <div class="w-px h-6 bg-slate-100"></div>
                        <div class="text-center">
                            <span class="block font-black text-emerald-600">~${etaMins} min</span>
                            <span class="text-[9px] text-slate-400 font-bold uppercase">ETA</span>
                        </div>
                    </div>
                 </div>
              `, { closeButton: false, offset: [0, -20] });
              
              // Open popup by default for high visibility
              vMarker.openPopup();

              markersRef.current.push(vMarker);

              // Draw dashed line to target
              const polyline = L.polyline([[vLat, vLng], [targetLat, targetLng]], {
                  color: '#3b82f6',
                  weight: 4,
                  opacity: 0.6,
                  dashArray: '10, 15',
                  lineCap: 'round'
              }).addTo(map);
              
              polylinesRef.current.push(polyline);
          }
      });
  }, [postings, userLocation]);

  // Listen for custom event from popup button
  useEffect(() => {
      const handleSelect = (e: any) => {
          if (onPostingSelect) onPostingSelect(e.detail);
      };
      document.addEventListener('selectPosting', handleSelect);
      return () => document.removeEventListener('selectPosting', handleSelect);
  }, [onPostingSelect]);

  return <div ref={mapContainerRef} className="h-full w-full rounded-[2rem] shadow-inner bg-slate-100 border border-slate-200" />;
};

export default PostingsMap;
