class DOMWatcher {
    constructor(eventBus, state) {
        this.eventBus = eventBus;
        this.state = state;
    }

    waitForYouTube() {
        return new Promise((resolve) => {
            let attempts = 0;
            const checkReady = () => {
                attempts++;
                
                // NEW: More lenient ready check
                const videoElement = document.querySelector('video');
                const hasVideoId = this.getVideoId();
                const hasPlayer = document.querySelector('#movie_player');
                
                // Ready if we have video element AND video ID
                if (videoElement && hasVideoId) {
                    console.log(`[YT Overlay]  Quick ready! Video element found after ${attempts} attempts (${attempts * 250}ms)`);
                    resolve();
                    return;
                }
                
                // Also ready if we have the player container
                if (hasPlayer && hasVideoId) {
                    console.log(`[YT Overlay]  Player ready after ${attempts} attempts`);
                    resolve();
                    return;
                }
                
                // Timeout after 2.5 seconds (down from 10 seconds)
                if (attempts > 10) {
                    console.log('[YT Overlay] Timeout waiting for YouTube (proceeding anyway)');
                    resolve();
                } else {
                    setTimeout(checkReady, 250); // Check every 250ms (down from 500ms)
                }
            };
            checkReady();
        });
    }

    setupVideoMonitoring() {
        console.log('[YT Overlay] Video monitoring handled by EventBus');
    }

    setupPlayerButtonObserver(playerButtonSetupCallback) {
        // Button observer removed - button is injected once and persists
        // No need for aggressive re-injection
    }

    setupPlayButtonListener() {
        const video = document.querySelector('video');
        this.eventBus.setupPlayButtonListener(video);
    }

    getVideoId() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const videoId = urlParams.get('v');
            console.log('[DOMWatcher] 🔍 Getting video ID from URL:', window.location.href);
            console.log('[DOMWatcher] 🎯 Extracted video ID:', videoId);
            return videoId;
        } catch (error) {
            console.error('[YT Overlay] Error getting video ID:', error);
            return null;
        }
    }
}