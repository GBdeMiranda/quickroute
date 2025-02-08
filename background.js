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
      templates = result.templates || [];
      resolve();
    });
  });
}

let createdMenuIds = [];

async function updateContextMenu() {
  // Clear existing menu items
  await Promise.all(createdMenuIds.map(id => chrome.contextMenus.remove(id)));
  createdMenuIds = [];

  // Create new menu items
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
  const index = parseInt(info.menuItemId.split('_')[1]);
  processTemplate(index, tab.url);
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
  if (!templates[index]?.url) return;
  
  const encodedUrl = encodeURIComponent(inputUrl);
  const newUrl = templates[index].url.replace(/{url}/g, encodedUrl);
  
  chrome.tabs.create({ url: newUrl });
}