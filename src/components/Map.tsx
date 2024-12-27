import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
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

interface MapInstanceProps extends MapProps {
  google: typeof google;
  onError: (error: Error) => void;
}

// Helper function to create polygon path from bounds with proper orientation
const createPolygonPath = (segment: BuildingInsights['solarPotential']['roofSegmentStats'][0]): google.maps.LatLngLiteral[] => {
  // Use the actual boundingBox coordinates for more accurate representation
  return [
    { lat: segment.boundingBox.sw.latitude, lng: segment.boundingBox.sw.longitude },
    { lat: segment.boundingBox.sw.latitude, lng: segment.boundingBox.ne.longitude },
    { lat: segment.boundingBox.ne.latitude, lng: segment.boundingBox.ne.longitude },
    { lat: segment.boundingBox.ne.latitude, lng: segment.boundingBox.sw.longitude }
  ];
};

const DEG_TO_RAD = Math.PI / 180;

// Calculate new point given distance and bearing
const calculateDestinationPoint = (
  startLat: number,
  startLng: number,
  distance: number,
  bearing: number
): { latitude: number; longitude: number } => {
  const R = 6371000; // Earth's radius in meters
  const δ = distance / R; // angular distance
  const θ = bearing * Math.PI/180; // bearing in radians
  const φ1 = startLat * Math.PI/180;
  const λ1 = startLng * Math.PI/180;

  const φ2 = Math.asin(
    Math.sin(φ1) * Math.cos(δ) +
    Math.cos(φ1) * Math.sin(δ) * Math.cos(θ)
  );

  const λ2 = λ1 + Math.atan2(
    Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
    Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2)
  );

  return {
    latitude: φ2 * 180/Math.PI,
    longitude: λ2 * 180/Math.PI
  };
};

// Calculate panel corners with precise dimensions
const calculatePanelCorners = (
  center: { latitude: number; longitude: number },
  panelHeightMeters: number,
  panelWidthMeters: number,
  azimuthDegrees: number,
  pitchDegrees: number
): google.maps.LatLngLiteral[] => {
  // Adjust dimensions based on roof pitch
  const adjustedHeight = panelHeightMeters * Math.cos(pitchDegrees * DEG_TO_RAD);
  const halfWidth = panelWidthMeters / 2;
  const halfHeight = adjustedHeight / 2;

  // Calculate the four corners relative to center
  const corners = [
    { distance: halfHeight, bearing: (azimuthDegrees + 0) % 360 },   // Top
    { distance: halfWidth, bearing: (azimuthDegrees + 90) % 360 },   // Right
    { distance: halfHeight, bearing: (azimuthDegrees + 180) % 360 }, // Bottom
    { distance: halfWidth, bearing: (azimuthDegrees + 270) % 360 }   // Left
  ];

  // Convert to coordinates
  return corners.map(({ distance, bearing }) => {
    const point = calculateDestinationPoint(
      center.latitude,
      center.longitude,
      distance,
      bearing
    );
    return { lat: point.latitude, lng: point.longitude };
  });
};

// Add helper function for consistent panel sizing
const calculatePanelSize = (latitude: number): { widthDegrees: number, heightDegrees: number } => {
  // Standard solar panel dimensions (in meters)
  const PANEL_WIDTH_METERS = 1.0;  // Standard panel width
  const PANEL_HEIGHT_METERS = 1.7; // Standard panel height
  
  // Convert meters to degrees at the given latitude
  const metersPerDegreeAtEquator = 111319.9;
  const metersPerDegreeLongitude = metersPerDegreeAtEquator * Math.cos(latitude * Math.PI / 180);
  const metersPerDegreeLatitude = 111132.92 - 559.82 * Math.cos(2 * latitude * Math.PI / 180);
  
  return {
    widthDegrees: PANEL_WIDTH_METERS / metersPerDegreeLongitude,
    heightDegrees: PANEL_HEIGHT_METERS / metersPerDegreeLatitude
  };
};

// Update the panel creation function
function createSolarPanelPolygon(
  center: { latitude: number; longitude: number },
  azimuthDegrees: number,
  pitchDegrees: number,
  map: google.maps.Map
): google.maps.Polygon | null {
  const { widthDegrees, heightDegrees } = calculatePanelSize(center.latitude);
  const FRAME_WIDTH = 0.00005; // 5cm frame width in degrees
  
  // Create the main panel polygon
  const mainCorners = calculatePanelCorners(
    center,
    heightDegrees,
    widthDegrees,
    azimuthDegrees,
    pitchDegrees
  );

  // Create inner panel (glass surface)
  const innerCorners = calculatePanelCorners(
    center,
    heightDegrees - 2 * FRAME_WIDTH,
    widthDegrees - 2 * FRAME_WIDTH,
    azimuthDegrees,
    pitchDegrees
  );

  // Create frame polygon (outer frame)
  const framePolygon = new google.maps.Polygon({
    paths: mainCorners.map(corner => ({ lat: corner.lat, lng: corner.lng })),
    strokeColor: "#2C3E50", // Dark gray for frame
    strokeOpacity: 1,
    strokeWeight: 1,
    fillColor: "#34495E", // Slightly lighter gray for frame fill
    fillOpacity: 0.9,
    map: map,
    zIndex: 1
  });

  // Calculate reflection effect based on sun position and panel orientation
  // Calculate sun position and reflection
  const timeOfDay = new Date().getHours() + (new Date().getMinutes() / 60);
  const sunAngle = (timeOfDay - 12) * 15; // 15 degrees per hour
  const sunAltitude = Math.cos((timeOfDay - 12) * Math.PI / 12) * 90; // Sun height in degrees
  const sunlightIntensity = Math.cos((sunAngle - azimuthDegrees) * Math.PI / 180) * 
                           Math.cos((90 - sunAltitude - pitchDegrees) * Math.PI / 180);
  const reflectionIntensity = Math.max(0.4, Math.min(0.9, Math.abs(sunlightIntensity)));
  
  // Create glass surface with reflection effect
  const glassPolygon = new google.maps.Polygon({
    paths: innerCorners.map(corner => ({ lat: corner.lat, lng: corner.lng })),
    strokeColor: "#3498DB", // Blue tint for glass edge
    strokeOpacity: 0.5,
    strokeWeight: 1,
    fillColor: `rgb(41, 128, 185, ${reflectionIntensity})`, // Dynamic blue based on sunlight
    fillOpacity: 0.8 + (0.2 * sunlightIntensity), // Increased opacity for reflection
    map: map,
    zIndex: 2
  });

  // Add reflection highlight
  const reflectionPolygon = new google.maps.Polygon({
    paths: innerCorners.map(corner => ({ lat: corner.lat, lng: corner.lng })),
    strokeColor: "#FFFFFF",
    strokeOpacity: 0,
    strokeWeight: 0,
    fillColor: "#FFFFFF",
    fillOpacity: 0.1 + (0.2 * sunlightIntensity), // Dynamic reflection intensity
    map: map,
    zIndex: 3
  });

  // Add shadow effect based on pitch
  const shadowOpacity = Math.min(pitchDegrees / 45, 0.5); // Max 50% opacity at 45° pitch
  const shadowOffset = 0.1 * (pitchDegrees / 45); // Shadow offset increases with pitch
  
  const shadowCorners = mainCorners.map(corner => ({
    lat: corner.lat - shadowOffset/1000,
    lng: corner.lng - shadowOffset/1000
  }));

  const shadowPolygon = new google.maps.Polygon({
    paths: shadowCorners,
    strokeColor: "#000000",
    strokeOpacity: 0,
    strokeWeight: 0,
    fillColor: "#000000",
    fillOpacity: shadowOpacity,
    map: map,
    zIndex: 0
  });

  // Add enhanced hover effects
  const addHoverEffects = () => {
    framePolygon.addListener('mouseover', () => {
      framePolygon.setOptions({
        fillOpacity: 1,
        strokeWeight: 2
      });
      glassPolygon.setOptions({
        fillOpacity: 0.9,
        strokeOpacity: 0.8,
        fillColor: `rgb(41, 128, 185, ${reflectionIntensity + 0.1})` // Brighter on hover
      });
      reflectionPolygon.setOptions({
        fillOpacity: 0.2 + (0.3 * sunlightIntensity) // Enhanced reflection on hover
      });
      shadowPolygon.setOptions({
        fillOpacity: shadowOpacity * 1.2
      });
      
      // Change cursor to pointer
      map.getDiv().style.cursor = 'pointer';
    });

    framePolygon.addListener('mouseout', () => {
      framePolygon.setOptions({
        fillOpacity: 0.9,
        strokeWeight: 1
      });
      glassPolygon.setOptions({
        fillOpacity: 0.8,
        strokeOpacity: 0.5,
        fillColor: `rgb(41, 128, 185, ${reflectionIntensity})` // Reset to original
      });
      reflectionPolygon.setOptions({
        fillOpacity: 0.1 + (0.2 * sunlightIntensity) // Reset reflection
      });
      shadowPolygon.setOptions({
        fillOpacity: shadowOpacity
      });
      
      // Reset cursor
      map.getDiv().style.cursor = '';
    });
  };

  addHoverEffects();

  // Return composite panel (frame + glass + shadow)
  return framePolygon;
}

// Define view modes with proper typing
interface ViewMode {
  id: 'solar' | 'panels' | 'data' | 'layers';
  text: string;
  icon: string;
  description: string;
}

const VIEW_MODES: ViewMode[] = [
  {
    id: 'solar',
    text: 'Analyse Solaire',
    icon: 'sun',
    description: 'Potentiel et statistiques'
  },
  {
    id: 'layers',
    text: 'Ombrage',
    icon: 'layers',
    description: 'Analyse des ombres'
  }
];

// Update MapInstance component
function MapInstance({ coordinates, buildingData, google, onError }: MapInstanceProps) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const polygonsRef = useRef<Array<google.maps.Polygon>>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const [activeView, setActiveView] = useState<ViewMode['id']>('solar');

  // Function to update the building overlay based on active view
  const updateBuildingOverlay = useCallback(() => {
    if (!mapRef.current || !buildingData?.buildingInsights) return;

    // Clear existing overlays
    polygonsRef.current.forEach(polygon => polygon.setMap(null));
    polygonsRef.current = [];

    const { buildingInsights } = buildingData;

    switch (activeView) {
      case 'solar':
        {
          // Get the best configuration from the API
          const bestConfig = buildingInsights.solarPotential?.solarPanelConfigs?.[0];
          if (!bestConfig) return;

          console.log('Building Insights:', buildingInsights);
          console.log('Best Config:', bestConfig);

          // Use the API's panel configuration data
          buildingInsights.solarPotential?.roofSegmentStats.forEach((segment) => {
            const segmentArea = segment.stats.areaMeters2;
            const usableArea = segmentArea * 0.9; // 90% of area is usable
            const { widthDegrees, heightDegrees } = calculatePanelSize(segment.center.latitude);

            // Start from the segment's center
            const startLat = segment.center.latitude;
            const startLng = segment.center.longitude;

            // Calculate panel center coordinates
            const adjustedCenter = {
              latitude: startLat,
              longitude: startLng
            };

            // Calculate the number of panels that can fit in the segment
            const panelArea = widthDegrees * heightDegrees;
            const maxPanels = Math.floor(usableArea / panelArea);

            // Create panels with proper spacing and alignment
            for (let i = 0; i < maxPanels; i++) {
              // Calculate panel position with proper spacing and centering
              const panelCenter = calculateDestinationPoint(
                adjustedCenter.latitude,
                adjustedCenter.longitude,
                0,
                segment.azimuthDegrees
              );

              const panelPolygon = createSolarPanelPolygon(
                panelCenter,
                segment.azimuthDegrees,
                segment.pitchDegrees,
                mapRef.current!
              );

              if (panelPolygon) {
                // Calculate sun position and lighting effect
                const timeOfDay = new Date().getHours() + (new Date().getMinutes() / 60);
                const sunAngle = (timeOfDay - 12) * 15; // 15 degrees per hour
                const sunAltitude = Math.cos((timeOfDay - 12) * Math.PI / 12) * 90; // Sun height in degrees
                const sunlightIntensity = Math.cos((sunAngle - segment.azimuthDegrees) * Math.PI / 180) *
                  Math.cos((90 - sunAltitude - segment.pitchDegrees) * Math.PI / 180);
                const currentTime = new Date().toLocaleTimeString('fr-FR', {
                  hour: '2-digit',
                  minute: '2-digit'
                });

                // Add click listener for panel info
                panelPolygon.addListener('click', (e: google.maps.PolyMouseEvent) => {
                  if (e.latLng && infoWindowRef.current) {
                    const content = `
                      <div class="p-4 bg-white rounded-lg shadow-lg">
                        <h3 class="text-lg font-bold mb-2">Panneau Solaire</h3>
                        <div class="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p class="text-gray-600">Inclinaison</p>
                            <p class="font-bold">${segment.pitchDegrees.toFixed(1)}°</p>
                          </div>
                          <div>
                            <p class="text-gray-600">Orientation</p>
                            <p class="font-bold">${segment.azimuthDegrees.toFixed(1)}°</p>
                          </div>
                          <div>
                            <p class="text-gray-600">Surface</p>
                            <p class="font-bold">${(widthDegrees * heightDegrees).toFixed(1)} m²</p>
                          </div>
                          <div>
                            <p class="text-gray-600">Ensoleillement</p>
                            <p class="font-bold">${Math.max(0, (sunlightIntensity * 100)).toFixed(1)}%</p>
                          </div>
                          <div>
                            <p class="text-gray-600">Heure</p>
                            <p class="font-bold">${currentTime}</p>
                          </div>
                          <div>
                            <p class="text-gray-600">Altitude Solaire</p>
                            <p class="font-bold">${sunAltitude.toFixed(1)}°</p>
                          </div>
                        </div>
                      </div>
                    `;

                    if (infoWindowRef.current) {
                      infoWindowRef.current.close();
                    }
                    infoWindowRef.current = new google.maps.InfoWindow({
                      content,
                      position: e.latLng
                    });
                    infoWindowRef.current.open(mapRef.current);
                  }
                });

                polygonsRef.current.push(panelPolygon);
              }
            }
          });
        }
        break;

      case 'layers':
        {
          // Create shading visualization
          buildingInsights.solarPotential?.roofSegmentStats.forEach(segment => {
            const sunshineHours = segment.stats.sunshineQuantiles;
            const segmentMax = Math.max(...sunshineHours);
            const segmentMin = Math.min(...sunshineHours);
            const avgSunshine = sunshineHours[5];
            const intensity = avgSunshine / segmentMax;

            const polygon = new google.maps.Polygon({
              paths: createPolygonPath(segment),
              strokeColor: '#FFFFFF',
              strokeOpacity: 1,
              strokeWeight: 2,
              fillColor: `hsl(${intensity * 60}, 100%, ${50 + intensity * 20}%)`,
              fillOpacity: 0.8,
              map: mapRef.current!,
              zIndex: Math.floor(intensity * 10)
            });

            // Add click listener for segment info
            polygon.addListener('click', (e: google.maps.PolyMouseEvent) => {
              if (e.latLng && infoWindowRef.current) {
                const content = `
                  <div class="p-4 bg-white rounded-lg shadow-lg">
                    <h3 class="text-lg font-bold mb-3 border-b pb-2">Détails d'Ombrage</h3>
                    <div class="space-y-3">
                      <div class="grid grid-cols-2 gap-4">
                        <div>
                          <p class="text-sm text-gray-600">Surface</p>
                          <p class="font-bold">${segment.stats.areaMeters2.toFixed(1)} m²</p>
                        </div>
                        <div>
                          <p class="text-sm text-gray-600">Ensoleillement</p>
                          <p class="font-bold">${avgSunshine.toFixed(0)} h/an</p>
                        </div>
                        <div>
                          <p class="text-sm text-gray-600">Minimum</p>
                          <p class="font-bold">${segmentMin.toFixed(0)} h/an</p>
                        </div>
                        <div>
                          <p class="text-sm text-gray-600">Maximum</p>
                          <p class="font-bold">${segmentMax.toFixed(0)} h/an</p>
                        </div>
                      </div>
                      <div>
                        <p class="text-sm text-gray-600 mb-1">Distribution</p>
                        <div class="w-full bg-gray-200 rounded-full h-2">
                          <div class="bg-yellow-500 h-2 rounded-full" 
                            style="width: ${((avgSunshine - segmentMin) / (segmentMax - segmentMin) * 100).toFixed(1)}%">
                          </div>
                        </div>
                        <div class="flex justify-between text-xs text-gray-500 mt-1">
                          <span>${segmentMin.toFixed(0)}h</span>
                          <span class="font-medium">${avgSunshine.toFixed(0)}h</span>
                          <span>${segmentMax.toFixed(0)}h</span>
                        </div>
                      </div>
                    </div>
                  </div>
                `;

                if (infoWindowRef.current) {
                  infoWindowRef.current.close();
                }
                infoWindowRef.current = new google.maps.InfoWindow({
                  content,
                  position: e.latLng
                });
                infoWindowRef.current.open(mapRef.current);
              }
            });

            polygonsRef.current.push(polygon);
          });
        }
        break;
    }

    // Update map bounds
    if (buildingInsights.boundingBox) {
      const bounds = new google.maps.LatLngBounds(
        { lat: buildingInsights.boundingBox.sw.latitude, lng: buildingInsights.boundingBox.sw.longitude },
        { lat: buildingInsights.boundingBox.ne.latitude, lng: buildingInsights.boundingBox.ne.longitude }
      );
      mapRef.current.fitBounds(bounds);
    }
  }, [buildingData, activeView]);

  // Initialize map
  useEffect(() => {
    try {
      const mapElement = document.getElementById('map');
      if (!mapElement) throw new Error('Map container not found');
      
      const map = new google.maps.Map(mapElement, {
        zoom: 20,
        center: coordinates,
        mapTypeId: 'satellite',
        tilt: 45,
        mapTypeControl: true,
        mapTypeControlOptions: {
          style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
          position: google.maps.ControlPosition.TOP_RIGHT
        },
        zoomControl: true,
        zoomControlOptions: {
          position: google.maps.ControlPosition.RIGHT_CENTER
        },
        fullscreenControl: true
      });

      mapRef.current = map;

      // Add view controls with improved UI
      const viewControls = document.createElement('div');
      viewControls.className = 'view-controls fixed top-4 left-4 bg-white rounded-lg shadow-lg p-2 z-10';
      viewControls.innerHTML = `
        <div class="flex flex-col space-y-2">
          ${VIEW_MODES.map(mode => `
            <button id="${mode.id}-view" class="view-btn ${activeView === mode.id ? 'active' : ''} 
              px-4 py-2 rounded-md flex items-center space-x-2 transition-all duration-200">
              <span>${mode.text}</span>
              <span class="text-xs text-gray-500">${mode.description}</span>
          </button>
          `).join('')}
        </div>
      `;

      // Add styles
      const style = document.createElement('style');
      style.textContent = `
        .view-btn {
          background-color: #f3f4f6;
          color: #374151;
          transition: all 0.2s;
          width: 100%;
          text-align: left;
        }
        .view-btn:hover {
          background-color: #e5e7eb;
        }
        .view-btn.active {
          background-color: #1a73e8;
          color: white;
        }
        .view-btn.active .text-gray-500 {
          color: #e5e7eb;
        }
      `;
      document.head.appendChild(style);

      // Add event listeners
      VIEW_MODES.forEach(mode => {
        const button = viewControls.querySelector(`#${mode.id}-view`);
        button?.addEventListener('click', () => {
          setActiveView(mode.id);
        });
      });

      // Add controls to map
      map.controls[google.maps.ControlPosition.TOP_LEFT].push(viewControls);

      // Initial update
      updateBuildingOverlay();

      return () => {
        document.head.removeChild(style);
      };
    } catch (error) {
      onError(error instanceof Error ? error : new Error('Failed to initialize map'));
    }
  }, [coordinates, updateBuildingOverlay]);

  // Update overlay when view changes
  useEffect(() => {
    if (mapRef.current) {
      updateBuildingOverlay();
    }
  }, [activeView, updateBuildingOverlay]);

  // Update reflections every minute
  useEffect(() => {
    if (activeView === 'solar') {
      const interval = setInterval(() => {
        updateBuildingOverlay();
      }, 60000); // Update every minute
      
      return () => clearInterval(interval);
    }
  }, [activeView, updateBuildingOverlay]);

  return null;
}

export default function Map({ coordinates, buildingData }: MapProps) {
  const [error, setError] = useState<string | null>(null);
  const [googleMapsLoaded, setGoogleMapsLoaded] = useState(false);
  const [googleInstance, setGoogleInstance] = useState<typeof google | null>(null);

  useEffect(() => {
    const loader = new Loader({
      apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
      version: 'weekly',
      libraries: ['places', 'marker'],
    });

    loader.load()
      .then((google) => {
        setGoogleMapsLoaded(true);
        setGoogleInstance(google);
      })
      .catch((error) => {
        console.error('Error loading Google Maps:', error);
        setError('Failed to load Google Maps');
      });
  }, []);

  const handleError = (error: Error) => {
    console.error('Map error:', error);
    setError(error.message);
  };

  return (
    <div className="w-full relative flex gap-4">
      <div id="map" className="w-2/3 h-[600px] rounded-lg shadow-lg" />
      <div id="stats" className="w-1/3 p-4 bg-white rounded-lg shadow-lg h-fit">
        {buildingData && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold border-b pb-2">Statistiques Globales</h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <p className="text-sm text-gray-600">Surface Totale</p>
                <p className="font-bold">{buildingData.buildingInsights.solarPotential?.wholeRoofStats.areaMeters2.toFixed(1)} m²</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Surface Utilisable</p>
                <p className="font-bold">{buildingData.buildingInsights.solarPotential?.maxArrayAreaMeters2.toFixed(1)} m²</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Inclinaison Moyenne</p>
                <p className="font-bold">{(buildingData.buildingInsights.solarPotential?.roofSegmentStats.reduce((sum, segment) => {
                  const totalArea = buildingData.buildingInsights.solarPotential?.wholeRoofStats.areaMeters2 || 1;
                  return sum + (segment.pitchDegrees * segment.stats.areaMeters2 / totalArea);
                }, 0) || 0).toFixed(1)}°</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Ensoleillement Moyen</p>
                <p className="font-bold">{buildingData.buildingInsights.solarPotential?.maxSunshineHoursPerYear.toFixed(0)} h/an</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Panneaux Recommandés</p>
                <p className="font-bold">{buildingData.buildingInsights.solarPotential?.maxArrayPanelsCount || 0} panneaux</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Production Estimée</p>
                <p className="font-bold">{buildingData.buildingInsights.solarPotential?.solarPanelConfigs?.[0]?.yearlyEnergyDcKwh.toFixed(0) || 0} kWh/an</p>
              </div>
              <div className="mt-2">
                <p className="text-sm text-gray-600 mb-1">Efficacité Solaire</p>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full" style={{ 
                    width: `${((buildingData.buildingInsights.solarPotential?.maxArrayAreaMeters2 || 0) / 
                    (buildingData.buildingInsights.solarPotential?.wholeRoofStats.areaMeters2 || 1) * 100).toFixed(1)}%` 
                  }} />
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>0%</span>
                  <span className="font-medium">{((buildingData.buildingInsights.solarPotential?.maxArrayAreaMeters2 || 0) / 
                    (buildingData.buildingInsights.solarPotential?.wholeRoofStats.areaMeters2 || 1) * 100).toFixed(1)}%</span>
                  <span>100%</span>
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
      {googleMapsLoaded && googleInstance && (
        <MapInstance
          coordinates={coordinates}
          buildingData={buildingData}
          google={googleInstance}
          onError={handleError}
        />
      )}
    </div>
  );
}
