import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { loadGoogleMaps } from './utils/googleMaps';
import { config } from './utils/config';

// Function to initialize the application
function initializeApp() {
  loadGoogleMaps().then(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  }).catch((error: unknown) => {
    console.error('Failed to load Google Maps:', error);
    document.getElementById('root')!.innerHTML = `
      <div style="color: red; padding: 20px; text-align: center;">
        Failed to load Google Maps. Please check your internet connection and try again.
      </div>
    `;
  });
}

// Handle messages from WordPress parent
window.addEventListener('message', (event) => {
  if (event.data?.type === 'init' && event.data?.apiKeys) {
    console.log('Received API keys from WordPress');
    
    // Update config with received API keys
    if (event.data.apiKeys.googleMaps) {
      config.apis.google.maps = event.data.apiKeys.googleMaps;
      config.apis.google.solar = event.data.apiKeys.googleMaps;
    }
    
    // Initialize the app after receiving API keys
    initializeApp();
    
    // Notify parent that we're ready
    window.parent.postMessage({ type: 'ready' }, '*');
  }
});

// If we're not in WordPress (development), initialize immediately
if (!('solarPanelAnalysis' in window)) {
  initializeApp();
}
