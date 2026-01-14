
let loaderPromise: Promise<void> | null = null;

export const loadGoogleMaps = (): Promise<void> => {
  if (typeof window !== 'undefined' && (window as any).google && (window as any).google.maps) {
    return Promise.resolve();
  }
  
  if (!loaderPromise) {
    loaderPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      // Using process.env.API_KEY as per instructions for the API key source
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.API_KEY}&libraries=places,geometry`;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = (e) => reject(e);
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
  await loadGoogleMaps();
  const geocoder = new google.maps.Geocoder();
  
  try {
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
