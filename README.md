# Solar Panel Analysis Tool

A web application that analyzes rooftop solar potential using Google's Solar API. The application provides detailed insights about solar panel placement, energy production estimates, and environmental impact.

## Features

- Rooftop solar potential analysis
- Interactive 3D visualization of solar panel placement
- Real-time shading analysis
- Detailed statistics and environmental impact calculations
- Address auto-completion
- Responsive design

## Technologies Used

- React + TypeScript
- Vite
- Google Maps Platform (Maps JavaScript API, Solar API)
- TailwindCSS
- Express (for proxy server)

## Prerequisites

- Node.js (v14 or higher)
- Google Maps API key with the following APIs enabled:
  - Maps JavaScript API
  - Geocoding API
  - Places API
  - Solar API

## Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/Benoitcorvol/solar-pannel.git
   cd solar-pannel
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory with your Google Maps API key:
   ```
   VITE_GOOGLE_MAPS_API_KEY=your_api_key_here
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Start the proxy server:
   ```bash
   npm run server
   ```

## Usage

1. Enter an address in the search field
2. Wait for the analysis to complete
3. Explore different views:
   - Solar Analysis: View optimal panel placement
   - Shading Analysis: Analyze sun exposure throughout the day

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
