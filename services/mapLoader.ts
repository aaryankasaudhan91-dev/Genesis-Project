
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
