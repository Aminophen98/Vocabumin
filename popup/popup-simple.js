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
                chrome.tabs.create({ url: 'https://yourvocab.vercel.app' });
            } else {
                // Not connected - open auth page
                chrome.tabs.create({ url: 'https://yourvocab.vercel.app/extension-auth' });
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
            // Check YourVocab connection
            const { vocabToken, vocabTokenExpiry } = await chrome.storage.sync.get(['vocabToken', 'vocabTokenExpiry']);
            const isConnected = !!vocabToken;

            if (isConnected) {
                // Check if token is expired
                if (vocabTokenExpiry && Date.now() >= vocabTokenExpiry) {
                    this.statusDot.classList.add('disconnected');
                    this.statusText.textContent = 'Expired';
                    this.dashboardBtn.innerHTML = '<span>🔗</span> Reconnect';
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
                    this.dashboardBtn.innerHTML = '<span>📊</span> Dashboard';
                }
            } else {
                this.statusDot.classList.add('disconnected');
                this.statusText.textContent = 'Offline';

                // Update button for disconnected state
                this.dashboardBtn.innerHTML = '<span>🔗</span> Connect to Web App';
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
            const response = await fetch('https://yourvocab.vercel.app/api/subtitles/check-limit', {
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
        percentElement.textContent = percent > 10 ? `${percent}%` : '';
        
        this.updateBarColor(barElement, percent);
    }

    showRateLimitWarning(waitTime, reason) {
        const minutes = Math.ceil(waitTime / 60);
        const message = reason === 'burst_limit' 
            ? `⏰ Wait ${minutes} minutes (5-min limit)`
            : reason === 'hourly_limit'
            ? `⏰ Wait ${minutes} minutes (hourly limit)`
            : `⏰ Daily limit reached - resets at midnight`;

        // Create or update warning element
        let warning = document.getElementById('rateLimitWarning');
        if (!warning) {
            warning = document.createElement('div');
            warning.id = 'rateLimitWarning';
            warning.style.cssText = `
                padding: 12px;
                background: #fef3c7;
                border-left: 4px solid #f59e0b;
                color: #92400e;
                font-size: 13px;
                font-weight: 600;
                margin-bottom: 16px;
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
                this.apiModeText.textContent = '🔑 Using your own OpenAI API key';
                return;
            }

            // Using public API - need to fetch real limits
            if (!storage.vocabToken) {
                this.apiCount.textContent = 'Not connected';
                this.apiModeInfo.style.display = 'block';
                this.apiModeText.textContent = '⚠️ Connect to YourVocab to use public API';
                return;
            }

            // Fetch user's tier and limits from API
            const response = await fetch('https://yourvocab.vercel.app/api/progress', {
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
                this.apiModeText.textContent = `💎 ${data.badge} - Unlimited lookups`;
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
                this.apiModeText.textContent = `${data.badgeEmoji} ${data.badge} - ${remaining} lookups remaining this month`;
            }

            console.log('[YT Popup] 📊 Tier:', data.tier, 'Usage:', usage, 'Limit:', limit);

        } catch (error) {
            console.error('[YT Popup] ❌ Error loading API usage:', error);
            this.apiCount.textContent = 'Error';
            this.apiModeInfo.style.display = 'block';
            this.apiModeText.textContent = '❌ Failed to load usage data';
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
            const response = await fetch('https://yourvocab.vercel.app/api/my-videos', {
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
                            <span>📚 ${video.words_saved || 0}</span>
                            <span>👁️ ${video.view_count || 1}</span>
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