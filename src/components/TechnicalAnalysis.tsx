import React from 'react';

interface TechnicalAnalysisProps {
  info: {
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
  };
}

const TechnicalAnalysis: React.FC<TechnicalAnalysisProps> = ({ info }) => {
  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold mb-6">Analyse Technique</h2>
      <div className="text-sm text-gray-600 mb-4">Étude détaillée de rentabilité et performance</div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Configuration Optimale */}
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="text-blue-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
              </svg>
            </div>
            <h3 className="font-semibold">Configuration Optimale</h3>
          </div>
          <div className="space-y-2">
            <p className="text-2xl font-bold mb-2">{info.numberOfPanels} panneaux</p>
            <p>Surface totale: {info.area.toFixed(1)} m²</p>
            <p>{info.peakPower.toFixed(1)} kWc de puissance installée</p>
            <p>{Math.round(info.usableArea / info.area * 100)}% d'utilisation de la surface</p>
            <p>1.7m × 1m par panneau</p>
          </div>
        </div>

        {/* Production Énergétique */}
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="text-yellow-500">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <h3 className="font-semibold">Production Énergétique</h3>
          </div>
          <div className="space-y-2">
            <p className="text-2xl font-bold mb-2">{Math.round(info.estimatedEnergy)} kWh/an</p>
            <p>{(info.estimatedEnergy / info.area).toFixed(0)} kWh/m²/an</p>
            <p>{Math.round(info.estimatedEnergy / 12)} kWh/mois en moyenne</p>
            <p>Rendement optimal validé</p>
          </div>
        </div>

        {/* Analyse Financière */}
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="text-green-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="font-semibold">Analyse Financière</h3>
          </div>
          <div className="space-y-2">
            <p className="text-2xl font-bold mb-2">{Math.round(info.annualRevenue)}€/an</p>
            <p>ROI estimé: {info.roi.toFixed(1)} ans</p>
            <p>Investissement initial: {Math.round(info.installationCost)}€</p>
            <p>Maintenance: {Math.round(info.maintenanceCost)}€/an</p>
            <p>Prix: 0.34€/kWh</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TechnicalAnalysis; 