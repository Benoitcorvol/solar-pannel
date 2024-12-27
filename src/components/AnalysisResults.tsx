import React from 'react';
import { SolarAnalysisResults } from '../types/solar';
import { Sun, Battery, Ruler, Leaf, Calendar, Award } from 'lucide-react';

interface ResultsProps {
  results: SolarAnalysisResults;
}

interface StatCardProps {
  icon: React.ElementType;
  title: string;
  value: string;
  subtitle?: string;
}

function StatCard({ icon: Icon, title, value, subtitle }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-300 border border-gray-100">
      <div className="flex items-center space-x-4">
        <div className="p-3 bg-blue-50 rounded-lg">
          <Icon className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-500">{title}</h3>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}

export function AnalysisResults({ results }: ResultsProps) {
  const formatNumber = (num: number) => new Intl.NumberFormat('fr-FR').format(Math.round(num));
  const formatDate = (date: { day: number; month: number; year: number }) => {
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(new Date(date.year, date.month - 1, date.day));
  };

  const bestConfig = results.buildingInsights.solarPotential.solarPanelConfigs?.[0];
  const maxPanels = results.buildingInsights.solarPotential.maxArrayPanelsCount;
  
  // Log raw data for debugging
  console.log('=== Solar Analysis Raw Data ===');
  console.log('Max Panels:', maxPanels);
  console.log('Best Config:', bestConfig);
  console.log('Roof Area:', results.roofArea);
  console.log('Solar Panel Area:', results.solarPanelArea);
  console.log('Yearly Production:', results.yearlyEnergyProduction);
  
  // Calculate total panels from roof segments
  const roofSegments = results.buildingInsights.solarPotential?.roofSegmentStats || [];
  console.log('=== Roof Segments ===');
  console.log('Number of segments:', roofSegments.length);
  
  // Standard solar panel dimensions (in meters)
  const PANEL_WIDTH = 1.7;
  const PANEL_HEIGHT = 1.0;
  const PANEL_AREA = PANEL_WIDTH * PANEL_HEIGHT;
  
  // Calculate available area and number of panels
  const availableArea = results.solarPanelArea; // This is already 90% of total roof area
  const calculatedPanelCount = Math.floor(availableArea / PANEL_AREA);
  
  console.log('=== Panel Calculations ===');
  console.log('Available Area:', availableArea);
  console.log('Panel Area:', PANEL_AREA);
  console.log('Calculated Panel Count:', calculatedPanelCount);
  
  // Use the total number of panels from the API's best configuration
  const panelCount = maxPanels;
  
  console.log('Final Panel Count:', panelCount);
  
  const roofUsagePercent = (results.solarPanelArea / results.roofArea) * 100;
  
  // Calculate production per panel using the actual panel count
  const yearlyProduction = results.yearlyEnergyProduction;
  const productionPerPanel = panelCount > 0 ? yearlyProduction / panelCount : 0;

  console.log('=== Production Calculations ===');
  console.log('Yearly Production:', yearlyProduction);
  console.log('Panel Count:', panelCount);
  console.log('Production per Panel:', productionPerPanel);

  return (
    <div className="space-y-8 mt-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Potentiel Solaire</h2>
        <p className="text-gray-600">Analyse détaillée de votre installation solaire potentielle</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard
          icon={Ruler}
          title="Surface Totale"
          value={`${formatNumber(results.roofArea)} m²`}
          subtitle={`${Math.round(roofUsagePercent)}% utilisable pour les panneaux`}
        />
        <StatCard
          icon={Sun}
          title="Production Annuelle"
          value={`${formatNumber(results.yearlyEnergyProduction)} kWh`}
          subtitle={`${formatNumber(productionPerPanel)} kWh/panneau/an`}
        />
        <StatCard
          icon={Battery}
          title="Panneaux Solaires"
          value={`${formatNumber(panelCount)}`}
          subtitle={`Configuration optimale recommandée`}
        />
        <StatCard
          icon={Leaf}
          title="Impact Environnemental"
          value={`${formatNumber(results.carbonOffset)} kg`}
          subtitle="Réduction annuelle de CO₂"
        />
        <StatCard
          icon={Calendar}
          title="Date des Images"
          value={formatDate(results.buildingInsights.imageryDate)}
          subtitle="Dernière analyse satellite"
        />
        <StatCard
          icon={Award}
          title="Qualité des Données"
          value={results.buildingInsights.imageryQuality === 'HIGH' ? 'Excellente' : 'Bonne'}
          subtitle="Précision de l'analyse"
        />
      </div>
    </div>
  );
}
