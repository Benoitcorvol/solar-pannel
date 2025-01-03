<?php
/**
 * Plugin Name: Solar Panel Analysis
 * Plugin URI: https://example.com/solar-panel-analysis
 * Description: A secure solar potential analysis system that integrates with Google Maps Solar API
 * Version: 1.0.0
 * Author: Benoit
 * Author URI: https://example.com
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: solar-panel-analysis
 * Domain Path: /languages
 */

// Prevent direct access to this file
if (!defined('ABSPATH')) {
    exit;
}

// Define plugin constants
define('SOLAR_PANEL_ANALYSIS_VERSION', '1.0.0');
define('SOLAR_PANEL_ANALYSIS_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('SOLAR_PANEL_ANALYSIS_PLUGIN_URL', plugin_dir_url(__FILE__));

// Load plugin textdomain
function solar_panel_analysis_load_textdomain() {
    load_plugin_textdomain('solar-panel-analysis', false, dirname(plugin_basename(__FILE__)) . '/languages');
}
add_action('plugins_loaded', 'solar_panel_analysis_load_textdomain');

// Get API keys and credentials from wp-config.php or database
function solar_panel_analysis_get_api_keys() {
    $options = get_option('solar_panel_analysis_options', array());
    
    return array(
        'google_maps' => defined('SOLAR_PANEL_ANALYSIS_GOOGLE_MAPS_KEY') 
            ? SOLAR_PANEL_ANALYSIS_GOOGLE_MAPS_KEY 
            : ($options['google_maps_key'] ?? ''),
            
        'electricity' => defined('SOLAR_PANEL_ANALYSIS_ELECTRICITY_KEY') 
            ? SOLAR_PANEL_ANALYSIS_ELECTRICITY_KEY 
            : ($options['electricity_key'] ?? ''),
            
        'monday' => array(
            'client_id' => defined('SOLAR_PANEL_ANALYSIS_MONDAY_CLIENT_ID') 
                ? SOLAR_PANEL_ANALYSIS_MONDAY_CLIENT_ID 
                : ($options['monday_client_id'] ?? ''),
                
            'client_secret' => defined('SOLAR_PANEL_ANALYSIS_MONDAY_CLIENT_SECRET') 
                ? SOLAR_PANEL_ANALYSIS_MONDAY_CLIENT_SECRET 
                : ($options['monday_client_secret'] ?? ''),
                
            'signing_secret' => defined('SOLAR_PANEL_ANALYSIS_MONDAY_SIGNING_SECRET') 
                ? SOLAR_PANEL_ANALYSIS_MONDAY_SIGNING_SECRET 
                : ($options['monday_signing_secret'] ?? ''),
                
            'app_id' => defined('SOLAR_PANEL_ANALYSIS_MONDAY_APP_ID') 
                ? SOLAR_PANEL_ANALYSIS_MONDAY_APP_ID 
                : ($options['monday_app_id'] ?? ''),
                
            'board_id' => defined('SOLAR_PANEL_ANALYSIS_MONDAY_BOARD_ID') 
                ? SOLAR_PANEL_ANALYSIS_MONDAY_BOARD_ID 
                : ($options['monday_board_id'] ?? '')
        )
    );
}

// Register admin menu if any API key is not defined in wp-config.php
function solar_panel_analysis_admin_menu() {
    // Show settings page if any API key is not defined in wp-config.php
    if (!defined('SOLAR_PANEL_ANALYSIS_GOOGLE_MAPS_KEY') ||
        !defined('SOLAR_PANEL_ANALYSIS_ELECTRICITY_KEY') ||
        !defined('SOLAR_PANEL_ANALYSIS_MONDAY_CLIENT_ID') ||
        !defined('SOLAR_PANEL_ANALYSIS_MONDAY_CLIENT_SECRET') ||
        !defined('SOLAR_PANEL_ANALYSIS_MONDAY_SIGNING_SECRET') ||
        !defined('SOLAR_PANEL_ANALYSIS_MONDAY_APP_ID') ||
        !defined('SOLAR_PANEL_ANALYSIS_MONDAY_BOARD_ID')) {
        
        add_options_page(
            __('Solar Panel Analysis Settings', 'solar-panel-analysis'),
            __('Solar Panel Analysis', 'solar-panel-analysis'),
            'manage_options',
            'solar-panel-analysis',
            'solar_panel_analysis_settings_page'
        );
    }
}
add_action('admin_menu', 'solar_panel_analysis_admin_menu');

// Register settings and add settings sections/fields
function solar_panel_analysis_register_settings() {
    // Register settings group with validation callback
    register_setting(
        'solar_panel_analysis_options',
        'solar_panel_analysis_options',
        array(
            'type' => 'array',
            'description' => 'Solar Panel Analysis API Keys and Settings',
            'sanitize_callback' => 'solar_panel_analysis_sanitize_options',
            'show_in_rest' => false,
            'default' => array()
        )
    );

    // Only add sections if there are fields to display in them
    $has_maps_fields = !defined('SOLAR_PANEL_ANALYSIS_GOOGLE_MAPS_KEY');
    $has_electricity_fields = !defined('SOLAR_PANEL_ANALYSIS_ELECTRICITY_KEY');
    $has_monday_fields = !defined('SOLAR_PANEL_ANALYSIS_MONDAY_CLIENT_ID') ||
                        !defined('SOLAR_PANEL_ANALYSIS_MONDAY_CLIENT_SECRET') ||
                        !defined('SOLAR_PANEL_ANALYSIS_MONDAY_SIGNING_SECRET') ||
                        !defined('SOLAR_PANEL_ANALYSIS_MONDAY_APP_ID') ||
                        !defined('SOLAR_PANEL_ANALYSIS_MONDAY_BOARD_ID');

    if ($has_maps_fields) {
        add_settings_section(
            'solar_panel_maps_section',
            __('Google Maps Settings', 'solar-panel-analysis'),
            'solar_panel_maps_section_callback',
            'solar_panel_analysis'
        );
    }

    if ($has_electricity_fields) {
        add_settings_section(
            'solar_panel_electricity_section',
            __('Electricity Rates Settings', 'solar-panel-analysis'),
            'solar_panel_electricity_section_callback',
            'solar_panel_analysis'
        );
    }

    if ($has_monday_fields) {
        add_settings_section(
            'solar_panel_monday_section',
            __('Monday.com Integration', 'solar-panel-analysis'),
            'solar_panel_monday_section_callback',
            'solar_panel_analysis'
        );
    }

    // Add settings fields
    if (!defined('SOLAR_PANEL_ANALYSIS_GOOGLE_MAPS_KEY')) {
        add_settings_field(
            'google_maps_key',
            __('Google Maps API Key', 'solar-panel-analysis'),
            'solar_panel_text_field_callback',
            'solar_panel_analysis',
            'solar_panel_maps_section',
            array(
                'label_for' => 'google_maps_key',
                'description' => __('Enter your Google Maps API key with Solar API access enabled', 'solar-panel-analysis')
            )
        );
    }

    if (!defined('SOLAR_PANEL_ANALYSIS_ELECTRICITY_KEY')) {
        add_settings_field(
            'electricity_key',
            __('Electricity Rates API Key', 'solar-panel-analysis'),
            'solar_panel_text_field_callback',
            'solar_panel_analysis',
            'solar_panel_electricity_section',
            array(
                'label_for' => 'electricity_key',
                'description' => __('Enter your Electricity Rates API key', 'solar-panel-analysis')
            )
        );
    }

    if (!defined('SOLAR_PANEL_ANALYSIS_MONDAY_CLIENT_ID')) {
        add_settings_field(
            'monday_client_id',
            __('Client ID', 'solar-panel-analysis'),
            'solar_panel_text_field_callback',
            'solar_panel_analysis',
            'solar_panel_monday_section',
            array('label_for' => 'monday_client_id')
        );
    }

    if (!defined('SOLAR_PANEL_ANALYSIS_MONDAY_CLIENT_SECRET')) {
        add_settings_field(
            'monday_client_secret',
            __('Client Secret', 'solar-panel-analysis'),
            'solar_panel_password_field_callback',
            'solar_panel_analysis',
            'solar_panel_monday_section',
            array('label_for' => 'monday_client_secret')
        );
    }

    if (!defined('SOLAR_PANEL_ANALYSIS_MONDAY_SIGNING_SECRET')) {
        add_settings_field(
            'monday_signing_secret',
            __('Signing Secret', 'solar-panel-analysis'),
            'solar_panel_password_field_callback',
            'solar_panel_analysis',
            'solar_panel_monday_section',
            array('label_for' => 'monday_signing_secret')
        );
    }

    if (!defined('SOLAR_PANEL_ANALYSIS_MONDAY_APP_ID')) {
        add_settings_field(
            'monday_app_id',
            __('App ID', 'solar-panel-analysis'),
            'solar_panel_text_field_callback',
            'solar_panel_analysis',
            'solar_panel_monday_section',
            array('label_for' => 'monday_app_id')
        );
    }

    if (!defined('SOLAR_PANEL_ANALYSIS_MONDAY_BOARD_ID')) {
        add_settings_field(
            'monday_board_id',
            __('Board ID', 'solar-panel-analysis'),
            'solar_panel_text_field_callback',
            'solar_panel_analysis',
            'solar_panel_monday_section',
            array('label_for' => 'monday_board_id')
        );
    }
}

// Section callbacks
function solar_panel_maps_section_callback() {
    echo '<p>' . __('Configure your Google Maps API settings.', 'solar-panel-analysis') . '</p>';
}

function solar_panel_electricity_section_callback() {
    echo '<p>' . __('Configure your Electricity Rates API settings.', 'solar-panel-analysis') . '</p>';
}

function solar_panel_monday_section_callback() {
    echo '<p>' . __('Configure your Monday.com integration settings.', 'solar-panel-analysis') . '</p>';
}

// Field callbacks
function solar_panel_text_field_callback($args) {
    $options = get_option('solar_panel_analysis_options', array());
    $value = isset($options[$args['label_for']]) ? $options[$args['label_for']] : '';
    ?>
    <input type="text" 
           id="<?php echo esc_attr($args['label_for']); ?>"
           name="solar_panel_analysis_options[<?php echo esc_attr($args['label_for']); ?>]"
           value="<?php echo esc_attr($value); ?>"
           class="regular-text"
    />
    <?php
    if (isset($args['description'])) {
        echo '<p class="description">' . esc_html($args['description']) . '</p>';
    }
}

function solar_panel_password_field_callback($args) {
    $options = get_option('solar_panel_analysis_options', array());
    $value = isset($options[$args['label_for']]) ? $options[$args['label_for']] : '';
    ?>
    <input type="password" 
           id="<?php echo esc_attr($args['label_for']); ?>"
           name="solar_panel_analysis_options[<?php echo esc_attr($args['label_for']); ?>]"
           value="<?php echo esc_attr($value); ?>"
           class="regular-text"
    />
    <?php
}
// Sanitize options before saving
function solar_panel_analysis_sanitize_options($input) {
    $sanitized_input = array();
    
    // List of expected fields
    $text_fields = array(
        'google_maps_key',
        'electricity_key',
        'monday_client_id',
        'monday_app_id',
        'monday_board_id'
    );
    
    $password_fields = array(
        'monday_client_secret',
        'monday_signing_secret'
    );
    
    // Sanitize text fields
    foreach ($text_fields as $field) {
        if (isset($input[$field])) {
            $sanitized_input[$field] = sanitize_text_field($input[$field]);
        }
    }
    
    // Sanitize password fields
    foreach ($password_fields as $field) {
        if (isset($input[$field])) {
            $sanitized_input[$field] = sanitize_text_field($input[$field]);
        }
    }
    
    return $sanitized_input;
}

add_action('admin_init', 'solar_panel_analysis_register_settings');

// Admin settings page
function solar_panel_analysis_settings_page() {
    if (!current_user_can('manage_options')) {
        return;
    }

    // Show which keys are configured in wp-config.php
    $wp_config_keys = array();
    if (defined('SOLAR_PANEL_ANALYSIS_GOOGLE_MAPS_KEY')) {
        $wp_config_keys[] = 'Google Maps API Key';
    }
    if (defined('SOLAR_PANEL_ANALYSIS_ELECTRICITY_KEY')) {
        $wp_config_keys[] = 'Electricity Rates API Key';
    }
    if (defined('SOLAR_PANEL_ANALYSIS_MONDAY_CLIENT_ID')) {
        $wp_config_keys[] = 'Monday.com Client ID';
    }
    if (defined('SOLAR_PANEL_ANALYSIS_MONDAY_CLIENT_SECRET')) {
        $wp_config_keys[] = 'Monday.com Client Secret';
    }
    if (defined('SOLAR_PANEL_ANALYSIS_MONDAY_SIGNING_SECRET')) {
        $wp_config_keys[] = 'Monday.com Signing Secret';
    }
    if (defined('SOLAR_PANEL_ANALYSIS_MONDAY_APP_ID')) {
        $wp_config_keys[] = 'Monday.com App ID';
    }
    if (defined('SOLAR_PANEL_ANALYSIS_MONDAY_BOARD_ID')) {
        $wp_config_keys[] = 'Monday.com Board ID';
    }

    if (!empty($wp_config_keys)) {
        ?>
        <div class="notice notice-info">
            <p><?php _e('The following keys are configured in wp-config.php:', 'solar-panel-analysis'); ?></p>
            <ul style="list-style-type: disc; margin-left: 20px;">
                <?php foreach ($wp_config_keys as $key) : ?>
                    <li><?php echo esc_html($key); ?></li>
                <?php endforeach; ?>
            </ul>
            <p><?php _e('These settings cannot be modified here. Other keys can be configured below.', 'solar-panel-analysis'); ?></p>
        </div>
        <?php
    }

    if (isset($_GET['settings-updated'])) {
        add_settings_error('solar_panel_analysis_messages', 'solar_panel_analysis_message', 
            __('Settings Saved', 'solar-panel-analysis'), 'updated');
    }
    ?>
    <div class="wrap">
        <h1><?php echo esc_html(get_admin_page_title()); ?></h1>
        <div class="notice notice-warning">
            <p><?php _e('For better security, consider defining your API keys in wp-config.php. Example:', 'solar-panel-analysis'); ?></p>
            <code>
                <?php if (!defined('SOLAR_PANEL_ANALYSIS_GOOGLE_MAPS_KEY')) : ?>
                    define('SOLAR_PANEL_ANALYSIS_GOOGLE_MAPS_KEY', 'your-google-maps-key');<br>
                <?php endif; ?>
                <?php if (!defined('SOLAR_PANEL_ANALYSIS_ELECTRICITY_KEY')) : ?>
                    define('SOLAR_PANEL_ANALYSIS_ELECTRICITY_KEY', 'your-electricity-api-key');<br>
                <?php endif; ?>
                <?php if (!defined('SOLAR_PANEL_ANALYSIS_MONDAY_CLIENT_ID')) : ?>
                    define('SOLAR_PANEL_ANALYSIS_MONDAY_CLIENT_ID', 'your-monday-client-id');<br>
                <?php endif; ?>
                <?php if (!defined('SOLAR_PANEL_ANALYSIS_MONDAY_CLIENT_SECRET')) : ?>
                    define('SOLAR_PANEL_ANALYSIS_MONDAY_CLIENT_SECRET', 'your-monday-client-secret');<br>
                <?php endif; ?>
                <?php if (!defined('SOLAR_PANEL_ANALYSIS_MONDAY_SIGNING_SECRET')) : ?>
                    define('SOLAR_PANEL_ANALYSIS_MONDAY_SIGNING_SECRET', 'your-monday-signing-secret');<br>
                <?php endif; ?>
                <?php if (!defined('SOLAR_PANEL_ANALYSIS_MONDAY_APP_ID')) : ?>
                    define('SOLAR_PANEL_ANALYSIS_MONDAY_APP_ID', 'your-monday-app-id');<br>
                <?php endif; ?>
                <?php if (!defined('SOLAR_PANEL_ANALYSIS_MONDAY_BOARD_ID')) : ?>
                    define('SOLAR_PANEL_ANALYSIS_MONDAY_BOARD_ID', 'your-monday-board-id');<br>
                <?php endif; ?>
            </code>
        </div>
        <?php settings_errors('solar_panel_analysis_messages'); ?>
        <form action="options.php" method="post">
            <?php
            settings_fields('solar_panel_analysis_options');
            do_settings_sections('solar_panel_analysis');
            submit_button();
            ?>
        </form>
    </div>
    <?php
}

// Add shortcode
function solar_panel_analysis_shortcode($atts) {
    // Get API keys and credentials
    $api_keys = solar_panel_analysis_get_api_keys();
    if (empty($api_keys['google_maps'])) {
        return '<div class="error">' . 
            __('Please configure the Google Maps API key in wp-config.php or plugin settings.', 'solar-panel-analysis') . 
            '</div>';
    }

    // Get the site URL
    $site_url = get_site_url();
    
    // Sanitize and validate the site URL
    $allowed_origin = esc_url($site_url);
    
    // Add security headers
    header("Content-Security-Policy: frame-ancestors 'self' " . $allowed_origin);
    header("X-Frame-Options: SAMEORIGIN");
    header("X-Content-Type-Options: nosniff");
    
    // Enqueue necessary scripts
    wp_enqueue_script('solar-panel-analysis-integration', 
        SOLAR_PANEL_ANALYSIS_PLUGIN_URL . 'js/integration.js',
        array('jquery'),
        SOLAR_PANEL_ANALYSIS_VERSION,
        true
    );

    wp_localize_script('solar-panel-analysis-integration', 'solarPanelAnalysis', array(
        'ajaxUrl' => admin_url('admin-ajax.php'),
        'nonce' => wp_create_nonce('solar_panel_analysis_nonce'),
        'apiKeys' => array(
            'googleMaps' => $api_keys['google_maps'],
            'electricity' => $api_keys['electricity'],
            'monday' => $api_keys['monday']
        )
    ));
    
    // Return iframe HTML with enhanced security
    return sprintf(
        '<div class="solar-panel-analysis-container">
            <iframe 
                src="%s" 
                width="100%%" 
                height="800" 
                frameborder="0" 
                id="solar-analysis-frame"
                allow="geolocation"
                sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                style="width: 100%%; max-width: 1200px; margin: 0 auto; display: block;"
                title="%s"
            ></iframe>
        </div>',
        esc_url(SOLAR_PANEL_ANALYSIS_PLUGIN_URL . 'app/index.html'),
        esc_attr__('Solar Panel Analysis Tool', 'solar-panel-analysis')
    );
}
add_shortcode('solar_panel_analysis', 'solar_panel_analysis_shortcode');

// AJAX handler for saving settings
function solar_panel_analysis_save_settings() {
    check_ajax_referer('solar_panel_analysis_nonce', 'nonce');
    
    if (!current_user_can('manage_options')) {
        wp_send_json_error('Unauthorized');
        return;
    }
    
    $settings = array();
    if (isset($_POST['settings']) && is_array($_POST['settings'])) {
        foreach ($_POST['settings'] as $key => $value) {
            $settings[sanitize_key($key)] = sanitize_text_field($value);
        }
    }
    
    update_option('solar_panel_analysis_options', $settings);
    wp_send_json_success('Settings saved successfully');
}
add_action('wp_ajax_solar_panel_analysis_save_settings', 'solar_panel_analysis_save_settings');

// Activation hook
function solar_panel_analysis_activate() {
    // Create default options if they don't exist
    if (!get_option('solar_panel_analysis_options')) {
        add_option('solar_panel_analysis_options', array(
            'google_maps_key' => '',
            'electricity_key' => '',
            'monday_client_id' => '',
            'monday_client_secret' => '',
            'monday_signing_secret' => '',
            'monday_app_id' => '',
            'monday_board_id' => ''
        ));
    }
    
    // Flush rewrite rules
    flush_rewrite_rules();
}
register_activation_hook(__FILE__, 'solar_panel_analysis_activate');

// Deactivation hook
function solar_panel_analysis_deactivate() {
    // Flush rewrite rules
    flush_rewrite_rules();
}
register_deactivation_hook(__FILE__, 'solar_panel_analysis_deactivate');

// Initialize plugin
function solar_panel_analysis_init() {
    // Register scripts and styles if needed
    if (!is_admin()) {
        wp_register_style(
            'solar-panel-analysis-styles',
            SOLAR_PANEL_ANALYSIS_PLUGIN_URL . 'app/assets/index-gX0BdSyz.css',
            array(),
            SOLAR_PANEL_ANALYSIS_VERSION
        );
        
        wp_register_script(
            'solar-panel-analysis-script',
            SOLAR_PANEL_ANALYSIS_PLUGIN_URL . 'app/assets/index-icA25Uny.js',
            array(),
            SOLAR_PANEL_ANALYSIS_VERSION,
            true
        );
    }
}
add_action('init', 'solar_panel_analysis_init');

// Enqueue scripts and styles
function solar_panel_analysis_enqueue_scripts() {
    if (!is_admin()) {
        wp_enqueue_style('solar-panel-analysis-styles');
        wp_enqueue_script('solar-panel-analysis-script');
        
        // Localize script with necessary data
        wp_localize_script('solar-panel-analysis-script', 'solarPanelAnalysisData', array(
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('solar_panel_analysis_nonce'),
            'pluginUrl' => SOLAR_PANEL_ANALYSIS_PLUGIN_URL,
            'apiKeys' => solar_panel_analysis_get_api_keys()
        ));
    }
}
add_action('wp_enqueue_scripts', 'solar_panel_analysis_enqueue_scripts');
