import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// Debug middleware to log all requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Test endpoint
app.get('/api/test', async (req, res) => {
  console.log('Test endpoint hit');
  res.json({ status: 'ok', message: 'Server is running' });
});

// Solar API endpoint
app.get('/api/solar/buildingInsights', async (req, res) => {
  try {
    console.log('=== Incoming Request ===');
    console.log('Query parameters:', req.query);
    
    const { lat, lng } = req.query;
    
    if (!lat || !lng) {
      console.error('Missing coordinates in request');
      return res.status(400).json({
        error: 'Missing coordinates',
        details: 'Both lat and lng parameters are required'
      });
    }

    const coordinates = {
      lat: parseFloat(lat),
      lng: parseFloat(lng)
    };
    
    const apiKey = process.env.VITE_GOOGLE_MAPS_API_KEY;
    
    console.log('=== Request Details ===');
    console.log('Coordinates:', coordinates);
    console.log('API Key exists:', !!apiKey);

    if (!apiKey) {
      console.error('API key missing');
      return res.status(500).json({
        error: 'API key is not configured'
      });
    }

    // Construct the Solar API URL
    const baseUrl = 'https://solar.googleapis.com/v1/buildingInsights:findClosest';
    const params = new URLSearchParams({
      'key': apiKey,
      'location.latitude': coordinates.lat.toString(),
      'location.longitude': coordinates.lng.toString()
    });
    
    const fullUrl = `${baseUrl}?${params.toString()}`;
    console.log('=== API Request ===');
    console.log('Making request to Solar API...');
    
    const response = await fetch(fullUrl);
    console.log('Response received from Solar API');
    console.log('Status:', response.status);
    
    const responseText = await response.text();
    console.log('Response text:', responseText);

    if (!response.ok) {
      return res.status(response.status).json({
        error: 'Solar API Error',
        details: responseText
      });
    }

    const data = JSON.parse(responseText);
    res.json(data);
  } catch (error) {
    console.error('Server Error:', error);
    res.status(500).json({ 
      error: error.message
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Available endpoints:');
  console.log('- GET /api/test');
  console.log('- GET /api/solar/buildingInsights');
}); 