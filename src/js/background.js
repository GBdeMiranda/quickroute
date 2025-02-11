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

async function handleContextMenuClick(info, tab) {
    try {
        await loadTemplates(); // Ensure fresh templates
        const templateIndex = parseInt(info.menuItemId.split('_')[1]);
        if (isNaN(templateIndex)) {
            console.error('Invalid template index');
            return;
        }

        let targetUrl = info.selectionText || info.linkUrl || tab.url;
        
        if (info.selectionText && !targetUrl.startsWith('http')) {
            try {
                targetUrl = new URL(targetUrl).href;
            } catch (error) {
                console.log('Converting selection to URL failed, using raw text');
                targetUrl = info.selectionText;
            }
        }

        await processTemplate(templateIndex, targetUrl);
    } catch (error) {
        console.error('Context menu click error:', error);
    }
}

async function handleKeyboardShortcut(command) {
    try {
        await loadTemplates(); // Ensure fresh templates
        const index = parseInt(command.split('_').pop()) - 1;
        const tabs = await chrome.tabs.query({active: true, currentWindow: true});
        if (tabs[0]) {
            await processTemplate(index, tabs[0].url);
        }
    } catch (error) {
        console.error('Keyboard shortcut error:', error);
    }
}

async function handleRuntimeMessages(request, sender, sendResponse) {
    try {
        if (request.action === 'updateTemplates') {
            await loadTemplates();
            await updateContextMenu();
        }
    } catch (error) {
        console.error('Runtime message error:', error);
    }
}

async function processTemplate(index, inputUrl) {
    try {
        if (!templates[index] || !templates[index].url) {
            console.error('Template not found or invalid');
            return;
        }
        
        const encodedUrl = encodeURIComponent(inputUrl);
        const newUrl = templates[index].url.replace(/{url}/g, encodedUrl);
        
        await chrome.tabs.create({ url: newUrl });
    } catch (error) {
        console.error('Process template error:', error);
    }
}