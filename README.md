# QuickRoute (v0)

A Chrome extension that lets you define a URL template and open selected text/links in that template.

## Features
- Set custom URL templates with `{url}` placeholder
- Right-click context menu integration
- Simple options page for configuration
- URL-encoding for special characters

## Installation
1. Clone/download this repository
2. Create icon files (16x16, 48x48, 128x128 PNG) in `/icons`
3. In Chrome:
   - Go to `chrome://extensions`
   - Enable "Developer mode" (toggle top-right)
   - Click "Load unpacked"
   - Select the project folder

## Usage
1. **Set Template:**
   - Click the extension icon > "Options"
   - Enter template (e.g., `https://proxy.example/?url={url}`)
   - Click "Save Template"

2. **Use Template:**
   - **For text selection:**
     1. Highlight text on any page
     2. Right-click > "Open in Template"
   - **For links:**
     1. Right-click any link
     2. Choose "Open in Template"

## Example
**Template:** `https://translate.google.com/?sl=auto&tl=en&text={url}`  
**Selected Text:** `Bonjour le monde`  
**Result:** `https://translate.google.com/...?text=Bonjour%20le%20monde`

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
**Dependencies:**  
- Chrome browser (v88+ for Manifest V3)

**Testing Checklist:**  
- [ ] Template saving/loading works
- [ ] Context menu appears for text/links
- [ ] URL encoding works properly
- [ ] Error handling for missing template
- [ ] Cross-origin URL testing

## License