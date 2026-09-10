import {
  PRESETS,
  SHORTCUT_COUNT,
  createTemplate,
  expandAddresses,
  getShortcuts,
  hostPermissionPatterns,
  loadTemplates,
  saveTemplates,
  validateTemplate,
} from './lib/templates.js';

const PICKER_FILE = 'src/js/content/field-picker.js';
const URL_HINT =
  'Put {url} where the page address, link or selected text goes. Extra lines are alternative addresses: QuickRoute ' +
  'opens the first one that responds. A line with only a domain (like example.net) reuses the first line on that domain.';
const FORM_HINT =
  'The page that has the field. Extra lines are alternative addresses (mirrors): QuickRoute opens the first one that responds.';

const container = document.getElementById('templatesContainer');
const emptyState = document.getElementById('emptyState');
const statusLine = document.getElementById('status');
const presetSelect = document.getElementById('presetSelect');

let templates = [];
let shortcuts = [];
let hasUnsavedChanges = false;
let pendingPick = null;
let draftQueue = Promise.resolve();

document.getElementById('addTemplate').addEventListener('click', () => addTemplate(createTemplate()));
document.getElementById('saveTemplates').addEventListener('click', saveAllTemplates);
document.getElementById('shortcutsLink').addEventListener('click', (event) => {
  event.preventDefault();
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
});

PRESETS.forEach((preset, index) => presetSelect.append(new Option(preset.name, String(index))));
presetSelect.addEventListener('change', () => {
  if (presetSelect.value === '') return;
  const preset = PRESETS[Number(presetSelect.value)];
  presetSelect.value = '';
  addTemplate(createTemplate(structuredClone(preset)));
});

window.addEventListener('beforeunload', (e) => {
  if (hasUnsavedChanges) {
    e.preventDefault();
    e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
    return e.returnValue;
  }
});

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type === 'field-picked' && message.requestId && message.requestId === pendingPick?.requestId) {
    applyPickedField(message.field, sender.tab);
  }
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'session' && changes.draftTemplate?.newValue) takeDraft();
});

[templates, shortcuts] = await Promise.all([loadTemplates(), getShortcuts()]);
render();
takeDraft();

function render() {
  container.replaceChildren(...templates.map(renderTemplate));
  emptyState.hidden = templates.length > 0;
}

function renderTemplate(template, index) {
  const header = h('div', { className: 'template-header' });
  if (index < SHORTCUT_COUNT) {
    header.append(h('span', { className: 'shortcut-badge', textContent: shortcuts[index] || 'No shortcut set' }));
  }
  header.append(
    h('span', { className: 'spacer' }),
    h('button', { type: 'button', className: 'small', textContent: '↑', ariaLabel: 'Move up', disabled: index === 0, onclick: () => moveTemplate(index, -1) }),
    h('button', { type: 'button', className: 'small', textContent: '↓', ariaLabel: 'Move down', disabled: index === templates.length - 1, onclick: () => moveTemplate(index, 1) }),
    h('button', { type: 'button', className: 'small', textContent: 'Remove', onclick: () => removeTemplate(index) }),
  );

  const card = h(
    'section',
    { className: 'template' },
    header,
    h('input', {
      type: 'text',
      value: template.name,
      placeholder: 'Template name',
      ariaLabel: 'Template name',
      oninput: (event) => update(template, { name: event.target.value }),
    }),
    h(
      'div',
      { className: 'type-toggle', role: 'radiogroup', ariaLabel: 'What the template does' },
      typeOption(template, 'url', 'Open a URL'),
      typeOption(template, 'form', 'Fill a field on a site'),
    ),
    h('textarea', {
      rows: Math.min(Math.max(template.urls.length + 1, 2), 8),
      value: template.urls.join('\n'),
      placeholder: template.type === 'url' ? 'https://example.com/search?q={url}\nexample.net' : 'https://example.com/\nhttps://example.net/',
      ariaLabel: 'Addresses, one per line',
      spellcheck: false,
      oninput: (event) => update(template, { urls: event.target.value.split('\n').map((line) => line.trim()).filter(Boolean) }),
      onchange: () => showAccess(template, card),
    }),
    h('p', { className: 'hint', textContent: template.type === 'url' ? URL_HINT : FORM_HINT }),
  );

  if (template.type === 'form') {
    card.append(
      h(
        'div',
        { className: 'row' },
        h('input', {
          type: 'text',
          value: template.selector,
          placeholder: 'Field: found automatically',
          ariaLabel: 'Field to fill (CSS selector)',
          spellcheck: false,
          oninput: (event) => update(template, { selector: event.target.value.trim() }),
        }),
        h('button', { type: 'button', className: 'secondary', textContent: 'Pick on site', onclick: () => pickField(template) }),
      ),
      h('p', {
        className: 'hint',
        textContent: 'Leave the field empty to let QuickRoute find the main text box, or click "Pick on site" and point at it.',
      }),
      h(
        'label',
        { className: 'checkbox' },
        h('input', { type: 'checkbox', checked: template.submit, onchange: (event) => update(template, { submit: event.target.checked }) }),
        'Submit the form after filling it',
      ),
      h('p', { className: 'access' }),
    );
    showAccess(template, card);
  }
  card.append(h('ul', { className: 'problems', hidden: true }));
  return card;
}

function typeOption(template, type, label) {
  return h(
    'label',
    { className: 'radio' },
    h('input', {
      type: 'radio',
      name: `type-${template.id}`,
      checked: template.type === type,
      onchange: () => {
        update(template, { type });
        render();
      },
    }),
    label,
  );
}

async function showAccess(template, card) {
  const line = card.querySelector('.access');
  if (!line) return;
  const origins = hostPermissionPatterns(expandAddresses(template));
  if (!origins.length) {
    line.textContent = '';
    return;
  }
  const granted = await chrome.permissions.contains({ origins });
  line.textContent = granted ? 'QuickRoute can fill this site.' : 'QuickRoute will ask for access to this site when you save.';
  line.classList.toggle('warn', !granted);
}

function update(template, changes) {
  Object.assign(template, changes);
  hasUnsavedChanges = true;
}

function addTemplate(template) {
  templates.push(template);
  hasUnsavedChanges = true;
  render();
  const card = container.lastElementChild;
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  card.querySelector('input[type="text"]').focus({ preventScroll: true });
}

function moveTemplate(index, offset) {
  const [template] = templates.splice(index, 1);
  templates.splice(index + offset, 0, template);
  hasUnsavedChanges = true;
  render();
}

function removeTemplate(index) {
  templates.splice(index, 1);
  hasUnsavedChanges = true;
  render();
}

async function saveAllTemplates() {
  let firstInvalid = null;
  templates.forEach((template, index) => {
    const problems = validateTemplate(template);
    if (template.type === 'form' && template.selector && !isValidSelector(template.selector)) {
      problems.push('The field is not a valid CSS selector.');
    }
    const card = container.children[index];
    const list = card.querySelector('.problems');
    list.replaceChildren(...problems.map((problem) => h('li', { textContent: problem })));
    list.hidden = problems.length === 0;
    if (problems.length && !firstInvalid) firstInvalid = card;
  });
  if (firstInvalid) {
    firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setStatus('Some templates need attention before saving.', 'error');
    return;
  }

  // Asked right away, while the click still counts as a user gesture.
  const origins = hostPermissionPatterns(templates.filter(({ type }) => type === 'form').flatMap(expandAddresses));
  const accessGranted = origins.length ? await chrome.permissions.request({ origins }).catch(() => false) : true;

  try {
    await saveTemplates(templates);
  } catch (error) {
    setStatus(`Could not save: ${error.message}`, 'error');
    return;
  }
  hasUnsavedChanges = false;
  await removeUnusedAccess(origins);
  render();
  if (accessGranted) setStatus('Templates saved.', 'ok');
  else setStatus('Templates saved, but site access was not granted: form templates will open the site without filling it.', 'warn');
}

async function removeUnusedAccess(neededOrigins) {
  const { origins = [] } = await chrome.permissions.getAll();
  // Only the per-site patterns QuickRoute asks for; broader access the user
  // granted in Chrome's extension settings is left alone.
  const unused = origins.filter((origin) => /^\*:\/\/(\*\.)?[^*/]+\/\*$/.test(origin) && !neededOrigins.includes(origin));
  if (unused.length) await chrome.permissions.remove({ origins: unused }).catch(() => { });
}

async function pickField(template) {
  const [address] = expandAddresses(template);
  if (!address) {
    setStatus('Add the site address to the template first.', 'error');
    return;
  }
  const granted = await chrome.permissions.request({ origins: hostPermissionPatterns([address]) }).catch(() => false);
  if (!granted) {
    setStatus('QuickRoute needs access to the site to let you pick a field.', 'error');
    return;
  }
  const requestId = crypto.randomUUID();
  pendingPick = { requestId, templateId: template.id };
  setStatus(`Opening ${address}: click the field QuickRoute should fill.`, 'ok');
  const tab = await chrome.tabs.create({ url: address });
  try {
    await waitForTabComplete(tab.id);
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: [PICKER_FILE] });
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (id) => globalThis.quickRoutePicker.start({ purpose: 'edit', requestId: id }),
      args: [requestId],
    });
  } catch (error) {
    setStatus(`Could not open the field picker on that page: ${error.message}`, 'error');
  }
}

async function applyPickedField(field, pickerTab) {
  const template = templates.find(({ id }) => id === pendingPick.templateId);
  pendingPick = null;
  if (template) {
    update(template, { selector: field.selector });
    render();
    setStatus(`Field selected: ${field.selector}. Save to keep it.`, 'ok');
  }
  if (pickerTab) await chrome.tabs.remove(pickerTab.id).catch(() => { });
  const current = await chrome.tabs.getCurrent();
  if (current) {
    await chrome.tabs.update(current.id, { active: true });
    await chrome.windows.update(current.windowId, { focused: true });
  }
}

function waitForTabComplete(tabId) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => finish(new Error('the page took too long to load')), 30000);
    const onUpdated = (id, change) => {
      if (id === tabId && change.status === 'complete') finish();
    };
    const onRemoved = (id) => {
      if (id === tabId) finish(new Error('the tab was closed'));
    };
    function finish(error) {
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.tabs.onRemoved.removeListener(onRemoved);
      if (error) reject(error);
      else resolve();
    }
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.onRemoved.addListener(onRemoved);
  });
}

// A field picked on a page (popup or context menu) arrives as a draft to review.
function takeDraft() {
  draftQueue = draftQueue.then(async () => {
    const { draftTemplate } = await chrome.storage.session.get('draftTemplate');
    if (!draftTemplate) return;
    await chrome.storage.session.remove('draftTemplate');
    addTemplate(createTemplate(draftTemplate));
    setStatus('New template created from the field you picked. Check it and save.', 'ok');
  });
  return draftQueue;
}

function setStatus(message, kind) {
  statusLine.textContent = message;
  statusLine.className = `status ${kind}`;
}

function isValidSelector(selector) {
  try {
    document.createDocumentFragment().querySelector(selector);
    return true;
  } catch {
    return false;
  }
}

function h(tag, properties = {}, ...children) {
  const element = Object.assign(document.createElement(tag), properties);
  element.append(...children);
  return element;
}
