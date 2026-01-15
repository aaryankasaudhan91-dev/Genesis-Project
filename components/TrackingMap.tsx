
import React, { useEffect, useRef } from 'react';
import { Address } from '../types';
import * as L from 'leaflet';

interface TrackingMapProps {
  pickupLocation: Address;
  donorName: string;
  dropoffLocation?: Address;
  volunteerLocation?: { lat: number; lng: number };
}

const TrackingMap: React.FC<TrackingMapProps> = ({ pickupLocation, donorName, dropoffLocation, volunteerLocation }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (mapContainerRef.current && !mapInstanceRef.current) {
        const map = L.map(mapContainerRef.current, {
            center: [20.5937, 78.9629],
            zoom: 5,
            zoomControl: true
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
      const layerGroup = layerGroupRef.current;

      if (map && layerGroup) {
          layerGroup.clearLayers();
          const bounds = L.latLngBounds([]);

          const createIcon = (emoji: string, color: string) => L.divIcon({
              className: 'tracking-marker',
              html: `<div style="font-size:24px; background:${color}; width:40px; height:40px; display:flex; align-items:center; justify-content:center; border-radius:50%; border:3px solid white; box-shadow:0 4px 6px rgba(0,0,0,0.1);">${emoji}</div>`,
              iconSize: [40, 40],
              iconAnchor: [20, 20]
          });

          // Pickup
          if (pickupLocation.lat && pickupLocation.lng) {
              L.marker([pickupLocation.lat, pickupLocation.lng], { 
                  icon: createIcon('🏠', '#10b981') 
              }).addTo(layerGroup).bindPopup(`<b>Pickup</b><br>${donorName}`);
              bounds.extend([pickupLocation.lat, pickupLocation.lng]);
          }

          // Dropoff
          if (dropoffLocation?.lat && dropoffLocation?.lng) {
              L.marker([dropoffLocation.lat, dropoffLocation.lng], { 
                  icon: createIcon('📍', '#f97316') 
              }).addTo(layerGroup).bindPopup(`<b>Dropoff</b>`);
              bounds.extend([dropoffLocation.lat, dropoffLocation.lng]);
          }

          // Volunteer
          if (volunteerLocation?.lat && volunteerLocation?.lng) {
              L.marker([volunteerLocation.lat, volunteerLocation.lng], { 
                  icon: createIcon('🚴', '#3b82f6'),
                  zIndexOffset: 1000
              }).addTo(layerGroup).bindPopup(`<b>Volunteer</b>`);
              bounds.extend([volunteerLocation.lat, volunteerLocation.lng]);

              // Line
              if (dropoffLocation?.lat && dropoffLocation?.lng) {
                  L.polyline([
                      [volunteerLocation.lat, volunteerLocation.lng],
                      [dropoffLocation.lat, dropoffLocation.lng]
                  ], { color: '#3b82f6', weight: 4, opacity: 0.7, dashArray: '10, 10' }).addTo(layerGroup);
              }
          }

          if (bounds.isValid()) {
              map.fitBounds(bounds, { padding: [50, 50] });
          }
      }
  }, [pickupLocation, dropoffLocation, volunteerLocation]);

  return <div ref={mapContainerRef} className="h-full w-full rounded-xl z-0" />;
};

export default TrackingMap;
