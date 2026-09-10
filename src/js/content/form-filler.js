// Registered by the service worker while a form template runs (lib/runner.js).
// On pages of the template's site it asks whether this tab is waiting to be
// filled; if so, it fills the field, ends the job and submits the form.
(async () => {
  if (globalThis.quickRouteFillerStarted) return;
  globalThis.quickRouteFillerStarted = true;

  const FIELD_WAIT_MS = 10000;
  const TEXT_TYPES = new Set(['text', 'search', 'url', 'email', 'tel', 'number']);
  const GUESS_TYPES = new Set(['text', 'search', 'url']);
  const URL_WORDS = /\b(url|uri|link|href|address|endereco|site|website|doi|isbn|pmid)\b/;
  const SEARCH_WORDS = /\b(q|query|search|busca|buscar|pesquisa|pesquisar|procurar|find|keywords?|terms?|req|request|lookup)\b/;
  const AVOID_WORDS = /\b(user|username|login|email|mail|password|senha|name|nome|phone|telefone|cpf|comment|comentario|message|mensagem|subject|assunto|coupon|cupom)\b/;

  const job = await chrome.runtime.sendMessage({ type: 'form-job:ready' }).catch(() => null);
  if (!job) return;

  const field = await waitFor(() => (job.selector ? (fieldBySelector(job.selector) || guessField(job.value)) : guessField(job.value)), FIELD_WAIT_MS, 250);
  if (!field) {
    showToast(
      `QuickRoute could not find the field for "${job.name}".`,
      'If the site is showing a check or CAPTCHA, complete it and QuickRoute will try again on the next page.',
    );
    return;
  }

  setFieldValue(field, job.value);
  const reply = await chrome.runtime.sendMessage({ type: 'form-job:filled' }).catch(() => null);
  if (reply?.submit) await submitFrom(field);
  else showToast(`QuickRoute filled the field for "${job.name}".`, 'Check it and send the form when you are ready.');

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

  function fieldBySelector(selector) {
    if (!selector) return null;
    let node;
    try {
      node = document.querySelector(selector);
    } catch {
      node = null;
    }
    if (!node) {
      try {
        node = document.querySelector(`[name="${CSS.escape(selector)}"]`) ||
               document.querySelector(`[id="${CSS.escape(selector)}"]`) ||
               document.getElementById(selector);
      } catch {}
    }
    if (node && !isTextField(node)) node = node.querySelector('input, textarea');
    return node && isTextField(node) && isUsable(node) ? node : null;
  }

  // Without a selector, pick the most likely text box: focused, typed as
  // url/search, or labeled like one; login/contact fields are avoided.
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

  function isTextField(node) {
    return node instanceof HTMLTextAreaElement || (node instanceof HTMLInputElement && TEXT_TYPES.has(node.type));
  }

  function isUsable(node) {
    if (node.disabled || node.readOnly) return false;
    const { width, height } = node.getBoundingClientRect();
    return width > 0 && height > 0 && getComputedStyle(node).visibility !== 'hidden';
  }

  function setFieldValue(node, value) {
    node.focus();
    const prototype = node instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    // The native setter bypasses the value trackers of frameworks such as
    // React, so the input event below is seen as a real change.
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(node, value);
    node.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertFromPaste' }));
    node.dispatchEvent(new Event('change', { bubbles: true }));
  }

  async function submitFrom(node) {
    const form = node.form;
    if (!form) {
      pressEnter(node);
      return;
    }
    const submitButtons = Array.from(form.elements).filter((element) => element.type === 'submit');
    const button = submitButtons.find((element) => element.getBoundingClientRect().width > 0) ?? submitButtons[0];
    if (button) {
      // Sites often enable the button only after reacting to the input.
      await waitFor(() => !button.disabled, 1500, 50);
      if (!button.disabled) {
        button.click();
        return;
      }
    }
    form.requestSubmit();
  }

  function pressEnter(node) {
    for (const type of ['keydown', 'keypress', 'keyup']) {
      node.dispatchEvent(new KeyboardEvent(type, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
    }
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
})();
