
import React, { useEffect, useRef } from 'react';
import { reverseGeocodeGoogle, ReverseGeocodeResult } from '../services/mapLoader';
import * as L from 'leaflet';

interface LocationPickerMapProps {
  lat?: number;
  lng?: number;
  onLocationSelect: (lat: number, lng: number) => void;
  onAddressFound?: (address: ReverseGeocodeResult) => void;
}

const LocationPickerMap: React.FC<LocationPickerMapProps> = ({ lat, lng, onLocationSelect, onAddressFound }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (mapContainerRef.current && !mapInstanceRef.current) {
        const initialLat = lat || 20.5937;
        const initialLng = lng || 78.9629;

        const map = L.map(mapContainerRef.current, {
            center: [initialLat, initialLng],
            zoom: 15,
            zoomControl: true
        });

        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OpenStreetMap &copy; CARTO',
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(map);

        const icon = L.divIcon({
            className: 'picker-icon',
            html: `<div style="font-size: 32px; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));">📍</div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 32]
        });

        const marker = L.marker([initialLat, initialLng], { 
            icon, 
            draggable: true 
        }).addTo(map);

        const updateLocation = async (newLat: number, newLng: number) => {
            onLocationSelect(newLat, newLng);
            if (onAddressFound) {
                const addr = await reverseGeocodeGoogle(newLat, newLng);
                if (addr) onAddressFound(addr);
            }
        };

        marker.on('dragend', (e) => {
            const pos = e.target.getLatLng();
            updateLocation(pos.lat, pos.lng);
        });

        map.on('click', (e) => {
            const { lat, lng } = e.latlng;
            marker.setLatLng([lat, lng]);
            updateLocation(lat, lng);
        });

        markerRef.current = marker;
        mapInstanceRef.current = map;
    }
  }, []);

  // Update map when props change
  useEffect(() => {
      if (mapInstanceRef.current && markerRef.current && lat && lng) {
          const curPos = markerRef.current.getLatLng();
          // Only update if moved significantly to prevent loops
          if (Math.abs(curPos.lat - lat) > 0.0001 || Math.abs(curPos.lng - lng) > 0.0001) {
              markerRef.current.setLatLng([lat, lng]);
              mapInstanceRef.current.panTo([lat, lng]);
          }
      }
  }, [lat, lng]);

  return (
    <div className="relative w-full h-64 rounded-2xl overflow-hidden border border-slate-200 shadow-sm group z-0">
        <div ref={mapContainerRef} className="w-full h-full z-0" />
        <div className="absolute bottom-2 left-2 right-2 bg-white/90 backdrop-blur-md px-3 py-2 rounded-xl text-[10px] text-slate-500 font-medium text-center pointer-events-none border border-white/50 shadow-sm z-[400]">
            Click or Drag marker to set location
        </div>
    </div>
  );
};

export default LocationPickerMap;
