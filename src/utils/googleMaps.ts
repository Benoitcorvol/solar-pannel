import { Loader } from '@googlemaps/js-api-loader';

// Initialize the Google Maps loader with all required libraries
const loader = new Loader({
  apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  version: 'weekly',
  libraries: [
    'geometry',
    'places',
    'drawing',
    'visualization'
  ],
  mapIds: ['2cbff3bb7f42c667']
});

// Export a function to load Google Maps
export const loadGoogleMaps = () => loader.load();

// Function to get country code from address using Google Maps Geocoding
export async function getCountryFromAddress(address: string): Promise<string | null> {
  try {
    await loader.load();
    const geocoder = new google.maps.Geocoder();
    
    const response = await geocoder.geocode({ address });
    
    if (response.results.length === 0) {
      console.warn('No results found for address:', address);
      return null;
    }

    // Find the country component
    const countryComponent = response.results[0].address_components.find(
      component => component.types.includes('country')
    );

    if (!countryComponent) {
      console.warn('No country found in address components');
      return null;
    }

    return countryComponent.short_name; // Returns country code (e.g., 'FR', 'DE')
  } catch (error) {
    console.error('Error geocoding address:', error);
    return null;
  }
}

// Export the loader instance in case it's needed elsewhere
export default loader;
