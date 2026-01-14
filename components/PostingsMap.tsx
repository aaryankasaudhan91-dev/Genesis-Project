
import React, { useEffect, useRef } from 'react';
import { FoodPosting, FoodStatus } from '../types';
import { loadGoogleMaps } from '../services/mapLoader';

declare const google: any;

interface PostingsMapProps {
  postings: FoodPosting[];
  onPostingSelect?: (postingId: string) => void;
  userLocation?: { lat: number; lng: number };
}

const PostingsMap: React.FC<PostingsMapProps> = ({ postings, onPostingSelect, userLocation }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const linesRef = useRef<any[]>([]);

  useEffect(() => {
    loadGoogleMaps().then(() => {
      if (mapContainerRef.current && !mapInstanceRef.current) {
        const initialLat = userLocation?.lat || 20.5937;
        const initialLng = userLocation?.lng || 78.9629;
        
        const map = new google.maps.Map(mapContainerRef.current, {
          center: { lat: initialLat, lng: initialLng },
          zoom: 12,
          disableDefaultUI: true,
          styles: [
             { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] }
          ]
        });
        
        mapInstanceRef.current = map;
      }
    });
  }, []);

  // Update Map Center
  useEffect(() => {
      if (mapInstanceRef.current && userLocation) {
          mapInstanceRef.current.setCenter({ lat: userLocation.lat, lng: userLocation.lng });
      }
  }, [userLocation]);

  // Update Markers
  useEffect(() => {
      if (!mapInstanceRef.current) return;
      const map = mapInstanceRef.current;

      // Clear existing
      markersRef.current.forEach(m => m.setMap(null));
      markersRef.current = [];
      linesRef.current.forEach(l => l.setMap(null));
      linesRef.current = [];

      // Add User Location
      if (userLocation) {
          const userSvg = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" fill="#3b82f6" stroke="white" stroke-width="3"/>
            </svg>`;
          
          const userMarker = new google.maps.Marker({
              position: { lat: userLocation.lat, lng: userLocation.lng },
              map: map,
              icon: {
                  url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(userSvg),
                  scaledSize: new google.maps.Size(24, 24),
                  anchor: new google.maps.Point(12, 12)
              },
              title: "You are here"
          });
          markersRef.current.push(userMarker);
      }

      postings.forEach(post => {
          // --- Food Posting Marker ---
          if (post.location?.lat && post.location?.lng) {
              const isUrgent = new Date(post.expiryDate).getTime() - Date.now() < 12 * 60 * 60 * 1000;
              const color = isUrgent ? '#f43f5e' : '#10b981';
              const emoji = post.foodCategory === 'Veg' ? '🥗' : '🍱';

              const svgIcon = `
                <svg width="40" height="48" viewBox="0 0 40 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M20 48L4 28C-1.33333 21.3333 0 10 4 6C8 2 14 0 20 0C26 0 32 2 36 6C40 10 41.3333 21.3333 36 28L20 48Z" fill="${color}" stroke="white" stroke-width="2"/>
                    <text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" font-size="20">${emoji}</text>
                </svg>`;

              const marker = new google.maps.Marker({
                  position: { lat: post.location.lat, lng: post.location.lng },
                  map: map,
                  icon: {
                      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svgIcon),
                      scaledSize: new google.maps.Size(40, 48),
                      anchor: new google.maps.Point(20, 48)
                  }
              });

              marker.addListener("click", () => {
                  if (onPostingSelect) onPostingSelect(post.id);
                  const infoWindow = new google.maps.InfoWindow({
                      content: `
                        <div style="font-family: sans-serif; padding: 4px; max-width: 200px;">
                            <h3 style="margin: 0 0 4px; font-size: 14px; font-weight: bold;">${post.foodName}</h3>
                            <p style="margin: 0; font-size: 12px; color: #555;">${post.quantity} • ${post.location.line1}</p>
                            ${isUrgent ? '<p style="margin: 4px 0 0; color: #e11d48; font-weight: bold; font-size: 10px;">URGENT</p>' : ''}
                        </div>
                      `
                  });
                  infoWindow.open(map, marker);
              });

              markersRef.current.push(marker);
          }

          // --- Volunteer Live Marker ---
          if (post.volunteerLocation?.lat && post.volunteerLocation?.lng && 
             (post.status === FoodStatus.IN_TRANSIT || post.status === FoodStatus.PICKUP_VERIFICATION_PENDING || post.status === FoodStatus.DELIVERY_VERIFICATION_PENDING)) {
              
             const vLat = post.volunteerLocation.lat;
             const vLng = post.volunteerLocation.lng;

             const volSvg = `
                <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="18" cy="18" r="16" fill="#3b82f6" stroke="white" stroke-width="3"/>
                    <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-size="16">🚴</text>
                </svg>`;

             const vMarker = new google.maps.Marker({
                 position: { lat: vLat, lng: vLng },
                 map: map,
                 zIndex: 1000,
                 icon: {
                     url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(volSvg),
                     scaledSize: new google.maps.Size(36, 36),
                     anchor: new google.maps.Point(18, 18)
                 },
                 title: `Volunteer: ${post.volunteerName}`
             });
             markersRef.current.push(vMarker);

             // Path Line
             let target = post.location;
             if (post.requesterAddress?.lat && post.status !== FoodStatus.PICKUP_VERIFICATION_PENDING) {
                 target = post.requesterAddress;
             }

             if (target?.lat && target?.lng) {
                 const line = new google.maps.Polyline({
                     path: [{ lat: vLat, lng: vLng }, { lat: target.lat, lng: target.lng }],
                     geodesic: true,
                     strokeColor: "#3b82f6",
                     strokeOpacity: 0.7,
                     strokeWeight: 4,
                     icons: [{
                        icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 2 },
                        offset: '0',
                        repeat: '20px'
                     }],
                     map: map
                 });
                 linesRef.current.push(line);
             }
          }
      });
  }, [postings, userLocation]);

  return <div ref={mapContainerRef} className="h-full w-full rounded-[2rem] shadow-inner bg-slate-100 border border-slate-200" />;
};

export default PostingsMap;
