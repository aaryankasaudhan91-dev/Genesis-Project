
import React, { useEffect, useRef, useState } from 'react';
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
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;
    const handleAuthError = () => { if (mounted) setError(true); };
    window.addEventListener('google-maps-auth-failure', handleAuthError);

    loadGoogleMaps().then(() => {
        if (!mounted) return;
        if (mapContainerRef.current && !mapInstanceRef.current) {
          try {
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
          } catch (e) {
              console.error("Location picker init error", e);
              setError(true);
          }
        }
    }).catch(e => {
        if (mounted) setError(true);
    });

    return () => {
        mounted = false;
        window.removeEventListener('google-maps-auth-failure', handleAuthError);
    };
  }, []);

  if (error) {
      return (
          <div className="w-full h-56 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col items-center justify-center text-slate-400">
               <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
               <span className="text-xs font-bold uppercase">Map Unavailable</span>
          </div>
      );
  }

  return <div ref={mapContainerRef} className="w-full h-56 rounded-2xl overflow-hidden border border-slate-200" />;
};

export default LocationPickerMap;
