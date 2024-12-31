import axios, { AxiosError } from 'axios';
import { BuildingInsights, SolarApiResponse, ApiErrorResponse } from '../types/solar';

const SOLAR_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const SOLAR_API_BASE_URL = 'https://solar.googleapis.com/v1';

export async function getSolarPotential(address: string): Promise<SolarApiResponse> {
  try {
    console.log('Analyzing solar potential for address:', address);

    // First, geocode the address to get coordinates
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${SOLAR_API_KEY}`;
    console.log('Geocoding address...');
    const geocodeResponse = await axios.get(geocodeUrl);
    
    if (!geocodeResponse.data.results?.[0]?.geometry?.location) {
      console.error('Geocoding failed:', geocodeResponse.data);
      throw new Error('Unable to geocode address. Please check the address and try again.');
    }

    const { lat, lng } = geocodeResponse.data.results[0].geometry.location;
    console.log('Geocoding successful:', { lat, lng });

    // Get building insights
    const buildingInsightsUrl = `${SOLAR_API_BASE_URL}/buildingInsights:findClosest`;
    console.log('Fetching building insights...');
    const buildingInsightsResponse = await axios.get<BuildingInsights>(buildingInsightsUrl, {
      params: {
        'location.latitude': lat,
        'location.longitude': lng,
        key: SOLAR_API_KEY
      }
    }).catch((error: AxiosError<ApiErrorResponse>) => {
      if (error.response?.data?.error) {
        const apiError = error.response.data.error;
        console.error('Building insights API error:', apiError);
        throw new Error(`Solar API error: ${apiError.message} (${apiError.status})`);
      }
      console.error('Building insights request failed:', error.message);
      throw new Error('Failed to fetch building insights. The address might not be supported.');
    });

    const solarPotential = buildingInsightsResponse.data.solarPotential;
    if (!solarPotential) {
      console.error('No solar potential data in response:', buildingInsightsResponse.data);
      throw new Error('No solar potential data available for this address.');
    }

    // Get data layers
    const dataLayersUrl = `${SOLAR_API_BASE_URL}/dataLayers:get`;
    console.log('Fetching data layers...');
    const dataLayersResponse = await axios.get(dataLayersUrl, {
      params: {
        'location.latitude': lat,
        'location.longitude': lng,
        radiusMeters: 100,
        view: 'FULL_LAYERS',
        key: SOLAR_API_KEY
      }
    }).catch((error: AxiosError<ApiErrorResponse>) => {
      if (error.response?.data?.error) {
        const apiError = error.response.data.error;
        console.error('Data layers API error:', apiError);
        throw new Error(`Solar API error: ${apiError.message} (${apiError.status})`);
      }
      console.error('Data layers request failed:', error.message);
      throw new Error('Failed to fetch solar data layers.');
    });

    // Validate data layers response
    const dataLayers = dataLayersResponse.data;
    if (!dataLayers.rgbUrl || !dataLayers.dsmUrl || !dataLayers.annualFluxUrl) {
      console.error('Incomplete data layers response:', dataLayers);
      throw new Error('Solar data layers are incomplete or invalid.');
    }

    // Find optimal configuration
    if (!solarPotential.solarPanelConfigs?.length) {
      console.error('No solar panel configurations available');
      throw new Error('No viable solar panel configurations found for this roof.');
    }

    const optimalConfig = solarPotential.solarPanelConfigs.reduce((prev, current) => 
      current.yearlyEnergyDcKwh > prev.yearlyEnergyDcKwh ? current : prev
    );

    // Get the best roof segment
    if (!optimalConfig.roofSegmentSummaries?.length) {
      console.error('No roof segment summaries available');
      throw new Error('No viable roof segments found for solar panels.');
    }

    const bestSegment = optimalConfig.roofSegmentSummaries.reduce((prev, current) => 
      current.yearlyEnergyDcKwh > prev.yearlyEnergyDcKwh ? current : prev
    );

    // Return response matching SolarApiResponse type
    return {
      buildingInsights: buildingInsightsResponse.data,
      dataLayers: {
        rgbUrl: dataLayers.rgbUrl,
        dsmUrl: dataLayers.dsmUrl,
        annualFluxUrl: dataLayers.annualFluxUrl,
        monthlyFluxUrl: dataLayers.monthlyFluxUrl,
        maskUrl: dataLayers.maskUrl
      },
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
  } catch (error) {
    console.error('Error in getSolarPotential:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('An unexpected error occurred while analyzing solar potential.');
  }
}
