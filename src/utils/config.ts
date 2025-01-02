interface Config {
  apiUrl: string;
  nonce?: string;
  siteUrl?: string;
}

// Check if we're running in WordPress environment
const isWordPress = typeof window !== 'undefined' && 'solarPanelAnalysis' in window;

// Define WordPress configuration type
interface WordPressConfig {
  apiUrl: string;
  nonce: string;
  siteUrl: string;
}

// WordPress configuration from localized script
const wordPressConfig = isWordPress ? (window as unknown as { solarPanelAnalysis: WordPressConfig }).solarPanelAnalysis : null;

// Development configuration
const devConfig: Config = {
  apiUrl: 'https://solar.googleapis.com/v1/',
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
