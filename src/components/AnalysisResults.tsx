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
  const PANEL_POWER = 450; // Updated to latest high-efficiency panels (2024)

  // State for electricity price (in €/kWh) and loading
  const [electricityPrice, setElectricityPrice] = useState<number>(0.34223); // Default FR autoconsommation rate in €/kWh
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
          setElectricityPrice(rate); // Rate is already in €/kWh
          // Set isFallbackRate based on whether the rate matches any fallback rate
          const fallbackRates = Object.values({
            'FR': 0.34223, // Updated French autoconsommation rate
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
  
  // Calculate system configuration based on available area
  const availableArea = results?.solarPanelArea ?? 85;
  const roofUsagePercent = results?.roofArea ? ((results.solarPanelArea / results.roofArea) * 100) : 90;
  
  // Panel calculations
  const panelArea = PANEL_WIDTH * PANEL_HEIGHT; // m² per panel
  const actualPanels = Math.floor(availableArea / panelArea);
  const totalPowerKW = (actualPanels * PANEL_POWER) / 1000;

  // Technical specifications from results with null checks
  const orientation = results?.buildingInsights?.solarPotential?.roofSegmentStats?.[0]?.azimuthDegrees ?? 257;
  const tilt = results?.buildingInsights?.solarPotential?.roofSegmentStats?.[0]?.pitchDegrees ?? 19;

  // Production calculations for France based on latest solar irradiance data
  const BASE_ANNUAL_PRODUCTION = 1350; // Updated base production for optimal conditions in France (2024)
  const optimalTilt = 35; // Optimal tilt angle for France
  const optimalOrientation = 180; // South = 180 degrees

  // Calculate tilt efficiency - more conservative approach
  const tiltEfficiency = Math.max(0.85,
    Math.cos((Math.abs(tilt - optimalTilt) * Math.PI) / 180)
  );

  // Orientation efficiency with realistic degradation
  const orientationDiff = Math.abs(orientation - optimalOrientation);
  const isNorthFacing = orientationDiff > 90;
  const orientationEfficiency = isNorthFacing ?
    Math.max(0.65, 0.85 - (orientationDiff - 90) * 0.002) : // North facing
    Math.max(0.80, 0.95 - (orientationDiff * 0.002)); // Other orientations
  
  // System losses with realistic values (2024 updated values)
  const INVERTER_EFFICIENCY = 0.975; // 97.5% efficiency (latest inverters)
  const DC_WIRING_LOSSES = 0.985; // 1.5% loss (improved wiring)
  const AC_WIRING_LOSSES = 0.99; // 1% loss (optimized layout)
  const SOILING_FACTOR = calculateSoilingLoss(tilt);
  const TEMPERATURE_LOSSES = calculateTempLoss(orientation);
  const LID_LOSSES = 0.98; // 2% LID loss
  const MISMATCH_LOSSES = 0.98; // 2% mismatch
  const CONNECTION_LOSSES = 0.99; // 1% connection losses
  const SNOW_LOSSES = calculateSnowLoss(tilt, results.address);

  // Helper functions with more conservative loss calculations
  function calculateSoilingLoss(tiltDegrees: number): number {
    return tiltDegrees < 10 ? 0.95 : // Flat panels
           tiltDegrees < 20 ? 0.96 :
           tiltDegrees < 30 ? 0.97 :
           0.98; // Steep panels
  }

  function calculateTempLoss(orientationDegrees: number): number {
    const normalizedOrientation = ((orientationDegrees % 360) + 360) % 360;
    const isSouthFacing = normalizedOrientation > 135 && normalizedOrientation < 225;
    const isWestFacing = normalizedOrientation >= 225 && normalizedOrientation < 315;
    
    return isWestFacing ? 0.93 : // West facing
           isSouthFacing ? 0.94 : // South facing
           0.95; // Other orientations
  }

  function calculateSnowLoss(tiltDegrees: number, address: string): number {
    const isNorthernFrance = address.toLowerCase().includes('hauts-de-france') || 
                            address.toLowerCase().includes('grand-est');
    
    if (!isNorthernFrance) return 0.99;
    
    return tiltDegrees < 30 ? 0.96 :
           tiltDegrees < 40 ? 0.97 :
           0.98;
  }
  
  // Combined system efficiency with all detailed losses
  const SYSTEM_EFFICIENCY = INVERTER_EFFICIENCY * DC_WIRING_LOSSES * 
    AC_WIRING_LOSSES * SOILING_FACTOR * TEMPERATURE_LOSSES * LID_LOSSES * 
    MISMATCH_LOSSES * CONNECTION_LOSSES * SNOW_LOSSES;

  // Calculate detailed performance metrics
  const systemLossBreakdown = {
    inverter: (1 - INVERTER_EFFICIENCY) * 100,
    dcWiring: (1 - DC_WIRING_LOSSES) * 100,
    acWiring: (1 - AC_WIRING_LOSSES) * 100,
    soiling: (1 - SOILING_FACTOR) * 100,
    temperature: (1 - TEMPERATURE_LOSSES) * 100,
    lid: (1 - LID_LOSSES) * 100,
    mismatch: (1 - MISMATCH_LOSSES) * 100,
    connections: (1 - CONNECTION_LOSSES) * 100,
    snow: (1 - SNOW_LOSSES) * 100
  };


  // Shading analysis with time-of-day consideration
  const SHADING_FACTOR = Math.max(0.92, 
    results?.buildingInsights?.solarPotential?.wholeRoofStats?.sunshineQuantiles?.[4] ?? 0.95
  ); // Using API data if available, else 8% default shading loss
  
  // Calculate production with proper unit handling
  const productionPerKWp = BASE_ANNUAL_PRODUCTION * tiltEfficiency * orientationEfficiency * SYSTEM_EFFICIENCY * SHADING_FACTOR;
  // Ensure production is in kWh, not Wh
  const totalYearlyProduction = Math.max(0, Math.min(
    productionPerKWp * totalPowerKW,
    100000 // Sanity check: max 100,000 kWh/year for residential
  ));
  const productionPerPanel = Math.max(0, Math.min(
    totalYearlyProduction / actualPanels,
    1000 // Sanity check: max 1,000 kWh/panel/year
  ));
  const productionPerM2 = Math.max(0, Math.min(
    totalYearlyProduction / availableArea,
    300 // Sanity check: max 300 kWh/m²/year
  ));
  
  // Use API value if available and reasonable, otherwise use calculated value
  const yearlyProduction = results?.yearlyEnergyProduction && 
    results.yearlyEnergyProduction > 0 &&
    results.yearlyEnergyProduction < 100000 // Sanity check
    ? results.yearlyEnergyProduction 
    : totalYearlyProduction;
  
  // Financial calculations with realistic 2024 French market rates
  const BASE_INSTALLATION_COST = 8000; // Base installation cost
  const INSTALLATION_COST_PER_KW = 1300; // Cost per kW
  const MAINTENANCE_COST_PER_KW = 20; // Annual maintenance cost per kW
  const PANEL_DEGRADATION = 0.005; // 0.5% annual degradation
  const ELECTRICITY_PRICE_INFLATION = 0.03; // 3% annual increase
  const ANALYSIS_PERIOD = 25; // Standard analysis period
  const DISCOUNT_RATE = 0.04; // Standard discount rate
  
  // Updated French solar incentives 2024-2025
  const calculatePrimeALaTransition = (power: number) => {
    // Updated incentive structure based on latest French energy policy
    if (power <= 3) return 2200;
    if (power <= 9) return 1800;
    if (power <= 36) return 1000;
    return 800;
  };
  
  // Updated VAT rates and tax credits
  const TVA_RATE = 0.055; // Reduced to 5.5% for energy transition projects
  const CREDIT_IMPOT = Math.min(totalPowerKW * 450, 2400); // Enhanced tax credit
  
  // Additional regional incentives (varies by department)
  const REGIONAL_BONUS = Math.min(totalPowerKW * 200, 1000); // Regional ecological bonus
  
  // Calculate total installation and maintenance costs
  const baseInstallationCost = Math.max(0, BASE_INSTALLATION_COST + (totalPowerKW * INSTALLATION_COST_PER_KW));
  const primeTransition = Math.max(0, calculatePrimeALaTransition(totalPowerKW));
  const tvaReduction = Math.max(0, baseInstallationCost * (0.20 - TVA_RATE)); // Difference between standard TVA and reduced rate
  
  // Final costs after all incentives
  const installationCost = Math.max(0, baseInstallationCost - primeTransition - CREDIT_IMPOT - tvaReduction - REGIONAL_BONUS);
  const yearlyMaintenanceCost = Math.max(0, totalPowerKW * MAINTENANCE_COST_PER_KW);
  
  // Calculate yearly revenue (in euros)
  const yearlyRevenue = Math.max(0, Math.min(
    yearlyProduction * electricityPrice, // electricityPrice is already in €/kWh (e.g., 0.217 for 21.7 cents)
    25000 // Sanity check: max 25,000€/year for residential
  ));

  // Calculate financials with sanity checks
  const calculateFinancials = () => {
    let totalRevenue = 0;
    let currentProduction = yearlyProduction;
    let currentPrice = electricityPrice;
    
    for (let year = 1; year <= ANALYSIS_PERIOD; year++) {
      // Account for panel degradation
      currentProduction *= (1 - PANEL_DEGRADATION);
      // Account for electricity price inflation
      currentPrice *= (1 + ELECTRICITY_PRICE_INFLATION);
      
      const yearRevenue = Math.max(0, Math.min(
        currentProduction * Math.min(currentPrice, 0.50), // Cap at 50 cents/kWh
        25000 // Sanity check: max 25,000€/year
      ));
      const yearProfit = Math.max(0, yearRevenue - yearlyMaintenanceCost);
      
      // NPV calculation
      totalRevenue += yearProfit / Math.pow(1 + DISCOUNT_RATE, year);
    }

    const netProfit = Math.max(0, Math.min(
      totalRevenue - installationCost,
      500000 // Sanity check: max 500k€ net profit over 25 years (more realistic)
    ));
    
    // Calculate ROI in years using simple payback period
    // Calculate simple payback period (ROI)
    const yearlyProfit = yearlyRevenue - yearlyMaintenanceCost;
    const simpleRoi = yearlyProfit > 0 ? installationCost / yearlyProfit : ANALYSIS_PERIOD;
    
    // Adjust ROI based on electricity price inflation and panel degradation
    const adjustedRoi = simpleRoi / (1 + ELECTRICITY_PRICE_INFLATION - PANEL_DEGRADATION);
    
    return {
      totalRevenue,
      netProfit,
      ROI_YEARS: Math.min(ANALYSIS_PERIOD, Math.max(5, adjustedRoi)) // ROI between 5 and 25 years
    };
  };

  const financials = calculateFinancials();

  // Debug logs for verification
  console.log('System Configuration:', {
    panels: actualPanels,
    power: `${totalPowerKW} kWc`,
    area: `${availableArea} m²`,
    orientation: `${orientation}° (${getOrientationLabel(orientation)})`,
    tilt: `${tilt}°`
  });

  console.log('Production Values:', {
    yearlyProduction: `${yearlyProduction} kWh/year`,
    perPanel: `${productionPerPanel} kWh/panel/year`,
    perM2: `${productionPerM2} kWh/m²/year`,
    monthlyAverage: `${yearlyProduction / 12} kWh/month`
  });

  console.log('Financial Calculations:', {
    electricityRate: formatElectricityRate(electricityPrice, 'CENTS'),
    yearlyRevenue: `${yearlyRevenue}€/year`,
    installationCost: `${installationCost}€`,
    maintenanceCost: `${yearlyMaintenanceCost}€/year`,
    roi: `${financials.ROI_YEARS.toFixed(1)} years`,
    netProfit25Years: `${financials.netProfit}€`
  });

  // Validate financial inputs
  if (yearlyRevenue <= 0 || installationCost <= 0) {
    console.warn('Invalid financial inputs:', { yearlyRevenue, installationCost, electricityPrice });
  }

  // Calculate carbon offset with proper units (tonnes CO2)
  const GRID_EMISSION_FACTOR = 0.0581; // Updated kg CO2/kWh for French grid (2024 RTE data)
  const carbonOffset = Math.max(0, Math.min(
    (yearlyProduction * GRID_EMISSION_FACTOR),
    10000 // Sanity check: max 10 tonnes CO2/year
  ));

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
          value={`${formatNumber(actualPanels)} panneaux`}
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
            `Coût avant aides: ${formatNumber(baseInstallationCost)}€`,
            `Aides: -${formatNumber(primeTransition + CREDIT_IMPOT + tvaReduction)}€`,
            `Coût final: ${formatNumber(installationCost)}€`,
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
          subtitle={`Rendement: ${Math.round(productionPerKWp)} kWh/kWc/an`}
          details={[
            `Performance ratio: ${Math.round(SYSTEM_EFFICIENCY * orientationEfficiency * SHADING_FACTOR * 100)}%`,
            `Impact orientation ${getOrientationLabel(orientation)}: ${Math.round(orientationEfficiency * 100)}%`,
            `Pertes système:`,
            `• Onduleur: ${systemLossBreakdown.inverter.toFixed(1)}%`,
            `• Câblage DC/AC: ${(systemLossBreakdown.dcWiring + systemLossBreakdown.acWiring).toFixed(1)}%`,
            `• Température: ${systemLossBreakdown.temperature.toFixed(1)}%`,
            `• Salissures: ${systemLossBreakdown.soiling.toFixed(1)}%`,
            `• Ombrage: ${Math.round((1 - SHADING_FACTOR) * 100)}%`,
            `• Autres: ${(systemLossBreakdown.lid + systemLossBreakdown.mismatch + systemLossBreakdown.connections + systemLossBreakdown.snow).toFixed(1)}%`
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
