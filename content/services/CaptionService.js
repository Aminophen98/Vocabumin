class Caption {
    constructor(state, serverManager, logger) {
        this.state = state;
        this.logger = logger || console;
        this.serverManager = serverManager;
        this.storage = new StorageManagement();
        this.storage.state = state;
        
        // Initialize SubtitleManager for caching and rate limiting
        this.subtitleManager = new SubtitleManager(logger, this.storage);
    }

    // Helper to try multiple language variants
    async tryFetchWithLanguages(serverUrl, endpoint, videoId, languages) {
        for (const lang of languages) {
            this.logger.debug(`Trying ${lang}...`);
            
            try {
                const response = await fetch(`${serverUrl}/${endpoint}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        video_id: videoId,
                        language: lang
                    })
                });
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.success) {
                        this.logger.info(`Found subtitles in ${lang}!`);
                        return { response, data, language: lang };
                    }
                }
            } catch (error) {
                // Continue to next language
            }
        }
        return null;
    }

    async fetchFromYtDlpServer(videoId) {
        // Get video title and channel name from the page
        const videoTitle = document.querySelector('h1.ytd-video-primary-info-renderer')?.textContent || 
                         document.querySelector('#title h1')?.textContent || 
                         document.title.replace(' - YouTube', '') || 
                         'Unknown';
        const channelName = document.querySelector('#channel-name a')?.textContent || 
                           document.querySelector('#owner #text a')?.textContent || 
                           'Unknown';

        this.logger.info(`[Caption] Fetching subtitles for: ${videoTitle} by ${channelName}`);

        // Use SubtitleManager for multi-layer caching and rate limiting
        const result = await this.subtitleManager.fetchSubtitles(videoId, videoTitle, channelName);
        
        if (result.error) {
            this.logger.error(`[Caption] Error: ${result.error}`);

            // Show error to user
            if (result.limit_reached) {
                this.showErrorOverlay('⏰ Daily subtitle limit reached. Try again tomorrow.', 'limit');
            } else if (result.wait_time) {
                const minutes = Math.ceil(result.wait_time / 60);
                this.showErrorOverlay(`⏰ Rate limited. Please wait ${minutes} minutes.`, 'limit');
            } else {
                this.showErrorOverlay('Failed to fetch subtitles.', 'error');
            }

            return false;
        }

        // Handle structured errors from Vocabumin API
        if (result.success === false && result.errorType) {
            const { errorType, errorMessage, isUserSideIssue, isServerIssue } = result;

            // Log for developer visibility
            if (isUserSideIssue) {
                this.logger.info(`ℹ️ [User Issue] ${errorMessage}`);
            } else if (isServerIssue) {
                this.logger.error(`❌ [Server Error] ${errorMessage}`);
            }

            // Show appropriate user message based on error type
            let userMessage = '';
            let messageType = 'error';

            switch (errorType) {
                case 'no_transcript':
                    userMessage = '⚠️ This video has no subtitles available.';
                    messageType = 'info';
                    break;
                case 'transcripts_disabled':
                    userMessage = '⚠️ Subtitles are disabled for this video by the creator.';
                    messageType = 'info';
                    break;
                case 'video_unavailable':
                    userMessage = '⚠️ This video is unavailable or has an invalid ID.';
                    messageType = 'info';
                    break;
                case 'youtube_ip_blocked':
                    // Critical server issue - YouTube blocking the API
                    const warpStatus = result.warpActive === false ? '\n\n⚠️ Warp proxy is INACTIVE!' : '';
                    userMessage = `🚨 YouTube is blocking subtitle requests from the server.${warpStatus}\n\nThe server administrator has been notified. Please try again later.`;
                    messageType = 'error';

                    // Extra logging for developer
                    this.logger.error(`🚨 [CRITICAL] YouTube IP Block Detected!`);
                    if (result.warpActive === false) {
                        this.logger.error(`🚨 [CRITICAL] Warp proxy is NOT ACTIVE - Check server immediately!`);
                    }
                    break;
                case 'server_error':
                    userMessage = `🔧 Subtitle server is experiencing issues.\n${errorMessage}\n\nPlease try again later.`;
                    messageType = 'error';
                    break;
                case 'network_error':
                    userMessage = '🔧 Network error. Please check your connection and try again.';
                    messageType = 'error';
                    break;
                default:
                    userMessage = `⚠️ Failed to fetch subtitles.\n${errorMessage}`;
                    messageType = 'error';
            }

            this.showErrorOverlay(userMessage, messageType);
            return false;
        }

        // Process the subtitles based on format
        let processedCaptions;
        
        if (result.captions) {
            // Already parsed captions (from cache or JSON3)
            if (result.captions[0] && result.captions[0].words) {
                // Has word data, process normally
                processedCaptions = result.captions;
            } else if (result.captions[0] && result.captions[0].text) {
                // Text only, need to extract words
                processedCaptions = result.captions.map(caption => ({
                    ...caption,
                    words: this.extractWords(caption.text)
                }));
            } else {
                processedCaptions = result.captions;
            }
        } else if (result.content) {
            // VTT content, need to parse
            processedCaptions = this.parseVTTCaptions(result.content);
        } else {
            this.logger.error('[Caption] Unknown subtitle format');
            return false;
        }

        // Apply segmentation if needed (but skip for Vocabumin - they have good timing already)
        const skipSegmentation = result.captionData?.type === 'manual' || 
                                result.captionData?.source === 'vocabumin';
        
        if (result.captionData && !skipSegmentation) {
            processedCaptions = this.applyUltraStrictSegmentation(processedCaptions);
            this.logger.info('[Caption] Applied segmentation to captions');
        } else {
            this.logger.info('[Caption] Skipping segmentation - using original timing');
        }

        // Store in state
        this.state.setParsedCaptions(processedCaptions);
        this.state.setCaptionData({
            count: processedCaptions.length,
            language: result.captionData?.language || 'en',
            source: result.source,
            cached: result.cached,
            type: result.captionData?.type
        });

        // Show source indicator
        if (result.cached && result.source === 'local_cache') {
            this.subtitleManager.showCacheStatus('cached', result.age_minutes);
        } else if (result.cached && result.source === 'server_cache') {
            this.subtitleManager.showCacheStatus('server_cache');
        } else {
            this.subtitleManager.showCacheStatus('fresh');
        }

        this.logger.info(`[Caption] Loaded ${processedCaptions.length} captions from ${result.source}`);

        return {
            count: processedCaptions.length,
            language: result.captionData?.language || 'en',
            source: result.source,
            fromCache: result.cached
        };
    }

    showErrorOverlay(message, type = 'error') {
        // Create error overlay
        let overlay = document.querySelector('#yt-subtitle-error-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'yt-subtitle-error-overlay';
            document.body.appendChild(overlay);
        }

        // Style based on message type
        let backgroundColor, borderColor;
        switch (type) {
            case 'info':
                // User-side issue (blue/informational)
                backgroundColor = 'rgba(59, 130, 246, 0.95)'; // Blue
                borderColor = 'rgba(96, 165, 250, 0.5)';
                break;
            case 'limit':
                // Rate limit (orange/warning)
                backgroundColor = 'rgba(249, 115, 22, 0.95)'; // Orange
                borderColor = 'rgba(251, 146, 60, 0.5)';
                break;
            case 'error':
            default:
                // Server/network error (red)
                backgroundColor = 'rgba(220, 38, 38, 0.95)'; // Red
                borderColor = 'rgba(239, 68, 68, 0.5)';
        }

        overlay.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: ${backgroundColor};
            color: white;
            padding: 20px 30px;
            border-radius: 12px;
            border: 2px solid ${borderColor};
            font-size: 14px;
            line-height: 1.6;
            z-index: 10000;
            box-shadow: 0 10px 25px rgba(0,0,0,0.3);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            max-width: 400px;
            text-align: center;
            white-space: pre-line;
        `;

        overlay.textContent = message;
        overlay.style.display = 'block';

        // Hide after 5 seconds
        setTimeout(() => {
            overlay.style.opacity = '0';
            setTimeout(() => {
                overlay.style.display = 'none';
                overlay.style.opacity = '1';
            }, 300);
        }, 5000);
    }

    async fetchVTTFormat(videoId) {
        const serverUrl = 'http://localhost:5000';
        
        try {
            this.logger.debug('Attempting VTT extraction...');
            
            const extractResponse = await fetch(`${serverUrl}/extract-subs`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    video_id: videoId,
                    language: 'en'
                })
            });
            
            if (!extractResponse.ok) {
                throw new Error(`Server returned ${extractResponse.status}`);
            }
            
            const data = await extractResponse.json();
            
            if (data.success && data.content) {
                this.logger.info(`VTT extraction successful! ${data.cue_count} cues`);
                
                // Parse VTT content
                const parsedCaptions = this.parseVTTCaptions(data.content);
                this.state.setParsedCaptions(parsedCaptions);
                
                const captionData = {
                    count: parsedCaptions.length,
                    language: data.language,
                    source: 'yt-dlp-vtt'
                };
                this.state.setCaptionData(captionData);
                
                return {
                    count: parsedCaptions.length,
                    language: data.language
                };
            }
            
            return false;
            
        } catch (error) {
            this.logger.error('VTT extraction error:', error);
            return false;
        }
    }

    
    // ========== CAPTION PARSING ==========

    parseVTTCaptions(vttContent) {
        this.logger.debug('Parsing VTT content, length:', vttContent.length);
        
        // Step 1: Extract raw captions from VTT
        const rawCaptions = this.extractRawCaptions(vttContent);
        this.logger.debug(`Extracted ${rawCaptions.length} raw captions`);
        
        // Step 2: Apply ultra-strict segmentation
        const segmentedCaptions = this.applyUltraStrictSegmentation(rawCaptions);
        this.state.setParsedCaptions(segmentedCaptions);
        
        // Step 3: Verify and log results
        this.logSegmentationStats();
        
        return this.state.getParsedCaptions();
    }

    extractRawCaptions(vttContent) {
        const captions = [];
        const lines = vttContent.split('\n');
        let i = 0;
        
        while (i < lines.length) {
            const line = lines[i].trim();
            
            // Look for timestamp line
            if (line.includes(' --> ')) {
                const timeMatch = line.match(/(\d{2}:\d{2}:\d{2}\.\d{3})\s+-->\s+(\d{2}:\d{2}:\d{2}\.\d{3})/);
                
                if (timeMatch) {
                    const startTime = this.parseVTTTime(timeMatch[1]);
                    const endTime = this.parseVTTTime(timeMatch[2]);
                    
                    // Collect caption text
                    const textLines = [];
                    i++;
                    
                    while (i < lines.length && lines[i].trim() !== '' && !lines[i].includes(' --> ')) {
                        const cleanText = lines[i].trim()
                            .replace(/<[^>]+>/g, '')                    // Remove HTML tags
                            .replace(/align:start position:\d+%/g, '')  // Remove positioning
                            .replace(/\s+/g, ' ')                       // Normalize spaces
                            .trim();
                        
                        if (cleanText) {
                            textLines.push(cleanText);
                        }
                        i++;
                    }
                    
                    // Create caption if we have text
                    const fullText = textLines.join(' ').trim();
                    if (fullText) {
                        captions.push({
                            start: startTime,
                            end: endTime,
                            text: fullText,
                            words: this.extractWords(fullText),
                            originalIndex: captions.length
                        });
                    }
                }
            }
            i++;
        }
        
        return captions;
    }

    applyUltraStrictSegmentation(rawCaptions) {
        const segmentedCaptions = [];
        
        // ULTRA-STRICT LIMITS
        const ABSOLUTE_MAX_WORDS = 12;     // Raised from 7
        const ABSOLUTE_MAX_DURATION = 3.5;  // Raised from 2.0
        const IDEAL_WORDS = 8;              // Raised from 4
        const IDEAL_DURATION = 2.5;         // Raised from 1.5
        
        for (const caption of rawCaptions) {
            const words = caption.words;
            const duration = caption.end - caption.start;
            
            // Check if caption needs segmentation
            if (words.length <= IDEAL_WORDS && duration <= IDEAL_DURATION) {
                // Already perfect
                segmentedCaptions.push(caption);
                continue;
            }
            
            // Segment this caption
            const segments = this.segmentCaption(caption, {
                absoluteMaxWords: ABSOLUTE_MAX_WORDS,
                absoluteMaxDuration: ABSOLUTE_MAX_DURATION,
                idealWords: IDEAL_WORDS,
                idealDuration: IDEAL_DURATION
            });
            
            segmentedCaptions.push(...segments);
        }
        
        return segmentedCaptions;
    }

    segmentCaption(caption, limits) {
        const segments = [];
        const words = caption.words;
        const text = caption.text;
        const totalDuration = caption.end - caption.start;
        
        // Calculate how many segments we need
        const segmentsByWords = Math.ceil(words.length / limits.idealWords);
        const segmentsByDuration = Math.ceil(totalDuration / limits.idealDuration);
        const targetSegments = Math.max(segmentsByWords, segmentsByDuration);
        
        // Find natural break points in the text
        const breakPoints = this.findNaturalBreaks(text);
        
        if (breakPoints.length > 0 && targetSegments > 1) {
            // Try to segment at natural breaks
            const naturalSegments = this.segmentAtBreaks(caption, breakPoints, targetSegments, limits);
            if (naturalSegments.length > 0) {
                return naturalSegments;
            }
        }
        
        // Fallback: Force segment by word count
        return this.forceSegmentByWords(caption, limits.idealWords, limits.absoluteMaxWords);
    }

    findNaturalBreaks(text) {
        const breaks = [];
        
        // Define break patterns with priority
        const patterns = [
            { regex: /[.!?]\s+/g, priority: 1, name: 'sentence' },
            { regex: /[;:]\s+/g, priority: 2, name: 'clause' },
            { regex: /,\s+/g, priority: 3, name: 'comma' },
            { regex: /\s+(and|but|or|so|because|since)\s+/gi, priority: 4, name: 'conjunction' },
            { regex: /\s+(then|when|where|while|which|that)\s+/gi, priority: 5, name: 'relative' },
            { regex: /\s+(to|of|in|on|at|for|with)\s+/gi, priority: 6, name: 'preposition' }
        ];
        
        // Find all break positions
        for (const pattern of patterns) {
            let match;
            while ((match = pattern.regex.exec(text)) !== null) {
                breaks.push({
                    position: match.index + match[0].length,
                    priority: pattern.priority,
                    type: pattern.name
                });
            }
        }
        
        // Sort by position and remove duplicates
        const uniqueBreaks = [];
        const seenPositions = new Set();
        
        breaks
            .sort((a, b) => a.position - b.position)
            .forEach(breakPoint => {
                if (!seenPositions.has(breakPoint.position)) {
                    seenPositions.add(breakPoint.position);
                    uniqueBreaks.push(breakPoint);
                }
            });
        
        return uniqueBreaks;
    }

    segmentAtBreaks(caption, breakPoints, targetSegments, limits) {
        const segments = [];
        const text = caption.text;
        const words = caption.words;
        const duration = caption.end - caption.start;
        
        // Select optimal break points
        const selectedBreaks = this.selectOptimalBreaks(text, breakPoints, targetSegments - 1);
        
        // Create segments
        let lastPosition = 0;
        let lastWordIndex = 0;
        
        for (let i = 0; i <= selectedBreaks.length; i++) {
            const breakPosition = i < selectedBreaks.length ? selectedBreaks[i] : text.length;
            const segmentText = text.substring(lastPosition, breakPosition).trim();
            
            if (!segmentText) continue;
            
            // Find words for this segment
            const segmentWords = [];
            while (lastWordIndex < words.length) {
                const word = words[lastWordIndex];
                const wordText = word.text + word.punctuation;
                const wordPos = text.indexOf(wordText, lastPosition);
                
                if (wordPos === -1 || wordPos >= breakPosition) {
                    break;
                }
                
                segmentWords.push(word);
                lastWordIndex++;
            }
            
            // Check if segment is within limits
            if (segmentWords.length > 0 && segmentWords.length <= limits.absoluteMaxWords) {
                const segmentStart = caption.start + (lastPosition / text.length) * duration;
                const segmentEnd = caption.start + (breakPosition / text.length) * duration;
                const segmentDuration = segmentEnd - segmentStart;
                
                if (segmentDuration <= limits.absoluteMaxDuration) {
                    segments.push({
                        start: segmentStart,
                        end: segmentEnd,
                        text: segmentText,
                        words: segmentWords
                    });
                    
                    lastPosition = breakPosition;
                    continue;
                }
            }
            
            // Segment exceeds limits, need to split further
            if (segmentWords.length > 0) {
                const subSegments = this.forceSegmentByWords(
                    {
                        start: caption.start + (lastPosition / text.length) * duration,
                        end: caption.start + (breakPosition / text.length) * duration,
                        text: segmentText,
                        words: segmentWords
                    },
                    limits.idealWords,
                    limits.absoluteMaxWords
                );
                segments.push(...subSegments);
            }
            
            lastPosition = breakPosition;
        }
        
        return segments;
    }

    selectOptimalBreaks(text, breakPoints, numBreaks) {
        if (breakPoints.length <= numBreaks) {
            return breakPoints.map(b => b.position);
        }
        
        // Select breaks that divide text most evenly
        const idealInterval = text.length / (numBreaks + 1);
        const selected = [];
        
        for (let i = 1; i <= numBreaks; i++) {
            const targetPosition = idealInterval * i;
            let bestBreak = null;
            let bestScore = Infinity;
            
            for (const breakPoint of breakPoints) {
                if (selected.includes(breakPoint.position)) continue;
                
                const distance = Math.abs(breakPoint.position - targetPosition);
                const score = distance + (breakPoint.priority * 10);
                
                if (score < bestScore) {
                    bestScore = score;
                    bestBreak = breakPoint.position;
                }
            }
            
            if (bestBreak !== null) {
                selected.push(bestBreak);
            }
        }
        
        return selected.sort((a, b) => a - b);
    }

    forceSegmentByWords(caption, idealWords, maxWords) {
        const segments = [];
        const words = caption.words;
        const duration = caption.end - caption.start;
        
        let currentIndex = 0;
        

        while (currentIndex < words.length) {
            // Determine chunk size (prefer ideal, but never exceed max)
            let chunkSize = Math.min(idealWords, words.length - currentIndex);
            if (chunkSize > maxWords) {
                chunkSize = maxWords;
            }
            
            const chunkWords = words.slice(currentIndex, currentIndex + chunkSize);
            const chunkText = chunkWords
                .map(w => w.text + w.punctuation)
                .join(' ');
            
            // Calculate timing
            const progress = currentIndex / words.length;
            const nextProgress = Math.min((currentIndex + chunkSize) / words.length, 1);
            
        segments.push({
        start: caption.start + (progress * duration),
        end: caption.start + (nextProgress * duration),
        text: chunkText,
        words: chunkWords
    });

            currentIndex += chunkSize;
        }
        
        return segments;
    }

    parseVTTTime(timeString) {
        const parts = timeString.replace(',', '.').split(':');
        let seconds = 0;
        
        if (parts.length === 3) {
            seconds = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2]);
        } else if (parts.length === 2) {
            seconds = parseInt(parts[0]) * 60 + parseFloat(parts[1]);
        } else {
            seconds = parseFloat(parts[0]);
        }
        
        return seconds;
    }

    extractWords(text) {
        return text.split(/\s+/).filter(word => word.length > 0).map(word => ({
            text: word.replace(/[.,!?;:]$/, ''),
            punctuation: /[.,!?;:]$/.test(word) ? word.slice(-1) : ''
        }));
    }

    logSegmentationStats() {
        let totalWords = 0;
        let totalDuration = 0;
        let maxWords = 0;
        let maxDuration = 0;
        const longSegments = [];
        
        this.state.getParsedCaptions().forEach((caption, index) => {
            const words = caption.words.length;
            const duration = caption.end - caption.start;
            
            totalWords += words;
            totalDuration += duration;
            
            if (words > maxWords) maxWords = words;
            if (duration > maxDuration) maxDuration = duration;
            
            // Flag any segments over limits
            if (words > 7 || duration > 2) {
                longSegments.push({
                    index,
                    words,
                    duration: duration.toFixed(1),
                    text: caption.text.substring(0, 40) + '...'
                });
            }
        });
        
        const parsedCaptions = this.state.getParsedCaptions();
        const avgWords = (totalWords / parsedCaptions.length).toFixed(1);
        const avgDuration = (totalDuration / parsedCaptions.length).toFixed(1);
        
        this.logger.debug('Segmentation Statistics:', {
            totalSegments: parsedCaptions.length,
            avgWords: avgWords,
            avgDuration: avgDuration + 's',
            maxWords: maxWords,
            maxDuration: maxDuration.toFixed(1) + 's',
            overLimitCount: longSegments.length
        });
        
        if (longSegments.length > 0) {
            this.logger.warn('Segments exceeding limits:', longSegments);
        }
    }

    // ========== END CAPTION PARSING ==========
}