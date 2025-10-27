/**
 * StateManager - Centralized state management for YouTube Subtitle Overlay
 */
class StateManager {
    constructor() {
        // Video state
        this.currentVideoId = null;
        this.videoElement = null;
        
        // Overlay state
        this.isActive = false;
        
        // Caption state
        this.captionData = null;
        this.parsedCaptions = [];
        this.currentCaptionIndex = -1;
        this.syncInterval = null;
        
        // Analysis state
        this.lastAnalyzedWord = null;
        this.lastAnalysisData = null;
        
        // UI state
        this.buttonSetupInProgress = false;
        this.playerButtonObserver = null;

        this.savedWords = {};
        this.apiCache = {};
        this.currentTooltipData = null;
        this.databaseWords = new Map();
        this.openaiApiKey = '';
        this.targetLanguage = 'ja';
        this.definitionLevel = 'beginner';

        this.dailyApiCalls = 0;
        this.dailyLimit = 10;  // Free tier
        this.isPremium = false;
        this.lastResetDate = new Date().toDateString();
        this.apiMode = 'own';  // 'own' or 'public'
        this.publicApiUsage = 0;
        this.publicApiLimit = 50;  // Free tier limit
        this.publicApiLastReset = new Date().toDateString();
    }
    
    // Video state methods
    setCurrentVideoId(videoId) {
        this.currentVideoId = videoId;
    }
    
    getCurrentVideoId() {
        return this.currentVideoId;
    }
    
    setVideoElement(element) {
        this.videoElement = element;
    }
    
    getVideoElement() {
        return this.videoElement;
    }
    
    // Overlay state methods
    setActive(active) {
        this.isActive = active;
    }
    
    isOverlayActive() {
        return this.isActive;
    }
    
    // Caption state methods
    setCaptionData(data) {
        this.captionData = data;
    }
    
    getCaptionData() {
        return this.captionData;
    }
    
    setParsedCaptions(captions) {
        this.parsedCaptions = captions;
    }
    
    getParsedCaptions() {
        return this.parsedCaptions;
    }
    
    setCurrentCaptionIndex(index) {
        this.currentCaptionIndex = index;
    }
    
    getCurrentCaptionIndex() {
        return this.currentCaptionIndex;
    }
    
    setSyncInterval(interval) {
        this.syncInterval = interval;
    }
    
    getSyncInterval() {
        return this.syncInterval;
    }
    
    clearSyncInterval() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
    }
    
    // Analysis state methods
    setLastAnalyzedWord(word, data) {
        this.lastAnalyzedWord = word;
        this.lastAnalysisData = data;
    }
    
    getLastAnalyzedWord() {
        return this.lastAnalyzedWord;
    }
    
    getLastAnalysisData() {
        return this.lastAnalysisData;
    }
    
    // UI state methods
    setButtonSetupInProgress(inProgress) {
        this.buttonSetupInProgress = inProgress;
    }
    
    isButtonSetupInProgress() {
        return this.buttonSetupInProgress;
    }
    
    setPlayerButtonObserver(observer) {
        this.playerButtonObserver = observer;
    }
    
    getPlayerButtonObserver() {
        return this.playerButtonObserver;
    }
    
    // Reset methods
    resetVideoState() {
        this.currentVideoId = null;
        this.videoElement = null;
        this.captionData = null;
        this.parsedCaptions = [];
        this.currentCaptionIndex = -1;
        this.clearSyncInterval();
    }

    checkDailyReset() {
        const today = new Date().toDateString();
        if (today !== this.lastResetDate) {
            this.dailyApiCalls = 0;
            this.lastResetDate = today;
        }
    }

    checkPublicApiReset() {
        const today = new Date().toDateString();
        if (today !== this.publicApiLastReset) {
            this.publicApiUsage = 0;
            this.publicApiLastReset = today;
            // Save to storage
            chrome.storage.sync.set({
                publicApiUsage: 0,
                publicApiLastReset: today
            });
            console.log('[YT Overlay] 📊 Public API usage reset for new day');
        }
    }

    canUsePublicApi() {
        this.checkPublicApiReset();
        return this.publicApiUsage < this.publicApiLimit;
    }

    incrementPublicApiUsage() {
        this.checkPublicApiReset();
        this.publicApiUsage++;
        // Save to storage
        chrome.storage.sync.set({
            publicApiUsage: this.publicApiUsage
        });
        console.log(`[YT Overlay] 📊 Public API usage: ${this.publicApiUsage}/${this.publicApiLimit}`);
    }

    canMakeApiCall() {
        this.checkDailyReset();
        return this.isPremium || this.dailyApiCalls < this.dailyLimit;
    }

    incrementApiCall() {
        this.checkDailyReset();
        this.dailyApiCalls++;
    }
    
}