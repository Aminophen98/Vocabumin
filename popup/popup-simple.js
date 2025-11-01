/**
 * Simplified Popup Manager
 * Focused on status display and quick actions only
 */

class SimplePopupManager {
    constructor() {
        this.initializeElements();
        this.attachEventListeners();
        this.loadData();
        
        // Auto-refresh every 5 seconds
        setInterval(() => this.loadData(), 5000);
    }

    initializeElements() {
        // Connection Status
        this.statusDot = document.getElementById('statusDot');
        this.statusText = document.getElementById('statusText');
        
        // Usage Bars
        this.subtitleCount = document.getElementById('subtitleCount');
        this.subtitleBar = document.getElementById('subtitleBar');
        this.subtitlePercent = document.getElementById('subtitlePercent');
        this.wordCount = document.getElementById('wordCount');
        this.wordBar = document.getElementById('wordBar');
        this.wordPercent = document.getElementById('wordPercent');
        this.dailyCount = document.getElementById('dailyCount');
        this.dailyBar = document.getElementById('dailyBar');
        this.dailyPercent = document.getElementById('dailyPercent');
        
        // API Lookups
        this.apiCount = document.getElementById('apiCount');
        this.apiBar = document.getElementById('apiBar');
        this.apiPercent = document.getElementById('apiPercent');
        this.apiModeInfo = document.getElementById('apiModeInfo');
        this.apiModeText = document.getElementById('apiModeText');

        
        // Stats
        this.totalWords = document.getElementById('totalWords');
        this.todayWords = document.getElementById('todayWords');
        
        // Recent Videos
        this.recentVideosSection = document.getElementById('recentVideosSection');
        this.recentVideosList = document.getElementById('recentVideosList');
        
        // Buttons
        this.dashboardBtn = document.getElementById('dashboardBtn');
        this.settingsBtn = document.getElementById('settingsBtn');
        this.helpLink = document.getElementById('helpLink');
        this.refreshBtn = document.getElementById('refreshBtn');
    }

    attachEventListeners() {
        // Dashboard button - dynamic based on connection
        this.dashboardBtn.addEventListener('click', async () => {
            const { vocabToken } = await chrome.storage.sync.get(['vocabToken']);
            
            if (vocabToken) {
                // Connected - open dashboard
                chrome.tabs.create({ url: 'https://app.vocaminary.com' });
            } else {
                // Not connected - open auth page
                chrome.tabs.create({ url: 'https://app.vocaminary.com/extension-auth' });
            }
            window.close();
        });

        // Settings button
        this.settingsBtn.addEventListener('click', () => {
            chrome.tabs.create({ 
                url: chrome.runtime.getURL('settings/settings.html') 
            });
            window.close();
        });

        // View All Videos link
        const viewAllVideosLink = document.getElementById('viewAllVideos');
        if (viewAllVideosLink) {
            viewAllVideosLink.addEventListener('click', (e) => {
                e.preventDefault();
                chrome.tabs.create({ 
                    url: chrome.runtime.getURL('settings/settings.html#videos') 
                });
                window.close();
            });
        }

        // Help link
        this.helpLink.addEventListener('click', (e) => {
            e.preventDefault();
            chrome.tabs.create({ 
                url: 'https://github.com/yourusername/yourvocab-extension' 
            });
        });

        // Refresh button
        this.refreshBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.loadData();
            this.showToast('Refreshed!');
        });
    }

    async loadData() {
        await Promise.all([
            this.loadConnectionStatus(),
            this.loadUsageLimits(),
            this.loadApiUsage(),
            this.loadWordStats(),
            this.loadRecentVideos()
        ]);
    }

    async loadConnectionStatus() {
        try {
            // Check Vocaminary connection
            const { vocabToken, vocabTokenExpiry } = await chrome.storage.sync.get(['vocabToken', 'vocabTokenExpiry']);
            const isConnected = !!vocabToken;

            if (isConnected) {
                // Check if token is expired
                if (vocabTokenExpiry && Date.now() >= vocabTokenExpiry) {
                    this.statusDot.classList.add('disconnected');
                    this.statusText.textContent = 'Expired';
                    this.dashboardBtn.innerHTML = `
                        <svg class="btn-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M10 13C10.4295 13.5741 10.9774 14.0491 11.6066 14.3929C12.2357 14.7367 12.9315 14.9411 13.6467 14.9923C14.3618 15.0435 15.0796 14.9403 15.7513 14.6897C16.4231 14.4392 17.0331 14.047 17.54 13.54L20.54 10.54C21.4508 9.59695 21.9548 8.33394 21.9434 7.02296C21.932 5.71198 21.4061 4.45791 20.4791 3.53087C19.5521 2.60383 18.298 2.07799 16.987 2.0666C15.676 2.0552 14.413 2.55918 13.47 3.46997L11.75 5.17997" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M14 11C13.5705 10.4259 13.0226 9.95083 12.3934 9.60707C11.7642 9.26331 11.0685 9.05889 10.3533 9.00768C9.63819 8.95646 8.92037 9.05967 8.24861 9.31022C7.57685 9.56077 6.96684 9.9529 6.45996 10.46L3.45996 13.46C2.54917 14.403 2.04519 15.666 2.05659 16.977C2.06798 18.288 2.59382 19.542 3.52086 20.4691C4.44791 21.3961 5.70197 21.922 7.01295 21.9334C8.32393 21.9448 9.58694 21.4408 10.53 20.53L12.24 18.82" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        Reconnect`;
                } else {
                    this.statusDot.classList.remove('disconnected');

                    // Show expiry info if available
                    if (vocabTokenExpiry) {
                        const daysLeft = Math.floor((vocabTokenExpiry - Date.now()) / (24 * 60 * 60 * 1000));
                        const expiryDate = new Date(vocabTokenExpiry);

                        if (daysLeft <= 3) {
                            // Warning: expires soon
                            this.statusText.textContent = `Expires in ${daysLeft}d`;
                            this.statusText.style.color = '#f59e0b'; // Orange warning
                        } else {
                            this.statusText.textContent = 'Connected';
                            this.statusText.style.color = ''; // Reset color
                        }
                    } else {
                        this.statusText.textContent = 'Connected';
                    }

                    // Update button for connected state
                    this.dashboardBtn.innerHTML = `
                        <svg class="btn-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <rect x="3" y="3" width="7" height="7" rx="1" fill="currentColor"/>
                            <rect x="14" y="3" width="7" height="7" rx="1" fill="currentColor"/>
                            <rect x="3" y="14" width="7" height="7" rx="1" fill="currentColor"/>
                            <rect x="14" y="14" width="7" height="7" rx="1" fill="currentColor"/>
                        </svg>
                        Dashboard`;
                }
            } else {
                this.statusDot.classList.add('disconnected');
                this.statusText.textContent = 'Offline';

                // Update button for disconnected state
                this.dashboardBtn.innerHTML = `
                    <svg class="btn-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M10 13C10.4295 13.5741 10.9774 14.0491 11.6066 14.3929C12.2357 14.7367 12.9315 14.9411 13.6467 14.9923C14.3618 15.0435 15.0796 14.9403 15.7513 14.6897C16.4231 14.4392 17.0331 14.047 17.54 13.54L20.54 10.54C21.4508 9.59695 21.9548 8.33394 21.9434 7.02296C21.932 5.71198 21.4061 4.45791 20.4791 3.53087C19.5521 2.60383 18.298 2.07799 16.987 2.0666C15.676 2.0552 14.413 2.55918 13.47 3.46997L11.75 5.17997" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M14 11C13.5705 10.4259 13.0226 9.95083 12.3934 9.60707C11.7642 9.26331 11.0685 9.05889 10.3533 9.00768C9.63819 8.95646 8.92037 9.05967 8.24861 9.31022C7.57685 9.56077 6.96684 9.9529 6.45996 10.46L3.45996 13.46C2.54917 14.403 2.04519 15.666 2.05659 16.977C2.06798 18.288 2.59382 19.542 3.52086 20.4691C4.44791 21.3961 5.70197 21.922 7.01295 21.9334C8.32393 21.9448 9.58694 21.4408 10.53 20.53L12.24 18.82" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    Connect`;
            }

            // Check server status
            try {
                const response = await fetch('http://localhost:5000/health');
                if (!response.ok) throw new Error();
            } catch {
                // Server not running - show in status if needed
            }
        } catch (error) {
            console.error('Connection check error:', error);
        }
    }

    async loadUsageLimits() {
        try {
            // Get auth token
            const { vocabToken } = await chrome.storage.sync.get(['vocabToken']);
            
            if (!vocabToken) {
                // Not logged in - show offline state
                this.updateUsageDisplay({
                    burst: '0/2',
                    hourly: '0/5',
                    daily: '0/20'
                }, null);
                return;
            }

            // Call the API
            const response = await fetch('https://app.vocaminary.com/api/subtitles/check-limit', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${vocabToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.updateUsageDisplay(data.usage, data.remaining, data.allowed, data.waitTime, data.reason);
            } else if (response.status === 429) {
                // Rate limited
                const data = await response.json();
                this.updateUsageDisplay(data.usage, null, false, data.waitTime, data.reason);
            } else {
                console.error('[YT Popup] API error:', response.status);
            }

        } catch (error) {
            console.error('[YT Popup] Error loading usage limits:', error);
        }
    }

    updateUsageDisplay(usage, remaining, allowed = true, waitTime = 0, reason = '') {
        if (!usage) return;

        // Update burst limit (5 minutes)
        this.updateProgressBar(
            this.subtitleCount,
            this.subtitleBar,
            this.subtitlePercent,
            usage.burst
        );

        // Update hourly limit
        this.updateProgressBar(
            this.wordCount,
            this.wordBar,
            this.wordPercent,
            usage.hourly
        );

        // Update daily limit
        this.updateProgressBar(
            this.dailyCount,
            this.dailyBar,
            this.dailyPercent,
            usage.daily
        );

        // Show wait time if rate limited
        if (!allowed && waitTime > 0) {
            this.showRateLimitWarning(waitTime, reason);
        } else {
            this.hideRateLimitWarning();
        }
    }

    updateProgressBar(countElement, barElement, percentElement, usageString) {
        const [used, total] = usageString.split('/').map(Number);
        const percent = Math.round((used / total) * 100);

        countElement.textContent = `${usageString}`;
        barElement.style.width = `${percent}%`;

        this.updateBarColor(barElement, percent);
    }

    showRateLimitWarning(waitTime, reason) {
        const minutes = Math.ceil(waitTime / 60);
        const message = reason === 'burst_limit'
            ? `Wait ${minutes} minutes (5-min limit)`
            : reason === 'hourly_limit'
            ? `Wait ${minutes} minutes (hourly limit)`
            : `Daily limit reached - resets at midnight`;

        // Create or update warning element
        let warning = document.getElementById('rateLimitWarning');
        if (!warning) {
            warning = document.createElement('div');
            warning.id = 'rateLimitWarning';
            warning.style.cssText = `
                padding: 10px;
                background: rgba(245, 158, 11, 0.15);
                border-left: 3px solid #f59e0b;
                color: #fbbf24;
                font-size: 11px;
                font-weight: 600;
                margin-top: 10px;
                border-radius: 4px;
            `;
            const usageSection = document.querySelector('.usage-section');
            usageSection.appendChild(warning);
        }
        warning.textContent = message;
    }

    hideRateLimitWarning() {
        const warning = document.getElementById('rateLimitWarning');
        if (warning) {
            warning.remove();
        }
    }

    updateBarColor(bar, percent) {
        bar.classList.remove('warning', 'danger');
        if (percent >= 90) {
            bar.classList.add('danger');
        } else if (percent >= 70) {
            bar.classList.add('warning');
        }
    }

    async loadApiUsage() {
        try {
            // Get API mode and token from storage
            const storage = await chrome.storage.sync.get([
                'apiMode',
                'vocabToken'
            ]);

            const apiMode = storage.apiMode || 'own';
            
            // Using own OpenAI key - unlimited
            if (apiMode === 'own') {
                this.apiCount.textContent = '∞ Unlimited';
                this.apiBar.style.width = '100%';
                this.apiBar.style.background = 'linear-gradient(90deg, #10b981, #059669)';
                this.apiPercent.textContent = '∞';

                this.apiModeInfo.style.display = 'block';
                this.apiModeText.textContent = 'Using your own OpenAI API key';
                return;
            }

            // Using public API - need to fetch real limits
            if (!storage.vocabToken) {
                this.apiCount.textContent = 'Not connected';
                this.apiModeInfo.style.display = 'block';
                this.apiModeText.textContent = 'Connect to Vocaminary to use public API';
                return;
            }

            // Fetch user's tier and limits from API
            const response = await fetch('https://app.vocaminary.com/api/progress', {
                headers: {
                    'Authorization': `Bearer ${storage.vocabToken}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch limits');
            }

            const data = await response.json();
            const usage = data.aiUsage || 0;
            const limit = data.aiLimit;
            const remaining = data.aiRemaining;

            // Premium/Unlimited
            if (limit === -1) {
                this.apiCount.textContent = '∞ Unlimited';
                this.apiBar.style.width = '100%';
                this.apiBar.style.background = 'linear-gradient(90deg, #10b981, #059669)';
                this.apiPercent.textContent = '∞';
                this.apiModeInfo.style.display = 'block';
                this.apiModeText.textContent = `${data.badge} - Unlimited lookups`;
            } else {
                // Show usage with tier badge
                const usageString = `${usage}/${limit}`;
                this.updateProgressBar(
                    this.apiCount,
                    this.apiBar,
                    this.apiPercent,
                    usageString
                );

                this.apiModeInfo.style.display = 'block';
                this.apiModeText.textContent = `${data.badge} - ${remaining} lookups remaining this month`;
            }

            console.log('[YT Popup] 📊 Tier:', data.tier, 'Usage:', usage, 'Limit:', limit);

        } catch (error) {
            console.error('[YT Popup] Error loading API usage:', error);
            this.apiCount.textContent = 'Error';
            this.apiModeInfo.style.display = 'block';
            this.apiModeText.textContent = 'Failed to load usage data';
        }
    }

    async loadWordStats() {
        try {
            const storage = await chrome.storage.local.get(['savedWordsData']);
            const savedWords = storage.savedWordsData || {};
            const totalCount = Object.keys(savedWords).length;
            
            // Count today's words
            const today = new Date().toDateString();
            let todayCount = 0;
            
            Object.values(savedWords).forEach(word => {
                const wordDate = new Date(word.savedAt || word.timestamp).toDateString();
                if (wordDate === today) {
                    todayCount++;
                }
            });

            // Update UI with animation
            this.animateNumber(this.totalWords, totalCount);
            this.animateNumber(this.todayWords, todayCount);

        } catch (error) {
            console.error('Error loading word stats:', error);
        }
    }

    animateNumber(element, target) {
        const current = parseInt(element.textContent) || 0;
        if (current === target) return;

        const increment = target > current ? 1 : -1;
        const step = Math.abs(target - current) / 20;
        let value = current;

        const timer = setInterval(() => {
            value += increment * Math.ceil(step);
            
            if ((increment > 0 && value >= target) || (increment < 0 && value <= target)) {
                value = target;
                clearInterval(timer);
            }
            
            element.textContent = Math.floor(value);
        }, 30);
    }

    async loadRecentVideos() {
        try {
            // Check if connected
            const { vocabToken } = await chrome.storage.sync.get(['vocabToken']);
            
            if (!vocabToken) {
                // Not connected - hide videos section
                this.recentVideosSection.style.display = 'none';
                return;
            }

            // Fetch recent videos from API
            const response = await fetch('https://app.vocaminary.com/api/my-videos', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${vocabToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                console.error('[YT Popup] Failed to load videos:', response.status);
                this.recentVideosSection.style.display = 'none';
                return;
            }

            const data = await response.json();
            const videos = data.videos || [];

            if (videos.length === 0) {
                // No videos - hide section
                this.recentVideosSection.style.display = 'none';
                return;
            }

            // Show only the 3 most recent videos
            const recentVideos = videos.slice(0, 3);

            // Render videos
            this.recentVideosList.innerHTML = recentVideos.map(video => `
                <div class="recent-video-item" data-video-id="${video.video_id}">
                    <img
                        src="https://img.youtube.com/vi/${video.video_id}/default.jpg"
                        alt="${this.escapeHtml(video.video_title || 'Video')}"
                        class="recent-video-thumbnail"
                        onerror="this.style.display='none'"
                    >
                    <div class="recent-video-info">
                        <div class="recent-video-title">${this.escapeHtml(video.video_title || 'Unknown Video')}</div>
                        <div class="recent-video-meta">
                            <span>${video.words_saved || 0} words</span>
                            <span>${video.view_count || 1} views</span>
                            <span>${this.formatTimeAgo(video.last_viewed)}</span>
                        </div>
                    </div>
                </div>
            `).join('');

            // Add click handlers
            document.querySelectorAll('.recent-video-item').forEach(item => {
                item.addEventListener('click', () => {
                    const videoId = item.dataset.videoId;
                    chrome.tabs.create({ url: `https://www.youtube.com/watch?v=${videoId}` });
                    window.close();
                });
            });

            // Show the section
            this.recentVideosSection.style.display = 'block';

        } catch (error) {
            console.error('[YT Popup] Error loading recent videos:', error);
            this.recentVideosSection.style.display = 'none';
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatTimeAgo(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'now';
        if (diffMins < 60) return `${diffMins}m`;
        if (diffHours < 24) return `${diffHours}h`;
        if (diffDays < 7) return `${diffDays}d`;
        return `${Math.floor(diffDays / 7)}w`;
    }

    showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: ${type === 'success' ? '#10b981' : '#ef4444'};
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            z-index: 10000;
            animation: slideUp 0.3s ease;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideDown 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }
}

// Add animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideUp {
        from {
            transform: translateX(-50%) translateY(100%);
            opacity: 0;
        }
        to {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
        }
    }
    
    @keyframes slideDown {
        from {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
        }
        to {
            transform: translateX(-50%) translateY(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new SimplePopupManager();
});