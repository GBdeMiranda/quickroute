<div align="center">
  <img src="icons/icon128.png" alt="QuickRoute Logo" width="128" height="128">
  <h1>QuickRoute</h1>
  <p>Send the current page, a link or selected text to any site</p>

  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
</div>

A Chrome extension that sends the current page, a link or the selected text to the sites you choose: either by opening an address built from a template, or by filling a field on the site for you. It works with any site, including sites that keep changing their domain.

**[Install QuickRoute from the Chrome Web Store](https://chromewebstore.google.com/detail/quickroute/ghcakfbeahdoljdpbifiickdbhjppacg)**  

## Features
- **URL templates** with a `{url}` placeholder, e.g. `https://web.archive.org/web/{url}`
- **Form templates** for sites that only take input through a form (like archive.today): QuickRoute opens the site, fills the field and submits it
- **Alternative addresses**: give a template several domains and QuickRoute opens the first one that responds, so the template keeps working when a site moves
- **No selectors needed**: right-click a text field -> *Use this field in a new template*, or click *Create template from a field on this page* in the popup
- Right-click context menu, popup and keyboard shortcuts for the first four templates
- One-click examples (Archive.today, Wayback Machine)

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
   - Click "Add New Template", or choose one in "Add from example..."
   - Choose what the template does:
     - **Open a URL**: the first address must contain `{url}`, which is replaced by the page address, link or selected text (URL-encoded)
     - **Fill a field on a site**: the address of the page that has the field. Leave *Field* empty to let QuickRoute find the main text box, or click "Pick on site" and click the field. Keep "Submit the form after filling it" checked to send it right away
   - Click "Save All Templates". For form templates Chrome asks for access to those sites: that is what lets QuickRoute fill them

   The quickest way to connect a site that has a form: open it, right-click its text box and choose **Open with template -> Use this field in a new template...** (or use the button in the popup). The options page opens with the template filled in; check it and save.

2. **Sites that change address:**
   Put one address per line. QuickRoute checks them all at once and opens the first one in your order that responds (an address that stays silent is skipped after a moment when another one has answered):
   ```text
   https://example.org/search?q={url}
   example.net
   example.com
   ```
   In URL templates, a line with only a domain reuses the first line on that domain (`https://example.net/search?q={url}`). In form templates each line is the address of a page with the field.

3. **Use Templates:**
   - **Via Context Menu:**
     1. Right-click the page, a link, an image or selected text
     2. Select "Open with template" > Choose template (selected text is used first, then the link, then the page address)
   - **Via Keyboard:**
     - Ctrl+Shift+1 to Ctrl+Shift+4 run the first four templates with the current page
     - Change them at `chrome://extensions/shortcuts`
   - **Via Popup:**
     1. Click extension icon
     2. Select desired template

   When something goes wrong outside an extension page (for example, a site doesn't answer), the icon shows a **!** badge. Open the popup to read the message.

## Template Examples
| Purpose | Type | Addresses |
|---------|------|-----------|
| Archive.today (save page) | Form, field `#url` | `https://archive.ph/`, `https://archive.is/`, `https://archive.li/`, ... |
| Wayback Machine (snapshots) | URL | `https://web.archive.org/web/{url}` |
| Custom Proxy | URL | `https://your-proxy.com/fetch?url={url}` |

## Permissions
| Permission | Why |
|------------|-----|
| `storage` | Saves your templates (synced with your Chrome profile) |
| `contextMenus` | The right-click menu |
| `activeTab` | Reads the address of the tab where you use QuickRoute, only when you use it |
| `scripting` | Fills fields and lets you pick a field on a page |
| Site access (optional) | Requested per site when you save a form template, so QuickRoute can fill the form there. Access to sites no template uses anymore is removed when you save |

## Project Structure
```plaintext
quickroute/
|-- src/
|   |-- js/
|   |   |-- background.js         # service worker: context menu, shortcuts, messages
|   |   |-- popup.js
|   |   |-- options.js
|   |   |-- lib/
|   |   |   |-- templates.js      # storage, validation and addresses of templates
|   |   |   |-- runner.js         # runs templates: tabs, form jobs, alternative addresses
|   |   |   \-- notice.js         # badge and message for problems in the background
|   |   \-- content/
|   |       |-- form-filler.js    # fills and submits the field on the site
|   |       \-- field-picker.js   # lets you click the field a template should use
|   |-- styles/
|   |   |-- popup.css
|   |   \-- options.css
|   \-- html/
|       |-- popup.html
|       \-- options.html
|-- icons/
|-- manifest.json
|-- LICENSE
\-- README.md
```

## Development
**Requirements:**
- Chrome browser (v102+)
- Text editor/IDE (VS Code, Sublime, etc.)
- Basic JavaScript/HTML/CSS knowledge
- Playwright (for browser automation and end-to-end testing)

**Local Development:**
1. Clone repository
2. Make changes to source files
3. Load unpacked extension in Chrome
4. Test changes
5. Reload extension as needed (the service worker and content scripts only update after a reload on `chrome://extensions`)

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
