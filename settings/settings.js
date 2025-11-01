/**
 * Settings Page JavaScript
 * Manages all extension settings and cache operations
 */

class SettingsManager {
    constructor() {
        this.videosLoaded = false; // Flag to track if videos have been loaded
        this.initializeElements();
        this.attachEventListeners();
        this.loadCurrentSettings();
        this.updateCacheStats();
        // Don't load videos on init - only when tab is clicked
    }

    initializeElements() {
        // API Configuration
        this.apiModeRadios = document.querySelectorAll('input[name="apiMode"]');
        this.apiKeyInput = document.getElementById('apiKey');
        this.apiKeyGroup = document.getElementById('apiKeyGroup');
        this.targetLanguageSelect = document.getElementById('targetLanguage');
        this.definitionLevelSelect = document.getElementById('definitionLevel');

        // Subtitle Server
        this.subtitleServerRadios = document.querySelectorAll('input[name="subtitleServer"]');

        // Cache Management
        this.clearCacheBtn = document.getElementById('clearCacheBtn');
        this.clearWordsBtn = document.getElementById('clearWordsBtn');
        this.exportDataBtn = document.getElementById('exportDataBtn');
        this.cacheVideoCount = document.getElementById('cacheVideoCount');
        this.cacheSize = document.getElementById('cacheSize');
        this.savedWordsCount = document.getElementById('savedWords');

        // Advanced Settings
        this.debugModeCheckbox = document.getElementById('debugMode');
        this.autoCacheCheckbox = document.getElementById('autoCache');
        this.cacheExpirySelect = document.getElementById('cacheExpiry');

        // My Videos Section
        this.videosLoading = document.getElementById('videosLoading');
        this.videosError = document.getElementById('videosError');
        this.videosErrorText = document.getElementById('videosErrorText');
        this.videosEmpty = document.getElementById('videosEmpty');
        this.videosList = document.getElementById('videosList');



        // Alert
        this.alertMessage = document.getElementById('alertMessage');
        this.alertText = document.getElementById('alertText');
        this.alertIcon = document.getElementById('alertIcon');
    }

    attachEventListeners() {
        // Tab Navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tabName = btn.dataset.tab;
                this.switchTab(tabName);
            });
        });

        // API Mode Radio Buttons - AUTO SAVE
        this.apiModeRadios.forEach(radio => {
            radio.addEventListener('change', async (e) => {
                this.handleApiModeChange(e.target.value);
                // Update radio option styling
                document.querySelectorAll('.radio-option').forEach(option => {
                    option.classList.toggle('selected', 
                        option.querySelector('input').value === e.target.value);
                });
                // Auto-save
                await this.autoSaveSetting('apiMode', e.target.value);
            });
        });

        // Subtitle Server Radio Buttons - AUTO SAVE
        this.subtitleServerRadios.forEach(radio => {
            radio.addEventListener('change', async (e) => {
                // Update radio option styling
                document.querySelectorAll('.radio-option[data-value="cloud"], .radio-option[data-value="local"]').forEach(option => {
                    option.classList.toggle('selected', 
                        option.querySelector('input').value === e.target.value);
                });
                // Auto-save
                await this.autoSaveSetting('subtitleServer', e.target.value);
            });
        });

        // Radio option click handling
        document.querySelectorAll('.radio-option').forEach(option => {
            option.addEventListener('click', function() {
                const radio = this.querySelector('input[type="radio"]');
                radio.checked = true;
                radio.dispatchEvent(new Event('change'));
            });
        });

        // Cache Management Buttons
        this.clearCacheBtn.addEventListener('click', () => this.clearSubtitleCache());
        this.clearWordsBtn.addEventListener('click', () => this.clearSavedWords());
        this.exportDataBtn.addEventListener('click', () => this.exportData());

        // Auto-save for all inputs
        this.apiKeyInput.addEventListener('blur', async () => {
            if (this.apiKeyInput.value) {
                await this.autoSaveSetting('openaiApiKey', this.apiKeyInput.value);
            }
        });

        this.targetLanguageSelect.addEventListener('change', async (e) => {
            await this.autoSaveSetting('targetLanguage', e.target.value);
        });

        this.definitionLevelSelect.addEventListener('change', async (e) => {
            await this.autoSaveSetting('definitionLevel', e.target.value);
        });

        this.debugModeCheckbox.addEventListener('change', async (e) => {
            await this.autoSaveSetting('debugMode', e.target.checked);
        });

        this.autoCacheCheckbox.addEventListener('change', async (e) => {
            await this.autoSaveSetting('autoCache', e.target.checked);
        });

        this.cacheExpirySelect.addEventListener('change', async (e) => {
            await this.autoSaveSetting('cacheExpiry', e.target.value);
        });



        // Back to popup link
        document.getElementById('backToPopup').addEventListener('click', (e) => {
            e.preventDefault();
            window.close();
        });
    }

    async loadCurrentSettings() {
        try {
            const settings = await chrome.storage.sync.get([
                'apiMode',
                'openaiApiKey',
                'targetLanguage',
                'definitionLevel',
                'subtitleServer',
                'debugMode',
                'autoCache',
                'cacheExpiry'
            ]);

            // API Mode
            const apiMode = settings.apiMode || 'own';
            document.querySelector(`input[value="${apiMode}"]`).checked = true;
            document.querySelector(`[data-value="${apiMode}"]`).classList.add('selected');
            this.handleApiModeChange(apiMode);

            // API Key
            if (settings.openaiApiKey) {
                this.apiKeyInput.value = settings.openaiApiKey;
            }

            // Language and Level
            this.targetLanguageSelect.value = settings.targetLanguage || 'ja';
            this.definitionLevelSelect.value = settings.definitionLevel || 'beginner';

            // Subtitle Server (default to cloud)
            const subtitleServer = settings.subtitleServer || 'cloud';
            const serverRadio = document.querySelector(`input[name="subtitleServer"][value="${subtitleServer}"]`);
            if (serverRadio) {
                serverRadio.checked = true;
                document.querySelector(`[data-value="${subtitleServer}"]`)?.classList.add('selected');
            }

            // Advanced Settings
            this.debugModeCheckbox.checked = settings.debugMode || false;
            this.autoCacheCheckbox.checked = settings.autoCache !== false; // Default true
            this.cacheExpirySelect.value = settings.cacheExpiry || '7';

        } catch (error) {
            console.error('Error loading settings:', error);
            this.showAlert('Error loading settings', 'error');
        }
    }

    handleApiModeChange(mode) {
        // Show/hide API key field based on mode
        if (mode === 'own') {
            this.apiKeyGroup.style.display = 'block';
        } else {
            this.apiKeyGroup.style.display = 'none';
        }
    }

    async autoSaveSetting(key, value) {
        try {
            await chrome.storage.sync.set({ [key]: value });
            console.log(`[Settings] Auto-saved ${key}:`, value);
            
            // Show brief confirmation
            this.showAlert(`✓ Saved`, 'success');
            
            // Notify content scripts
            chrome.runtime.sendMessage({ 
                action: 'settingsUpdated', 
                settings: { [key]: value }
            });
        } catch (error) {
            console.error(`Error auto-saving ${key}:`, error);
            this.showAlert('Auto-save failed', 'error');
        }
    }

    async updateCacheStats() {
        try {
            // Get all storage data
            const localStorage = await chrome.storage.local.get(null);
            
            // Count subtitle caches
            const subtitleCaches = Object.keys(localStorage)
                .filter(key => key.startsWith('subtitle_'));
            this.cacheVideoCount.textContent = subtitleCaches.length;

            // Calculate cache size
            const cacheData = JSON.stringify(subtitleCaches.map(key => localStorage[key]));
            const sizeInBytes = new Blob([cacheData]).size;
            this.cacheSize.textContent = this.formatBytes(sizeInBytes);

            // Count saved words
            const savedWordsData = localStorage.savedWordsData || {};
            this.savedWordsCount.textContent = Object.keys(savedWordsData).length;

        } catch (error) {
            console.error('Error updating cache stats:', error);
        }
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 KB';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    async clearSubtitleCache() {
        if (!confirm('This will clear all cached subtitles. Continue?')) {
            return;
        }

        this.clearCacheBtn.disabled = true;
        this.clearCacheBtn.innerHTML = '<span class="spinner"></span> Clearing...';

        try {
            const localStorage = await chrome.storage.local.get(null);
            const cacheKeys = Object.keys(localStorage)
                .filter(key => key.startsWith('subtitle_'));
            
            if (cacheKeys.length > 0) {
                await chrome.storage.local.remove(cacheKeys);
                this.showAlert(`Cleared ${cacheKeys.length} cached videos`, 'success');
            } else {
                this.showAlert('No cache to clear', 'info');
            }

            // Update stats
            await this.updateCacheStats();

        } catch (error) {
            console.error('Error clearing cache:', error);
            this.showAlert('Failed to clear cache', 'error');
        } finally {
            this.clearCacheBtn.disabled = false;
            this.clearCacheBtn.innerHTML = '<span>🗑️</span> Clear Subtitle Cache';
        }
    }

    async clearSavedWords() {
        if (!confirm('This will delete all your saved words. This action cannot be undone. Continue?')) {
            return;
        }

        this.clearWordsBtn.disabled = true;
        this.clearWordsBtn.innerHTML = '<span class="spinner"></span> Clearing...';

        try {
            await chrome.storage.local.remove(['savedWordsData']);
            this.showAlert('All saved words have been deleted', 'success');
            
            // Update badge
            chrome.runtime.sendMessage({ action: 'updateBadge', count: 0 });
            
            // Update stats
            await this.updateCacheStats();

        } catch (error) {
            console.error('Error clearing saved words:', error);
            this.showAlert('Failed to clear saved words', 'error');
        } finally {
            this.clearWordsBtn.disabled = false;
            this.clearWordsBtn.innerHTML = '<span>📝</span> Clear Saved Words';
        }
    }

    async exportData() {
        this.exportDataBtn.disabled = true;
        this.exportDataBtn.innerHTML = '<span class="spinner"></span> Exporting...';

        try {
            const localStorage = await chrome.storage.local.get(['savedWordsData']);
            const savedWords = localStorage.savedWordsData || {};

            const exportData = {
                version: '1.0.0',
                exportDate: new Date().toISOString(),
                wordsCount: Object.keys(savedWords).length,
                words: savedWords
            };

            // Create and download JSON file
            const blob = new Blob([JSON.stringify(exportData, null, 2)], 
                { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `vocaminary_export_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            this.showAlert(`Exported ${Object.keys(savedWords).length} words`, 'success');

        } catch (error) {
            console.error('Error exporting data:', error);
            this.showAlert('Failed to export data', 'error');
        } finally {
            this.exportDataBtn.disabled = false;
            this.exportDataBtn.innerHTML = '<span>📥</span> Export Data';
        }
    }



    async loadMyVideos() {
        try {
            // Show loading
            this.videosLoading.style.display = 'block';
            this.videosError.style.display = 'none';
            this.videosEmpty.style.display = 'none';
            this.videosList.innerHTML = '';

            // Check if connected
            const { vocabToken } = await chrome.storage.sync.get(['vocabToken']);
            if (!vocabToken) {
                this.videosLoading.style.display = 'none';
                this.videosError.style.display = 'flex';
                this.videosErrorText.textContent = 'Not connected to Vocaminary. Please connect first.';
                return;
            }

            // Fetch user's video watch history from API
            const response = await fetch('https://app.vocaminary.com/api/my-videos', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${vocabToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            const videos = data.videos || [];

            this.videosLoading.style.display = 'none';

            if (videos.length === 0) {
                this.videosEmpty.style.display = 'block';
                return;
            }

            // Render videos
            this.renderVideos(videos);

        } catch (error) {
            console.error('[Settings] Error loading videos:', error);
            this.videosLoading.style.display = 'none';
            this.videosError.style.display = 'flex';
            this.videosErrorText.textContent = 'Failed to load videos. Please try again.';
        }
    }

    renderVideos(videos) {
        this.videosList.innerHTML = videos.map(video => `
            <div class="video-item" data-video-id="${video.video_id}">
                <div class="video-header">
                    <img 
                        src="https://img.youtube.com/vi/${video.video_id}/mqdefault.jpg" 
                        alt="${video.video_title || 'Video thumbnail'}"
                        class="video-thumbnail"
                        onerror="this.src='https://via.placeholder.com/120x68?text=No+Image'"
                    >
                    <div class="video-info">
                        <div class="video-title">${this.escapeHtml(video.video_title || 'Unknown Video')}</div>
                        <div class="video-meta">
                            <span class="video-stat">
                                <span>📚</span>
                                <span>${video.words_saved || 0} words saved</span>
                            </span>
                            <span class="video-stat">
                                <span>👁️</span>
                                <span>${video.view_count || 1} ${video.view_count === 1 ? 'view' : 'views'}</span>
                            </span>
                            <span class="video-stat">
                                <span>🕒</span>
                                <span>${this.formatDate(video.last_viewed)}</span>
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');

        // Add click handlers to open videos
        document.querySelectorAll('.video-item').forEach(item => {
            item.addEventListener('click', () => {
                const videoId = item.dataset.videoId;
                chrome.tabs.create({ url: `https://www.youtube.com/watch?v=${videoId}` });
            });
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // Update tab panels
        document.querySelectorAll('.tab-panel').forEach(panel => {
            panel.classList.toggle('active', panel.id === `${tabName}Tab`);
        });

        // Load videos when switching to videos tab
        if (tabName === 'videos' && !this.videosLoaded) {
            this.loadMyVideos();
            this.videosLoaded = true;
        }

        console.log('[Settings] 📑 Switched to tab:', tabName);
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
        
        return date.toLocaleDateString();
    }

    showAlert(message, type = 'success') {
        this.alertText.textContent = message;
        this.alertMessage.className = `alert alert-${type} show`;
        
        // Update icon based on type
        const icons = {
            success: '✓',
            error: '✕',
            info: 'ℹ'
        };
        this.alertIcon.textContent = icons[type] || '✓';

        // Auto-hide faster for auto-save notifications
        const hideDelay = message === '✓ Saved' ? 1500 : 3000;
        setTimeout(() => {
            this.alertMessage.classList.remove('show');
        }, hideDelay);
    }
}

// Initialize when DOM is ready
let settingsManager;
document.addEventListener('DOMContentLoaded', () => {
    settingsManager = new SettingsManager();
    
    // Check for hash navigation (e.g., #videos)
    if (window.location.hash) {
        const tabName = window.location.hash.substring(1); // Remove the '#'
        if (tabName === 'videos') {
            settingsManager.switchTab('videos');
        }
    }
    
    // Auto-refresh ONLY cache stats every 5 seconds (not settings!)
    setInterval(() => {
        if (settingsManager) {
            settingsManager.updateCacheStats();
        }
    }, 5000);
});