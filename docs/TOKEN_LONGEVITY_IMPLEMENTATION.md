# Token Longevity Implementation - Solution 3

## Summary

Successfully implemented **30-day JWT tokens** to prevent frequent disconnections. Users will only need to reconnect once every 30 days instead of daily.

---

## Changes Made

### Backend (Vocaminary API) - 3 Files Modified

#### 1. `/api/auth/extension-token`
**File:** `P:\Development\yourvocab\src\app\api\auth\extension-token\route.ts`

**Changes:**
- Changed token expiry from 24 hours to 30 days
- Added `expiresAt` timestamp to API response

```typescript
// Before: 24 hours
exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60)

// After: 30 days
const expiresAt = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60)
exp: expiresAt

// Response now includes:
{
  token: "...",
  userId: "...",
  email: "...",
  tier: "...",
  expiresAt: 1735689600000  // milliseconds
}
```

#### 2. `/api/auth/refresh`
**File:** `P:\Development\yourvocab\src\app\api\auth\refresh\route.ts`

**Same changes as above** - 30-day tokens with `expiresAt` in response.

#### 3. `/api/auth/generate-token`
**File:** `P:\Development\yourvocab\src\app\api\auth\generate-token\route.ts`

**Same changes as above** - 30-day tokens with `expiresAt` in response.

---

### Frontend (Extension) - 3 Files Modified

#### 1. Auth Bridge - Token Storage
**File:** `P:\Development\YTS-1\extension\js\auth-bridge.js`

**Changes:**
- Store `vocabTokenExpiry` when receiving token from web app
- Log expiry date to console for debugging
- Clear expiry when signing out

```javascript
chrome.storage.sync.set({
  vocabToken: event.data.token,
  vocabUserId: event.data.userId,
  vocabEmail: event.data.email,
  vocabTokenExpiry: expiresAt  // NEW
});
```

#### 2. API Service - Token Validation
**File:** `P:\Development\YTS-1\extension\content\services\APIService.js`

**Changes:**
- Check token expiry before making API calls
- Auto-clear expired tokens
- Show warning 3 days before expiry
- Better error messages with reconnect URL

```javascript
// Check if token expired
if (vocabTokenExpiry && Date.now() >= vocabTokenExpiry) {
  // Clear expired token
  await chrome.storage.sync.remove(['vocabToken', 'vocabUserId', 'vocabEmail', 'vocabTokenExpiry']);

  // Show error with reconnect instructions
  return { definition: 'Session expired. Please reconnect...' };
}

// Warn if expires in 3 days
if (vocabTokenExpiry && (vocabTokenExpiry - Date.now()) < 3 * 24 * 60 * 60 * 1000) {
  const daysLeft = Math.floor((vocabTokenExpiry - Date.now()) / (24 * 60 * 60 * 1000));
  this.logger.warn(`Token expires in ${daysLeft} days. Consider reconnecting soon.`);
}
```

#### 3. Extension Popup - Visual Status
**File:** `P:\Development\YTS-1\extension\popup\popup-simple.js`

**Changes:**
- Display "Expires in Xd" when token expires within 3 days
- Show "Expired" status for expired tokens
- Orange warning color for near-expiry
- Change button to "Reconnect" when expired

```javascript
if (vocabTokenExpiry && Date.now() >= vocabTokenExpiry) {
  // Expired
  this.statusDot.classList.add('disconnected');
  this.statusText.textContent = 'Expired';
  this.dashboardBtn.innerHTML = '<span>🔗</span> Reconnect';
} else if (daysLeft <= 3) {
  // Warning: expires soon
  this.statusText.textContent = `Expires in ${daysLeft}d`;
  this.statusText.style.color = '#f59e0b'; // Orange
}
```

---

### Frontend (Web App) - 1 File Modified

#### Extension Auth Page
**File:** `P:\Development\yourvocab\src\app\extension-auth\page.tsx`

**Changes:**
- Store `expiresAt` from API response
- Send `expiresAt` to extension via postMessage
- Display expiry date to user before connecting

```tsx
// Store expiry
const [expiresAt, setExpiresAt] = useState<number | null>(null);

// Send to extension
window.postMessage({
  type: 'YOURVOCAB_AUTH',
  token: token,
  userId: user?.id,
  email: user?.email,
  expiresAt: expiresAt  // NEW
}, '*');

// Show to user
<div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded mb-4">
  <p className="text-sm">
    🔒 Token valid for <strong>30 days</strong>
  </p>
  <p className="text-xs text-blue-600 mt-1">
    Expires: {new Date(expiresAt).toLocaleDateString()} at {new Date(expiresAt).toLocaleTimeString()}
  </p>
</div>
```

---

## Data Flow

### 1. User Connects Extension (First Time)

```
User visits https://app.vocaminary.com/extension-auth
  ↓
Page calls /api/auth/generate-token
  ↓
API generates JWT with 30-day expiry
  ↓
API response: { token, userId, email, tier, expiresAt }
  ↓
Page shows: "Token valid for 30 days, Expires: Dec 31, 2024 at 11:59 PM"
  ↓
User clicks "Connect Extension"
  ↓
postMessage sends: { token, userId, email, expiresAt }
  ↓
auth-bridge.js receives message
  ↓
Stores in chrome.storage.sync: { vocabToken, vocabUserId, vocabEmail, vocabTokenExpiry }
  ↓
Console logs: "Auth saved successfully! Expires: 12/31/2024"
```

### 2. User Uses Extension (During 30 Days)

```
User clicks a word for definition
  ↓
APIService.fetchWordAnalysis() called
  ↓
Check vocabTokenExpiry:
  - If expired (Date.now() >= vocabTokenExpiry):
    → Clear token
    → Show error: "Session expired. Please reconnect"
  - If expires soon (< 3 days):
    → Show warning: "Token expires in 2 days"
    → Continue working
  - If valid (> 3 days left):
    → Use normally
  ↓
Make API call with token
```

### 3. User Opens Extension Popup

```
Popup loads connection status
  ↓
Check vocabToken and vocabTokenExpiry
  ↓
If expired:
  Status: "Expired" (red dot)
  Button: "Reconnect"
  ↓
If expires in ≤3 days:
  Status: "Expires in 2d" (orange text)
  Button: "Dashboard"
  ↓
If valid (>3 days):
  Status: "Connected" (green dot)
  Button: "Dashboard"
```

---

## Testing Checklist

### Backend Testing

1. **Test token generation:**
   ```bash
   # In yourvocab project
   cd P:\Development\yourvocab
   npm run dev

   # Visit in browser
   http://localhost:3000/extension-auth
   ```

2. **Verify token expiry:**
   - Open browser DevTools → Console
   - Look for: "Token expires at: [date 30 days from now]"

3. **Check API response:**
   - Open DevTools → Network tab
   - Find `/api/auth/generate-token` request
   - Verify response includes `expiresAt` field

### Extension Testing

1. **Test new connection:**
   ```bash
   # Load extension
   chrome://extensions/
   Load unpacked → P:\Development\YTS-1\extension

   # Connect to web app
   Visit https://app.vocaminary.com/extension-auth
   Click "Connect Extension"
   ```

2. **Verify storage:**
   - DevTools → Application → Storage → Extension → chrome.storage
   - Check `vocabTokenExpiry` exists and is ~30 days in future

3. **Test popup display:**
   - Click extension icon
   - Verify status shows "Connected" (green)
   - If token will expire in 3 days, should show "Expires in Xd" (orange)

4. **Test expiry warning:**
   - Manually set expiry to 2 days from now:
     ```javascript
     // In DevTools console on YouTube
     chrome.storage.sync.set({
       vocabTokenExpiry: Date.now() + (2 * 24 * 60 * 60 * 1000)
     });
     ```
   - Click a word for definition
   - Check console for: "Token expires in 2 days. Consider reconnecting soon."

5. **Test expired token:**
   - Manually set expiry to past:
     ```javascript
     // In DevTools console on YouTube
     chrome.storage.sync.set({
       vocabTokenExpiry: Date.now() - 1000
     });
     ```
   - Click a word for definition
   - Should show error: "Session expired. Please reconnect to Vocaminary"
   - Open popup → Status should show "Expired" with red dot

---

## Benefits

### For Users
✅ **Reconnect once every 30 days** instead of daily
✅ **Visual warnings** 3 days before expiry
✅ **Clear instructions** when token expires
✅ **See expiry date** when connecting

### For Developers
✅ **Centralized expiry logic** in APIService
✅ **Automatic cleanup** of expired tokens
✅ **Better debugging** with console logs
✅ **Consistent across all 3 auth endpoints**

---

## Security Considerations

### Why 30 Days is Safe

1. **Stored securely** - chrome.storage.sync is encrypted
2. **HTTPS only** - Tokens only sent over secure connections
3. **Limited scope** - Tokens only work with Vocaminary API
4. **Automatic cleanup** - Expired tokens auto-deleted
5. **User control** - Users can manually reconnect anytime

### Trade-offs

| Aspect | 24 Hours (Old) | 30 Days (New) |
|--------|---------------|---------------|
| Security | Higher | Slightly Lower |
| Convenience | Lower | Much Higher |
| User Friction | High (daily reconnect) | Low (monthly reconnect) |
| Token Exposure | 1 day | 30 days |

**Recommendation:** 30 days is appropriate for a browser extension with limited API scope.

---

## Rollback Plan

If you need to revert to 24-hour tokens:

### Backend Changes
In all 3 files (`extension-token`, `refresh`, `generate-token`):
```typescript
// Change this line:
const expiresAt = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60)

// Back to:
const expiresAt = Math.floor(Date.now() / 1000) + (24 * 60 * 60)
```

### Extension Changes
No changes needed - extension code works with any expiry duration.

---

## Future Improvements

### Optional Enhancements

1. **Configurable expiry duration**
   - Add `JWT_EXPIRY_DAYS` environment variable
   - Default: 30 days
   - Allow admins to configure per deployment

2. **Refresh token rotation**
   - Implement refresh tokens for enhanced security
   - Auto-refresh 1 day before expiry

3. **Email notification**
   - Send email 7 days before expiry
   - Remind users to reconnect

4. **Premium tier benefits**
   - Free users: 30 days
   - Premium users: 90 days or never expire

---

## Deployment

### Backend (Vocaminary)

```bash
cd P:\Development\yourvocab

# Build and test locally
npm run build
npm run dev

# Deploy to Vercel
git add .
git commit -m "Implement 30-day token longevity"
git push origin main

# Vercel auto-deploys from main branch
```

### Extension

```bash
cd P:\Development\YTS-1

# Users need to reload extension after update
# In chrome://extensions/
# Click reload icon on extension card
```

**Note:** Existing users with old 24-hour tokens will need to reconnect once to get the new 30-day token.

---

## Monitoring

### Check Token Usage

```sql
-- In Supabase SQL Editor (if you track JWT usage)
SELECT
  user_id,
  created_at,
  exp as expires_at,
  (exp - extract(epoch from now())) / 86400 as days_until_expiry
FROM auth_tokens
WHERE expires_at > now()
ORDER BY days_until_expiry ASC
LIMIT 100;
```

### Console Logs to Watch

**Extension Console (YouTube page):**
```
[Vocaminary] Token expires at: 12/31/2024, 11:59:59 PM
[Vocaminary] Auth saved successfully! Expires: 12/31/2024
⚠️ Token expires in 2 days. Consider reconnecting soon.
❌ Token expired. Please reconnect to Vocaminary.
```

**Web App Console (extension-auth page):**
```
[Extension Auth] Token received successfully
[Extension Auth] Token expires at: 12/31/2024, 11:59:59 PM
```

---

## Support

### Common User Questions

**Q: How do I know when my token will expire?**
A: Open the extension popup - it shows "Expires in Xd" when less than 3 days remain.

**Q: What happens if my token expires?**
A: You'll see "Session expired" error when clicking words. Just visit https://app.vocaminary.com/extension-auth to reconnect.

**Q: Do I need to reconnect every day?**
A: No! Tokens now last 30 days. You only need to reconnect once per month.

**Q: Can I manually reconnect before expiry?**
A: Yes! Visit extension-auth page anytime to get a fresh 30-day token.

---

## Version History

**Version 1.0** (Current Implementation)
- 30-day JWT tokens
- Expiry tracking in extension
- Visual warnings in popup
- Auto-cleanup of expired tokens

**Future Versions**
- v1.1: Email expiry notifications
- v1.2: Automatic token refresh
- v2.0: Refresh token rotation

---

## Files Changed Summary

### Backend (3 files)
✅ `P:\Development\yourvocab\src\app\api\auth\extension-token\route.ts`
✅ `P:\Development\yourvocab\src\app\api\auth\refresh\route.ts`
✅ `P:\Development\yourvocab\src\app\api\auth\generate-token\route.ts`

### Extension (3 files)
✅ `P:\Development\YTS-1\extension\js\auth-bridge.js`
✅ `P:\Development\YTS-1\extension\content\services\APIService.js`
✅ `P:\Development\YTS-1\extension\popup\popup-simple.js`

### Web App (1 file)
✅ `P:\Development\yourvocab\src\app\extension-auth\page.tsx`

**Total: 7 files modified**

---

## Conclusion

✅ **Implementation Complete**
✅ **Ready for Testing**
✅ **Backward Compatible** (old tokens still work until they expire)
✅ **User-Friendly** (visual indicators and warnings)
✅ **Secure** (automatic cleanup of expired tokens)

**Next Steps:**
1. Test locally (both backend and extension)
2. Deploy backend to Vercel
3. Reload extension in Chrome
4. Reconnect to get new 30-day token
5. Monitor console logs for any issues
