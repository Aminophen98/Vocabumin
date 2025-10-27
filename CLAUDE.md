# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Vocabumin** - A Chrome Manifest V3 extension that overlays YouTube subtitles with word-level precision and AI-powered definitions. Designed for language learners to study vocabulary while watching videos.

**Tech Stack:**
- Vanilla JavaScript (no build step, no frameworks)
- Chrome Extension Manifest V3
- Chrome Storage API + IndexedDB for caching
- OpenAI API for word analysis (user-provided or public shared key)
- Cloud subtitle API: api.vocabumin.aminophen.ir
- Optional local Python yt-dlp server for privacy

## Development Commands

### Extension Development
```bash
# Load extension in Chrome
# 1. Navigate to chrome://extensions/
# 2. Enable "Developer mode" (toggle in top-right)
# 3. Click "Load unpacked"
# 4. Select the root directory (containing manifest.json)

# Reload after code changes
# Go to chrome://extensions/ and click the reload icon ↻

# View logs
# Open any YouTube page → F12 DevTools → Console
# Filter by emoji: 🔍 Debug | 📘 Info | ⚠️ Warning | ❌ Error
```

### Local Subtitle Server (Optional)
```bash
# Install dependencies
pip install yt-dlp flask flask-cors

# Start server
cd server
python yt-dlp-server.py

# Server runs on http://localhost:5000
# Test endpoint:
curl -X POST http://localhost:5000/extract-subs-json3 \
  -H "Content-Type: application/json" \
  -d '{"video_id": "dQw4w9WgXcQ", "language": "en"}'
```

### Testing Workflow
```bash
# Manual testing (no automated test suite)
# 1. Load extension in Chrome
# 2. Navigate to: https://www.youtube.com/watch?v=dQw4w9WgXcQ
# 3. Click "Enable Overlay" button on player controls
# 4. Verify subtitles sync word-by-word with speech
# 5. Click any word → verify tooltip appears with definition
# 6. Switch to another video → verify overlay auto-disables
# 7. Test cache: revisit same video → subtitles load <50ms
```

## Architecture Overview

### Critical Load Order

Content scripts MUST load in this exact order (defined in `manifest.json:32-45`). Breaking this order causes cascading failures because each class expects global variables from previous scripts:

```
1. Logger.js              # Base logging (window.Logger)
2. EventBus.js            # Pub/sub system (window.EventBus)
3. StateManager.js        # Centralized state (window.StateManager)
   ↓
4. server-connection.js   # Server health checks
5. StorageService.js      # Chrome storage + cache management
6. SubtitleManager.js     # Multi-layer subtitle caching
   ↓
7. DOMWatcher.js          # YouTube DOM monitoring
8. VideoObserver.js       # Video element tracking
   ↓
9. OverlayUI.js           # Caption rendering (PlayerIntegration class)
10. CaptionService.js     # Subtitle fetching (Caption class)
11. WordTooltip.js        # Definition tooltips (Tooltip class)
12. APIService.js         # OpenAI integration (AIService class)
   ↓
13. content-script.js     # Main orchestrator (YouTubeSubtitleOverlay class)
```

**Why order matters:** Each script defines a global class. Later scripts instantiate classes from earlier scripts. For example, `SubtitleManager` constructor expects `window.Logger` to exist.

### Core Architecture Patterns

#### 1. StateManager - Single Source of Truth
**File:** `content/core/StateManager.js`

Centralized state management. Never mutate properties directly - always use getters/setters.

**Key state properties:**
```javascript
{
  // Video state
  currentVideoId: string,
  videoElement: HTMLVideoElement,

  // Overlay state
  isActive: boolean,

  // Caption state
  captionData: {language, source, type},
  parsedCaptions: [{start, end, text, words}, ...],
  currentCaptionIndex: number,
  syncInterval: number,

  // API state
  apiMode: 'own' | 'public',
  openaiApiKey: string,
  dailyApiCalls: number,
  dailyLimit: 10,
  publicApiUsage: number,
  publicApiLimit: 50,

  // Word storage
  savedWords: {},
  databaseWords: Map,
  apiCache: {}
}
```

**Usage pattern:**
```javascript
// ✅ Correct
stateManager.setCurrentVideoId('abc123');
const videoId = stateManager.getCurrentVideoId();

// ❌ NEVER DO THIS
stateManager.currentVideoId = 'abc123';  // Direct mutation breaks reactivity
```

#### 2. EventBus - Decoupled Communication
**File:** `content/core/EventBus.js`

Custom pub/sub system that also handles Chrome extension messages.

**Key events:**
- `urlChange` - YouTube URL changed (new video)
- `leftVideoPage` - User navigated away from /watch
- `leftYouTube` - User left YouTube entirely
- `videoPlay` - Video resumed playback
- `playButtonClicked` - Player play button clicked
- `vocabAuth` - YourVocab authentication received
- `chromeMessage` - Chrome extension message received

**Usage:**
```javascript
// Emit event
eventBus.emit('captionsLoaded', {videoId, captions});

// Listen to event
eventBus.on('videoPlay', () => {
  // Handle video play
});

// Register Chrome message handler
eventBus.registerMessageHandler('GET_OVERLAY_STATUS', (request, sender) => {
  return { active: stateManager.isOverlayActive() };
});
```

#### 3. Multi-Layer Caching System
**File:** `content/services/SubtitleManager.js` (most complex component, 878 lines)

Three-layer cache minimizes API calls and ensures fast subtitle loading:

```
User clicks "Enable Overlay"
  ↓
Layer 1: Memory Cache (Map)
  - Speed: <1ms
  - Retention: Last 3 videos only
  - Cleared on page unload
  ↓ (cache miss)
Layer 2: IndexedDB (local disk)
  - Speed: 20-50ms
  - Retention: 7 days
  - Survives browser restart
  ↓ (cache miss)
Layer 3: Server Cache (Cloud API)
  - Speed: 100-200ms
  - Shared across all users
  - Popular videos cached here
  ↓ (cache miss)
Layer 4: Rate Limit Check
  - Client-side throttling
  - Prevents YouTube API abuse
  ↓ (allowed)
Layer 5: Fresh Fetch
  - Vocabumin API: 2-3s
  - Local yt-dlp: 3-5s
  ↓
Store in all layers for next time
```

**Two subtitle sources:**
1. **Vocabumin API** (default): `https://api.vocabumin.aminophen.ir/transcript/{videoId}`
   - Cloud-based, shared cache
   - Faster for popular videos
   - No local setup required

2. **Local yt-dlp** (optional): `http://localhost:5000/extract-subs-json3`
   - Privacy-focused (no data leaves machine)
   - Requires Python server setup
   - Better for obscure videos

#### 4. Dual API Mode for Word Definitions
**File:** `content/services/APIService.js` (AIService class)

Two modes for OpenAI API access:

**"own" mode:**
- User provides their own OpenAI API key in settings
- 10 free lookups/day, then requires payment to OpenAI
- Key stored in `chrome.storage.sync.openaiApiKey`
- More privacy, direct OpenAI connection

**"public" mode:**
- Uses shared public API key managed by Vocabumin
- 50 free lookups/day across all users
- No API key setup required
- Good for trying the extension

Usage tracked in StateManager, checked before each API call.

### Component Initialization Flow

**File:** `content/content-script.js` (main entry point)

```javascript
class YouTubeSubtitleOverlay {
  constructor() {
    // 1. Core systems (order matters!)
    this.logger = new Logger('YT-Overlay');
    this.eventBus = new EventBus();
    this.state = new StateManager();

    // 2. Services (depend on core)
    this.serverManager = new ServerConnectionManager(this.logger);
    this.storage = new StorageManagement(this.state, this.logger);
    this.AI = new AIService(this.storage, this.logger);

    // 3. Caption service (depends on state + serverManager)
    this.caption = new Caption(this.state, this.serverManager, this.logger);

    // 4. YouTube DOM observers
    this.domWatcher = new DOMWatcher(this.eventBus, this.state);
    this.videoObserver = new VideoObserver(this);

    // 5. UI components (depend on everything else)
    this.player = new PlayerIntegration(this, this.logger);
    this.tooltip = new Tooltip(this);

    // 6. Wire up events and initialize
    this.setupEventHandlers();
    this.init();
  }
}

// Global instance
const overlay = new YouTubeSubtitleOverlay();
window.overlay = overlay;  // For cleanup access
```

### Key Data Structures

**Subtitle format** (returned by SubtitleManager):
```javascript
{
  captions: [
    {
      start: 0.5,              // seconds (float)
      end: 2.3,
      text: "Hello world",
      words: [                 // Only present for auto-generated subs
        {text: "Hello", punctuation: ""},
        {text: "world", punctuation: ""}
      ]
    }
  ],
  captionData: {
    language: "en",
    source: "vocabumin" | "local-ytdlp" | "server_cache",
    type: "auto-generated" | "manual",
    cached: true | false,
    cacheAge: 1234567  // milliseconds
  }
}
```

**Word analysis response** (from AIService):
```javascript
{
  definition: "A greeting or expression of goodwill",
  pronunciation: "/həˈloʊ/",
  partOfSpeech: "interjection",
  synonyms: ["hi", "hey", "greetings"],
  translations: {
    ja: "こんにちは",  // Based on targetLanguage setting
    // ... other languages
  },
  frequency: "very-common",
  refinedSentence: "Hello world",
  sentenceTranslation: "こんにちは世界"
}
```

## File Organization

```
vocabumin/
├── manifest.json                      # Extension config (Manifest V3)
├── background/
│   └── service-worker.js              # Background script (lifecycle management)
├── content/
│   ├── core/                          # Foundation layer
│   │   ├── Logger.js                  # Emoji-based structured logging
│   │   ├── EventBus.js                # Pub/sub + Chrome message handling
│   │   └── StateManager.js            # Centralized state
│   ├── services/                      # Business logic layer
│   │   ├── server-connection.js       # Server health monitoring
│   │   ├── StorageService.js          # Chrome storage + cache (StorageManagement)
│   │   ├── SubtitleManager.js         # Multi-layer subtitle caching
│   │   ├── CaptionService.js          # Subtitle fetching (Caption class)
│   │   ├── APIService.js              # OpenAI integration (AIService class)
│   │   ├── AuthHandler.js             # YourVocab authentication
│   │   └── jwt-token-manager.js       # JWT token handling
│   ├── youtube/                       # YouTube-specific code
│   │   ├── DOMWatcher.js              # Monitors YouTube DOM changes
│   │   └── VideoObserver.js           # Tracks video element
│   ├── ui/                            # Visual components
│   │   ├── OverlayUI.js               # Caption rendering (PlayerIntegration class)
│   │   └── WordTooltip.js             # Definition tooltips (Tooltip class)
│   └── content-script.js              # Main orchestrator (406 lines)
├── popup/
│   ├── popup-simple.html              # Extension popup UI
│   └── popup-simple.js
├── settings/
│   ├── settings.html                  # Settings page
│   └── settings.js
├── js/
│   └── auth-bridge.js                 # Auth page integration
└── icons/                             # Extension icons (16, 48, 128)
```

## Common Development Tasks

### Adding a New Service

1. Create class file in `content/services/NewService.js`
2. Add to `manifest.json` content_scripts array (maintain load order!)
3. Instantiate in `YouTubeSubtitleOverlay` constructor
4. Wire up EventBus listeners if needed

Example:
```javascript
// In content-script.js constructor
this.myService = new MyService(this.state, this.logger);

// In setupEventHandlers()
this.eventBus.on('someEvent', (data) => {
  this.myService.handleEvent(data);
});
```

### Adding a New State Property

1. Add to `StateManager` constructor:
```javascript
constructor() {
  // ... existing properties
  this.myNewProperty = defaultValue;
}
```

2. Add getter/setter methods:
```javascript
getMyNewProperty() {
  return this.myNewProperty;
}

setMyNewProperty(value) {
  this.myNewProperty = value;
}
```

3. Use throughout codebase:
```javascript
overlay.state.setMyNewProperty('value');
const value = overlay.state.getMyNewProperty();
```

### Adding a New Event

Emit anywhere:
```javascript
eventBus.emit('myCustomEvent', {data: 'value'});
```

Listen anywhere:
```javascript
eventBus.on('myCustomEvent', (data) => {
  logger.info('Received:', data);
});
```

### Debugging Caption Sync Issues

1. Open DevTools Console on YouTube page
2. Filter logs by 🔍 emoji (debug level)
3. Check these values:
   ```javascript
   overlay.state.getParsedCaptions()  // Should be array of captions
   overlay.state.getCurrentCaptionIndex()  // Should increment during playback
   video.currentTime  // Compare with caption.start/end times
   ```
4. Look for EventBus events:
   - `videoPlay` should fire when video plays
   - `urlChange` should fire on video navigation

### Testing Subtitle Fetching

Test Vocabumin API directly:
```bash
curl https://api.vocabumin.aminophen.ir/transcript/dQw4w9WgXcQ
```

Test local yt-dlp server:
```bash
curl -X POST http://localhost:5000/extract-subs-json3 \
  -H "Content-Type: application/json" \
  -d '{"video_id": "dQw4w9WgXcQ", "language": "en"}'

# Check server cache stats
curl http://localhost:5000/health
```

### Clearing Extension Cache

```javascript
// In DevTools console on YouTube page

// Clear memory cache
overlay.caption.subtitleManager.memoryCache.clear();

// Clear IndexedDB
indexedDB.deleteDatabase('SubtitleCache');

// Clear Chrome storage
chrome.storage.local.clear();
chrome.storage.sync.clear();
```

## Critical Implementation Details

### Script Load Order is Sacred

**NEVER reorder scripts in manifest.json** without understanding dependencies. The initialization chain assumes:
```
Logger → EventBus → StateManager → Services → Observers → UI → Main
```

Breaking this causes errors like:
- `ReferenceError: Logger is not defined`
- `ReferenceError: StateManager is not defined`

### State Updates Must Go Through StateManager

```javascript
// ❌ NEVER DO THIS (breaks reactivity, no validation)
stateManager.currentVideoId = "abc123";
stateManager.isActive = true;

// ✅ ALWAYS DO THIS
stateManager.setCurrentVideoId("abc123");
stateManager.setActive(true);
```

### Video Element Caching

`VideoObserver` caches the video element reference but re-queries every 2 seconds to handle YouTube's dynamic DOM updates (YouTube uses SPAs and may recreate the video element).

### Subtitle Cache Expiry Policy

- **Memory cache:** Last 3 videos only (cleared on page unload)
- **IndexedDB:** 7 days (auto-cleanup via timestamp check)
- **Server cache:** 30 days (managed by Vocabumin API)
- **Python server:** 1 hour (configurable in yt-dlp-server.py)

### Extension Popup vs Settings Page

- **Popup** (`popup/popup-simple.html`): Quick stats, enable/disable toggle
- **Settings** (`settings/settings.html`): API keys, subtitle source, language preferences

Popup opens when clicking extension icon. Settings accessible via right-click → Options.

### API Rate Limiting

Multiple layers prevent abuse:

1. **Client-side (SubtitleManager):**
   - Track requests per video ID
   - Enforce 2-second minimum intervals
   - Respect 429 responses with exponential backoff

2. **Python server (if used):**
   - Rate limiting per video ID
   - 2-second intervals enforced

3. **Cloud API:**
   - IP-based rate limiting
   - Warp proxy fallback for blocked IPs

## Known Limitations & Gotchas

### 1. YouTube DOM Changes

YouTube frequently updates their player structure. If the overlay button disappears:
- Check `DOMWatcher.js` selectors
- Update button container selector (currently: `'.ytp-left-controls'`)
- Test on multiple YouTube layouts (theater mode, fullscreen, etc.)

### 2. Manual Subtitles Don't Have Word Timing

Manual (human-created) subtitles lack word-level timestamps. Extension displays them as full captions instead of word-by-word. Detection logic in `CaptionService.js:110`.

### 3. Service Worker Suspension

Manifest V3 service workers suspend after 30 seconds of inactivity. Background script pings every 25 seconds to stay alive (see `background/service-worker.js`).

### 4. Extension Context Invalidation

If extension is reloaded while YouTube pages are open, content scripts lose connection to background script. Error: "Extension context invalidated". User must refresh YouTube pages.

### 5. IndexedDB Quota Limits

Chrome limits IndexedDB to ~10% of available disk space. If quota exceeded, oldest cache entries are auto-deleted by SubtitleManager.

## Debugging Tips

### View Extension Console Logs

1. Open YouTube page
2. F12 → DevTools → Console
3. Filter by emoji:
   - 🔍 = Debug (verbose, disabled in production)
   - 📘 = Info (normal flow)
   - ⚠️ = Warning (non-critical issues)
   - ❌ = Error (failures)

### Inspect Extension Storage

```javascript
// In DevTools console
chrome.storage.local.get(null, data => console.table(data));
chrome.storage.sync.get(null, data => console.table(data));
```

### Check IndexedDB Contents

DevTools → Application tab → IndexedDB → "SubtitleCache" → "subtitles" store

### Monitor EventBus Activity

Add to `content-script.js` temporarily:
```javascript
// In setupEventHandlers()
const events = ['urlChange', 'videoPlay', 'leftVideoPage'];
events.forEach(event => {
  this.eventBus.on(event, (...args) => {
    this.logger.debug(`🎪 Event: ${event}`, args);
  });
});
```

### Enable Debug Logging

```javascript
// In DevTools console
localStorage.setItem('YTS_DEBUG', 'true');
// Reload page
```

### Check API Usage Stats

```javascript
// In DevTools console on YouTube page
overlay.state.checkDailyReset();
console.log({
  apiMode: overlay.state.apiMode,
  ownApiCalls: overlay.state.dailyApiCalls,
  ownApiLimit: overlay.state.dailyLimit,
  publicApiUsage: overlay.state.publicApiUsage,
  publicApiLimit: overlay.state.publicApiLimit
});
```

## Important File Paths

**Core files to understand first:**
- `content/content-script.js:1` - Main entry point, orchestrates everything
- `content/core/StateManager.js:1` - Application state (199 lines)
- `content/core/EventBus.js:1` - Event system (196 lines)
- `content/services/SubtitleManager.js:1` - Caching system (878 lines, most complex)
- `content/ui/OverlayUI.js:1` - Caption rendering (PlayerIntegration class)

**Configuration:**
- `manifest.json:1` - Extension manifest (load order at line 32)

**For debugging:**
- `content/core/Logger.js:1` - Structured logging
- `background/service-worker.js:1` - Background lifecycle

## API Integration

### Vocabumin Cloud API

Base URL: `https://api.vocabumin.aminophen.ir`

**Endpoints:**
- `GET /transcript/{videoId}` - Fetch subtitles (with caching)
- `GET /health` - API health check

Authentication: None required (public API)

### YourVocab Cloud API

Base URL: `https://yourvocab.vercel.app/api`

**Endpoints:**
- `POST /subtitles/fetch-or-cache` - Check server cache for subtitles
- `POST /subtitles/store-cache` - Store subtitles for sharing
- `POST /subtitles/log-fetch` - Analytics logging
- `POST /railway-health/log` - Vocabumin API health monitoring

Authentication: Bearer token from `chrome.storage.sync.vocabToken`

### Local yt-dlp Server

Base URL: `http://localhost:5000` (user-configurable)

**Endpoints:**
- `GET /health` - Health check + cache stats
- `POST /extract-subs-json3` - Extract subtitles with word timing (PREFERRED)
- `POST /extract-subs` - Extract VTT format (legacy)
- `POST /list-subs` - List available subtitle languages

Authentication: None (localhost only)

### OpenAI API

Used for word definitions. Two modes:

**Own API mode:**
```javascript
// User's own key stored in chrome.storage.sync.openaiApiKey
// API calls made directly from extension to OpenAI
// Endpoint: https://api.openai.com/v1/chat/completions
```

**Public API mode:**
```javascript
// Shared key managed by Vocabumin
// API calls proxied through Vocabumin backend
// 50 calls/day limit across all users
```

## Dependencies

### Extension (Zero External Dependencies)
- Pure vanilla JavaScript
- Chrome APIs: `storage`, `scripting`, `activeTab`, `nativeMessaging`
- No npm packages, no build step, no bundler

### Python Server (Optional)
```bash
pip install yt-dlp flask flask-cors
```

- **yt-dlp:** YouTube subtitle extraction
- **Flask:** Web server
- **flask-cors:** CORS handling for localhost

## Troubleshooting Common Issues

### Extension Button Not Appearing on YouTube

**Symptoms:** No "Enable Overlay" button on player controls

**Solutions:**
1. Refresh page (F5)
2. Check `chrome://extensions/` - ensure Vocabumin is enabled
3. Open DevTools Console - look for red errors
4. Check DOMWatcher: `overlay.domWatcher.setupPlayerButton()`
5. Verify YouTube layout hasn't changed (check `.ytp-left-controls` selector)

### "No Subtitles Available" Error

**Symptoms:** Button appears but subtitles won't load

**Causes:**
- Video doesn't have captions
- Captions disabled by creator
- Rate limit exceeded
- Network error

**Solutions:**
1. Click CC button on YouTube player - verify subtitles exist
2. Try popular video with guaranteed captions: `dQw4w9WgXcQ`
3. Check rate limits: `overlay.caption.subtitleManager.stats`
4. Test API directly with curl (see "Testing Subtitle Fetching" above)
5. Check DevTools Network tab for failed requests

### Subtitles Out of Sync

**Symptoms:** Words appear too early or too late

**Solutions:**
1. Check video playback rate (extension works best at 1x speed)
2. Clear cache and refetch:
   ```javascript
   overlay.caption.subtitleManager.memoryCache.clear();
   ```
3. Check caption timestamps:
   ```javascript
   console.table(overlay.state.getParsedCaptions().slice(0, 5));
   ```
4. Verify sync interval running: `overlay.state.getSyncInterval()`

### "Extension Context Invalidated" Error

**Symptoms:** Console shows "Extension context invalidated"

**Cause:** Extension was reloaded/updated while YouTube pages were open

**Solution:** Refresh all YouTube tabs (F5)

### Daily API Limit Reached

**Symptoms:** Tooltip shows "Daily limit reached" message

**Solutions:**
1. **If using own API mode:**
   - Wait until midnight UTC for reset
   - Or add OpenAI API credit

2. **If using public API mode:**
   - Switch to own API mode in settings
   - Or wait until midnight UTC

Check current usage:
```javascript
console.log({
  mode: overlay.state.apiMode,
  usage: overlay.state.apiMode === 'public'
    ? overlay.state.publicApiUsage
    : overlay.state.dailyApiCalls,
  limit: overlay.state.apiMode === 'public'
    ? overlay.state.publicApiLimit
    : overlay.state.dailyLimit
});
```

## Additional Resources

- **README.md** - User-facing documentation
- **SETUP.md** - Detailed installation guide
- **CONTRIBUTING.md** - Code style and PR guidelines
- **TESTING.md** - Manual testing checklist for first users
- **docs/** - Additional implementation notes

## Distribution & Updates

### Chrome Web Store Packaging

```bash
# Create ZIP for Chrome Web Store
zip -r vocabumin-v0.1.0.zip . \
  -x "*.git*" -x "*.history*" -x "docs/*" -x "*.md"
```

### Auto-Update Mechanism

Extension uses `update_url` in manifest.json:
```json
"update_url": "https://vocabumin.aminophen.ir/extension/updates.xml"
```

Chrome checks this URL periodically for new versions. When detected, auto-updates extension.
