
import React, { useEffect, useRef, useState } from 'react';
import { FoodPosting, FoodStatus } from '../types';
import { loadGoogleMaps } from '../services/mapLoader';

declare const google: any;
declare const markerClusterer: any;

interface PostingsMapProps {
  postings: FoodPosting[];
  onPostingSelect?: (postingId: string) => void;
  userLocation?: { lat: number; lng: number };
}

const STORAGE_KEY_MAP_VIEW = 'mealers_map_view';

const PostingsMap: React.FC<PostingsMapProps> = ({ postings, onPostingSelect, userLocation }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const clustererRef = useRef<any>(null);
  const infoWindowRef = useRef<any>(null);
  
  // Non-clustered markers (User location, volunteer paths)
  const staticMarkersRef = useRef<any[]>([]); 
  const linesRef = useRef<any[]>([]);
  
  const [error, setError] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  
  // Load saved view preference
  const [savedView, setSavedView] = useState<{lat: number, lng: number, zoom: number} | null>(() => {
      try {
          const saved = localStorage.getItem(STORAGE_KEY_MAP_VIEW);
          return saved ? JSON.parse(saved) : null;
      } catch { return null; }
  });

  // Track if we should auto-follow user location. 
  // If user has a saved view, default to false (respect preference). Else true.
  const [autoFollow, setAutoFollow] = useState(!savedView);

  useEffect(() => {
    let mounted = true;
    
    const handleAuthError = () => {
        if (mounted) setError(true);
    };
    window.addEventListener('google-maps-auth-failure', handleAuthError);

    loadGoogleMaps()
      .then(() => {
        if (!mounted) return;
        if (mapContainerRef.current && !mapInstanceRef.current) {
            try {
                // Priority: Saved View > User Location > Default
                let initialLat = 20.5937;
                let initialLng = 78.9629;
                let initialZoom = 12;

                if (savedView) {
                    initialLat = savedView.lat;
                    initialLng = savedView.lng;
                    initialZoom = savedView.zoom;
                } else if (userLocation) {
                    initialLat = userLocation.lat;
                    initialLng = userLocation.lng;
                }
                
                const map = new google.maps.Map(mapContainerRef.current, {
                    center: { lat: initialLat, lng: initialLng },
                    zoom: initialZoom,
                    disableDefaultUI: true,
                    styles: [
                        { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] }
                    ],
                    gestureHandling: "cooperative"
                });
                
                mapInstanceRef.current = map;
                
                // Initialize InfoWindow
                infoWindowRef.current = new google.maps.InfoWindow({
                    minWidth: 200,
                    maxWidth: 250
                });

                // Initialize Clusterer
                if (typeof markerClusterer !== 'undefined' && markerClusterer.MarkerClusterer) {
                    clustererRef.current = new markerClusterer.MarkerClusterer({ 
                        map,
                        renderer: {
                            render: ({ count, position }: any) => {
                                return new google.maps.Marker({
                                    position,
                                    label: { 
                                        text: String(count), 
                                        color: "white", 
                                        fontSize: "12px", 
                                        fontWeight: "800",
                                        fontFamily: 'sans-serif'
                                    },
                                    icon: {
                                        path: google.maps.SymbolPath.CIRCLE,
                                        scale: 18 + Math.min(count * 0.5, 12),
                                        fillColor: '#059669', // Emerald-600
                                        fillOpacity: 0.95,
                                        strokeWeight: 5,
                                        strokeColor: '#d1fae5' // Emerald-100
                                    },
                                    zIndex: 1000 + count,
                                    title: `Group of ${count} donations`
                                });
                            }
                        },
                    });
                }

                updateMapMarkers(map);
                
                // Listen for drag to disable auto-follow if user manually moves map
                map.addListener('dragstart', () => {
                    setAutoFollow(false);
                });

            } catch (e) {
                console.error("Error initializing map", e);
                setError(true);
            }
        }
      })
      .catch((err) => {
        if (mounted) {
            console.warn("Map load error:", err);
            setError(true);
        }
      });

    return () => {
        mounted = false;
        window.removeEventListener('google-maps-auth-failure', handleAuthError);
        if (clustererRef.current) {
            clustererRef.current.clearMarkers();
            clustererRef.current.setMap(null);
        }
        if (infoWindowRef.current) {
            infoWindowRef.current.close();
        }
    };
  }, []);

  // Update Map Center based on User Location (Auto Follow)
  useEffect(() => {
      if (mapInstanceRef.current && userLocation && !error && autoFollow) {
          mapInstanceRef.current.panTo({ lat: userLocation.lat, lng: userLocation.lng });
      }
  }, [userLocation, error, autoFollow]);

  // Update Markers
  useEffect(() => {
      if (mapInstanceRef.current && !error) {
          updateMapMarkers(mapInstanceRef.current);
      }
  }, [postings, userLocation, error]);

  const updateMapMarkers = (map: any) => {
      // 1. Clear Static Markers (User, Volunteers)
      staticMarkersRef.current.forEach(m => m.setMap(null));
      staticMarkersRef.current = [];
      linesRef.current.forEach(l => l.setMap(null));
      linesRef.current = [];

      // 2. Clear Clusterer
      if (clustererRef.current) {
          clustererRef.current.clearMarkers();
      }

      const foodMarkers: any[] = [];

      // --- A. Add User Location ---
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
              title: "You are here",
              zIndex: 50
          });
          staticMarkersRef.current.push(userMarker);
      }

      // --- B. Process Postings ---
      postings.forEach(post => {
          // Food Marker
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
                  icon: {
                      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svgIcon),
                      scaledSize: new google.maps.Size(40, 48),
                      anchor: new google.maps.Point(20, 48)
                  },
                  title: post.foodName,
                  zIndex: 100
              });

              marker.addListener("click", () => {
                  if (infoWindowRef.current) {
                      const content = document.createElement('div');
                      content.style.padding = '4px';
                      content.innerHTML = `
                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            ${post.imageUrl ? `<img src="${post.imageUrl}" style="width: 100%; height: 120px; object-fit: cover; border-radius: 8px;" />` : ''}
                            <div>
                                <h3 style="font-weight: 800; font-size: 14px; margin: 0 0 4px 0; color: #1e293b; font-family: system-ui, sans-serif;">${post.foodName}</h3>
                                <p style="font-size: 11px; color: #64748b; margin: 0 0 8px 0; font-family: system-ui, sans-serif; font-weight: 600;">
                                    ${post.quantity} • ${post.donorName}
                                </p>
                                <button id="view-btn-${post.id}" style="
                                    width: 100%; 
                                    background-color: #059669; 
                                    color: white; 
                                    padding: 8px; 
                                    border-radius: 8px; 
                                    font-weight: 700; 
                                    font-size: 11px; 
                                    text-transform: uppercase; 
                                    letter-spacing: 0.05em; 
                                    border: none; 
                                    cursor: pointer;
                                    transition: background-color 0.2s;
                                ">
                                    View Details
                                </button>
                            </div>
                        </div>
                      `;
                      
                      const btn = content.querySelector(`#view-btn-${post.id}`);
                      if (btn) {
                          btn.addEventListener('click', () => {
                                infoWindowRef.current.close();
                                if (onPostingSelect) onPostingSelect(post.id);
                          });
                      }

                      infoWindowRef.current.setContent(content);
                      infoWindowRef.current.open(map, marker);
                  }
              });

              foodMarkers.push(marker);
          }

          // Volunteer Live Marker logic ...
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
                 zIndex: 2000,
                 icon: {
                     url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(volSvg),
                     scaledSize: new google.maps.Size(36, 36),
                     anchor: new google.maps.Point(18, 18)
                 },
                 title: `Volunteer: ${post.volunteerName}`
             });
             staticMarkersRef.current.push(vMarker);

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

      if (clustererRef.current) {
          clustererRef.current.addMarkers(foodMarkers);
      } else {
          foodMarkers.forEach(m => m.setMap(map));
          staticMarkersRef.current.push(...foodMarkers);
      }
  };

  const handleSaveView = () => {
      const map = mapInstanceRef.current;
      if (map) {
          const center = map.getCenter();
          const zoom = map.getZoom();
          const view = { lat: center.lat(), lng: center.lng(), zoom };
          localStorage.setItem(STORAGE_KEY_MAP_VIEW, JSON.stringify(view));
          setSavedView(view);
          
          setShowSaveSuccess(true);
          setTimeout(() => setShowSaveSuccess(false), 2000);
      }
  };

  const handleLocateMe = () => {
      if (userLocation && mapInstanceRef.current) {
          mapInstanceRef.current.panTo({ lat: userLocation.lat, lng: userLocation.lng });
          mapInstanceRef.current.setZoom(14);
          setAutoFollow(true);
      } else {
          alert("Location not available yet.");
      }
  };

  if (error) {
      return (
          <div className="h-full w-full rounded-[2rem] bg-slate-100 border border-slate-200 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mb-4 text-3xl">🗺️</div>
              <h3 className="text-slate-700 font-bold mb-2">Map Unavailable</h3>
              <p className="text-slate-500 text-sm max-w-xs">The map could not be loaded. Please check your API key configuration or internet connection.</p>
          </div>
      );
  }

  return (
      <div className="h-full w-full relative rounded-[2rem] shadow-inner bg-slate-100 border border-slate-200 overflow-hidden group">
          <div ref={mapContainerRef} className="h-full w-full" />
          
          {/* Map Controls */}
          <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
              <button 
                  onClick={handleSaveView}
                  className="w-10 h-10 bg-white rounded-xl shadow-lg border border-slate-100 flex items-center justify-center text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                  title="Save current view as default"
              >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
              </button>
              <button 
                  onClick={handleLocateMe}
                  className={`w-10 h-10 bg-white rounded-xl shadow-lg border border-slate-100 flex items-center justify-center transition-colors ${autoFollow ? 'text-blue-600 bg-blue-50' : 'text-slate-600 hover:text-blue-600 hover:bg-blue-50'}`}
                  title="My Location"
              >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </button>
          </div>

          {/* Success Toast */}
          <div className={`absolute top-6 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-md text-white text-xs font-bold px-4 py-2 rounded-full shadow-xl transition-all duration-300 pointer-events-none ${showSaveSuccess ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
              Map View Saved!
          </div>
      </div>
  );
};

export default PostingsMap;
