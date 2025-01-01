import React, { useState } from 'react';
import { Sun } from 'lucide-react';
import { AddressInput } from './components/AddressInput';
import { AnalysisResults } from './components/AnalysisResults';
import { LoadingSpinner } from './components/LoadingSpinner';
import Map from './components/Map';
import type { SolarAnalysisResults, SolarApiResponse } from './types/solar';
import { getSolarPotential } from './utils/solarApi';

function App() {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<SolarAnalysisResults | null>(null);
  interface AnalysisError {
    message: string;
    retryable: boolean;
  }
  
  const [error, setError] = useState<AnalysisError | null>(null);
  const [lastAddress, setLastAddress] = useState<string | null>(null);

  const validateSolarAnalysis = (analysis: Partial<SolarApiResponse>): SolarApiResponse => {
    if (!analysis?.buildingInsights?.center) {
      throw new Error('Invalid building data received');
    }
    if (!analysis?.summary?.roofArea || !analysis?.summary?.yearlyEnergyProduction) {
      throw new Error('Missing critical solar analysis data');
    }
    if (!analysis.buildingInsights || !analysis.dataLayers || !analysis.summary) {
      throw new Error('Incomplete solar analysis data');
    }
    return analysis as SolarApiResponse;
  };

  const handleAnalyze = async (address: string) => {
    let mounted = true;
    setIsLoading(true);
    setError(null);
    setResults(null);
    setLastAddress(address);
    
    try {
      // Get solar potential analysis
      const solarAnalysis = validateSolarAnalysis(await getSolarPotential(address));
      
      if (!mounted) return;

      const coordinates = {
        lat: solarAnalysis.buildingInsights.center.latitude,
        lng: solarAnalysis.buildingInsights.center.longitude
      };
      
      // Create results object with all required fields
      const results: SolarAnalysisResults = {
        coordinates,
        buildingInsights: solarAnalysis.buildingInsights,
        roofArea: solarAnalysis.summary.roofArea,
        solarPanelArea: solarAnalysis.summary.roofArea * 0.9, // Using 90% of roof area
        yearlyEnergyProduction: solarAnalysis.summary.yearlyEnergyProduction,
        carbonOffset: solarAnalysis.summary.carbonOffset,
        orientation: solarAnalysis.summary.orientation,
        tilt: solarAnalysis.summary.tilt,
        sunlightHours: solarAnalysis.summary.sunlightHours,
        address // Add the address from the input
      };
      
      console.log('Analysis results:', results);
      
      if (mounted) {
        setResults(results);
      }
    } catch (error) {
      console.error('=== Error in handleAnalyze ===', error);
      if (!mounted) return;

      let errorMessage: string;
      let retryable = true;

      if (error instanceof Error) {
        if (error.message.includes('geocode')) {
          errorMessage = 'Invalid address. Please check the address and try again.';
        } else if (error.message.includes('API error')) {
          errorMessage = 'Service temporarily unavailable. Please try again later.';
        } else if (error.message.includes('supported')) {
          errorMessage = 'This address is not currently supported for solar analysis.';
          retryable = false;
        } else if (error.message.includes('Invalid building data') || error.message.includes('Missing critical')) {
          errorMessage = 'Unable to analyze this building. The roof might not be suitable for solar panels.';
          retryable = false;
        } else {
          errorMessage = error.message;
        }
      } else {
        errorMessage = 'An unexpected error occurred. Please try again.';
      }

      setError({ message: errorMessage, retryable });
      setResults(null);
    } finally {
      if (mounted) {
        setIsLoading(false);
      }
    }

    return () => {
      mounted = false;
    };
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
          <div className="text-red-500 bg-red-50 px-4 py-3 rounded-lg flex flex-col items-center">
            <p>{error.message}</p>
            {error.retryable && lastAddress && (
              <button 
                onClick={() => handleAnalyze(lastAddress)}
                className="mt-2 text-sm bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1 rounded transition-colors"
              >
                Retry Analysis
              </button>
            )}
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
              onCustomAreaUpdate={(area) => {
                if (results && area !== null) {
                  // Calculate proportional values based on area ratio
                  const areaRatio = area / results.roofArea;
                  
                  setResults({
                    ...results,
                    solarPanelArea: area,
                    yearlyEnergyProduction: Math.round(results.yearlyEnergyProduction * areaRatio),
                    carbonOffset: Math.round(results.carbonOffset * areaRatio)
                  });
                }
              }}
              onTechnicalInfoUpdate={(info) => {
                if (results) {
                  // Update all relevant fields with the new technical information
                  const newResults = {
                    ...results,
                    solarPanelArea: info.usableArea,
                    yearlyEnergyProduction: Math.round(info.estimatedEnergy),
                    carbonOffset: Math.round(info.estimatedEnergy * 0.5), // 0.5 kg CO2 per kWh
                    tilt: info.avgPitch
                  };
                  
                  console.log('Updating results with technical info:', {
                    oldArea: results.solarPanelArea,
                    newArea: info.usableArea,
                    oldEnergy: results.yearlyEnergyProduction,
                    newEnergy: info.estimatedEnergy,
                    numberOfPanels: info.numberOfPanels,
                    peakPower: info.peakPower
                  });
                  
                  setResults(newResults);
                }
              }}
            />
            <AnalysisResults 
              results={results}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
