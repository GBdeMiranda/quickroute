# QuickRoute (v0.1)

A Chrome extension that lets you define multiple URL templates and quickly open selected text/links using keyboard shortcuts or context menu.

## Features
- Set custom URL templates with `{url}` placeholder
- Right-click context menu integration
- Simple options page for configuration
- URL-encoding for special characters
- Multiple template support
- Keyboard shortcuts (Ctrl+Shift+1-4)
- Template management interface
- Template preview in popup

## Installation
1. Clone/download this repository
2. Create icon files (16x16, 48x48, 128x128 PNG) in `/icons`
3. In Chrome:
   - Go to `chrome://extensions`
   - Enable "Developer mode" (toggle top-right)
   - Click "Load unpacked"
   - Select the project folder

## Usage
1. **Configure Templates:**
   - Click extension icon > "Options"
   - Add multiple templates with custom names
   - Each template must include `{url}` placeholder
   - Click "Save All Templates"

2. **Use Templates:**
   - **Via Context Menu:**
     1. Right-click on any text/link
     2. Select "Open with Template" > Choose template
   - **Via Keyboard:**
     - Use Ctrl+Shift+1 for first template
     - Use Ctrl+Shift+2 for second template
     - etc. (up to 4 templates)
   - **Via Popup:**
     1. Click extension icon
     2. Select desired template

## Examples
**Template Examples:**
- Google Translate: `https://translate.google.com/?sl=auto&tl=en&text={url}`
- Archive.org: `https://web.archive.org/web/{url}`
- Wayback Machine: `https://web.archive.org/save/{url}`
- Custom Proxy: `https://your-proxy.com/fetch?url={url}`

## Structure
```plaintext
quickroute-extension/
├── manifest.json
├── background.js
├── options.html
├── options.js
├── popup.html
├── popup.js
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

## Development
**Requirements:**
- Chrome browser (v88+ for Manifest V3)
- Basic knowledge of HTML/CSS/JavaScript

**Local Development:**
1. Clone repository
2. Make changes to source files
3. Load unpacked extension in Chrome
4. Test changes
5. Reload extension as needed

**Testing:**
- Verify all keyboard shortcuts
- Test with various URL formats
- Check template saving/loading
- Verify context menu operation
- Test URL encoding/decoding

## Contributing
1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request

## License
MIT License