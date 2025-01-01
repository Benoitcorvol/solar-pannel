import React, { useState } from 'react';
import Map from '../components/Map';
import TechnicalAnalysis from '../components/TechnicalAnalysis';

interface SolarAnalysisProps {
  coordinates: {
    lat: number;
    lng: number;
  };
  buildingData?: {
    roofArea: number;
    solarPanelArea: number;
    buildingInsights: any; // Remplacer par le bon type
  };
}

const SolarAnalysis: React.FC<SolarAnalysisProps> = ({ coordinates, buildingData }) => {
  const [technicalInfo, setTechnicalInfo] = useState<{
    area: number;
    usableArea: number;
    numberOfPanels: number;
    peakPower: number;
    estimatedEnergy: number;
    avgPitch: number;
    roi: number;
    annualRevenue: number;
    installationCost: number;
    maintenanceCost: number;
  } | null>(null);

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <Map 
        coordinates={coordinates}
        buildingData={buildingData}
        onTechnicalInfoUpdate={(info) => setTechnicalInfo(info)}
      />
      
      {technicalInfo && (
        <TechnicalAnalysis info={technicalInfo} />
      )}
    </div>
  );
};

export default SolarAnalysis; 