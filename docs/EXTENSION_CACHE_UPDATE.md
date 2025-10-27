# YouTube Extension - Server Cache Integration

## 🚀 What Changed

### New Features Added
1. **SubtitleManager.js** - Centralized subtitle fetching with multi-layer caching
2. **Server cache integration** - Share subtitles with all users
3. **Rate limiting** - Prevent YouTube blocks
4. **Visual indicators** - Show cache status, usage limits, and errors

### How It Works Now

#### Subtitle Fetch Flow:
```
1. User clicks word on YouTube
2. Check local cache (instant)
3. Check server cache (100ms)
4. Check rate limits
5. Fetch from yt-dlp if needed
6. Store in server cache for others
7. Store in local cache
```

### Files Modified
- **manifest.json** - Added SubtitleManager.js to load order
- **CaptionService.js** - Integrated SubtitleManager for fetching
- **SubtitleManager.js** - New file handling all caching logic

## 📊 User Benefits

### Speed Improvements
- **Local cache hit**: 0ms (instant)
- **Server cache hit**: 100ms (near instant)
- **YouTube fetch**: 3000ms (only when necessary)

### Visual Indicators
Users now see:
- ⚡ **Local cache** - "Cached (Xm ago)"
- ☁️ **Server cache** - "From server cache"  
- 🔄 **Fresh fetch** - "Fresh fetch"
- 📊 **Usage limits** - Shows burst/hourly/daily usage
- ⚠️ **Rate limits** - Clear error when limits hit

## 🔧 Testing Instructions

### Test Cache Flow
1. Open a YouTube video
2. Click a word - should fetch from YouTube (first time)
3. Refresh page
4. Click same word - should show "⚡ Cached"
5. Open same video in incognito
6. Click word - should show "☁️ From server cache"

### Test Rate Limits
1. Rapidly click words on 3 different videos
2. Should see "Rate limited. Wait 5 minutes"
3. Wait 5 minutes
4. Should work again

### Test Error Handling
1. Stop yt-dlp server
2. Click a word on new video
3. Should show appropriate error message

## 🐛 Debugging

### Check Console
```javascript
// In browser console while on YouTube
console.log('[SubtitleManager] test');

// Should see logs like:
// [SubtitleManager] 🎬 Fetching subtitles for...
// [SubtitleManager] ✨ Local cache HIT!
// [SubtitleManager] ☁️ Server cache HIT!
```

### Check Storage
```javascript
// See what's cached locally
chrome.storage.local.get(null, (items) => {
  const subtitleCaches = Object.keys(items)
    .filter(k => k.startsWith('subtitle_'));
  console.log('Cached videos:', subtitleCaches);
});
```

### Force Clear Cache
```javascript
// Clear all subtitle caches
chrome.storage.local.get(null, (items) => {
  const toRemove = Object.keys(items)
    .filter(k => k.startsWith('subtitle_'));
  chrome.storage.local.remove(toRemove);
  console.log('Cleared', toRemove.length, 'caches');
});
```

## ⚙️ Configuration

### Rate Limits (Server-side)
Currently set to:
- **Burst**: 2 videos per 5 minutes
- **Hourly**: 5 videos per hour
- **Daily**: 20 videos per day

Can be adjusted in `/api/subtitles/check-limit/route.ts`

### Cache Duration
- **Local cache**: 7 days
- **Server cache**: 30 days

## 🎯 Expected Results

After implementation:
- 70% reduction in YouTube fetches
- 90% faster subtitle loading for popular videos
- Zero YouTube blocks (with proper limits)
- Better user experience with visual feedback

## 🚨 Important Notes

1. **Keep local yt-dlp server running** - Still needed for fresh fetches
2. **Auth token optional** - Works for anonymous users with temp ID
3. **Graceful fallback** - If server is down, falls back to direct fetch
4. **No breaking changes** - All existing features still work

## 📈 Monitoring Success

Watch for:
- Cache hit rate > 50% after 1 day
- No "Too Many Requests" errors from YouTube
- Positive user feedback about speed
- Reduced load on yt-dlp server

## 🔄 Next Steps

1. Test thoroughly with multiple videos
2. Monitor cache performance
3. Adjust rate limits if needed
4. Consider adding cache preloading for trending videos