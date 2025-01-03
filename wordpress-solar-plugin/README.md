# Solar Panel Analysis WordPress Plugin

A secure WordPress plugin for analyzing solar potential using various APIs including Google Maps Solar API, Electricity Rates API, and Monday.com integration.

## Configuration

### API Keys and Credentials

For security, it's recommended to define your API keys and credentials in your `wp-config.php` file:

```php
// Google Maps API Key (required)
define('SOLAR_PANEL_ANALYSIS_GOOGLE_MAPS_KEY', 'your-google-maps-key');

// Electricity Rates API Key
define('SOLAR_PANEL_ANALYSIS_ELECTRICITY_KEY', 'your-electricity-api-key');

// Monday.com Integration
define('SOLAR_PANEL_ANALYSIS_MONDAY_CLIENT_ID', 'your-monday-client-id');
define('SOLAR_PANEL_ANALYSIS_MONDAY_CLIENT_SECRET', 'your-monday-client-secret');
define('SOLAR_PANEL_ANALYSIS_MONDAY_SIGNING_SECRET', 'your-monday-signing-secret');
define('SOLAR_PANEL_ANALYSIS_MONDAY_APP_ID', 'your-monday-app-id');
define('SOLAR_PANEL_ANALYSIS_MONDAY_BOARD_ID', 'your-monday-board-id');
```

Alternatively, you can configure these values in the WordPress admin panel under Settings > Solar Panel Analysis.

### Installation & Updates

#### New Installation
1. Install and activate the plugin
2. Configure your API keys either in wp-config.php or through the settings page
3. Add the shortcode `[solar_panel_analysis]` to any page or post where you want the solar analysis tool to appear

#### Updating Existing Installation
You can safely update the plugin without losing your API keys or settings:
1. If your API keys are in wp-config.php, they will be preserved
2. If your API keys are in WordPress settings, they will be preserved
3. Simply replace the plugin files with the new version
4. No need to deactivate or uninstall the plugin

Note: It's recommended to backup your wp-config.php file if you store your API keys there before updating.

### Security Features

- API keys and credentials can be stored securely in wp-config.php
- Sensitive credentials are stored as password fields in the WordPress admin
- All API requests are made server-side through WordPress
- Implements proper nonce verification for AJAX requests
- Sets security headers for iframe integration
- Sanitizes and validates all inputs and outputs

### Required APIs

1. **Google Maps API**
   - Enable Maps JavaScript API
   - Enable Solar API
   - Create API key with appropriate restrictions
   - Example key format: AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

2. **Electricity Rates API**
   - Sign up at https://api.electricityrates.eu
   - Generate API key
   - Example key format: XXXX|XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

3. **Monday.com Integration**
   - Create a Monday.com account
   - Create a new app in the Monday.com marketplace
   - Configure OAuth credentials
   - Create a board for solar analysis results
   - Example credentials format:
     * Client ID: XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
     * Client Secret: XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
     * Signing Secret: XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
     * App ID: XXXXXXXXXX
     * Board ID: XXXXXXXXXX

### Support

For support or feature requests, please open an issue in the plugin repository.
