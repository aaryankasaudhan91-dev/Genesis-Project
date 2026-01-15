
export interface ReverseGeocodeResult {
  line1: string;
  line2: string;
  landmark?: string;
  pincode: string;
}

// Using OpenStreetMap Nominatim for free geocoding
export const reverseGeocodeGoogle = async (lat: number, lng: number): Promise<ReverseGeocodeResult | null> => {
  try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
      if (!response.ok) return null;
      
      const data = await response.json();
      const addr = data.address;
      
      if (!addr) return null;

      const line1 = addr.road || addr.building || addr.house_number || addr.suburb || '';
      const line2 = [addr.city, addr.state, addr.country].filter(Boolean).join(', ');
      const landmark = addr.neighbourhood || addr.suburb || '';
      const pincode = addr.postcode || '';

      return {
          line1: line1 || data.display_name.split(',')[0],
          line2: line2,
          landmark,
          pincode
      };
  } catch (error) {
    console.error("Geocoding error:", error);
    return null;
  }
};

// Legacy stub to prevent build errors if referenced elsewhere, 
// though we are moving away from loading the Google script.
export const loadGoogleMaps = (): Promise<void> => {
    return Promise.resolve();
};
