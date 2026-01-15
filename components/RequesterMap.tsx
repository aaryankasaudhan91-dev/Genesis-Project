
import React, { useEffect, useRef } from 'react';
import { User } from '../types';
import * as L from 'leaflet';

interface RequesterMapProps {
  requesters: User[];
  currentLocation?: { lat: number; lng: number };
}

const RequesterMap: React.FC<RequesterMapProps> = ({ requesters, currentLocation }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (mapContainerRef.current && !mapInstanceRef.current) {
        const map = L.map(mapContainerRef.current, {
            center: currentLocation ? [currentLocation.lat, currentLocation.lng] : [20.5937, 78.9629],
            zoom: 12,
            zoomControl: false
        });

        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; CARTO',
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(map);

        mapInstanceRef.current = map;
        layerGroupRef.current = L.layerGroup().addTo(map);
    }
  }, []);

  useEffect(() => {
      const map = mapInstanceRef.current;
      const group = layerGroupRef.current;
      
      if (map && group) {
          group.clearLayers();
          
          if (currentLocation) {
              map.panTo([currentLocation.lat, currentLocation.lng]);
          }

          requesters.forEach(user => {
              if (user.address?.lat && user.address?.lng) {
                  const icon = L.divIcon({
                      className: 'req-icon',
                      html: `<div style="font-size:24px; background:#f97316; width:40px; height:40px; display:flex; align-items:center; justify-content:center; border-radius:50%; border:3px solid white; box-shadow:0 4px 6px rgba(0,0,0,0.1);">🏠</div>`,
                      iconSize: [40, 40],
                      iconAnchor: [20, 20]
                  });

                  L.marker([user.address.lat, user.address.lng], { icon })
                   .addTo(group)
                   .bindPopup(`<b>${user.orgName || user.name}</b><br>${user.address.line1}`);
              }
          });
      }
  }, [requesters, currentLocation]);

  return <div ref={mapContainerRef} className="h-full w-full rounded-2xl shadow-lg border border-slate-200 bg-slate-100 z-0" />;
};

export default RequesterMap;
