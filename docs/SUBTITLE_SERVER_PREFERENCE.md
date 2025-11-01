# Subtitle Server Preference Feature

## ✨ What Was Added

A new setting that lets users choose between Cloud (Vocaminary) or Local (yt-dlp) subtitle servers.

## 📍 Changes Made

### 1. Settings Page (settings/settings.html)

- Added new "Subtitle Server" section with two options:
  - 🚂 **Cloud Server (Recommended)** - Vocaminary API, no setup required
  - 💻 **Local Server** - Uses local yt-dlp server on port 5000

### 2. Settings Manager (settings/settings.js)

- Added `subtitleServerRadios` to track radio buttons
- Added event listeners for auto-saving preference
- Loads saved preference (defaults to 'cloud')
- Shows selected option with styling

### 3. Subtitle Manager (content/services/SubtitleManager.js)

- Checks user's `subtitleServer` preference before fetching
- **Cloud mode (default):**
  - Tries Vocaminary API first
  - Falls back to local yt-dlp if Vocaminary fails
- **Local mode:**
  - Skips Vocaminary entirely
  - Goes straight to local yt-dlp server
- Added visual indicator: 💻 "Local Server" (orange background)

## 🎯 User Experience

### Default Behavior

- **New users:** Cloud server (Vocaminary) by default
- **Existing users:** Cloud server (Vocaminary) by default
- **Easy switching:** Just click the radio button in settings

### Visual Indicators

- 🚂 Vocaminary API (green) - Cloud server
- 💻 Local Server (orange) - Local yt-dlp
- ⚡ Cached - From browser cache
- ☁️ Server cache - From Vocaminary cache

## 🔐 Future: Premium Feature

To restrict cloud to premium users later:

```javascript
// In SubtitleManager.js, add this check:
async fetchFromYtDlp(videoId) {
    // Check user's subtitle server preference
    const { subtitleServer, isPremium } = await chrome.storage.sync.get(['subtitleServer', 'isPremium']);

    // Force local for non-premium users
    const preferredServer = isPremium ? (subtitleServer || 'cloud') : 'local';

    // ... rest of the code
}
```

Then in settings page, add:

```javascript
// Disable cloud option for non-premium
if (!isPremium) {
  document.querySelector('[data-value="cloud"]').classList.add("disabled");
  document.querySelector("#subtitleServerCloud").disabled = true;
}
```

## 📝 Notes

- Setting is stored in `chrome.storage.sync` as `subtitleServer`
- Default value: `'cloud'`
- Possible values: `'cloud'` or `'local'`
- Auto-saves on change (no save button needed)
- Works with existing caching system
