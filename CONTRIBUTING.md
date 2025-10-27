# Contributing to YouTube Subtitle Overlay

Thank you for your interest in contributing! This document will help you get started.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Coding Standards](#coding-standards)
- [Pull Request Process](#pull-request-process)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)

---

## Code of Conduct

### Our Pledge

We want this project to be welcoming to everyone. Be respectful, constructive, and kind.

### Expected Behavior

- Be patient and welcoming to newcomers
- Focus on what's best for the community
- Show empathy towards other contributors
- Provide constructive feedback

### Unacceptable Behavior

- Harassment, trolling, or insulting comments
- Publishing others' private information
- Any conduct that would be inappropriate in a professional setting

---

## How Can I Contribute?

### Reporting Bugs

Found a bug? [Open an issue](https://github.com/Aminophen98/YTS-1/issues/new?template=bug_report.md) with:

- Clear, descriptive title
- Steps to reproduce
- Expected vs actual behavior
- Chrome version and OS
- Console errors (open DevTools → Console)
- Video ID where the bug occurs

### Suggesting Features

Have an idea? [Request a feature](https://github.com/Aminophen98/YTS-1/issues/new?template=feature_request.md) with:

- Clear description of the feature
- Why it would be useful
- How it should work
- Mockups or examples (if applicable)

### Improving Documentation

- Fix typos or unclear explanations
- Add missing documentation
- Translate to other languages
- Create tutorials or guides

### Contributing Code

1. **Find an issue to work on**
   - Browse [open issues](https://github.com/Aminophen98/YTS-1/issues)
   - Look for `good first issue` or `help wanted` labels
   - Comment to let us know you're working on it

2. **Fork and clone the repo**
   ```bash
   git clone https://github.com/YOUR_USERNAME/YTS-1.git
   cd YTS-1
   ```

3. **Create a branch**
   ```bash
   git checkout -b fix/issue-description
   # or
   git checkout -b feature/new-feature-name
   ```

4. **Make your changes** (see [Development Setup](#development-setup))

5. **Test thoroughly**
   - Test on multiple YouTube videos
   - Test with both local server and cloud API
   - Check browser console for errors

6. **Submit a pull request** (see [Pull Request Process](#pull-request-process))

---

## Development Setup

### Prerequisites

- Chrome or Chromium-based browser
- Git
- Python 3.6+ (for local server testing)
- Text editor (VS Code recommended)

### Setup Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/Aminophen98/YTS-1.git
   cd YTS-1
   ```

2. **Set up local server** (optional but recommended)
   ```bash
   cd server
   pip install yt-dlp flask flask-cors
   python yt-dlp-server.py
   ```

3. **Load extension in Chrome**
   - Go to `chrome://extensions/`
   - Enable Developer mode
   - Click "Load unpacked"
   - Select the `/extension` folder

4. **Make changes and test**
   - Edit files in `/extension`
   - Go to `chrome://extensions/` and click reload button
   - Test on YouTube

### Understanding the Architecture

Before contributing code, please read:

- **[CLAUDE.md](docs/CLAUDE.md)** - Complete architecture overview
- **Critical load order** - Scripts must load in specific order (see manifest.json)
- **StateManager pattern** - Never mutate state directly
- **EventBus system** - How components communicate

Key files to understand:
- `extension/content/content-script.js` - Main entry point
- `extension/content/core/StateManager.js` - Application state
- `extension/content/services/SubtitleManager.js` - Caching system
- `extension/manifest.json` - Extension configuration

---

## Coding Standards

### JavaScript Style

We use **vanilla JavaScript** (no frameworks). Follow these conventions:

#### Naming Conventions

```javascript
// Classes: PascalCase
class SubtitleManager {}

// Functions/variables: camelCase
function fetchSubtitles() {}
const videoElement = document.querySelector('video');

// Constants: UPPER_SNAKE_CASE
const MAX_CACHE_SIZE = 3;

// Private methods: _prefixWithUnderscore
_internalMethod() {}
```

#### Code Structure

```javascript
// ✅ Good: Clear, readable
function processCaption(caption) {
  if (!caption || !caption.text) {
    logger.warn('Invalid caption', caption);
    return null;
  }

  return {
    start: caption.start,
    end: caption.end,
    text: caption.text.trim()
  };
}

// ❌ Bad: No validation, unclear
function processCaption(c) {
  return {start: c.start, end: c.end, text: c.text.trim()};
}
```

#### Logging

Use the centralized logger with emoji prefixes:

```javascript
logger.debug('🔍', 'Detailed debug info'); // Verbose
logger.info('📘', 'Normal operation');      // Info
logger.warn('⚠️', 'Warning message');      // Warning
logger.error('❌', 'Error occurred', error); // Error
```

#### Error Handling

```javascript
// ✅ Good: Specific error handling
try {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return await response.json();
} catch (error) {
  logger.error('Failed to fetch data', error);
  throw error; // Re-throw if caller needs to handle it
}

// ❌ Bad: Silent failures
try {
  return await fetch(url).then(r => r.json());
} catch {}
```

#### State Management

```javascript
// ✅ Good: Use StateManager methods
stateManager.setCurrentVideoId('abc123');
const videoId = stateManager.getCurrentVideoId();

// ❌ Bad: Direct state mutation
stateManager.state.currentVideoId = 'abc123'; // NEVER DO THIS
```

#### Events

```javascript
// ✅ Good: Use EventBus
eventBus.emit('captionsLoaded', {videoId, captions});
eventBus.on('videoPlay', (data) => {
  logger.info('Video playing', data);
});

// ✅ Clean up listeners when done
const handlerId = eventBus.on('event', handler);
eventBus.off('event', handlerId);
```

### File Organization

```
extension/
├── content/
│   ├── core/           # Foundation (Logger, EventBus, StateManager)
│   ├── services/       # Business logic
│   ├── youtube/        # YouTube-specific code
│   ├── ui/             # UI components
│   └── content-script.js  # Main orchestrator
├── background/         # Service worker
├── popup/              # Extension popup
└── settings/           # Settings page
```

**Rule**: New files should fit into this structure. If unsure, ask in your PR.

### Comments

```javascript
// ✅ Good: Explain WHY, not WHAT
// Cache in memory to avoid IndexedDB overhead on frequent access
this.memoryCache = new Map();

// ✅ Good: Document complex logic
/**
 * Finds the caption that should be displayed at the given time.
 * Uses binary search for O(log n) performance.
 *
 * @param {number} currentTime - Video playback time in seconds
 * @returns {Object|null} Caption object or null if none found
 */
findCaptionAtTime(currentTime) {
  // ...
}

// ❌ Bad: Obvious comments
// Set the video ID to abc123
setVideoId('abc123');
```

---

## Pull Request Process

### Before Submitting

- [ ] Code follows style guidelines above
- [ ] Tested on multiple YouTube videos
- [ ] No console errors
- [ ] Existing features still work
- [ ] Updated documentation if needed
- [ ] Commit messages are clear

### Commit Messages

Use clear, descriptive messages:

```bash
# ✅ Good
git commit -m "Fix subtitle sync issue with variable-speed playback"
git commit -m "Add support for manual subtitle detection"
git commit -m "Update README installation instructions"

# ❌ Bad
git commit -m "fix bug"
git commit -m "update"
git commit -m "changes"
```

### Pull Request Template

When opening a PR, include:

**Description**
- What changes did you make?
- Why are these changes needed?
- Link to related issues

**Testing**
- How did you test this?
- What videos did you test with?
- Any edge cases covered?

**Screenshots** (if UI changes)

**Checklist**
- [ ] Tested locally
- [ ] No console errors
- [ ] Documentation updated
- [ ] Follows code style

### Review Process

1. Submit PR with clear description
2. Automated checks will run (if set up)
3. Maintainer will review your code
4. Address any feedback
5. Once approved, we'll merge!

**Note**: Reviews may take a few days. Be patient!

---

## Project-Specific Guidelines

### Critical Constraints

1. **Script load order is sacred**
   - Never reorder scripts in manifest.json without understanding dependencies
   - Logger → EventBus → StateManager → Services → UI → Main

2. **State updates MUST go through StateManager**
   ```javascript
   // ✅ Always use methods
   stateManager.setCurrentVideoId(id);

   // ❌ Never mutate directly
   stateManager.state.currentVideoId = id;
   ```

3. **No external dependencies**
   - Extension uses vanilla JavaScript only
   - No npm packages, no jQuery, no frameworks
   - Exception: Python server can use pip packages

4. **Chrome API compatibility**
   - Use Manifest V3 APIs only
   - Test on latest Chrome stable version
   - Avoid deprecated APIs

### Testing Checklist

Before submitting, test:

- [ ] Fresh installation (clear extension data)
- [ ] Videos with auto-generated captions
- [ ] Videos with manual captions
- [ ] Videos without captions
- [ ] Switching between videos
- [ ] Browser refresh while video playing
- [ ] Local server mode
- [ ] Cloud API mode
- [ ] Cache functionality (watch same video twice)
- [ ] Multiple tabs with YouTube

### Performance Considerations

- Avoid synchronous operations in critical paths
- Cache aggressively (memory → IndexedDB → server)
- Minimize DOM queries (cache element references)
- Use requestAnimationFrame for UI updates
- Profile with Chrome DevTools if adding complex features

---

## Need Help?

### Resources

- **[Architecture docs](docs/CLAUDE.md)** - How the extension works
- **[Setup guide](SETUP.md)** - Development environment
- **Existing code** - Look at similar features for patterns

### Ask Questions

- Comment on the issue you're working on
- Open a [Discussion](https://github.com/Aminophen98/YTS-1/discussions) (coming soon)
- No question is too small!

---

## Recognition

Contributors will be:
- Listed in project acknowledgments
- Thanked in release notes
- Credited in the AUTHORS file (coming soon)

---

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

**Thank you for contributing to YouTube Subtitle Overlay!** 🎉
