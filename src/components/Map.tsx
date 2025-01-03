import React, { useEffect, useRef, useState } from 'react';
import { Coordinates, BuildingInsights } from '../types/solar';
import * as turf from '@turf/turf';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { getLatestElectricityPrice } from '../services/electricityApi';

// Mapbox token (using public token)
mapboxgl.accessToken = 'pk.eyJ1IjoiYmVub2l0Y29ydm9sIiwiYSI6ImNtNWMwNGxuZjA0MHoya3F5OGN2NnFlcG8ifQ.LTxme4ZLHUo-HBhZVMuyVg';

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

interface BuildingData {
  roofArea: number;
  solarPanelArea: number;
  buildingInsights: BuildingInsights;
}

interface MapProps {
  coordinates: Coordinates;
  buildingData?: BuildingData;
  onCustomAreaUpdate?: (area: number | null) => void;
  onTechnicalInfoUpdate?: (info: {
    area: number;
    usableArea: number;
    numberOfPanels: number;
    peakPower: number;
    estimatedEnergy: number;
    avgPitch: number;
    reventeInfo: {
      revenus: number;
      revenusNets: number;
      roi: number;
    };
    autoconsoInfo: {
      revenus: number;
      revenusNets: number;
      roi: number;
    };
    installationCost: number;
    maintenanceCost: number;
  }) => void;
}


const Map: React.FC<MapProps> = ({ coordinates, buildingData, onCustomAreaUpdate, onTechnicalInfoUpdate }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapbox3DRef = useRef<HTMLDivElement>(null);
  const mapboxMapRef = useRef<mapboxgl.Map | null>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeView, setActiveView] = useState<'solar' | 'shading' | 'drawing' | '3d'>('solar');
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [measurementMode, setMeasurementMode] = useState(false);
  const [, setCustomArea] = useState<number | null>(null);
  const [, setCurrentDistance] = useState<number | null>(null);
  const [, setTotalPerimeter] = useState<number | null>(null);
  const [, setRoofPitch] = useState<number | null>(null);
  
  // Drawing state
  const drawnPointsRef = useRef<google.maps.LatLng[]>([]);
  const drawingHistoryRef = useRef<google.maps.LatLng[][]>([]);
  const currentHistoryIndexRef = useRef<number>(-1);
  const polygonRef = useRef<google.maps.Polygon | null>(null);
  const vertexMarkersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  
  // UI state
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Add state for hole drawing
  const [isDrawingHole, setIsDrawingHole] = useState(false);
  const holesRef = useRef<google.maps.LatLng[][]>([]);
  const currentHoleRef = useRef<google.maps.LatLng[]>([]);
  
  // Add state for hole markers
  const holeMarkersRef = useRef<google.maps.marker.AdvancedMarkerElement[][]>([]);
  const currentHoleMarkersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);

  // Add refs for hole polygons
  const holePolygonsRef = useRef<google.maps.Polygon[]>([]);
  const currentHolePolygonRef = useRef<google.maps.Polygon | null>(null);

  // Add state for multiple polygons
  const [polygons, setPolygons] = useState<{
    points: google.maps.LatLng[];
    area: number;
    pitch: number;
    markers: google.maps.marker.AdvancedMarkerElement[];
    polygon: google.maps.Polygon | null;
  }[]>([]);


  const calculateZoneMetrics = (area: number, pitch: number) => {
    try {
      const solarPotential = buildingData?.buildingInsights?.solarPotential;
      if (!solarPotential || !solarPotential.roofSegmentStats || solarPotential.roofSegmentStats.length === 0) {
        console.log('No valid solar data available');
        return {
          usableArea: 0,
          numberOfPanels: 0,
          peakPower: 0,
          estimatedEnergy: 0,
          efficiencyFactor: 0.85 // Default efficiency factor
        };
      }

      console.log('Solar data available:', solarPotential);

      // Panel parameters
      const panelArea = 1.7 * 1.0; // m² per panel
      const panelPower = 400; // Watts per panel
      const utilizationRate = 0.9; // 90% area utilization

      // Calculate usable area with safety check
      const usableArea = Math.max(0, area * utilizationRate);
      console.log('Usable area:', usableArea.toFixed(1), 'm²');

      // Calculate number of panels with safety check
      const numberOfPanels = Math.max(0, Math.floor(usableArea / panelArea));
      console.log('Number of panels:', numberOfPanels);

      // Calculate peak power with safety check
      const peakPower = Math.max(0, (numberOfPanels * panelPower) / 1000); // kWc
      console.log('Peak power:', peakPower.toFixed(1), 'kWc');

      // Find matching roof segment with safety checks
      const matchingSegment = solarPotential.roofSegmentStats.find(
        s => s && typeof s.pitchDegrees === 'number' && Math.abs(s.pitchDegrees - pitch) < 5
      );
      console.log('Matching segment:', matchingSegment);

      // Find optimal segment with safety checks
      const optimalSegment = solarPotential.roofSegmentStats.reduce(
        (best, current) => {
          if (!current?.stats?.sunshineQuantiles || !best?.stats?.sunshineQuantiles) return best;
          return (current.stats.sunshineQuantiles[8] || 0) > (best.stats.sunshineQuantiles[8] || 0) ? current : best;
        },
        solarPotential.roofSegmentStats[0]
      );
      console.log('Optimal segment:', optimalSegment);

      // Calculate efficiency factor with safety checks
      let efficiencyFactor = 0.85; // Default value
      if (matchingSegment?.stats?.sunshineQuantiles && optimalSegment?.stats?.sunshineQuantiles) {
        const matchingSunshine = matchingSegment.stats.sunshineQuantiles[8] || 0;
        const optimalSunshine = optimalSegment.stats.sunshineQuantiles[8] || 0;
        if (optimalSunshine > 0) {
          efficiencyFactor = matchingSunshine / optimalSunshine;
        }
      }
      console.log('Efficiency factor:', efficiencyFactor.toFixed(2));

      // Calculate annual energy production with safety checks
      const maxEnergy = Math.max(0, (solarPotential.maxSunshineHoursPerYear || 1000) * peakPower);
      const estimatedEnergy = Math.max(0, maxEnergy * efficiencyFactor);
      console.log('Max energy:', maxEnergy.toFixed(0), 'kWh/year');
      console.log('Estimated energy:', estimatedEnergy.toFixed(0), 'kWh/year');

      return {
        usableArea,
        numberOfPanels,
        peakPower,
        estimatedEnergy,
        efficiencyFactor
      };
    } catch (error) {
      console.error('Error in calculateZoneMetrics:', error);
      return {
        usableArea: 0,
        numberOfPanels: 0,
        peakPower: 0,
        estimatedEnergy: 0,
        efficiencyFactor: 0.85
      };
    }
  };

  const startDrawingHole = () => {
    if (drawnPointsRef.current.length < 3) return;
    
    console.log('=== Début du dessin de zone d\'exclusion ===');
    console.log('Points du polygone principal:', drawnPointsRef.current);
    
    // Reset hole drawing state
    currentHoleRef.current = [];
    currentHoleMarkersRef.current = [];
    
    // Ensure main polygon stays visible
    if (polygonRef.current) {
      const paths = polygonRef.current.getPaths();
      const mainPath = paths.getAt(0).getArray();
      
      setPolylineMap(polygonRef.current, null);
      polygonRef.current = new google.maps.Polygon({
        paths: [mainPath],
        strokeColor: '#4CAF50',
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: '#4CAF50',
        fillOpacity: 0.35,
        map: googleMapRef.current,
        clickable: false,
        zIndex: 1
      });
    }
    
    // Activate hole drawing mode
    setIsDrawingHole(true);
  };

  const completeHole = async () => {
    console.log('\n=== DÉBUT COMPLETION DU TROU ===');
    
    if (currentHoleRef.current.length < 3) {
      console.log('Pas assez de points pour former un trou');
      return;
    }
    
    try {
      // Ensure the hole is properly closed
      if (!isLatLngEqual(currentHoleRef.current[0], currentHoleRef.current[currentHoleRef.current.length - 1])) {
        console.log('Fermeture automatique du trou');
        currentHoleRef.current.push(currentHoleRef.current[0]);
      }

      // Calculate hole area before adding it
      const holeCoords = currentHoleRef.current.map(point => [point.lng(), point.lat()]);
      const holePolygon = turf.polygon([holeCoords]);
      const holeArea = turf.area(holePolygon);
      console.log('Surface de la zone exclue:', holeArea.toFixed(1), 'm²');
      
      // Add the hole and its markers to their respective collections
      holesRef.current.push([...currentHoleRef.current]);
      holeMarkersRef.current.push([...currentHoleMarkersRef.current]);
      console.log('Nombre total de zones exclues:', holesRef.current.length);
      
      // Calculate total excluded area
      let totalExcludedArea = 0;
      holesRef.current.forEach((hole, index) => {
        const coords = hole.map(point => [point.lng(), point.lat()]);
        const polygon = turf.polygon([coords]);
        const area = turf.area(polygon);
        totalExcludedArea += area;
        console.log(`Zone exclue ${index + 1}: ${area.toFixed(1)} m²`);
      });
      console.log('Surface totale exclue:', totalExcludedArea.toFixed(1), 'm²');
      
      // Reset current hole state
      currentHoleRef.current = [];
      currentHoleMarkersRef.current = [];
      setIsDrawingHole(false);

      // Update polygon with new hole
      console.log('Mise à jour du polygone avec la nouvelle zone exclue...');
      updatePolygon();

      // Recalculate all metrics with the new excluded area
      console.log('Recalcul des métriques avec la zone exclue...');
      await updateTotalMetrics();
      
      console.log('=== FIN COMPLETION DU TROU ===\n');
    } catch (error) {
      console.error('Erreur lors de la completion du trou:', error);
    }
  };


  // Initialize Mapbox
  useEffect(() => {
    if (activeView === '3d' && mapbox3DRef.current && !mapboxMapRef.current) {
      try {
        // Clear the container first
        if (mapbox3DRef.current.firstChild) {
          mapbox3DRef.current.innerHTML = '';
        }

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
      // Clear the container first
      if (mapRef.current?.firstChild) {
        mapRef.current.innerHTML = '';
      }
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

  // Update the click handler to use measurement mode
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
        
        if (currentHoleRef.current.length >= 3) {
          if (currentHolePolygonRef.current) {
            currentHolePolygonRef.current.setMap(null);
          }
          currentHolePolygonRef.current = new google.maps.Polygon({
            paths: [currentHoleRef.current],
            strokeColor: '#EAB308',
            strokeOpacity: 1,
            strokeWeight: 2,
            fillColor: '#EAB308',
            fillOpacity: 0.5,
            map: googleMapRef.current,
            clickable: false,
            zIndex: 2
          });
        }
      } else if (measurementMode) {
        // Regular polygon drawing logic with measurements
        if (drawnPointsRef.current.length > 2) {
          const firstPoint = drawnPointsRef.current[0];
          const distance = google.maps.geometry.spherical.computeDistanceBetween(
            firstPoint,
            newPoint
          );
          
          if (distance < 2) {
            setCurrentDistance(null);
            completePolygon();
            return;
          }
        }

        if (drawnPointsRef.current.length > 0) {
          const lastPoint = drawnPointsRef.current[drawnPointsRef.current.length - 1];
          const distance = google.maps.geometry.spherical.computeDistanceBetween(
            lastPoint,
            newPoint
          );
          setCurrentDistance(distance);
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
      }
      updatePolygon();
    });

    return () => {
      google.maps.event.removeListener(clickListener);
    };
  }, [isDrawingMode, activeView, isDrawingHole, measurementMode]);

  const cleanup = () => {
    // Clean up WebGL contexts
    const canvases = document.querySelectorAll('canvas');
    canvases.forEach(canvas => {
      const gl = canvas.getContext('webgl') || canvas.getContext('webgl2');
      if (gl && 'getExtension' in gl) {
        const ext = gl.getExtension('WEBGL_lose_context');
        if (ext) ext.loseContext();
      }
    });

    // Clean up all polygons
    polygons.forEach(p => {
      p.markers.forEach(marker => setMarkerMap(marker, null));
      if (p.polygon) setPolylineMap(p.polygon, null);
    });
    setPolygons([]);

    // Clean up current drawing
    vertexMarkersRef.current.forEach(marker => setMarkerMap(marker, null));
    vertexMarkersRef.current = [];
    
    if (polygonRef.current) setPolylineMap(polygonRef.current, null);
    polygonRef.current = null;
    
    drawnPointsRef.current = [];
    setCustomArea(null);
    setIsDrawingMode(false);

    // Clean up hole drawing state
    holesRef.current = [];
    currentHoleRef.current = [];
    holeMarkersRef.current.forEach(markers => {
      markers.forEach(marker => setMarkerMap(marker, null));
    });
    holeMarkersRef.current = [];
    currentHoleMarkersRef.current.forEach(marker => setMarkerMap(marker, null));
    currentHoleMarkersRef.current = [];
    holePolygonsRef.current.forEach(polygon => setPolylineMap(polygon, null));
    holePolygonsRef.current = [];
    if (currentHolePolygonRef.current) setPolylineMap(currentHolePolygonRef.current, null);
    currentHolePolygonRef.current = null;
    setIsDrawingHole(false);

    // Reset drawing history
    drawingHistoryRef.current = [];
    currentHistoryIndexRef.current = -1;
    setCanUndo(false);
    setCanRedo(false);

    // Reset measurements
    setCurrentDistance(null);
    setTotalPerimeter(null);
    setRoofPitch(null);

    // Reset technical info
    if (onTechnicalInfoUpdate) {
      onTechnicalInfoUpdate({
        area: 0,
        usableArea: 0,
        numberOfPanels: 0,
        peakPower: 0,
        estimatedEnergy: 0,
        avgPitch: 0,
        reventeInfo: {
          revenus: 0,
          revenusNets: 0,
          roi: 0
        },
        autoconsoInfo: {
          revenus: 0,
          revenusNets: 0,
          roi: 0
        },
        installationCost: 0,
        maintenanceCost: 0
      });
    }

    // Reset custom area
    if (onCustomAreaUpdate) {
      onCustomAreaUpdate(null);
    }
  };


  // Update polygon creation to include hover events
  const createPolygonWithEvents = (options: google.maps.PolygonOptions, zoneInfo: { area: number, pitch: number }) => {
    const polygon = new google.maps.Polygon({
      ...options,
      clickable: true
    });

    // Add hover events
    polygon.addListener('mouseover', (e: google.maps.PolyMouseEvent) => {
      if (!e.latLng) return;
      
      const metrics = calculateZoneMetrics(zoneInfo.area, zoneInfo.pitch);
      console.log('Zone metrics:', {
        area: zoneInfo.area,
        pitch: zoneInfo.pitch,
        energy: metrics.estimatedEnergy,
        power: metrics.peakPower
      });
    });

    return polygon;
  };

  const completePolygon = async () => {
    if (drawnPointsRef.current.length < 3) return;
    
    console.log('=== Début completePolygon ===');
    
    try {
      // Ensure the polygon is properly closed
      if (!isLatLngEqual(drawnPointsRef.current[0], drawnPointsRef.current[drawnPointsRef.current.length - 1])) {
        drawnPointsRef.current.push(drawnPointsRef.current[0]);
      }
      
      // Calculate area for this polygon
      const coords = drawnPointsRef.current.map(point => [point.lng(), point.lat()]);
      const polygon = turf.polygon([coords]);
      const area = turf.area(polygon);
      console.log('New polygon area:', area.toFixed(1), 'm²');

      // Get roof segment data for this area
      const segments = buildingData?.buildingInsights?.solarPotential?.roofSegmentStats || [];
      const pitch = segments.length > 0 ? segments[0].pitchDegrees : 0;
      console.log('Roof pitch:', pitch, '°');

      // Create polygon with hover events
      const polygonOptions = {
        paths: [drawnPointsRef.current],
        strokeColor: '#4CAF50',
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: '#4CAF50',
        fillOpacity: 0.35,
        map: googleMapRef.current,
        zIndex: 1
      };

      const newPolygon = createPolygonWithEvents(polygonOptions, { area, pitch });

      // Add to polygons array
      setPolygons(prev => {
        const newPolygons = [...prev, {
          points: [...drawnPointsRef.current],
          area,
          pitch,
          markers: [...vertexMarkersRef.current],
          polygon: newPolygon
        }];
        console.log('Updated polygons array:', newPolygons);
        return newPolygons;
      });

      // Reset current drawing state
      drawnPointsRef.current = [];
      vertexMarkersRef.current = [];
      if (polygonRef.current) {
        polygonRef.current.setMap(null);
      }
      polygonRef.current = null;

      // Wait a bit for the state to update
      await new Promise(resolve => setTimeout(resolve, 100));

      // Force update of total metrics
      console.log('Calling updateTotalMetrics...');
      await updateTotalMetrics();
      console.log('Metrics updated successfully');
      
    } catch (error) {
      console.error('Erreur dans completePolygon:', error);
    }
    
    console.log('=== Fin completePolygon ===');
  };

  // Modifier updatePolygon pour utiliser updateTechnicalAnalysis
  const updatePolygon = () => {
    if (!googleMapRef.current || drawnPointsRef.current.length < 2) return;

    try {
      console.log('=== Mise à jour des polygones ===');
      console.log('Mode dessin trou:', isDrawingHole);
      console.log('Nombre de trous existants:', holesRef.current.length);
      console.log('Points du polygone principal:', drawnPointsRef.current.length);
      console.log('Points du trou en cours:', currentHoleRef.current.length);

      // Create or update main polygon if not drawing a hole
      if (!isDrawingHole) {
        const mainPath = [...drawnPointsRef.current];
        if (mainPath.length > 0 && !isLatLngEqual(mainPath[0], mainPath[mainPath.length - 1])) {
          mainPath.push(mainPath[0]);
        }

        if (polygonRef.current) {
          polygonRef.current.setMap(null);
        }

        // Create main polygon with holes
        const polygonOptions = {
          paths: [mainPath, ...holesRef.current],
          strokeColor: '#4CAF50',
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: '#4CAF50',
          fillOpacity: 0.35,
          map: googleMapRef.current,
          clickable: false,
          zIndex: 1
        };

        polygonRef.current = new google.maps.Polygon(polygonOptions);
      }

      // Handle current hole being drawn
      if (isDrawingHole && currentHoleRef.current.length >= 3) {
        if (currentHolePolygonRef.current) {
          currentHolePolygonRef.current.setMap(null);
        }
        
        const holePath = [...currentHoleRef.current];
        if (holePath.length > 0 && !isLatLngEqual(holePath[0], holePath[holePath.length - 1])) {
          holePath.push(holePath[0]);
        }

        const holeOptions = {
          paths: [holePath],
          strokeColor: '#EAB308',
          strokeOpacity: 1,
          strokeWeight: 2,
          fillColor: '#EAB308',
          fillOpacity: 0.5,
          map: googleMapRef.current,
          clickable: false,
          zIndex: 2
        };

        currentHolePolygonRef.current = new google.maps.Polygon(holeOptions);
      }

      // Display existing holes
      holePolygonsRef.current.forEach(polygon => polygon.setMap(null));
      holePolygonsRef.current = [];

      holesRef.current.forEach(hole => {
        const holePath = [...hole];
        if (holePath.length > 0 && !isLatLngEqual(hole[0], hole[hole.length - 1])) {
          holePath.push(holePath[0]);
        }

        const holeOptions = {
          paths: [holePath],
          strokeColor: '#EAB308',
          strokeOpacity: 1,
          strokeWeight: 2,
          fillColor: '#EAB308',
          fillOpacity: 0.5,
          map: googleMapRef.current,
          clickable: false,
          zIndex: 2
        };

        const holePolygon = new google.maps.Polygon(holeOptions);
        holePolygonsRef.current.push(holePolygon);
      });

      // Calculate main polygon area
      let mainArea = 0;
      if (drawnPointsRef.current.length >= 3) {
        const mainCoords = drawnPointsRef.current.map(point => [point.lng(), point.lat()]);
        if (!isLatLngEqual(drawnPointsRef.current[0], drawnPointsRef.current[drawnPointsRef.current.length - 1])) {
          mainCoords.push([drawnPointsRef.current[0].lng(), drawnPointsRef.current[0].lat()]);
        }
        const mainPolygon = turf.polygon([mainCoords]);
        mainArea = turf.area(mainPolygon);
        console.log('Surface principale:', mainArea.toFixed(1), 'm²');
      }

      // Calculate holes area
      let excludedArea = 0;
      holesRef.current.forEach((hole, index) => {
        if (hole.length >= 3) {
          const holeCoords = hole.map(point => [point.lng(), point.lat()]);
          if (!isLatLngEqual(hole[0], hole[hole.length - 1])) {
            holeCoords.push([hole[0].lng(), hole[0].lat()]);
          }
          const holePolygon = turf.polygon([holeCoords]);
          const holeArea = turf.area(holePolygon);
          excludedArea += holeArea;
          console.log(`Surface zone exclue ${index + 1}:`, holeArea.toFixed(1), 'm²');
        }
      });

      // Calculate final area
      const finalArea = Math.max(0, mainArea - excludedArea);
      console.log('Surface finale après exclusions:', finalArea.toFixed(1), 'm²');

      // Get roof segment data
      const segments = buildingData?.buildingInsights?.solarPotential?.roofSegmentStats || [];
      const avgPitch = segments.length > 0 ? segments[0].pitchDegrees : 0;

      // Update polygons state with new area
      if (drawnPointsRef.current.length >= 3) {
        setPolygons(prev => {
          const newPolygons = [...prev];
          if (newPolygons.length > 0) {
            newPolygons[newPolygons.length - 1] = {
              ...newPolygons[newPolygons.length - 1],
              area: finalArea,
              pitch: avgPitch
            };
          }
          return newPolygons;
        });
      }

      // Update technical analysis with new area
      if (finalArea > 0) {
        const solarPotential = buildingData?.buildingInsights?.solarPotential;
        if (solarPotential) {
          // Calculate panel metrics
          const usableArea = finalArea * 0.9; // 90% utilization
          const panelArea = 1.7 * 1.0; // m² per panel
          const numberOfPanels = Math.floor(usableArea / panelArea);
          const peakPower = numberOfPanels * 0.4; // 400W per panel

          // Calculate energy production
          const maxEnergy = solarPotential.maxArrayAnnualEnergyKwh || 0;
          const areaRatio = finalArea / (solarPotential.maxArrayAreaMeters2 || 1);
          const sunshineHours = solarPotential.maxSunshineHoursPerYear || 1000;
          const efficiencyFactor = 0.97;

          const estimatedEnergy = Math.min(
            maxEnergy * areaRatio,
            peakPower * sunshineHours * efficiencyFactor || 0
          );

          // Update interface
          if (onCustomAreaUpdate) {
            onCustomAreaUpdate(finalArea);
          }

          // Create technical info update
          const updateInfo = {
            area: finalArea,
            usableArea: usableArea,
            numberOfPanels: numberOfPanels,
            peakPower: peakPower,
            estimatedEnergy: estimatedEnergy,
            avgPitch: avgPitch,
            reventeInfo: {
              revenus: 0,
              revenusNets: 0,
              roi: 0
            },
            autoconsoInfo: {
              revenus: 0,
              revenusNets: 0,
              roi: 0
            },
            installationCost: peakPower * 1500,
            maintenanceCost: peakPower * 20
          };

          // Update parent component
          if (onTechnicalInfoUpdate) {
            onTechnicalInfoUpdate(updateInfo);
          }
        }
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
        const gl = canvas.getContext('webgl') as WebGLRenderingContext;
        const gl2 = canvas.getContext('webgl2') as WebGL2RenderingContext;
        
        if (gl && 'getExtension' in gl) {
          const ext = gl.getExtension('WEBGL_lose_context');
          if (ext) ext.loseContext();
        }
        
        if (gl2 && 'getExtension' in gl2) {
          const ext = gl2.getExtension('WEBGL_lose_context');
          if (ext) ext.loseContext();
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

  const updateTotalMetrics = async (): Promise<void> => {
    console.log('\n=== DÉBUT MISE À JOUR DES MÉTRIQUES ===');
    
    try {
      // Get solar potential data first
      const solarPotential = buildingData?.buildingInsights?.solarPotential;
      if (!solarPotential) {
        console.error('No solar potential data available');
        return;
      }

      // Calculate total area from main polygon or use API data
      let mainArea = 0;
      let isUsingApiArea = false;

      if (drawnPointsRef.current.length >= 3) {
        const mainCoords = drawnPointsRef.current.map(point => [point.lng(), point.lat()]);
        if (!isLatLngEqual(drawnPointsRef.current[0], drawnPointsRef.current[drawnPointsRef.current.length - 1])) {
          mainCoords.push([drawnPointsRef.current[0].lng(), drawnPointsRef.current[0].lat()]);
        }
        const mainPolygon = turf.polygon([mainCoords]);
        mainArea = turf.area(mainPolygon);
        console.log('Surface dessinée:', mainArea.toFixed(1), 'm²');
      } else {
        mainArea = solarPotential.maxArrayAreaMeters2;
        isUsingApiArea = true;
        console.log('Utilisation des données API - Surface maximale:', mainArea.toFixed(1), 'm²');
      }

      // Calculate total excluded area
      let excludedArea = 0;
      holesRef.current.forEach((hole, index) => {
        const coords = hole.map(point => [point.lng(), point.lat()]);
        const polygon = turf.polygon([coords]);
        const area = turf.area(polygon);
        excludedArea += area;
        console.log(`Zone exclue ${index + 1}: ${area.toFixed(1)} m²`);
      });
      console.log('Surface totale exclue:', excludedArea.toFixed(1), 'm²');

      // Calculate final area
      const totalArea = Math.max(0, mainArea - excludedArea);
      console.log('Surface finale après exclusions:', totalArea.toFixed(1), 'm²');

      // Get roof segment data
      const segments = solarPotential.roofSegmentStats;
      
      // Calculate weighted average pitch and azimuth based on segment areas
      const totalSegmentArea = segments.reduce((sum, seg) => sum + seg.stats.areaMeters2, 0);
      const avgPitch = segments.reduce((sum, seg) => sum + (seg.pitchDegrees * seg.stats.areaMeters2), 0) / totalSegmentArea;
      const avgAzimuth = segments.reduce((sum, seg) => sum + (seg.azimuthDegrees * seg.stats.areaMeters2), 0) / totalSegmentArea;
      
      console.log('Inclinaison moyenne:', avgPitch.toFixed(1), '°');
      console.log('Orientation moyenne:', avgAzimuth.toFixed(1), '°');

      // Calculate panel metrics
      const usableArea = totalArea * 0.9; // 90% utilization
      const panelArea = 1.7 * 1.0; // m² per panel
      const numberOfPanels = Math.floor(usableArea / panelArea);
      const peakPower = numberOfPanels * 0.45; // 450W per panel
      
      console.log('Métriques panneaux:');
      console.log('- Surface utilisable:', usableArea.toFixed(1), 'm²');
      console.log('- Nombre de panneaux:', numberOfPanels);
      console.log('- Puissance crête:', peakPower.toFixed(1), 'kWc');

      // Calculate efficiency factors
      const optimalAzimuth = 180; // South facing
      const optimalPitch = 35; // Optimal pitch for France
      
      // Calculate orientation loss (azimuth)
      const azimuthDiff = Math.abs(avgAzimuth - optimalAzimuth);
      const orientationLoss = Math.cos(azimuthDiff * Math.PI / 180);
      
      // Calculate pitch loss
      const pitchDiff = Math.abs(avgPitch - optimalPitch);
      const pitchLoss = Math.cos(pitchDiff * Math.PI / 180);
      
      // System losses breakdown
      const inverterLoss = 0.035; // 3.5%
      const wiringLoss = 0.02; // 2%
      const soilingLoss = 0.03; // 3%
      const temperatureLoss = 0.045; // 4.5%
      const mismatchLoss = 0.02; // 2%
      
      const systemLosses = 1 - (inverterLoss + wiringLoss + soilingLoss + temperatureLoss + mismatchLoss);
      const totalEfficiency = orientationLoss * pitchLoss * systemLosses;

      console.log('Facteurs de performance:');
      console.log('- Perte orientation:', ((1 - orientationLoss) * 100).toFixed(1), '%');
      console.log('- Perte inclinaison:', ((1 - pitchLoss) * 100).toFixed(1), '%');
      console.log('- Pertes système:', ((1 - systemLosses) * 100).toFixed(1), '%');
      console.log('  • Onduleur:', (inverterLoss * 100).toFixed(1), '%');
      console.log('  • Câblage:', (wiringLoss * 100).toFixed(1), '%');
      console.log('  • Salissures:', (soilingLoss * 100).toFixed(1), '%');
      console.log('  • Température:', (temperatureLoss * 100).toFixed(1), '%');
      console.log('  • Mismatch:', (mismatchLoss * 100).toFixed(1), '%');
      console.log('- Efficacité totale:', (totalEfficiency * 100).toFixed(1), '%');

      // Calculate energy production
      const baseYearlyProduction = 1350; // kWh/kWc/year in optimal conditions
      let estimatedEnergy = 0;

      if (isUsingApiArea && solarPotential.maxArrayAnnualEnergyKwh) {
        // If using API area, use API energy value adjusted by efficiency
        estimatedEnergy = solarPotential.maxArrayAnnualEnergyKwh * totalEfficiency;
        console.log('Utilisation de l\'énergie API avec efficacité');
      } else {
        // Calculate based on area and power
        const energyFromPower = peakPower * baseYearlyProduction * totalEfficiency;
        const areaRatio = totalArea / (solarPotential.maxArrayAreaMeters2 || 1); // Prevent division by zero
        const energyFromArea = (solarPotential.maxArrayAnnualEnergyKwh || 0) * areaRatio * totalEfficiency;
        
        // Take the most conservative estimate
        estimatedEnergy = Math.min(
          energyFromPower,
          energyFromArea > 0 ? energyFromArea : energyFromPower
        );

        console.log('Calcul de l\'énergie:');
        console.log('- Basé sur la puissance:', energyFromPower.toFixed(0), 'kWh/an');
        console.log('- Basé sur la surface:', energyFromArea.toFixed(0), 'kWh/an');
        console.log('- Valeur retenue:', estimatedEnergy.toFixed(0), 'kWh/an');
      }

      // Calculate energy metrics
      const energyPerSquareMeter = totalArea > 0 ? estimatedEnergy / totalArea : 0;
      const energyPerPanel = numberOfPanels > 0 ? estimatedEnergy / numberOfPanels : 0;
      const monthlyEnergy = estimatedEnergy / 12;

      console.log('Production énergétique:');
      console.log('- Énergie estimée:', estimatedEnergy.toFixed(0), 'kWh/an');
      console.log('- Production par m²:', energyPerSquareMeter.toFixed(0), 'kWh/m²/an');
      console.log('- Production par panneau:', energyPerPanel.toFixed(0), 'kWh/panneau/an');
      console.log('- Production mensuelle:', monthlyEnergy.toFixed(0), 'kWh/mois');

      // Get current electricity price from API
      const electricityPrice = await getLatestElectricityPrice();
      console.log('Prix actuel électricité:', electricityPrice.toFixed(3), '€/kWh');

      // Calculate financial metrics
      const installationCostPerKw = 1500; // €/kWc
      const maintenanceCostPerYear = peakPower * 20; // €/an
      const installationCost = peakPower * installationCostPerKw;
      const aideTaux = 0.15; // 15% d'aide
      const aideAmount = installationCost * aideTaux;
      const finalCost = installationCost - aideAmount;

      // Scénario revente totale
      const prixRevente = electricityPrice * 0.60; // 60% du prix de gros
      const revenusRevente = estimatedEnergy * prixRevente;
      const revenusNetsRevente = revenusRevente - maintenanceCostPerYear;
      const roiRevente = revenusNetsRevente > 0 ? finalCost / revenusNetsRevente : 0;

      // Scénario autoconsommation totale
      const revenusAutoconsommation = estimatedEnergy * electricityPrice;
      const revenusNetsAutoconsommation = revenusAutoconsommation - maintenanceCostPerYear;
      const roiAutoconsommation = revenusNetsAutoconsommation > 0 ? finalCost / revenusNetsAutoconsommation : 0;

      // Calculate CO2 impact
      const co2Factor = solarPotential.carbonOffsetFactorKgPerKwh / 1000; // Convert to kg/kWh
      const co2Savings = estimatedEnergy * co2Factor;

      // Calculate benefice net sur 25 ans
      const beneficeNet25ans = (revenusNetsAutoconsommation * 25) - finalCost;

      console.log('\n=== RÉSULTATS FINANCIERS ===');
      console.log('Production annuelle:', estimatedEnergy.toFixed(0), 'kWh/an');
      console.log('\nScénario 1 : Revente totale');
      console.log('Prix de revente:', prixRevente.toFixed(3), '€/kWh');
      console.log('Revenus bruts:', revenusRevente.toFixed(0), '€/an');
      console.log('Revenus nets:', revenusNetsRevente.toFixed(0), '€/an');
      console.log('Retour sur investissement:', roiRevente.toFixed(1), 'ans');
      console.log('\nScénario 2 : Autoconsommation totale');
      console.log('Prix autoconsommation:', electricityPrice.toFixed(3), '€/kWh');
      console.log('Revenus bruts:', revenusAutoconsommation.toFixed(0), '€/an');
      console.log('Revenus nets:', revenusNetsAutoconsommation.toFixed(0), '€/an');
      console.log('Retour sur investissement:', roiAutoconsommation.toFixed(1), 'ans');
      console.log('\nCoûts');
      console.log('Installation avant aides:', installationCost.toFixed(0), '€');
      console.log('Aides:', aideAmount.toFixed(0), '€');
      console.log('Coût final:', finalCost.toFixed(0), '€');
      console.log('Maintenance:', maintenanceCostPerYear.toFixed(0), '€/an');
      console.log('Bénéfice net sur 25 ans:', beneficeNet25ans.toFixed(0), '€');
      console.log('\nImpact environnemental');
      console.log('CO2 évité:', co2Savings.toFixed(0), 'kg/an');

      // Create update object
      const updateInfo = {
        area: totalArea,
        usableArea: usableArea,
        numberOfPanels: numberOfPanels,
        peakPower: peakPower,
        estimatedEnergy: estimatedEnergy,
        energyPerSquareMeter: energyPerSquareMeter,
        energyPerPanel: energyPerPanel,
        monthlyEnergy: monthlyEnergy,
        avgPitch: avgPitch,
        avgAzimuth: avgAzimuth,
        reventeInfo: {
          revenus: revenusRevente,
          revenusNets: revenusNetsRevente,
          roi: roiRevente
        },
        autoconsoInfo: {
          revenus: revenusAutoconsommation,
          revenusNets: revenusNetsAutoconsommation,
          roi: roiAutoconsommation
        },
        installationCost: installationCost,
        aideAmount: aideAmount,
        finalCost: finalCost,
        maintenanceCost: maintenanceCostPerYear,
        beneficeNet25ans: beneficeNet25ans,
        co2Savings: co2Savings,
        systemEfficiency: {
          orientationLoss: 1 - orientationLoss,
          pitchLoss: 1 - pitchLoss,
          systemLosses: 1 - systemLosses,
          totalEfficiency: totalEfficiency
        }
      };

      // Update parent component
      if (onTechnicalInfoUpdate) {
        onTechnicalInfoUpdate(updateInfo);
        console.log('Technical info updated:', updateInfo);
      }

      // Update custom area if needed
      if (onCustomAreaUpdate) {
        onCustomAreaUpdate(totalArea);
        console.log('Custom area updated:', totalArea);
      }

      console.log('=== FIN DE LA MISE À JOUR DES MÉTRIQUES ===\n');
    } catch (error) {
      console.error('Erreur dans updateTotalMetrics:', error);
    }
  };

  // Modify the button click handler
  const handleConfigTerminer = async () => {
    console.log('=== Début handleConfigTerminer ===');
    console.log('Mode dessin:', isDrawingMode);
    console.log('Mode dessin trou:', isDrawingHole);
    console.log('Points dessinés:', drawnPointsRef.current.length);
    
    if (isDrawingMode) {
      try {
        if (isDrawingHole) {
          if (currentHoleRef.current.length >= 3) {
            await completeHole();
            console.log('Trou complété');
          }
          setIsDrawingHole(false);
        } else if (drawnPointsRef.current.length >= 3) {
          await completePolygon();
          console.log('Polygone complété');
        }
        
        // Toujours mettre à jour les métriques, même si l'aire est 0
        await updateTotalMetrics();
        console.log('Métriques mises à jour');
        
        setIsDrawingMode(false);
      } catch (error) {
        console.error('Erreur lors de la finalisation:', error);
      }
    } else {
      setIsDrawingMode(true);
      if (drawnPointsRef.current.length > 0) {
        cleanup();
        console.log('Nettoyage effectué');
      }
    }
    
    console.log('=== Fin handleConfigTerminer ===');
  };

  return (
    <div className="w-full relative">
      {buildingData?.buildingInsights?.solarPotential && (
        <div className="flex gap-2 mb-4 flex-wrap">
          <button
            onClick={() => setActiveView('solar')}
            className={`px-4 py-2 rounded-lg ${
              activeView === 'solar' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            Potentiel Solaire
          </button>
          <button
            onClick={() => setActiveView('shading')}
            className={`px-4 py-2 rounded-lg ${
              activeView === 'shading' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            Zones Optimales
          </button>
          <button
            onClick={() => setActiveView('drawing')}
            className={`px-4 py-2 rounded-lg ${
              activeView === 'drawing' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            Zone Manuelle
          </button>
          <button
            onClick={() => setActiveView('3d')}
            className={`px-4 py-2 rounded-lg ${
              activeView === '3d' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            Vue 3D
          </button>
        </div>
      )}

      {activeView === 'drawing' && (
        <div className="mb-4 flex gap-2 flex-wrap">
          <button
            onClick={handleConfigTerminer}
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
      )}

      <div className="relative">
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
      {error && (
        <div className="absolute top-0 left-0 right-0 bg-red-100 text-red-700 px-4 py-2 rounded-t-lg">
          {error}
        </div>
      )}
    </div>
  );
};

export default Map;
