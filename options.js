document.addEventListener('DOMContentLoaded', initOptions);

function initOptions() {
  const container = document.getElementById('templatesContainer');
  const addBtn = document.getElementById('addTemplate');
  const saveBtn = document.getElementById('saveTemplates');
  let templates = [];

  loadTemplates();

  addBtn.addEventListener('click', addNewTemplate);
  saveBtn.addEventListener('click', saveAllTemplates);

  function loadTemplates() {
    chrome.storage.sync.get(['templates'], result => {
      templates = result.templates || [];
      renderTemplates();
    });
  }

  function renderTemplates() {
    container.innerHTML = '';
    templates.forEach((template, index) => {
      const div = document.createElement('div');
      div.className = 'template';
      
      const nameInput = createInput('text', template.name, 'Template Name');
      const urlInput = createInput('text', template.url, 'URL Pattern');
      const removeBtn = createRemoveButton(index);
      
      nameInput.addEventListener('input', e => updateTemplate(index, 'name', e.target.value));
      urlInput.addEventListener('input', e => updateTemplate(index, 'url', e.target.value));
      
      div.append(nameInput, urlInput, removeBtn);
      container.appendChild(div);
    });
  }

  function createInput(type, value, placeholder) {
    const input = document.createElement('input');
    input.type = type;
    input.value = value;
    input.placeholder = placeholder;
    return input;
  }

  function createRemoveButton(index) {
    const button = document.createElement('button');
    button.textContent = 'Remove';
    button.addEventListener('click', () => removeTemplate(index));
    return button;
  }

  function addNewTemplate() {
    templates.push({
      name: `Example Template ${templates.length + 1}`,
      url: 'https://example.com/?url={url}'
    });
    renderTemplates();
  }

  function removeTemplate(index) {
    templates.splice(index, 1);
    renderTemplates();
  }

  function updateTemplate(index, field, value) {
    templates[index][field] = value;
  }

  function saveAllTemplates() {
    const invalid = templates.some(t => !t.url.includes('{url}'));
    if (invalid) return alert('All templates must contain {url} placeholder');
    
    chrome.storage.sync.set({ templates }, () => {
      chrome.runtime.sendMessage({ action: 'updateTemplates' });
      alert('Templates saved successfully!');
    });
  }
}