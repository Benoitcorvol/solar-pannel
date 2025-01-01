import { getCountryFromAddress } from './googleMaps';

const API_KEY = import.meta.env.VITE_ZYLA_API_KEY;
const ELECTRICITY_API_BASE_URL = 'https://zylalabs.com/api/3040/electricity+rates+in+europe+api';

// Retail electricity rates in €/kWh (updated 2024)
const RETAIL_RATES: { [key: string]: number } = {
  'FR': 0.34223, // Updated French rate for autoconsommation
  'DE': 0.3790,
  'ES': 0.1890,
  'IT': 0.2590,
  'GB': 0.2780,
  'NL': 0.3150,
  'BE': 0.2890
};

interface ElectricityRateResponse {
  success: boolean;
  status: number;
  data: {
    date: string;
    region: string;
    country: string;
    price: string;
    unit: string;
  };
}

export async function getCurrentElectricityRate(address: string): Promise<number> {
  let countryCode: string | null = null;
  
  try {
    // Get country code from address using Google Maps Geocoding
    countryCode = await getCountryFromAddress(address);
    
    if (!countryCode) {
      console.warn('Could not determine country from address, using fallback rate for France');
      return RETAIL_RATES['FR'];
    }

    // Fetch current electricity rate from API
    const response = await fetch(`${ELECTRICITY_API_BASE_URL}/3214/latest?region=${countryCode}`, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      }
    });

    if (!response.ok) {
      console.warn(`API error (${response.status}), using fallback rate for ${countryCode}`);
      return RETAIL_RATES[countryCode] || RETAIL_RATES['FR'];
    }

    const data: ElectricityRateResponse = await response.json();
    
    if (!data.success) {
      console.warn('API request not successful, using fallback rate');
      return RETAIL_RATES[countryCode] || RETAIL_RATES['FR'];
    }

    // Instead of using wholesale prices, return the known retail rate
    // This is more accurate as wholesale prices don't reliably predict retail rates
    const rateInKwh = RETAIL_RATES[countryCode] || RETAIL_RATES['FR'];
    
    // Log the rates
    console.log('Rate details:', {
      country: countryCode,
      wholesale_price: `${data.data.price} ${data.data.unit}`,
      retail_rate: `${rateInKwh} €/kWh`,
      rate_type: 'Autoconsommation'
    });

    return rateInKwh;

  } catch (error) {
    console.error('Error fetching electricity rate:', error);
    // Use fallback rate for the country (if we got it) or default to France
    return countryCode ? RETAIL_RATES[countryCode] : RETAIL_RATES['FR'];
  }
}

// Helper function to format rate for display
export function formatElectricityRate(rate: number, format: 'EUR' | 'CENTS' = 'EUR'): string {
  if (format === 'CENTS') {
    return `${(rate * 100).toFixed(1)}c€/kWh`;
  }
  return `${rate.toFixed(4)}€/kWh`;
}
