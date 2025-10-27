// JWT Token Manager for YourVocab Extension
// Handles token persistence, validation, and auto-refresh

class JWTTokenManager {
  constructor() {
    this.TOKEN_KEY = 'vocabToken';
    this.TOKEN_EXPIRY_KEY = 'vocabTokenExpiry';
    this.USER_ID_KEY = 'vocabUserId';
    this.EMAIL_KEY = 'vocabEmail';
    this.REFRESH_BUFFER = 5 * 60 * 1000; // Refresh 5 minutes before expiry
    this.refreshTimer = null;
  }

  // Parse JWT to get expiry (without external libraries)
  parseJWT(token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('[YT Overlay] ❌ Failed to parse JWT:', error);
      return null;
    }
  }

  // Save token with expiry tracking
  async saveToken(token, userId, email) {
    try {
      const payload = this.parseJWT(token);
      if (!payload) {
        throw new Error('Invalid JWT token');
      }

      const expiryTime = payload.exp ? payload.exp * 1000 : Date.now() + 3600000; // Default 1 hour
      
      await chrome.storage.sync.set({
        [this.TOKEN_KEY]: token,
        [this.TOKEN_EXPIRY_KEY]: expiryTime,
        [this.USER_ID_KEY]: userId || payload.sub,
        [this.EMAIL_KEY]: email || payload.email
      });

      console.log('[YT Overlay] ✅ JWT saved with expiry:', new Date(expiryTime).toLocaleString());
      
      // Set up auto-refresh
      this.scheduleRefresh(expiryTime);
      
      return true;
    } catch (error) {
      console.error('[YT Overlay] ❌ Failed to save token:', error);
      return false;
    }
  }

  // Get valid token (auto-refresh if needed)
  async getToken() {
    try {
      const result = await chrome.storage.sync.get([
        this.TOKEN_KEY, 
        this.TOKEN_EXPIRY_KEY,
        this.USER_ID_KEY
      ]);

      if (!result[this.TOKEN_KEY]) {
        console.log('[YT Overlay] 🔐 No token found');
        return null;
      }

      const now = Date.now();
      const expiry = result[this.TOKEN_EXPIRY_KEY] || 0;

      // Check if token is expired or about to expire
      if (expiry - now < this.REFRESH_BUFFER) {
        console.log('[YT Overlay] 🔄 Token expired or expiring soon, refreshing...');
        return await this.refreshToken(result[this.TOKEN_KEY], result[this.USER_ID_KEY]);
      }

      return result[this.TOKEN_KEY];
    } catch (error) {
      console.error('[YT Overlay] ❌ Failed to get token:', error);
      return null;
    }
  }

  // Refresh token via YourVocab API
  async refreshToken(currentToken, userId) {
    try {
      const response = await fetch('https://yourvocab.vercel.app/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentToken}`
        },
        body: JSON.stringify({ userId })
      });

      if (!response.ok) {
        // If refresh fails, try to reconnect
        console.log('[YT Overlay] 🔄 Token refresh failed, attempting reconnection...');
        return await this.reconnect(userId);
      }

      const data = await response.json();
      
      if (data.token) {
        await this.saveToken(data.token, data.userId, data.email);
        console.log('[YT Overlay] ✅ Token refreshed successfully');
        return data.token;
      }

      throw new Error('No token in refresh response');
    } catch (error) {
      console.error('[YT Overlay] ❌ Token refresh failed:', error);
      // Attempt silent reconnection
      return await this.reconnect(userId);
    }
  }

  // Silent reconnection using stored credentials
  async reconnect(userId) {
    try {
      console.log('[YT Overlay] 🔄 Attempting silent reconnection...');
      
      // Try to get new token using stored user ID
      const response = await fetch('https://yourvocab.vercel.app/api/auth/extension-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId })
      });

      if (!response.ok) {
        throw new Error('Reconnection failed');
      }

      const data = await response.json();
      
      if (data.token) {
        await this.saveToken(data.token, data.userId, data.email);
        console.log('[YT Overlay] ✅ Reconnected successfully');
        return data.token;
      }

      throw new Error('No token in reconnection response');
    } catch (error) {
      console.error('[YT Overlay] ❌ Reconnection failed:', error);
      // Clear invalid credentials
      await this.clearToken();
      return null;
    }
  }

  // Schedule automatic token refresh
  scheduleRefresh(expiryTime) {
    // Clear existing timer
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    const refreshTime = expiryTime - this.REFRESH_BUFFER - Date.now();
    
    if (refreshTime > 0) {
      console.log('[YT Overlay] ⏰ Token refresh scheduled in', Math.round(refreshTime / 60000), 'minutes');
      
      this.refreshTimer = setTimeout(async () => {
        console.log('[YT Overlay] ⏰ Auto-refreshing token...');
        const currentToken = await chrome.storage.sync.get(this.TOKEN_KEY);
        if (currentToken[this.TOKEN_KEY]) {
          await this.getToken(); // This will trigger refresh if needed
        }
      }, refreshTime);
    }
  }

  // Check if connected (has valid token)
  async isConnected() {
    const token = await this.getToken();
    return !!token;
  }

  // Clear token and credentials
  async clearToken() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    
    await chrome.storage.sync.remove([
      this.TOKEN_KEY,
      this.TOKEN_EXPIRY_KEY,
      this.USER_ID_KEY,
      this.EMAIL_KEY
    ]);
    
    console.log('[YT Overlay] 🗑️ Token cleared');
  }

  // Get user info
  async getUserInfo() {
    const result = await chrome.storage.sync.get([this.USER_ID_KEY, this.EMAIL_KEY]);
    return {
      userId: result[this.USER_ID_KEY],
      email: result[this.EMAIL_KEY]
    };
  }
}

// Export for use in extension
window.JWTTokenManager = JWTTokenManager;