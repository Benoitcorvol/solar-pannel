import React, { useState } from 'react';
import { Sun } from 'lucide-react';
import { AddressInput } from './components/AddressInput';
import { AnalysisResults } from './components/AnalysisResults';
import { LoadingSpinner } from './components/LoadingSpinner';
import Map from './components/Map';
import type { SolarAnalysisResults, Coordinates, BuildingInsights } from './types/solar';

function App() {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<SolarAnalysisResults | null>(null);
  const [error, setError] = useState<string | null>(null);

  const geocodeAddress = async (address: string): Promise<Coordinates> => {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        address
      )}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&t language=fr&region=FR`
    );
    const data = await response.json();

    if (data.status !== 'OK') {
      throw new Error('Impossible de trouver l\'adresse');
    }

    const { lat, lng } = data.results[0].geometry.location;
    return { lat, lng };
  };

  const getBuildingInsights = async (coordinates: Coordinates): Promise<BuildingInsights> => {
    console.log('=== Making Building Insights Request ===');
    console.log('Coordinates:', coordinates);

    const url = new URL('http://localhost:3001/api/solar/buildingInsights');
    url.searchParams.append('lat', coordinates.lat.toString());
    url.searchParams.append('lng', coordinates.lng.toString());

    console.log('Request URL:', url.toString());

    try {
      console.log('Sending request...');
      const findClosestResponse = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      console.log('Response received');
      console.log('Status:', findClosestResponse.status);
      console.log('Status Text:', findClosestResponse.statusText);

      const responseText = await findClosestResponse.text();
      console.log('=== Raw API Response ===');
      console.log(responseText);

      if (!findClosestResponse.ok) {
        console.error('=== Solar API Error ===');
        console.error('Status:', findClosestResponse.status);
        console.error('Status Text:', findClosestResponse.statusText);
        console.error('Error Response:', responseText);
        throw new Error(`Failed to get building insights: ${findClosestResponse.status} ${findClosestResponse.statusText}`);
      }

      const data = JSON.parse(responseText);
      console.log('=== Parsed Solar API Response ===');
      console.log(JSON.stringify(data, null, 2));
      
      if (data.error) {
        console.error('=== API Returned Error ===');
        console.error('Error:', data.error);
        throw new Error(`API Error: ${data.error.message || JSON.stringify(data.error)}`);
      }

      // Validate and process the response
      if (!data.name || !data.center || !data.boundingBox || !data.solarPotential) {
        console.error('Invalid API response structure:', data);
        throw new Error('Invalid response from Solar API: Missing required fields');
      }

      // Log detailed solar potential information
      console.log('=== Detailed Solar Potential ===');
      console.log('Max Array Panels Count:', data.solarPotential.maxArrayPanelsCount);
      console.log('Max Array Area (m²):', data.solarPotential.maxArrayAreaMeters2);
      console.log('Max Annual Energy (kWh):', data.solarPotential.maxArrayAnnualEnergyKwh);
      console.log('Panel Configurations:', data.solarPotential.solarPanelConfigs);
      console.log('Roof Segments:', data.roofSegments);

      // Log building quality information
      console.log('Building analysis:', {
        confidence: data.confidence,
        imageQuality: data.imageryQuality,
        imageDate: data.imageryDate
      });

      // Log solar potential summary
      console.log('Solar potential:', {
        maxPanels: data.solarPotential.maxArrayPanelsCount,
        maxArea: data.solarPotential.maxArrayAreaMeters2,
        yearlyEnergy: data.solarPotential.maxArrayAnnualEnergyKwh,
        configurations: data.solarPotential.solarPanelConfigs?.length || 0
      });

      // Ensure required arrays exist
      data.roofSegments = data.roofSegments || [];
      data.solarPotential.solarPanelConfigs = data.solarPotential.solarPanelConfigs || [];

      // Log detailed configuration information if available
      if (data.solarPotential.solarPanelConfigs?.length > 0) {
        const bestConfig = data.solarPotential.solarPanelConfigs[0];
        console.log('Best configuration:', {
          panelsCount: bestConfig.panelsCount,
          yearlyEnergy: bestConfig.yearlyEnergyDcKwh,
          segments: bestConfig.roofSegmentSummaries?.length || 0
        });
      }

      return {
        ...data,
        confidence: data.confidence,
        imageryQuality: data.imageryQuality,
        imageryDate: data.imageryDate,
        solarPotential: {
          ...data.solarPotential,
          maxArrayPanelsCount: data.solarPotential.maxArrayPanelsCount,
          maxArrayAreaMeters2: data.solarPotential.maxArrayAreaMeters2,
          maxArrayAnnualEnergyKwh: data.solarPotential.maxArrayAnnualEnergyKwh,
          carbonOffsetFactorKgPerKwh: data.solarPotential.carbonOffsetFactorKgPerMwh / 1000
        }
      } as BuildingInsights;
    } catch (error) {
      console.error('Error in getBuildingInsights:', error);
      throw error;
    }
  };

  const handleAnalyze = async (address: string) => {
    setIsLoading(true);
    setError(null);
    setResults(null); // Clear previous results
    
    try {
      // Get coordinates from address
      const coordinates = await geocodeAddress(address);
      console.log('=== Coordinates ===', coordinates);
      
      // Get building insights from Solar API
      const buildingInsights = await getBuildingInsights(coordinates);
      console.log('=== Raw Building Insights ===', JSON.stringify(buildingInsights, null, 2));
      
      // Get the best configuration if available
      const bestConfig = buildingInsights.solarPotential.solarPanelConfigs?.[0];
      console.log('=== Best Config ===', bestConfig);
      
      // Calculate values based on the best configuration or fall back to maximum values
      const maxArrayAreaMeters2 = buildingInsights.solarPotential.maxArrayAreaMeters2;
      const yearlyEnergyProduction = bestConfig 
        ? bestConfig.yearlyEnergyDcKwh 
        : buildingInsights.solarPotential.maxArrayAnnualEnergyKwh;
      
      console.log('=== Calculations ===');
      console.log('Max Array Area:', maxArrayAreaMeters2);
      console.log('Yearly Energy:', yearlyEnergyProduction);
      
      // Calculate results from building insights
      const results: SolarAnalysisResults = {
        coordinates,
        buildingInsights,
        roofArea: maxArrayAreaMeters2,
        solarPanelArea: maxArrayAreaMeters2 * 0.9, // Assuming 90% of roof area is usable
        yearlyEnergyProduction,
        carbonOffset: yearlyEnergyProduction * (buildingInsights.solarPotential.carbonOffsetFactorKgPerKwh || 0.068),
      };
      
      console.log('=== Final Results ===', results);
      
      setResults(results);
    } catch (error) {
      console.error('=== Error in handleAnalyze ===', error);
      setError(error instanceof Error ? error.message : 'Failed to analyze solar potential. Please try again.');
      setResults(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl flex flex-col items-center space-y-8">
        <div className="text-center">
          <div className="flex items-center justify-center space-x-2 mb-2">
            <Sun className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Solar Potential Analysis</h1>
          </div>
          <p className="text-gray-600">Discover your home's solar energy potential</p>
        </div>

        <AddressInput onAnalyze={handleAnalyze} isLoading={isLoading} />

        {isLoading && (
          <div className="text-center">
            <LoadingSpinner />
            <p className="mt-2 text-gray-600">Analyzing solar potential...</p>
          </div>
        )}

        {error && (
          <div className="text-red-500 bg-red-50 px-4 py-2 rounded-lg">
            {error}
          </div>
        )}

        {results && (
          <div>
            <Map 
              coordinates={results.coordinates}
              buildingData={{
                roofArea: results.roofArea,
                solarPanelArea: results.solarPanelArea,
                buildingInsights: results.buildingInsights,
              }}
            />
            <AnalysisResults results={results} />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
