<div align="center">
  <img src="icons/icon128.png" alt="QuickRoute Logo" width="128" height="128">
  <h1>QuickRoute (v0.1)</h1>
  <p>Chrome extension for URL template shortcuts</p>

  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
</div>

A Chrome extension that lets you define multiple URL templates and quickly open selected text/links using keyboard shortcuts or a context menu.

➡️ **[Install QuickRoute from the Chrome Web Store](https://chromewebstore.google.com/detail/quickroute/ghcakfbeahdoljdpbifiickdbhjppacg)**  

## Features
- Set custom URL templates with `{url}` placeholder
- Right-click context menu integration
- Simple options page for configuration
- Multiple template support
- Keyboard shortcuts (Ctrl+Shift+1-4)
- Template management interface
- Template preview in popup

## Local Installation
1. Clone/download this repository
2. In Chrome:
   - Go to `chrome://extensions`
   - Enable "Developer mode" (toggle top-right)
   - Click "Load unpacked"
   - Select the project folder

## Usage
1. **Configure Templates:**
   - Click extension icon > "Configure Templates"
   - Add templates with custom names
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

## Template Examples
| Purpose | Template |
|---------|----------|
| Archive.org | `https://web.archive.org/web/{url}` |
| Wayback Machine | `https://web.archive.org/save/{url}` |
| Custom Proxy | `https://your-proxy.com/fetch?url={url}` |


## Project Structure
```plaintext
quickroute/
├── src/
│   ├── js/
│   │   ├── background.js
│   │   ├── popup.js
│   │   └── options.js
│   ├── styles/
│   │   ├── popup.css
│   │   └── options.css
│   └── html/
│       ├── popup.html
│       └── options.html
├── icons/
├── manifest.json
├── LICENSE
└── README.md
```

## Development
**Requirements:**
- Chrome browser (v88+ for Manifest V3)
- Text editor/IDE (VS Code, Sublime, etc.)
- Basic JavaScript/HTML/CSS knowledge

**Local Development:**
1. Clone repository
2. Make changes to source files
3. Load unpacked extension in Chrome
4. Test changes
5. Reload extension as needed

## Contributing
1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request


## License
This project is open source and available under the [MIT License](LICENSE).

___ 

[Privacy Policy](privacy_policy.md)
