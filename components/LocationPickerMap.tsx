
import React, { useEffect, useRef } from 'react';
import { reverseGeocodeGoogle, ReverseGeocodeResult } from '../services/mapLoader';
import { loadGoogleMaps } from '../services/mapLoader';

declare const google: any;

interface LocationPickerMapProps {
  lat?: number;
  lng?: number;
  onLocationSelect: (lat: number, lng: number) => void;
  onAddressFound?: (address: ReverseGeocodeResult) => void;
}

const LocationPickerMap: React.FC<LocationPickerMapProps> = ({ lat, lng, onLocationSelect, onAddressFound }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  useEffect(() => {
    loadGoogleMaps().then(() => {
        if (mapContainerRef.current && !mapInstanceRef.current) {
          const l = lat || 20.5937;
          const g = lng || 78.9629;
          
          const map = new google.maps.Map(mapContainerRef.current, {
            center: { lat: l, lng: g },
            zoom: 5,
            disableDefaultUI: true,
            zoomControl: true
          });

          const marker = new google.maps.Marker({
              position: { lat: l, lng: g },
              map: map,
              draggable: true,
              animation: google.maps.Animation.DROP
          });

          marker.addListener('dragend', async () => {
              const pos = marker.getPosition();
              if (pos) {
                  const newLat = pos.lat();
                  const newLng = pos.lng();
                  onLocationSelect(newLat, newLng);
                  
                  if (onAddressFound) {
                      const addr = await reverseGeocodeGoogle(newLat, newLng);
                      if (addr) onAddressFound(addr);
                  }
              }
          });

          markerRef.current = marker;
          mapInstanceRef.current = map;
        }
    });
  }, []);

  return <div ref={mapContainerRef} className="w-full h-56 rounded-2xl overflow-hidden border border-slate-200" />;
};

export default LocationPickerMap;
