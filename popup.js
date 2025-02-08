document.addEventListener('DOMContentLoaded', () => {
    const templateList = document.getElementById('templateList');
    
    chrome.storage.sync.get(['templates'], result => {
      const templates = result.templates || [];
      templateList.innerHTML = templates.map((template, index) => `
        <div class="template-item" data-index="${index}">
          <strong>${template.name}</strong>
          <div class="template-preview">${template.url.replace('{url}', '[URL]')}</div>
        </div>
      `).join('');
  
      templateList.addEventListener('click', e => {
        const item = e.target.closest('.template-item');
        if (!item) return;
        
        const index = parseInt(item.dataset.index);
        chrome.tabs.query({active: true, currentWindow: true}, tabs => {
          chrome.runtime.sendMessage({
            action: 'useTemplate',
            index: index,
            url: tabs[0].url
          });
        });
      });
    });
  });