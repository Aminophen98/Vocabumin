class Logger {
    constructor(module = 'YT-Overlay') {
        this.module = module;
        this.enabled = true; // Can be toggled via settings
        this.level = chrome.storage?.sync?.get('debugMode') ? 'DEBUG' : 'INFO';
        this.levels = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
    }
    
    shouldLog(level) {
        return this.enabled && this.levels[level] >= this.levels[this.level];
    }
    
    log(level, message, data = null) {
        if (!this.shouldLog(level)) return;
        
        const emoji = {
            DEBUG: '🔍',
            INFO: '📘', 
            WARN: '⚠️',
            ERROR: '❌'
        }[level];
        
        const prefix = `[${this.module}] ${emoji}`;
        
        if (data) {
            console[level.toLowerCase()](prefix, message, data);
        } else {
            console[level.toLowerCase()](prefix, message);
        }
        
        // Save errors to storage for debugging
        if (level === 'ERROR') {
            this.saveError(message, data);
        }
    }
    
    async saveError(message, data) {
        try {
            const errors = await chrome.storage.local.get(['errorLog']) || {};
            const errorLog = errors.errorLog || [];
            
            errorLog.push({
                timestamp: new Date().toISOString(),
                message,
                data,
                url: window.location.href
            });
            
            // Keep only last 50 errors
            if (errorLog.length > 50) {
                errorLog.shift();
            }
            
            await chrome.storage.local.set({ errorLog });
        } catch (e) {
            // Silently fail
        }
    }
    
    // Convenience methods
    debug(message, data) { this.log('DEBUG', message, data); }
    info(message, data) { this.log('INFO', message, data); }
    warn(message, data) { this.log('WARN', message, data); }
    error(message, data) { this.log('ERROR', message, data); }
}