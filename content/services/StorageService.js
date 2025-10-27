class StorageManagement {
    constructor(state, logger) {
        this.state = state;
        this.logger = logger || console;
        this.CACHE_DURATION = 86400000; // 24 hours
        this.DATABASE_SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes
        this.lastDatabaseSync = 0;
        
        
        this.savedWords = {};  // For quick lookups

    }
    async loadSettings() {
        try {
            const settings = await chrome.storage.sync.get([
                'openaiApiKey',
                'targetLanguage', 
                'definitionLevel',
                'apiMode',  
                'publicApiUsage',  
                'publicApiLastReset',
                'publicApiLimit'
            ]);
            
            this.state.openaiApiKey = settings.openaiApiKey || '';
            this.state.targetLanguage = settings.targetLanguage || 'ja';
            this.state.definitionLevel = settings.definitionLevel || 'beginner';
            
            this.state.apiMode = settings.apiMode || 'own';  // 'own' or 'public'
            this.state.publicApiUsage = settings.publicApiUsage || 0;
            this.state.publicApiLimit = settings.publicApiLimit || 50;
            this.state.publicApiLastReset = settings.publicApiLastReset || new Date().toDateString();

            // Save defaults if they don't exist in storage
            const toSave = {};
            if (!settings.apiMode) toSave.apiMode = 'own';
            if (!settings.publicApiLimit) toSave.publicApiLimit = 50;
            if (!settings.publicApiLastReset) toSave.publicApiLastReset = new Date().toDateString();
            
            if (Object.keys(toSave).length > 0) {
                await chrome.storage.sync.set(toSave);
                this.logger.info('[Storage] Saved defaults:', toSave);
            }

            this.logger.info('Settings loaded:', {
                hasApiKey: !!this.state.openaiApiKey,
                targetLanguage: this.targetLanguage,
                definitionLevel: this.definitionLevel,
                apiMode: this.state.apiMode
            });
        } catch (error) {
            this.logger.error('Error loading settings:', error);
        }
    }

    async loadApiCache() {
        try {
            const result = await chrome.storage.local.get(['apiCache']);
            this.state.apiCache = result.apiCache || {};
            
            // Clean expired entries
            const now = Date.now();
            let cleaned = false;
            
            Object.keys(this.state.apiCache).forEach(key => {
                if (now - this.state.apiCache[key].timestamp > this.CACHE_DURATION) {
                    delete this.state.apiCache[key];
                    cleaned = true;
                }
            });
            
            if (cleaned) {
                await chrome.storage.local.set({ apiCache: this.state.apiCache });
            }
            
            
        } catch (error) {
            this.logger.error('Error loading API cache:', error);
            this.state.apiCache = {};
        }
    }

    async loadSavedWords() {
        try {
            // 🔧 FIX: Load from savedWordsData (the correct key)
            const result = await chrome.storage.local.get(['savedWordsData']);
            const savedWordsData = result.savedWordsData || {};
            
            // Convert to simple object for quick lookups
            this.state.savedWords = {};
            Object.keys(savedWordsData).forEach(wordKey => {
                this.state.savedWords[wordKey] = savedWordsData[wordKey];
            });
            
            
            // Initial highlight with local words
            this.highlightExistingSubtitles();
            
            // Also refresh highlights in overlay if it exists
            this.refreshOverlayHighlights();
            
            // Check if connected to cloud
            const { vocabToken } = await chrome.storage.sync.get(['vocabToken']);
            
            if (vocabToken) {
                try {
                    const apiUrl = 'https://yourvocab.vercel.app/api/words';
                    
                    const response = await fetch(apiUrl, {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${vocabToken}`
                        }
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        this.logger.debug('Cloud response:', data);
                        
                        if (data && data.words && Array.isArray(data.words)) {
                            data.words.forEach(cloudWord => {
                                const wordKey = cloudWord.word.toLowerCase().trim();
                                this.state.savedWords[wordKey] = {
                                    word: cloudWord.word,
                                    savedAt: cloudWord.created_at,
                                    videoId: cloudWord.video_id,
                                    videoTitle: cloudWord.video_title,
                                    fromCloud: true
                                };
                            });
                            
                            
                            // Re-highlight after cloud words are loaded
                            this.highlightExistingSubtitles();
                            
                            // Also refresh overlay highlights
                            this.refreshOverlayHighlights();
                        }
                    } else {
                        this.logger.error('Cloud API error:', response.status);
                    }
                } catch (cloudError) {
                    this.logger.error('Failed to load cloud words:', cloudError);
                }
            }
            
            const wordCount = Object.keys(this.state.savedWords).length;
            chrome.runtime.sendMessage({ action: 'updateBadge', count: wordCount }).catch(() => {});
            
        } catch (error) {
            this.logger.error('Error loading saved words:', error);
            this.state.savedWords = {};
        }
    }

    async saveWord(word, analysisData = null) {
        const wordKey = word.toLowerCase().trim();
        
        // 🔧 FIX: Use consistent storage key 'savedWordsData'
        const result = await chrome.storage.local.get(['savedWordsData']);
        let savedWordsData = result.savedWordsData || {};
        
        const timestamp = new Date().toISOString();
        const videoId = (this.state && this.state.getCurrentVideoId()) || this.extractVideoId(window.location.href);
        
        // Save with analysis data
        savedWordsData[wordKey] = { 
            word: word,
            savedAt: timestamp,  // Changed from 'timestamp' to 'savedAt' for consistency
            videoId: videoId,
            videoTitle: document.title.replace(' - YouTube', ''),
            analysis: analysisData  // Store analysis in nested object
        };
        
        // 🔧 FIX: Save to storage with correct key
        await chrome.storage.local.set({ savedWordsData: savedWordsData });
        
        // Update in-memory cache
        this.state.savedWords[wordKey] = savedWordsData[wordKey];
        
        // Update word count badge
        const wordCount = Object.keys(savedWordsData).length;
        try {
            chrome.runtime.sendMessage({ action: 'updateBadge', count: wordCount });
        } catch (e) {
            this.logger.debug('Badge update skipped:', e.message);
        }
        
        this.logger.info(`Saved word: ${word} (${wordCount} total)`);
        
        
        // Sync to cloud if connected
        try {
            const { vocabToken } = await chrome.storage.sync.get(['vocabToken']);
            
            if (!vocabToken) {
                this.logger.warn('No cloud sync - not connected');
                return;
            }
            
            const apiUrl = 'https://yourvocab.vercel.app/api/words';
            
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${vocabToken}`
                },
                body: JSON.stringify({
                    word: word,
                    definition: analysisData?.definition || '',
                    translations: analysisData?.translations || {},
                    pronunciation: analysisData?.pronunciation || '',
                    partOfSpeech: analysisData?.partOfSpeech || '',
                    synonyms: analysisData?.synonyms || [],
                    context: analysisData?.refinedSentence || '',
                    frequency: analysisData?.frequency || '',
                    videoId: videoId,
                    videoTitle: document.title.replace(' - YouTube', '')
                })
            });
            
            if (response.ok) {
                this.logger.info('Synced to cloud!');
            } else {
                const error = await response.text();
                this.logger.error('Sync failed:', error);
            }
        } catch (error) {
            this.logger.error('Sync error:', error);
        }
        
        return true;
    }


    async deleteWord(word) {
        const wordKey = word.toLowerCase().trim();
        
        try {
            // Remove from local storage
            const result = await chrome.storage.local.get(['savedWordsData']);
            let savedWordsData = result.savedWordsData || {};
            
            if (!(wordKey in savedWordsData)) {
                this.logger.info(`[YT Overlay] 📘 Word not found: ${word}`);
                return false;
            }
            
            delete savedWordsData[wordKey];
            await chrome.storage.local.set({ savedWordsData: savedWordsData });
            
            // Remove from in-memory cache
            delete this.state.savedWords[wordKey];
            
            // Update word count badge
            const wordCount = Object.keys(savedWordsData).length;
            try {
                chrome.runtime.sendMessage({ action: 'updateBadge', count: wordCount });
            } catch (e) {
                this.logger.debug('[YT Overlay] 🔍 Badge update skipped:', e.message);
            }
            
            this.logger.info(`[YT Overlay] 🗑️ Deleted word: ${word} (${wordCount} total)`);
            
            // Remove highlight from captions
            const subtitleWords = document.querySelectorAll('.subtitle-word');
            subtitleWords.forEach(wordElement => {
                if (wordElement.textContent.toLowerCase().trim() === wordKey) {
                    wordElement.classList.remove('highlighted-word');
                }
            });
            
            // Sync deletion to cloud if connected
            const { vocabToken } = await chrome.storage.sync.get(['vocabToken']);
            
            if (!vocabToken) {
                this.logger.warn('[YT Overlay] ⚠️ No cloud sync - not connected');
                return true;
            }
            
            const apiUrl = `https://yourvocab.vercel.app/api/words?word=${encodeURIComponent(word)}`;
            
            const response = await fetch(apiUrl, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${vocabToken}`
                }
            });
            
            if (response.ok) {
                this.logger.info('[YT Overlay] ☁️ Synced deletion to cloud!');
            } else {
                const error = await response.text();
                this.logger.error('[YT Overlay] ❌ Cloud delete failed:', error);
            }
            
            // Refresh highlights
            this.highlightExistingSubtitles();
            this.refreshOverlayHighlights();
            
            return true;
            
        } catch (error) {
            this.logger.error('[YT Overlay] ❌ Delete error:', error);
            return false;
        }
    }


    async saveToBrowserCache(videoId, data) {
        const cacheKey = `subtitle_${videoId}`;
        
        try {
            // Check storage space
            const bytesInUse = await chrome.storage.local.getBytesInUse();
            const maxBytes = chrome.storage.local.QUOTA_BYTES || 10485760; // 10MB default
            
            // If over 80% full, clean old subtitle caches
            if (bytesInUse > maxBytes * 0.8) {
                this.logger.warn('Storage nearly full, cleaning old caches...');
                await this.cleanOldSubtitleCaches();
            }
            
            await chrome.storage.local.set({ [cacheKey]: data });
            this.logger.info(`Cached subtitles for ${videoId}`);
            
            // Log cache size
            const dataSize = JSON.stringify(data).length;
            this.logger.debug(`Cache size: ${(dataSize / 1024).toFixed(2)} KB`);
            
        } catch (error) {
            this.logger.error('Failed to cache subtitles:', error);
        }
    }

    async cleanOldSubtitleCaches() {
        const allKeys = await chrome.storage.local.get(null);
        const subtitleKeys = Object.keys(allKeys).filter(k => k.startsWith('subtitle_'));
        
        // Sort by age and remove oldest 25%
        const keysWithAge = subtitleKeys.map(key => ({
            key,
            age: Date.now() - (allKeys[key].cachedAt || 0)
        })).sort((a, b) => b.age - a.age);
        
        const toRemove = keysWithAge.slice(Math.floor(keysWithAge.length * 0.75));
        if (toRemove.length > 0) {
            await chrome.storage.local.remove(toRemove.map(item => item.key));
            this.logger.info(`Removed ${toRemove.length} old subtitle caches`);
        }
    }


    // Sync database cache in background
    async syncDatabaseCache() {
        try {
            const { vocabToken } = await chrome.storage.sync.get(['vocabToken']);
            const authToken = vocabToken || null;
            if (!authToken) {
                this.logger.warn('No auth token, skipping database sync');
                return;
            }

            const response = await fetch('https://yourvocab.vercel.app/api/words', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Database API error: ${response.status}`);
            }

            const data = await response.json();
            const words = data.words || [];

            // Update in-memory cache
            this.state.databaseWords.clear();
            words.forEach(wordData => {
                if (wordData.word) {
                    this.state.databaseWords.set(wordData.word.toLowerCase(), wordData);
                }
            });

            this.lastDatabaseSync = Date.now();
            this.logger.info(`Database cache synced: ${words.length} words loaded`);

        } catch (error) {
            this.logger.error('Database sync failed:', error);
            // Don't throw - fallback to OpenAI will work
        }
    }

    async getCachedWordData(word) {
        const wordKey = word.toLowerCase().trim();
        
        // 1️⃣ Check saved words with full analysis
        const savedResult = await chrome.storage.local.get(['savedWordsData']);
        const savedWordsData = savedResult.savedWordsData || {};
        
        if (savedWordsData[wordKey]?.analysis) {
            this.logger.info(`Found in saved words with analysis`);
            return {
                ...savedWordsData[wordKey].analysis,
                _source: 'saved_words',
                _savedAt: savedWordsData[wordKey].savedAt
            };
        }
        
        // 2️⃣ Check API cache (in-memory)
        const contextSnippet = (this.state && this.state.getParsedCaptions())?.[this.state.getCurrentCaptionIndex()]?.text || '';
        const cacheKey = `${word}_${contextSnippet.substring(0, Math.min(20, contextSnippet.length))}`;
        if (this.state.apiCache[cacheKey]) {
            const cached = this.state.apiCache[cacheKey];
            if (Date.now() - cached.timestamp < this.CACHE_DURATION) {
                this.logger.info(`Found in API cache (memory)`);
                return {
                    ...cached.data,
                    _source: 'api_cache_memory'
                };
            }
        }
        
        // 3️⃣ Check API cache (storage)
        const storageResult = await chrome.storage.local.get(['apiCache']);
        const storageCache = storageResult.apiCache || {};
        
        if (storageCache[cacheKey]) {
            const cached = storageCache[cacheKey];
            if (Date.now() - cached.timestamp < this.CACHE_DURATION) {
                this.logger.info(`Found in API cache (storage)`);
                // Also load to memory for faster access next time
                this.state.apiCache[cacheKey] = cached;
                return {
                    ...cached.data,
                    _source: 'api_cache_storage'
                };
            }
        }
        
        // 4️⃣ Check database words if available
        if (this.state.databaseWords && this.state.databaseWords.has(wordKey)) {
            const dbWord = this.state.databaseWords.get(wordKey);
            this.logger.info(`Found in database cache`);
            // Return the raw database word - it should already have the right format
            return {
                pronunciation: dbWord.pronunciation || '/unknown/',
                partOfSpeech: dbWord.part_of_speech || dbWord.partOfSpeech || 'unknown',
                definition: dbWord.definition || 'No definition available',
                synonyms: dbWord.synonyms || [],
                translations: dbWord.translations || {},
                frequency: dbWord.frequency || 'unknown',
                refinedSentence: dbWord.context || dbWord.context_sentence || '',
                sentenceTranslation: dbWord.sentenceTranslation || '',
                _source: 'database'
            };
        }
        
        // No cached data found
        return null;
    }

    // Initialize database cache
    async initDatabaseCache() {
        
        // Start background database sync (non-blocking)
        this.syncDatabaseCache().catch(error => {
            this.logger.warn('Initial database sync failed, will fallback to OpenAI');
        });
        
        // Set up periodic sync
        setInterval(() => {
            if (Date.now() - this.lastDatabaseSync > this.DATABASE_SYNC_INTERVAL) {
                this.syncDatabaseCache();
            }
        }, this.DATABASE_SYNC_INTERVAL);
    }

    extractVideoId(url) {
        const match = url.match(/[?&]v=([^&]+)/);
        return match ? match[1] : null;
    }

    // 1. Extract surrounding words from current caption
    getSurroundingContext(clickedWord, wordIndex) {
        const WORDS_BEFORE = 8;
        const WORDS_AFTER = 8;
        const allWords = [];
        
        // Collect words from multiple captions
        const parsedCaptions = this.state ? this.state.getParsedCaptions() : [];
        const currentCaptionIndex = this.state ? this.state.getCurrentCaptionIndex() : -1;
        
        for (let i = Math.max(0, currentCaptionIndex - 2); 
            i <= Math.min(parsedCaptions.length - 1, currentCaptionIndex + 2); 
            i++) {
            
            const caption = parsedCaptions[i];
            caption.words.forEach((word, idx) => {
                allWords.push({
                    text: word.text + word.punctuation,
                    captionIndex: i,
                    wordIndex: idx,
                    isTarget: (i === currentCaptionIndex && idx === wordIndex)
                });
            });
        }
        
        // Find target word position in combined array
        const targetPos = allWords.findIndex(w => w.isTarget);
        if (targetPos === -1) return null;
        
        // Extract surrounding words
        const startPos = Math.max(0, targetPos - WORDS_BEFORE);
        const endPos = Math.min(allWords.length, targetPos + WORDS_AFTER + 1);
        
        const contextWords = allWords
            .slice(startPos, endPos)
            .map(w => w.text)
            .join(' ');
        
        this.logger.info(`Context (${endPos - startPos} words): "${contextWords}"`);
        
        return {
            targetWord: clickedWord,
            context: contextWords,
            captionText: parsedCaptions[currentCaptionIndex].text
        };
    }

    highlightExistingSubtitles() {
        const subtitleContainer = document.querySelector('.subtitle-container');
        if (!subtitleContainer) return;
        
        const allWords = subtitleContainer.querySelectorAll('.subtitle-word');
        allWords.forEach(wordElement => {
            const wordText = wordElement.textContent.toLowerCase().trim();
            if (wordText in this.state.savedWords) {
                wordElement.classList.add('highlighted-word');
            }
        });
    }

    refreshOverlayHighlights() {
        document.dispatchEvent(new CustomEvent('refreshHighlights'));
    }

}