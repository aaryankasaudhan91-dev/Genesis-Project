
import React, { useEffect, useRef } from 'react';
import { User } from '../types';

declare const L: any;

interface RequesterMapProps {
  requesters: User[];
  currentLocation?: { lat: number; lng: number };
}

const RequesterMap: React.FC<RequesterMapProps> = ({ requesters, currentLocation }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  useEffect(() => {
    if (mapContainerRef.current && !mapInstanceRef.current) {
      const initialLat = currentLocation?.lat || 20.5937;
      const initialLng = currentLocation?.lng || 78.9629;
      const map = L.map(mapContainerRef.current, { zoomControl: false }).setView([initialLat, initialLng], 12);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(map);
      mapInstanceRef.current = map;
    }
    
    return () => { 
        if (mapInstanceRef.current) {
            mapInstanceRef.current.remove(); 
            mapInstanceRef.current = null; 
        }
    };
  }, []); // Run once on mount

  // Update map view if current location changes
  useEffect(() => {
      if (mapInstanceRef.current && currentLocation) {
          mapInstanceRef.current.setView([currentLocation.lat, currentLocation.lng], 12);
      }
  }, [currentLocation]);

  // Update markers
  useEffect(() => {
      if (!mapInstanceRef.current) return;
      const map = mapInstanceRef.current;

      // Clear existing markers
      markersRef.current.forEach(marker => map.removeLayer(marker));
      markersRef.current = [];

      requesters.forEach(user => {
          if (user.address?.lat && user.address?.lng) {
              const popupContent = `
                <div class="font-sans min-w-[150px]">
                    <div class="flex items-center gap-2 mb-1">
                        <span class="text-lg">🏠</span>
                        <h3 class="font-bold text-slate-800 text-sm">${user.orgName || user.name}</h3>
                    </div>
                    <p class="text-xs text-slate-500 mb-1">${user.address.line1}, ${user.address.line2}</p>
                    <span class="inline-block px-2 py-0.5 bg-orange-100 text-orange-700 text-[10px] font-bold rounded-full uppercase tracking-wide border border-orange-200">
                        ${user.orgCategory || 'Requester'}
                    </span>
                </div>
              `;

              const marker = L.marker([user.address.lat, user.address.lng])
                .addTo(map)
                .bindPopup(popupContent);
              
              markersRef.current.push(marker);
          }
      });
  }, [requesters]);

  return <div ref={mapContainerRef} className="h-full w-full rounded-2xl shadow-lg border border-slate-200 bg-slate-100" />;
};

export default RequesterMap;
