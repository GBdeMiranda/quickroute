import { displayName, loadTemplates } from './lib/templates.js';
import { notify } from './lib/notice.js';
import { captureFocusedField, claimFormJob, completeFormJob, runTemplate, startDraft } from './lib/runner.js';

const ROOT_MENU = 'quickroute';
const CAPTURE_MENU = 'capture-field';
const SETTINGS_MENU = 'settings';
const TEMPLATE_MENU_PREFIX = 'template:';

// Listeners are registered synchronously so Chrome can wake the service worker
// for them. Nothing is cached in memory: Chrome stops the worker after about
// 30 seconds idle, so every handler reads the templates from storage.
chrome.runtime.onInstalled.addListener(rebuildMenus);
chrome.runtime.onStartup.addListener(rebuildMenus);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.templates) rebuildMenus();
});
chrome.contextMenus.onClicked.addListener((info, tab) => handleMenuClick(info, tab).catch(reportError));
chrome.commands.onCommand.addListener((command, tab) => handleCommand(command, tab).catch(reportError));
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse, (error) => {
    reportError(error);
    sendResponse(null);
  });
  return true;
});

let menuUpdate = Promise.resolve();

function rebuildMenus() {
  menuUpdate = menuUpdate.then(buildMenus).catch(reportError);
  return menuUpdate;
}

async function buildMenus() {
  const templates = await loadTemplates();
  await chrome.contextMenus.removeAll();
  await createMenu({ id: ROOT_MENU, title: 'Open with template', contexts: ['all'] });
  for (const template of templates) {
    await createMenu({ id: TEMPLATE_MENU_PREFIX + template.id, parentId: ROOT_MENU, title: displayName(template), contexts: ['all'] });
  }
  if (templates.length) await createMenu({ id: 'separator', parentId: ROOT_MENU, type: 'separator', contexts: ['all'] });
  await createMenu({ id: CAPTURE_MENU, parentId: ROOT_MENU, title: 'Use this field in a new template...', contexts: ['editable'] });
  await createMenu({ id: SETTINGS_MENU, parentId: ROOT_MENU, title: 'Configure templates...', contexts: ['all'] });
}

function createMenu(properties) {
  return new Promise((resolve) => {
    chrome.contextMenus.create(properties, () => {
      if (chrome.runtime.lastError) console.warn('QuickRoute: menu item', properties.id, chrome.runtime.lastError.message);
      resolve();
    });
  });
}

async function handleMenuClick(info, tab) {
  const menuId = String(info.menuItemId);
  if (menuId === SETTINGS_MENU) return chrome.runtime.openOptionsPage();
  if (menuId === CAPTURE_MENU) return captureFocusedField(tab, info.frameId);
  if (!menuId.startsWith(TEMPLATE_MENU_PREFIX)) return;

  const template = (await loadTemplates()).find(({ id }) => TEMPLATE_MENU_PREFIX + id === menuId);
  if (!template) return notify('That template no longer exists.');
  const input = info.selectionText?.trim() || info.linkUrl || info.srcUrl || info.pageUrl || tab?.url;
  await runTemplate(template, input, tab);
}

async function handleCommand(command, tab) {
  const match = /^open_template_(\d+)$/.exec(command);
  if (!match) return;
  const position = Number(match[1]);
  const template = (await loadTemplates())[position - 1];
  if (!template) return notify(`There is no template number ${position} yet.`);
  const [activeTab] = tab ? [tab] : await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (activeTab) await runTemplate(template, activeTab.url, activeTab);
}

async function handleMessage(message, sender) {
  switch (message?.type) {
    case 'run-template': {
      if (!sender.url?.startsWith(chrome.runtime.getURL(''))) return null;
      const template = (await loadTemplates()).find(({ id }) => id === message.templateId);
      let input = message.input;
      let sourceTab = message.tab;
      if (!input || !sourceTab) {
        const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (activeTab) {
          input = input || activeTab.url;
          sourceTab = sourceTab || activeTab;
        }
      }
      if (template) await runTemplate(template, input, sourceTab);
      return { ok: Boolean(template) };
    }
    case 'field-picked':
      // Picks for an existing template are handled by the options page.
      if (message.purpose === 'new') await startDraft(message.field);
      return null;
    case 'form-job:ready':
      return claimFormJob(sender);
    case 'form-job:filled':
      return completeFormJob(sender);
    default:
      return null;
  }
}

function reportError(error) {
  console.error('QuickRoute:', error);
  notify(`Something went wrong: ${error?.message ?? error}`).catch(() => {});
}
