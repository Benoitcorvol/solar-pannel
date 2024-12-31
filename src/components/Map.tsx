import React, { useEffect, useRef, useState } from 'react';
import { Coordinates, BuildingInsights } from '../types/solar';
import * as turf from '@turf/turf';
import mapboxgl, { MapMouseEvent } from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// Mapbox token (using public token)
mapboxgl.accessToken = 'pk.eyJ1IjoiYmVub2l0Y29ydm9sIiwiYSI6ImNtNWMwNGxuZjA0MHoya3F5OGN2NnFlcG8ifQ.LTxme4ZLHUo-HBhZVMuyVg';

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
  const mapbox3DRef = useRef<HTMLDivElement>(null);
  const mapboxMapRef = useRef<mapboxgl.Map | null>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeView, setActiveView] = useState<'solar' | 'shading' | 'drawing' | '3d'>('solar');
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [measurementMode, setMeasurementMode] = useState(false);
  
  // Drawing state
  const drawnPointsRef = useRef<google.maps.LatLng[]>([]);
  const drawingHistoryRef = useRef<google.maps.LatLng[][]>([]);
  const currentHistoryIndexRef = useRef<number>(-1);
  const polygonRef = useRef<google.maps.Polygon | null>(null);
  const firstPointMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const vertexMarkersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const tempDrawingElements = useRef<TempDrawingElements>({});
  
  // UI state
  const [customArea, setCustomArea] = useState<number | null>(null);
  const [currentDistance, setCurrentDistance] = useState<number | null>(null);
  const [totalPerimeter, setTotalPerimeter] = useState<number | null>(null);
  const [roofPitch, setRoofPitch] = useState<number | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Add new state for hole drawing
  const [isDrawingHole, setIsDrawingHole] = useState(false);
  const holesRef = useRef<google.maps.LatLng[][]>([]);
  const currentHoleRef = useRef<google.maps.LatLng[]>([]);
  
  // Add new state for hole markers
  const holeMarkersRef = useRef<google.maps.marker.AdvancedMarkerElement[][]>([]);
  const currentHoleMarkersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);

  // Add new refs for hole polygons
  const holePolygonsRef = useRef<google.maps.Polygon[]>([]);
  const currentHolePolygonRef = useRef<google.maps.Polygon | null>(null);

  const startDrawingHole = () => {
    if (drawnPointsRef.current.length < 3) return;
    
    console.log('=== Début du dessin de zone d\'exclusion ===');
    console.log('Points du polygone principal:', drawnPointsRef.current.length);
    
    // Sauvegarder les points actuels
    const mainPoints = [...drawnPointsRef.current];
    
    // Réinitialiser uniquement les références du trou
    currentHoleRef.current = [];
    currentHoleMarkersRef.current = [];
    
    // Activer le mode dessin de trou
    setIsDrawingHole(true);
    drawnPointsRef.current = mainPoints;
  };

  const completeHole = () => {
    if (currentHoleRef.current.length < 3) return;
    
    // Ensure the hole is properly closed
    if (!isLatLngEqual(currentHoleRef.current[0], currentHoleRef.current[currentHoleRef.current.length - 1])) {
      currentHoleRef.current.push(currentHoleRef.current[0]);
    }
    
    // Add the hole and its markers to their respective collections
    holesRef.current.push([...currentHoleRef.current]);
    holeMarkersRef.current.push([...currentHoleMarkersRef.current]);
    
    // Reset current hole state
    currentHoleRef.current = [];
    currentHoleMarkersRef.current = [];
    setIsDrawingHole(false);
    updatePolygon();
  };

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

  // Initialize Mapbox
  useEffect(() => {
    if (activeView === '3d' && mapbox3DRef.current && !mapboxMapRef.current) {
      try {
        const map = new mapboxgl.Map({
          container: mapbox3DRef.current,
          style: 'mapbox://styles/mapbox/satellite-streets-v12',
          center: [coordinates.lng, coordinates.lat],
          zoom: 19,
          pitch: 60,
          bearing: 0,
          antialias: true
        });

        map.on('load', () => {
          // Add 3D buildings layer
          map.addSource('mapbox-dem', {
            'type': 'raster-dem',
            'url': 'mapbox://mapbox.mapbox-terrain-dem-v1',
            'tileSize': 512,
            'maxzoom': 14
          });
          
          // Add terrain and sky
          map.setTerrain({ 'source': 'mapbox-dem', 'exaggeration': 1.5 });
          map.addLayer({
            'id': 'sky',
            'type': 'sky',
            'paint': {
              'sky-type': 'atmosphere',
              'sky-atmosphere-sun': [0.0, 0.0],
              'sky-atmosphere-sun-intensity': 15
            }
          });

          // Add 3D buildings layer
          map.addLayer({
            'id': '3d-buildings',
            'source': 'mapbox',
            'source-layer': 'building',
            'type': 'fill-extrusion',
            'minzoom': 15,
            'paint': {
              'fill-extrusion-color': '#aaa',
              'fill-extrusion-height': ['get', 'height'],
              'fill-extrusion-base': ['get', 'min_height'],
              'fill-extrusion-opacity': 0.6
            }
          });

          // Add click handler for building selection
          map.on('click', '3d-buildings', (e: MapMouseEvent) => {
            if (e.features && e.features[0]) {
              const feature = e.features[0];
              const area = turf.area(feature.geometry);
              setCustomArea(area);
              if (onCustomAreaUpdate) {
                onCustomAreaUpdate(area);
              }

              // Calculate roof pitch from building height
              const height = feature.properties?.height || 0;
              const footprint = turf.area(feature.geometry);
              const pitch = Math.atan(height / Math.sqrt(footprint)) * (180 / Math.PI);
              setRoofPitch(pitch);

              // Highlight selected building
              map.setPaintProperty('3d-buildings', 'fill-extrusion-color', [
                'case',
                ['==', ['id'], feature.id],
                '#4CAF50',
                '#aaa'
              ]);
            }
          });

          // Add navigation controls
          map.addControl(new mapboxgl.NavigationControl());
          map.addControl(new mapboxgl.ScaleControl({
            maxWidth: 100,
            unit: 'metric'
          }));

          setIsLoading(false);
        });

        mapboxMapRef.current = map;
      } catch (err) {
        console.error('Error initializing Mapbox:', err);
        setError('Erreur lors du chargement de la vue 3D');
      }
    }

    return () => {
      if (mapboxMapRef.current && activeView !== '3d') {
        mapboxMapRef.current.remove();
        mapboxMapRef.current = null;
      }
    };
  }, [coordinates, activeView]);

  // Initialize Google Maps only when not in 3D mode
  useEffect(() => {
    if (activeView !== '3d' && !googleMapRef.current) {
      initGoogleMap();
    }
  }, [activeView]);

  const initGoogleMap = async () => {
    if (!mapRef.current || googleMapRef.current) return;

    try {
      const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary("marker") as google.maps.MarkerLibrary;

      const mapInstance = new google.maps.Map(mapRef.current, {
        center: { lat: coordinates.lat, lng: coordinates.lng },
        zoom: 20,
        mapTypeId: google.maps.MapTypeId.SATELLITE,
        mapId: '2cbff3bb7f42c667',
        zoomControl: true,
        mapTypeControl: true,
        scaleControl: true,
        streetViewControl: false,
        rotateControl: true,
        fullscreenControl: true,
        tilt: 0,
        heading: 0
      });

      googleMapRef.current = mapInstance;

      // Add marker for location
      const markerView = new PinElement({
        scale: 1.2,
        background: '#4CAF50',
        borderColor: '#4CAF50',
        glyphColor: '#FFFFFF'
      });

      new AdvancedMarkerElement({
        position: { lat: coordinates.lat, lng: coordinates.lng },
        map: mapInstance,
        title: 'Selected Location',
        content: markerView.element
      });

      setIsLoading(false);
    } catch (error) {
      console.error('Error initializing Google Maps:', error);
      setError(error instanceof Error ? error.message : 'Failed to initialize map');
    }
  };

  // Add new function for handling history
  const addToHistory = (points: google.maps.LatLng[]) => {
    const nextIndex = currentHistoryIndexRef.current + 1;
    drawingHistoryRef.current = drawingHistoryRef.current.slice(0, nextIndex);
    drawingHistoryRef.current.push([...points]);
    currentHistoryIndexRef.current = nextIndex;
    setCanUndo(currentHistoryIndexRef.current > 0);
    setCanRedo(false);
  };

  const handleUndo = () => {
    if (currentHistoryIndexRef.current > 0) {
      currentHistoryIndexRef.current--;
      drawnPointsRef.current = [...drawingHistoryRef.current[currentHistoryIndexRef.current]];
      updateMarkersAndPolygon();
      setCanUndo(currentHistoryIndexRef.current > 0);
      setCanRedo(currentHistoryIndexRef.current < drawingHistoryRef.current.length - 1);
    }
  };

  const handleRedo = () => {
    if (currentHistoryIndexRef.current < drawingHistoryRef.current.length - 1) {
      currentHistoryIndexRef.current++;
      drawnPointsRef.current = [...drawingHistoryRef.current[currentHistoryIndexRef.current]];
      updateMarkersAndPolygon();
      setCanUndo(currentHistoryIndexRef.current > 0);
      setCanRedo(currentHistoryIndexRef.current < drawingHistoryRef.current.length - 1);
    }
  };

  const updateMarkersAndPolygon = async () => {
    // Clear existing markers
    vertexMarkersRef.current.forEach(marker => {
      setMarkerMap(marker, null);
    });
    vertexMarkersRef.current = [];

    // Add new markers
    if (googleMapRef.current) {
      const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary("marker") as google.maps.MarkerLibrary;
      
      for (const point of drawnPointsRef.current) {
        const vertexMarkerView = new PinElement({
          scale: 0.8,
          background: '#4CAF50',
          borderColor: '#4CAF50',
          glyphColor: '#FFFFFF'
        });

        const marker = new AdvancedMarkerElement({
          position: point,
          map: googleMapRef.current,
          title: 'Point du polygone',
          content: vertexMarkerView.element
        });

        vertexMarkersRef.current.push(marker);
      }
    }

    updatePolygon();
  };

  // Add new effect to handle drawing mode initialization
  useEffect(() => {
    if (activeView === 'drawing') {
      setIsDrawingMode(true);
      setMeasurementMode(true);
    } else {
      setIsDrawingMode(false);
      setMeasurementMode(false);
    }
  }, [activeView]);

  // Modify the hole marker style
  const createHoleMarker = async (position: google.maps.LatLng, map: google.maps.Map) => {
    const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary("marker") as google.maps.MarkerLibrary;
    const holeMarkerView = new PinElement({
      scale: 0.8,
      background: '#EAB308', // Yellow color matching the button
      borderColor: '#EAB308',
      glyphColor: '#FFFFFF'
    });

    return new AdvancedMarkerElement({
      position: position,
      map: map,
      title: 'Point d\'exclusion',
      content: holeMarkerView.element
    });
  };

  // Update the click handler to use the new marker style
  useEffect(() => {
    if (!googleMapRef.current || activeView === '3d') return;

    const map = googleMapRef.current;

    const clickListener = map.addListener('click', async (e: google.maps.MapMouseEvent) => {
      if (!isDrawingMode || !e.latLng) return;

      const newPoint = e.latLng;
      
      if (isDrawingHole) {
        console.log('Ajout d\'un point au trou:', currentHoleRef.current.length);
        if (currentHoleRef.current.length > 2) {
          const firstPoint = currentHoleRef.current[0];
          const distance = google.maps.geometry.spherical.computeDistanceBetween(
            firstPoint,
            newPoint
          );
          
          if (distance < 2) {
            completeHole();
            return;
          }
        }

        currentHoleRef.current.push(newPoint);
        const marker = await createHoleMarker(newPoint, map);
        currentHoleMarkersRef.current.push(marker);
        
        // Create or update the current hole polygon
        if (currentHoleRef.current.length >= 3) {
          if (currentHolePolygonRef.current) {
            setPolylineMap(currentHolePolygonRef.current, null);
          }
          currentHolePolygonRef.current = new google.maps.Polygon({
            paths: [currentHoleRef.current],
            strokeColor: '#EAB308',
            strokeOpacity: 1,
            strokeWeight: 2,
            fillColor: '#EAB308',
            fillOpacity: 0.5,
            map: googleMapRef.current,
          });
        }
        return;
      }

      // Regular polygon drawing logic
      if (drawnPointsRef.current.length > 2) {
        const firstPoint = drawnPointsRef.current[0];
        const distance = google.maps.geometry.spherical.computeDistanceBetween(
          firstPoint,
          newPoint
        );
        
        if (distance < 2) {
          completePolygon();
          return;
        }
      }

      drawnPointsRef.current = [...drawnPointsRef.current, newPoint];
      addToHistory(drawnPointsRef.current);

      const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary("marker") as google.maps.MarkerLibrary;
      const vertexMarkerView = new PinElement({
        scale: 0.8,
        background: '#4CAF50',
        borderColor: '#4CAF50',
        glyphColor: '#FFFFFF'
      });

      const marker = new AdvancedMarkerElement({
        position: newPoint,
        map: map,
        title: 'Point du polygone',
        content: vertexMarkerView.element
      });

      vertexMarkersRef.current.push(marker);
      updatePolygon();
    });

    const mouseMoveListener = map.addListener('mousemove', async (e: google.maps.MapMouseEvent) => {
      if (!isDrawingMode || !e.latLng || drawnPointsRef.current.length === 0) return;

      // Check if we're near the first point
      if (drawnPointsRef.current.length > 2) {
        const firstPoint = drawnPointsRef.current[0];
        const distance = google.maps.geometry.spherical.computeDistanceBetween(
          firstPoint,
          e.latLng
        );
        
        if (distance < 2) {
          if (!firstPointMarkerRef.current) {
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
              title: 'Fermer le polygone',
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
      
      // Clear previous temporary elements
      if (tempDrawingElements.current.line) {
        setPolylineMap(tempDrawingElements.current.line, null);
      }
      if (tempDrawingElements.current.measurementLabel) {
        setMarkerMap(tempDrawingElements.current.measurementLabel, null);
      }

      // Create temporary line
      tempDrawingElements.current.line = new google.maps.Polyline({
        path: [lastPoint, e.latLng],
        geodesic: true,
        strokeColor: '#4CAF50',
        strokeOpacity: 0.8,
        strokeWeight: 2,
        map: map
      });

      if (measurementMode) {
        const from = turf.point([lastPoint.lng(), lastPoint.lat()]);
        const to = turf.point([e.latLng.lng(), e.latLng.lat()]);
        const distance = turf.distance(from, to, { units: 'meters' });
        setCurrentDistance(distance);

        const midPoint = new google.maps.LatLng(
          (lastPoint.lat() + e.latLng.lat()) / 2,
          (lastPoint.lng() + e.latLng.lng()) / 2
        );

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
          title: 'Distance',
          content: measurementDiv
        });
      }
    });

    return () => {
      google.maps.event.removeListener(clickListener);
      google.maps.event.removeListener(mouseMoveListener);
      cleanup();
    };
  }, [isDrawingMode, measurementMode, activeView, isDrawingHole]);

  const cleanup = () => {
    // Clean up main polygon
    setMarkerMap(firstPointMarkerRef.current, null);
    firstPointMarkerRef.current = null;

    vertexMarkersRef.current.forEach(marker => {
      setMarkerMap(marker, null);
    });
    vertexMarkersRef.current = [];

    // Clean up holes
    holeMarkersRef.current.forEach(holeMarkers => {
      holeMarkers.forEach(marker => {
        setMarkerMap(marker, null);
      });
    });
    currentHoleMarkersRef.current.forEach(marker => {
      setMarkerMap(marker, null);
    });
    holeMarkersRef.current = [];
    currentHoleMarkersRef.current = [];

    setPolylineMap(polygonRef.current, null);
    polygonRef.current = null;

    setPolylineMap(tempDrawingElements.current.line, null);
    if (tempDrawingElements.current.measurementLabel) {
      setMarkerMap(tempDrawingElements.current.measurementLabel, null);
    }
    tempDrawingElements.current = {};

    drawnPointsRef.current = [];
    drawingHistoryRef.current = [];
    currentHistoryIndexRef.current = -1;
    setCanUndo(false);
    setCanRedo(false);
    setCustomArea(null);
    setCurrentDistance(null);
    setTotalPerimeter(null);
    holesRef.current = [];
    currentHoleRef.current = [];
    setIsDrawingHole(false);

    // Clean up hole polygons
    holePolygonsRef.current.forEach(polygon => setPolylineMap(polygon, null));
    holePolygonsRef.current = [];
    if (currentHolePolygonRef.current) {
      setPolylineMap(currentHolePolygonRef.current, null);
      currentHolePolygonRef.current = null;
    }
  };

  const completePolygon = () => {
    if (drawnPointsRef.current.length < 3) return;
    
    // Ensure the polygon is properly closed
    if (!isLatLngEqual(drawnPointsRef.current[0], drawnPointsRef.current[drawnPointsRef.current.length - 1])) {
      drawnPointsRef.current.push(drawnPointsRef.current[0]);
    }
    
    if (firstPointMarkerRef.current) {
      setMarkerMap(firstPointMarkerRef.current, null);
      firstPointMarkerRef.current = null;
    }
    
    updatePolygon();
    setIsDrawingMode(false);
  };

  const updatePolygon = () => {
    if (!googleMapRef.current || drawnPointsRef.current.length < 2) return;

    try {
      console.log('=== Mise à jour des polygones ===');
      console.log('Mode dessin trou:', isDrawingHole);
      console.log('Nombre de trous existants:', holesRef.current.length);
      console.log('Points du polygone principal:', drawnPointsRef.current.length);
      console.log('Points du trou en cours:', currentHoleRef.current.length);

      // Créer ou mettre à jour le polygone principal
      if (polygonRef.current) {
        setPolylineMap(polygonRef.current, null);
      }

      const mainPath = [...drawnPointsRef.current];
      if (mainPath.length > 0 && !isLatLngEqual(mainPath[0], mainPath[mainPath.length - 1])) {
        mainPath.push(mainPath[0]);
      }

      polygonRef.current = new google.maps.Polygon({
        paths: [mainPath],
        strokeColor: '#4CAF50',
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: '#4CAF50',
        fillOpacity: 0.35,
        map: googleMapRef.current,
      });

      // Gérer les trous
      if (isDrawingHole && currentHoleRef.current.length >= 3) {
        if (currentHolePolygonRef.current) {
          setPolylineMap(currentHolePolygonRef.current, null);
        }
        currentHolePolygonRef.current = new google.maps.Polygon({
          paths: [currentHoleRef.current],
          strokeColor: '#EAB308',
          strokeOpacity: 1,
          strokeWeight: 2,
          fillColor: '#EAB308',
          fillOpacity: 0.5,
          map: googleMapRef.current,
        });
      }

      // Afficher les trous existants
      holePolygonsRef.current.forEach(polygon => setPolylineMap(polygon, null));
      holePolygonsRef.current = [];

      holesRef.current.forEach(hole => {
        const holePolygon = new google.maps.Polygon({
          paths: [hole],
          strokeColor: '#EAB308',
          strokeOpacity: 1,
          strokeWeight: 2,
          fillColor: '#EAB308',
          fillOpacity: 0.5,
          map: googleMapRef.current,
        });
        holePolygonsRef.current.push(holePolygon);
      });

      // Calculer les surfaces
      if (drawnPointsRef.current.length >= 3) {
        const mainCoords = mainPath.map(point => [point.lng(), point.lat()]);
        const mainPolygon = turf.polygon([mainCoords]);
        const totalArea = turf.area(mainPolygon);

        // Calculer la surface des trous
        let excludedArea = 0;
        holesRef.current.forEach(hole => {
          if (hole.length >= 3) {
            const holeCoords = hole.map(point => [point.lng(), point.lat()]);
            const holePolygon = turf.polygon([holeCoords]);
            excludedArea += turf.area(holePolygon);
          }
        });

        // Mettre à jour l'interface
        const finalArea = totalArea - excludedArea;
        setCustomArea(finalArea);
        if (onCustomAreaUpdate) {
          onCustomAreaUpdate(finalArea);
        }

        // Calculer le périmètre
        const perimeter = turf.length(mainPolygon, { units: 'meters' });
        setTotalPerimeter(perimeter);
      }
    } catch (error) {
      console.error('Erreur dans updatePolygon:', error);
    }
  };

  // Helper function to compare LatLng points
  const isLatLngEqual = (point1: google.maps.LatLng, point2: google.maps.LatLng): boolean => {
    return point1.lat() === point2.lat() && point1.lng() === point2.lng();
  };

  // Add cleanup for WebGL contexts
  useEffect(() => {
    const cleanupWebGL = () => {
      const canvas = document.querySelector('canvas');
      if (canvas) {
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (gl) {
          gl.getExtension('WEBGL_lose_context')?.loseContext();
        }
      }
    };

    return () => {
      cleanupWebGL();
      if (mapboxMapRef.current) {
        mapboxMapRef.current.remove();
        mapboxMapRef.current = null;
      }
      if (googleMapRef.current) {
        cleanup();
        googleMapRef.current = null;
      }
    };
  }, [activeView]);

  return (
    <div className="w-full relative flex gap-4">
      <div className="w-2/3 relative">
        {activeView === '3d' ? (
          <div 
            ref={mapbox3DRef}
            className="w-full h-[600px] rounded-lg shadow-lg overflow-hidden"
            style={{ 
              border: '1px solid #e2e8f0',
              backgroundColor: '#f8fafc'
            }}
          />
        ) : (
          <div 
            ref={mapRef}
            className="w-full h-[600px] rounded-lg shadow-lg overflow-hidden"
            style={{ 
              border: '1px solid #e2e8f0',
              backgroundColor: '#f8fafc'
            }}
          />
        )}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-75">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        )}
      </div>
      <div className="w-1/3 p-4 bg-white rounded-lg shadow-lg h-fit">
        {buildingData?.buildingInsights?.solarPotential && (
          <div className="space-y-6">
            <div className="flex gap-2 mb-4 flex-wrap">
              <button
                onClick={() => setActiveView('solar')}
                className={`px-4 py-2 rounded-lg flex-1 ${
                  activeView === 'solar' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                Potentiel Solaire
              </button>
              <button
                onClick={() => setActiveView('shading')}
                className={`px-4 py-2 rounded-lg flex-1 ${
                  activeView === 'shading' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                Zones Optimales
              </button>
              <button
                onClick={() => setActiveView('drawing')}
                className={`px-4 py-2 rounded-lg flex-1 ${
                  activeView === 'drawing' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                Zone Manuelle
              </button>
              <button
                onClick={() => setActiveView('3d')}
                className={`px-4 py-2 rounded-lg flex-1 ${
                  activeView === '3d' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                Vue 3D
              </button>
            </div>

            {activeView === '3d' && (
              <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                  <p className="text-sm text-gray-600 mb-4">
                    Cliquez sur le bâtiment pour sélectionner automatiquement la surface du toit
                  </p>
                  {roofPitch !== null && (
                    <p className="text-sm font-medium text-blue-600">
                      Inclinaison estimée: {roofPitch.toFixed(1)}°
                    </p>
                  )}
                  {customArea !== null && (
                    <p className="text-sm font-medium text-green-600">
                      Surface détectée: {customArea.toFixed(1)} m²
                    </p>
                  )}
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
            )}

            {activeView === 'drawing' ? (
              <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                  <div className="space-y-2 mb-4">
                    <p className="text-sm text-gray-600">
                      {isDrawingMode 
                        ? isDrawingHole
                          ? "Dessinez la zone à exclure (cour intérieure, etc.)"
                          : "Cliquez sur la carte pour dessiner la zone d'installation"
                        : "Cliquez sur 'Configurer Zone' pour commencer"}
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
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => {
                        if (isDrawingMode) {
                          if (isDrawingHole) {
                            if (currentHoleRef.current.length >= 3) {
                              completeHole();
                            } else {
                              setIsDrawingHole(false);
                            }
                          } else if (drawnPointsRef.current.length >= 3) {
                            completePolygon();
                          } else {
                            setIsDrawingMode(false);
                          }
                        } else {
                          setIsDrawingMode(true);
                          setMeasurementMode(true);
                          if (drawnPointsRef.current.length > 0) {
                            cleanup();
                          }
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
                    {isDrawingMode && !isDrawingHole && drawnPointsRef.current.length >= 3 && (
                      <button
                        onClick={startDrawingHole}
                        className="px-4 py-2 rounded-lg bg-yellow-500 text-white"
                      >
                        Exclure Zone
                      </button>
                    )}
                    {isDrawingMode && (
                      <>
                        <button
                          onClick={handleUndo}
                          disabled={!canUndo}
                          className={`px-4 py-2 rounded-lg ${
                            canUndo 
                              ? 'bg-blue-500 text-white' 
                              : 'bg-gray-300 text-gray-500'
                          }`}
                        >
                          Précédent
                        </button>
                        <button
                          onClick={handleRedo}
                          disabled={!canRedo}
                          className={`px-4 py-2 rounded-lg ${
                            canRedo 
                              ? 'bg-blue-500 text-white' 
                              : 'bg-gray-300 text-gray-500'
                          }`}
                        >
                          Suivant
                        </button>
                      </>
                    )}
                    {(drawnPointsRef.current.length > 0 || holesRef.current.length > 0) && (
                      <button
                        onClick={cleanup}
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
