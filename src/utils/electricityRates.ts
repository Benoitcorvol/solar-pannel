import { getCountryFromAddress } from './googleMaps';
import { isWordPressEnv, getApiUrl, config } from './config';

const API_KEY = import.meta.env.VITE_ZYLA_API_KEY;

// Fallback retail electricity rates in €/kWh (updated 2024)
const FALLBACK_RATES: { [key: string]: number } = {
  'FR': 0.34223, // Updated French rate for autoconsommation
  'DE': 0.3790,
  'ES': 0.1890,
  'IT': 0.2590,
  'GB': 0.2780,
  'NL': 0.3150,
  'BE': 0.2890
};

interface ElectricityRateResponse {
  price: number;
  timestamp?: string;
}

export async function getCurrentElectricityRate(address: string): Promise<number> {
  try {
    // Get country code from address using Google Maps Geocoding
    const countryCode = await getCountryFromAddress(address);
    
    if (!countryCode) {
      console.warn('Could not determine country from address, using fallback rate for France');
      return FALLBACK_RATES['FR'];
    }

    if (isWordPressEnv) {
      // Use WordPress REST API
      const response = await fetch(getApiUrl(`electricity-price?country=${countryCode}`), {
        headers: {
          'X-WP-Nonce': config.nonce || ''
        }
      });

      if (!response.ok) {
        console.warn(`API error (${response.status}), using fallback rate for ${countryCode}`);
        return FALLBACK_RATES[countryCode] || FALLBACK_RATES['FR'];
      }

      const data: ElectricityRateResponse = await response.json();
      return data.price;
    } else {
      // In development, call Zyla API directly
      const response = await fetch(`https://zylalabs.com/api/3040/electricity+rates+in+europe+api/3214/latest?region=${countryCode}`, {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${API_KEY}`
        }
      });

      if (!response.ok) {
        console.warn(`API error (${response.status}), using fallback rate for ${countryCode}`);
        return FALLBACK_RATES[countryCode] || FALLBACK_RATES['FR'];
      }

      const data = await response.json();
      
      if (!data.success) {
        console.warn('API request not successful, using fallback rate');
        return FALLBACK_RATES[countryCode] || FALLBACK_RATES['FR'];
      }

      // Use retail rate instead of wholesale price
      const rateInKwh = FALLBACK_RATES[countryCode] || FALLBACK_RATES['FR'];
      
      // Log the rates
      console.log('Rate details:', {
        country: countryCode,
        wholesale_price: `${data.data.price} ${data.data.unit}`,
        retail_rate: `${rateInKwh} €/kWh`,
        rate_type: 'Autoconsommation'
      });

      return rateInKwh;
    }
  } catch (error) {
    console.error('Error fetching electricity rate:', error);
    try {
      // Try to get country code again in case the error was from the API calls
      const countryCode = await getCountryFromAddress(address);
      return countryCode ? FALLBACK_RATES[countryCode] : FALLBACK_RATES['FR'];
    } catch {
      // If everything fails, return French rate
      return FALLBACK_RATES['FR'];
    }
  }
}

// Helper function to format rate for display
export function formatElectricityRate(rate: number, format: 'EUR' | 'CENTS' = 'EUR'): string {
  if (format === 'CENTS') {
    return `${(rate * 100).toFixed(1)}c€/kWh`;
  }
  return `${rate.toFixed(4)}€/kWh`;
}
