// Runs templates for the service worker.
//
// URL templates open a tab with the expanded URL.
// Form templates open the site, wait for page load, and inject the form filler
// directly via chrome.scripting.executeScript to fill the field and submit.

import { buildUrl, displayName, expandAddresses, hostPermissionPatterns } from './templates.js';
import { clearNotice, notify } from './notice.js';

const PICKER_FILE = 'src/js/content/field-picker.js';
const PROBE_TIMEOUT_MS = 4000;
const PREFERENCE_WAIT_MS = 1500;

export async function runTemplate(template, input, sourceTab) {
  const name = displayName(template);
  const addresses = expandAddresses(template);
  if (!addresses.length) return notify(`"${name}" has no address yet. Add one in the options.`);
  if (!input) return notify(`There is nothing on this page to send to "${name}".`);

  const address = await firstReachable(addresses);
  if (template.type !== 'form') {
    await openTab(buildUrl(address, input), sourceTab);
    return;
  }

  const origins = hostPermissionPatterns(addresses);
  const granted = await chrome.permissions.contains({ origins }).catch(() => false);
  if (!granted) {
    await openTab(address, sourceTab);
    return notify(`"${name}" cannot fill the site: access was not granted. Open the options and save the template to allow it.`);
  }

  const tab = await openTab(address, sourceTab);
  if (!tab?.id) return;

  await executeFormFill(tab.id, {
    selector: template.selector,
    value: input,
    submit: template.submit,
    name,
  });
}

async function executeFormFill(tabId, job) {
  await waitForTabComplete(tabId, 20000);
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: runFormFillerInPage,
      args: [job],
    });
    await clearNotice();
  } catch (error) {
    console.error('QuickRoute executeFormFill error:', error);
    await notify(`"${job.name}": could not fill the form (${error.message})`);
  }
}

function waitForTabComplete(tabId, timeoutMs = 20000) {
  return new Promise((resolve) => {
    let resolved = false;
    const cleanup = () => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(onUpdated);
    };
    const timer = setTimeout(() => {
      cleanup();
      resolve(false);
    }, timeoutMs);

    function onUpdated(updatedTabId, changeInfo) {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        cleanup();
        resolve(true);
      }
    }
    chrome.tabs.onUpdated.addListener(onUpdated);

    chrome.tabs.get(tabId).then((tab) => {
      if (tab?.status === 'complete') {
        cleanup();
        resolve(true);
      }
    }).catch(() => {});
  });
}

async function runFormFillerInPage(job) {
  const TEXT_TYPES = new Set(['text', 'search', 'url', 'email', 'tel', 'number']);
  const GUESS_TYPES = new Set(['text', 'search', 'url']);
  const URL_WORDS = /\b(url|uri|link|href|address|endereco|site|website|doi|isbn|pmid)\b/;
  const SEARCH_WORDS = /\b(q|query|search|busca|buscar|pesquisa|pesquisar|procurar|find|keywords?|terms?|req|request|lookup)\b/;
  const AVOID_WORDS = /\b(user|username|login|email|mail|password|senha|name|nome|phone|telefone|cpf|comment|comentario|message|mensagem|subject|assunto|coupon|cupom)\b/;

  function isTextField(node) {
    return node instanceof HTMLTextAreaElement || (node instanceof HTMLInputElement && TEXT_TYPES.has(node.type));
  }

  function isUsable(node) {
    if (!node || node.disabled || node.readOnly) return false;
    const { width, height } = node.getBoundingClientRect();
    return width > 0 && height > 0 && getComputedStyle(node).visibility !== 'hidden';
  }

  function fieldBySelector(selector) {
    if (!selector) return null;
    let node = null;
    try {
      node = document.querySelector(selector);
    } catch {}
    if (!node) {
      try {
        node = document.querySelector(`[name="${CSS.escape(selector)}"]`) ||
               document.querySelector(`[id="${CSS.escape(selector)}"]`) ||
               document.getElementById(selector);
      } catch {}
    }
    if (node && !isTextField(node)) {
      node = node.querySelector('input, textarea');
    }
    return node && isTextField(node) && isUsable(node) ? node : null;
  }

  function guessField(value) {
    const valueIsUrl = /^https?:\/\//i.test(value);
    let best = null;
    let bestScore = 0;
    for (const node of document.querySelectorAll('input, textarea')) {
      if (!(node instanceof HTMLTextAreaElement || GUESS_TYPES.has(node.type)) || !isUsable(node)) continue;
      const score = scoreField(node, valueIsUrl);
      if (score > bestScore) {
        best = node;
        bestScore = score;
      }
    }
    return best;
  }

  function scoreField(node, valueIsUrl) {
    const words = describeField(node);
    let score = Math.min(node.getBoundingClientRect().width / 50, 10);
    if (node === document.activeElement) score += 30;
    if (node.type === 'url') score += valueIsUrl ? 40 : 10;
    if (node.type === 'search') score += valueIsUrl ? 15 : 30;
    if (URL_WORDS.test(words)) score += valueIsUrl ? 30 : 10;
    if (SEARCH_WORDS.test(words)) score += valueIsUrl ? 10 : 25;
    if (AVOID_WORDS.test(words)) score -= 40;
    if (node.form) score += 10;
    if (node.closest('[role="search"]')) score += 10;
    return score;
  }

  function describeField(node) {
    const labels = Array.from(node.labels ?? [], (label) => label.textContent);
    return [node.name, node.id, node.placeholder, node.getAttribute('aria-label'), node.title, ...labels]
      .filter(Boolean)
      .join(' ')
      .replace(/([a-z])([A-Z0-9])/g, '$1 $2')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ');
  }

  function waitFor(find, timeoutMs, intervalMs) {
    const deadline = Date.now() + timeoutMs;
    return new Promise((resolve) => {
      (function check() {
        const found = find();
        if (found || Date.now() > deadline) resolve(found || null);
        else setTimeout(check, intervalMs);
      })();
    });
  }

  function setFieldValue(node, value) {
    node.focus();
    const prototype = node instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
    if (descriptor?.set) {
      descriptor.set.call(node, value);
    } else {
      node.value = value;
    }
    node.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertFromPaste' }));
    node.dispatchEvent(new Event('change', { bubbles: true }));
  }

  async function submitFrom(node) {
    const form = node.form;
    if (!form) {
      for (const type of ['keydown', 'keypress', 'keyup']) {
        node.dispatchEvent(new KeyboardEvent(type, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
      }
      return;
    }
    const submitButtons = Array.from(form.elements).filter((element) => element.type === 'submit');
    const button = submitButtons.find((element) => element.getBoundingClientRect().width > 0) ?? submitButtons[0];
    if (button) {
      await waitFor(() => !button.disabled, 1500, 50);
      if (!button.disabled) {
        button.click();
        return;
      }
    }
    form.requestSubmit();
  }

  function showToast(title, detail) {
    const host = document.createElement('quickroute-toast');
    const shadow = host.attachShadow({ mode: 'closed' });
    shadow.innerHTML = `<style>
        :host { all: initial; }
        div {
          position: fixed; z-index: 2147483647; right: 16px; bottom: 16px; max-width: 360px;
          padding: 12px 16px; border-left: 4px solid #D1007B; border-radius: 10px;
          background: #1a1a1a; color: #fff; box-shadow: 0 6px 24px rgba(0, 0, 0, 0.35);
          font: 14px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif;
        }
        strong { display: block; margin-bottom: 2px; }
        span { color: #ccc; font-size: 13px; }
      </style><div role="status"><strong></strong><span></span></div>`;
    shadow.querySelector('strong').textContent = title;
    shadow.querySelector('span').textContent = detail;
    document.documentElement.append(host);
    setTimeout(() => host.remove(), 8000);
  }

  const field = await waitFor(() => (job.selector ? (fieldBySelector(job.selector) || guessField(job.value)) : guessField(job.value)), 10000, 200);
  if (!field) {
    showToast(`QuickRoute could not find the field for "${job.name}".`, 'If the site is showing a check or CAPTCHA, complete it and try again.');
    return;
  }

  setFieldValue(field, job.value);
  if (job.submit) {
    await submitFrom(field);
  } else {
    showToast(`QuickRoute filled the field for "${job.name}".`, 'Check it and send the form when you are ready.');
  }
}

/** Stubs maintained for messaging backwards compatibility */
export async function claimFormJob() {
  return null;
}

export async function completeFormJob() {
  return { submit: false };
}

/** Context menu on a text field: turns the focused field into a new form template. */
export async function captureFocusedField(tab, frameId) {
  if (!tab || tab.id < 0) return notify('QuickRoute cannot read fields in this window.');
  if (frameId) return notify('Fields inside embedded frames cannot be used in templates.');
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: [PICKER_FILE] });
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => globalThis.quickRoutePicker.describeFocusedField(),
    });
    if (injection?.result) await startDraft(injection.result);
    else await notify('Right-click inside the text field you want the template to fill.');
  } catch (error) {
    await notify(`QuickRoute cannot read this page: ${error.message}`);
  }
}

/** Hands a picked field to the options page as an unsaved template. */
export async function startDraft({ selector, pageUrl }) {
  const page = new URL(pageUrl);
  await chrome.storage.session.set({
    draftTemplate: {
      name: page.hostname.replace(/^www\./, ''),
      type: 'form',
      urls: [`${page.origin}${page.pathname}${page.search}`],
      selector,
      submit: true,
    },
  });
  await chrome.runtime.openOptionsPage();
}

function firstReachable(addresses) {
  if (addresses.length === 1) return Promise.resolve(addresses[0]);
  const controller = new AbortController();
  const outcomes = addresses.map(() => undefined);
  let preferenceExpired = false;
  let done = false;
  return new Promise((resolve) => {
    const timers = [
      setTimeout(() => {
        preferenceExpired = true;
        decide();
      }, PREFERENCE_WAIT_MS),
      setTimeout(() => finish(addresses[0]), PROBE_TIMEOUT_MS),
    ];
    function finish(address) {
      if (done) return;
      done = true;
      timers.forEach(clearTimeout);
      controller.abort();
      resolve(address);
    }
    function decide() {
      for (const [index, outcome] of outcomes.entries()) {
        if (outcome === true) return finish(addresses[index]);
        if (outcome === undefined && !preferenceExpired) return;
      }
      if (outcomes.every((outcome) => outcome === false)) finish(addresses[0]);
    }
    addresses.forEach((address, index) => {
      isReachable(address, controller.signal).then((reachable) => {
        outcomes[index] = reachable;
        decide();
      });
    });
  });
}

async function isReachable(address, signal) {
  try {
    const { origin } = new URL(address.replaceAll('{url}', ''));
    await fetch(`${origin}/`, { method: 'HEAD', mode: 'no-cors', credentials: 'omit', cache: 'no-store', signal });
    return true;
  } catch {
    return false;
  }
}

async function openTab(url, sourceTab) {
  if (Number.isInteger(sourceTab?.index) && sourceTab.id >= 0) {
    try {
      return await chrome.tabs.create({ url, index: sourceTab.index + 1, openerTabId: sourceTab.id, windowId: sourceTab.windowId });
    } catch {
      // The source tab may live in a window that cannot hold more tabs (e.g. a popup window).
    }
  }
  return chrome.tabs.create({ url });
}
