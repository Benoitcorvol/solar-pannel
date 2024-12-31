import { getCountryFromAddress } from './googleMaps';

const API_KEY = '6162|yZCtSWFZpEVDycpzurH62ypVxg1BkkisUgn2sz0g';
const ELECTRICITY_API_BASE_URL = 'https://zylalabs.com/api/3040/electricity+rates+in+europe+api';

// Fallback rates in €/kWh (updated 2024)
const FALLBACK_RATES: { [key: string]: number } = {
  'FR': 0.2170,
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
      return FALLBACK_RATES['FR'];
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
      return FALLBACK_RATES[countryCode] || FALLBACK_RATES['FR'];
    }

    const data: ElectricityRateResponse = await response.json();
    
    if (!data.success) {
      console.warn('API request not successful, using fallback rate');
      return FALLBACK_RATES[countryCode] || FALLBACK_RATES['FR'];
    }

    // Convert from €/MWh to €/kWh and add typical additional costs
    // API gives wholesale price, we need to add typical margins and taxes
    const wholesalePriceKwh = parseFloat(data.data.price) / 1000;
    const MARGIN_MULTIPLIER = 3.5; // Typical retail margin, grid costs, taxes
    const rateInKwh = wholesalePriceKwh * MARGIN_MULTIPLIER;
    
    console.log('API Rate details:', {
      wholesale_mwh: data.data.price,
      wholesale_kwh: wholesalePriceKwh,
      retail_kwh: rateInKwh,
      unit: data.data.unit
    });
    
    // Validate final retail rate is reasonable (between 0.10 and 0.50 €/kWh)
    if (rateInKwh < 0.10 || rateInKwh > 0.50) {
      console.warn('Calculated retail rate outside expected range, using fallback rate');
      return FALLBACK_RATES[countryCode] || FALLBACK_RATES['FR'];
    }

    return rateInKwh;

  } catch (error) {
    console.error('Error fetching electricity rate:', error);
    // Use fallback rate for the country (if we got it) or default to France
    return countryCode ? FALLBACK_RATES[countryCode] : FALLBACK_RATES['FR'];
  }
}

// Helper function to format rate for display
export function formatElectricityRate(rate: number, format: 'EUR' | 'CENTS' = 'EUR'): string {
  if (format === 'CENTS') {
    return `${(rate * 100).toFixed(1)}c€/kWh`;
  }
  return `${rate.toFixed(4)}€/kWh`;
}
