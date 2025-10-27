class EventBus {
    constructor() {
        this.observers = new Map();
        this.messageHandlers = new Map();
        this.mutationObservers = new Map();
        
        this.setupChromeMessageListener();
        this.setupWindowEventListeners();
        this.setupVideoMonitoring();
    }

    on(event, callback) {
        if (!this.observers.has(event)) {
            this.observers.set(event, []);
        }
        this.observers.get(event).push(callback);
    }


    emit(event, ...args) {
        if (this.observers.has(event)) {
            this.observers.get(event).forEach(callback => {
                try {
                    callback(...args);
                } catch (error) {
                    console.error(`[EventBus] Error in event handler for ${event}:`, error);
                }
            });
        }
    }

    setupChromeMessageListener() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            console.log('[EventBus] Received chrome message:', request);
            
            if (this.messageHandlers.has(request.type)) {
                const handler = this.messageHandlers.get(request.type);
                const result = handler(request, sender);
                
                if (result instanceof Promise) {
                    result.then(response => {
                        sendResponse(response);
                    }).catch(error => {
                        console.error('[EventBus] Message handler error:', error);
                        sendResponse({ success: false, error: error.message });
                    });
                    return true;
                } else {
                    sendResponse(result);
                    return result !== undefined;
                }
            }
            
            this.emit('chromeMessage', request, sender, sendResponse);
            return false;
        });
    }

    setupWindowEventListeners() {
        window.addEventListener('message', async (event) => {
            if (event.data.type === 'YOURVOCAB_AUTH' && event.origin === 'https://yourvocab-app.vercel.app') {
                this.emit('vocabAuth', event.data);
            }
            this.emit('windowMessage', event);
        });

        window.addEventListener('beforeunload', () => {
            this.emit('beforeUnload');
        });

        document.addEventListener('visibilitychange', () => {
            this.emit('visibilityChange', document.hidden);
        });

        window.addEventListener('error', (event) => {
            if (event.message?.includes('Extension context invalidated')) {
                this.emit('extensionContextInvalidated');
            }
            this.emit('windowError', event);
        });

        window.addEventListener('popstate', () => {
            this.emit('urlChange', location.href);
        });
    }

    setupVideoMonitoring() {
        let lastUrl = location.href;
        
        const checkForChanges = () => {
            const currentUrl = location.href;
            
            if (!currentUrl.includes('youtube.com')) {
                this.emit('leftYouTube');
                return;
            }

            // Check if we LEFT a video page
            if (lastUrl.includes('/watch') && !currentUrl.includes('/watch')) {
                this.emit('leftVideoPage');
            }
            
            if (currentUrl !== lastUrl && currentUrl.includes('/watch')) {
                lastUrl = currentUrl;
                this.emit('urlChange', currentUrl, lastUrl);
            }

            lastUrl = currentUrl;
        };

        const observer = new MutationObserver(checkForChanges);
        observer.observe(document, { 
            subtree: true, 
            childList: true 
        });
        this.mutationObservers.set('urlMonitoring', observer);
    }

    registerMessageHandler(type, handler) {
        this.messageHandlers.set(type, handler);
    }


    setupButtonObserver(targetElement, callback) {
        const observer = new MutationObserver(callback);
        observer.observe(targetElement, {
            childList: true,
            subtree: false
        });
        this.mutationObservers.set('buttonObserver', observer);
        return observer;
    }

    setupPlayButtonListener(videoElement, tooltipHandler) {
        if (videoElement) {
            videoElement.addEventListener('play', () => {
                this.emit('videoPlay');
            });
        }
        
        document.addEventListener('click', (e) => {
            const playButton = e.target.closest('.ytp-play-button');
            if (playButton) {
                setTimeout(() => this.emit('playButtonClicked'), 100);
            }
        }, true);
    }

    notifyBackground(type, options = {}) {
        try {
            const message = {
                type: type,
                ...options
            };
            
            chrome.runtime.sendMessage(message);
            console.log('[EventBus] Notified background:', type);
            this.emit('backgroundNotified', type, message);
            
        } catch (error) {
            console.error('[EventBus] Failed to notify background:', error);
            this.emit('backgroundNotifyError', error);
        }
    }

    sendToExtension(action) {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage(
                { type: action },
                (response) => {
                    if (chrome.runtime.lastError) {
                        resolve({ success: false, error: chrome.runtime.lastError.message });
                    } else {
                        resolve(response || { success: false });
                    }
                }
            );
        });
    }


    cleanup() {
        console.log('[EventBus] Cleaning up...');
        
        this.mutationObservers.forEach((observer, name) => {
            observer.disconnect();
            console.log(`[EventBus] Disconnected observer: ${name}`);
        });
        this.mutationObservers.clear();
        
        this.observers.clear();
        this.messageHandlers.clear();
        
        this.emit('cleanup');
    }
}