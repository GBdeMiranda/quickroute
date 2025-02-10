chrome.runtime.onInstalled.addListener(initializeContextMenu);
chrome.contextMenus.onClicked.addListener(handleContextMenuClick);
chrome.commands.onCommand.addListener(handleKeyboardShortcut);
chrome.runtime.onMessage.addListener(handleRuntimeMessages);

let templates = [];

async function initializeContextMenu() {
  await loadTemplates();
  chrome.contextMenus.removeAll();
  chrome.contextMenus.create({
    id: "main_menu",
    title: "Open with Template",
    contexts: ["all"]
  });
  updateContextMenu();
}

async function loadTemplates() {
  return new Promise(resolve => {
    chrome.storage.sync.get(['templates'], result => {
      if (!result.templates) {
        templates = [{
          name: "Configure Templates",
          url: chrome.runtime.getURL("options.html")
        }];
      } else {
        templates = result.templates;
      }
      resolve();
    });
  });
}

let createdMenuIds = [];

async function updateContextMenu() {
  await Promise.all(createdMenuIds.map(id => chrome.contextMenus.remove(id)));
  createdMenuIds = [];

  templates.forEach((template, index) => {
    const menuId = `template_${index}`;
    chrome.contextMenus.create({
      id: menuId,
      title: template.name,
      parentId: "main_menu",
      contexts: ["all"]
    });
    createdMenuIds.push(menuId);
  });
}

function handleContextMenuClick(info, tab) {
    const templateIndex = parseInt(info.menuItemId.split('_')[1]);
    if (isNaN(templateIndex)) return;

    let targetUrl = info.selectionText || info.linkUrl || tab.url;
    
    // If it's selected text and doesn't look like a URL, try to convert it
    if (info.selectionText && !targetUrl.startsWith('http')) {
        try {
            targetUrl = new URL(targetUrl).href;
        } catch {
            // If it's not a valid URL, use it as-is
            targetUrl = info.selectionText;
        }
    }

    processTemplate(templateIndex, targetUrl);
}

function handleKeyboardShortcut(command) {
  const index = parseInt(command.split('_').pop()) - 1;
  chrome.tabs.query({active: true, currentWindow: true}, tabs => {
    processTemplate(index, tabs[0].url);
  });
}

function handleRuntimeMessages(request) {
  if (request.action === 'updateTemplates') {
    loadTemplates().then(updateContextMenu);
  }
}

function processTemplate(index, inputUrl) {
    if (!templates[index] || !templates[index].url) return;
    
    const encodedUrl = encodeURIComponent(inputUrl);
    const newUrl = templates[index].url.replace(/{url}/g, encodedUrl);
    
    chrome.tabs.create({ url: newUrl });
}