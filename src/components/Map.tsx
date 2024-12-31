import React, { useEffect, useRef, useState } from 'react';
import { Coordinates, BuildingInsights } from '../types/solar';
import * as turf from '@turf/turf';

// Interface for temporary drawing elements
// Helper functions to safely set map
const setMarkerMap = (marker: google.maps.marker.AdvancedMarkerElement | null, map: google.maps.Map | null) => {
  if (marker) {
    marker.map = map;
  }
};

const setPolylineMap = (polyline: google.maps.Polyline | google.maps.Polygon | null | undefined, map: google.maps.Map | null) => {
  if (polyline) {
    polyline.setMap(map);
  }
};

interface TempDrawingElements {
  line?: google.maps.Polyline | null;
  marker?: google.maps.marker.AdvancedMarkerElement | null;
  measurementLabel?: google.maps.marker.AdvancedMarkerElement | null;
}

interface BuildingData {
  roofArea: number;
  solarPanelArea: number;
  buildingInsights: BuildingInsights;
}

interface MapProps {
  coordinates: Coordinates;
  buildingData?: BuildingData;
  onCustomAreaUpdate?: (area: number | null) => void;
}

const Map: React.FC<MapProps> = ({ coordinates, buildingData, onCustomAreaUpdate }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeView, setActiveView] = useState<'solar' | 'shading' | 'drawing'>('solar');
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  // Drawing state
  const drawnPointsRef = useRef<google.maps.LatLng[]>([]);
  const polygonRef = useRef<google.maps.Polygon | null>(null);
  const firstPointMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const vertexMarkersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const tempDrawingElements = useRef<TempDrawingElements>({});
  
  // UI state
  const [customArea, setCustomArea] = useState<number | null>(null);
  const [measurementMode, setMeasurementMode] = useState(false);
  const [currentDistance, setCurrentDistance] = useState<number | null>(null);
  const [totalPerimeter, setTotalPerimeter] = useState<number | null>(null);

  // Calculate yearly energy production
  const getYearlyEnergy = () => {
    const solarPotential = buildingData?.buildingInsights?.solarPotential;
    if (!solarPotential) return 0;

    // Try to get energy from the best configuration first
    if (solarPotential.solarPanelConfigs && solarPotential.solarPanelConfigs.length > 0) {
      return solarPotential.solarPanelConfigs[0].yearlyEnergyDcKwh || 0;
    }

    // Fallback to maxArrayAnnualEnergyKwh if available
    return solarPotential.maxArrayAnnualEnergyKwh || 0;
  };

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

  // Initialize map
  // Separate effect for map initialization
  useEffect(() => {
    let mapInstance: google.maps.Map | null = null;
    let mounted = true;
    
    setIsLoading(true);
    setError(null);
    
    const initMap = async () => {
      try {
        if (!mapRef.current) {
          console.error('Map container not found');
          return;
        }

        // Google Maps is already loaded globally
        if (!window.google || !window.google.maps) {
          throw new Error('Google Maps not loaded');
        }

        // Import the marker library
        const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary("marker") as google.maps.MarkerLibrary;

        mapInstance = new window.google.maps.Map(mapRef.current, {
          center: { lat: coordinates.lat, lng: coordinates.lng },
          zoom: 20,
          mapTypeId: google.maps.MapTypeId.SATELLITE,
          mapId: '2cbff3bb7f42c667', // Required for AdvancedMarkerElement
          // Map controls
          zoomControl: true,
          mapTypeControl: true,
          scaleControl: true,
          streetViewControl: false,
          rotateControl: true,
          fullscreenControl: true,
          // Control positions
          zoomControlOptions: {
            position: google.maps.ControlPosition.RIGHT_TOP
          },
          mapTypeControlOptions: {
            position: google.maps.ControlPosition.TOP_RIGHT,
            style: google.maps.MapTypeControlStyle.DROPDOWN_MENU,
            mapTypeIds: [
              google.maps.MapTypeId.SATELLITE,
              google.maps.MapTypeId.HYBRID
            ]
          },
          // Disable 45-degree imagery
          tilt: 0,
          heading: 0
        });

        googleMapRef.current = mapInstance;

        // Add marker for the location
        const markerView = new PinElement({
          scale: 1.2,
          background: '#4CAF50',
          borderColor: '#4CAF50',
          glyphColor: '#FFFFFF'
        });

        const marker = new AdvancedMarkerElement({
          position: { lat: coordinates.lat, lng: coordinates.lng },
          map: mapInstance,
          title: 'Selected Location',
          content: markerView.element
        });

        return { map: mapInstance, marker };
      } catch (error) {
        console.error('Error initializing map:', error);
        if (mounted) {
          setError(error instanceof Error ? error.message : 'Failed to initialize map');
        }
        return null;
      }
    };

    initMap().then((result) => {
      if (!mounted) return;
      if (!result) {
        setIsLoading(false);
        return;
      }
      const { map } = result;
      setIsLoading(false);

      // Add click listener for drawing mode
      if (!map) return;

      map.addListener('click', async (e: google.maps.MapMouseEvent) => {
          if (!isDrawingMode || !e.latLng) return;

          const newPoint = e.latLng;
          drawnPointsRef.current = [...drawnPointsRef.current, newPoint];

          // Check if we're near the first point to close the polygon
          if (drawnPointsRef.current.length > 2) {
            const firstPoint = drawnPointsRef.current[0];
            const distance = google.maps.geometry.spherical.computeDistanceBetween(
              firstPoint,
              e.latLng
            );
            if (distance < 5) {
              // Close the polygon
              drawnPointsRef.current = [...drawnPointsRef.current, firstPoint];
              if (firstPointMarkerRef.current) {
                setMarkerMap(firstPointMarkerRef.current, null);
                firstPointMarkerRef.current = null;
              }
              setIsDrawingMode(false);
              return;
            }
          }

          // Import marker library components
          const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary("marker") as google.maps.MarkerLibrary;

          // Create marker for the point
          const vertexMarkerView = new PinElement({
            scale: 0.8,
            background: '#4CAF50',
            borderColor: '#4CAF50',
            glyphColor: '#FFFFFF'
          });

          const marker = new AdvancedMarkerElement({
            position: newPoint,
            map: map,
            title: 'Vertex point',
            content: vertexMarkerView.element
          });

          vertexMarkersRef.current.push(marker);

          // Update polygon if we have enough points
          if (drawnPointsRef.current.length >= 2) {
            if (polygonRef.current) {
              polygonRef.current.setMap(null);
            }

            const path = [...drawnPointsRef.current];
            polygonRef.current = new google.maps.Polygon({
              paths: path,
              strokeColor: '#4CAF50',
              strokeOpacity: 0.8,
              strokeWeight: 2,
              fillColor: '#4CAF50',
              fillOpacity: 0.35,
              map: map,
            });

            // Calculate area using turf.js
            const coordinates = path.map(point => [point.lng(), point.lat()]);
            coordinates.push([path[0].lng(), path[0].lat()]); // Close the polygon
            const polygon = turf.polygon([coordinates]);
            const area = turf.area(polygon);
            setCustomArea(area);
            if (onCustomAreaUpdate) {
              onCustomAreaUpdate(area);
            }

            // Calculate perimeter
            let perimeter = 0;
            for (let i = 0; i < path.length - 1; i++) {
              const from = turf.point([path[i].lng(), path[i].lat()]);
              const to = turf.point([path[i + 1].lng(), path[i + 1].lat()]);
              perimeter += turf.distance(from, to, { units: 'meters' });
            }
            setTotalPerimeter(perimeter);
          }
        });

        // Add mousemove listener for measurements
        if (!map) return;

        map.addListener('mousemove', async (e: google.maps.MapMouseEvent) => {
          if (!isDrawingMode || !e.latLng || drawnPointsRef.current.length === 0 || !measurementMode) return;

          // Check if we're near the first point
          if (drawnPointsRef.current.length > 2) {
            const firstPoint = drawnPointsRef.current[0];
            const distance = google.maps.geometry.spherical.computeDistanceBetween(
              firstPoint,
              e.latLng
            );
            if (distance < 5) {
              if (!firstPointMarkerRef.current) {
                // Import marker library components
                const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary("marker") as google.maps.MarkerLibrary;

                const closeMarkerView = new PinElement({
                  scale: 1.2,
                  background: '#FF4444',
                  borderColor: '#FF4444',
                  glyphColor: '#FFFFFF'
                });

                firstPointMarkerRef.current = new AdvancedMarkerElement({
                  position: firstPoint,
                  map: map,
                  title: 'Close polygon',
                  content: closeMarkerView.element
                });
              }
              return;
            } else if (firstPointMarkerRef.current) {
              setMarkerMap(firstPointMarkerRef.current, null);
              firstPointMarkerRef.current = null;
            }
          }

          const lastPoint = drawnPointsRef.current[drawnPointsRef.current.length - 1];
          const currentPoint = e.latLng;

          // Clear previous temporary elements
          if (tempDrawingElements.current.line) {
            setPolylineMap(tempDrawingElements.current.line, null);
          }
          if (tempDrawingElements.current.measurementLabel) {
            setMarkerMap(tempDrawingElements.current.measurementLabel, null);
          }

          // Create temporary line
          tempDrawingElements.current.line = new google.maps.Polyline({
            path: [lastPoint, currentPoint],
            geodesic: true,
            strokeColor: '#4CAF50',
            strokeOpacity: 0.8,
            strokeWeight: 2,
            map: map
          });

          // Calculate and display distance
          const from = turf.point([lastPoint.lng(), lastPoint.lat()]);
          const to = turf.point([currentPoint.lng(), currentPoint.lat()]);
          const distance = turf.distance(from, to, { units: 'meters' });
          setCurrentDistance(distance);

          // Create measurement label
          const midPoint = new google.maps.LatLng(
            (lastPoint.lat() + currentPoint.lat()) / 2,
            (lastPoint.lng() + currentPoint.lng()) / 2
          );

          // Import marker library components
          const { AdvancedMarkerElement } = await google.maps.importLibrary("marker") as google.maps.MarkerLibrary;

          const measurementDiv = document.createElement('div');
          measurementDiv.className = 'measurement-label';
          measurementDiv.style.background = '#4CAF50';
          measurementDiv.style.color = 'white';
          measurementDiv.style.padding = '4px 8px';
          measurementDiv.style.borderRadius = '4px';
          measurementDiv.style.fontSize = '12px';
          measurementDiv.style.fontWeight = 'bold';
          measurementDiv.textContent = `${distance.toFixed(1)}m`;

          tempDrawingElements.current.measurementLabel = new AdvancedMarkerElement({
            position: midPoint,
            map: map,
            title: 'Distance measurement',
            content: measurementDiv
          });
        });
    });

    // Cleanup function
    return () => {
      mounted = false;
      // Clean up map markers
      setMarkerMap(firstPointMarkerRef.current, null);
      firstPointMarkerRef.current = null;

      vertexMarkersRef.current.forEach(marker => {
        setMarkerMap(marker, null);
      });
      vertexMarkersRef.current = [];

      setPolylineMap(polygonRef.current, null);
      polygonRef.current = null;

      // Clean up temporary drawing elements
      setPolylineMap(tempDrawingElements.current.line, null);
      if (tempDrawingElements.current.measurementLabel) {
            setMarkerMap(tempDrawingElements.current.measurementLabel, null);
      }
      tempDrawingElements.current = {};

      // Reset state
      drawnPointsRef.current = [];
      setCustomArea(null);
      setCurrentDistance(null);
      setTotalPerimeter(null);
      setIsDrawingMode(false);
      setMeasurementMode(false);

      // Clean up map
      if (googleMapRef.current) {
        googleMapRef.current = null;
      }
    };
  }, [coordinates, isDrawingMode, measurementMode, onCustomAreaUpdate]);

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
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => {
                  setActiveView('solar');
                  setIsDrawingMode(false);
                }}
                className={`px-4 py-2 rounded-lg flex-1 ${
                  activeView === 'solar' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                Potentiel Solaire
              </button>
              <button
                onClick={() => {
                  setActiveView('shading');
                  setIsDrawingMode(false);
                }}
                className={`px-4 py-2 rounded-lg flex-1 ${
                  activeView === 'shading' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                Zones Optimales
              </button>
              <button
                onClick={() => {
                  setActiveView('drawing');
                  setIsDrawingMode(true);
                }}
                className={`px-4 py-2 rounded-lg flex-1 ${
                  activeView === 'drawing' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                Zone Installation
              </button>
            </div>

            {activeView === 'drawing' ? (
              <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                  <div className="space-y-2 mb-4">
                    <p className="text-sm text-gray-600">
                      {isDrawingMode 
                        ? drawnPointsRef.current.length > 2
                          ? "Définissez la zone d'installation avec précision"
                          : "Tracez le périmètre de la zone d'installation des panneaux"
                        : "Commencez par définir la zone d'installation"}
                    </p>
                    {currentDistance !== null && (
                      <p className="text-sm font-medium text-blue-600">
                        Distance actuelle: {currentDistance.toFixed(1)}m
                      </p>
                    )}
                    {totalPerimeter !== null && (
                      <p className="text-sm font-medium text-green-600">
                        Périmètre total: {totalPerimeter.toFixed(1)}m
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setIsDrawingMode(!isDrawingMode);
                        if (!isDrawingMode) {
                          setMeasurementMode(true);
                        }
                      }}
                      className={`px-4 py-2 rounded-lg ${
                        isDrawingMode 
                          ? 'bg-red-500 text-white' 
                          : 'bg-green-500 text-white'
                      }`}
                    >
                      {isDrawingMode ? 'Terminer Configuration' : 'Configurer Zone'}
                    </button>
                    {drawnPointsRef.current.length > 0 && (
                      <button
                        onClick={() => {
                          drawnPointsRef.current = [];
                          if (polygonRef.current) {
                            setPolylineMap(polygonRef.current, null);
                          }
                          setCustomArea(null);
                          if (onCustomAreaUpdate) {
                            onCustomAreaUpdate(null);
                          }
                        }}
                        className="px-4 py-2 rounded-lg bg-gray-500 text-white"
                      >
                        Effacer
                      </button>
                    )}
                  </div>
                </div>
                {customArea !== null && (
                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <h4 className="text-sm font-medium text-blue-800 mb-2">Estimation Production</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-gray-600">Production Annuelle</p>
                        <p className="text-lg font-bold text-gray-900">
                          {(getYearlyEnergy() * (customArea / (buildingData?.buildingInsights?.solarPotential?.maxArrayAreaMeters2 || 1)))?.toFixed(0)} kWh
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Puissance Crête</p>
                        <p className="text-lg font-bold text-gray-900">
                          {((Math.floor(customArea / (1.7 * 1.0)) * 400) / 1000).toFixed(1)} kWc
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : activeView === 'solar' ? (
              <div className="space-y-6">
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <h3 className="text-lg font-bold text-blue-800 mb-4">Estimation Financière</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-600">Production Annuelle</p>
                      <p className="text-lg font-bold text-gray-900">{getYearlyEnergy()?.toFixed(0) || 'N/A'} kWh</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Revenu Annuel</p>
                      <p className="text-lg font-bold text-green-600">{(getYearlyEnergy() * 0.15)?.toFixed(0)}€</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <h3 className="text-lg font-bold text-blue-800 mb-4">Analyse des Ombrages</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-600">Surface Ombragée</p>
                      <p className="text-lg font-bold text-gray-900">
                        {((roofStats?.totalArea || 0) - (buildingData?.buildingInsights?.solarPotential?.maxArrayAreaMeters2 || 0)).toFixed(1)} m²
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Impact Production</p>
                      <p className="text-lg font-bold text-gray-900">
                        {(100 - ((buildingData?.buildingInsights?.solarPotential?.maxArrayAreaMeters2 || 0) / (roofStats?.totalArea || 1) * 100)).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white p-4 rounded-lg shadow-sm">
              <h3 className="text-lg font-bold text-blue-800 mb-4">Conditions d'Installation</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-600">Inclinaison</p>
                  <p className="text-lg font-bold text-gray-900">{roofStats?.avgPitch.toFixed(1) || 'N/A'}°</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Orientation</p>
                  <p className="text-lg font-bold text-gray-900">{roofStats?.avgAzimuth.toFixed(1) || 'N/A'}°</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Ensoleillement</p>
                  <p className="text-lg font-bold text-gray-900">{roofStats?.avgSunshine.toFixed(1) || 'N/A'} h/an</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Efficacité Moyenne</p>
                  <p className="text-lg font-bold text-gray-900">{(((roofStats?.avgSunshine || 0) / 1200) * 100).toFixed(1)}%</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg shadow-sm">
              <h3 className="text-lg font-bold text-blue-800 mb-4">Analyse des Zones</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-600">Ensoleillement Maximum</p>
                  <p className="text-lg font-bold text-gray-900">
                    {buildingData.buildingInsights.solarPotential.maxSunshineHoursPerYear?.toFixed(1) || 'N/A'} h/an
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Rendement Global</p>
                  <p className="text-lg font-bold text-gray-900">
                    {(((roofStats?.avgSunshine || 0) / 1200) * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
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
