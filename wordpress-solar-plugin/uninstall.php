<?php
// If uninstall not called from WordPress, exit
if (!defined('WP_UNINSTALL_PLUGIN')) {
    exit;
}

// Call the uninstall function from the main plugin file
require_once plugin_dir_path(__FILE__) . 'solar-panel-analysis.php';
solar_panel_analysis_uninstall();

// Remove custom post type and its data
global $wpdb;
$wpdb->query("DELETE FROM {$wpdb->posts} WHERE post_type = 'solar_analysis'");
$wpdb->query("DELETE FROM {$wpdb->postmeta} WHERE post_id NOT IN (SELECT id FROM {$wpdb->posts})");

// Clear any transients and cached data
delete_transient('solar_panel_analysis_cache');
wp_cache_flush();

// Remove capabilities
$role = get_role('administrator');
if ($role) {
    $role->remove_cap('edit_solar_analysis');
    $role->remove_cap('delete_solar_analysis');
    $role->remove_cap('publish_solar_analysis');
    $role->remove_cap('edit_solar_analyses');
    $role->remove_cap('edit_others_solar_analyses');
    $role->remove_cap('delete_solar_analyses');
    $role->remove_cap('publish_solar_analyses');
    $role->remove_cap('read_private_solar_analyses');
}

// Clean up options
$wpdb->query("DELETE FROM {$wpdb->options} WHERE option_name LIKE 'solar_panel_analysis_%'");

// Flush rewrite rules
flush_rewrite_rules();
