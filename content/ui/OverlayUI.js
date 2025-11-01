class PlayerIntegration {
    constructor(overlayInstance, logger) {
        this.serverManager = overlayInstance.serverManager;

        // Use storage from the main overlay instead of creating new instance
        this.storage = overlayInstance.storage;

        // Caption Processing
        this.caption = overlayInstance.caption;

        // AI & Analysis
        this.AI = overlayInstance.AI;

        // Notification service
        this.notifications = overlayInstance.notifications;

        // Reference to the main overlay instance
        this.overlay = overlayInstance;

        // DOM cache
        this.playerContainer = null;
        this.overlayElement = null;

        this.logger = logger || console;
    }

    getPlayerContainer() {
        if (!this.playerContainer) {
            this.playerContainer = document.querySelector('#movie_player');
        }
        return this.playerContainer;
    }

    getOverlayElement() {
        return document.getElementById('yt-subtitle-overlay');
    }

    toggleOverlay() {
        this.overlay.state.setActive(!this.overlay.state.isOverlayActive());
        this.logger.info(`Overlay ${this.overlay.state.isOverlayActive() ? 'ENABLED' : 'DISABLED'}`);

        // Update player button if it exists
        const playerBtn = document.getElementById('yt-subtitle-overlay-btn');
        if (playerBtn) {
            this.updatePlayerButton(playerBtn, this.overlay.state.isOverlayActive() ? 'active' : 'idle');
        }

        if (this.overlay.state.isOverlayActive() && this.overlay.state.getCaptionData()) {
            this.logger.debug(`Starting live caption sync`);
            this.showOverlay();
            this.startCaptionSync();
        } else if (this.overlay.state.isOverlayActive()) {
            this.logger.warn('Overlay enabled but no captions available');
            // Try to fetch captions
            const videoId = this.overlay.getVideoId();
            if (videoId) {
                this.caption.fetchFromYtDlpServer(videoId).then(success => {
                    if (success) {
                        this.showOverlay();
                        this.startCaptionSync();
                    }
                });
            }
        } else {
            this.logger.debug('Stopping caption sync');
            this.stopCaptionSync();
            this.hideOverlay();
        }
    }

    startCaptionSync() {
        // Use cached video element
        const video = this.overlay.videoObserver.getVideoElement();
        this.overlay.state.setVideoElement(video);
        
        if (!video) {
            this.logger.error('Could not find video element');
            return;
        }
        
        const parsedCaptions = this.overlay.state.getParsedCaptions();
        
        if (parsedCaptions.length > 0) {
            this.logger.debug('First caption starts at:', parsedCaptions[0].start, 'seconds');
            this.logger.debug('Last caption ends at:', parsedCaptions[parsedCaptions.length - 1].end, 'seconds');
            this.logger.debug('First caption text:', parsedCaptions[0].text);
        }
        
        // Use adaptive sync rate
        let syncRate = 100; // Start at 100ms
        
        const syncInterval = setInterval(() => {
            const video = this.overlay.state.getVideoElement();
            if (!video) return;
            
            // Reduce sync rate when paused
            if (video.paused) {
                syncRate = 500; // Slower when paused
            } else if (video.playbackRate > 1.5) {
                syncRate = 50; // Faster for high speed
            } else {
                syncRate = 100; // Normal
            }
            
            this.updateCurrentCaption();
        }, syncRate);
        
        this.overlay.state.setSyncInterval(syncInterval);
    }

    stopCaptionSync() {
        this.overlay.state.clearSyncInterval();
        this.overlay.state.setCurrentCaptionIndex(-1);
    }

    updateCurrentCaption() {
        // CHANGE: Use cached reference
        const video = this.overlay.state.getVideoElement();
        if (!video || !this.overlay.state.getParsedCaptions().length) {
            return;
        }

        const currentTime = video.currentTime;
        
        // ADD DETAILED DEBUG LOGGING:
        const currentCaptionIndex = this.overlay.state.getCurrentCaptionIndex();
        const parsedCaptions = this.overlay.state.getParsedCaptions();
    

        // Find the caption that should be showing now
        let targetIndex = -1;
        for (let i = 0; i < parsedCaptions.length; i++) {
            const caption = parsedCaptions[i];
            if (currentTime >= caption.start && currentTime <= caption.end) {
                targetIndex = i;
                break;
            }
        }

        
        if (targetIndex !== currentCaptionIndex) {
        this.logger.debug(`Caption change: ${currentCaptionIndex} → ${targetIndex}`);
            if (targetIndex === -1) {
                this.logger.debug(`[No caption for time ${currentTime.toFixed(2)}s`);
            }
        }
        
        
        // Only update if caption changed
        if (targetIndex !== currentCaptionIndex) {
            this.overlay.state.setCurrentCaptionIndex(targetIndex);
            this.displayCaption(targetIndex);
        }
    }

    displayCaption(index) {
        const overlay = document.getElementById('yt-subtitle-overlay'); // Direct query
        if (!overlay) return;
        
        if (index === -1) {
            overlay.style.opacity = '0';
        } else {
            const caption = this.overlay.state.getParsedCaptions()[index];
            
            // Create words with data attributes including index
            const words = caption.words.map((word, wordIndex) => {
            const wordKey = word.text.toLowerCase().trim();
            const isHighlighted = wordKey in this.overlay.state.savedWords;
                const className = `caption-word ${isHighlighted ? 'highlighted-word' : ''}`;
                return `<span class="${className}" 
                            data-word="${word.text}"
                            data-index="${wordIndex}"
                            data-caption-index="${index}"
                        >${word.text}${word.punctuation}</span>`;
            }).join(' ');
            
            overlay.innerHTML = words;
            overlay.style.opacity = '1';
            
            
            overlay.querySelectorAll('.caption-word').forEach(span => {
                span.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    
                    const word = e.target.dataset.word;
                    const wordIndex = parseInt(e.target.dataset.index);
                    
                    this.logger.info('Left-clicked word:', word);
                    
                    // Pass the event to handleWordClick via a temporary property
                    this.currentClickEvent = e;
                    await this.overlay.handleWordClick(word, wordIndex);
                    this.currentClickEvent = null;
                });

                span.addEventListener('contextmenu', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    const word = e.target.dataset.word;
                    const wordKey = word.toLowerCase().trim();
                    const wordIndex = parseInt(e.target.dataset.index);
                    
                    if (this.storage.savedWords && this.storage.savedWords[wordKey]) {
                        // Remove word
                        delete this.storage.savedWords[wordKey];
                        e.target.classList.remove('highlighted-word');
                        
                        const result = await chrome.storage.local.get(['savedWordsData']);
                        const savedWordsData = result.savedWordsData || {};
                        delete savedWordsData[wordKey];
                        await chrome.storage.local.set({ savedWordsData: savedWordsData });
                        
                        this.logger.debug('Removed word from saved list:', word);
                        this.overlay.showSaveConfirmation(`Removed "${word}"`);
                        
                    } else {
                        // Add word - immediate visual feedback
                        e.target.classList.add('highlighted-word');
                        
                        try {
                            // Check for cached analysis first
                            let analysisData = await this.storage.getCachedWordData(word);
                            
                            if (!analysisData) {
                                this.logger.debug('Generating AI analysis...');
                                const contextData = this.storage.getSurroundingContext(word, wordIndex);
                                const context = contextData?.context || 
                                            this.overlay.state.getParsedCaptions()?.[this.overlay.state.getCurrentCaptionIndex()]?.text || 
                                            `The word "${word}"`;
                                analysisData = await this.AI.fetchWordAnalysis(word, context);
                            }
                            
                            // Save with analysis
                            await this.storage.saveWord(word, analysisData);
                            this.logger.info(`Word saved: ${word}`);
                            
                        } catch (error) {
                            this.logger.error('Error saving word:', error);
                            await this.storage.saveWord(word, null);
                        }
                    }
                });
            });
        }
    }

    // Method to refresh highlights for saved words
    refreshHighlights() {
        const overlay = document.getElementById('yt-subtitle-overlay');
        if (!overlay || !this.storage.savedWords) return;
        
        const wordElements = overlay.querySelectorAll('.caption-word');
        wordElements.forEach(element => {
            const word = element.dataset.word;
            if (word) {
                const wordKey = word.toLowerCase().trim();
                if (wordKey in this.storage.savedWords) {
                    element.classList.add('highlighted-word');
                } else {
                    element.classList.remove('highlighted-word');
                }
            }
        });
    }

    showOverlay() {
        // Remove existing overlay if any
        this.hideOverlay();

        // Clear cached references when recreating
        this.overlayElement = null;
        this.playerContainer = null;
        
        // Create overlay container
        const overlay = document.createElement('div');
        overlay.id = 'yt-subtitle-overlay';
        overlay.style.cssText = `
            position: absolute;
            bottom: 60px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 2000;
            background: rgba(8, 8, 8, 0.75);
            color: white;
            padding: 8px 16px;
            border-radius: 4px;
            font-size: 20px;
            line-height: 1.4;
            font-family: "YouTube Sans", "Roboto", sans-serif;
            text-align: center;
            max-width: 70%;
            pointer-events: auto;
            user-select: none;
            transition: opacity 0.2s ease;
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
        `;

        // Add this after creating the overlay
        const style = document.createElement('style');
        style.textContent = `
            #yt-subtitle-overlay {
                text-shadow: 0 0 4px rgba(0, 0, 0, 0.8), 
                            0 0 8px rgba(0, 0, 0, 0.6);
            }
            
            .caption-word {
                cursor: pointer;
                transition: all 0.2s ease;
                display: inline-block;
                position: relative;
                padding: 0 2px;
                margin: 0 1px;
                border-radius: 4px;
            }
            
            .caption-word:hover {
                background-color: #ff0000;
                color: white;
                text-shadow: none;
                transform: scale(1.05);
            }
            
            .highlighted-word {
                background-color: rgba(255, 215, 0, 0.3);
                border-bottom: 2px solid #ffd700;
            }
            
            #yt-word-tooltip.loading::after {
                content: '';
                display: inline-block;
                width: 14px;
                height: 14px;
                border: 2px solid #ffffff;
                border-top-color: transparent;
                border-radius: 50%;
                animation: spin 0.8s linear infinite;
                margin-left: 8px;
            }
            
            #yt-word-tooltip * {
                box-sizing: border-box;
            }
            
            #yt-word-tooltip button:hover {
                transform: scale(1.05);
            }
            
            #yt-word-tooltip .yt-tooltip-word:hover {
                color: #4CAF50;
            }

            @keyframes spin {
                to { transform: rotate(360deg); }
            }
            
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }

            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
        
        // Find YouTube video container
        const videoContainer = document.querySelector('#movie_player') || 
                            document.querySelector('.html5-video-container');
        
        if (videoContainer) {
            videoContainer.appendChild(overlay);
            this.logger.debug('Clean subtitle overlay created');
        }
    }

    showUsageIndicator() {
        const apiMode = this.storage.state.apiMode || 'own';
        if (apiMode !== 'public') {
            this.notifications.hideUsageIndicator();
            return;
        }

        const usage = this.storage.state.publicApiUsage || 0;
        const limit = this.storage.state.publicApiLimit || 50;

        this.notifications.showUsageIndicator(usage, limit);
    }

    hideOverlay() {
        const existingOverlay = document.getElementById('yt-subtitle-overlay');
        if (existingOverlay) {
            existingOverlay.remove();
            this.overlayElement = null;  
        }
        this.logger.info('Overlay removed');
    }

    setupPlayerButton() {
        // Add styles once
        if (!document.querySelector('#yt-overlay-button-styles')) {
            const style = document.createElement('style');
            style.id = 'yt-overlay-button-styles';
            style.textContent = `
                #yt-subtitle-overlay-btn {
                    position: absolute !important;
                    top: 12px;
                    right: 12px;
                    width: 40px !important;
                    height: 40px !important;
                    background: rgba(28, 28, 28, 0.9) !important;
                    border: none;
                    border-radius: 50% !important;
                    display: flex !important;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    z-index: 62;
                    transition: opacity 0.1s, transform 0.1s;
                    opacity: 0;
                    pointer-events: none;
                    padding: 0 !important;
                    margin: 0 !important;
                }

                /* Show button when hovering over player */
                #movie_player:hover #yt-subtitle-overlay-btn {
                    opacity: 1;
                    pointer-events: auto;
                }

                #yt-subtitle-overlay-btn:hover {
                    background: rgba(255, 255, 255, 0.2) !important;
                    transform: scale(1.1);
                }

                #yt-subtitle-overlay-btn:active {
                    transform: scale(0.95);
                }

                #yt-subtitle-overlay-btn.active {
                    background: rgba(255, 0, 0, 0.9) !important;
                }

                #yt-subtitle-overlay-btn.active:hover {
                    background: rgba(255, 0, 0, 1) !important;
                }

                #yt-subtitle-overlay-btn svg {
                    width: 20px;
                    height: 20px;
                }

                /* Tooltip */
                #yt-subtitle-overlay-btn::after {
                    content: attr(data-tooltip);
                    position: absolute;
                    top: 50%;
                    right: calc(100% + 8px);
                    transform: translateY(-50%);
                    background: rgba(28, 28, 28, 0.9);
                    color: #fff;
                    padding: 5px 8px;
                    border-radius: 2px;
                    font-size: 12px;
                    font-family: "Roboto", Arial, sans-serif;
                    font-weight: 500;
                    white-space: nowrap;
                    pointer-events: none;
                    opacity: 0;
                    transition: opacity 0.2s;
                }

                #yt-subtitle-overlay-btn:hover::after {
                    opacity: 1;
                    transition-delay: 0.5s;
                }

                /* Loading spinner */
                @keyframes yt-spin {
                    to { transform: rotate(360deg); }
                }

                #yt-subtitle-overlay-btn.loading svg {
                    animation: yt-spin 1s linear infinite;
                }
            `;
            document.head.appendChild(style);
        }

        // Just inject the button once
        this.injectPlayerButton();
    }

    injectPlayerButton() {
        try {
            // Don't inject if already exists
            if (document.querySelector('#yt-subtitle-overlay-btn')) {
                return;
            }

            // Find YouTube video player container
            const player = document.querySelector('#movie_player');
            if (!player) {
                return;
            }

            // Create button
            const button = document.createElement('button');
            button.id = 'yt-subtitle-overlay-btn';
            button.setAttribute('data-tooltip', 'Subtitle Overlay (Alt+S)');
            button.setAttribute('aria-label', 'Toggle subtitle overlay');

            // Subtitle icon
            button.innerHTML = `
                <svg viewBox="0 0 24 24" fill="white">
                    <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zM4 12h4v2H4v-2zm10 6H4v-2h10v2zm6 0h-4v-2h4v2zm0-4H10v-2h10v2z"/>
                </svg>
            `;

            // Click handler
            button.addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.handlePlayerButtonClick(button);
            });

            // Keyboard shortcut
            if (!this.shortcutAdded) {
                document.addEventListener('keydown', (e) => {
                    if (e.altKey && e.key === 's') {
                        e.preventDefault();
                        const btn = document.querySelector('#yt-subtitle-overlay-btn');
                        if (btn) btn.click();
                    }
                });
                this.shortcutAdded = true;
            }

            // Add to player
            player.appendChild(button);

            // Set initial state
            if (this.overlay?.state?.isOverlayActive()) {
                button.classList.add('active');
            }

            this.logger.debug('Button added');
        } catch (error) {
            this.logger.error('Error injecting button:', error);
        }
    }

    /**
     * Show onboarding banner when setup is incomplete
     * Prompts user to complete setup before using the extension
     */
    showOnboardingBanner() {
        // Don't show if already exists
        if (document.querySelector('#yt-onboarding-banner')) {
            return;
        }

        // Add banner styles
        if (!document.querySelector('#yt-onboarding-banner-styles')) {
            const style = document.createElement('style');
            style.id = 'yt-onboarding-banner-styles';
            style.textContent = `
                #yt-onboarding-banner {
                    position: fixed;
                    top: 70px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 16px 24px;
                    border-radius: 12px;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
                    z-index: 9999;
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    font-family: "Roboto", Arial, sans-serif;
                    animation: slideDown 0.4s ease-out;
                }

                @keyframes slideDown {
                    from {
                        opacity: 0;
                        transform: translateX(-50%) translateY(-20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(-50%) translateY(0);
                    }
                }

                #yt-onboarding-banner-content {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                #yt-onboarding-banner-title {
                    font-size: 16px;
                    font-weight: 600;
                }

                #yt-onboarding-banner-subtitle {
                    font-size: 13px;
                    opacity: 0.9;
                }

                #yt-onboarding-banner-btn {
                    background: white;
                    color: #667eea;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                    white-space: nowrap;
                }

                #yt-onboarding-banner-btn:hover {
                    background: rgba(255, 255, 255, 0.9);
                    transform: scale(1.05);
                }

                #yt-onboarding-banner-btn:active {
                    transform: scale(0.95);
                }

                @media (max-width: 768px) {
                    #yt-onboarding-banner {
                        top: 60px;
                        left: 12px;
                        right: 12px;
                        transform: none;
                        flex-direction: column;
                        align-items: stretch;
                        padding: 12px 16px;
                    }

                    #yt-onboarding-banner-btn {
                        width: 100%;
                    }
                }
            `;
            document.head.appendChild(style);
        }

        // Create banner
        const banner = document.createElement('div');
        banner.id = 'yt-onboarding-banner';
        banner.innerHTML = `
            <div id="yt-onboarding-banner-content">
                <div id="yt-onboarding-banner-title">⚠️ Setup Required</div>
                <div id="yt-onboarding-banner-subtitle">Complete Vocaminary setup to start learning vocabulary</div>
            </div>
            <button id="yt-onboarding-banner-btn">Complete Setup</button>
        `;

        // Add click handler
        const button = banner.querySelector('#yt-onboarding-banner-btn');
        button.addEventListener('click', () => {
            window.open('https://app.vocaminary.com/extension/onboarding', '_blank');
        });

        // Add to page
        document.body.appendChild(banner);

        this.logger.info('[YT Overlay] 📢 Onboarding banner displayed');
    }

    setupButtonVisibility(player, buttonContainer) {
        let hideTimeout;
        
        const showButton = () => {
            buttonContainer.style.opacity = '1';
            buttonContainer.style.pointerEvents = 'auto';
            
            clearTimeout(hideTimeout);
            hideTimeout = setTimeout(() => {
                if (!player.classList.contains('ytp-autohide')) {
                    return;
                }
                buttonContainer.style.opacity = '0';
                buttonContainer.style.pointerEvents = 'none';
            }, 3000);
        };
        
        const hideButton = () => {
            buttonContainer.style.opacity = '0';
            buttonContainer.style.pointerEvents = 'none';
        };
        
        // Show button when mouse moves
        player.addEventListener('mousemove', showButton);
        player.addEventListener('mouseenter', showButton);
        
        // Hide button when controls hide
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.target.classList.contains('ytp-autohide')) {
                    hideButton();
                } else {
                    showButton();
                }
            });
        });
        
        observer.observe(player, {
            attributes: true,
            attributeFilter: ['class']
        });
        
        // Initial state
        showButton();
    }

    updatePlayerButton(button, state, progress = null) {
        // Remove all state classes
        button.classList.remove('active', 'loading', 'error');

        // Update visual state based on state
        const states = {
            idle: {
                icon: `<svg viewBox="0 0 24 24" fill="white">
                    <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zM4 12h4v2H4v-2zm10 6H4v-2h10v2zm6 0h-4v-2h4v2zm0-4H10v-2h10v2z"/>
                </svg>`,
                tooltip: 'Subtitle Overlay (Alt+S)',
                class: ''
            },
            loading: {
                icon: `<svg viewBox="0 0 24 24" fill="white">
                    <circle cx="12" cy="12" r="10" fill="none" stroke="white" stroke-width="2" opacity="0.3"/>
                    <path d="M12 2 A10 10 0 0 1 22 12" fill="none" stroke="white" stroke-width="2" stroke-linecap="round"/>
                </svg>`,
                tooltip: progress || 'Loading...',
                class: 'loading'
            },
            active: {
                icon: `<svg viewBox="0 0 24 24" fill="white">
                    <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zM4 12h4v2H4v-2zm10 6H4v-2h10v2zm6 0h-4v-2h4v2zm0-4H10v-2h10v2z"/>
                </svg>`,
                tooltip: 'Disable Overlay (Alt+S)',
                class: 'active'
            },
            error: {
                icon: `<svg viewBox="0 0 24 24" fill="white">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                </svg>`,
                tooltip: 'Error - Click to retry',
                class: 'error'
            }
        };

        const stateConfig = states[state] || states.idle;
        button.innerHTML = stateConfig.icon;
        button.setAttribute('data-tooltip', stateConfig.tooltip);

        if (stateConfig.class) {
            button.classList.add(stateConfig.class);
        }
    }

    addSpinnerAnimation() {
        // Spinner animation is now included in the main button styles
        // This method is kept for backward compatibility
    }

    async handlePlayerButtonClick(button) {
        try {
            // If overlay is active, just disable it
            if (this.overlay.state.isOverlayActive()) {
                this.toggleOverlay();
                this.updatePlayerButton(button, 'idle');
                return;
            }
            
            // Check user's subtitle source preference
            const { subtitleServer } = await chrome.storage.sync.get(['subtitleServer']);
            const preferredServer = subtitleServer || 'cloud'; // Default to VPS
            
            // Only check local server if user selected local mode
            if (preferredServer === 'local') {
                this.updatePlayerButton(button, 'loading', 'Checking server...');
                
                // Check server status
                const serverRunning = await this.serverManager.checkServerConnection();
                
                if (!serverRunning) {
                    // Need to start server
                    this.updatePlayerButton(button, 'loading', 'Starting server...');
                    
                    // Send message to extension to start server
                    const response = await this.overlay.sendToExtension('START_SERVER');
                    
                    if (!response.success) {
                        throw new Error('Failed to start server');
                    }
                    
                    // Wait for server to be ready
                    let attempts = 0;
                    while (attempts < 10) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        if (await this.serverManager.checkServerConnection()) {
                            break;
                        }
                        attempts++;
                    }
                    
                    if (attempts >= 10) {
                        throw new Error('Server failed to start');
                    }
                }
            } else {
                // Using VPS - skip local server check
                this.logger.info('[OverlayUI] 🚀 Using Vocaminary VPS - skipping local server check');
            }
            
            // Check if we need to fetch captions
            if (!this.overlay.state.getCaptionData() || !this.overlay.state.getParsedCaptions().length) {
                this.updatePlayerButton(button, 'loading', 'Fetching captions...');
                
                // Get video ID
                const videoId = this.overlay.getVideoId();
                if (!videoId) {
                    throw new Error('No video ID found');
                }
                
                // Fetch captions
                const success = await this.caption.fetchFromYtDlpServer(videoId);
                if (!success) {
                    throw new Error('Failed to fetch captions');
                }
            }
            
            // When enabling overlay, fetch captions:
            await this.overlay.videoObserver.checkCurrentVideo(true);  // Pass true to fetch

            // Enable overlay
            this.updatePlayerButton(button, 'loading', 'Enabling overlay...');
            this.toggleOverlay();
            
            // Update button state
            this.updatePlayerButton(button, this.overlay.state.isOverlayActive() ? 'active' : 'idle');
            
        } catch (error) {
            this.logger.error('Player button error:', error);
            this.updatePlayerButton(button, 'error');
            
            // Show error message
            this.overlay.showPlayerNotification(error.message || 'Something went wrong');
            
            // Reset button after 3 seconds
            setTimeout(() => {
                this.updatePlayerButton(button, 'idle');
            }, 3000);
        }
    }

    highlightWordInCaptions(word) {
        const wordKey = word.toLowerCase().trim();
        
        // Update in-memory saved words
        if (!this.storage.savedWords[wordKey]) {
            this.storage.savedWords[wordKey] = { word: word };
        }
        
        // Find and highlight all instances in current captions
        const allWordElements = document.querySelectorAll('.caption-word, .subtitle-word');
        allWordElements.forEach(element => {
            if (element.textContent.toLowerCase().trim() === wordKey) {
                element.classList.add('highlighted-word');
            }
        });
    }
}