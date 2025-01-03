/// <reference types="vite/client" />
/// <reference types="@types/google.maps" />
import { Loader } from '@googlemaps/js-api-loader';

interface LatLngLiteral {
  lat: number;
  lng: number;
}

declare global {
  interface ImportMetaEnv {
    VITE_GOOGLE_MAPS_API_KEY: string;
  }
}

// Initialize the Google Maps loader with all required libraries
import { config } from './config';

const loader = new Loader({
  apiKey: config.apis.google.maps,
  version: 'weekly',
  libraries: [
    'geometry',
    'places',
    'drawing',
    'visualization'
  ],
  mapIds: ['2cbff3bb7f42c667']
});

// Export a function to load Google Maps with error logging
export const loadGoogleMaps = async () => {
  try {
    console.log('Starting Google Maps initialization...');
    console.log('Using API Key:', config.apis.google.maps);
    const google = await loader.load();
    console.log('Google Maps loaded successfully');
    return google;
  } catch (error) {
    console.error('Failed to load Google Maps:', error);
    throw new Error('Erreur de chargement de Google Maps. Veuillez réessayer.');
  }
};

// Function to geocode an address and get coordinates
export async function geocodeAddress(address: string): Promise<LatLngLiteral> {
  try {
    console.log('Starting geocoding for address:', address);
    
    // Load Google Maps and verify it's available
    await loader.load();
    if (!window.google?.maps?.Geocoder) {
      console.error('Google Maps Geocoder not available');
      throw new Error('Service de géocodage non disponible. Veuillez réessayer.');
    }
    
    const geocoder = new window.google.maps.Geocoder();
    console.log('Geocoder initialized, sending request...');
    
    // Format address for better French address handling
    const formattedAddress = address.replace(/\s+/g, ' ').trim();
    console.log('Formatted address:', formattedAddress);
    
    const geocodeRequest = {
      address: formattedAddress,
      region: 'fr',
      componentRestrictions: { country: 'fr' }
    };
    console.log('Geocode request:', geocodeRequest);
    
    const response = await geocoder.geocode(geocodeRequest);
    console.log('Geocode response:', response);
    
    if (!response.results || response.results.length === 0) {
      console.warn('No results found for address:', formattedAddress);
      throw new Error('Adresse non trouvée. Veuillez vérifier l\'adresse et réessayer.');
    }

    const result = response.results[0];
    console.log('First result:', result);
    
    const location = result.geometry.location;
    
    // Verify that the address is in France
    const countryComponent = result.address_components.find(
      (component: { types: string[]; short_name: string }) => component.types.includes('country')
    );
    console.log('Country component:', countryComponent);

    if (!countryComponent || countryComponent.short_name !== 'FR') {
      console.error('Address not in France:', countryComponent);
      throw new Error('L\'adresse doit être située en France.');
    }

    const coordinates = {
      lat: location.lat(),
      lng: location.lng()
    };
    console.log('Final coordinates:', coordinates);
    
    return coordinates;
  } catch (error) {
    console.error('Detailed geocoding error:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('quota')) {
        throw new Error('Limite d\'utilisation du service de géocodage atteinte. Veuillez réessayer plus tard.');
      } else if (error.message.includes('network')) {
        throw new Error('Erreur de connexion au service de géocodage. Veuillez vérifier votre connexion internet.');
      }
      throw error;
    }
    throw new Error('Erreur lors de la recherche de l\'adresse. Veuillez réessayer.');
  }
}

// Function to get country code from address using Google Maps Geocoding
export async function getCountryFromAddress(address: string): Promise<string | null> {
  try {
    await loader.load();
    const geocoder = new window.google.maps.Geocoder();
    
    const response = await geocoder.geocode({ address });
    
    if (response.results.length === 0) {
      console.warn('No results found for address:', address);
      return null;
    }

    // Find the country component
    const countryComponent = response.results[0].address_components.find(
      (component: { types: string[]; short_name: string }) => component.types.includes('country')
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
