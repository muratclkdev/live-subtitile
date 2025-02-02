document.addEventListener('DOMContentLoaded', async () => {
    const toggleButton = document.getElementById('toggleRecording');
    const statusText = document.getElementById('status');
    const targetLangSelect = document.getElementById('targetLang');
    let isRecording = false;

    // Kayıtlı dil tercihini al
    chrome.storage.local.get(['targetLang', 'isRecording'], (result) => {
        if (result.targetLang) {
            targetLangSelect.value = result.targetLang;
        }
        isRecording = result.isRecording || false;
        updateUI();
    });

    // Dil değiştiğinde kaydet ve content script'e bildir
    targetLangSelect.addEventListener('change', async () => {
        const targetLang = targetLangSelect.value;
        chrome.storage.local.set({ targetLang });
        
        const tab = await getCurrentTab();
        if (tab) {
            try {
                await chrome.tabs.sendMessage(tab.id, {
                    action: 'setTargetLang',
                    targetLang: targetLang
                });
            } catch (error) {
                console.error('Dil değiştirme hatası:', error);
            }
        }
    });

    // UI'ı güncelle
    function updateUI() {
        if (isRecording) {
            toggleButton.textContent = 'Çeviriyi Durdur';
            toggleButton.classList.add('recording');
            statusText.textContent = 'Çeviri Aktif';
        } else {
            toggleButton.textContent = 'Çeviriyi Başlat';
            toggleButton.classList.remove('recording');
            statusText.textContent = 'Beklemede';
        }
    }

    // Aktif Twitch sekmesini bul
    async function getCurrentTab() {
        const tabs = await chrome.tabs.query({
            active: true,
            currentWindow: true,
            url: "*://*.twitch.tv/*"
        });
        return tabs[0];
    }

    // Butona tıklandığında
    toggleButton.addEventListener('click', async () => {
        const tab = await getCurrentTab();
        
        if (!tab) {
            statusText.textContent = 'Twitch sekmesi bulunamadı!';
            return;
        }

        isRecording = !isRecording;
        
        // Durumu kaydet
        chrome.storage.local.set({ isRecording });
        
        // Content script'e mesaj gönder
        try {
            await chrome.tabs.sendMessage(tab.id, {
                action: isRecording ? 'startRecording' : 'stopRecording',
                targetLang: targetLangSelect.value
            });
            updateUI();
        } catch (error) {
            console.error('Mesaj gönderme hatası:', error);
            statusText.textContent = 'Hata! Sayfayı yenileyin';
            isRecording = false;
            chrome.storage.local.set({ isRecording: false });
            updateUI();
        }
    });

    // Sayfa açıldığında mevcut durumu kontrol et
    const tab = await getCurrentTab();
    if (tab) {
        try {
            const response = await chrome.tabs.sendMessage(tab.id, { 
                action: 'getStatus',
                targetLang: targetLangSelect.value
            });
            isRecording = response.isRecording;
            chrome.storage.local.set({ isRecording });
            updateUI();
        } catch (error) {
            console.error('Durum kontrolü hatası:', error);
            isRecording = false;
            chrome.storage.local.set({ isRecording: false });
            updateUI();
        }
    }
}); 