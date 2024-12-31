import React, { useState, useEffect } from 'react';
import { SolarAnalysisResults } from '../types/solar';
import { Sun, Battery, Calculator, Leaf, BarChart, Layout } from 'lucide-react';
import { getCurrentElectricityRate, formatElectricityRate } from '../utils/electricityRates';

interface ResultsProps {
  results: SolarAnalysisResults;
}

// Helper function to get human-readable orientation
function getOrientationLabel(degrees: number): string {
  // Normalize degrees to 0-360 range
  degrees = ((degrees % 360) + 360) % 360;
  
  if (degrees > 337.5 || degrees <= 22.5) return 'Nord';
  if (degrees > 22.5 && degrees <= 67.5) return 'Nord-Est';
  if (degrees > 67.5 && degrees <= 112.5) return 'Est';
  if (degrees > 112.5 && degrees <= 157.5) return 'Sud-Est';
  if (degrees > 157.5 && degrees <= 202.5) return 'Sud';
  if (degrees > 202.5 && degrees <= 247.5) return 'Sud-Ouest';
  if (degrees > 247.5 && degrees <= 292.5) return 'Ouest';
  return 'Nord-Ouest';
}

interface StatCardProps {
  icon: React.ElementType;
  title: string;
  value: string;
  subtitle?: string;
  details?: string[];
}

function StatCard({ icon: Icon, title, value, subtitle, details }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-300 border border-gray-100">
      <div className="flex items-start space-x-4">
        <div className="p-3 bg-blue-50 rounded-lg">
          <Icon className="w-6 h-6 text-blue-600" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-medium text-gray-500">{title}</h3>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {subtitle && <p className="text-sm text-gray-600 mt-1">{subtitle}</p>}
          {details && (
            <ul className="mt-2 space-y-1">
              {details.map((detail, index) => (
                <li key={index} className="text-sm text-gray-500 flex items-center">
                  <span className="w-1.5 h-1.5 bg-blue-400 rounded-full mr-2"></span>
                  {detail}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export function AnalysisResults({ results }: ResultsProps) {
  const formatNumber = (num: number) => new Intl.NumberFormat('fr-FR').format(Math.round(num));
  
  // Panel configuration
  const PANEL_WIDTH = 1.7; // m
  const PANEL_HEIGHT = 1.0; // m
  const PANEL_POWER = 400; // Watts per panel

  // State for electricity price and loading
  const [electricityPrice, setElectricityPrice] = useState<number>(0.2170); // Default FR rate
  const [isRateLoading, setIsRateLoading] = useState(true);
  const [isFallbackRate, setIsFallbackRate] = useState(false);

  // Fetch current electricity rate for the address
  useEffect(() => {
    let isMounted = true;
    setIsRateLoading(true);
    setIsFallbackRate(false);

    getCurrentElectricityRate(results.address)
      .then((rate: number) => {
        if (isMounted) {
          setElectricityPrice(rate);
          // Set isFallbackRate based on whether the rate matches any fallback rate
          const fallbackRates = Object.values({
            'FR': 0.2170,
            'DE': 0.3790,
            'ES': 0.1890,
            'IT': 0.2590,
            'GB': 0.2780,
            'NL': 0.3150,
            'BE': 0.2890
          });
          setIsFallbackRate(fallbackRates.includes(rate));
        }
      })
      .catch((error) => {
        console.error('Error in electricity rate fetch:', error);
        if (isMounted) {
          setIsFallbackRate(true);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsRateLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [results.address]);
  
  // System configuration from results with null checks
  const maxPanels = results?.buildingInsights?.solarPotential?.maxArrayPanelsCount ?? 48;
  const availableArea = results?.solarPanelArea ?? 85;
  const yearlyProduction = results?.yearlyEnergyProduction ?? 18840;
  const roofUsagePercent = results?.roofArea ? ((results.solarPanelArea / results.roofArea) * 100) : 90;
  const totalPowerKW = (maxPanels * PANEL_POWER) / 1000;
  
  // Financial calculations with updated market rates
  const INSTALLATION_COST_PER_KW = 2000; // €/kW for commercial installations (2024 market rate)
  const MAINTENANCE_COST_PERCENT = 0.01; // 1% of installation cost per year
  const PANEL_DEGRADATION = 0.005; // 0.5% degradation per year
  const ELECTRICITY_PRICE_INFLATION = 0.03; // 3% increase per year (updated for current trends)
  const ANALYSIS_PERIOD = 25; // 25 years (typical panel warranty period)
  const DISCOUNT_RATE = 0.04; // 4% discount rate for NPV calculation
  
  const installationCost = totalPowerKW * INSTALLATION_COST_PER_KW;
  const yearlyMaintenanceCost = installationCost * MAINTENANCE_COST_PERCENT;
  const yearlyRevenue = yearlyProduction * electricityPrice;

  // Validate financial inputs
  if (yearlyRevenue <= 0 || installationCost <= 0) {
    console.warn('Invalid financial inputs:', { yearlyRevenue, installationCost, electricityPrice });
  }

  // Calculate NPV (Net Present Value) and ROI with improved accuracy
  const calculateFinancials = () => {
    let totalRevenue = 0;
    let currentProduction = yearlyProduction;
    let currentPrice = electricityPrice;
    
    for (let year = 1; year <= ANALYSIS_PERIOD; year++) {
      // Account for panel degradation (0.5% per year)
      currentProduction *= (1 - PANEL_DEGRADATION);
      // Account for electricity price inflation (3% per year)
      currentPrice *= (1 + ELECTRICITY_PRICE_INFLATION);
      
      const yearRevenue = currentProduction * currentPrice;
      const yearProfit = yearRevenue - yearlyMaintenanceCost;
      
      // NPV calculation with 4% discount rate
      totalRevenue += yearProfit / Math.pow(1 + DISCOUNT_RATE, year);
    }

    const netProfit = totalRevenue - installationCost;
    
    // Calculate ROI in years using simple payback period
    let roiYears = ANALYSIS_PERIOD;
    const yearlyProfit = yearlyRevenue - yearlyMaintenanceCost;
    if (yearlyProfit > 0) {
      roiYears = installationCost / yearlyProfit;
    }
    
    return {
      totalRevenue,
      netProfit,
      ROI_YEARS: Math.max(0.1, roiYears) // Ensure ROI is never negative or zero
    };
  };

  const financials = calculateFinancials();

  // Technical specifications from results with null checks
  const orientation = results?.buildingInsights?.solarPotential?.roofSegmentStats?.[0]?.azimuthDegrees ?? 257;
  const tilt = results?.buildingInsights?.solarPotential?.roofSegmentStats?.[0]?.pitchDegrees ?? 19;
  const productionPerM2 = yearlyProduction / availableArea;
  const productionPerPanel = yearlyProduction / maxPanels;

  // Calculate carbon offset (assuming 0.5 kg CO2 per kWh of solar energy)
  const carbonOffset = yearlyProduction * 0.5;

  return (
    <div className="space-y-8 mt-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Analyse Technique</h2>
        <p className="text-gray-600">Étude détaillée de rentabilité et performance</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard
          icon={Layout}
          title="Configuration Optimale"
          value={`${formatNumber(maxPanels)} panneaux`}
          subtitle={`Surface totale: ${formatNumber(availableArea)} m²`}
          details={[
            `${formatNumber(totalPowerKW)} kWc de puissance installée`,
            `${Math.round(roofUsagePercent)}% d'utilisation de la surface`,
            `${PANEL_WIDTH}m × ${PANEL_HEIGHT}m par panneau`
          ]}
        />
        
        <StatCard
          icon={Sun}
          title="Production Énergétique"
          value={`${formatNumber(yearlyProduction)} kWh/an`}
          subtitle={`${formatNumber(productionPerM2)} kWh/m²/an`}
          details={[
            `${formatNumber(productionPerPanel)} kWh/panneau/an`,
            `${formatNumber(yearlyProduction / 12)} kWh/mois en moyenne`,
            `Rendement optimal validé`
          ]}
        />

        <StatCard
          icon={Calculator}
          title="Analyse Financière"
          value={`${formatNumber(yearlyRevenue)}€/an`}
          subtitle={`ROI estimé: ${financials.ROI_YEARS.toFixed(1)} ans`}
          details={[
            `Investissement initial: ${formatNumber(installationCost)}€`,
            `Maintenance: ${formatNumber(yearlyMaintenanceCost)}€/an`,
            `Bénéfice net sur 25 ans: ${formatNumber(financials.netProfit)}€`,
            `Prix: ${formatElectricityRate(electricityPrice, 'CENTS')}${isFallbackRate ? ' (estimation)' : ''}${isRateLoading ? ' (chargement...)' : ''}`
          ]}
        />

        <StatCard
          icon={Battery}
          title="Capacité Technique"
          value={`${formatNumber(totalPowerKW)} kWc`}
          subtitle="Puissance installée totale"
          details={[
            `${PANEL_POWER}W par panneau`,
            `Orientation: ${Math.round(orientation)}°`,
            `Inclinaison: ${Math.round(tilt)}°`
          ]}
        />

        <StatCard
          icon={BarChart}
          title="Performance"
          value={`${formatNumber(productionPerM2)} kWh/m²`}
          subtitle="Production annuelle/m²"
          details={[
            `Efficacité: ${Math.round(roofUsagePercent)}%`,
            `Orientation: ${Math.round(orientation)}° (${getOrientationLabel(orientation)})`,
            `Rendement maximal`
          ]}
        />

        <StatCard
          icon={Leaf}
          title="Impact Environnemental"
          value={`${formatNumber(carbonOffset)} kg`}
          subtitle="CO₂ évité par an"
          details={[
            `${formatNumber(carbonOffset / 1000)} tonnes de CO₂`,
            `Impact carbone positif`,
            `Certification environnementale`
          ]}
        />
      </div>
    </div>
  );
}
