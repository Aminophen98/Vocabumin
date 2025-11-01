/**
 * YouTube Subtitle Overlay - Complete Single File Version
 * All-in-one content script with inline caption extraction
 */

class YouTubeSubtitleOverlay {

    // Core & Initialization

    constructor() {
        // 1. Core systems first
        this.logger = new Logger('YT-Overlay');
        this.eventBus = new EventBus();
        this.state = new StateManager();
        this.notifications = new NotificationService(this.logger);
        
        // 2. Services (with dependencies)
        this.serverManager = new ServerConnectionManager(this.logger);
        this.storage = new StorageManagement(this.state, this.logger);
        this.AI = new AIService(this.storage, this.logger, this.notifications);
        
        // 3. Caption needs state, serverManager, logger, and notifications
        this.caption = new Caption(this.state, this.serverManager, this.logger, this.notifications);
        
        // 4. DOM/Video observers
        this.domWatcher = new DOMWatcher(this.eventBus, this.state);
        this.videoObserver = new VideoObserver(this);
        
        // 5. UI components last (they need everything else)
        this.player = new PlayerIntegration(this, this.logger);
        this.tooltip = new Tooltip(this);
        this.statsOverlay = new StatsOverlay(this);

        // 6. Setup and init
        this.setupEventHandlers();
        this.init();

        // Debounce tracking
        this.lastWordClick = 0;
        this.clickDebounceMs = 300;
        this.pendingAnalysis = new Map();
    }

    setupEventHandlers() {
        // Handle VocabAuth messages
        this.eventBus.on('vocabAuth', async (data) => {
            await chrome.storage.sync.set({
                vocabToken: data.token,
                vocabUserId: data.userId,
                vocabEmail: data.email
            });
            alert('✅ Extension connected to Vocaminary!');
            window.close();
        });

        // Handle URL changes
        this.eventBus.on('urlChange', (currentUrl) => {
            const urlParams = new URLSearchParams(currentUrl.split('?')[1]);
            const videoId = urlParams.get('v');

            if (videoId && videoId !== this.state.getCurrentVideoId()) {
                this.state.setCurrentVideoId(videoId);
                this.logger.debug('New video ID stored:', videoId);

                // Turn off overlay when navigating to a new video
                if (this.state.isOverlayActive()) {
                    this.logger.debug('New video detected, turning off overlay...');
                    this.player.stopCaptionSync();
                    this.player.hideOverlay();
                    this.state.setActive(false);
                }

                // Always update button visual state to idle for new video
                const button = document.querySelector('#yt-subtitle-overlay-btn');
                if (button) {
                    this.player.updatePlayerButton(button, 'idle');
                }

                // Clear captions for the new video
                this.state.setParsedCaptions([]);
                this.state.setCurrentCaptionIndex(-1);
            }
        });

        // Handle leaving YouTube
        this.eventBus.on('leftYouTube', () => {
            this.cleanup();
        });

        // Handle leaving video page
        this.eventBus.on('leftVideoPage', () => {
            this.logger.debug('Left video page');
            if (this.state.isOverlayActive()) {
                this.player.stopCaptionSync();
                this.player.hideOverlay();
                this.state.setActive(false);
            }
            // Clear video state
            this.state.setCurrentVideoId(null);
            this.state.setParsedCaptions([]);
        });

        // Handle video play events
        this.eventBus.on('videoPlay', () => {
            if (this.tooltip.tooltip.style.opacity === '1') {
                this.logger.debug('Video resumed, hiding tooltip');
                this.tooltip.hideTooltip();
            }
        });

        // Handle play button clicks
        this.eventBus.on('playButtonClicked', () => {
            if (this.tooltip.tooltip.style.opacity === '1') {
                this.tooltip.hideTooltip();
            }
        });

        // Handle cleanup events
        this.eventBus.on('beforeUnload', () => {
            if (window.overlay) {
                window.overlay.cleanup();
            }
        });

        this.eventBus.on('visibilityChange', (isHidden) => {
            if (isHidden && window.overlay?.isActive) {
                window.Overlay.player.stopCaptionSync();
            }
        });

        // Register Chrome message handlers
        this.eventBus.registerMessageHandler('GET_OVERLAY_STATUS', (request, sender) => {
            return { active: this.state.isOverlayActive() };
        });

        this.eventBus.registerMessageHandler('TOGGLE_OVERLAY', (request, sender) => {
            this.player.toggleOverlay();
            return { success: true, active: this.state.isOverlayActive() };
        });

        this.eventBus.registerMessageHandler('API_KEY_UPDATED', (request, sender) => {
            this.logger.info('API key updated');
            return { success: true };
        });

        document.addEventListener('refreshHighlights', () => {
            this.player.refreshHighlights();
        });

        this.eventBus.registerMessageHandler('API_MODE_CHANGED', async (request, sender) => {
            const newMode = request.mode;
            this.logger.info(`[YT Overlay] 🔄 API mode changed to: ${newMode}`);
            
            // Reload settings
            await this.storage.loadSettings();
            
            // Show indicator if in public mode
            if (newMode === 'public') {
                this.player.showUsageIndicator();
            }
            
            return { success: true };
        });

        this.eventBus.registerMessageHandler('SETTINGS_UPDATED', async (request, sender) => {
            this.logger.info('[YT Overlay] ⚙️ Settings updated, reloading...');
            await this.storage.loadSettings();
            return { success: true };
        });
    }

    async init() {

        try {
            await this.domWatcher.waitForYouTube();

            this.logger.debug('YouTube ready, setting up monitoring...');
            this.domWatcher.setupVideoMonitoring();

            // Check if onboarding is needed
            const onboardingNeeded = await this.checkOnboardingStatus();
            if (onboardingNeeded) {
                this.logger.info('[YT Overlay] ⚠️ Onboarding required - showing banner');
                this.player.showOnboardingBanner();
                return; // Don't initialize overlay until onboarding is complete
            }

            // Set up player button
            this.player.setupPlayerButton();

            // Load all settings
            await this.storage.loadSettings();
            
            // Load saved words
            await this.storage.loadSavedWords();
            await this.storage.initDatabaseCache();

            // Load API cache
            await this.storage.loadApiCache();
            
            // Set up tooltip system
            this.tooltip.setupTooltip();

            this.domWatcher.setupPlayButtonListener();

            // Set up button observer using DOMWatcher
            this.domWatcher.setupPlayerButtonObserver(() => {
                this.player.setupPlayerButton();
            });

            await this.videoObserver.checkCurrentVideo();
            
            
            this.logger.info('[YT Overlay] ✅ Initialization complete!');


        } catch (error) {
            this.logger.error('Initialization error:', error);
        }
    }

    /**
     * Check if onboarding is needed
     * Returns true if user needs to complete onboarding
     */
    async checkOnboardingStatus() {
        const settings = await chrome.storage.sync.get([
            'needsOnboarding',
            'targetLanguage',
            'definitionLevel',
            'vocabToken'
        ]);

        // Check if any critical setting is missing
        const needsOnboarding = settings.needsOnboarding !== false;
        const missingLanguage = !settings.targetLanguage;
        const missingLevel = !settings.definitionLevel;
        const missingAuth = !settings.vocabToken;

        if (needsOnboarding || missingLanguage || missingLevel || missingAuth) {
            this.logger.warn('[YT Overlay] Missing required settings:', {
                needsOnboarding,
                missingLanguage,
                missingLevel,
                missingAuth
            });
            return true;
        }

        return false;
    }



    cleanup() {        
        this.logger.debug('Cleaning up...');
        
        // Stop caption sync
        this.state.clearSyncInterval();
        
        // EventBus cleanup (handles all observers)
        this.eventBus.cleanup();
        
        // Clear state observer reference
        this.state.setPlayerButtonObserver(null);
        
        // Remove overlay
        this.player.hideOverlay();
        
        // Remove player button
        const playerBtn = document.getElementById('yt-subtitle-btn');
        if (playerBtn) {
            playerBtn.remove();
        }
        
        // Remove any notifications
        const notification = document.getElementById('yt-subtitle-notification');
        if (notification) {
            notification.remove();
        }
        
        // ServerManager cleanup (if any needed in future)
        
        this.logger.debug('Cleanup complete');
    }


    // Utilities & Helpers

    getVideoId() {
        return this.videoObserver.getVideoId();
    }

    notifyBackground(type, error = null, count = null, language = null) {
        const options = {
            videoId: this.state.getCurrentVideoId()
        };
        
        if (error) options.error = error;
        if (count) options.count = count;
        if (language) options.language = language;
        
        this.eventBus.notifyBackground(type, options);
    }

    sendToExtension(action) {
        return this.eventBus.sendToExtension(action);
    }

    showPlayerNotification(message) {
        this.notifications.showPlayerNotification(message);
    }    

    // ?
    async handleWordClick(word, wordIndex) {
        // Debounce rapid clicks
        const now = Date.now();
        const clickKey = `${word}_${wordIndex}`;
        
        // If same word clicked within 300ms, ignore
        if (this.pendingAnalysis.has(clickKey)) {
            this.logger.debug('Analysis already pending for:', word);
            return;
        }
        
        if (now - this.lastWordClick < this.clickDebounceMs) {
            return;
        }
        
        this.lastWordClick = now;
        this.pendingAnalysis.set(clickKey, true);
        
        try {

            this.logger.debug(`Word clicked: "${word}"`);
            
            // 🎯 Pause the video
            const video = document.querySelector('video');
            if (video && !video.paused) {
                video.pause();
            }

            // Initialize if needed
            if (!this.state.getParsedCaptions()) {
                this.state.setParsedCaptions([]);
            }
            if (this.state.getCurrentCaptionIndex() === undefined) {
                this.state.setCurrentCaptionIndex(-1);
            }

            // Get click position from the stored event
            const event = this.player.currentClickEvent;
            const rect = event?.target?.getBoundingClientRect() || { 
                left: window.innerWidth/2, 
                top: window.innerHeight/2, 
                width: 0 
            };
            
            // Show loading state immediately
            this.tooltip.showTooltip(word, rect.left + rect.width/2, rect.top, true);
        

        
            // 🎯 Check cached data FIRST
            let analysisData = await this.storage.getCachedWordData(word);
            
            if (analysisData) {
                this.logger.debug(`Using cached data for "${word}" (source: ${analysisData._source || 'cache'})`);
            } else {
                // No cache found, fetch fresh analysis
                this.logger.debug(`No cache for "${word}", fetching fresh analysis...`);
                
                // Get context for better analysis
                let context = null;
                const contextData = this.storage.getSurroundingContext(word, wordIndex);
                if (contextData) {
                    context = contextData.context;
                } else if (this.state.getParsedCaptions() && this.state.getCurrentCaptionIndex() >= 0) {
                    context = this.state.getParsedCaptions()[this.state.getCurrentCaptionIndex()]?.text || `The word "${word}"`;
                }
                
                // Fetch fresh analysis
                analysisData = await this.AI.fetchWordAnalysis(word, context);
                this.logger.info('Received OpenAI response:', analysisData);
            }
            
            // 🔧 FIX: Update tooltip with analysis data
            this.tooltip.showTooltip(word, rect.left + rect.width/2, rect.top, false, analysisData);
            
        } finally {
            // Clear pending flag
            setTimeout(() => {
                this.pendingAnalysis.delete(clickKey);
            }, 1000);
        }
    }

}

// Create global instance
const overlay = new YouTubeSubtitleOverlay();
// Attach to window for cleanup access
window.overlay = overlay;