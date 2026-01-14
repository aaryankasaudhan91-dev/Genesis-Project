
import React, { useEffect, useRef } from 'react';
import { Address } from '../types';
import { loadGoogleMaps } from '../services/mapLoader';

declare const google: any;

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
  const polylineRef = useRef<any>(null);

  useEffect(() => {
    loadGoogleMaps().then(() => {
        if (mapContainerRef.current && !mapInstanceRef.current) {
          const lat = pickupLocation.lat || 20.5937;
          const lng = pickupLocation.lng || 78.9629;
          
          const map = new google.maps.Map(mapContainerRef.current, {
            center: { lat, lng },
            zoom: 13,
            disableDefaultUI: true
          });
          
          mapInstanceRef.current = map;
        }
    });
  }, []);

  useEffect(() => {
      if (!mapInstanceRef.current) return;
      const map = mapInstanceRef.current;

      markersRef.current.forEach(m => m.setMap(null));
      markersRef.current = [];
      if (polylineRef.current) polylineRef.current.setMap(null);

      // --- Helper to add marker ---
      const addMarker = (lat: number, lng: number, emoji: string, color: string, title: string) => {
          const svgIcon = `
            <svg width="40" height="48" viewBox="0 0 40 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 48L4 28C-1.33333 21.3333 0 10 4 6C8 2 14 0 20 0C26 0 32 2 36 6C40 10 41.3333 21.3333 36 28L20 48Z" fill="${color}" stroke="white" stroke-width="2"/>
                <text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" font-size="20">${emoji}</text>
            </svg>`;
          
          const marker = new google.maps.Marker({
              position: { lat, lng },
              map: map,
              icon: {
                  url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svgIcon),
                  scaledSize: new google.maps.Size(40, 48),
                  anchor: new google.maps.Point(20, 48)
              },
              title: title
          });
          
          markersRef.current.push(marker);
      };

      // Pickup
      if (pickupLocation.lat && pickupLocation.lng) {
          addMarker(pickupLocation.lat, pickupLocation.lng, '🏠', '#10b981', donorName);
      }

      // Dropoff
      if (dropoffLocation?.lat && dropoffLocation?.lng) {
          addMarker(dropoffLocation.lat, dropoffLocation.lng, '📍', '#f97316', 'Destination');
      }

      // Volunteer
      if (volunteerLocation?.lat && volunteerLocation?.lng) {
         const volSvg = `
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="18" cy="18" r="16" fill="#3b82f6" stroke="white" stroke-width="3"/>
                <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-size="16">🚴</text>
            </svg>`;
          
          const vMarker = new google.maps.Marker({
              position: { lat: volunteerLocation.lat, lng: volunteerLocation.lng },
              map: map,
              zIndex: 100,
              icon: {
                  url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(volSvg),
                  scaledSize: new google.maps.Size(36, 36),
                  anchor: new google.maps.Point(18, 18)
              },
              title: "Volunteer"
          });
          markersRef.current.push(vMarker);
          
          // Polyline
          if (dropoffLocation?.lat && dropoffLocation?.lng) {
              const path = [
                  { lat: volunteerLocation.lat, lng: volunteerLocation.lng },
                  { lat: dropoffLocation.lat, lng: dropoffLocation.lng }
              ];
              polylineRef.current = new google.maps.Polyline({
                  path: path,
                  geodesic: true,
                  strokeColor: '#3b82f6',
                  strokeOpacity: 0.7,
                  strokeWeight: 4,
                  map: map
              });
          }
      }

  }, [pickupLocation, donorName, dropoffLocation, volunteerLocation]);

  return <div ref={mapContainerRef} className="h-full w-full rounded-xl" />;
};

export default TrackingMap;
