interface ElectricityPrice {
  success: boolean;
  status: number;
  data: {
    date: string;
    region: string;
    country: string;
    price: string;
    unit: string;
  };
}

const API_KEY = '6162|yZCtSWFZpEVDycpzurH62ypVxg1BkkisUgn2sz0g';
const BASE_URL = 'https://zylalabs.com/api/3040/electricity+rates+in+europe+api';

export const getLatestElectricityPrice = async (region: string = 'FR'): Promise<number> => {
  console.log('=== Récupération du prix de l\'électricité ===');
  console.log('Région demandée:', region);
  
  try {
    console.log('Appel API en cours...');
    const response = await fetch(`${BASE_URL}/3214/latest?region=${region}`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`
      }
    });

    console.log('Statut de la réponse:', response.status);
    if (!response.ok) {
      throw new Error(`Échec de la requête: ${response.status} ${response.statusText}`);
    }

    const data: ElectricityPrice = await response.json();
    console.log('Données reçues:', data);
    
    // Convert price from €/MWh to €/kWh
    const pricePerKwh = parseFloat(data.data.price) / 1000;
    console.log('Prix converti en €/kWh:', pricePerKwh);
    
    return pricePerKwh;
  } catch (error) {
    console.error('Erreur lors de la récupération du prix:', error);
    console.log('Utilisation du prix par défaut: 0.34223 €/kWh');
    return 0.34223;
  }
}; 