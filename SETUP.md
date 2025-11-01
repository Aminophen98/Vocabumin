# Vocaminary Setup Guide

Complete installation instructions for the Vocaminary Chrome extension.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Extension Configuration](#extension-configuration)
- [Subtitle Sources](#subtitle-sources)
- [Troubleshooting](#troubleshooting)
- [Uninstallation](#uninstallation)

---

## Prerequisites

### Required
- **Chrome, Edge, or Chromium-based browser** (version 88+)
- **Internet connection** for fetching subtitles

---

## Installation

### Method 1: Manual Installation (Recommended)

Best for: Testing, development, or if you want full control

#### Step 1: Download the Extension

**Option A: Clone with Git**
```bash
git clone https://github.com/yourusername/vocaminary.git
cd vocaminary
```

**Option B: Download ZIP**
1. Go to https://github.com/yourusername/vocaminary
2. Click **Code** → **Download ZIP**
3. Extract the ZIP file to a permanent location (e.g., `C:\Extensions\vocaminary` or `~/Extensions/vocaminary`)

⚠️ **Important**: Don't delete this folder after installation! The extension loads from it.

#### Step 2: Load Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle switch in top-right corner)
3. Click **"Load unpacked"** button
4. Select the `vocaminary` folder
5. The extension icon should appear in your toolbar

#### Step 3: Verify Installation

1. Go to any YouTube video (e.g., https://www.youtube.com/watch?v=dQw4w9WgXcQ)
2. Look for the subtitle overlay button on the YouTube player
3. If you see it, congratulations! The extension is working

---

### Method 2: Chrome Web Store

**Status**: Coming soon

---

## Extension Configuration

### Accessing Settings

1. Click the extension icon in Chrome toolbar
2. Click **"Options"** or right-click → **Options**

### Available Settings

#### Subtitle Source
- **Cloud API (Default)**: Uses shared subtitle cache for instant loading
- **Local Server**: Uses your own subtitle extraction server
  - Requires separate setup: [vocaminary-subtitle-server](https://github.com/yourusername/vocaminary-subtitle-server)

#### API Mode
- **Public API**: Free, shared rate limits
- **Own API**: Use your own OpenAI key for word definitions (coming soon)

#### Advanced Settings
- **Clear cache**: Remove all stored subtitle data
- **View logs**: See error logs for debugging

---

## Subtitle Sources

### Cloud API (Default)

The extension comes pre-configured to use a shared cloud API that provides:
- Fast subtitle fetching
- Shared cache across all users
- No setup required

**Pros:**
- ✅ No setup required
- ✅ Fast and reliable
- ✅ Shared cache means popular videos load instantly

**Cons:**
- ❌ Relies on external service
- ❌ Shared rate limits

### Local Server (Optional)

For maximum privacy and control, you can run your own subtitle extraction server.

**Setup instructions**: Visit the [vocaminary-subtitle-server repository](https://github.com/yourusername/vocaminary-subtitle-server)

**Pros:**
- ✅ Full privacy - no data leaves your computer
- ✅ No dependency on external APIs
- ✅ Better control over rate limiting
- ✅ Works offline (for cached videos)

**Cons:**
- ❌ Requires Python installation
- ❌ Server must be running while using YouTube
- ❌ Uses your IP address for YouTube requests

Once you have the local server running:
1. Click the extension icon
2. Go to **Options**
3. Select **"Local Server (yt-dlp)"** under Subtitle Source
4. Save settings

---

## Troubleshooting

### Extension not appearing on YouTube

**Symptoms**: No overlay button, extension doesn't load

**Solutions**:
1. **Refresh the page** (F5)
2. **Check if extension is enabled**:
   - Go to `chrome://extensions/`
   - Find "Vocaminary"
   - Make sure the toggle is ON
3. **Check for errors**:
   - Open DevTools (F12)
   - Look for errors in Console tab
   - Filter by emoji: 🔍 📘 ⚠️ ❌
4. **Reload the extension**:
   - Go to `chrome://extensions/`
   - Click the reload icon ↻ for the extension

---

### "No subtitles available" error

**Symptoms**: Button appears but subtitles won't load

**Possible causes**:
- ❌ Video doesn't have captions
- ❌ Captions are disabled on this video
- ❌ Rate limit exceeded
- ❌ Network error

**Solutions**:
1. **Check if video has subtitles**:
   - Click the CC button on YouTube player
   - Try auto-generated captions

2. **Try a different video**:
   - Use a popular video (they always have captions)
   - Example: https://www.youtube.com/watch?v=dQw4w9WgXcQ

3. **Check rate limits**:
   - Wait 2-5 minutes
   - Try again

4. **Clear cache and retry**:
   - Extension options → Clear cache
   - Refresh YouTube page

---

### Subtitles are out of sync

**Symptoms**: Words appear too early or too late

**Solutions**:
1. **Check video playback rate**:
   - Extension works best at 1x speed
   - Slower/faster speeds may cause sync issues

2. **Try refetching subtitles**:
   - Disable overlay
   - Clear cache (in options)
   - Re-enable overlay

3. **Report the issue**:
   - Note the video ID
   - Check DevTools console for errors
   - [Open an issue](https://github.com/yourusername/vocaminary/issues)

---

### Subtitles not appearing word-by-word

**Symptoms**: Whole sentences appear at once instead of individual words

**Cause**: Video has **manual subtitles** (not auto-generated)

**Explanation**: Manual subtitles don't include word-level timing data. The extension can only display them as complete captions.

**Solution**: Use videos with auto-generated captions for word-by-word display

---

### Extension using too much memory

**Symptoms**: Chrome tab uses lots of RAM

**Solutions**:
1. **Clear extension cache**:
   - Options → Clear cache

2. **Limit cache size**:
   - Extension keeps last 3 videos in memory
   - IndexedDB cache: 7 days (automatic cleanup)

3. **Disable extension when not needed**:
   - Click extension icon → Toggle off

---

## Uninstallation

### Remove Extension

1. Go to `chrome://extensions/`
2. Find "Vocaminary"
3. Click **Remove**
4. Confirm deletion

### Clear Extension Data

Extension automatically removes its data when uninstalled. To manually clear:

1. **Chrome Storage**: Deleted automatically
2. **IndexedDB**: Open DevTools → Application → IndexedDB → Delete "subtitles"

---

## Advanced Configuration

### Custom API Endpoint

If you're hosting your own API:

1. Edit `content/services/APIService.js`
2. Change `BASE_URL` to your server
3. Reload extension

### Debugging

Enable verbose logging:

1. Open any YouTube page
2. Open DevTools (F12)
3. Run in console:
   ```javascript
   localStorage.setItem('YTS_DEBUG', 'true');
   ```
4. Reload page
5. See detailed logs in console

---

## Getting Help

Still having issues?

1. **Check existing issues**: https://github.com/yourusername/vocaminary/issues
2. **Open a new issue**: Include:
   - Your OS and Chrome version
   - Error messages from DevTools console
   - Video ID where it's failing
   - Steps to reproduce

3. **Ask the community**: GitHub Discussions

---

## Next Steps

- ✅ Extension installed → [Read the documentation](docs/CLAUDE.md)
- ✅ Want to contribute? → [See Contributing Guide](CONTRIBUTING.md)
- ✅ Found a bug? → [Report it](https://github.com/yourusername/vocaminary/issues/new?template=bug_report.md)
- ✅ Need local server? → [Set up vocaminary-subtitle-server](https://github.com/yourusername/vocaminary-subtitle-server)
