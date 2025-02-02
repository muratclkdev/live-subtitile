// Content script'in yüklenip yüklenmediğini kontrol et
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'contentScriptStatus') {
        sendResponse({ loaded: true });
    }
});

// Sekme değiştiğinde veya güncellendiğinde content script'i yeniden yükle
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && tab.url.includes('twitch.tv')) {
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content.js']
        }).catch(err => console.error('Content script yükleme hatası:', err));
    }
});

// Aktif sekme değiştiğinde kontrol et
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        if (tab.url && tab.url.includes('twitch.tv')) {
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content.js']
            }).catch(err => console.error('Content script yükleme hatası:', err));
        }
    } catch (err) {
        console.error('Tab bilgisi alınamadı:', err);
    }
}); 