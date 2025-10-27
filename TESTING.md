# Testing Guide for First Users

Thank you for helping test **YouTube Subtitle Overlay**! This guide will help you provide valuable feedback.

## 🎯 What We're Testing

This is the **v1.0.0 initial release**. We need to ensure:

- Extension loads correctly
- Subtitles sync properly with video playback
- Caching works as expected
- Error handling is user-friendly
- Performance is acceptable

---

## 📋 Pre-Testing Setup

### 1. Install the Extension

Follow the [Setup Guide](SETUP.md) to install:

- Load the extension in Chrome
- (Optional) Set up local Python server

### 2. Prepare Test Environment

- **Browser**: Chrome or Edge (latest version)
- **Internet**: Stable connection
- **DevTools**: Keep open to monitor console (F12)

---

## 🧪 Test Scenarios

### Test 1: Basic Functionality

**Goal**: Verify extension loads and displays subtitles

**Steps**:

1. Go to this video: https://www.youtube.com/watch?v=dQw4w9WgXcQ
2. Wait for "Enable Overlay" button to appear on player
3. Click "Enable Overlay"
4. Watch for 30 seconds

**Expected**:

- Button appears within 3-5 seconds
- Subtitles appear word-by-word in sync with speech
- No console errors

**Report**:

- Did it work? (Yes/No)
- Time until button appeared: \_\_\_ seconds
- Any errors in console? (screenshot)

---

### Test 2: Video Switching

**Goal**: Ensure overlay resets when changing videos

**Steps**:

1. Enable overlay on first video
2. Click another video in suggested sidebar
3. Observe behavior

**Expected**:

- Overlay automatically disables
- New video shows fresh "Enable Overlay" button
- No leftover subtitles from previous video

**Report**:

- Did overlay reset properly? (Yes/No)
- Any issues observed?

---

### Test 3: Cache Performance

**Goal**: Verify subtitle caching speeds up repeat views

**Steps**:

1. Enable overlay on a video (note the loading time)
2. Refresh the page (F5)
3. Enable overlay again (note the loading time)

**Expected**:

- First load: 2-5 seconds
- Second load: <1 second (cached)
- Console shows "Using cached subtitles"

**Report**:

- First load time: \_\_\_ seconds
- Second load time: \_\_\_ seconds
- Cache working? (Yes/No)

---

### Test 4: Manual Subtitles

**Goal**: Test behavior with human-created subtitles

**Steps**:

1. Find a video with manual subtitles (often TED talks, professional content)
2. Enable overlay
3. Observe display style

**Expected**:

- Extension detects manual subtitles
- Displays full captions (not word-by-word)
- Still syncs with timing

**Report**:

- Found manual subtitle video: [Link]
- Display was appropriate? (Yes/No)

---

### Test 5: No Captions Available

**Goal**: Verify error handling for videos without captions

**Steps**:

1. Find a video without captions
2. Try to enable overlay

**Expected**:

- Clear error message: "No subtitles available"
- No console errors
- Extension doesn't break

**Report**:

- Error message was clear? (Yes/No)
- Extension still functional after? (Yes/No)

---

### Test 6: Playback Speed

**Goal**: Test subtitle sync at different speeds

**Steps**:

1. Enable overlay on any video
2. Change playback speed: 0.5x, 1x, 1.5x, 2x
3. Observe subtitle timing

**Expected**:

- Subtitles stay in sync at all speeds
- No lag or drift over time

**Report**:

- Which speeds worked well?
- Any sync issues at specific speeds?

---

### Test 7: Local Server (Optional)

**If you set up the Python server**

**Steps**:

1. Ensure server is running: http://localhost:5000/health
2. Change extension settings → "Local Server (yt-dlp)"
3. Enable overlay on a video

**Expected**:

- Subtitles load from local server
- Console shows "source: local-ytdlp"

**Report**:

- Server working? (Yes/No)
- Any differences from cloud API?

---

### Test 8: Browser Refresh During Playback

**Goal**: Test robustness

**Steps**:

1. Enable overlay, start video playback
2. Refresh page (F5) while video playing
3. Re-enable overlay

**Expected**:

- Extension reloads cleanly
- Can re-enable without issues

**Report**:

- Any problems after refresh?

---

### Test 9: Multiple Tabs

**Goal**: Test extension with multiple YouTube tabs

**Steps**:

1. Open 3 YouTube tabs with different videos
2. Enable overlay on each
3. Switch between tabs

**Expected**:

- Each tab works independently
- No cross-tab interference

**Report**:

- All tabs worked? (Yes/No)
- Any slowdowns or conflicts?

---

### Test 10: Long Video

**Goal**: Test performance over extended playback

**Steps**:

1. Find a video >30 minutes long
2. Enable overlay
3. Watch for at least 10 minutes (or skip through)

**Expected**:

- Subtitles continue working throughout
- No memory leaks or slowdowns
- Sync stays accurate

**Report**:

- Video length tested: \_\_\_ minutes
- Any performance issues?

---

## 🐛 Bug Reporting

When you find a bug, please report it with:

### Required Information

- **Video URL**: Where the issue occurred
- **Browser**: Chrome version (chrome://version/)
- **OS**: Windows/Mac/Linux + version
- **Extension version**: Found in chrome://extensions/

### Console Errors

1. Open DevTools (F12)
2. Go to Console tab
3. Take a screenshot of any red errors
4. Copy full error text

### Steps to Reproduce

1. Exact steps you took
2. What you expected to happen
3. What actually happened

### Template

Use the [Bug Report template](https://github.com/Aminophen98/YTS-1/issues/new?template=bug_report.md) on GitHub.

---

## 💡 Feature Suggestions

During testing, you might think of improvements! Please share:

- What would make the extension more useful?
- What features are missing?
- What's confusing or unclear?

[Submit a feature request](https://github.com/Aminophen98/YTS-1/issues/new?template=feature_request.md)

---

## ✅ Testing Checklist

Print or copy this checklist:

- [ ] Test 1: Basic functionality
- [ ] Test 2: Video switching
- [ ] Test 3: Cache performance
- [ ] Test 4: Manual subtitles
- [ ] Test 5: No captions error
- [ ] Test 6: Playback speeds
- [ ] Test 7: Local server (optional)
- [ ] Test 8: Browser refresh
- [ ] Test 9: Multiple tabs
- [ ] Test 10: Long video

- [ ] Reported any bugs found
- [ ] Submitted feedback/suggestions

---

## 📊 Quick Feedback Form

After testing, please share your overall experience:

### Quick Questions

1. **How easy was installation?** (1-5 scale)
2. **How well do subtitles sync?** (1-5 scale)
3. **Would you use this daily?** (Yes/No/Maybe)
4. **Most annoying issue?**
5. **Favorite feature?**

### Where to Share Feedback

- **GitHub Issues**: https://github.com/Aminophen98/YTS-1/issues
- **Email**: [Your email - update this]

---

## 🎁 Thank You!

Your testing helps make this extension better for language learners worldwide. We appreciate your time and feedback!

### Recognition

Early testers will be:

- Thanked in release notes
- Listed in project acknowledgments
- Given early access to new features

---

## 📞 Need Help?

- **Setup issues**: See [Setup Guide](SETUP.md)
- **General questions**: [Open a question issue](https://github.com/Aminophen98/YTS-1/issues/new?template=question.md)
- **Urgent bugs**: Email [Your email]

---

**Happy Testing! 🚀**
