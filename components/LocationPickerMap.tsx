
import React, { useEffect, useRef } from 'react';
import { reverseGeocode, ReverseGeocodeResult } from '../services/geminiService';

declare const L: any;

interface LocationPickerMapProps {
  lat?: number;
  lng?: number;
  onLocationSelect: (lat: number, lng: number) => void;
  onAddressFound?: (address: ReverseGeocodeResult) => void;
}

const LocationPickerMap: React.FC<LocationPickerMapProps> = ({ lat, lng, onLocationSelect, onAddressFound }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (mapContainerRef.current && !mapInstanceRef.current) {
      const l = lat || 20.5937;
      const g = lng || 78.9629;
      const map = L.map(mapContainerRef.current, { zoomControl: false }).setView([l, g], 5);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(map);
      const marker = L.marker([l, g], { draggable: true }).addTo(map);
      marker.on('dragend', async () => {
        const pos = marker.getLatLng();
        onLocationSelect(pos.lat, pos.lng);
        if (onAddressFound) {
          const addr = await reverseGeocode(pos.lat, pos.lng);
          if (addr) onAddressFound(addr);
        }
      });
      mapInstanceRef.current = map;
    }
    return () => { if (mapInstanceRef.current) mapInstanceRef.current.remove(); mapInstanceRef.current = null; };
  }, []);

  return <div ref={mapContainerRef} className="w-full h-56 rounded-2xl overflow-hidden border" />;
};

export default LocationPickerMap;
