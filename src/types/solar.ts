export interface Coordinates {
  lat: number;
  lng: number;
}

export interface BuildingInsights {
  name: string;
  center: {
    latitude: number;
    longitude: number;
  };
  boundingBox: {
    sw: {
      latitude: number;
      longitude: number;
    };
    ne: {
      latitude: number;
      longitude: number;
    };
  };
  imageryDate: {
    year: number;
    month: number;
    day: number;
  };
  imageryQuality: string;
  regionCode: string;
  solarPotential: {
    maxArrayPanelsCount: number;
    maxArrayAreaMeters2: number;
    maxArrayAnnualEnergyKwh: number;
    carbonOffsetFactorKgPerKwh: number;
    wholeRoofStats: {
      areaMeters2: number;
      sunshineQuantiles: number[];
      groundAreaMeters2: number;
    };
    roofSegmentStats: Array<{
      pitchDegrees: number;
      azimuthDegrees: number;
      stats: {
        areaMeters2: number;
        sunshineQuantiles: number[];
        groundAreaMeters2: number;
      };
      center: {
        latitude: number;
        longitude: number;
      };
      boundingBox: {
        sw: {
          latitude: number;
          longitude: number;
        };
        ne: {
          latitude: number;
          longitude: number;
        };
      };
      planeHeightAtCenterMeters: number;
    }>;
    maxSunshineHoursPerYear: number;
    solarPanelConfigs?: Array<{
      panelsCount: number;
      yearlyEnergyDcKwh: number;
      roofSegmentSummaries: Array<{
        pitchDegrees: number;
        azimuthDegrees: number;
        panelsCount: number;
        yearlyEnergyDcKwh: number;
      }>;
    }>;
  };
  roofSegments: Array<{
    segmentId: string;
    pitchDegrees: number;
    azimuthDegrees: number;
    stats: {
      areaMeters2: number;
      sunshineQuantiles: number[];
      groundAreaMeters2: number;
    };
  }>;
}

export interface SolarAnalysisResults {
  coordinates: Coordinates;
  buildingInsights: BuildingInsights;
  roofArea: number;
  solarPanelArea: number;
  yearlyEnergyProduction: number;
  carbonOffset: number;
}