
import React, { useEffect, useRef } from 'react';
import { Address } from '../types';

declare const L: any;

interface TrackingMapProps {
  pickupLocation: Address;
  donorName: string;
  dropoffLocation?: Address;
  volunteerLocation?: { lat: number; lng: number };
}

const TrackingMap: React.FC<TrackingMapProps> = ({ pickupLocation, donorName, dropoffLocation, volunteerLocation }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  useEffect(() => {
    if (mapContainerRef.current && !mapInstanceRef.current) {
      const lat = pickupLocation.lat || 20.5937;
      const lng = pickupLocation.lng || 78.9629;
      const map = L.map(mapContainerRef.current, { zoomControl: false }).setView([lat, lng], 13);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(map);
      mapInstanceRef.current = map;
    }
    
    return () => { 
        if (mapInstanceRef.current) {
            mapInstanceRef.current.remove(); 
            mapInstanceRef.current = null; 
        }
    };
  }, []);

  useEffect(() => {
      if (!mapInstanceRef.current) return;
      const map = mapInstanceRef.current;

      // Clear existing markers
      markersRef.current.forEach(m => map.removeLayer(m));
      markersRef.current = [];

      // Add Pickup Marker
      if (pickupLocation.lat && pickupLocation.lng) {
          const pickupPopup = `
            <div class="font-sans">
                <p class="text-[10px] font-black uppercase text-emerald-600 tracking-widest mb-1">Pickup Location</p>
                <p class="font-bold text-sm text-slate-800">${donorName}</p>
                <p class="text-xs text-slate-500">${pickupLocation.line1}</p>
            </div>
          `;
          const m = L.marker([pickupLocation.lat, pickupLocation.lng])
            .addTo(map)
            .bindPopup(pickupPopup);
          markersRef.current.push(m);
      }

      // Add Dropoff Marker
      if (dropoffLocation?.lat && dropoffLocation?.lng) {
          const dropoffPopup = `
            <div class="font-sans">
                <p class="text-[10px] font-black uppercase text-orange-600 tracking-widest mb-1">Dropoff Location</p>
                <p class="font-bold text-sm text-slate-800">Destination</p>
                <p class="text-xs text-slate-500">${dropoffLocation.line1}</p>
            </div>
          `;
          const m = L.marker([dropoffLocation.lat, dropoffLocation.lng])
            .addTo(map)
            .bindPopup(dropoffPopup);
          markersRef.current.push(m);
      }

      // Add Volunteer Marker
      if (volunteerLocation?.lat && volunteerLocation?.lng) {
          const volPopup = `
            <div class="font-sans">
                <p class="text-[10px] font-black uppercase text-blue-600 tracking-widest mb-1">Live Location</p>
                <p class="font-bold text-sm text-slate-800">Volunteer</p>
            </div>
          `;
          const m = L.marker([volunteerLocation.lat, volunteerLocation.lng])
            .addTo(map)
            .bindPopup(volPopup);
          markersRef.current.push(m);
      }

  }, [pickupLocation, donorName, dropoffLocation, volunteerLocation]);

  return <div ref={mapContainerRef} className="h-full w-full rounded-xl" />;
};

export default TrackingMap;
