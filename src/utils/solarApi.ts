import { SolarApiResponse } from '../types/solar';
import { getCountryFromAddress } from './googleMaps';
import { isWordPressEnv, getApiUrl, config } from './config';

export async function getSolarPotential(address: string): Promise<SolarApiResponse> {
  try {
    console.log('Analyzing solar potential for address:', address);

    // Get country code using our geocoding function
    console.log('Getting country code for address...');
    const countryCode = await getCountryFromAddress(address);
    
    if (!countryCode) {
      console.error('Failed to get country code for address:', address);
      throw new Error('Unable to determine country from address. Please check the address and try again.');
    }
    console.log('Geocoding successful, country code:', countryCode);

    // Fetch solar data
    console.log('Fetching solar data...');
    if (isWordPressEnv) {
      // Use WordPress REST API
      const response = await fetch(getApiUrl(`solar-data?country=${countryCode}`), {
        headers: {
          'X-WP-Nonce': config.nonce || ''
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch solar data: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } else {
      // In development, call Google Solar API directly
      const geocoder = new google.maps.Geocoder();
      const geocodeResponse = await geocoder.geocode({ address });
      
      if (!geocodeResponse.results.length) {
        throw new Error('Unable to geocode address');
      }

      const { lat, lng } = geocodeResponse.results[0].geometry.location.toJSON();

      // Get building insights
      const buildingInsightsUrl = `buildingInsights:findClosest?location.latitude=${lat}&location.longitude=${lng}&key=${config.apis.google.solar}`;
      const buildingResponse = await fetch(getApiUrl(buildingInsightsUrl));
      
      if (!buildingResponse.ok) {
        throw new Error(`Failed to fetch building insights: ${buildingResponse.statusText}`);
      }

      const buildingInsights = await buildingResponse.json();

      // Get data layers
      const dataLayersUrl = `dataLayers:get?location.latitude=${lat}&location.longitude=${lng}&radiusMeters=100&view=FULL_LAYERS&key=${config.apis.google.solar}`;
      const layersResponse = await fetch(getApiUrl(dataLayersUrl));

      if (!layersResponse.ok) {
        throw new Error(`Failed to fetch data layers: ${layersResponse.statusText}`);
      }

      const dataLayers = await layersResponse.json();

      // Process and return the data in our expected format
      const solarPotential = buildingInsights.solarPotential;
      if (!solarPotential) {
        throw new Error('No solar potential data available for this address.');
      }

      const optimalConfig = solarPotential.solarPanelConfigs?.[0];
      const bestSegment = optimalConfig?.roofSegmentSummaries?.[0];

      if (!optimalConfig || !bestSegment) {
        throw new Error('No viable solar panel configurations found for this roof.');
      }

      return {
        buildingInsights,
        dataLayers,
        summary: {
          maxPanels: solarPotential.maxArrayPanelsCount,
          roofArea: solarPotential.maxArrayAreaMeters2,
          yearlyEnergyProduction: optimalConfig.yearlyEnergyDcKwh,
          sunlightHours: solarPotential.maxSunshineHoursPerYear,
          orientation: bestSegment.azimuthDegrees,
          tilt: bestSegment.pitchDegrees,
          carbonOffset: solarPotential.carbonOffsetFactorKgPerKwh * optimalConfig.yearlyEnergyDcKwh
        }
      };
    }
  } catch (error) {
    console.error('Error in getSolarPotential:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('An unexpected error occurred while analyzing solar potential.');
  }
}
