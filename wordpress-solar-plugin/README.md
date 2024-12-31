# Solar Panel Analysis WordPress Plugin

This plugin integrates a solar panel analysis tool into WordPress using the Google Maps Solar API.

## Installation

1. Upload the `solar-panel-analysis` folder to the `/wp-content/plugins/` directory
2. Activate the plugin through the 'Plugins' menu in WordPress
3. Place the shortcode `[solar_panel_analysis]` in any page or post where you want the solar analysis tool to appear

## Usage

Simply add the shortcode `[solar_panel_analysis]` to any page or post. The solar analysis tool will appear as an embedded iframe.

### Example Usage in Posts/Pages

```
[solar_panel_analysis]
```

### Example Usage in PHP Templates

```php
<?php echo do_shortcode('[solar_panel_analysis]'); ?>
```

## Configuration

1. Make sure your WordPress site is using HTTPS
2. Set up your Google Maps API key in the React application's .env file:
   ```
   VITE_GOOGLE_MAPS_API_KEY=your_api_key_here
   ```
3. Build the React application:
   ```bash
   npm run build
   ```
4. Copy the contents of the `dist` directory to the `app` directory in this plugin

## Security Features

The plugin implements several security measures:
- Content Security Policy (CSP) headers to prevent unauthorized iframe embedding
- Sandbox attributes for the iframe to limit functionality
- Origin validation for postMessage communication
- XSS protection through WordPress's built-in security functions
- HTTPS requirement for secure communication

## Requirements

- WordPress 5.0 or higher
- PHP 7.2 or higher
- HTTPS enabled
- Google Maps API key with Solar API access enabled
- Modern browser with JavaScript enabled

## Development

To work on the React application:

1. Clone the repository
2. Install dependencies: `npm install`
3. Create `.env` file with your Google Maps API key
4. Start development server: `npm run dev`
5. Build for production: `npm run build`

## Support

For support, please create an issue in the GitHub repository.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
