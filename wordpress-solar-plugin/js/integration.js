jQuery(document).ready(function($) {
    'use strict';

    // Initialize communication with iframe
    const frame = document.getElementById('solar-analysis-frame');
    if (!frame) {
        console.error('Solar analysis frame not found');
        return;
    }

    // Function to initialize the frame with API keys and credentials
    function initializeFrame() {
        if (!solarPanelAnalysis || !solarPanelAnalysis.apiKeys) {
            console.error('API keys not configured');
            return;
        }

        // Validate required API keys
        if (!solarPanelAnalysis.apiKeys.googleMaps) {
            console.error('Google Maps API key not configured');
            return;
        }

        // Send API keys and credentials to iframe
        frame.contentWindow.postMessage({
            type: 'init',
            apiKeys: {
                googleMaps: solarPanelAnalysis.apiKeys.googleMaps,
                electricity: solarPanelAnalysis.apiKeys.electricity,
                monday: solarPanelAnalysis.apiKeys.monday
            }
        }, '*');

        console.log('API keys sent to iframe');
    }
    
    // Handle messages from the iframe
    window.addEventListener('message', function(event) {
        // For security, we should check the origin
        // But since we're using '*' in the iframe, we'll validate the data instead
        
        if (!event.data || !event.data.type) {
            return;
        }
        
        switch (event.data.type) {
            case 'ready':
                // Iframe is ready, send the API key
                initializeFrame();
                break;
                
            case 'analysisComplete':
                handleAnalysisComplete(event.data.results);
                break;
                
            case 'analysisError':
                handleAnalysisError(event.data.message);
                break;
        }
    });

    // Handle successful analysis
    function handleAnalysisComplete(results) {
        // Save results via AJAX
        $.ajax({
            url: solarPanelAnalysis.ajaxUrl,
            type: 'POST',
            data: {
                action: 'solar_panel_analysis_save_results',
                nonce: solarPanelAnalysis.nonce,
                results: JSON.stringify(results),
                monday: {
                    boardId: solarPanelAnalysis.apiKeys.monday.boardId,
                    itemName: results.address // Use the analyzed address as the item name
                }
            },
            success: function(response) {
                if (response.success) {
                    console.log('Analysis results saved successfully');
                    // Trigger custom event for extensibility
                    $(document).trigger('solarAnalysisComplete', [results]);
                } else {
                    console.error('Failed to save analysis results:', response.data);
                }
            },
            error: function(xhr, status, error) {
                console.error('AJAX error:', error);
            }
        });
    }

    // Handle analysis errors
    function handleAnalysisError(message) {
        console.error('Solar analysis error:', message);
        // Trigger custom event for extensibility
        $(document).trigger('solarAnalysisError', [message]);
    }

    // Expose public API for extensibility
    window.SolarPanelAnalysis = {
        analyze: function(address) {
            if (!frame) {
                console.error('Solar analysis frame not found');
                return;
            }
            
            frame.contentWindow.postMessage({
                type: 'analyzeAddress',
                address: address
            }, '*');
        },
        
        // Add event listeners for custom events
        on: function(eventName, callback) {
            $(document).on(eventName, callback);
        },
        
        // Remove event listeners
        off: function(eventName, callback) {
            $(document).off(eventName, callback);
        }
    };

    // Initialize when iframe loads
    frame.addEventListener('load', function() {
        console.log('Solar analysis frame loaded');
        // The iframe will send a 'ready' message when it's ready to receive the API key
    });
});
