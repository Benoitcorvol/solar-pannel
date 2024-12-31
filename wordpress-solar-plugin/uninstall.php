<?php
// If uninstall is not called from WordPress, exit
if (!defined('WP_UNINSTALL_PLUGIN')) {
    exit;
}

// Clean up plugin data
$upload_dir = wp_upload_dir();
$plugin_upload_dir = $upload_dir['basedir'] . '/solar-panel-analysis';

// Remove plugin upload directory and its contents
if (is_dir($plugin_upload_dir)) {
    $files = glob($plugin_upload_dir . '/*');
    foreach ($files as $file) {
        if (is_file($file)) {
            unlink($file);
        }
    }
    rmdir($plugin_upload_dir);
}

// Remove plugin options
delete_option('solar_panel_analysis_settings');

<?php
// If uninstall is not called from WordPress, exit
if (!defined('WP_UNINSTALL_PLUGIN')) {
    exit;
}

// Clean up plugin data
$upload_dir = wp_upload_dir();
$plugin_upload_dir = $upload_dir['basedir'] . '/solar-panel-analysis';

// Remove plugin upload directory and its contents
if (file_exists($plugin_upload_dir)) {
    require_once(ABSPATH . 'wp-admin/includes/class-wp-filesystem-base.php');
    require_once(ABSPATH . 'wp-admin/includes/class-wp-filesystem-direct.php');
    
    $filesystem = new WP_Filesystem_Direct(null);
    $filesystem->rmdir($plugin_upload_dir, true);
}

// Remove any plugin options from the database
delete_option('solar_panel_analysis_settings');
