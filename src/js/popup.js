document.addEventListener('DOMContentLoaded', () => {
    const templateList = document.getElementById('templateList');
    const configureButton = document.getElementById('configureButton');

    // Load templates
    chrome.storage.sync.get(['templates'], result => {
        const templates = result.templates || [];
        templateList.innerHTML = templates.map((template, index) => `
            <div class="template-item" data-index="${index}">
                ${index < 4 ? `<span class="shortcut-badge">Ctrl+Shift+${index + 1}</span>` : ''}
                <strong>${template.name}</strong>
                <div class="template-preview">${template.url.replace('{url}', '[URL]')}</div>
            </div>
        `).join('');
    });

    configureButton.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });
});
