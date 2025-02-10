document.addEventListener('DOMContentLoaded', () => {
    const templateList = document.getElementById('templateList');
    const configureButton = document.getElementById('configureButton');

    // Load templates
    chrome.storage.sync.get(['templates'], result => {
        const templates = result.templates || [];
        templateList.innerHTML = templates.map((template, index) => `
        <div class="template-item" data-index="${index}" style="
            padding: 12px;
            margin: 8px 0;
            background: #f5f5f5;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            min-width: 300px;
            max-width: 600px;
            width: 90vw;
            box-sizing: border-box;
            position: relative;
        ">
            ${index < 4 ? `<span style="
                position: absolute;
                right: 8px;
                top: 8px;
                background: #6A0DAD;
                color: white;
                padding: 2px 6px;
                border-radius: 4px;
                font-size: 11px;
            ">Ctrl+Shift+${index + 1}</span>` : ''}
            <strong style="
                display: block;
                margin-bottom: 6px;
                color: #333;
                font-size: 14px;
            ">${template.name}</strong>
            <div class="template-preview" style="
                color: #666;
                font-size: 12px;
                word-break: break-all;
                overflow-wrap: break-word;
                padding-right: ${index < 4 ? '70px' : '0'};
            ">${template.url.replace('{url}', '[URL]')}</div>
        </div>
        `).join('');

        const items = document.querySelectorAll('.template-item');
        items.forEach(item => {
            item.addEventListener('mouseover', () => {
                item.style.backgroundColor = '#e9e9e9';
                item.style.transform = 'translateY(-1px)';
            });
            item.addEventListener('mouseout', () => {
                item.style.backgroundColor = '#f5f5f5';
                item.style.transform = 'translateY(0)';
            });
        });
    });

    configureButton.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });
  
    templateList.addEventListener('click', e => {
        const item = e.target.closest('.template-item');
        if (!item) return;
        
        const index = parseInt(item.dataset.index);
        chrome.tabs.query({active: true, currentWindow: true}, tabs => {
            const currentUrl = tabs[0].url;
            chrome.storage.sync.get(['templates'], result => {
                const templates = result.templates || [];
                if (templates[index]) {
                    const encodedUrl = encodeURIComponent(currentUrl);
                    const newUrl = templates[index].url.replace(/{url}/g, encodedUrl);
                    chrome.tabs.create({ url: newUrl });
                }
            });
        });
    });
});