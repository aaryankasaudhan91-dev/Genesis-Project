
import React, { useEffect, useRef } from 'react';
import { reverseGeocodeGoogle, ReverseGeocodeResult } from '../services/mapLoader';
import * as L from 'leaflet';

interface LocationPickerMapProps {
  lat?: number;
  lng?: number;
  onLocationSelect: (lat: number, lng: number) => void;
  onAddressFound?: (address: ReverseGeocodeResult) => void;
  onLookupStart?: () => void; // New prop to signal start of geocoding
}

const LocationPickerMap: React.FC<LocationPickerMapProps> = ({ lat, lng, onLocationSelect, onAddressFound, onLookupStart }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // Initialize Map
  useEffect(() => {
    if (mapContainerRef.current && !mapInstanceRef.current) {
        const initialLat = lat || 20.5937;
        const initialLng = lng || 78.9629;

        // Ensure parent has values even if they didn't pass any
        if (lat === undefined || lng === undefined) {
            onLocationSelect(initialLat, initialLng);
        }

        const map = L.map(mapContainerRef.current, {
            center: [initialLat, initialLng],
            zoom: 15,
            zoomControl: false, // We will add zoom control manually if needed, or keep it minimal
            attributionControl: false
        });

        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OpenStreetMap &copy; CARTO',
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(map);

        const icon = L.divIcon({
            className: 'picker-icon',
            html: `<div style="font-size: 36px; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.3)); transform: translate(0, -10px);">📍</div>`,
            iconSize: [36, 36],
            iconAnchor: [18, 36]
        });

        const marker = L.marker([initialLat, initialLng], { 
            icon, 
            draggable: true 
        }).addTo(map);

        // Core logic to update location and fetch address
        const handlePositionChange = async (newLat: number, newLng: number) => {
            // 1. Update numeric coordinates immediately
            onLocationSelect(newLat, newLng);
            
            // 2. Signal start of address lookup
            if (onLookupStart) onLookupStart();

            // 3. Fetch address
            if (onAddressFound) {
                const addr = await reverseGeocodeGoogle(newLat, newLng);
                if (addr) onAddressFound(addr);
            }
        };

        // Event: Dragging the marker
        marker.on('dragend', (e) => {
            const pos = e.target.getLatLng();
            handlePositionChange(pos.lat, pos.lng);
            map.panTo(pos);
        });

        // Event: Clicking the map
        map.on('click', (e) => {
            const { lat, lng } = e.latlng;
            marker.setLatLng([lat, lng]);
            map.panTo([lat, lng]);
            handlePositionChange(lat, lng);
        });

        markerRef.current = marker;
        mapInstanceRef.current = map;
    }
  }, []); // Run once on mount

  // React to prop changes (e.g. Auto Detect from parent)
  useEffect(() => {
      if (mapInstanceRef.current && markerRef.current && lat && lng) {
          const curPos = markerRef.current.getLatLng();
          const distance = Math.sqrt(Math.pow(curPos.lat - lat, 2) + Math.pow(curPos.lng - lng, 2));
          
          // Only update if moved significantly (> ~10 meters) to prevent infinite loops
          if (distance > 0.0001) {
              markerRef.current.setLatLng([lat, lng]);
              mapInstanceRef.current.flyTo([lat, lng], 16, { duration: 1.5 });
          }
      }
  }, [lat, lng]);

  return (
    <div className="relative w-full h-72 rounded-3xl overflow-hidden border-2 border-slate-100 shadow-inner group z-0">
        <div ref={mapContainerRef} className="w-full h-full z-0" />
        
        {/* Helper overlay */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-md px-4 py-2 rounded-full text-[10px] text-slate-600 font-bold shadow-sm pointer-events-none border border-slate-200 z-[400] flex items-center gap-2">
            <span>✋</span> Drag marker to adjust location
        </div>
    </div>
  );
};

export default LocationPickerMap;
