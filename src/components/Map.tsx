import React, { useEffect, useRef, useState } from 'react';
import { Coordinates, BuildingInsights } from '../types/solar';

interface BuildingData {
  roofArea: number;
  solarPanelArea: number;
  buildingInsights: BuildingInsights;
}

interface MapProps {
  coordinates: Coordinates;
  buildingData?: BuildingData;
}

const Map: React.FC<MapProps> = ({ coordinates, buildingData }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeView, setActiveView] = useState<'solar' | 'shading'>('solar');

  // Calculate yearly energy production
  const getYearlyEnergy = () => {
    const solarPotential = buildingData?.buildingInsights?.solarPotential;
    if (!solarPotential) return null;

    // Try to get energy from the best configuration first
    if (solarPotential.solarPanelConfigs && solarPotential.solarPanelConfigs.length > 0) {
      return solarPotential.solarPanelConfigs[0].yearlyEnergyDcKwh;
    }

    // Fallback to maxArrayAnnualEnergyKwh if available
    return solarPotential.maxArrayAnnualEnergyKwh;
  };

  // Initialize map
  useEffect(() => {
    const initMap = async () => {
      try {
        if (!mapRef.current) {
          console.error('Map container not found');
          return;
        }

        const map = new google.maps.Map(mapRef.current, {
          center: { lat: coordinates.lat, lng: coordinates.lng },
          zoom: 20,
          mapTypeId: google.maps.MapTypeId.SATELLITE,
          tilt: 0,
          mapTypeControl: true,
          mapTypeControlOptions: {
            style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
            position: google.maps.ControlPosition.TOP_RIGHT
          },
          zoomControl: true,
          zoomControlOptions: {
            position: google.maps.ControlPosition.RIGHT_CENTER
          },
          streetViewControl: true,
          fullscreenControl: true
        });

        googleMapRef.current = map;

        // Add marker for the location
        new google.maps.Marker({
          position: { lat: coordinates.lat, lng: coordinates.lng },
          map: map,
          title: 'Selected Location'
        });

        // If we have building data with valid bounds, fit the map to them
        if (buildingData?.buildingInsights?.boundingBox?.sw && buildingData?.buildingInsights?.boundingBox?.ne) {
          const bounds = new google.maps.LatLngBounds(
            { 
              lat: buildingData.buildingInsights.boundingBox.sw.latitude, 
              lng: buildingData.buildingInsights.boundingBox.sw.longitude 
            },
            { 
              lat: buildingData.buildingInsights.boundingBox.ne.latitude, 
              lng: buildingData.buildingInsights.boundingBox.ne.longitude 
            }
          );
          map.fitBounds(bounds);

          // Add roof segments with color based on sun exposure
          if (buildingData.buildingInsights.solarPotential?.roofSegmentStats) {
            buildingData.buildingInsights.solarPotential.roofSegmentStats.forEach((segment) => {
              if (segment.center && segment.boundingBox) {
                // Calculate average sun exposure
                const avgSunshine = segment.stats.sunshineQuantiles.reduce((a, b) => a + b, 0) / 
                                  segment.stats.sunshineQuantiles.length;
                
                // Color based on sun exposure (red = high, blue = low)
                const maxSunshine = 1200; // Adjust based on your data
                const intensity = Math.min((avgSunshine / maxSunshine) * 255, 255);
                const color = `rgb(${intensity}, ${intensity * 0.5}, 0)`;

                // Create polygon for the roof segment
                const segmentBounds = [
                  { lat: segment.boundingBox.sw.latitude, lng: segment.boundingBox.sw.longitude },
                  { lat: segment.boundingBox.sw.latitude, lng: segment.boundingBox.ne.longitude },
                  { lat: segment.boundingBox.ne.latitude, lng: segment.boundingBox.ne.longitude },
                  { lat: segment.boundingBox.ne.latitude, lng: segment.boundingBox.sw.longitude }
                ];

                new google.maps.Polygon({
                  paths: segmentBounds,
                  strokeColor: '#FFFFFF',
                  strokeOpacity: 0.8,
                  strokeWeight: 1,
                  fillColor: color,
                  fillOpacity: 0.35,
                  map: map
                });
              }
            });
          }
        }

        setIsLoading(false);
      } catch (error) {
        console.error('Error initializing map:', error);
        setError(error instanceof Error ? error.message : 'Failed to initialize map');
        setIsLoading(false);
      }
    };

    if (window.google?.maps) {
      initMap();
    } else {
      setError('Google Maps not loaded');
      setIsLoading(false);
    }

    return () => {
      if (googleMapRef.current) {
        googleMapRef.current = null;
      }
    };
  }, [coordinates, buildingData, activeView]);

  // Calculate average pitch and azimuth
  const getAverageRoofStats = () => {
    const segments = buildingData?.buildingInsights?.solarPotential?.roofSegmentStats;
    if (!segments || segments.length === 0) return null;

    const avgPitch = segments.reduce((sum, seg) => sum + seg.pitchDegrees, 0) / segments.length;
    const avgAzimuth = segments.reduce((sum, seg) => sum + seg.azimuthDegrees, 0) / segments.length;
    const totalArea = segments.reduce((sum, seg) => sum + seg.stats.areaMeters2, 0);
    const avgSunshine = segments.reduce((sum, seg) => {
      const segmentAvg = seg.stats.sunshineQuantiles.reduce((a, b) => a + b, 0) / seg.stats.sunshineQuantiles.length;
      return sum + segmentAvg;
    }, 0) / segments.length;

    return { avgPitch, avgAzimuth, totalArea, avgSunshine };
  };

  const roofStats = getAverageRoofStats();

  return (
    <div className="w-full relative flex gap-4">
      <div className="w-2/3 relative">
        <div 
          ref={mapRef}
          className="w-full h-[600px] rounded-lg shadow-lg overflow-hidden"
          style={{ 
            border: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc'
          }}
        />
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-75">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        )}
      </div>
      <div className="w-1/3 p-4 bg-white rounded-lg shadow-lg h-fit">
        {buildingData?.buildingInsights?.solarPotential && (
          <div className="space-y-6">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveView('solar')}
                className={`px-4 py-2 rounded-lg flex-1 ${
                  activeView === 'solar' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                Analyse Solaire
              </button>
              <button
                onClick={() => setActiveView('shading')}
                className={`px-4 py-2 rounded-lg flex-1 ${
                  activeView === 'shading' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                Ombrage
              </button>
            </div>

            {activeView === 'solar' ? (
              <div className="space-y-4">
                <h3 className="text-lg font-bold border-b pb-2">Analyse Solaire</h3>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Surface Totale du Toit</p>
                    <p className="font-bold">
                      {roofStats?.totalArea.toFixed(1) || 'N/A'} m²
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Surface Optimale pour Panneaux</p>
                    <p className="font-bold">
                      {buildingData.buildingInsights.solarPotential.maxArrayAreaMeters2?.toFixed(1) || 'N/A'} m²
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Inclinaison Moyenne</p>
                    <p className="font-bold">
                      {roofStats?.avgPitch.toFixed(1) || 'N/A'}°
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Orientation Moyenne</p>
                    <p className="font-bold">
                      {roofStats?.avgAzimuth.toFixed(1) || 'N/A'}°
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Ensoleillement Annuel Moyen</p>
                    <p className="font-bold">
                      {roofStats?.avgSunshine.toFixed(1) || 'N/A'} heures/an
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Production Estimée</p>
                    <p className="font-bold">
                      {getYearlyEnergy()?.toFixed(0) || 'N/A'} kWh/an
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="text-lg font-bold border-b pb-2">Analyse de l'Ombrage</h3>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Heures d'Ensoleillement Maximum</p>
                    <p className="font-bold">
                      {buildingData.buildingInsights.solarPotential.maxSunshineHoursPerYear?.toFixed(1) || 'N/A'} heures/an
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">Légende des Couleurs</p>
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 bg-red-500 rounded"></div>
                      <span className="text-sm">Excellent ensoleillement</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                      <span className="text-sm">Bon ensoleillement</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 bg-blue-500 rounded"></div>
                      <span className="text-sm">Faible ensoleillement</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {error && (
        <div className="absolute top-0 left-0 right-0 bg-red-100 text-red-700 px-4 py-2 rounded-t-lg">
          {error}
        </div>
      )}
    </div>
  );
};

export default Map;
