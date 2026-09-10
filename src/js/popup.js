import { SHORTCUT_COUNT, displayName, expandAddresses, getShortcuts, loadTemplates } from './lib/templates.js';
import { clearNotice } from './lib/notice.js';

const PICKER_FILE = 'src/js/content/field-picker.js';

const templateList = document.getElementById('templateList');
const statusLine = document.getElementById('status');
const pickButton = document.getElementById('pickButton');

const [templates, shortcuts, [tab], { notice }] = await Promise.all([
    loadTemplates(),
    getShortcuts(),
    chrome.tabs.query({ active: true, currentWindow: true }),
    chrome.storage.session.get('notice'),
]);

showNotice(notice);
document.getElementById('emptyState').hidden = templates.length > 0;
templateList.append(...templates.map(renderTemplate));

pickButton.disabled = !/^https?:/.test(tab?.url ?? '');
pickButton.addEventListener('click', startPicker);
document.getElementById('configureButton').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
    window.close();
});

function renderTemplate(template, index) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'template-item';

    if (index < SHORTCUT_COUNT && shortcuts[index]) {
        const badge = document.createElement('span');
        badge.className = 'shortcut-badge';
        badge.textContent = shortcuts[index];
        item.append(badge);
    }
    const name = document.createElement('strong');
    name.textContent = displayName(template);
    const preview = document.createElement('span');
    preview.className = 'template-preview';
    preview.textContent = describeTemplate(template);
    item.append(name, preview);

    item.addEventListener('click', () => runTemplate(template, item));
    return item;
}

function describeTemplate(template) {
    const [address = ''] = expandAddresses(template);
    const extra = template.urls.length - 1;
    const alternatives = extra > 0 ? ` (+${extra} alternative${extra > 1 ? 's' : ''})` : '';
    if (template.type === 'form') {
        return `${address}${alternatives}`;
    }
    return `${address.replaceAll('{url}', '[URL]')}${alternatives}`;
}

async function runTemplate(template, item) {
    let currentTab = tab;
    if (!currentTab?.url) {
        const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (activeTab?.url) currentTab = activeTab;
    }
    if (!currentTab?.url) {
        showStatus('This tab has no address to send.');
        return;
    }
    item.classList.add('busy');
    // The service worker opens the tab, so it keeps working after the popup closes.
    await chrome.runtime.sendMessage({ type: 'run-template', templateId: template.id, input: currentTab.url, tab: currentTab });
    window.close();
}

async function startPicker() {
    try {
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: [PICKER_FILE] });
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => globalThis.quickRoutePicker.start({ purpose: 'new' }),
        });
        window.close();
    } catch (error) {
        showStatus(`QuickRoute cannot work on this page: ${error.message}`);
    }
}

function showNotice(message) {
    if (!message) return;
    const box = document.getElementById('notice');
    document.getElementById('noticeText').textContent = message;
    box.hidden = false;
    document.getElementById('dismissNotice').addEventListener('click', async () => {
        box.hidden = true;
        await clearNotice();
    });
}

function showStatus(message) {
    statusLine.textContent = message;
    statusLine.hidden = false;
}
