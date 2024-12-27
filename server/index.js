require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

app.get('/api/solar/buildingInsights', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    
    console.log('Received request for coordinates:', { lat, lng });
    
    const url = `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${lat}&location.longitude=${lng}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
    
    console.log('Fetching from Google Solar API...');
    
    const response = await fetch(url);
    const data = await response.json();
    
    console.log('Received response from Google Solar API');
    
    if (!response.ok) {
      console.error('Error from Google Solar API:', data);
      return res.status(response.status).json(data);
    }
    
    res.json(data);
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
}); 