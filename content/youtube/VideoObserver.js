/**
 * VideoObserver - YouTube Video Monitoring System
 * Handles video detection, monitoring, and processing
 */

class VideoObserver {
    constructor(mainOverlay) {
        this.overlay = mainOverlay;
        this.eventBus = mainOverlay.eventBus;
        this.state = mainOverlay.state;
        this.domWatcher = mainOverlay.domWatcher;
        this.caption = mainOverlay.caption;
        
        // Cache the video element
        this.videoElement = null;
        this.lastVideoCheck = 0;
    }

    getVideoId() {
        return this.domWatcher.getVideoId();
    }

    getVideoElement() {
        // Only re-query every 2 seconds max
        const now = Date.now();
        if (!this.videoElement || now - this.lastVideoCheck > 2000) {
            this.videoElement = document.querySelector('#movie_player video') || 
                            document.querySelector('.html5-main-video') ||
                            document.querySelector('video');
            this.lastVideoCheck = now;
        }
        return this.videoElement;
    }

    async checkCurrentVideo(shouldFetch = false) {
            try {
                const videoId = this.getVideoId();
                
                if (!videoId) {
                    console.log('[VideoObserver] No video ID found');
                    return;
                }

                if (videoId === this.state.getCurrentVideoId()) {
                    console.log('[VideoObserver] Same video, skipping');
                    return;
                }

                console.log(`[VideoObserver] 🎬 New video detected: ${videoId}`);
                this.state.setCurrentVideoId(videoId);

            // ONLY fetch if explicitly requested (when overlay enabled)
            if (shouldFetch) {
                await this.processVideo();
            }
            
        } catch (error) {
            console.error('[VideoObserver] Error checking video:', error);
        }
    }

    async processVideo() {
        try {
            console.log('[VideoObserver] 🔍 Processing video with yt-dlp server...');
            
            const videoId = this.getVideoId();
            console.log('[VideoObserver] 🔍 Got video ID:', videoId, 'Type:', typeof videoId);
            if (!videoId) {
                console.log('[VideoObserver] ❌ No video ID found');
                return;
            }
            
            // Use yt-dlp server for subtitle extraction
            console.log('[VideoObserver] 🚀 Calling yt-dlp server...');
            
            const success = await this.caption.fetchFromYtDlpServer(videoId);
            if (success) {
                console.log(`[VideoObserver] 🎉 SUCCESS with yt-dlp!`);
                this.overlay.notifyBackground('CAPTIONS_LOADED', null, success.count, success.language);
            } else {
                console.log('[VideoObserver] ❌ yt-dlp extraction failed');
                this.overlay.notifyBackground('CAPTION_FETCH_FAILED', 'yt-dlp extraction failed');
            }
            
        } catch (error) {
            console.error('[VideoObserver] Error processing video:', error);
            this.overlay.notifyBackground('CAPTION_FETCH_FAILED', error.message);
        }
    }
}