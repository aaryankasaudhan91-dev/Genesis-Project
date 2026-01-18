
import React, { useEffect, useRef } from 'react';
import { FoodPosting } from '../types';
import * as L from 'leaflet';
import { getTranslation } from '../services/translations';

interface RoutePlannerModalProps {
  orderedPostings: FoodPosting[];
  routeOverview: string;
  totalTime: string;
  stopReasoning: { stopId: string; reason: string }[];
  onClose: () => void;
  onSelectPosting: (id: string) => void;
  language?: string;
}

const RoutePlannerModal: React.FC<RoutePlannerModalProps> = ({ 
  orderedPostings, 
  routeOverview, 
  totalTime, 
  stopReasoning,
  onClose,
  onSelectPosting,
  language
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const t = (key: string) => getTranslation(key, language);

  useEffect(() => {
    if (mapContainerRef.current && !mapInstanceRef.current && orderedPostings.length > 0) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 20
      }).addTo(map);

      // Create bounds to fit all points
      const bounds = L.latLngBounds([]);
      const latLngs: L.LatLngExpression[] = [];

      orderedPostings.forEach((post, index) => {
        if (post.location.lat && post.location.lng) {
          const point: L.LatLngExpression = [post.location.lat, post.location.lng];
          latLngs.push(point);
          bounds.extend(point);

          // Numbered Icon
          const icon = L.divIcon({
            className: 'route-marker',
            html: `
              <div class="relative w-8 h-8">
                <div class="absolute inset-0 bg-slate-900 rounded-full border-2 border-white shadow-md flex items-center justify-center text-white font-bold text-xs">
                  ${index + 1}
                </div>
                <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-slate-900"></div>
              </div>
            `,
            iconSize: [32, 40],
            iconAnchor: [16, 40]
          });

          L.marker(point, { icon })
            .addTo(map)
            .bindPopup(`<b>${index + 1}. ${post.foodName}</b><br>${post.quantity}`);
        }
      });

      // Draw dashed line connecting points
      if (latLngs.length > 1) {
        L.polyline(latLngs, {
          color: '#0f172a', // slate-900
          weight: 3,
          opacity: 0.6,
          dashArray: '10, 10'
        }).addTo(map);
      }

      map.fitBounds(bounds, { padding: [50, 50] });
      mapInstanceRef.current = map;
    }
  }, [orderedPostings]);

  return (
    <div className="fixed inset-0 z-[1200] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in-up">
      <div className="bg-white rounded-[2.5rem] w-full max-w-4xl h-[80vh] flex flex-col md:flex-row overflow-hidden shadow-2xl relative border border-slate-200">
        
        {/* Left: Route List */}
        <div className="md:w-1/3 bg-slate-50 flex flex-col border-r border-slate-200">
          <div className="p-6 bg-white border-b border-slate-100">
            <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                    </div>
                    <div>
                        <h3 className="font-black text-slate-800 text-sm uppercase tracking-wide">{t('btn_smart_route')}</h3>
                        <p className="text-xs text-slate-500 font-bold">{totalTime} {t('smart_route_est')}</p>
                    </div>
                </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
               ✨ {routeOverview}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
            {orderedPostings.map((post, index) => {
              const reason = stopReasoning.find(r => r.stopId === post.id)?.reason;
              return (
                <div key={post.id} className="relative pl-8 pb-4 border-l-2 border-slate-200 last:border-0 last:pb-0 group">
                  <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-slate-900 border-2 border-white shadow-sm flex items-center justify-center text-[8px] text-white font-bold">
                    {index + 1}
                  </div>
                  <div 
                    onClick={() => onSelectPosting(post.id)}
                    className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all cursor-pointer"
                  >
                    <div className="flex justify-between items-start">
                        <h4 className="font-bold text-slate-800 text-sm">{post.foodName}</h4>
                        <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded uppercase">{post.quantity}</span>
                    </div>
                    <p className="text-xs text-slate-500 truncate mb-1">{post.donorName}</p>
                    {reason && (
                        <p className="text-[10px] font-medium text-emerald-600 flex items-center gap-1">
                            <span>💡</span> {reason}
                        </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className="p-4 border-t border-slate-200 bg-white md:hidden">
             <button onClick={onClose} className="w-full py-3 bg-slate-100 text-slate-600 font-bold rounded-xl text-xs uppercase tracking-widest">{t('btn_close_map')}</button>
          </div>
        </div>

        {/* Right: Map */}
        <div className="flex-1 relative h-1/2 md:h-full">
            <div ref={mapContainerRef} className="absolute inset-0 z-0 bg-slate-200" />
            <button 
                onClick={onClose} 
                className="absolute top-4 right-4 z-[400] bg-white text-slate-800 p-2 rounded-full shadow-lg hover:scale-110 transition-transform hidden md:block"
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
        </div>

      </div>
    </div>
  );
};

export default RoutePlannerModal;
