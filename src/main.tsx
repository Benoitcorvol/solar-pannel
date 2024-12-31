import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { loadGoogleMaps } from './utils/googleMaps';

// Initialize Google Maps before rendering the app
loadGoogleMaps().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}).catch((error: unknown) => {
  console.error('Failed to load Google Maps:', error);
  // Show an error message to the user
  document.getElementById('root')!.innerHTML = `
    <div style="color: red; padding: 20px; text-align: center;">
      Failed to load Google Maps. Please check your internet connection and try again.
    </div>
  `;
});
