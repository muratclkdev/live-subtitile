// content.js

(() => {
    class SpeechHandler {
        constructor(elements) {
            this.elements = elements;
            this.recognition = null;
            this.currentSentence = '';
            this.translationTimeout = null;
            this.isActive = false;
            this.transcript = [];
            this.targetLang = 'tr'; // Varsayılan dil
            this.initSpeechRecognition();
        }

        initSpeechRecognition() {
            if (typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)) {
                this.recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
                this.setupRecognition();
            } else {
                console.log("Ses tanima API'si desteklenmiyor");
            }
        }

        setupRecognition() {
            this.recognition.continuous = true;
            this.recognition.interimResults = true;
            this.recognition.maxAlternatives = 1;
            this.recognition.lang = 'en-US';

            this.recognition.onstart = () => {
                console.log("Ses tanima basladi");
                this.isActive = true;
            };

            this.recognition.onresult = (event) => {
                if (!this.isActive) return;

                let interimTranscript = '';
                let finalTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        finalTranscript += transcript;
                        this.currentSentence = (this.currentSentence + ' ' + transcript).trim();
                        this.handleFinalTranscript();
                    } else {
                        interimTranscript += transcript;
                    }
                }

                if (this.elements.originalText) {
                    const displayText = this.currentSentence + (interimTranscript ? ' ' + interimTranscript : '');
                    this.elements.originalText.textContent = displayText.trim();
                }
            };

            this.recognition.onerror = (event) => {
                console.error("Ses tanima hatasi:", event.error);
                if (event.error === 'no-speech') {
                    // Sessizlik durumunda yeniden başlat
                    this.restart();
                } else if (event.error === 'audio-capture') {
                    console.error("Mikrofon bulunamadı");
                } else if (event.error === 'not-allowed') {
                    console.error("Mikrofon izni reddedildi");
                }
            };

            this.recognition.onend = () => {
                console.log("Ses tanima bitti");
                if (this.isActive) {
                    this.restart();
                }
            };
        }

        async translateText(text) {
            if (!text.trim()) return '';
            
            try {
                const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${this.targetLang}&dt=t&q=${encodeURIComponent(text)}`;
                const response = await fetch(url);
                if (!response.ok) throw new Error('Translation failed');
                
                const data = await response.json();
                return data[0].map(x => x[0]).join('');
            } catch (error) {
                console.error("Ceviri hatasi:", error);
                return text;
            }
        }

        async translateAndStore(text) {
            if (!text.trim() || !this.isActive) return;

            try {
                const translatedText = await this.translateText(text);
                if (this.elements.translatedText && translatedText) {
                    this.elements.translatedText.textContent = translatedText;
                    
                    const timestamp = new Date().toLocaleTimeString();
                    const transcriptEntry = document.createElement("div");
                    transcriptEntry.style.marginBottom = "10px";
                    transcriptEntry.innerHTML = `
                        <div style="color: #999; font-size: 12px;">${timestamp}</div>
                        <div style="color: white;">${text}</div>
                        <div style="color: #ffff00;">${translatedText}</div>
                    `;
                    
                    if (this.elements.transcriptPanel) {
                        this.elements.transcriptPanel.insertBefore(transcriptEntry, this.elements.transcriptPanel.firstChild);
                    }
                }
            } catch (error) {
                console.error("Ceviri hatasi:", error);
                if (this.elements.translatedText) {
                    this.elements.translatedText.textContent = "Ceviri hatasi olustu";
                }
            }
        }

        handleFinalTranscript() {
            clearTimeout(this.translationTimeout);
            this.translationTimeout = setTimeout(() => {
                this.translateAndStore(this.currentSentence.trim());
                this.currentSentence = '';
            }, 1000);
        }

        start() {
            this.isActive = true;
            if (this.elements.container) {
                this.elements.container.style.display = "flex";
            }
            try {
                this.recognition.start();
            } catch (error) {
                console.error("Baslama hatasi:", error);
                this.restart();
            }
        }

        stop() {
            this.isActive = false;
            try {
                this.recognition.stop();
            } catch (error) {
                console.error("Durdurma hatasi:", error);
            }
            if (this.elements.container) {
                this.elements.container.style.display = "none";
            }
        }

        restart() {
            if (!this.isActive) return;
            setTimeout(() => {
                try {
                    this.recognition.start();
                } catch (error) {
                    console.error("Yeniden baslama hatasi:", error);
                }
            }, 1000);
        }

        setTargetLang(lang) {
            this.targetLang = lang;
            console.log("Hedef dil değiştirildi:", lang);
        }
    }

    // Mesaj dinleyicisi
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (!window.speechHandler) {
            const elements = createMainContainer();
            if (elements) {
                window.speechHandler = new SpeechHandler(elements);
            }
        }

        switch (message.action) {
            case "startRecording":
                if (window.speechHandler) {
                    if (message.targetLang) {
                        window.speechHandler.setTargetLang(message.targetLang);
                    }
                    window.speechHandler.start();
                    sendResponse({ success: true });
                }
                break;
            case "stopRecording":
                if (window.speechHandler) {
                    window.speechHandler.stop();
                    sendResponse({ success: true });
                }
                break;
            case "setTargetLang":
                if (window.speechHandler) {
                    window.speechHandler.setTargetLang(message.targetLang);
                    sendResponse({ success: true });
                }
                break;
            case "getStatus":
                if (window.speechHandler) {
                    sendResponse({ 
                        isRecording: window.speechHandler.isActive,
                        targetLang: window.speechHandler.targetLang
                    });
                } else {
                    sendResponse({ isRecording: false, targetLang: 'tr' });
                }
                break;
        }
        return true;
    });

    function createMainContainer() {
        const videoPlayer = document.querySelector(".video-player__container") || 
                          document.querySelector(".video-player") ||
                          document.querySelector(".persistent-player");

        if (!videoPlayer) {
            console.log("Video player bulunamadi");
            return null;
        }

        const existingContainer = document.getElementById("twitchTranslateContainer");
        if (existingContainer) {
            existingContainer.remove();
        }

        // Ana container
        const container = document.createElement("div");
        container.id = "twitchTranslateContainer";
        container.style.cssText = `
            position: absolute;
            bottom: 70px;
            left: 0;
            right: 0;
            width: 100%;
            z-index: 9999999;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            pointer-events: none;
        `;

        // Transkript butonu - sayfanın sağına sabit
        const transcriptButton = document.createElement("div");
        transcriptButton.id = "transcriptButton";
        transcriptButton.innerHTML = "Transkript";
        transcriptButton.style.cssText = `
            position: fixed;
            right: 0;
            top: 50%;
            transform: translateY(-50%);
            background: rgba(145, 71, 255, 0.9);
            color: white;
            padding: 10px 15px;
            border-radius: 5px 0 0 5px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            z-index: 9999999;
            transition: all 0.3s ease;
            box-shadow: -2px 0 5px rgba(0, 0, 0, 0.2);
        `;

        // Transkript panel - sağ tarafta açılır panel
        const transcriptPanel = document.createElement("div");
        transcriptPanel.id = "transcriptPanel";
        transcriptPanel.style.cssText = `
            position: fixed;
            right: -350px;
            top: 0;
            width: 350px;
            height: 100vh;
            background: rgba(0, 0, 0, 0.95);
            z-index: 9999998;
            transition: all 0.3s ease;
            padding: 20px;
            box-sizing: border-box;
            overflow-y: auto;
            box-shadow: -2px 0 10px rgba(0, 0, 0, 0.5);
        `;

        // Panel başlığı
        const transcriptHeader = document.createElement("div");
        transcriptHeader.style.cssText = `
            font-size: 16px;
            font-weight: bold;
            color: white;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        `;
        transcriptHeader.textContent = "Transkript Geçmişi";

        // Transkript içerik konteyneri
        const transcriptContent = document.createElement("div");
        transcriptContent.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 15px;
        `;

        transcriptPanel.appendChild(transcriptHeader);
        transcriptPanel.appendChild(transcriptContent);

        // Buton tıklama olayı
        let isPanelOpen = false;
        transcriptButton.onclick = () => {
            isPanelOpen = !isPanelOpen;
            transcriptPanel.style.right = isPanelOpen ? "0" : "-350px";
            transcriptButton.style.right = isPanelOpen ? "350px" : "0";
            transcriptButton.style.backgroundColor = isPanelOpen ? 
                "rgba(145, 71, 255, 0.9)" : "rgba(145, 71, 255, 0.9)";
        };

        // Altyazı konteyneri
        const subtitleContainer = document.createElement("div");
        subtitleContainer.id = "subtitleContainer";
        subtitleContainer.style.cssText = `
            background: rgba(0, 0, 0, 0.8);
            padding: 10px 20px;
            border-radius: 8px;
            text-align: center;
            width: auto;
            max-width: 90%;
            margin: 0 auto;
            display: inline-block;
        `;

        const originalText = document.createElement("div");
        originalText.id = "originalText";
        originalText.style.cssText = `
            color: white;
            font-size: 18px;
            margin-bottom: 5px;
            min-height: 22px;
            text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
            font-weight: 500;
        `;

        const translatedText = document.createElement("div");
        translatedText.id = "translatedText";
        translatedText.style.cssText = `
            color: #ffff00;
            font-size: 18px;
            min-height: 22px;
            text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
            font-weight: 500;
        `;

        // Elementleri birleştir
        subtitleContainer.appendChild(originalText);
        subtitleContainer.appendChild(translatedText);
        container.appendChild(subtitleContainer);

        // Sayfaya ekle
        document.body.appendChild(transcriptButton);
        document.body.appendChild(transcriptPanel);
        videoPlayer.appendChild(container);
        videoPlayer.style.position = "relative";

        return {
            container,
            originalText,
            translatedText,
            transcriptPanel: transcriptContent
        };
    }

    console.log("Content script yuklendi");
})();