
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
                  const isUrgent = new Date(post.expiryDate).getTime() - Date.now() < 12 * 60 * 60 * 1000;
                  
                  let color, emoji;
                  if (isClothes) {
                      color = '#6366f1'; // Indigo for clothes
                      emoji = '👕';
                  } else {
                      color = isUrgent ? '#f43f5e' : '#10b981'; // Rose/Emerald for food
                      emoji = post.foodCategory === 'Veg' ? '🥗' : '🍱';
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
                    ">
                        <div style="transform: rotate(45deg); font-size: 20px;">${emoji}</div>
                    </div>
                  `;

                  const foodIcon = L.divIcon({
                      className: 'custom-food-marker',
                      html: iconHtml,
                      iconSize: [40, 48],
                      iconAnchor: [20, 48],
                      popupAnchor: [0, -48]
                  });

                  const marker = L.marker([post.location.lat, post.location.lng], { icon: foodIcon })
                      .addTo(group);

                  // Custom Popup Content
                  const popupContent = document.createElement('div');
                  popupContent.innerHTML = `
                    <div style="font-family: 'Plus Jakarta Sans', sans-serif; min-width: 200px;">
                        ${post.imageUrl ? `<div style="height: 120px; width: 100%; margin-bottom: 8px; border-radius: 8px; overflow: hidden;"><img src="${post.imageUrl}" style="width: 100%; height: 100%; object-fit: cover;" /></div>` : ''}
                        <h3 style="font-weight: 800; font-size: 14px; margin: 0; color: #0f172a;">${post.foodName}</h3>
                        <p style="font-size: 11px; color: #64748b; margin: 4px 0 8px;">${post.quantity} • ${post.donorOrg || post.donorName}</p>
                        <button id="view-btn-${post.id}" style="width: 100%; background: ${isClothes ? '#4f46e5' : '#059669'}; color: white; border: none; padding: 8px; border-radius: 6px; font-weight: 700; font-size: 11px; cursor: pointer; text-transform: uppercase;">View Details</button>
                    </div>
                  `;
                  
                  // Handle click inside popup
                  popupContent.querySelector(`#view-btn-${post.id}`)?.addEventListener('click', () => {
                      if (onPostingSelect) onPostingSelect(post.id);
                  });

                  marker.bindPopup(popupContent);
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
          
          <style>{`
            .leaflet-popup-content-wrapper { border-radius: 12px; padding: 0; overflow: hidden; }
            .leaflet-popup-content { margin: 12px; }
            @keyframes ping {
                75%, 100% { transform: scale(2); opacity: 0; }
            }
          `}</style>
      </div>
  );
};

export default PostingsMap;
