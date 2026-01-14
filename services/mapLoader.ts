
let loaderPromise: Promise<void> | null = null;

export const loadGoogleMaps = (): Promise<void> => {
  if (typeof window !== 'undefined' && (window as any).google && (window as any).google.maps && (window as any).markerClusterer) {
    return Promise.resolve();
  }
  
  if (!loaderPromise) {
    loaderPromise = new Promise((resolve, reject) => {
      const apiKey = process.env.API_KEY;
      
      // Strict validation: Reject if key is missing, "undefined", placeholder, or too short
      if (!apiKey || apiKey === 'undefined' || apiKey.includes('your_') || apiKey.length < 10) {
          console.warn("Google Maps API Key is invalid or missing. Map will not load.");
          reject(new Error("Invalid or missing Google Maps API Key"));
          return;
      }

      // Handle Google Maps Authentication Failure (Global Callback)
      const originalAuthFailure = (window as any).gm_authFailure;
      (window as any).gm_authFailure = () => {
          console.error("Google Maps Authentication Error: Invalid Key or Unauthorized Domain");
          if (originalAuthFailure) originalAuthFailure();
          // Dispatch custom event for components to handle
          window.dispatchEvent(new Event('google-maps-auth-failure'));
      };

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry`;
      script.async = true;
      script.defer = true;
      
      script.onload = () => {
        // Load MarkerClusterer Library after Maps API
        const clusterScript = document.createElement('script');
        clusterScript.src = "https://unpkg.com/@googlemaps/markerclusterer/dist/index.min.js";
        clusterScript.async = true;
        clusterScript.defer = true;
        clusterScript.onload = () => resolve();
        clusterScript.onerror = (e) => {
            console.warn("MarkerClusterer failed to load, map will work without clustering", e);
            resolve(); // Resolve anyway so map still loads
        };
        document.head.appendChild(clusterScript);
      };
      
      script.onerror = (e) => reject(new Error("Google Maps script failed to load"));
      document.head.appendChild(script);
    });
  }
  
  return loaderPromise;
};

export interface ReverseGeocodeResult {
  line1: string;
  line2: string;
  landmark?: string;
  pincode: string;
}

declare const google: any;

export const reverseGeocodeGoogle = async (lat: number, lng: number): Promise<ReverseGeocodeResult | null> => {
  try {
      await loadGoogleMaps();
      const geocoder = new google.maps.Geocoder();
      
      const { results } = await geocoder.geocode({ location: { lat, lng } });
      if (!results || results.length === 0) return null;
      
      const res = results[0];
      const getComponent = (type: string) => res.address_components.find((c: any) => c.types.includes(type))?.long_name || '';
      
      const streetNumber = getComponent('street_number');
      const route = getComponent('route');
      const premise = getComponent('premise');
      const sublocality = getComponent('sublocality') || getComponent('sublocality_level_1');
      const locality = getComponent('locality');
      const adminArea = getComponent('administrative_area_level_1');
      const postalCode = getComponent('postal_code');
      const pointOfInterest = getComponent('point_of_interest') || getComponent('establishment');

      let line1 = [premise, streetNumber, route].filter(Boolean).join(' ');
      if (!line1) line1 = sublocality || res.formatted_address.split(',')[0];
      
      const line2 = [sublocality, locality, adminArea].filter(Boolean).filter(s => !line1.includes(s)).join(', ');
      
      return {
          line1: line1.trim() || res.formatted_address,
          line2: line2.trim(),
          pincode: postalCode,
          landmark: pointOfInterest
      };
  } catch (error) {
    console.error("Geocoding error:", error);
    return null;
  }
}
