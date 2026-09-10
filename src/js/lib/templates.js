// Template storage and address helpers shared by the service worker, the popup
// and the options page.
//
// A template is { id, name, type, urls, selector, submit }:
// - type "url":  urls[0] is a pattern with {url}; the other lines are
//                alternative addresses (full patterns or just a domain).
// - type "form": urls are pages that have a text field; QuickRoute opens the
//                first one that responds, fills `selector` (or the field it
//                finds) and submits the form when `submit` is true.

export const SHORTCUT_COUNT = 4;

export const PRESETS = [
  {
    name: 'Archive.today (save page)',
    type: 'form',
    urls: [
      'https://archive.ph/',
      'https://archive.is/',
      'https://archive.li/',
      'https://archive.vn/',
      'https://archive.md/',
      'https://archive.fo/',
    ],
    selector: '#url',
    submit: true,
  },
  { name: 'Wayback Machine (snapshots)', type: 'url', urls: ['https://web.archive.org/web/{url}'] },
];

const SCHEME = /^[a-z][a-z\d+.-]*:\/\//i;
const ORIGIN = /^[a-z][a-z\d+.-]*:\/\/[^/?#]*/i;

export async function loadTemplates() {
  const { templates } = await chrome.storage.sync.get('templates');
  return normalizeTemplates(templates);
}

export async function saveTemplates(templates) {
  await chrome.storage.sync.set({ templates: templates.map(serializeTemplate) });
}

export function createTemplate(fields = {}) {
  return normalizeTemplate({ ...fields, id: crypto.randomUUID() });
}

export function displayName(template) {
  return template.name.trim() || 'Untitled template';
}

function normalizeTemplates(stored) {
  if (!Array.isArray(stored)) return [];
  const ids = new Set();
  return stored
    .filter((raw) => raw && typeof raw === 'object')
    .map((raw, index) => {
      const template = normalizeTemplate(raw, index);
      if (ids.has(template.id)) template.id = `${template.id}-${index}`;
      ids.add(template.id);
      return template;
    });
}

// Templates saved by version 1.0 look like { name, url }. Their fallback id is
// stable across loads, so menu ids keep working until the next save stores it.
function normalizeTemplate(raw, index = 0) {
  const urls = Array.isArray(raw.urls) ? raw.urls : [raw.url];
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : `legacy-${index}`,
    name: typeof raw.name === 'string' ? raw.name : '',
    type: raw.type === 'form' ? 'form' : 'url',
    urls: urls.filter((url) => typeof url === 'string').map((url) => url.trim()).filter(Boolean),
    selector: typeof raw.selector === 'string' ? raw.selector.trim() : '',
    submit: raw.submit !== false,
  };
}

function serializeTemplate({ id, name, type, urls, selector, submit }) {
  const stored = { id, name: name.trim(), type, urls };
  return type === 'form' ? { ...stored, selector, submit } : stored;
}

export function validateTemplate(template) {
  const problems = [];
  if (!template.name.trim()) problems.push('Give the template a name.');
  if (!template.urls.length) {
    problems.push('Add at least one address.');
    return problems;
  }
  if (template.type === 'url') {
    if (!template.urls[0].includes('{url}')) problems.push('The first address must contain {url}.');
    const invalid = template.urls.slice(1).find((line) => !line.includes('{url}') && !originOf(line, 'https://'));
    if (invalid) problems.push(`"${invalid}" is not a valid address.`);
  } else {
    const invalid = template.urls.find((line) => !toHttpUrl(line));
    if (invalid) problems.push(`"${invalid}" is not a valid web address.`);
  }
  return problems;
}

/** The template's addresses in order of preference, ready to open (URL patterns keep {url}). */
export function expandAddresses(template) {
  if (template.type === 'form') return template.urls.map(toHttpUrl).filter(Boolean);

  const [first, ...alternatives] = template.urls;
  if (!first) return [];
  const primary = SCHEME.test(first) || /^mailto:/i.test(first) ? first : `https://${first}`;
  const scheme = SCHEME.exec(primary)?.[0] ?? 'https://';
  const addresses = [primary];
  for (const line of alternatives) {
    if (line.includes('{url}')) {
      addresses.push(SCHEME.test(line) ? line : `${scheme}${line}`);
    } else {
      // Just a domain: same pattern as the first line, on that domain.
      const origin = originOf(line, scheme);
      if (origin) addresses.push(primary.replace(ORIGIN, origin));
    }
  }
  return [...new Set(addresses)];
}

export function buildUrl(pattern, value) {
  return pattern.replaceAll('{url}', encodeURIComponent(value));
}

/** Match patterns for the sites of the given addresses, covering subdomains and http/https. */
export function hostPermissionPatterns(addresses) {
  const patterns = new Set();
  for (const address of addresses) {
    let hostname;
    try {
      ({ hostname } = new URL(address.replaceAll('{url}', '')));
    } catch {
      continue;
    }
    const plainHost = !hostname.includes('.') || /^[\d.]+$/.test(hostname) || hostname.startsWith('[');
    patterns.add(`*://${plainHost ? hostname : `*.${hostname.replace(/^www\./, '')}`}/*`);
  }
  return [...patterns];
}

/** Keyboard shortcuts currently assigned to the first templates (defaults to Ctrl/Command+Shift+1..4). */
export async function getShortcuts() {
  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/i.test(navigator.platform || '');
  const shortcuts = [1, 2, 3, 4].map((n) => isMac ? `Command+Shift+${n}` : `Ctrl+Shift+${n}`);
  try {
    const commands = await chrome.commands.getAll();
    for (const { name, shortcut } of commands) {
      const match = /^open_template_(\d+)$/.exec(name ?? '');
      if (match) {
        const idx = Number(match[1]) - 1;
        if (shortcut) shortcuts[idx] = shortcut;
      }
    }
  } catch {
    // Return fallback defaults if commands API is unavailable
  }
  return shortcuts;
}

function originOf(line, defaultScheme) {
  try {
    const { origin, protocol } = new URL(SCHEME.test(line) ? line : `${defaultScheme}${line}`);
    return /^https?:$/.test(protocol) ? origin : '';
  } catch {
    return '';
  }
}

function toHttpUrl(line) {
  return originOf(line, 'https://') ? new URL(SCHEME.test(line) ? line : `https://${line}`).href : '';
}
