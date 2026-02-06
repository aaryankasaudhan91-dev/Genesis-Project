
import React, { useEffect, useRef, useState } from 'react';
import { FoodPosting, FoodStatus } from '../types';
import * as L from 'leaflet';

interface PostingsMapProps {
  postings: FoodPosting[];
  onPostingSelect?: (postingId: string) => void;
  userLocation?: { lat: number; lng: number };
}

const PostingsMap: React.FC<PostingsMapProps> = ({ postings, onPostingSelect, userLocation }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (mapContainerRef.current && !mapInstanceRef.current) {
        // Default center (Nagpur, India roughly center)
        const initialLat = userLocation?.lat || 20.5937;
        const initialLng = userLocation?.lng || 78.9629;
        const initialZoom = userLocation ? 13 : 5;

        const map = L.map(mapContainerRef.current, {
            center: [initialLat, initialLng],
            zoom: initialZoom,
            zoomControl: false,
            attributionControl: false
        });

        // Add CartoDB Voyager Tiles (Clean, modern look)
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OpenStreetMap &copy; CARTO',
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(map);

        L.control.zoom({ position: 'bottomright' }).addTo(map);

        mapInstanceRef.current = map;
        markersGroupRef.current = L.layerGroup().addTo(map);
    }

    return () => {
        if (mapInstanceRef.current) {
            mapInstanceRef.current.remove();
            mapInstanceRef.current = null;
        }
    };
  }, []); // Init once

  // Update Markers
  useEffect(() => {
      const map = mapInstanceRef.current;
      const group = markersGroupRef.current;
      
      if (map && group) {
          group.clearLayers();
          const bounds = L.latLngBounds([]);

          // User Location Marker
          if (userLocation) {
              const userIcon = L.divIcon({
                  className: 'custom-div-icon',
                  html: `
                    <div style="position: relative; width: 24px; height: 24px;">
                        <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background-color: #3b82f6; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.2);"></div>
                        <div style="position: absolute; top: -10px; left: -10px; width: 44px; height: 44px; background-color: rgba(59, 130, 246, 0.2); border-radius: 50%; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
                    </div>
                  `,
                  iconSize: [24, 24],
                  iconAnchor: [12, 12]
              });

              L.marker([userLocation.lat, userLocation.lng], { icon: userIcon, zIndexOffset: 1000 })
               .addTo(group)
               .bindPopup("You are here", { autoClose: false, closeButton: false });
               
              bounds.extend([userLocation.lat, userLocation.lng]);
          }

          // Food & Clothes Postings
          postings.forEach(post => {
              if (post.location?.lat && post.location?.lng) {
                  const isClothes = post.donationType === 'CLOTHES';
                  const isUrgent = post.status === FoodStatus.AVAILABLE && (new Date(post.expiryDate).getTime() - Date.now() < 12 * 60 * 60 * 1000);
                  const isRequested = post.status !== FoodStatus.AVAILABLE;
                  
                  let color = '#10b981'; // Default Emerald (Food Available)
                  let emoji = '🍱';
                  let ringColor = 'rgba(16, 185, 129, 0.3)';

                  // 1. Icon Selection
                  if (isClothes) {
                      emoji = '👕';
                  } else {
                      emoji = post.foodCategory === 'Veg' ? '🥗' : '🍱';
                  }

                  // 2. Status/Color Logic
                  if (isRequested) {
                      color = '#f59e0b'; // Amber for Requested/Busy
                      ringColor = 'rgba(245, 158, 11, 0.3)';
                  } else if (isUrgent) {
                      color = '#f43f5e'; // Rose for Urgent
                      ringColor = 'rgba(244, 63, 94, 0.3)';
                  } else if (isClothes) {
                      color = '#6366f1'; // Indigo for Clothes Available
                      ringColor = 'rgba(99, 102, 241, 0.3)';
                  }

                  const iconHtml = `
                    <div style="
                        background-color: ${color}; 
                        width: 40px; 
                        height: 48px; 
                        border-radius: 50% 50% 50% 0; 
                        transform: rotate(-45deg);
                        display: flex; 
                        align-items: center; 
                        justify-content: center; 
                        border: 3px solid white;
                        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.2);
                        transition: transform 0.2s;
                        position: relative;
                    ">
                        <div style="transform: rotate(45deg); font-size: 20px;">${emoji}</div>
                        ${isRequested ? `
                            <div style="position: absolute; top: -4px; right: -4px; width: 14px; height: 14px; background: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; transform: rotate(45deg);">
                                <div style="width: 8px; height: 8px; background: #f59e0b; border-radius: 50%;"></div>
                            </div>
                        ` : ''}
                    </div>
                  `;

                  const foodIcon = L.divIcon({
                      className: 'custom-food-marker group',
                      html: iconHtml,
                      iconSize: [40, 48],
                      iconAnchor: [20, 48],
                      popupAnchor: [0, -48]
                  });

                  const marker = L.marker([post.location.lat, post.location.lng], { icon: foodIcon })
                      .addTo(group);

                  // Create Rich Popup Content
                  const popupDiv = document.createElement('div');
                  popupDiv.style.fontFamily = '"Plus Jakarta Sans", sans-serif';
                  popupDiv.style.minWidth = '220px';
                  popupDiv.style.cursor = 'pointer';
                  
                  // Popup Badge Color
                  const badgeBg = isRequested ? '#fef3c7' : (isClothes ? '#e0e7ff' : '#d1fae5');
                  const badgeText = isRequested ? '#d97706' : (isClothes ? '#4338ca' : '#047857');
                  const badgeLabel = isRequested ? 'Requested' : (isClothes ? 'Clothes' : 'Food');

                  popupDiv.innerHTML = `
                    <div style="display: flex; gap: 12px; align-items: start;">
                        ${post.imageUrl ? `
                            <img src="${post.imageUrl}" style="width: 50px; height: 50px; border-radius: 10px; object-fit: cover; flex-shrink: 0; border: 1px solid #e2e8f0;" />
                        ` : `
                            <div style="width: 50px; height: 50px; border-radius: 10px; background: #f1f5f9; display: flex; align-items: center; justify-content: center; font-size: 20px;">${emoji}</div>
                        `}
                        <div style="flex: 1; min-width: 0;">
                            <h3 style="font-weight: 800; font-size: 14px; margin: 0 0 2px 0; color: #0f172a; line-height: 1.2;">${post.foodName}</h3>
                            <p style="font-size: 11px; color: #64748b; margin: 0 0 6px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${post.quantity} • ${post.donorOrg || post.donorName}</p>
                            <span style="
                                display: inline-block; 
                                padding: 2px 8px; 
                                border-radius: 4px; 
                                font-size: 9px; 
                                font-weight: 800; 
                                text-transform: uppercase; 
                                background: ${badgeBg}; 
                                color: ${badgeText};
                            ">
                                ${badgeLabel}
                            </span>
                        </div>
                    </div>
                    <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #f1f5f9; text-align: center;">
                        <span style="font-size: 11px; font-weight: 700; color: #3b82f6;">Tap to View Details &rarr;</span>
                    </div>
                  `;

                  // Make the entire popup clickable
                  popupDiv.addEventListener('click', () => {
                      if (onPostingSelect) {
                          onPostingSelect(post.id);
                          map.closePopup();
                      }
                  });

                  marker.bindPopup(popupDiv, {
                      closeButton: false, // Cleaner look
                      offset: L.point(0, -10)
                  });
                  
                  bounds.extend([post.location.lat, post.location.lng]);
              }
          });

          // Fit bounds if we have points
          if (bounds.isValid()) {
              map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
          }
      }
  }, [postings, userLocation]);

  const handleLocateMe = () => {
      setLocating(true);
      if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
              (pos) => {
                  const { latitude, longitude } = pos.coords;
                  if (mapInstanceRef.current) {
                      mapInstanceRef.current.flyTo([latitude, longitude], 15);
                  }
                  setLocating(false);
              },
              () => {
                  alert("Could not detect location.");
                  setLocating(false);
              }
          );
      } else {
          setLocating(false);
      }
  };

  return (
      <div className="h-full w-full relative rounded-[2rem] shadow-inner bg-slate-100 border border-slate-200 overflow-hidden group z-0">
          <div ref={mapContainerRef} className="h-full w-full z-0" />
          
          <button 
              onClick={handleLocateMe}
              disabled={locating}
              className="absolute top-4 right-4 z-[400] w-10 h-10 bg-white rounded-xl shadow-lg border border-slate-100 flex items-center justify-center text-slate-600 hover:text-blue-600 transition-colors"
              title="My Location"
          >
              {locating ? (
                  <svg className="animate-spin w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              )}
          </button>

          {/* Legend Overlay */}
          <div className="absolute bottom-4 left-4 z-[400] bg-white/95 backdrop-blur-md p-3 rounded-2xl shadow-xl border border-slate-100 max-w-[160px] animate-fade-in-up">
              <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3 border-b border-slate-100 pb-1">Map Legend</h4>
              <div className="space-y-2.5">
                  <div className="flex items-center gap-2.5">
                      <div className="w-3 h-3 bg-blue-500 rounded-full border border-white shadow-sm relative shrink-0">
                          <div className="absolute -inset-1 bg-blue-500/30 rounded-full animate-ping"></div>
                      </div>
                      <span className="text-[11px] font-bold text-slate-700">Your Location</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                      <div className="w-3 h-3 bg-emerald-500 rounded-full border border-white shadow-sm shrink-0"></div>
                      <span className="text-[11px] font-bold text-slate-700">Food (Available)</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                      <div className="w-3 h-3 bg-indigo-500 rounded-full border border-white shadow-sm shrink-0"></div>
                      <span className="text-[11px] font-bold text-slate-700">Clothes (Available)</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                      <div className="w-3 h-3 bg-amber-500 rounded-full border border-white shadow-sm shrink-0"></div>
                      <span className="text-[11px] font-bold text-slate-700">Requested / Taken</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                      <div className="w-3 h-3 bg-rose-500 rounded-full border border-white shadow-sm shrink-0"></div>
                      <span className="text-[11px] font-bold text-slate-700">Urgent</span>
                  </div>
              </div>
          </div>
          
          <style>{`
            .leaflet-popup-content-wrapper { border-radius: 16px; padding: 0; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0; }
            .leaflet-popup-content { margin: 16px; }
            .leaflet-popup-tip { background: white; border: 1px solid #e2e8f0; }
            @keyframes ping {
                75%, 100% { transform: scale(2); opacity: 0; }
            }
          `}</style>
      </div>
  );
};

export default PostingsMap;
