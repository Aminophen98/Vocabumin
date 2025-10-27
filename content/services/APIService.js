class AIService {
    constructor(storage, logger) {
        this.logger = logger || console;
        // Storage management
        this.storage = storage;
    }

    // 2. Call OpenAI API
    async fetchWordAnalysis(word, context) {
        const apiMode = this.storage.state.apiMode || 'own';
        
        // Check limits based on API mode FIRST (before checking API key!)
        if (apiMode === 'public') {
            if (!this.storage.state.canUsePublicApi()) {
                return {
                    definition: `Daily limit reached (${this.storage.state.publicApiLimit}/day). Switch to your own API key in settings!`,
                    pronunciation: '/limit-reached/',
                    partOfSpeech: 'error',
                    synonyms: ['Limit', 'Reached'],
                    translations: {},
                    frequency: 'error',
                    refinedSentence: 'Daily limit reached',
                    sentenceTranslation: 'Please wait until tomorrow or use your own API key'
                };
            }
        } else if (apiMode === 'own') {
            // Only check API key if using own mode
            const OPENAI_API_KEY = this.storage.state.openaiApiKey;
            
            if (!OPENAI_API_KEY) {
                this.logger.error('No API key set!');
                return {
                    pronunciation: '/set-api-key/',
                    partOfSpeech: 'error',
                    definition: 'Please set your OpenAI API key in the extension settings.',
                    synonyms: ['No', 'API', 'Key'],
                    translations: {},
                    frequency: 'error',
                    refinedSentence: 'Please add your OpenAI API key in extension settings.',
                    sentenceTranslation: 'Extension settings required'
                };
            }
            
            // Check daily limit for own API
            if (!this.storage.state.canMakeApiCall()) {
                return {
                    definition: `Daily limit reached (${this.storage.state.dailyLimit}/day). Upgrade for unlimited lookups!`,
                    pronunciation: '/upgrade/',
                    partOfSpeech: 'limit',
                    synonyms: ['Limit', 'Reached'],
                    translations: {},
                    frequency: 'error',
                    refinedSentence: 'Daily limit reached',
                    sentenceTranslation: 'Upgrade for unlimited'
                };
            }
        }
            
        // Check persistent cache first
        let cacheKey = word;
        if (context && typeof context === 'string' && context.length > 0) {
            cacheKey = `${word}_${context.substring(0, 20)}`;
        }
        
        if (this.storage.state.apiCache[cacheKey]) {
            const cached = this.storage.state.apiCache[cacheKey];
            if (Date.now() - cached.timestamp < this.storage.CACHE_DURATION) {
                this.logger.info('Using cached response for:', word);
                return cached.data;
            } else {
                // Remove expired entry
                delete this.storage.state.apiCache[cacheKey];
            }
        }


        // Check if common word (add this)
        const isCommonWord = ['the', 'a', 'an', 'is', 'are', 'was', 'were'].includes(word.toLowerCase());

        // Use preloaded settings (no need to fetch again)
        const targetLang = this.storage.state.targetLanguage;
        const level = this.storage.state.definitionLevel;

        this.logger.debug(`Using settings: ${targetLang}, ${level}`);

        // Language names for clearer instructions
        const langNames = {
            'fa': 'Persian',
            'ja': 'Japanese',
            'es': 'Spanish',
            'fr': 'French',
            'de': 'German',
            'ko': 'Korean',
            'zh': 'Chinese',
            'ar': 'Arabic',
            'hi': 'Hindi',
            'pt': 'Portuguese',
            'ru': 'Russian'
        };

        // Level-specific instructions
        const levelInstructions = {
            'beginner': 'Use only simple, common words. Explain like teaching a child. Keep sentences very short.',
            'intermediate': 'Use clear language with some advanced vocabulary where appropriate.',
            'advanced': 'Use precise, sophisticated vocabulary and detailed explanations.'
        };

        // Use optimized prompt
        const prompt = isCommonWord ? 
            `Word: "${word}", Context: "${context}"
            JSON only: {"definition": "brief", "partOfSpeech": "type", "frequency": "very common"}` :
            `Word: "${word}"
            Context: "${context}"
            User Level: ${level}
            
            Instructions: ${levelInstructions[level]}

            Return JSON only:
            {
            "pronunciation": "IPA",
            "partOfSpeech": "type",
            "definition": "VERY SIMPLE explanation using basic words only",
            "synonyms": ["3-4 simple alternatives"],
            "translations": {"${targetLang}": "${langNames[targetLang]} translation"},
            "frequency": "very common/common/uncommon/rare",
            "refinedSentence": "${context ? context.replace(/[.!?]+$/, '').trim() + '.' : 'The word ' + word + '.'}",
            "sentenceTranslation": "translate sentence to ${langNames[targetLang]}"
            }`;

            // Update system message for beginner mode
            const systemMessage = level === 'beginner' ? 
                'You are teaching English to beginners. Use ONLY simple words. Avoid complex terms.' :
                'Analyze subtitle words. JSON only.';

        try {

            let response;
    
    if (apiMode === 'public') {
        // Use YourVocab public API
        const { vocabToken, vocabTokenExpiry } = await chrome.storage.sync.get(['vocabToken', 'vocabTokenExpiry']);

        if (!vocabToken) {
            this.logger.error('Public API requires login to YourVocab');
            return {
                pronunciation: '/login-required/',
                partOfSpeech: 'error',
                definition: 'Please connect to YourVocab to use the public API',
                synonyms: ['Login', 'Required'],
                translations: {},
                frequency: 'error',
                refinedSentence: 'Authentication required',
                sentenceTranslation: 'Please connect your account'
            };
        }

        // Check token expiry
        if (vocabTokenExpiry && Date.now() >= vocabTokenExpiry) {
            this.logger.warn('Token expired. Please reconnect to YourVocab.');
            // Clear expired token
            await chrome.storage.sync.remove(['vocabToken', 'vocabUserId', 'vocabEmail', 'vocabTokenExpiry']);

            return {
                pronunciation: '/session-expired/',
                partOfSpeech: 'error',
                definition: 'Session expired. Please reconnect to YourVocab at https://yourvocab.vercel.app/extension-auth',
                synonyms: ['Session', 'Expired'],
                translations: {},
                frequency: 'error',
                refinedSentence: 'Authentication expired',
                sentenceTranslation: 'Please reconnect your account'
            };
        }

        // Show warning if token expires soon (within 3 days)
        const threeDays = 3 * 24 * 60 * 60 * 1000;
        if (vocabTokenExpiry && (vocabTokenExpiry - Date.now()) < threeDays) {
            const daysLeft = Math.floor((vocabTokenExpiry - Date.now()) / (24 * 60 * 60 * 1000));
            this.logger.warn(`Token expires in ${daysLeft} days. Consider reconnecting soon.`);
        }

        const tokenValid = await this.validateToken(vocabToken);
        if (!tokenValid) {
            // Clear invalid token
            await chrome.storage.sync.remove(['vocabToken', 'vocabUserId', 'vocabEmail', 'vocabTokenExpiry']);

            return {
                pronunciation: '/session-expired/',
                partOfSpeech: 'error',
                definition: 'Session expired. Please reconnect to YourVocab.',
                synonyms: ['Session', 'Expired'],
                translations: {},
                frequency: 'error',
                refinedSentence: 'Authentication expired',
                sentenceTranslation: 'Please reconnect your account'
            };
        }

        response = await fetch('https://yourvocab.vercel.app/api/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${vocabToken}`
            },
            body: JSON.stringify({
                word: word,
                context: context,
                targetLanguage: this.storage.state.targetLanguage,
                level: this.storage.state.definitionLevel
            })
        });
        
        // Increment public API usage
        this.storage.state.incrementPublicApiUsage();
        
    }

    else {
        // Use personal OpenAI API key (your existing code)
        const OPENAI_API_KEY = this.storage.state.openaiApiKey;
        
        if (!OPENAI_API_KEY) {
            this.logger.error('No API key set!');
            return {
                pronunciation: '/set-api-key/',
                partOfSpeech: 'error',
                definition: 'Please set your OpenAI API key in the extension settings.',
                // ... rest of your existing error response
            };
        }
            response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${OPENAI_API_KEY}`
                },
                body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: systemMessage
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.1,
                max_tokens: isCommonWord ? 100 : 300,
                top_p: 0.1
            })
            });

            this.storage.state.incrementApiCall();
        }

            // Clean old cache entries
            if (this.storage.state.apiCache.size > 100) {
                const oldestKey = this.storage.state.apiCache.keys().next().value;
                this.storage.state.apiCache.delete(oldestKey);
            }

            
            if (!response.ok) {
                // Special handling for rate limit
                if (response.status === 429) {
                    const errorData = await response.json();
                    return {
                        definition: `Daily limit reached (${errorData.usage}/${errorData.limit}). Try again tomorrow!`,
                        pronunciation: '/limit-reached/',
                        partOfSpeech: 'limit',
                        synonyms: ['Limit', 'Reached'],
                        translations: {},
                        frequency: 'error',
                        refinedSentence: 'Daily limit exhausted',
                        sentenceTranslation: 'Please wait until tomorrow'
                    };
                }
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();

            // Parse based on which API we used
            let parsed;
            try {
                if (apiMode === 'public') {
                    // Public API returns the analysis directly
                    parsed = data;
                    
                    // Store usage info if available
                    if (data && data._usage) {
                        this.storage.state.publicApiUsage = data._usage.current;
                        await chrome.storage.sync.set({
                            publicApiUsage: data._usage.current
                        });
                        this.logger.info(`[YT Overlay] 📊 Public API usage: ${data._usage.current}/${data._usage.limit}`);
                        
                        // Warning notifications (with proper check)
                        if (data._usage.remaining !== undefined && data._usage.remaining <= 5) {
                            this.showLimitWarning(data._usage.remaining);
                        }

                        // Clean the response (remove internal fields)
                        delete parsed._usage;
                    }
                } else {
                    // OpenAI response needs parsing from content
                    const content = data.choices[0].message.content;
                    parsed = JSON.parse(content);
                    
                    // Your existing token tracking for OpenAI
                    if (data.usage) {
                        this.logger.debug(`Tokens: ${data.usage.total_tokens}`);
                        
                        // Track daily usage
                        const today = new Date().toDateString();
                        const key = `tokens_${today}`;
                        const stored = await chrome.storage.local.get([key]);
                        await chrome.storage.local.set({
                            [key]: (stored[key] || 0) + data.usage.total_tokens
                        });
                    }
                }
                
                this.logger.debug('API response:', parsed);
                
                // Save to persistent cache (same for both modes)
                this.storage.state.apiCache[cacheKey] = {
                    data: parsed,
                    timestamp: Date.now()
                };
                
                // Limit cache size to prevent storage issues
                const cacheKeys = Object.keys(this.storage.state.apiCache);
                if (cacheKeys.length > 500) {
                    // Remove oldest entries
                    const sorted = cacheKeys.sort((a, b) => 
                        this.storage.state.apiCache[a].timestamp - this.storage.state.apiCache[b].timestamp
                    );
                    sorted.slice(0, 100).forEach(key => delete this.storage.state.apiCache[key]);
                }
                
                // Save to storage
                await chrome.storage.local.set({ apiCache: this.storage.state.apiCache });
                this.logger.debug('Cached analysis saved to storage');
                
                return parsed;
                
            } catch (parseError) {
                this.logger.error('Failed to parse API response:', parseError);
                throw parseError;
            }
            
        } catch (error) {
            this.logger.error('OpenAI API error:', error);
            // Return fallback data
            return {
                pronunciation: '/unknown/',
                partOfSpeech: 'unknown',
                definition: 'Unable to fetch definition. Please try again.',
                synonyms: ['Error loading'],
                translations: ['エラー', 'خطأ', 'ত্রুটি'],
                frequency: 'unknown',
                refinedSentence: context,
                sentenceTranslation: 'Translation unavailable'
            };
        }
        
    }

    showLimitWarning(remaining) {
        // Create warning toast
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            background: ${remaining <= 2 ? '#f44336' : '#FFA500'};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            font-size: 14px;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            animation: slideIn 0.3s ease;
        `;
        
        toast.innerHTML = `
            ⚠️ Only <strong>${remaining}</strong> lookup${remaining === 1 ? '' : 's'} left today!
            ${remaining <= 2 ? '<br><small>Consider using your own API key</small>' : ''}
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 5000);
        
        this.logger.info(`[YT Overlay] ⚠️ Limit warning shown: ${remaining} remaining`);
    }

    async validateToken(token) {
        try {
            // Quick validation against your API
            const response = await fetch('https://yourvocab.vercel.app/api/words', {
                method: 'HEAD',  // Use HEAD for lightweight check
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            return response.ok;
        } catch (error) {
            // Assume valid on network error
            return true;
        }
    }

}