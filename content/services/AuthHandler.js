/**
 * Centralized authentication error handler for JWT tokens
 * Automatically refreshes expired tokens using Supabase refresh token
 */
/**
 * Centralized authentication error handler for JWT tokens
 * Automatically refreshes expired tokens using Supabase refresh token
 */
/**
 * Bridge between existing code and new JWT Token Manager
 * Provides backward compatibility while using new JWT system
 */
class AuthHandler {
    constructor() {
        // Initialize JWT Token Manager if available
        if (typeof JWTTokenManager !== 'undefined') {
            this.tokenManager = new JWTTokenManager();
        } else {
            console.warn('[Auth] JWTTokenManager not loaded yet, will retry...');
            // Retry after a short delay
            setTimeout(() => {
                if (typeof JWTTokenManager !== 'undefined') {
                    this.tokenManager = new JWTTokenManager();
                    console.log('[Auth] ✅ JWTTokenManager loaded');
                }
            }, 1000);
        }
    }

    /**
     * Handle 401 authentication errors
     */
    async handleAuthError(response, context = '') {
        console.log(`[Auth] 🔍 Handling auth error from ${context}`);
        
        if (response.status === 401) {
            if (this.tokenManager) {
                // Try to refresh using JWT Token Manager
                const newToken = await this.tokenManager.getToken();
                if (newToken) {
                    console.log('[Auth] ✅ Token refreshed via JWT manager');
                    return newToken;
                }
            }
            
            console.log('[Auth] ❌ Token refresh failed, user needs to reconnect');
            
            // Clear invalid tokens
            if (this.tokenManager) {
                await this.tokenManager.clearToken();
            }
            
            // Notify user
            if (typeof chrome !== 'undefined' && chrome.runtime) {
                chrome.runtime.sendMessage({
                    action: 'authExpired'
                }).catch(() => {});
            }
            
            return null;
        }
        
        return null; // Not a 401 error
    }

    /**
     * Refresh the access token using JWT Token Manager
     */
    async refreshToken() {
        if (!this.tokenManager) {
            console.error('[Auth] JWT Token Manager not initialized');
            return null;
        }
        
        // Get fresh token (will auto-refresh if needed)
        const token = await this.tokenManager.getToken();
        
        if (token) {
            console.log('[Auth] ✅ Token obtained from JWT manager');
        } else {
            console.log('[Auth] ❌ Failed to get token');
        }
        
        return token;
    }

    /**
     * Get current valid token (refreshes if expired)
     */
    async getValidToken() {
        if (!this.tokenManager) {
            // Fallback to old method for backward compatibility
            const { vocabToken } = await chrome.storage.sync.get(['vocabToken']);
            return vocabToken || null;
        }
        
        // Use JWT Token Manager
        return await this.tokenManager.getToken();
    }

    /**
     * Check connection status on startup
     */
    async checkConnectionOnStartup() {
        console.log('[Auth] 🔍 Checking connection status...');
        
        if (!this.tokenManager) {
            console.warn('[Auth] Token manager not ready, using fallback');
            const { vocabToken } = await chrome.storage.sync.get(['vocabToken']);
            return !!vocabToken;
        }
        
        const isConnected = await this.tokenManager.isConnected();
        
        if (isConnected) {
            console.log('[Auth] ✅ Valid connection found');
        } else {
            console.log('[Auth] ⚠️ No valid connection found');
        }
        
        return isConnected;
    }

    /**
     * Save new JWT token from extension auth
     */
    async saveToken(token, userId, email) {
        if (!this.tokenManager) {
            // Fallback: save to storage directly
            await chrome.storage.sync.set({
                vocabToken: token,
                vocabUserId: userId,
                vocabEmail: email
            });
            return true;
        }
        
        // Use JWT Token Manager to save with expiry tracking
        return await this.tokenManager.saveToken(token, userId, email);
    }

    /**
     * Clear all tokens
     */
    async clearTokens() {
        if (this.tokenManager) {
            await this.tokenManager.clearToken();
        } else {
            // Fallback: clear from storage directly
            await chrome.storage.sync.remove([
                'vocabToken',
                'vocabRefreshToken',
                'vocabTokenExpiry',
                'vocabUserId',
                'vocabEmail'
            ]);
        }
    }

    /**
     * Get user info
     */
    async getUserInfo() {
        if (this.tokenManager) {
            return await this.tokenManager.getUserInfo();
        }
        
        // Fallback
        const { vocabUserId, vocabEmail } = await chrome.storage.sync.get(['vocabUserId', 'vocabEmail']);
        return {
            userId: vocabUserId,
            email: vocabEmail
        };
    }
}

// Create singleton instance
const authHandler = new AuthHandler();

// Create singleton instance
const authHandler = new AuthHandler();

// Create singleton instance
const authHandler = new AuthHandler();
