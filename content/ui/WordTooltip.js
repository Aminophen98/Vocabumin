class Tooltip {
    constructor(mainOverlay) {
        this.mainOverlay = mainOverlay;
        this.storage = mainOverlay.storage;
    
        this.ai = mainOverlay.AI;
        
        this.tooltip = null;
        // Analysis state is now managed by StateManager
        this.currentTooltipData = null;
        
        this.setupTooltip();

        // TTS support
        this.speechSynth = window.speechSynthesis;
        this.currentSpeech = null;
    }

    setupTooltip() {
        // Create reusable tooltip element
        this.tooltip = document.createElement('div');
        this.tooltip.id = 'yt-word-tooltip';
        this.tooltip.style.cssText = `
            position: absolute;
            background: rgba(20, 20, 20, 0.85);
            color: white;
            border-radius: 16px;
            font-family: Vazirmatn, -apple-system, "YouTube Sans", "Roboto", sans-serif;
            box-shadow: 0 12px 48px rgba(0, 0, 0, 0.4);
            z-index: 2100;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.3s ease, transform 0.3s ease;
            backdrop-filter: blur(24px) saturate(180%);
            -webkit-backdrop-filter: blur(24px) saturate(180%);
            border: 1px solid rgba(255, 255, 255, 0.18);
            width: 680px;
            max-width: 90vw;
            transform: translate(-50%, -50%) scale(0.95);
            overflow: hidden;
            user-select: text;
            -webkit-user-select: text;
            max-height: calc(80vh - 40px);  /* Leave margin for video controls */
            overflow-y: auto;
            overflow-x: hidden;
            -webkit-overflow-scrolling: touch;
            box-sizing: border-box;
        `;
        

        // Add these event handlers to prevent ALL propagation
        this.tooltip.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.stopImmediatePropagation();
        });

        this.tooltip.addEventListener('mouseup', (e) => {
            e.stopPropagation();
            e.stopImmediatePropagation();
        });

        this.tooltip.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            e.stopImmediatePropagation();
        });
        
        
        // Create content container
        const content = document.createElement('div');
        content.id = 'yt-tooltip-content';
        this.tooltip.appendChild(content);
        
        // Add to video container
        const videoContainer = document.querySelector('#movie_player');
        if (videoContainer) {
            videoContainer.appendChild(this.tooltip);
        }
        
        // Click outside to close (with proper event handling)
        document.addEventListener('click', (e) => {
            if (this.tooltip.style.opacity === '1' && 
                !this.tooltip.contains(e.target) && 
                !e.target.classList.contains('caption-word')) {
                this.hideTooltip();
            }
        }, true);  // Use capture phase
        
        // ESC to close
        document.addEventListener('keydown', (e) => {
            if (this.tooltip.style.opacity === '1') {
                if (e.key === 'Escape') {
                    this.hideTooltip();
                }
                // 🎯 Space to close tooltip and resume video
                else if (e.code === 'Space') {
                    e.preventDefault(); // Prevent default space behavior
                    this.hideTooltip(true); // Resume video
                }
            }
        });
    }

    showTooltip(word, x, y, loading = true, analysisData = null) {
        // Inject styles on first tooltip show
        if (!document.getElementById('yt-tooltip-styles')) {
            this.injectTooltipStyles();
        }

        // Get video container for positioning
        const videoContainer = document.querySelector('#movie_player');
        const containerRect = videoContainer.getBoundingClientRect();

        // Define margins
        const marginTop = 20;      // Space for video title/controls
        const marginBottom = 80;   // Space for video controls
        const marginSides = 20;    // Side margins

        // Calculate available space
        const availableHeight = containerRect.height - marginTop - marginBottom;
        const availableWidth = containerRect.width - (marginSides * 2);

        // Set max dimensions
        this.tooltip.style.maxHeight = `${availableHeight}px`;
        this.tooltip.style.maxWidth = `${Math.min(680, availableWidth)}px`;
        this.tooltip.style.width = `${Math.min(680, availableWidth)}px`;

        // Position at center of available space
        const centerX = containerRect.width / 2;
        const centerY = marginTop + (availableHeight / 2);

        // Show tooltip
        this.tooltip.style.opacity = '0';
        this.tooltip.style.display = 'block';
        this.tooltip.style.pointerEvents = 'auto';
        
        if (loading) {
            // Show loading state
            this.tooltip.querySelector('#yt-tooltip-content').innerHTML = `
                <div style="
                    width: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 60px;
                    color: #aaa;
                ">
                    <div style="text-align: center;">
                        <div class="yt-tooltip-spinner" style="
                            width: 40px;
                            height: 40px;
                            border: 3px solid rgba(255, 255, 255, 0.1);
                            border-top-color: #fff;
                            border-radius: 50%;
                            animation: spin 0.8s linear infinite;
                            margin: 0 auto 16px;
                        "></div>
                        <div>Analyzing "${word}"...</div>
                    </div>
                </div>
            `;
        } else if (analysisData) {
            // 🔧 FIX: Update content with analysis data
            this.setTooltipContent(word, analysisData);
        }
        
        // Position tooltip at center
        this.tooltip.style.left = `${centerX}px`;
        this.tooltip.style.top = `${centerY}px`;
        
        // Animate in
        setTimeout(() => {
            this.tooltip.style.opacity = '1';
            this.tooltip.style.transform = 'translate(-50%, -50%) scale(1)';
        }, 10);
    }

    injectTooltipStyles() {
            const styles = document.createElement('style');
            styles.id = 'yt-tooltip-styles';
            styles.textContent = `
                /* Tooltip Container */
                #yt-word-tooltip {
                    background: rgba(20, 20, 20, 0.95) !important;
                    backdrop-filter: blur(24px) saturate(180%);
                    -webkit-backdrop-filter: blur(24px) saturate(180%);
                }
                #yt-tooltip-content {
                    padding: 20px;
                }
                
                /* Header Section */
                .yt-tooltip-header {
                    padding: 14px 24px;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                    background: rgba(255, 255, 255, 0.03);
                    /* width: 100%; */
                    margin: -14px -24px 0 -24px;
                    box-sizing: border-box;
                }
                .yt-tooltip-header-content {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 16px;
                }
                .yt-tooltip-word-info {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    flex-wrap: wrap;
                }
                .yt-tooltip-word-title {
                    margin: 0;
                    font-size: 28px;
                    font-weight: 600;
                    cursor: pointer;
                    user-select: text;
                    color: #fff;
                }
                .yt-tooltip-word-title.saved {
                    color: #4CAF50;
                }
                .yt-tooltip-pronunciation {
                    font-size: 16px;
                    color: #aaa;
                    user-select: text;
                }
                .yt-tooltip-badge {
                    color: #888;
                    font-size: 14px;
                    background: rgba(255, 255, 255, 0.08);
                    padding: 4px 12px;
                    border-radius: 20px;
                }
                .yt-tooltip-frequency {
                    font-size: 12px;
                    padding: 4px 10px;
                    border-radius: 12px;
                    font-weight: 500;
                }
                .yt-tooltip-actions {
                    display: flex;
                    gap: 8px;
                }
                .yt-tooltip-btn {
                    background: rgba(255, 255, 255, 0.08);
                    border: none;
                    color: #bbb;
                    cursor: pointer;
                    padding: 8px;
                    border-radius: 50%;
                    transition: all 0.2s;
                    width: 36px;
                    height: 36px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .yt-tooltip-btn:hover {
                    background: rgba(255, 255, 255, 0.15);
                    transform: scale(1.1);
                }
                
                /* Two Column Layout */
                .yt-tooltip-content-wrapper {
                    display: flex;
                    gap: 24px;
                    margin-top: 20px;
                    /* padding: 24px; */
                    /* flex-wrap: wrap; */
                }
                .yt-tooltip-column {
                    flex: 1 1 300px;
                    min-width: 0;
                }
                .yt-tooltip-column.left {
                    padding-right: 20px;
                    border-right: 1px solid rgba(255, 255, 255, 0.08);
                }
                
                /* Typography */
                .yt-tooltip-section {
                    margin-bottom: 24px;
                }
                .yt-tooltip-label {
                    font-size: 12px;
                    text-transform: uppercase;
                    color: #888;
                    margin: 0 0 10px 0;
                    font-weight: 600;
                    letter-spacing: 0.5px;
                }
                .yt-tooltip-label.clickable {
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    user-select: none;
                }
                .yt-tooltip-text {
                    margin: 0;
                    font-size: 15px;
                    line-height: 1.6;
                    color: #e0e0e0;
                    user-select: text;
                }
                .yt-tooltip-context {
                    margin: 0;
                    font-size: 16px;
                    line-height: 1.7;
                    color: #fff;
                    background: rgba(255, 255, 255, 0.06);
                    padding: 16px;
                    border-radius: 10px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    user-select: text;
                }
                .yt-tooltip-translation {
                    display: none;
                    margin: 0;
                    font-size: 15px;
                    line-height: 1.7;
                    color: #e0e0e0;
                    background: rgba(100, 200, 255, 0.08);
                    padding: 16px;
                    border-radius: 10px;
                    border: 1px solid rgba(100, 200, 255, 0.2);
                    user-select: text;
                }
                .yt-tooltip-translation.visible {
                    display: block;
                }
                
                /* Tags */
                .yt-tooltip-tags {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                }
                .yt-tooltip-tag {
                    background: rgba(255, 255, 255, 0.08);
                    padding: 6px 12px;
                    border-radius: 18px;
                    font-size: 14px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    user-select: text;
                    transition: all 0.2s;
                    cursor: default;
                    color: #fff;
                }
                .yt-tooltip-tag:hover {
                    background: rgba(255, 255, 255, 0.12);
                    border-color: rgba(255, 255, 255, 0.2);
                }
                .yt-tooltip-tag.translation {
                    background: rgba(100, 200, 255, 0.15);
                    border-color: rgba(100, 200, 255, 0.3);
                    font-size: 15px;
                }
                
                /* Utilities */
                .yt-tooltip-arrow {
                    font-size: 10px;
                    transition: transform 0.2s;
                    display: inline-block;
                }
                .yt-tooltip-arrow.open {
                    transform: rotate(90deg);
                }
                .yt-tooltip-saved-indicator {
                    color: #4CAF50;
                    font-size: 14px;
                }
            `;
            document.head.appendChild(styles);
        
    }

    // Simple text-to-speech
    async speakWord(word) {
        try {
            // Stop any current speech
            if (this.currentSpeech) {
                this.speechSynth.cancel();
            }

            // Create speech utterance
            const utterance = new SpeechSynthesisUtterance(word);
            
            // Configure speech
            utterance.rate = 0.8; // Slightly slower
            utterance.volume = 0.9;
            
            // Track current speech
            utterance.onstart = () => {
                this.currentSpeech = utterance;
                console.log(`[YT Overlay] 🔊 Speaking: "${word}"`);
            };
            
            utterance.onend = () => {
                this.currentSpeech = null;
            };
            
            // Start speaking
            this.speechSynth.speak(utterance);
            
        } catch (error) {
            console.error(`[YT Overlay] ❌ Speech failed:`, error);
        }
    }

    setTooltipContent(word, data) {
        // Store for potential saving
        this.mainOverlay.state.setLastAnalyzedWord(word, data);

        // Check if word is already saved
        const wordKey = word.toLowerCase().trim();
        const isSaved = this.storage.state.savedWords && this.storage.state.savedWords[wordKey];

        // Ensure data has all required fields
        data = {
            pronunciation: data?.pronunciation || '/unknown/',
            partOfSpeech: data?.partOfSpeech || 'unknown',
            definition: data?.definition || 'Loading...',
            synonyms: data?.synonyms || [],
            translations: data?.translations || {},
            frequency: data?.frequency || 'unknown',
            refinedSentence: data?.refinedSentence || `The word "${word}"`,
            sentenceTranslation: data?.sentenceTranslation || ''
        };

        const content = this.tooltip.querySelector('#yt-tooltip-content');
        
        content.innerHTML = `
            <!-- Header -->
            <div class="yt-tooltip-header">
                <div class="yt-tooltip-header-content">
                    <div class="yt-tooltip-word-info">
                        <h2 class="yt-tooltip-word-title ${isSaved ? 'saved' : ''}" 
                            data-word="${word}"
                            style="cursor: pointer; transition: all 0.2s;"
                            title="${isSaved ? 'Click to delete' : 'Click to save'}">
                            ${word}
                        </h2>
                        <span class="yt-tooltip-pronunciation">${data.pronunciation}</span>
                        <span class="yt-tooltip-badge">${data.partOfSpeech}</span>
                        <span class="yt-tooltip-frequency" style="background: ${this.getFrequencyColor(data.frequency)}">${data.frequency}</span>
                        
                    </div>
                    <div class="yt-tooltip-actions">
                        <button class="yt-tooltip-btn yt-tooltip-audio" title="Play pronunciation">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
                            </svg>
                        </button>
                        <button class="yt-tooltip-btn yt-tooltip-search" title="Search on Google">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                            </svg>
                        </button>
                        <button class="yt-tooltip-btn yt-tooltip-close" title="Close">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- Two Column Content -->
            <div class="yt-tooltip-content-wrapper">
                <!-- Left Column -->
                <div class="yt-tooltip-column left">
                    <div class="yt-tooltip-section">
                        <h3 class="yt-tooltip-label">Definition</h3>
                        <p class="yt-tooltip-text">${data.definition}</p>
                    </div>
                    
                    <div class="yt-tooltip-section">
                        <h3 class="yt-tooltip-label">Synonyms</h3>
                        <div class="yt-tooltip-tags">
                            ${this.renderSynonyms(data.synonyms)}
                        </div>
                    </div>
                    
                    <div class="yt-tooltip-section">
                        <h3 class="yt-tooltip-label clickable yt-tooltip-toggle" data-target="translations">
                            Translations
                            <span class="yt-tooltip-arrow">▶</span>
                        </h3>
                        <div id="translations" class="yt-tooltip-tags" style="display: none;">
                            ${this.renderTranslations(data.translations)}
                        </div>
                    </div>
                </div>
                
                <!-- Right Column -->
                <div class="yt-tooltip-column">
                    <div class="yt-tooltip-section">
                        <h3 class="yt-tooltip-label">Context Sentence</h3>
                        <p class="yt-tooltip-context">${this.highlightWordInSentence(data.refinedSentence, word)}</p>
                    </div>
                    
                    <div class="yt-tooltip-section">
                        <h3 class="yt-tooltip-label clickable yt-tooltip-toggle" data-target="sentence-translation">
                            Translation
                            <span class="yt-tooltip-arrow">▶</span>
                        </h3>
                        <p id="sentence-translation" class="yt-tooltip-translation"
                        ${this.isRTLLanguage(this.storage.state.targetLanguage) ? 'style="direction: rtl; text-align: right;"' : ''}>
                            ${data.sentenceTranslation}
                        </p>
                    </div>
                </div>
            </div>
        `;
        
        this.addTooltipInteractivity(word, data);
    }

    isRTLLanguage(lang) {
        const rtlLanguages = ['ar', 'he', 'fa', 'ur', 'yi', 'ji', 'iw', 'ku', 'ms', 'ml'];
        return rtlLanguages.includes(lang.toLowerCase());
    }

    getFrequencyColor(frequency) {
        const colors = {
            'rare': 'rgba(255, 100, 100, 0.3)',
            'uncommon': 'rgba(255, 180, 100, 0.3)',
            'common': 'rgba(100, 255, 100, 0.3)',
            'very common': 'rgba(100, 200, 255, 0.3)'
        };
        return colors[frequency] || colors['common'];
    }

    highlightWordInSentence(sentence, word) {
        if (!sentence) return 'No context available';

        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        return sentence.replace(regex, `<span style="
            background: rgba(255, 215, 0, 0.3);
            padding: 2px 4px;
            border-radius: 4px;
            font-weight: 600;
        ">${word}</span>`);
    }

    addTooltipInteractivity(word, analysisData) {
        // Store the analysis data
        this.currentTooltipData = analysisData;
        
        // Word title click handler for toggle save/delete
        const wordTitle = this.tooltip.querySelector('.yt-tooltip-word-title');
        if (wordTitle) {
            // Add hover effect
            wordTitle.addEventListener('mouseenter', () => {
                if (!wordTitle.dataset.processing) {
                    wordTitle.style.transform = 'scale(1.05)';
                    wordTitle.style.textShadow = '0 0 10px rgba(255,255,255,0.3)';
                }
            });
            
            wordTitle.addEventListener('mouseleave', () => {
                if (!wordTitle.dataset.processing) {
                    wordTitle.style.transform = 'scale(1)';
                    wordTitle.style.textShadow = 'none';
                }
            });
            
            // Click handler for toggle save/delete
            wordTitle.addEventListener('click', async (e) => {
                e.stopPropagation();
                
                // Prevent double clicks
                if (wordTitle.dataset.processing === 'true') return;
                wordTitle.dataset.processing = 'true';
                
                const wordKey = word.toLowerCase().trim();
                const isSaved = this.storage.state.savedWords && this.storage.state.savedWords[wordKey];
                
                try {
                    if (isSaved) {
                        // Delete the word
                        console.log(`[YT Overlay] 🗑️ Deleting word: ${word}`);
                        await this.storage.deleteWord(word);
                        
                        // Update UI to reflect unsaved state
                        wordTitle.classList.remove('saved');
                        wordTitle.style.color = '#fff';
                        wordTitle.title = 'Click to save';
                        
                        // Remove saved indicator
                        const savedIndicator = this.tooltip.querySelector('.yt-tooltip-saved-indicator');
                        if (savedIndicator) {
                            savedIndicator.remove();
                        }
                        
                        // Remove highlight from captions
                        document.querySelectorAll('.caption-word').forEach(captionWord => {
                            if (captionWord.textContent.toLowerCase().trim() === wordKey) {
                                captionWord.classList.remove('highlighted-word');
                            }
                        });
                        
                        // Show feedback
                        wordTitle.style.color = '#f44336';
                        setTimeout(() => {
                            wordTitle.style.color = '#fff';
                        }, 500);
                        
                    } else {
                        // Save the word
                        console.log(`[YT Overlay] 💾 Saving word: ${word}`);
                        const dataToSave = analysisData || this.currentTooltipData || {};
                        await this.storage.saveWord(word, dataToSave);
                        
                        // Update UI to reflect saved state
                        wordTitle.classList.add('saved');
                        wordTitle.style.color = '#4CAF50';
                        wordTitle.title = 'Click to delete';
            
                        
                        // Highlight in captions
                        this.mainOverlay.player.highlightWordInCaptions(word);
                        
                        // Show feedback
                        wordTitle.style.transform = 'scale(1.1)';
                        setTimeout(() => {
                            wordTitle.style.transform = 'scale(1)';
                        }, 300);
                    }
                    
                } catch (error) {
                    console.error('[YT Overlay] ❌ Toggle save/delete error:', error);
                    wordTitle.style.color = '#f44336';
                    setTimeout(() => {
                        wordTitle.style.color = isSaved ? '#4CAF50' : '#fff';
                    }, 1000);
                }
                
                wordTitle.dataset.processing = 'false';
            });
        }
        
        // Save button handler (remove old save button since we now use word title)
        const saveBtn = this.tooltip.querySelector('.yt-tooltip-word');
        if (saveBtn) {
            saveBtn.style.display = 'none';  // Hide old save button
        }
        
        // Audio button
        const audioBtn = this.tooltip.querySelector('.yt-tooltip-audio');
        audioBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // Visual feedback
            audioBtn.style.color = '#4CAF50';
            audioBtn.style.background = 'rgba(76, 175, 80, 0.2)';
            
            // Actually speak the word
            this.speakWord(word);
            
            setTimeout(() => {
                audioBtn.style.color = '#bbb';
                audioBtn.style.background = 'rgba(255, 255, 255, 0.08)';
            }, 1000);
            
            console.log('[YT Overlay] 🔊 Playing pronunciation for:', word);
        });
        
        audioBtn.addEventListener('mouseenter', () => {
            audioBtn.style.background = 'rgba(255, 255, 255, 0.15)';
            audioBtn.style.transform = 'scale(1.1)';
        });
        audioBtn.addEventListener('mouseleave', () => {
            audioBtn.style.background = 'rgba(255, 255, 255, 0.08)';
            audioBtn.style.transform = 'scale(1)';
        });
        
        // Google search button
        const searchBtn = this.tooltip.querySelector('.yt-tooltip-search');
        searchBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            window.open(`https://www.google.com/search?q=${encodeURIComponent(word + ' meaning')}`, '_blank');
        });
        
        searchBtn.addEventListener('mouseenter', () => {
            searchBtn.style.background = 'rgba(255, 255, 255, 0.15)';
            searchBtn.style.transform = 'scale(1.1)';
        });
        searchBtn.addEventListener('mouseleave', () => {
            searchBtn.style.background = 'rgba(255, 255, 255, 0.08)';
            searchBtn.style.transform = 'scale(1)';
        });
        
        // Close button
        const closeBtn = this.tooltip.querySelector('.yt-tooltip-close');
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.hideTooltip();
        });

        closeBtn.addEventListener('mouseenter', () => {
            closeBtn.style.background = 'rgba(255, 255, 255, 0.15)';
            closeBtn.style.transform = 'scale(1.1)';
        });
        closeBtn.addEventListener('mouseleave', () => {
            closeBtn.style.background = 'rgba(255, 255, 255, 0.08)';
            closeBtn.style.transform = 'scale(1)';
        });

        // Toggle sections
        this.tooltip.querySelectorAll('.yt-tooltip-toggle').forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                const targetId = toggle.dataset.target;
                const target = this.tooltip.querySelector(`#${targetId}`);
                const arrow = toggle.querySelector('span');
                
                if (target.style.display === 'none' || !target.style.display) {
                    target.style.display = 'flex';
                    arrow.style.transform = 'rotate(90deg)';
                } else {
                    target.style.display = 'none';
                    arrow.style.transform = 'rotate(0deg)';
                }
            });
        });
        
        // Hover effects for synonyms
        this.tooltip.querySelectorAll('.yt-synonym').forEach(syn => {
            syn.addEventListener('mouseenter', () => {
                syn.style.background = 'rgba(255, 255, 255, 0.12)';
                syn.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            });
            syn.addEventListener('mouseleave', () => {
                syn.style.background = 'rgba(255, 255, 255, 0.08)';
                syn.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            });
        });
    }

    hideTooltip(resumeVideo = false) {
        this.tooltip.style.opacity = '0';
        this.tooltip.style.transform = 'translateX(-50%) scale(0.95)';
        this.tooltip.style.pointerEvents = 'none';
        
        // 🎯 Resume video if requested
        if (resumeVideo) {
            const video = document.querySelector('video');
            if (video && video.paused) {
                video.play();
                console.log('[YT Overlay] ▶️ Video resumed');
            }
        }

        setTimeout(() => {
            if (this.tooltip.style.opacity === '0') {
                this.tooltip.style.display = 'none';
            }
        }, 300);
    }

    renderSynonyms(synonyms) {
        if (Array.isArray(synonyms) && synonyms.length > 0) {
            return synonyms.map(syn => `<span class="yt-tooltip-tag">${syn}</span>`).join('');
        }
        return '<span class="yt-tooltip-tag">No synonyms available</span>';
    }

    renderTranslations(translations) {
        if (Array.isArray(translations)) {
            return translations.map(trans => `<span class="yt-tooltip-tag translation">${trans}</span>`).join('');
        } else if (typeof translations === 'object' && translations !== null) {
            return Object.values(translations).map(trans => 
                `<span class="yt-tooltip-tag translation">${trans}</span>`
            ).join('');
        }
        return '<span class="yt-tooltip-tag translation">No translation available</span>';
    }

}