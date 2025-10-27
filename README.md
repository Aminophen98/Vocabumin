# Vocabumin

> Transform your YouTube learning experience with word-perfect subtitles that sync naturally with speech

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/yourusername/vocabumin/releases)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-green.svg)](https://www.google.com/chrome/)

![Vocabumin Demo](https://via.placeholder.com/800x400?text=Demo+Screenshot+-+Replace+with+actual+screenshot)

## ✨ Features

### 🎯 Word-Level Precision

- Subtitles appear exactly when each word is spoken
- Natural speech timing with intelligent pause detection
- No more awkward caption blocks that appear too early or late

### ⚡ Lightning-Fast Performance

- **3-layer caching system**: Memory → IndexedDB → Server Cache
- Previously watched videos load subtitles in <50ms
- Smart rate limiting prevents API blocks

### 🌐 Multiple Subtitle Sources

- **Cloud API** (default): Shared subtitle cache for instant loading
- **Local yt-dlp server**: Extract subtitles on your own machine ([see server repo](https://github.com/yourusername/vocabumin-subtitle-server))
- Automatic fallback if one source fails

### 🔐 Privacy-Focused

- All data processing happens locally
- No tracking or analytics
- Optional cloud features (you control it)
- [Read our Privacy Policy](PRIVACY.md)

### 🎨 Clean User Experience

- Seamless overlay on YouTube player
- Auto-disable when switching videos
- Customizable subtitle appearance
- One-click enable/disable

## 📦 Installation

### Option 1: Manual Installation (Recommended for Testing)

1. **Clone this repository**

   ```bash
   git clone https://github.com/yourusername/vocabumin.git
   cd vocabumin
   ```

2. **Load the extension in Chrome**

   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right)
   - Click "Load unpacked"
   - Select the cloned `vocabumin` folder

3. **Optional: Set up the local subtitle server**

   For privacy and better control, you can run your own subtitle extraction server:

   - Visit the [vocabumin-subtitle-server repository](https://github.com/yourusername/vocabumin-subtitle-server)
   - Follow the setup instructions there
   - Configure the extension to use your local server in Settings

4. **Start using it!**
   - Go to any YouTube video
   - Click "Enable Overlay" when captions are ready
   - Enjoy perfectly synced subtitles

### Option 2: Chrome Web Store

**Status**: Coming soon!

## 🚀 Quick Start

1. Navigate to any YouTube video with captions
2. Wait for the subtitle overlay button to appear on the player
3. Click **"Enable Overlay"**
4. Watch as subtitles appear word-by-word in perfect sync

**Tip**: The first time you watch a video, it may take 2-5 seconds to fetch subtitles. After that, they're cached instantly!

## 📚 Documentation

- **[Setup Guide](SETUP.md)** - Detailed installation and configuration
- **[Architecture Overview](docs/CLAUDE.md)** - How the extension works internally
- **[Privacy Policy](PRIVACY.md)** - What data we collect (spoiler: almost nothing)
- **[Contributing Guide](CONTRIBUTING.md)** - How to contribute to this project
- **[Testing Guide](TESTING.md)** - Help us test with first users

## 🛠️ Technology Stack

| Component     | Technology                         |
| ------------- | ---------------------------------- |
| **Extension** | Vanilla JavaScript (no frameworks) |
| **Manifest**  | Chrome Manifest V3                 |
| **Storage**   | Chrome Storage API + IndexedDB     |
| **Backend**   | Cloud API or [Local Server](https://github.com/yourusername/vocabumin-subtitle-server) |

### Architecture Highlights

- **Event-driven design**: Custom EventBus for decoupled components
- **Centralized state**: StateManager as single source of truth
- **Layered caching**: Memory → IndexedDB → Server → Source
- **Critical load order**: Scripts load in precise dependency order

[See full architecture details →](docs/CLAUDE.md)

## 🎓 Use Cases

### Language Learners

- Click any word for instant definitions (coming soon)
- Study natural speech patterns
- Improve listening comprehension

### Accessibility

- Better subtitle timing for hard-of-hearing users
- Clearer word boundaries
- Customizable display

### Content Creators

- Analyze speech timing in videos
- Study pacing and rhythm
- Create better content

## 🤝 Contributing

We welcome contributions! Here's how you can help:

- 🐛 **Report bugs** - [Open an issue](https://github.com/yourusername/vocabumin/issues/new?template=bug_report.md)
- 💡 **Suggest features** - [Request a feature](https://github.com/yourusername/vocabumin/issues/new?template=feature_request.md)
- 🔧 **Submit pull requests** - See our [Contributing Guide](CONTRIBUTING.md)
- 📖 **Improve documentation** - Help make our docs clearer
- 🌐 **Translate** - Add support for more languages

## 🐛 Known Issues

- Manual (human-created) subtitles don't have word-level timing → displayed as full captions
- YouTube DOM changes may require extension updates
- Rate limiting: Aggressive usage may trigger YouTube blocks (we implement safeguards)

[See all issues →](https://github.com/yourusername/vocabumin/issues)

## 📋 Requirements

- **Browser**: Chrome, Edge, or Chromium-based browsers (version 88+)
- **Internet**: Required for initial subtitle fetching

## 🔧 Troubleshooting

### Extension not appearing on YouTube

1. Refresh the YouTube page (F5)
2. Check if extension is enabled in `chrome://extensions/`
3. Look for error messages in Chrome DevTools console

### "No subtitles available"

- Some videos don't have captions enabled
- Try a different video with auto-generated captions
- Check if subtitles are enabled on YouTube's player

### Extension not loading

1. Go to `chrome://extensions/`
2. Find "Vocabumin"
3. Make sure the toggle is ON
4. Click the reload icon ↻

[More troubleshooting →](SETUP.md#troubleshooting)

## 📊 Project Status

**Current Version**: 1.0.0 (Initial Release)

- [x] Core subtitle overlay functionality
- [x] Multi-layer caching system
- [x] Local server support ([separate repository](https://github.com/yourusername/vocabumin-subtitle-server))
- [x] Cloud API integration
- [ ] Word-click definitions (in development)
- [ ] Chrome Web Store publication (planned)
- [ ] Firefox support (planned)

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **[yt-dlp](https://github.com/yt-dlp/yt-dlp)** - Subtitle extraction (used in [subtitle server](https://github.com/yourusername/vocabumin-subtitle-server))
- **YouTube** - For providing subtitle data
- **The open-source community** - For inspiration and tools

## 📞 Contact & Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/vocabumin/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/vocabumin/discussions)

## 🔗 Related Projects

- **[vocabumin-subtitle-server](https://github.com/yourusername/vocabumin-subtitle-server)** - Local subtitle extraction server (optional)

## ⭐ Show Your Support

If this project helped you learn languages or improve your YouTube experience, please give it a star ⭐ on GitHub!

---

**Made with ❤️ for language learners worldwide**
