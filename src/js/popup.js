document.addEventListener('DOMContentLoaded', () => {
    const templateList = document.getElementById('templateList');
    const configureButton = document.getElementById('configureButton');

    chrome.storage.sync.get(['templates'], result => {
        const templates = result.templates || [];
        templateList.innerHTML = templates.map((template, index) => `
            <div class="template-item" data-index="${index}">
                ${index < 4 ? `<span class="shortcut-badge">Ctrl+Shift+${index + 1}</span>` : ''}
                <strong>${template.name}</strong>
                <div class="template-preview">${template.url.replace('{url}', '[URL]')}</div>
            </div>
        `).join('');

        const templateItems = document.querySelectorAll('.template-item');
        templateItems.forEach(item => {
            item.addEventListener('click', async () => {
                const index = parseInt(item.dataset.index);
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tab) {
                    chrome.runtime.sendMessage({
                        action: 'processTemplate',
                        index: index,
                        url: tab.url
                    });
                    window.close();
                }
            });
        });
    });

    configureButton.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });
});
