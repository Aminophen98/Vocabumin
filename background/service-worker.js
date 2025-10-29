/**
 * YouTube Subtitle Overlay - Service Worker
 * Handles background tasks, API calls, and extension lifecycle
 */

console.log('[Background] Service worker starting...');

// Extension lifecycle
chrome.runtime.onInstalled.addListener((details) => {
    console.log('[Background] Extension installed/updated:', details.reason);

    if (details.reason === 'install') {
        console.log('[Background] First time installation - opening onboarding');

        // Set default settings and onboarding flag
        chrome.storage.sync.set({
            needsOnboarding: true,
            overlayEnabled: true,
            theme: 'dark',
            fontSize: 'medium',
            // Don't set language preferences - force user to choose during onboarding
            // targetLanguage, definitionLevel, and sourceLanguage will be set by onboarding flow
        });

        // Open onboarding page in web app
        chrome.tabs.create({
            url: 'https://yourvocab.vercel.app/extension/onboarding'
        });
    }
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[Background] Received message:', request);
    
    if (request.type === 'CLEANUP') {
        this.cleanup();
        sendResponse({ success: true });
        return true;
    }

    if (request.type === 'CONTROL_SERVER') {
        console.log('[Background] Sending to native host:', request.command);
        
        chrome.runtime.sendNativeMessage(
            'com.ytsubtitle.launcher',
            { command: request.command },
            (response) => {
                console.log('[Background] Native response:', response);
                console.log('[Background] Last error:', chrome.runtime.lastError);
                
                if (chrome.runtime.lastError) {
                    sendResponse({ 
                        success: false, 
                        error: chrome.runtime.lastError.message 
                    });
                } else {
                    sendResponse({ success: true, ...response });
                }
            }
        );
        return true; // Keep channel open
    }
    
    switch (request.type) {
        case 'CAPTIONS_LOADED':
            handleCaptionsLoaded(request, sender);
            break;

        case 'CAPTION_FETCH_FAILED':
            handleCaptionFetchFailed(request, sender);
            break;

        case 'GET_SETTINGS':
            getExtensionSettings(sendResponse);
            return true; // Keep message channel open

        case 'UPDATE_SETTINGS':
            updateExtensionSettings(request.settings, sendResponse);
            return true;

        case 'ONBOARDING_COMPLETE':
            handleOnboardingComplete(request, sendResponse);
            return true;

        default:
            console.log('[Background] Unknown message type:', request.type);
    }


    if (request.type === 'CONTROL_SERVER') {
        chrome.runtime.sendNativeMessage(
            'com.ytsubtitle.launcher',
            { command: request.command },
            (response) => {
                if (chrome.runtime.lastError) {
                    sendResponse({ 
                        success: false, 
                        error: chrome.runtime.lastError.message 
                    });
                } else {
                    sendResponse({ success: true, ...response });
                }
            }
        );
        return true; // Keep channel open
    }

    // Add this to your message listener
    if (request.type === 'START_SERVER') {
    // Start server via native messaging
    chrome.runtime.sendNativeMessage(
        'com.ytsubtitle.launcher',
        { command: 'start' },
        (response) => {
            if (chrome.runtime.lastError) {
                sendResponse({ 
                    success: false, 
                    error: chrome.runtime.lastError.message 
                });
            } else {
                sendResponse({ 
                    success: true, 
                    ...response 
                });
            }
        }
    );
    return true; // Keep channel open
    }
});

/**
 * Handle successful caption loading
 */
function handleCaptionsLoaded(request, sender) {
    console.log(`[Background] Captions loaded for video ${request.videoId}: ${request.count} cues in ${request.language}`);
    
    // Update badge to show success
    chrome.action.setBadgeText({
        text: '✓',
        tabId: sender.tab.id
    });
    
    chrome.action.setBadgeBackgroundColor({
        color: '#4CAF50',
        tabId: sender.tab.id
    });
    
    // Store video info for popup
    chrome.storage.local.set({
        [`video_${request.videoId}`]: {
            captionCount: request.count,
            language: request.language,
            timestamp: Date.now()
        }
    });
}

/**
 * Handle caption fetch failures
 */
function handleCaptionFetchFailed(request, sender) {
    console.log(`[Background] Caption fetch failed for video ${request.videoId}: ${request.error}`);
    
    // Update badge to show error
    chrome.action.setBadgeText({
        text: '!',
        tabId: sender.tab.id
    });
    
    chrome.action.setBadgeBackgroundColor({
        color: '#F44336',
        tabId: sender.tab.id
    });
}

/**
 * Handle onboarding completion
 */
async function handleOnboardingComplete(request, sendResponse) {
    try {
        console.log('[Background] Onboarding completed with settings:', request.settings);

        // Save settings from onboarding
        await chrome.storage.sync.set({
            needsOnboarding: false,
            ...request.settings
        });

        console.log('[Background] Onboarding settings saved successfully');
        sendResponse({ success: true });
    } catch (error) {
        console.error('[Background] Error saving onboarding settings:', error);
        sendResponse({ success: false, error: error.message });
    }
}

/**
 * Get extension settings
 */
async function getExtensionSettings(sendResponse) {
    try {
        const settings = await chrome.storage.sync.get([
            'overlayEnabled',
            'theme',
            'fontSize',
            'preferredLanguage',
            'savedWords'
        ]);
        
        // Provide defaults for missing settings
        const defaultSettings = {
            overlayEnabled: true,
            theme: 'dark',
            fontSize: 'medium',
            preferredLanguage: 'en',
            savedWords: []
        };
        
        const completeSettings = { ...defaultSettings, ...settings };
        console.log('[Background] Sending settings:', completeSettings);
        
        sendResponse({ success: true, settings: completeSettings });
    } catch (error) {
        console.error('[Background] Error getting settings:', error);
        sendResponse({ success: false, error: error.message });
    }
}

/**
 * Update extension settings
 */
async function updateExtensionSettings(newSettings, sendResponse) {
    try {
        await chrome.storage.sync.set(newSettings);
        console.log('[Background] Settings updated:', newSettings);
        
        sendResponse({ success: true });
    } catch (error) {
        console.error('[Background] Error updating settings:', error);
        sendResponse({ success: false, error: error.message });
    }
}

// Handle tab updates to clear badges when leaving YouTube
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        if (!tab.url.includes('youtube.com/watch')) {
            // Clear badge when leaving YouTube videos
            chrome.action.setBadgeText({
                text: '',
                tabId: tabId
            });
        }
    }
});

// Keep service worker alive with periodic tasks
let keepAliveInterval;

function startKeepAlive() {
    keepAliveInterval = setInterval(() => {
        console.log('[Background] Keep alive ping');
    }, 25000); // Every 25 seconds
}

function stopKeepAlive() {
    if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
        keepAliveInterval = null;
    }
}

// Start keep alive
startKeepAlive();

// Clean up on suspension
chrome.runtime.onSuspend.addListener(() => {
    console.log('[Background] Service worker suspending...');
    stopKeepAlive();

    // Send cleanup message to all tabs
    chrome.tabs.query({ url: "*://www.youtube.com/*" }, (tabs) => {
        tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, { type: 'CLEANUP' });
        });
    });
});

console.log('[Background] Service worker ready!');