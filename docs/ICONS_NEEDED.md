# Extension Icons Required

## ⚠️ Action Required

The extension currently **lacks icons**, which are required for:
- Chrome extensions toolbar
- Extension management page (chrome://extensions/)
- Professional appearance

## Required Icon Sizes

Create icons in the following sizes and place them in `/extension/icons/` folder:

- **16x16** - Small toolbar icon
- **32x32** - Medium toolbar icon
- **48x48** - Extension management page
- **128x128** - Chrome Web Store listing (if publishing)

## File Format

- **Format**: PNG with transparency
- **File names**: `icon16.png`, `icon32.png`, `icon48.png`, `icon128.png`
- **Location**: `/extension/icons/`

## Design Suggestions

The icon should represent:
- YouTube (without using copyrighted YouTube logo)
- Subtitles/captions (CC symbol, text lines, speech bubbles)
- Language learning (books, globe, translation)

### Design Ideas

1. **Subtitle bars** - Horizontal lines representing subtitle text
2. **Speech bubble** - Communication/language theme
3. **Play button + text** - Video + captions
4. **Eye + text** - Reading/learning focus
5. **CC symbol** - Universal caption symbol

### Color Palette Suggestions

- Primary: YouTube red (#FF0000) or blue (#0066FF)
- Accent: White or light gray for contrast
- Background: Transparent or solid color

## Tools for Creating Icons

### Free Online Tools
- **Figma** - https://figma.com (professional design tool)
- **Canva** - https://canva.com (templates available)
- **GIMP** - https://gimp.org (free Photoshop alternative)
- **Inkscape** - https://inkscape.org (vector graphics)

### Quick Icon Generators
- **App Icon Generator** - https://appicon.co/
- **Icon Generator** - https://icon.kitchen/
- **Favicon Generator** - https://favicon.io/

### Using AI
- **DALL-E** / **Midjourney** - Generate icon concepts
- Prompt: "minimalist icon for YouTube subtitle extension, flat design, 128x128px"

## After Creating Icons

1. Place all PNG files in `/extension/icons/` directory

2. Update `manifest.json` to reference them:

```json
"icons": {
  "16": "icons/icon16.png",
  "32": "icons/icon32.png",
  "48": "icons/icon48.png",
  "128": "icons/icon128.png"
},
"action": {
  "default_icon": {
    "16": "icons/icon16.png",
    "32": "icons/icon32.png"
  },
  ...
}
```

3. Reload the extension in Chrome to see the new icons

## Legal Considerations

- ⚠️ **Do NOT use YouTube's logo** - Trademark violation
- ✅ **Use generic video/subtitle symbols**
- ✅ **Create original artwork** or use free icon libraries

## Free Icon Resources

If you want to modify existing icons (check licenses!):
- **Font Awesome** - https://fontawesome.com/
- **Material Icons** - https://fonts.google.com/icons
- **Heroicons** - https://heroicons.com/
- **Feather Icons** - https://feathericons.com/

## Example Manifest Update

Once icons are created, your manifest.json should include:

```json
{
  "manifest_version": 3,
  "name": "YouTube Subtitle Overlay",
  "version": "1.0.0",
  "description": "Display YouTube subtitles as clickable overlay with AI-powered features",

  "icons": {
    "16": "icons/icon16.png",
    "32": "icons/icon32.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },

  "action": {
    "default_popup": "popup/popup-simple.html",
    "default_title": "Vocaminary - YouTube Learning Assistant",
    "default_icon": {
      "16": "icons/icon16.png",
      "32": "icons/icon32.png"
    }
  },

  ...
}
```

---

**Priority**: Medium-High (needed before public release)
**Time estimate**: 1-2 hours for design + creation
**Skills needed**: Basic graphic design or access to AI image generation
