# Privacy Policy

**Last Updated:** October 25, 2025

YouTube Subtitle Overlay takes your privacy seriously. This document explains what data we collect, how we use it, and your rights.

## TL;DR

- **No personal data collection** - We don't collect names, emails, or browsing history
- **All processing happens locally** - Your viewing activity stays on your computer
- **Optional cloud features** - You choose if you want to use cloud-based subtitle caching
- **Open source** - All code is reviewable on GitHub

## Data Storage

### Local Storage (Chrome Storage API)
The extension stores the following data **locally on your device**:

- **Extension settings**: API mode (own/public), subtitle source preference, OpenAI API key (if provided)
- **Authentication tokens**: JWT tokens for YourVocab API (if you authenticate)
- **Cache data**: Recently viewed video IDs and their subtitle timings
- **Error logs**: Technical error messages for debugging (stored temporarily)

**Purpose**: To provide fast subtitle loading and remember your preferences.

**Retention**: Cached subtitles expire after 7 days. Settings persist until you uninstall the extension.

### IndexedDB
The extension uses IndexedDB to cache subtitle data locally.

- **What's stored**: Video IDs, subtitle text, word-level timings, language codes
- **Purpose**: Avoid re-fetching subtitles for videos you've already watched
- **Retention**: 7 days, then automatically deleted
- **Size**: Typically a few KB per video

## Network Requests

### YouTube.com
The extension runs on YouTube pages to detect videos and synchronize subtitles with playback.

- **What we access**: Video player elements, current playback time, video ID from the URL
- **What we send**: Nothing. The extension only reads from YouTube's page.

### YourVocab API (yourvocab.vercel.app)
Optional cloud service for faster subtitle loading and cross-device caching.

**Endpoints used:**
- `POST /api/subtitles/fetch-or-cache` - Check if subtitles are already cached server-side
- `POST /api/subtitles/store-cache` - Share your cached subtitles with other users (anonymous)
- `POST /api/subtitles/log-fetch` - Log fetch events for rate limiting and analytics
- `POST /api/railway-health/log` - Monitor API health

**Data sent:**
- Video ID (e.g., "dQw4w9WgXcQ")
- Language code (e.g., "en")
- Authentication token (if you're logged in to YourVocab)

**Data received:**
- Subtitle content with word-level timing
- Cache metadata (source, type, timestamp)

**IP logging**: The server may log IP addresses temporarily for rate limiting purposes.

### Local yt-dlp Server (localhost:5000)
If you run the optional local Python server, all subtitle extraction happens on your own computer.

- **No external network requests** - The server fetches from YouTube directly
- **No data leaves your device**
- **Your IP = Your YouTube rate limits**

### OpenAI API (Optional)
If you provide your own OpenAI API key, the extension may send word definitions to OpenAI for AI-powered translations.

- **What's sent**: Individual words clicked by you
- **What's received**: Definitions, translations, example sentences
- **OpenAI's privacy policy applies**: https://openai.com/policies/privacy-policy

**We do not store or log your API key** - it's only saved in Chrome's secure storage on your device.

## Third-Party Services

| Service | Purpose | Data Shared | Privacy Policy |
|---------|---------|-------------|----------------|
| YouTube | Video playback detection | None (read-only) | [YouTube Privacy](https://policies.google.com/privacy) |
| YourVocab API | Subtitle caching | Video IDs, auth tokens | See below |
| OpenAI (optional) | AI definitions | Words you click | [OpenAI Privacy](https://openai.com/policies/privacy-policy) |
| yt-dlp (local) | Subtitle extraction | None (runs locally) | [yt-dlp GitHub](https://github.com/yt-dlp/yt-dlp) |

### YourVocab API Privacy

The YourVocab API is hosted on Vercel and operated by the extension developer.

- **No personal data required** - You can use it anonymously
- **Optional authentication** - JWT tokens are only used if you create an account at yourvocab.vercel.app
- **Shared subtitle cache** - Subtitles you fetch are stored server-side and shared with other users (to reduce load on YouTube)
- **Rate limiting** - IP addresses are temporarily logged to prevent abuse
- **No analytics tracking** - We don't use Google Analytics, Meta Pixel, or similar trackers

## Permissions Explained

The extension requests the following Chrome permissions:

| Permission | Why We Need It |
|------------|----------------|
| `activeTab` | Detect when you're on a YouTube video page |
| `storage` | Save your settings and cached subtitles locally |
| `scripting` | Inject the subtitle overlay into YouTube pages |
| `nativeMessaging` | Communicate with the optional local yt-dlp server |
| `https://www.youtube.com/*` | Run the extension only on YouTube |
| `http://localhost:5000/*` | Connect to your local subtitle server |

## Your Rights

### Access Your Data
All data is stored locally in Chrome. To view it:
1. Open Chrome DevTools on any YouTube page (F12)
2. Go to **Application** → **Storage** → **Chrome Storage**
3. Go to **Application** → **IndexedDB** → **subtitles**

### Delete Your Data
- **Local data**: Uninstall the extension or clear Chrome's extension storage
- **Server cache**: Subtitles are anonymous and auto-expire after 30 days. Contact us for early deletion.
- **YourVocab account**: Delete your account at yourvocab.vercel.app/settings (if you created one)

### Opt Out of Cloud Features
You can disable server-side caching in the extension settings:
1. Right-click the extension icon → **Options**
2. Change **Subtitle Source** to "Local Server Only"
3. This prevents any network requests to YourVocab API

## Data Security

- **No passwords stored** - We use JWT tokens, which automatically expire
- **HTTPS only** - All API requests use encrypted connections
- **No sensitive data** - Video IDs and subtitles are public information
- **Open source** - Security researchers can audit our code

## Children's Privacy

This extension does not knowingly collect data from children under 13. Parents should supervise their children's use of browser extensions.

## Changes to This Policy

We may update this policy as the extension evolves. Changes will be posted here with an updated "Last Updated" date.

## Contact

If you have questions about this privacy policy or want to request data deletion:

- **GitHub Issues**: https://github.com/Aminophen98/YTS-1/issues
- **Email**: [Your contact email - update this]

## Open Source Transparency

The full source code is available at https://github.com/Aminophen98/YTS-1

You can review exactly what data is collected and how it's used by reading the code yourself.
