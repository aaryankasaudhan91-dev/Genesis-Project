
import React, { useEffect, useState } from 'react';
import { getOptimizedRoute, RouteOptimizationResult } from '../services/geminiService';

interface DirectionsModalProps {
  origin: string;
  destination: string;
  waypoint?: string; // Optional intermediate stop (Pickup)
  onClose: () => void;
}

const DirectionsModal: React.FC<DirectionsModalProps> = ({ origin, destination, waypoint, onClose }) => {
  const [route, setRoute] = useState<RouteOptimizationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchRoute = async () => {
      try {
        const result = await getOptimizedRoute(origin, destination, waypoint);
        if (result) {
          setRoute(result);
        } else {
          setError("Could not generate route. Please try Google Maps.");
        }
      } catch (err) {
        setError("Failed to load directions.");
      } finally {
        setLoading(false);
      }
    };
    fetchRoute();
  }, [origin, destination, waypoint]);

  const mapsUrl = waypoint 
    ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&waypoints=${encodeURIComponent(waypoint)}`
    : `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`;

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden border border-slate-200 shadow-2xl">
        <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
          <div>
            <h3 className="font-black text-lg uppercase tracking-wider">Directions</h3>
            <p className="text-xs text-slate-400 font-bold mt-1">
                {waypoint ? 'Pickup & Delivery Route' : `To: ${destination.split(',')[0]}`}
            </p>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 space-y-4">
              <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-slate-500 font-bold text-sm">Calculating optimized route...</p>
            </div>
          ) : error ? (
            <div className="text-center py-10">
                <p className="text-red-500 font-bold mb-4">{error}</p>
                <a 
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block bg-emerald-600 text-white font-black py-3 px-6 rounded-xl uppercase text-xs"
                >
                    Open Google Maps
                </a>
            </div>
          ) : route ? (
            <div className="space-y-6">
              {/* Summary Card */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-start mb-3">
                    <div>
                        <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Est. Time</p>
                        <p className="text-2xl font-black text-slate-800">{route.estimatedDuration}</p>
                    </div>
                    <div className="bg-emerald-100 p-2 rounded-xl text-emerald-600">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    </div>
                </div>
                <p className="text-sm font-bold text-slate-600">{route.summary}</p>
              </div>

              {/* Waypoint Info */}
              {waypoint && (
                 <div className="flex flex-col gap-2 p-3 bg-blue-50 rounded-xl border border-blue-100">
                    <div className="flex items-center gap-2 text-blue-800 font-bold text-xs uppercase tracking-wide">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                        Via Pickup
                    </div>
                    <p className="text-xs font-medium text-slate-700 ml-4 truncate">{waypoint}</p>
                 </div>
              )}

              {/* Traffic Tips */}
              {route.trafficTips && (
                  <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex gap-3">
                      <span className="text-amber-500 text-xl">⚠️</span>
                      <div>
                          <p className="text-[10px] font-black uppercase text-amber-600/70 tracking-widest mb-1">Traffic Insights</p>
                          <p className="text-xs font-bold text-amber-800 leading-relaxed">{route.trafficTips}</p>
                      </div>
                  </div>
              )}

              {/* Steps */}
              <div>
                <h4 className="font-black text-slate-800 mb-4 flex items-center gap-2">
                    <span className="w-6 h-6 bg-slate-900 text-white rounded-full flex items-center justify-center text-[10px]">📍</span>
                    Route Steps
                </h4>
                <div className="space-y-0 relative">
                    <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-slate-200"></div>
                    {route.steps.map((step, idx) => (
                        <div key={idx} className="relative flex items-start gap-4 mb-6 last:mb-0">
                            <div className="w-6 h-6 rounded-full bg-white border-4 border-emerald-500 z-10 shrink-0"></div>
                            <p className="text-sm font-medium text-slate-600 py-0.5">{step}</p>
                        </div>
                    ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="p-4 bg-white border-t border-slate-200">
            <a 
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full bg-slate-900 text-white font-black py-4 rounded-2xl text-center uppercase tracking-widest text-xs hover:bg-slate-800 transition-all shadow-lg"
            >
                Open in Google Maps
            </a>
        </div>
      </div>
    </div>
  );
};

export default DirectionsModal;
