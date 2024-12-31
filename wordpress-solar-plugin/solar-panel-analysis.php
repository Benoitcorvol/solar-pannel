<?php
/**
 * Plugin Name: Solar Panel Analysis
 * Description: Integrates solar panel analysis tool using Google Maps Solar API
 * Version: 1.0.0
 * Author: Benoit
 */

// Prevent direct access to this file
if (!defined('ABSPATH')) {
    exit;
}

// Add shortcode
function solar_panel_analysis_shortcode($atts) {
    // Get the site URL
    $site_url = get_site_url();
    
    // Sanitize and validate the site URL
    $allowed_origin = esc_url($site_url);
    
    // Add security headers
    header("Content-Security-Policy: frame-ancestors 'self' " . $allowed_origin);
    
    // Return iframe HTML
    return '<iframe 
        src="' . plugin_dir_url(__FILE__) . 'app/index.html" 
        width="100%" 
        height="800" 
        frameborder="0" 
        id="solar-analysis-frame"
        allow="geolocation"
        sandbox="allow-scripts allow-forms allow-same-origin"
        style="width: 100%; max-width: 1200px; margin: 0 auto; display: block;"
    ></iframe>
    <script>
        window.addEventListener("message", function(event) {
            if (event.origin !== window.location.origin) return;
            
            if (event.data.type === "analysisComplete") {
                console.log("Analysis complete:", event.data.results);
                // Handle the results as needed
            } else if (event.data.type === "analysisError") {
                console.error("Analysis error:", event.data.message);
                // Handle the error as needed
            }
        }, false);

        function analyzeAddressFromWordPress(address) {
            document.getElementById("solar-analysis-frame").contentWindow.postMessage({
                type: "analyzeAddress",
                address: address
            }, window.location.origin);
        }
    </script>';
}
add_shortcode('solar_panel_analysis', 'solar_panel_analysis_shortcode');

// Add activation hook
function solar_panel_analysis_activate() {
    // Create necessary directories
    $upload_dir = wp_upload_dir();
    $plugin_upload_dir = $upload_dir['basedir'] . '/solar-panel-analysis';
    
    if (!file_exists($plugin_upload_dir)) {
        wp_mkdir_p($plugin_upload_dir);
    }
}
register_activation_hook(__FILE__, 'solar_panel_analysis_activate');

// Add deactivation hook
function solar_panel_analysis_deactivate() {
    // Cleanup if needed
}
register_deactivation_hook(__FILE__, 'solar_panel_analysis_deactivate');
