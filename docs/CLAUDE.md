# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

YouTube Subtitle Overlay - A Chrome Manifest V3 extension that overlays YouTube subtitles with word-level precision and AI-powered definitions. Designed for language learners to study while watching videos.

**Tech Stack:**
- Vanilla JavaScript (no frameworks)
- Chrome Extension Manifest V3
- Python Flask server (optional local subtitle extraction)
- Cloud API: app.vocaminary.com
- Chrome Storage API + IndexedDB

## Development Commands

### Extension Development
```bash
# Load extension in Chrome
# 1. Navigate to chrome://extensions/
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select the /extension directory

# Watch logs in extension
# Open DevTools on any YouTube page, check Console for emoji-prefixed logs:
# 🔍 Debug, 📘 Info, ⚠️ Warning, ❌ Error
```

### Local Python Server (Optional)
```bash
# Install dependencies
pip install yt-dlp flask flask-cors

# Start server
cd server
python yt-dlp-server.py

# Server runs on http://localhost:5000
# Endpoints:
#   GET  /health - Health check + cache stats
#   POST /extract-subs-json3 - Extract subtitles with word timing (PREFERRED)
#   POST /extract-subs - Extract VTT format
#   POST /list-subs - List available subtitle languages
```

### Testing
No formal test suite exists. Manual testing on YouTube:
1. Load extension
2. Navigate to a YouTube video with captions
3. Click "Enable Overlay" button on player
4. Verify captions sync properly
5. Click words to test definition tooltips

## Architecture Overview

### Critical Load Order
Content scripts MUST load in this exact order (defined in manifest.json). Breaking this order causes cascading failures:

```
1. Logger.js              # Base logging system
2. EventBus.js           # Pub/sub event system
3. StateManager.js       # Centralized state
   ↓
4. Services              # Business logic layer
5. YouTube handlers      # Video detection
6. UI components         # Visual elements
   ↓
7. content-script.js     # Main orchestrator
```

**Why order matters:** Each class depends on global variables set by previous scripts. StateManager expects `logger` to exist, SubtitleManager expects `stateManager`, etc.

### Core Architecture Pattern

**StateManager** (`extension/content/core/StateManager.js`)
- Single source of truth for all application state
- Never mutate state directly - always use getter/setter methods
- State includes: currentVideoId, isActive, parsedCaptions, captionData, apiMode, etc.

**EventBus** (`extension/content/core/EventBus.js`)
- Custom pub/sub system decoupling components
- Key events: `urlChange`, `videoPlay`, `leftYouTube`, `vocabAuth`
- Also handles Chrome extension messages via `registerMessageHandler()`

**Logger** (`extension/content/Logger.js`)
- Emoji-based structured logging: `logger.debug()`, `logger.info()`, `logger.warn()`, `logger.error()`
- Errors automatically persisted to Chrome storage for debugging

### The Multi-Layer Caching System

**Most important component:** `SubtitleManager.js` (878 lines)

3-layer cache minimizes YouTube API calls:

```
User enables overlay
  ↓
1. Memory Cache (RAM)        → <1ms, last 3 videos
  ↓ (miss)
2. IndexedDB (Disk)          → 20-50ms, 7-day retention
  ↓ (miss)
3. Server Cache (Cloud)      → 100-200ms, shared across all users
  ↓ (miss)
4. Rate Limit Check          → Block if exceeded
  ↓ (allowed)
5. Fetch from Source         → 2-5s from Vocaminary API or local yt-dlp
  ↓
6. Store in all caches       → Instant next time
```

**Two subtitle sources:**
1. **Vocaminary API** (Cloud, default): `https://api.vocaminary.com/transcript/{videoId}`
2. **Local yt-dlp** (User configurable): `http://localhost:5000/extract-subs-json3`

### Key Data Structures

**Subtitle format:**
```javascript
{
  captions: [
    {
      start: 0.5,              // seconds
      end: 2.3,
      text: "Hello world",
      words: [
        {text: "Hello", punctuation: ""},
        {text: "world", punctuation: ""}
      ]
    }
  ],
  captionData: {
    language: "en",
    source: "vocaminary" | "local-ytdlp" | "server_cache",
    type: "auto-generated" | "manual"
  }
}
```

**State structure** (in StateManager):
```javascript
{
  currentVideoId: string,
  videoElement: HTMLVideoElement,
  isActive: boolean,
  captionData: {language, source, type},
  parsedCaptions: [{start, end, text, words}, ...],
  currentCaptionIndex: number,
  syncInterval: number,
  openaiApiKey: string,
  apiMode: 'own' | 'public',
  dailyApiCalls: number
}
```

## Important Architectural Patterns

### 1. Initialization Flow
```javascript
// content-script.js - main entry point
const overlay = new YouTubeSubtitleOverlay();
overlay.init();  // Waits for YouTube DOM to be ready
```

### 2. Video Change Detection
```javascript
// EventBus detects URL changes via MutationObserver
eventBus.on('urlChange', (newUrl) => {
  // Stop current sync
  // Reset overlay state
  // Clear old captions
  // Ready for new video
});
```

### 3. Caption Synchronization
```javascript
// PlayerIntegration class in OverlayUI.js
// Adaptive sync rate: 50-500ms based on playback state
setInterval(() => {
  const currentTime = video.currentTime;
  const caption = findCaptionAtTime(currentTime);
  renderToOverlay(caption);
}, syncRate);
```

### 4. Error Handling
- All fetch operations have try/catch with user-friendly error messages
- Errors logged to console AND persisted to Chrome storage
- Graceful fallbacks: Vocaminary fails → try local yt-dlp → show error

### 5. Rate Limiting
- Client-side: Track requests per video ID, enforce delays
- Server-side: Python server enforces 2-second intervals per video
- Cloud API: IP-based rate limiting with Warp proxy fallback

## File Organization

```
extension/
├── manifest.json                    # Extension config (Manifest V3)
├── background/service-worker.js     # Lifecycle management
├── content/
│   ├── core/                        # Foundation (Logger, EventBus, StateManager)
│   ├── services/                    # Business logic (SubtitleManager, APIService, etc.)
│   ├── youtube/                     # YouTube-specific (DOMWatcher, VideoObserver)
│   ├── ui/                          # Visual (OverlayUI, WordTooltip)
│   └── content-script.js            # Main orchestrator (406 lines)
├── popup/popup-simple.js            # Extension popup UI
└── settings/                        # Settings page

server/
├── yt-dlp-server.py                 # Flask subtitle extraction server
└── native-host.py                   # Native messaging bridge
```

## Common Development Tasks

### Adding a New Service
1. Create class in `extension/content/services/`
2. Add to manifest.json content_scripts (maintain load order)
3. Instantiate in YouTubeSubtitleOverlay constructor
4. Wire up EventBus listeners if needed

### Adding a New Event
```javascript
// Emit anywhere
eventBus.emit('myEvent', data);

// Listen anywhere
eventBus.on('myEvent', (data) => {
  // Handle event
});
```

### Adding a New State Property
```javascript
// In StateManager.js
this.state = {
  // ... existing properties
  myNewProperty: defaultValue
};

// Add getter/setter
getMyNewProperty() { return this.state.myNewProperty; }
setMyNewProperty(value) {
  this.state.myNewProperty = value;
  this.emit('myNewPropertyChanged', value);
}
```

### Debugging Caption Sync Issues
1. Check Console for 🔍 debug logs
2. Verify `parsedCaptions` array in StateManager
3. Check `video.currentTime` vs caption start/end times
4. Look for EventBus 'videoPlay' events firing correctly

### Testing Subtitle Fetching
```bash
# Test local server directly
curl -X POST http://localhost:5000/extract-subs-json3 \
  -H "Content-Type: application/json" \
  -d '{"video_id": "dQw4w9WgXcQ", "language": "en"}'

# Check cache stats
curl http://localhost:5000/health
```

## Critical Implementation Details

### Script Load Order is Sacred
Never reorder scripts in manifest.json without understanding dependencies. The initialization chain assumes Logger → EventBus → StateManager → Services → UI → Main.

### State Updates Must Go Through StateManager
```javascript
// ❌ NEVER DO THIS
stateManager.state.currentVideoId = "abc123";

// ✅ ALWAYS DO THIS
stateManager.setCurrentVideoId("abc123");
```

### Video Element Caching
VideoObserver caches the video element reference but re-queries every 2 seconds to handle YouTube's dynamic DOM updates.

### Subtitle Cache Expiry
- Memory: Last 3 videos only
- IndexedDB: 7 days
- Server cache: 30 days
- Python server: 1 hour

### Extension Popup vs Settings
- Popup (`popup-simple.html`): Quick stats, enable/disable
- Settings page: API keys, source selection, advanced config

## Known Limitations

1. **YouTube DOM Changes**: YouTube frequently updates their player DOM. DOMWatcher may need updates if YouTube changes their player structure.

2. **Rate Limiting**: YouTube/Google can block IPs making too many subtitle requests. The extension implements multiple rate-limiting layers but aggressive usage may still trigger blocks.

3. **Manual Subtitles**: Manual (human-created) subtitles don't have word-level timing, so they display as full captions instead of word-by-word.

4. **Service Worker Suspension**: Manifest V3 service workers can suspend after 30 seconds. The background script pings every 25 seconds to stay alive.

## Important File Paths

Core files to understand first:
- `extension/content/content-script.js:1` - Main entry point
- `extension/content/services/SubtitleManager.js:1` - Caching system
- `extension/content/core/StateManager.js:1` - Application state
- `extension/content/core/EventBus.js:1` - Event system
- `extension/content/ui/OverlayUI.js:1` - Caption rendering

Configuration:
- `extension/manifest.json:1` - Extension manifest
- `server/yt-dlp-server.py:1` - Local subtitle server

## API Integration

### Vocaminary Cloud API
Authentication via Bearer token from `chrome.storage.sync.vocabToken`

Endpoints:
- `POST /api/subtitles/fetch-or-cache` - Check server cache
- `POST /api/subtitles/store-cache` - Store for sharing
- `POST /api/subtitles/log-fetch` - Analytics
- `POST /api/railway-health/log` - Vocaminary API health monitoring (legacy endpoint name)

### Local Server
No authentication required (localhost only)

Primary endpoint:
- `POST /extract-subs-json3` - JSON format with word timing

## Dependencies

Chrome Extension:
- No external JS libraries
- Uses Chrome APIs: storage, scripting, activeTab, nativeMessaging

Python Server:
- yt-dlp (YouTube subtitle extraction)
- Flask (web server)
- flask-cors (CORS handling)

## Debugging Tips

### Extension Console Logs
Open DevTools on any YouTube page, filter by emoji:
- 🔍 = Debug (verbose)
- 📘 = Info (normal flow)
- ⚠️ = Warning (non-critical issues)
- ❌ = Error (failures)

### Check Extension Storage
```javascript
// In DevTools console on YouTube page
chrome.storage.local.get(null, console.log);  // All local data
chrome.storage.sync.get(null, console.log);   // All synced settings
```

### Check IndexedDB
Open DevTools → Application → IndexedDB → "subtitles" database

### Monitor EventBus
```javascript
// In content-script.js, add:
eventBus.on('*', (eventName, data) => {
  logger.debug(`Event: ${eventName}`, data);
});
```
