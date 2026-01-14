
import React, { useEffect, useRef } from 'react';
import { User } from '../types';
import { loadGoogleMaps } from '../services/mapLoader';

declare const google: any;

interface RequesterMapProps {
  requesters: User[];
  currentLocation?: { lat: number; lng: number };
}

const RequesterMap: React.FC<RequesterMapProps> = ({ requesters, currentLocation }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  useEffect(() => {
    loadGoogleMaps().then(() => {
        if (mapContainerRef.current && !mapInstanceRef.current) {
          const initialLat = currentLocation?.lat || 20.5937;
          const initialLng = currentLocation?.lng || 78.9629;
          
          const map = new google.maps.Map(mapContainerRef.current, {
            center: { lat: initialLat, lng: initialLng },
            zoom: 12,
            disableDefaultUI: true
          });
          
          mapInstanceRef.current = map;
        }
    });
  }, []);

  useEffect(() => {
      if (mapInstanceRef.current && currentLocation) {
          mapInstanceRef.current.setCenter({ lat: currentLocation.lat, lng: currentLocation.lng });
      }
  }, [currentLocation]);

  useEffect(() => {
      if (!mapInstanceRef.current) return;
      const map = mapInstanceRef.current;

      markersRef.current.forEach(marker => marker.setMap(null));
      markersRef.current = [];

      requesters.forEach(user => {
          if (user.address?.lat && user.address?.lng) {
              const svgIcon = `
                <svg width="40" height="48" viewBox="0 0 40 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M20 48L4 28C-1.33333 21.3333 0 10 4 6C8 2 14 0 20 0C26 0 32 2 36 6C40 10 41.3333 21.3333 36 28L20 48Z" fill="#f97316" stroke="white" stroke-width="2"/>
                    <text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" font-size="20">🏠</text>
                </svg>`;

              const marker = new google.maps.Marker({
                  position: { lat: user.address.lat, lng: user.address.lng },
                  map: map,
                  icon: {
                      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svgIcon),
                      scaledSize: new google.maps.Size(40, 48),
                      anchor: new google.maps.Point(20, 48)
                  }
              });

              const infoWindow = new google.maps.InfoWindow({
                content: `
                  <div style="font-family: sans-serif; text-align: center;">
                      <h3 style="margin: 0; font-size: 14px; font-weight: bold; color: #1e293b;">${user.orgName || user.name}</h3>
                      <p style="margin: 2px 0 4px; font-size: 11px; color: #64748b;">${user.address.line1}</p>
                      <span style="display: inline-block; padding: 2px 6px; background: #ffedd5; color: #c2410c; border-radius: 99px; font-size: 10px; font-weight: bold; text-transform: uppercase;">
                        ${user.orgCategory || 'Requester'}
                      </span>
                  </div>
                `
              });

              marker.addListener("click", () => {
                  infoWindow.open(map, marker);
              });

              markersRef.current.push(marker);
          }
      });
  }, [requesters]);

  return <div ref={mapContainerRef} className="h-full w-full rounded-2xl shadow-lg border border-slate-200 bg-slate-100" />;
};

export default RequesterMap;
