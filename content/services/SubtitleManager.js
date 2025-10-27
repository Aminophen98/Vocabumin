/**
 * Subtitle Manager - OPTIMIZED VERSION
 * 
 * Improvements:
 * - Memory cache for instant access
 * - IndexedDB for fast local storage (faster than Chrome storage)
 * - Parallel operations (cache + rate limit checks)
 * - Combined API endpoint (one call instead of two)
 * - Background logging (non-blocking)
 */
class SubtitleManager {
    constructor(logger, storage, notifications) {
        this.logger = logger || console;
        this.storage = storage;
        this.notifications = notifications; // Unified notification service
        this.apiBase = 'https://yourvocab.vercel.app/api';
        this.vocabuminApi = 'https://api.vocabumin.aminophen.ir';
        this.ytdlpServer = 'http://localhost:5000';
        
        // Memory cache for instant access (<1ms)
        this.memoryCache = new Map();
        this.currentVideoId = null;
        
        // IndexedDB for faster local storage
        this.dbName = 'SubtitleCache';
        this.dbVersion = 1;
        this.db = null;
        this.initIndexedDB();
        
        this.cacheExpiry = 7 * 24 * 60 * 60 * 1000; // 7 days
        this.maxMemoryCacheSize = 3; // Keep last 3 videos
        
        // Performance tracking
        this.stats = {
            memoryHits: 0,
            indexedDBHits: 0,
            serverHits: 0,
            misses: 0
        };
    }

    /**
     * Initialize IndexedDB
     */
    async initIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onerror = () => {
                this.log('error', '💾 IndexedDB | Failed to open', request.error);
                reject(request.error);
            };
            
            request.onsuccess = () => {
                this.db = request.result;
                this.log('info', '💾 IndexedDB | Ready');
                resolve(this.db);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('subtitles')) {
                    const store = db.createObjectStore('subtitles', { keyPath: 'videoId' });
                    store.createIndex('cachedAt', 'cachedAt', { unique: false });
                    this.log('info', '💾 IndexedDB | Store created');
                }
            };
        });
    }

    /**
     * Get from IndexedDB
     */
    async getFromIndexedDB(videoId) {
        if (!this.db) await this.initIndexedDB();
        
        return new Promise((resolve) => {
            try {
                const transaction = this.db.transaction(['subtitles'], 'readonly');
                const store = transaction.objectStore('subtitles');
                const request = store.get(videoId);
                
                request.onsuccess = () => {
                    const data = request.result;
                    if (data) {
                        const age = Date.now() - data.cachedAt;
                        if (age < this.cacheExpiry) {
                            resolve({ data, age });
                        } else {
                            this.log('debug', `💾 IndexedDB | Expired (${videoId})`);
                            this.deleteFromIndexedDB(videoId);
                            resolve(null);
                        }
                    } else {
                        resolve(null);
                    }
                };
                
                request.onerror = () => {
                    this.log('error', '💾 IndexedDB | Read error', request.error);
                    resolve(null);
                };
            } catch (error) {
                this.log('error', '💾 IndexedDB | Exception', error);
                resolve(null);
            }
        });
    }

    /**
     * Save to IndexedDB
     */
    async saveToIndexedDB(videoId, data) {
        if (!this.db) await this.initIndexedDB();
        
        return new Promise((resolve) => {
            try {
                const transaction = this.db.transaction(['subtitles'], 'readwrite');
                const store = transaction.objectStore('subtitles');
                
                const cacheData = {
                    videoId,
                    captions: data.captions,
                    captionData: data.captionData,
                    cachedAt: Date.now()
                };
                
                const request = store.put(cacheData);
                
                request.onsuccess = () => {
                    this.log('debug', `💾 IndexedDB | Saved (${videoId})`);
                    resolve(true);
                };
                
                request.onerror = () => {
                    this.log('error', `💾 IndexedDB | Save failed (${videoId})`, request.error);
                    resolve(false);
                };
            } catch (error) {
                this.log('error', `💾 IndexedDB | Save exception (${videoId})`, error);
                resolve(false);
            }
        });
    }

    /**
     * Delete from IndexedDB
     */
    async deleteFromIndexedDB(videoId) {
        if (!this.db) return false;
        
        return new Promise((resolve) => {
            try {
                const transaction = this.db.transaction(['subtitles'], 'readwrite');
                const store = transaction.objectStore('subtitles');
                const request = store.delete(videoId);
                
                request.onsuccess = () => resolve(true);
                request.onerror = () => {
                    this.log('warn', `💾 IndexedDB | Delete failed (${videoId})`);
                    resolve(false);
                };
            } catch (error) {
                this.log('warn', `💾 IndexedDB | Delete exception (${videoId})`);
                resolve(false);
            }
        });
    }

    /**
     * Get auth token
     */
    async getAuthToken() {
        try {
            const { vocabToken } = await chrome.storage.sync.get(['vocabToken']);
            if (!vocabToken) {
                const tempUserId = await this.getOrCreateTempUserId();
                return btoa(`${tempUserId}:${Date.now()}`);
            }
            return vocabToken;
        } catch (error) {
            this.log('error', '🔑 Auth | Token fetch failed', error);
            return null;
        }
    }

    /**
     * Get or create temporary user ID
     */
    async getOrCreateTempUserId() {
        const { tempUserId } = await chrome.storage.local.get(['tempUserId']);
        if (tempUserId) return tempUserId;
        
        const newId = 'temp_' + Math.random().toString(36).substr(2, 9);
        await chrome.storage.local.set({ tempUserId: newId });
        this.log('debug', `🔑 Auth | Created temp ID: ${newId}`);
        return newId;
    }

    /**
     * MAIN FUNCTION - Fetch subtitles with multi-layer caching
     */
    async fetchSubtitles(videoId, videoTitle = null, channelName = null) {
        const startTime = performance.now();
        this.log('info', `🎬 Fetch | Start (${videoId})`);
        
        if (!videoId) {
            this.log('error', '🎬 Fetch | No videoId provided');
            return { error: 'No video ID provided', cached: false };
        }

        this.currentVideoId = videoId;
        
        // STEP 1: Check memory cache (<1ms)
        if (this.memoryCache.has(videoId)) {
            const cached = this.memoryCache.get(videoId);
            const age = Date.now() - cached.timestamp;
            const elapsed = (performance.now() - startTime).toFixed(1);
            
            this.stats.memoryHits++;
            this.log('info', `⚡ Memory HIT | ${Math.round(age / 1000)}s old | ${elapsed}ms`);

            // No logging for cached loads - doesn't count toward usage

            return {
                captions: cached.captions,
                captionData: cached.captionData,
                source: 'memory', // Changed to match CaptionService check
                cached: true,
                age_seconds: Math.round(age / 1000),
                age_minutes: Math.round(age / 1000 / 60)
            };
        }

        // STEP 2: Check IndexedDB first (no rate limit impact)
        this.log('debug', `🔄 Checking IndexedDB...`);

        const localCache = await this.getFromIndexedDB(videoId);

        // IndexedDB hit - return immediately WITHOUT calling server
        if (localCache) {
            const ageMin = Math.round(localCache.age / 1000 / 60);
            const elapsed = (performance.now() - startTime).toFixed(1);

            this.stats.indexedDBHits++;
            this.log('info', `✨ IndexedDB HIT | ${ageMin}m old | ${elapsed}ms | NO rate limit impact`);

            this.addToMemoryCache(videoId, localCache.data.captions, localCache.data.captionData);

            // No logging for cached loads - doesn't count toward usage

            return {
                captions: localCache.data.captions,
                captionData: localCache.data.captionData,
                source: 'local_cache',
                cached: true,
                age_minutes: ageMin
            };
        }

        // STEP 3: No local cache - check server cache and rate limits
        this.log('debug', `☁️ Checking server cache and limits...`);

        const serverResponse = await this.checkCacheAndLimits(videoId);

        // Server cache hit
        if (serverResponse.cached) {
            const elapsed = (performance.now() - startTime).toFixed(1);

            this.stats.serverHits++;
            this.log('info', `☁️ Server HIT | Hits: ${serverResponse.hit_count} | ${elapsed}ms`);

            const subtitles = serverResponse.subtitles;
            const captionData = {
                language: subtitles.language || 'en',
                source: 'server_cache'
            };

            this.addToMemoryCache(videoId, subtitles.captions || subtitles, captionData);
            this.saveToIndexedDB(videoId, {
                captions: subtitles.captions || subtitles,
                captionData
            });

            // No logging for cached loads - doesn't count toward usage

            return {
                captions: subtitles.captions || subtitles,
                captionData,
                source: 'server_cache',
                cached: true,
                hit_count: serverResponse.hit_count,
                age_days: serverResponse.age_days
            };
        }

        // STEP 4: Check rate limits (only for fresh fetches)
        if (!serverResponse.allowed) {
            const waitMin = Math.ceil(serverResponse.waitTime / 60);
            this.log('warn', `⏰ Rate Limited | ${serverResponse.reason} | Wait ${waitMin}m`);
            this.showRateLimitMessage(`Wait ${waitMin} minutes`, serverResponse.usage);

            return {
                error: `Rate limited. Wait ${waitMin} minutes.`,
                wait_time: serverResponse.waitTime,
                usage: serverResponse.usage
            };
        }

        this.showUsageStatus(serverResponse.usage);

        // STEP 5: Fetch from source (only if not cached and rate limits allow)
        this.stats.misses++;
        this.log('info', `📡 Fetch | From source (${videoId})`);
        
        const fetchResult = await this.fetchFromYtDlp(videoId);
        
        if (!fetchResult || !fetchResult.success) {
            const elapsed = (performance.now() - startTime).toFixed(1);
            this.log('error', `❌ Fetch | Failed | ${elapsed}ms`);

            // No logging for failed fetches - shouldn't count toward usage

            return {
                error: 'Failed to fetch subtitles',
                cached: false
            };
        }

        // STEP 6: Store fresh fetch in all caches
        const fetchSource = fetchResult.captionData?.source || 'unknown';
        const elapsed = (performance.now() - startTime).toFixed(1);
        
        this.log('info', `✅ Fetch | Success (${fetchSource}) | ${elapsed}ms`);
        
        this.addToMemoryCache(videoId, fetchResult.captions, fetchResult.captionData);
        this.saveToIndexedDB(videoId, fetchResult);
        
        // Background ops
        Promise.all([
            this.storeInServerCache(videoId, videoTitle, channelName, fetchResult),
            this.logFetch(videoId, videoTitle, true, fetchSource, false)
        ]).catch(() => {});
        
        // Return with proper source and cached flag
        return {
            ...fetchResult,
            source: fetchSource, // Preserve actual source (vocabumin or local-ytdlp)
            cached: false // This is a fresh fetch, not from cache
        };
    }

    /**
     * Add to memory cache with LRU eviction
     */
    addToMemoryCache(videoId, captions, captionData) {
        this.memoryCache.set(videoId, {
            captions,
            captionData,
            timestamp: Date.now()
        });
        
        // LRU eviction
        if (this.memoryCache.size > this.maxMemoryCacheSize) {
            const firstKey = this.memoryCache.keys().next().value;
            this.memoryCache.delete(firstKey);
            this.log('debug', `🗑️ Memory | Evicted (${firstKey})`);
        }
    }

    /**
     * Combined cache + rate limit check
     */
    async checkCacheAndLimits(videoId) {
        try {
            const token = await this.getAuthToken();
            if (!token) {
                this.log('debug', '☁️ Server | No token, allowing fetch');
                return { cached: false, allowed: true, usage: null };
            }
            
            const response = await fetch(`${this.apiBase}/subtitles/fetch-or-cache`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ videoId, language: 'en' })
            });
            
            if (response.ok || response.status === 429) {
                return await response.json();
            }
            
            this.log('warn', `☁️ Server | HTTP ${response.status}`);
            return { cached: false, allowed: true, usage: null };
            
        } catch (error) {
            this.log('error', '☁️ Server | Check failed', error);
            return { cached: false, allowed: true, usage: null };
        }
    }

    /**
     * Fetch from Vocabumin API
     */
    async fetchFromVocabumin(videoId) {
        const startTime = performance.now();
        
        try {
            this.log('debug', `🚂 Vocabumin | Requesting (${videoId})`);
            
            const response = await fetch(`${this.vocabuminApi}/transcript/${videoId}?lang=en`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            
            const responseTime = (performance.now() - startTime).toFixed(0);
            
            if (response.ok) {
                const data = await response.json();

                // Log the actual response structure for debugging
                this.log('debug', `🚂 Vocabumin | Response data:`, data);

                const snippets = data.transcript?.snippets || data.transcript;
                const isGenerated = data.transcript?.is_generated || false;

                if (data.success && snippets && snippets.length > 0) {
                    this.log('info', `🚂 Vocabumin | Success | ${snippets.length} segments (${isGenerated ? 'auto' : 'manual'}) | ${responseTime}ms`);

                    // Log successful API call
                    this.logVocabuminAPIResponse(videoId, response.status, parseInt(responseTime), true, null);

                    const durationMultiplier = isGenerated ? 0.45 : 1.0;

                    const captions = snippets.map(segment => ({
                        start: segment.start,
                        end: segment.start + (segment.duration * durationMultiplier),
                        text: segment.text,
                        words: this.extractWordsFromText(segment.text)
                    }));

                    if (isGenerated) {
                        this.log('debug', '🚂 Vocabumin | Duration reduced to 45% (auto-captions)');
                    }

                    return {
                        success: true,
                        captions: captions,
                        captionData: {
                            language: data.language || 'en',
                            type: isGenerated ? 'auto-generated' : 'manual',
                            source: 'vocabumin'
                        }
                    };
                } else {
                    // Parse error details from API response
                    const errorType = data.error_type || 'unknown';
                    const errorMessage = data.error || 'Unknown error';

                    // Categorize errors for user-friendly messaging
                    const isUserSideIssue = ['no_transcript', 'transcripts_disabled', 'video_unavailable'].includes(errorType);
                    const isServerIssue = ['server_error', 'youtube_ip_blocked', 'network_error'].includes(errorType) || !errorType;

                    // Enhanced logging with IP block detection
                    if (errorType === 'youtube_ip_blocked') {
                        this.log('error', `🚨 [CRITICAL] YouTube IP Block! Vocabumin | ${errorMessage} | ${responseTime}ms`);
                        this.log('error', `🚨 Warp Status: ${data.warp_active ? 'Active' : 'INACTIVE - CHECK SERVER!'}`);

                        // Log additional details for debugging
                        this.log('debug', `🚂 IP Block Details:`, {
                            errorType: errorType,
                            errorMessage: errorMessage,
                            warpActive: data.warp_active,
                            videoId: videoId,
                            detail: data.detail
                        });
                    } else if (isUserSideIssue) {
                        this.log('info', `ℹ️ [User Issue] Vocabumin | ${errorMessage} | ${responseTime}ms`);
                    } else if (isServerIssue) {
                        this.log('error', `❌ [Server Error] Vocabumin | ${errorMessage} | ${responseTime}ms`);
                        this.log('debug', `🚂 Vocabumin | Failed data structure:`, {
                            success: data.success,
                            errorType: errorType,
                            errorMessage: errorMessage,
                            hasTranscript: !!data.transcript,
                            snippetsType: snippets ? typeof snippets : 'null/undefined',
                            snippetsLength: snippets?.length,
                            topLevelKeys: Object.keys(data)
                        });
                    }

                    // Return structured error for CaptionService to handle
                    return {
                        success: false,
                        errorType: errorType,
                        errorMessage: errorMessage,
                        isUserSideIssue: isUserSideIssue,
                        isServerIssue: isServerIssue,
                        warpActive: data.warp_active
                    };
                }
            }

            // Log failed API call
            this.log('warn', `🚂 Vocabumin | Failed | HTTP ${response.status} | ${responseTime}ms`);
            this.logVocabuminAPIResponse(videoId, response.status, parseInt(responseTime), false, `HTTP ${response.status}`);
            return { success: false };
            
        } catch (error) {
            const elapsed = (performance.now() - startTime).toFixed(0);
            this.log('warn', `🚂 Vocabumin | Error | ${error.message} | ${elapsed}ms`);
            
            // Log network error
            this.logVocabuminAPIResponse(videoId, 0, parseInt(elapsed), false, error.message);
            
            return { success: false };
        }
    }

    /**
     * Extract words from text
     */
    extractWordsFromText(text) {
        return text.split(/\s+/).filter(word => word.length > 0).map(word => ({
            text: word.replace(/[.,!?;:]$/, ''),
            punctuation: /[.,!?;:]$/.test(word) ? word.slice(-1) : ''
        }));
    }

    /**
     * Fetch from yt-dlp server
     */
    async fetchFromYtDlp(videoId) {
        const { subtitleServer } = await chrome.storage.sync.get(['subtitleServer']);
        const preferredServer = subtitleServer || 'cloud';

        this.log('debug', `📡 Source | Preference: ${preferredServer}`);

        // Use preferred server only (no fallback)
        if (preferredServer === 'cloud') {
            const vocabuminResult = await this.fetchFromVocabumin(videoId);
            return vocabuminResult;
        }

        // Try local yt-dlp (only when explicitly selected by user)
        const startTime = performance.now();

        try {
            // JSON3 format
            const response = await fetch(`${this.ytdlpServer}/extract-subs-json3`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ video_id: videoId, language: 'en' })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    const elapsed = (performance.now() - startTime).toFixed(0);
                    this.log('info', `💻 Local yt-dlp | Success (JSON3) | ${elapsed}ms`);
                    return {
                        success: true,
                        captions: data.caption_groups,
                        captionData: {
                            language: data.language,
                            type: data.subtitle_type,
                            source: 'local-ytdlp'
                        }
                    };
                }
            }

            // Fallback to VTT
            const vttResponse = await fetch(`${this.ytdlpServer}/extract-subs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ video_id: videoId, language: 'en' })
            });

            if (vttResponse.ok) {
                const vttData = await vttResponse.json();
                if (vttData.success) {
                    const elapsed = (performance.now() - startTime).toFixed(0);
                    this.log('info', `💻 Local yt-dlp | Success (VTT) | ${elapsed}ms`);
                    return {
                        success: true,
                        content: vttData.content,
                        captionData: {
                            language: vttData.language,
                            type: 'vtt',
                            source: 'local-ytdlp'
                        }
                    };
                }
            }

            const elapsed = (performance.now() - startTime).toFixed(0);
            this.log('error', `💻 Local yt-dlp | Failed | ${elapsed}ms`);
            return { success: false };

        } catch (error) {
            const elapsed = (performance.now() - startTime).toFixed(0);
            this.log('error', `💻 Local yt-dlp | Error | ${error.message} | ${elapsed}ms`);
            return { success: false };
        }
    }

    /**
     * Store in server cache
     */
    async storeInServerCache(videoId, videoTitle, channelName, subtitleData) {
        try {
            const token = await this.getAuthToken();
            if (!token) return;
            
            const response = await fetch(`${this.apiBase}/subtitles/store-cache`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    videoId,
                    videoTitle: videoTitle || 'Unknown',
                    channelName: channelName || 'Unknown',
                    language: 'en',
                    subtitles: subtitleData,
                    format: 'json'
                })
            });
            
            if (response.ok) {
                this.log('debug', `☁️ Server | Stored cache (${videoId})`);
            } else {
                this.log('warn', `☁️ Server | Store failed HTTP ${response.status}`);
            }
        } catch (error) {
            this.log('warn', '☁️ Server | Store error', error);
        }
    }

    /**
     * Log fetch attempt (non-blocking)
     */
    async logFetch(videoId, videoTitle, success, source = 'unknown', fromCache = false) {
        try {
            const token = await this.getAuthToken();
            if (!token) return;
            
            await fetch(`${this.apiBase}/subtitles/log-fetch`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    videoId,
                    videoTitle: videoTitle || 'Unknown',
                    success,
                    source,
                    fromCache
                })
            });
        } catch (error) {
            // Silent fail
        }
    }

    /**
     * Log Vocabumin API response (placeholder)
     */
    async logVocabuminAPIResponse(videoId, statusCode, responseTimeMs, success, errorMessage = null) {
        try {
            const token = await this.getAuthToken();
            if (!token) return; // Skip if no auth
            
            await fetch(`${this.apiBase}/railway-health/log`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    endpoint: '/transcript',
                    videoId,
                    statusCode,
                    responseTimeMs,
                    success,
                    errorMessage
                })
            });
            
            this.log('debug', `📊 Logged Vocabumin API: ${statusCode} (${responseTimeMs}ms)`);
        } catch (error) {
            // Silent fail - don't break subtitle fetching if logging fails
            this.log('warn', '⚠️ Failed to log Vocabumin API response');
        }
    }

    /**
     * Show rate limit message
     */
    showRateLimitMessage(message, usage = null) {
        // Rate limit handled by NotificationService in CaptionService
        this.log('info', `⚠️ Rate limit message: ${message}`);
    }

    /**
     * Show usage status
     */
    showUsageStatus(usage) {
        // Usage status logging only - UI handled by NotificationService
        if (!usage) return;
        this.log('debug', `📊 Usage - Burst: ${usage.burst} | Hour: ${usage.hourly} | Day: ${usage.daily}`);
    }

    /**
     * Show cache status
     */

    /**
     * Clear memory cache
     */
    clearMemoryCache() {
        this.memoryCache.clear();
        this.log('info', '🗑️ Memory | Cleared');
    }

    /**
     * Clear all caches
     */
    async clearAllCaches() {
        this.clearMemoryCache();
        
        if (this.db) {
            const transaction = this.db.transaction(['subtitles'], 'readwrite');
            const store = transaction.objectStore('subtitles');
            await store.clear();
            this.log('info', '🗑️ All Caches | Cleared');
        }
    }

    /**
     * Get cache statistics
     */
    getStats() {
        const total = this.stats.memoryHits + this.stats.indexedDBHits + this.stats.serverHits + this.stats.misses;
        const hitRate = total > 0 ? (((this.stats.memoryHits + this.stats.indexedDBHits + this.stats.serverHits) / total) * 100).toFixed(1) : 0;
        
        return {
            ...this.stats,
            total,
            hitRate: `${hitRate}%`,
            memorySize: this.memoryCache.size
        };
    }

    /**
     * Print cache statistics
     */
    printStats() {
        const stats = this.getStats();
        this.log('info', '📊 Stats | ' + JSON.stringify(stats));
    }

    /**
     * Centralized logging with consistent format
     */
    log(level, message, data = null) {
        const prefix = '[SubtitleManager]';
        const fullMessage = `${prefix} ${message}`;
        
        if (data) {
            this.logger[level](fullMessage, data);
        } else {
            this.logger[level](fullMessage);
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SubtitleManager;
}
