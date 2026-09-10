// Injected on demand from the popup, the context menu or the options page.
// Lets the user point at the text field a form template should fill and
// describes it with a CSS selector that is unlikely to change between visits.
(() => {
  if (globalThis.quickRoutePicker) return;

  const TEXT_TYPES = new Set(['text', 'search', 'url', 'email', 'tel', 'number']);
  let stopPicking = null;

  globalThis.quickRoutePicker = {
    start,
    describeFocusedField() {
      const node = document.activeElement;
      return isTextField(node) ? describe(node) : null;
    },
  };

  function start({ purpose, requestId = null }) {
    stopPicking?.();

    const host = document.createElement('quickroute-picker');
    const shadow = host.attachShadow({ mode: 'closed' });
    shadow.innerHTML = `<style>
        :host { all: initial; }
        .bar {
          position: fixed; z-index: 2147483647; top: 16px; left: 50%; transform: translateX(-50%);
          display: flex; align-items: center; gap: 12px; max-width: calc(100vw - 48px);
          padding: 10px 14px; border-left: 4px solid #D1007B; border-radius: 10px;
          background: #1a1a1a; color: #fff; box-shadow: 0 6px 24px rgba(0, 0, 0, 0.35);
          font: 14px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif;
        }
        button {
          font: inherit; color: #fff; background: transparent; cursor: pointer;
          border: 1px solid #777; border-radius: 6px; padding: 3px 10px;
        }
        .box {
          position: fixed; z-index: 2147483646; pointer-events: none;
          border: 2px solid #D1007B; border-radius: 6px; background: rgba(209, 0, 123, 0.12);
        }
        .box[hidden] { display: none; }
      </style>
      <div class="box" hidden></div>
      <div class="bar">
        <span class="text">QuickRoute: click the text field that should receive the page address or selected text.</span>
        <button type="button">Cancel</button>
      </div>`;
    const box = shadow.querySelector('.box');
    const text = shadow.querySelector('.text');

    const isOwnEvent = (event) => event.composedPath().includes(host);
    const swallow = (event) => {
      if (isOwnEvent(event)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    const onMove = (event) => {
      if (isOwnEvent(event)) return;
      const field = fieldFor(event.target);
      box.hidden = !field;
      if (!field) return;
      const rect = field.getBoundingClientRect();
      Object.assign(box.style, {
        left: `${rect.left - 4}px`,
        top: `${rect.top - 4}px`,
        width: `${rect.width + 8}px`,
        height: `${rect.height + 8}px`,
      });
    };
    const onClick = (event) => {
      if (isOwnEvent(event)) return;
      swallow(event);
      const field = fieldFor(event.target);
      if (!field) {
        text.textContent = 'That is not a text field. Click the box where you would type the address or search.';
        return;
      }
      chrome.runtime.sendMessage({ type: 'field-picked', purpose, requestId, field: describe(field) }).catch(() => {});
      text.textContent = 'Field selected';
      box.hidden = true;
      setTimeout(stop, 1200);
    };
    const onKey = (event) => {
      if (event.key !== 'Escape') return;
      swallow(event);
      stop();
    };
    const listeners = [
      ['mousemove', onMove],
      ['pointerdown', swallow],
      ['mousedown', swallow],
      ['mouseup', swallow],
      ['click', onClick],
      ['keydown', onKey],
    ];

    function stop() {
      for (const [type, listener] of listeners) window.removeEventListener(type, listener, true);
      host.remove();
      if (stopPicking === stop) stopPicking = null;
    }

    shadow.querySelector('button').addEventListener('click', stop);
    for (const [type, listener] of listeners) window.addEventListener(type, listener, true);
    document.documentElement.append(host);
    stopPicking = stop;
  }

  function isTextField(node) {
    return node instanceof HTMLTextAreaElement || (node instanceof HTMLInputElement && TEXT_TYPES.has(node.type));
  }

  function fieldFor(target) {
    if (target instanceof HTMLLabelElement) return isTextField(target.control) ? target.control : null;
    return isTextField(target) ? target : null;
  }

  function describe(field) {
    return { selector: selectorFor(field), pageUrl: location.href };
  }

  function selectorFor(field) {
    const tag = field.localName;
    const candidates = [];
    if (field.id && !looksGenerated(field.id)) candidates.push(`#${CSS.escape(field.id)}`);
    const name = field.getAttribute('name');
    if (name) {
      candidates.push(`${tag}[name=${quote(name)}]`);
      if (field.form?.id) candidates.push(`#${CSS.escape(field.form.id)} ${tag}[name=${quote(name)}]`);
    }
    for (const attribute of ['aria-label', 'placeholder', 'title']) {
      const value = field.getAttribute(attribute);
      if (value) candidates.push(`${tag}[${attribute}=${quote(value)}]`);
    }
    return candidates.find((selector) => selectsOnly(selector, field)) ?? pathTo(field);
  }

  function pathTo(field) {
    const steps = [];
    for (let node = field; node && node !== document.documentElement; node = node.parentElement) {
      if (node !== field && node.id && !looksGenerated(node.id) && selectsOnly(`#${CSS.escape(node.id)}`, node)) {
        steps.unshift(`#${CSS.escape(node.id)}`);
        break;
      }
      const sameTag = Array.from(node.parentElement?.children ?? []).filter((sibling) => sibling.localName === node.localName);
      steps.unshift(sameTag.length > 1 ? `${node.localName}:nth-of-type(${sameTag.indexOf(node) + 1})` : node.localName);
    }
    return steps.join(' > ');
  }

  function selectsOnly(selector, node) {
    try {
      const matches = document.querySelectorAll(selector);
      return matches.length === 1 && matches[0] === node;
    } catch {
      return false;
    }
  }

  // Ids such as "input-48213" or React's ":r3:" change between visits.
  function looksGenerated(id) {
    return /\d{3,}|[:{}]/.test(id);
  }

  function quote(value) {
    return `"${value.replace(/["\\]/g, '\\$&').replace(/\n/g, '\\a ')}"`;
  }
})();
