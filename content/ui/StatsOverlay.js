/**
 * StatsOverlay - Centered floating stats dashboard
 * Shows usage stats, word counts, and recent activity in a glassmorphic overlay
 */

class StatsOverlay {
    constructor(mainOverlay) {
        this.mainOverlay = mainOverlay;
        this.storage = mainOverlay.storage;
        this.state = mainOverlay.state;
        this.logger = mainOverlay.logger;

        this.overlay = null;
        this.isVisible = false;

        this.setupOverlay();
        this.setupEventListeners();
    }

    setupOverlay() {
        // Create overlay container
        this.overlay = document.createElement('div');
        this.overlay.id = 'vocaminary-stats-overlay';
        this.overlay.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) scale(0.95);
            background: rgba(15, 15, 15, 0.75);
            backdrop-filter: blur(40px) saturate(180%);
            -webkit-backdrop-filter: blur(40px) saturate(180%);
            border: 1px solid rgba(255, 255, 255, 0.18);
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6), 0 0 80px rgba(239, 68, 68, 0.15);
            z-index: 2147483647;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.3s ease, transform 0.3s ease;
            width: 800px;
            max-width: 90vw;
            max-height: 85vh;
            overflow: hidden;
            display: flex;
            flex-direction: column;
        `;

        // Create backdrop
        this.backdrop = document.createElement('div');
        this.backdrop.id = 'vocaminary-stats-backdrop';
        this.backdrop.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(4px);
            -webkit-backdrop-filter: blur(4px);
            z-index: 2147483646;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.3s ease;
        `;

        // Append to body
        document.body.appendChild(this.backdrop);
        document.body.appendChild(this.overlay);

        this.logger.info('📊 Stats overlay initialized');
    }

    setupEventListeners() {
        // Close on backdrop click
        this.backdrop.addEventListener('click', () => this.hide());

        // Close on ESC key
        document.addEventListener('keydown', (e) => {
            if (this.isVisible && e.key === 'Escape') {
                this.hide();
            }
        });

        // Listen for toggle message from background script
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'toggleStatsOverlay') {
                this.toggle();
                sendResponse({ success: true });
            }
        });
    }

    async show() {
        if (this.isVisible) return;

        this.logger.info('📊 Showing stats overlay');

        // Load data
        await this.loadData();

        // Show overlay
        this.backdrop.style.pointerEvents = 'auto';
        this.backdrop.style.opacity = '1';
        this.overlay.style.pointerEvents = 'auto';
        this.overlay.style.opacity = '1';
        this.overlay.style.transform = 'translate(-50%, -50%) scale(1)';

        this.isVisible = true;

        // Prevent body scroll
        document.body.style.overflow = 'hidden';
    }

    hide() {
        if (!this.isVisible) return;

        this.logger.info('📊 Hiding stats overlay');

        this.backdrop.style.opacity = '0';
        this.backdrop.style.pointerEvents = 'none';
        this.overlay.style.opacity = '0';
        this.overlay.style.pointerEvents = 'none';
        this.overlay.style.transform = 'translate(-50%, -50%) scale(0.95)';

        this.isVisible = false;

        // Restore body scroll
        document.body.style.overflow = '';
    }

    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    async loadData() {
        // Show loading state
        this.overlay.innerHTML = this.renderLoading();

        try {
            // Load all data in parallel
            const [connectionStatus, usageLimits, apiUsage, wordStats, recentVideos] = await Promise.all([
                this.getConnectionStatus(),
                this.getUsageLimits(),
                this.getApiUsage(),
                this.getWordStats(),
                this.getRecentVideos()
            ]);

            // Render full content
            this.overlay.innerHTML = this.render({
                connectionStatus,
                usageLimits,
                apiUsage,
                wordStats,
                recentVideos
            });

            // Attach event listeners to buttons
            this.attachButtonListeners();

        } catch (error) {
            this.logger.error('❌ Error loading stats data:', error);
            this.overlay.innerHTML = this.renderError();
        }
    }

    async getConnectionStatus() {
        const { vocabToken, vocabTokenExpiry } = await chrome.storage.sync.get(['vocabToken', 'vocabTokenExpiry']);
        const isConnected = !!vocabToken;

        let status = 'offline';
        let statusText = 'Offline';

        if (isConnected) {
            if (vocabTokenExpiry && Date.now() >= vocabTokenExpiry) {
                status = 'expired';
                statusText = 'Expired';
            } else if (vocabTokenExpiry) {
                const daysLeft = Math.floor((vocabTokenExpiry - Date.now()) / (24 * 60 * 60 * 1000));
                if (daysLeft <= 3) {
                    status = 'warning';
                    statusText = `Expires in ${daysLeft}d`;
                } else {
                    status = 'connected';
                    statusText = 'Connected';
                }
            } else {
                status = 'connected';
                statusText = 'Connected';
            }
        }

        return { status, statusText };
    }

    async getUsageLimits() {
        const { vocabToken } = await chrome.storage.sync.get(['vocabToken']);

        if (!vocabToken) {
            return {
                burst: { used: 0, total: 2 },
                hourly: { used: 0, total: 5 },
                daily: { used: 0, total: 20 }
            };
        }

        try {
            const response = await fetch('https://app.vocaminary.com/api/subtitles/check-limit', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${vocabToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                return this.parseUsageData(data.usage);
            }
        } catch (error) {
            this.logger.error('Error fetching usage limits:', error);
        }

        return {
            burst: { used: 0, total: 2 },
            hourly: { used: 0, total: 5 },
            daily: { used: 0, total: 20 }
        };
    }

    parseUsageData(usage) {
        const parseString = (str) => {
            const [used, total] = str.split('/').map(Number);
            return { used, total };
        };

        return {
            burst: parseString(usage.burst),
            hourly: parseString(usage.hourly),
            daily: parseString(usage.daily)
        };
    }

    async getApiUsage() {
        const { apiMode, vocabToken } = await chrome.storage.sync.get(['apiMode', 'vocabToken']);

        if (apiMode === 'own') {
            return {
                mode: 'own',
                usage: 0,
                limit: -1,
                text: 'Using your own OpenAI API key'
            };
        }

        if (!vocabToken) {
            return {
                mode: 'public',
                usage: 0,
                limit: 50,
                text: 'Connect to Vocaminary to use public API'
            };
        }

        try {
            const response = await fetch('https://app.vocaminary.com/api/progress', {
                headers: {
                    'Authorization': `Bearer ${vocabToken}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                return {
                    mode: 'public',
                    usage: data.aiUsage || 0,
                    limit: data.aiLimit,
                    remaining: data.aiRemaining,
                    tier: data.badge,
                    text: data.aiLimit === -1
                        ? `${data.badge} - Unlimited lookups`
                        : `${data.badge} - ${data.aiRemaining} lookups remaining`
                };
            }
        } catch (error) {
            this.logger.error('Error fetching API usage:', error);
        }

        return {
            mode: 'public',
            usage: 0,
            limit: 50,
            text: 'Failed to load usage data'
        };
    }

    async getWordStats() {
        const storage = await chrome.storage.local.get(['savedWordsData']);
        const savedWords = storage.savedWordsData || {};
        const totalCount = Object.keys(savedWords).length;

        const today = new Date().toDateString();
        let todayCount = 0;

        Object.values(savedWords).forEach(word => {
            const wordDate = new Date(word.savedAt || word.timestamp).toDateString();
            if (wordDate === today) {
                todayCount++;
            }
        });

        return { total: totalCount, today: todayCount };
    }

    async getRecentVideos() {
        const { vocabToken } = await chrome.storage.sync.get(['vocabToken']);

        if (!vocabToken) {
            return [];
        }

        try {
            const response = await fetch('https://app.vocaminary.com/api/my-videos', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${vocabToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                return (data.videos || []).slice(0, 3);
            }
        } catch (error) {
            this.logger.error('Error fetching recent videos:', error);
        }

        return [];
    }

    renderLoading() {
        return `
            <div style="
                width: 100%;
                height: 400px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: rgba(255, 255, 255, 0.5);
            ">
                <div style="text-align: center;">
                    <div class="stats-spinner" style="
                        width: 40px;
                        height: 40px;
                        border: 3px solid rgba(239, 68, 68, 0.2);
                        border-top-color: #ef4444;
                        border-radius: 50%;
                        animation: spin 0.8s linear infinite;
                        margin: 0 auto 16px;
                    "></div>
                    <div style="font-size: 14px; font-weight: 500;">Loading stats...</div>
                </div>
                <style>
                    @keyframes spin {
                        to { transform: rotate(360deg); }
                    }
                </style>
            </div>
        `;
    }

    renderError() {
        return `
            <div style="
                width: 100%;
                height: 400px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: rgba(255, 255, 255, 0.7);
            ">
                <div style="text-align: center;">
                    <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
                    <div style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">Failed to load stats</div>
                    <div style="font-size: 13px; color: rgba(255, 255, 255, 0.5);">Please try again later</div>
                </div>
            </div>
        `;
    }

    render(data) {
        return `
            ${this.renderHeader(data.connectionStatus)}
            <div style="
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 1px;
                background: rgba(255, 255, 255, 0.05);
                flex: 1;
                overflow-y: auto;
            ">
                <!-- Left Column -->
                <div style="background: rgba(255, 255, 255, 0.02); padding: 20px;">
                    ${this.renderUsageLimits(data.usageLimits)}
                    ${this.renderApiUsage(data.apiUsage)}
                </div>

                <!-- Right Column -->
                <div style="background: rgba(255, 255, 255, 0.02); padding: 20px;">
                    ${this.renderWordStats(data.wordStats)}
                    ${this.renderRecentVideos(data.recentVideos)}
                </div>
            </div>
            ${this.renderFooter()}
        `;
    }

    renderHeader(connectionStatus) {
        const statusColors = {
            connected: '#10b981',
            warning: '#f59e0b',
            expired: '#ef4444',
            offline: '#ef4444'
        };

        return `
            <div style="
                padding: 20px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                display: flex;
                align-items: center;
                justify-content: space-between;
                background: linear-gradient(135deg, rgba(239, 68, 68, 0.12) 0%, rgba(220, 38, 38, 0.03) 100%);
            ">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="#ef4444"/>
                        <path d="M2 17L12 22L22 17" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M2 12L12 17L22 12" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <div>
                        <h2 style="
                            font-size: 20px;
                            font-weight: 700;
                            color: white;
                            margin: 0;
                            letter-spacing: -0.5px;
                        ">Vocaminary Stats</h2>
                        <p style="
                            font-size: 12px;
                            color: rgba(255, 255, 255, 0.5);
                            margin: 2px 0 0 0;
                        ">Your learning dashboard</p>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        padding: 6px 12px;
                        background: rgba(255, 255, 255, 0.05);
                        border-radius: 12px;
                        font-size: 11px;
                        font-weight: 600;
                    ">
                        <div style="
                            width: 8px;
                            height: 8px;
                            border-radius: 50%;
                            background: ${statusColors[connectionStatus.status]};
                            box-shadow: 0 0 10px ${statusColors[connectionStatus.status]};
                        "></div>
                        ${connectionStatus.statusText}
                    </div>
                    <button id="stats-close-btn" style="
                        width: 32px;
                        height: 32px;
                        border: none;
                        background: rgba(255, 255, 255, 0.08);
                        border-radius: 8px;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        transition: all 0.2s;
                    " onmouseover="this.style.background='rgba(239, 68, 68, 0.15)'" onmouseout="this.style.background='rgba(255, 255, 255, 0.08)'">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M18 6L6 18M6 6L18 18" stroke="white" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }

    renderUsageLimits(limits) {
        return `
            <div style="margin-bottom: 24px;">
                <h3 style="
                    font-size: 11px;
                    font-weight: 700;
                    color: rgba(255, 255, 255, 0.6);
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin: 0 0 12px 0;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                ">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" fill="#ef4444"/>
                    </svg>
                    Subtitle Fetch Limits
                </h3>
                ${this.renderProgressItem('Next 5 minutes', limits.burst)}
                ${this.renderProgressItem('This hour', limits.hourly)}
                ${this.renderProgressItem('Today', limits.daily)}
            </div>
        `;
    }

    renderProgressItem(label, data) {
        const percent = Math.round((data.used / data.total) * 100);
        let barColor = '#ef4444';
        if (percent < 70) barColor = '#ef4444';
        else if (percent < 90) barColor = '#f59e0b';

        return `
            <div style="margin-bottom: 12px;">
                <div style="
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-size: 11px;
                    color: rgba(255, 255, 255, 0.7);
                    margin-bottom: 6px;
                ">
                    <span>${label}</span>
                    <span style="font-weight: 600;">${data.used}/${data.total}</span>
                </div>
                <div style="
                    height: 6px;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 3px;
                    overflow: hidden;
                ">
                    <div style="
                        height: 100%;
                        width: ${percent}%;
                        background: linear-gradient(90deg, ${barColor}, ${barColor}dd);
                        border-radius: 3px;
                        transition: width 0.4s ease;
                        box-shadow: 0 0 10px ${barColor}80;
                    "></div>
                </div>
            </div>
        `;
    }

    renderApiUsage(apiUsage) {
        const percent = apiUsage.limit === -1 ? 100 : Math.round((apiUsage.usage / apiUsage.limit) * 100);
        const displayText = apiUsage.limit === -1 ? '∞ Unlimited' : `${apiUsage.usage}/${apiUsage.limit}`;

        return `
            <div style="margin-bottom: 24px;">
                <h3 style="
                    font-size: 11px;
                    font-weight: 700;
                    color: rgba(255, 255, 255, 0.6);
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin: 0 0 12px 0;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                ">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M9.813 15.904L9 18.75L6 14.625H3.75L9.375 3.375L12.188 8.907" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M18 20.25L14.625 13.5H12L15 9.375L21 20.25H18Z" fill="#ef4444"/>
                    </svg>
                    AI Word Lookups
                </h3>
                <div style="margin-bottom: 12px;">
                    <div style="
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        font-size: 11px;
                        color: rgba(255, 255, 255, 0.7);
                        margin-bottom: 6px;
                    ">
                        <span>Today's Lookups</span>
                        <span style="font-weight: 600;">${displayText}</span>
                    </div>
                    <div style="
                        height: 6px;
                        background: rgba(255, 255, 255, 0.1);
                        border-radius: 3px;
                        overflow: hidden;
                    ">
                        <div style="
                            height: 100%;
                            width: ${percent}%;
                            background: linear-gradient(90deg, ${apiUsage.limit === -1 ? '#10b981' : '#ef4444'}, ${apiUsage.limit === -1 ? '#059669' : '#dc2626'});
                            border-radius: 3px;
                            transition: width 0.4s ease;
                            box-shadow: 0 0 10px ${apiUsage.limit === -1 ? '#10b981' : '#ef4444'}80;
                        "></div>
                    </div>
                </div>
                <div style="
                    font-size: 10px;
                    color: rgba(255, 255, 255, 0.6);
                    padding: 8px;
                    background: rgba(255, 255, 255, 0.03);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 6px;
                ">${apiUsage.text}</div>
            </div>
        `;
    }

    renderWordStats(stats) {
        return `
            <div style="margin-bottom: 24px;">
                <h3 style="
                    font-size: 11px;
                    font-weight: 700;
                    color: rgba(255, 255, 255, 0.6);
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin: 0 0 12px 0;
                ">Your Progress</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    ${this.renderStatCard('Words Saved', stats.total)}
                    ${this.renderStatCard('Today', stats.today)}
                </div>
            </div>
        `;
    }

    renderStatCard(label, value) {
        return `
            <div style="
                text-align: center;
                padding: 16px;
                background: rgba(239, 68, 68, 0.08);
                border: 1px solid rgba(239, 68, 68, 0.15);
                border-radius: 12px;
                transition: all 0.3s ease;
            ">
                <div style="
                    font-size: 28px;
                    font-weight: 700;
                    background: linear-gradient(135deg, #ef4444, #f87171);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    margin-bottom: 4px;
                ">${value}</div>
                <div style="
                    font-size: 10px;
                    color: rgba(255, 255, 255, 0.5);
                    text-transform: uppercase;
                    letter-spacing: 0.8px;
                    font-weight: 600;
                ">${label}</div>
            </div>
        `;
    }

    renderRecentVideos(videos) {
        if (videos.length === 0) {
            return '';
        }

        return `
            <div>
                <h3 style="
                    font-size: 11px;
                    font-weight: 700;
                    color: rgba(255, 255, 255, 0.6);
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin: 0 0 12px 0;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                ">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="2" y="6" width="20" height="12" rx="2" stroke="#ef4444" stroke-width="2"/>
                        <path d="M10 9L15 12L10 15V9Z" fill="#ef4444"/>
                    </svg>
                    Recent Videos
                </h3>
                ${videos.map(video => this.renderVideoItem(video)).join('')}
            </div>
        `;
    }

    renderVideoItem(video) {
        return `
            <div class="stats-video-item" data-video-id="${video.video_id}" style="
                display: flex;
                gap: 10px;
                padding: 10px;
                background: rgba(255, 255, 255, 0.02);
                border: 1px solid rgba(255, 255, 255, 0.05);
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.3s ease;
                margin-bottom: 8px;
            " onmouseover="this.style.background='rgba(239, 68, 68, 0.08)'; this.style.borderColor='rgba(239, 68, 68, 0.25)'" onmouseout="this.style.background='rgba(255, 255, 255, 0.02)'; this.style.borderColor='rgba(255, 255, 255, 0.05)'">
                <img
                    src="https://img.youtube.com/vi/${video.video_id}/default.jpg"
                    alt="${this.escapeHtml(video.video_title || 'Video')}"
                    style="
                        width: 60px;
                        height: 34px;
                        border-radius: 6px;
                        object-fit: cover;
                        background: rgba(255, 255, 255, 0.02);
                        flex-shrink: 0;
                    "
                    onerror="this.style.display='none'"
                >
                <div style="flex: 1; min-width: 0;">
                    <div style="
                        font-size: 12px;
                        font-weight: 500;
                        color: rgba(255, 255, 255, 0.9);
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                        margin-bottom: 4px;
                    ">${this.escapeHtml(video.video_title || 'Unknown Video')}</div>
                    <div style="
                        font-size: 10px;
                        color: rgba(255, 255, 255, 0.5);
                        display: flex;
                        gap: 10px;
                    ">
                        <span>${video.words_saved || 0} words</span>
                        <span>${video.view_count || 1} views</span>
                        <span>${this.formatTimeAgo(video.last_viewed)}</span>
                    </div>
                </div>
            </div>
        `;
    }

    renderFooter() {
        return `
            <div style="
                padding: 16px 20px;
                border-top: 1px solid rgba(255, 255, 255, 0.1);
                display: flex;
                gap: 10px;
                background: rgba(255, 255, 255, 0.03);
            ">
                <button id="stats-dashboard-btn" style="
                    flex: 1;
                    padding: 10px;
                    border: none;
                    border-radius: 10px;
                    background: linear-gradient(135deg, #ef4444, #dc2626);
                    color: white;
                    font-size: 12px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
                " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(239, 68, 68, 0.5)'" onmouseout="this.style.transform=''; this.style.boxShadow='0 4px 12px rgba(239, 68, 68, 0.3)'">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="3" y="3" width="7" height="7" rx="1" fill="currentColor"/>
                        <rect x="14" y="3" width="7" height="7" rx="1" fill="currentColor"/>
                        <rect x="3" y="14" width="7" height="7" rx="1" fill="currentColor"/>
                        <rect x="14" y="14" width="7" height="7" rx="1" fill="currentColor"/>
                    </svg>
                    Dashboard
                </button>
                <button id="stats-settings-btn" style="
                    flex: 1;
                    padding: 10px;
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 10px;
                    background: rgba(255, 255, 255, 0.03);
                    color: rgba(255, 255, 255, 0.8);
                    font-size: 12px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                " onmouseover="this.style.background='rgba(255, 255, 255, 0.08)'; this.style.color='white'" onmouseout="this.style.background='rgba(255, 255, 255, 0.03)'; this.style.color='rgba(255, 255, 255, 0.8)'">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/>
                        <path d="M12 1V3M12 21V23M4.22 4.22L5.64 5.64M18.36 18.36L19.78 19.78M1 12H3M21 12H23M4.22 19.78L5.64 18.36M18.36 5.64L19.78 4.22" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    Settings
                </button>
            </div>
        `;
    }

    attachButtonListeners() {
        // Close button
        const closeBtn = this.overlay.querySelector('#stats-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hide());
        }

        // Dashboard button
        const dashboardBtn = this.overlay.querySelector('#stats-dashboard-btn');
        if (dashboardBtn) {
            dashboardBtn.addEventListener('click', async () => {
                const { vocabToken } = await chrome.storage.sync.get(['vocabToken']);
                const url = vocabToken
                    ? 'https://app.vocaminary.com'
                    : 'https://app.vocaminary.com/extension-auth';
                window.open(url, '_blank');
            });
        }

        // Settings button
        const settingsBtn = this.overlay.querySelector('#stats-settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                chrome.runtime.sendMessage({ action: 'openSettings' });
            });
        }

        // Video items
        const videoItems = this.overlay.querySelectorAll('.stats-video-item');
        videoItems.forEach(item => {
            item.addEventListener('click', () => {
                const videoId = item.dataset.videoId;
                window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank');
            });
        });
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
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return `${Math.floor(diffDays / 7)}w ago`;
    }
}

// Export for use in main overlay
window.StatsOverlay = StatsOverlay;
