interface Config {
  apiUrl: string;
  nonce?: string;
  siteUrl?: string;
  apis: {
    google: {
      maps: string;
      solar: string;
    };
    electricity: {
      key: string;
      url: string;
    };
    monday: {
      clientId: string;
      clientSecret: string;
      signingSecret: string;
      appId: string;
      boardId: string;
    };
  };
}

// Check if we're running in WordPress environment
const isWordPress = typeof window !== 'undefined' && 'solarPanelAnalysis' in window;

// Define WordPress configuration type
interface WordPressConfig {
  apiUrl: string;
  nonce: string;
  siteUrl: string;
  apis: Config['apis'];
}

// WordPress configuration from localized script
const wordPressConfig = isWordPress ? (window as unknown as { solarPanelAnalysis: WordPressConfig }).solarPanelAnalysis : null;

// Development configuration
const devConfig: Config = {
  apiUrl: 'https://solar.googleapis.com/v1/',
  apis: {
    google: {
      maps: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyBqmzDa44BCBBZLG9ZzwpxWSED1pWLVFuU',
      solar: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyBqmzDa44BCBBZLG9ZzwpxWSED1pWLVFuU'
    },
    electricity: {
      key: import.meta.env.VITE_ELECTRICITY_API_KEY || '6162|yZCtSWFZpEVDycpzurH62ypVxg1BkkisUgn2sz0g',
      url: 'https://api.electricityrates.eu'
    },
    monday: {
      clientId: import.meta.env.VITE_MONDAY_CLIENT_ID || '77c0d937413bb396fd4614f4c7cad263',
      clientSecret: import.meta.env.VITE_MONDAY_CLIENT_SECRET || '516a71e658cdc0777af0bdbe51d196d8',
      signingSecret: import.meta.env.VITE_MONDAY_SIGNING_SECRET || 'f67b16357c257dad5711931ee57eef60',
      appId: import.meta.env.VITE_MONDAY_APP_ID || '10277709',
      boardId: import.meta.env.VITE_MONDAY_BOARD_ID || '1760518302'
    }
  }
};

// Export the appropriate configuration
export const config: Config = wordPressConfig || devConfig;

// Helper function to get API URL
export function getApiUrl(endpoint: string): string {
  if (isWordPress) {
    // In WordPress, use the REST API endpoints
    return `${config.apiUrl}${endpoint}`;
  } else {
    // In development, use the APIs directly
    return endpoint.startsWith('http') ? endpoint : `${config.apiUrl}${endpoint}`;
  }
}

// Export environment check
export const isWordPressEnv = isWordPress;
