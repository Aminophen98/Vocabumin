/**
 * NotificationService - Unified notification system for all user-facing messages
 *
 * Features:
 * - Single entry point for all notifications
 * - Consistent positioning and styling
 * - Prevents duplicate/overlapping notifications
 * - Automatic cleanup and animation
 * - Queue system for multiple notifications
 */
class NotificationService {
    constructor(logger) {
        this.logger = logger || console;

        // Track active notifications to prevent duplicates
        this.activeNotifications = new Map();

        // Notification queue for rate limit scenarios
        this.notificationQueue = [];
        this.isProcessingQueue = false;

        // Z-index hierarchy (standardized)
        this.Z_INDEX = {
            CACHE_STATUS: 9000,      // Top-right corner indicators
            USAGE_INDICATOR: 9001,   // Bottom-left usage counter
            PLAYER_NOTIFICATION: 9002, // Player overlay messages
            ERROR_MODAL: 9003,       // Full-screen error overlays
            TOOLTIP: 9004            // Word tooltips (highest priority)
        };

        // Consistent color palette
        this.COLORS = {
            SUCCESS: { bg: 'rgba(16, 185, 129, 0.95)', border: 'rgba(52, 211, 153, 0.5)' },
            INFO: { bg: 'rgba(59, 130, 246, 0.95)', border: 'rgba(96, 165, 250, 0.5)' },
            WARNING: { bg: 'rgba(245, 158, 11, 0.95)', border: 'rgba(251, 191, 36, 0.5)' },
            ERROR: { bg: 'rgba(220, 38, 38, 0.95)', border: 'rgba(239, 68, 68, 0.5)' },
            NEUTRAL: { bg: 'rgba(20, 20, 20, 0.9)', border: 'rgba(60, 60, 60, 0.5)' }
        };

        // Inject global styles once
        this.injectStyles();
    }

    /**
     * Inject global styles for animations
     */
    injectStyles() {
        if (document.getElementById('yt-notification-styles')) return;

        const style = document.createElement('style');
        style.id = 'yt-notification-styles';
        style.textContent = `
            @keyframes yt-notification-fade-in {
                from {
                    opacity: 0;
                    transform: translateY(10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            @keyframes yt-notification-fade-out {
                from {
                    opacity: 1;
                    transform: translateY(0);
                }
                to {
                    opacity: 0;
                    transform: translateY(-10px);
                }
            }

            @keyframes yt-notification-slide-in {
                from {
                    opacity: 0;
                    transform: translateX(100%);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }

            @keyframes yt-notification-slide-out {
                from {
                    opacity: 1;
                    transform: translateX(0);
                }
                to {
                    opacity: 0;
                    transform: translateX(100%);
                }
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Show error modal (positioned over video player, for critical errors)
     *
     * @param {string} message - Error message
     * @param {Object} options - Configuration
     * @param {string} options.type - 'error' | 'warning' | 'info'
     * @param {number} options.duration - Display duration in ms (default: 5000)
     * @param {boolean} options.dismissible - Can user dismiss? (default: true)
     */
    showError(message, options = {}) {
        const {
            type = 'error',
            duration = 5000,
            dismissible = true
        } = options;

        // Prevent duplicate error modals
        const key = 'error-modal';
        if (this.activeNotifications.has(key)) {
            // Update existing notification
            const existing = this.activeNotifications.get(key);
            existing.element.querySelector('.notification-message').innerHTML = message;
            // Reset timeout
            clearTimeout(existing.timeout);
            existing.timeout = setTimeout(() => {
                this.dismissNotification(key);
            }, duration);
            this.logger.debug('[Notification] Updated existing error modal');
            return;
        }

        const colors = this.getColors(type);

        // Create overlay backdrop
        const backdrop = document.createElement('div');
        backdrop.id = 'yt-notification-backdrop';
        backdrop.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: ${this.Z_INDEX.ERROR_MODAL};
            animation: yt-notification-fade-in 0.2s ease;
            backdrop-filter: blur(4px);
            -webkit-backdrop-filter: blur(4px);
        `;

        // Create error modal
        const modal = document.createElement('div');
        modal.id = 'yt-notification-error-modal';
        modal.className = 'yt-notification-modal';

        modal.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: ${colors.bg};
            color: white;
            padding: 20px 28px;
            border-radius: 10px;
            border: 1px solid ${colors.border};
            font-size: 14px;
            line-height: 1.5;
            z-index: ${this.Z_INDEX.ERROR_MODAL + 1};
            box-shadow: 0 8px 32px rgba(0,0,0,0.6);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            max-width: 360px;
            min-width: 280px;
            text-align: center;
            animation: yt-notification-fade-in 0.3s ease;
            pointer-events: auto;
        `;

        // Get icon based on type
        let icon = '';
        switch (type) {
            case 'info':
                icon = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" style="margin: 0 auto 12px;">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                    <path d="M12 16V12M12 8H12.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>`;
                break;
            case 'warning':
                icon = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" style="margin: 0 auto 12px;">
                    <path d="M12 2L2 20h20L12 2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M12 9v4M12 17h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>`;
                break;
            case 'error':
            default:
                icon = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" style="margin: 0 auto 12px;">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                    <path d="M15 9L9 15M9 9l6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>`;
                break;
        }

        modal.innerHTML = `
            ${icon}
            <div class="notification-message" style="margin-bottom: ${dismissible ? '12px' : '0'};">${message}</div>
            ${dismissible ? '<div style="font-size: 11px; opacity: 0.7; margin-top: 8px;">Click anywhere to dismiss</div>' : ''}
        `;

        // Add to DOM
        document.body.appendChild(backdrop);
        document.body.appendChild(modal);

        // Track notification
        const notification = {
            element: modal,
            backdrop: backdrop,
            timeout: null
        };
        this.activeNotifications.set(key, notification);

        // Dismissible click handler
        if (dismissible) {
            const dismissHandler = (e) => {
                this.dismissNotification(key);
                document.removeEventListener('click', dismissHandler);
            };
            setTimeout(() => {
                backdrop.addEventListener('click', dismissHandler);
                modal.addEventListener('click', dismissHandler);
            }, 100); // Delay to prevent immediate dismissal
        }

        // Auto-dismiss
        notification.timeout = setTimeout(() => {
            this.dismissNotification(key);
        }, duration);

        this.logger.debug(`[Notification] Showed error modal: ${message.substring(0, 50)}...`);
    }

    /**
     * Show cache status indicator (top-right corner)
     *
     * @param {string} status - Status type
     * @param {Object} options - Additional options
     */
    showCacheStatus(status, options = {}) {
        const {
            ageMinutes = null,
            duration = 3000
        } = options;

        const key = 'cache-status';

        // Remove existing
        if (this.activeNotifications.has(key)) {
            this.dismissNotification(key);
        }

        const indicator = document.createElement('div');
        indicator.id = 'yt-notification-cache-status';

        // Determine message and color
        let text, bgColor;
        switch (status) {
            case 'cached':
            case 'local_cache':
                text = ageMinutes !== null ? `⚡ Cached (${ageMinutes}m ago)` : '⚡ Cached';
                bgColor = 'rgba(16, 185, 129, 0.9)'; // Green
                break;
            case 'server_cache':
                text = '☁️ Server cache';
                bgColor = 'rgba(139, 92, 246, 0.9)'; // Purple
                break;
            case 'vocaminary':
                text = '🌐 Vocaminary API';
                bgColor = 'rgba(59, 130, 246, 0.9)'; // Blue
                break;
            case 'local-ytdlp':
                text = '💻 Local Server';
                bgColor = 'rgba(245, 158, 11, 0.9)'; // Amber
                break;
            case 'fresh':
            default:
                text = '🔄 Fresh fetch';
                bgColor = 'rgba(96, 165, 250, 0.9)'; // Light blue
                break;
        }

        indicator.style.cssText = `
            position: fixed;
            top: 70px;
            right: 20px;
            background: ${bgColor};
            color: white;
            padding: 8px 14px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 500;
            z-index: ${this.Z_INDEX.CACHE_STATUS};
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            animation: yt-notification-slide-in 0.3s ease;
        `;

        indicator.textContent = text;
        document.body.appendChild(indicator);

        // Track notification
        const notification = {
            element: indicator,
            timeout: setTimeout(() => {
                this.dismissNotification(key);
            }, duration)
        };
        this.activeNotifications.set(key, notification);

        this.logger.debug(`[Notification] Cache status: ${text}`);
    }

    /**
     * Show API usage indicator (bottom-left corner)
     * Only shown in public API mode
     *
     * @param {number} current - Current usage
     * @param {number} limit - Total limit
     */
    showUsageIndicator(current, limit) {
        const key = 'usage-indicator';

        // Calculate percentage
        const percentage = (current / limit) * 100;

        // Create or update indicator
        let indicator = this.activeNotifications.has(key)
            ? this.activeNotifications.get(key).element
            : null;

        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'yt-notification-usage-indicator';

            // Choose color based on usage
            let bgColor, textColor;
            if (percentage >= 90) {
                bgColor = 'rgba(220, 38, 38, 0.9)'; // Red
                textColor = 'white';
            } else if (percentage >= 70) {
                bgColor = 'rgba(245, 158, 11, 0.9)'; // Orange
                textColor = 'white';
            } else {
                bgColor = 'rgba(20, 20, 20, 0.9)'; // Dark
                textColor = 'white';
            }

            indicator.style.cssText = `
                position: fixed;
                bottom: 20px;
                left: 20px;
                background: ${bgColor};
                color: ${textColor};
                padding: 8px 14px;
                border-radius: 8px;
                font-size: 12px;
                font-weight: 500;
                z-index: ${this.Z_INDEX.USAGE_INDICATOR};
                box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                animation: yt-notification-fade-in 0.3s ease;
            `;

            document.body.appendChild(indicator);

            // Track notification (no timeout - persistent)
            this.activeNotifications.set(key, { element: indicator, timeout: null });
        }

        // Update text
        indicator.textContent = `${current}/${limit} lookups used`;

        this.logger.debug(`[Notification] Usage indicator: ${current}/${limit}`);
    }

    /**
     * Hide usage indicator
     */
    hideUsageIndicator() {
        this.dismissNotification('usage-indicator');
    }

    /**
     * Show API limit warning (top-right, below cache status)
     *
     * @param {number} remaining - Remaining lookups
     */
    showLimitWarning(remaining) {
        const key = 'limit-warning';

        // Prevent spam
        if (this.activeNotifications.has(key)) return;

        const warning = document.createElement('div');
        warning.id = 'yt-notification-limit-warning';

        const isUrgent = remaining <= 2;
        const bgColor = isUrgent ? 'rgba(220, 38, 38, 0.95)' : 'rgba(245, 158, 11, 0.95)';

        warning.style.cssText = `
            position: fixed;
            top: 110px;
            right: 20px;
            background: ${bgColor};
            color: white;
            padding: 12px 18px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            z-index: ${this.Z_INDEX.CACHE_STATUS};
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            animation: yt-notification-slide-in 0.3s ease;
            max-width: 280px;
        `;

        warning.innerHTML = `
            ⚠️ Only <strong>${remaining}</strong> lookup${remaining === 1 ? '' : 's'} left today!
            ${isUrgent ? '<div style="margin-top: 6px; font-size: 12px; opacity: 0.95;">Consider using your own API key</div>' : ''}
        `;

        document.body.appendChild(warning);

        // Track notification
        const notification = {
            element: warning,
            timeout: setTimeout(() => {
                this.dismissNotification(key);
            }, 5000)
        };
        this.activeNotifications.set(key, notification);

        this.logger.info(`[Notification] Limit warning: ${remaining} remaining`);
    }

    /**
     * Show player notification (video player overlay, bottom-center)
     * For quick, non-critical messages
     *
     * @param {string} message - Notification message
     * @param {number} duration - Display duration (default: 3000ms)
     */
    showPlayerNotification(message, duration = 3000) {
        const key = 'player-notification';

        // Update existing if present
        if (this.activeNotifications.has(key)) {
            const existing = this.activeNotifications.get(key);
            existing.element.textContent = message;
            clearTimeout(existing.timeout);
            existing.timeout = setTimeout(() => {
                this.dismissNotification(key);
            }, duration);
            return;
        }

        const notification = document.createElement('div');
        notification.id = 'yt-notification-player';

        notification.style.cssText = `
            position: absolute;
            bottom: 70px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 12px 20px;
            border-radius: 6px;
            font-size: 14px;
            z-index: ${this.Z_INDEX.PLAYER_NOTIFICATION};
            pointer-events: none;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            animation: yt-notification-fade-in 0.3s ease;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;

        notification.textContent = message;

        // Add to player container
        const player = document.querySelector('#movie_player');
        if (player) {
            player.appendChild(notification);
        } else {
            // Fallback to body
            notification.style.position = 'fixed';
            notification.style.bottom = '80px';
            document.body.appendChild(notification);
        }

        // Track notification
        const notif = {
            element: notification,
            timeout: setTimeout(() => {
                this.dismissNotification(key);
            }, duration)
        };
        this.activeNotifications.set(key, notif);

        this.logger.debug(`[Notification] Player: ${message}`);
    }

    /**
     * Dismiss a notification by key
     *
     * @param {string} key - Notification key
     */
    dismissNotification(key) {
        if (!this.activeNotifications.has(key)) return;

        const notification = this.activeNotifications.get(key);

        // Clear timeout
        if (notification.timeout) {
            clearTimeout(notification.timeout);
        }

        // Animate out the main element
        notification.element.style.animation = 'yt-notification-fade-out 0.3s ease';

        // Animate out backdrop if present
        if (notification.backdrop) {
            notification.backdrop.style.animation = 'yt-notification-fade-out 0.2s ease';
        }

        setTimeout(() => {
            if (notification.element.parentNode) {
                notification.element.remove();
            }
            if (notification.backdrop && notification.backdrop.parentNode) {
                notification.backdrop.remove();
            }
            this.activeNotifications.delete(key);
        }, 300);

        this.logger.debug(`[Notification] Dismissed: ${key}`);
    }

    /**
     * Clear all notifications
     */
    clearAll() {
        this.activeNotifications.forEach((notification, key) => {
            this.dismissNotification(key);
        });
        this.logger.debug('[Notification] Cleared all notifications');
    }

    /**
     * Get color scheme for notification type
     */
    getColors(type) {
        switch (type) {
            case 'success':
                return this.COLORS.SUCCESS;
            case 'info':
                return this.COLORS.INFO;
            case 'warning':
                return this.COLORS.WARNING;
            case 'error':
                return this.COLORS.ERROR;
            default:
                return this.COLORS.NEUTRAL;
        }
    }

    /**
     * Format error messages with better user-friendly text (HTML formatted)
     */
    formatErrorMessage(errorType, errorDetails = {}) {
        switch (errorType) {
            // Subtitle fetch errors
            case 'no_transcript':
                return `<div style="font-weight: 500; margin-bottom: 8px;">This video doesn't have subtitles</div><div style="opacity: 0.9;">The creator hasn't added captions yet.</div>`;

            case 'transcripts_disabled':
                return `<div style="font-weight: 500; margin-bottom: 8px;">Subtitles are disabled</div><div style="opacity: 0.9;">The creator has disabled captions for this video.</div>`;

            case 'video_unavailable':
                return `<div style="font-weight: 500; margin-bottom: 8px;">Video unavailable</div><div style="opacity: 0.9;">The video may be private, deleted, or have an invalid ID.</div>`;

            case 'wrong_language':
                const lang = errorDetails.requestedLanguage || 'selected language';
                const available = errorDetails.availableLanguages
                    ? `<div style="margin-top: 8px; font-size: 12px; opacity: 0.8;">Available: ${errorDetails.availableLanguages.join(', ')}</div>`
                    : '';
                return `<div style="font-weight: 500; margin-bottom: 8px;">No subtitles in ${lang}</div>${available}`;

            // Network errors
            case 'network_error':
                return `<div style="font-weight: 500; margin-bottom: 8px;">Connection problem</div><div style="opacity: 0.9;">Please check your internet and try again.</div>`;

            case 'timeout':
                return `<div style="font-weight: 500; margin-bottom: 8px;">Request timed out</div><div style="opacity: 0.9;">The server took too long to respond.</div>`;

            // Rate limiting
            case 'rate_limited':
                const waitTime = errorDetails.waitMinutes || 'a few';
                return `<div style="font-weight: 500; margin-bottom: 8px;">Too many requests</div><div style="opacity: 0.9;">Please wait ${waitTime} minutes and try again.</div>`;

            case 'daily_limit':
                return `<div style="font-weight: 500; margin-bottom: 8px;">Daily limit reached</div><div style="opacity: 0.9;">You've used all subtitle fetches for today.<br>Try again tomorrow!</div>`;

            // Server errors
            case 'youtube_ip_blocked':
                const warpNote = errorDetails.warpActive === false
                    ? `<div style="margin-top: 8px; padding: 8px; background: rgba(255,255,255,0.1); border-radius: 6px; font-size: 12px;">⚠️ Server proxy is inactive</div>`
                    : '';
                return `<div style="font-weight: 500; margin-bottom: 8px;">YouTube is blocking requests</div><div style="opacity: 0.9;">The server administrator has been notified.<br>Try again later or use a local server.</div>${warpNote}`;

            case 'server_error':
                const serverMsg = errorDetails.message ? `<div style="margin-top: 8px; font-size: 12px; opacity: 0.7;">${errorDetails.message}</div>` : '';
                return `<div style="font-weight: 500; margin-bottom: 8px;">Server error</div><div style="opacity: 0.9;">Please try again in a few moments.</div>${serverMsg}`;

            case 'server_unavailable':
                return `<div style="font-weight: 500; margin-bottom: 8px;">Server unavailable</div><div style="opacity: 0.9;">The server may be down for maintenance.<br>Try again later or switch to cloud API.</div>`;

            // API errors
            case 'api_key_missing':
                return `<div style="font-weight: 500; margin-bottom: 8px;">API key not set</div><div style="opacity: 0.9;">Please add your OpenAI API key in extension settings.</div>`;

            case 'api_limit_reached':
                const limit = errorDetails.limit || 10;
                return `<div style="font-weight: 500; margin-bottom: 8px;">Daily API limit reached</div><div style="opacity: 0.9;">You've used ${limit} lookups today.<br>Wait until tomorrow or upgrade for unlimited.</div>`;

            // Generic fallback
            case 'unknown_error':
            default:
                const details = errorDetails.message ? `<div style="margin-top: 8px; font-size: 12px; opacity: 0.7;">${errorDetails.message}</div>` : '';
                return `<div style="font-weight: 500; margin-bottom: 8px;">Something went wrong</div><div style="opacity: 0.9;">Please try again.</div>${details}`;
        }
    }
}
