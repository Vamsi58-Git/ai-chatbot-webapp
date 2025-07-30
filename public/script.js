// AI Chatbot WebApp JavaScript
class AIAssistant {
    constructor() {
        this.currentPage = 'chat';
        this.apiKey = localStorage.getItem('aiApiKey') || '';
        this.username = localStorage.getItem('username') || 'User';
        this.darkMode = localStorage.getItem('darkMode') === 'true';
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadUserSettings();
        this.setupDarkMode();
        this.showPage('chat');
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-links li').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = link.getAttribute('data-page');
                this.showPage(page);
            });
        });

        // Chat functionality
        const sendBtn = document.getElementById('send-btn');
        const userInput = document.getElementById('user-input');
        
        sendBtn.addEventListener('click', () => this.sendMessage());
        userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });

        // Summarize functionality
        const summarizeBtn = document.getElementById('summarize-btn');
        const copySummaryBtn = document.getElementById('copy-summary-btn');
        
        summarizeBtn.addEventListener('click', () => this.summarizeText());
        copySummaryBtn.addEventListener('click', () => this.copyToClipboard('summary-output'));

        // Creative functionality
        const generateBtn = document.getElementById('generate-btn');
        const copyCreativeBtn = document.getElementById('copy-creative-btn');
        const downloadBtn = document.getElementById('download-btn');
        
        generateBtn.addEventListener('click', () => this.generateContent());
        copyCreativeBtn.addEventListener('click', () => this.copyToClipboard('creative-output'));
        downloadBtn.addEventListener('click', () => this.downloadContent());

        // Settings functionality
        const darkModeToggle = document.getElementById('dark-mode-toggle');
        const saveApiKeyBtn = document.getElementById('save-api-key');
        const saveUsernameBtn = document.getElementById('save-username');
        
        darkModeToggle.addEventListener('change', () => this.toggleDarkMode());
        saveApiKeyBtn.addEventListener('click', async () => await this.saveApiKey());
        saveUsernameBtn.addEventListener('click', () => this.saveUsername());
    }

    showPage(pageId) {
        // Update navigation active state
        document.querySelectorAll('.nav-links li').forEach(link => {
            link.classList.remove('active');
        });
        document.querySelector(`[data-page="${pageId}"]`).classList.add('active');

        // Show/hide pages
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });
        document.getElementById(`${pageId}-page`).classList.add('active');

        this.currentPage = pageId;
    }

    async sendMessage() {
        const userInput = document.getElementById('user-input');
        const message = userInput.value.trim();
        
        if (!message) return;

        // Add user message to chat
        this.addMessageToChat(message, 'user');
        userInput.value = '';

        // Show typing indicator
        this.showTypingIndicator();

        try {
            const response = await this.getAIResponse(message);
            this.hideTypingIndicator();
            this.addMessageToChat(response, 'bot');
        } catch (error) {
            this.hideTypingIndicator();
            let errorMsg = error && error.message ? error.message : 'Sorry, I encountered an error. Please try again.';
            
            // Add retry button for certain errors
            if (error.message.includes('overloaded') || error.message.includes('temporarily unavailable')) {
                this.addErrorMessageWithRetry(errorMsg, message);
            } else {
                this.addMessageToChat(errorMsg, 'bot');
            }
            console.error('Error:', error);
        }
    }

    addErrorMessageWithRetry(errorMsg, originalMessage) {
        const chatMessages = document.getElementById('chat-messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message bot-message error-message';
        
        const currentTime = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        messageDiv.innerHTML = `
            <div class="message-content">
                <p>${this.escapeHtml(errorMsg)}</p>
                <button class="retry-btn" onclick="window.aiAssistant.retryMessage('${this.escapeHtml(originalMessage)}')">
                    <i class="fas fa-redo"></i> Try Again
                </button>
            </div>
            <div class="message-time">${currentTime}</div>
        `;
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    async retryMessage(message) {
        // Remove the error message
        const errorMessages = document.querySelectorAll('.error-message');
        if (errorMessages.length > 0) {
            errorMessages[errorMessages.length - 1].remove();
        }
        
        // Show typing indicator and retry
        this.showTypingIndicator();
        
        try {
            const response = await this.getAIResponse(message);
            this.hideTypingIndicator();
            this.addMessageToChat(response, 'bot');
        } catch (error) {
            this.hideTypingIndicator();
            let errorMsg = error && error.message ? error.message : 'Sorry, I encountered an error. Please try again.';
            this.addErrorMessageWithRetry(errorMsg, message);
        }
    }

    addMessageToChat(message, sender) {
        const chatMessages = document.getElementById('chat-messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;
        
        const currentTime = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        messageDiv.innerHTML = `
            <div class="message-content">
                <p>${this.escapeHtml(message)}</p>
            </div>
            <div class="message-time">${currentTime}</div>
        `;
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    showTypingIndicator() {
        const chatMessages = document.getElementById('chat-messages');
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message bot-message typing-indicator';
        typingDiv.id = 'typing-indicator';
        typingDiv.innerHTML = `
            <div class="message-content">
                <p>AI is thinking...</p>
            </div>
        `;
        chatMessages.appendChild(typingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    hideTypingIndicator() {
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    async getAIResponse(message) {
        try {
            const response = await fetch('/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                // Handle specific error types
                if (response.status === 503) {
                    throw new Error(data.error || 'Service temporarily unavailable. Please try again in a moment.');
                }
                throw new Error(data.error || 'Failed to get AI response');
            }
            
            return data.reply;
        } catch (error) {
            console.error('Server /chat error:', error);
            
            // Handle network errors
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                throw new Error('Unable to connect to the server. Please check if the server is running.');
            }
            
            throw error;
        }
    }

    async summarizeText() {
        const input = document.getElementById('summarize-input').value.trim();
        const output = document.getElementById('summary-output');

        if (!input) {
            this.showToast('Please enter text to summarize', 'error');
            return;
        }

        output.innerHTML = '<p class="loading">Generating summary...</p>';

        try {
            const response = await fetch('/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message: `Summarize: ${input}` })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to generate summary');
            }

            output.innerHTML = `<p>${this.escapeHtml(data.reply)}</p>`;
            this.showToast('Summary generated successfully!', 'success');
        } catch (error) {
            output.innerHTML = '<p class="error">Failed to generate summary. Please try again.</p>';
            this.showToast('Error generating summary', 'error');
            console.error('Error:', error);
        }
    }

    async generateContent() {
        const contentType = document.getElementById('content-type').value;
        const creativeInput = document.getElementById('creative-input').value.trim();
        const output = document.getElementById('creative-output');

        if (!creativeInput) {
            this.showToast('Please enter input for creative content', 'error');
            return;
        }

        output.innerHTML = '<p class="loading">Generating content...</p>';

        try {
            const response = await fetch('/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message: `Generate ${contentType}: ${creativeInput}` })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to generate content');
            }

            output.innerHTML = `<p>${this.escapeHtml(data.reply)}</p>`;
            this.showToast('Content generated successfully!', 'success');
        } catch (error) {
            output.innerHTML = '<p class="error">Failed to generate content. Please try again.</p>';
            this.showToast('Error generating content', 'error');
            console.error('Error:', error);
        }
    }

    downloadContent() {
        const content = document.getElementById('creative-output').textContent;
        const contentType = document.getElementById('content-type').value;
        
        if (!content || content.includes('placeholder')) {
            this.showToast('No content to download', 'error');
            return;
        }

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `generated-${contentType}-${Date.now()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showToast('Content downloaded!', 'success');
    }

    toggleDarkMode() {
        this.darkMode = !this.darkMode;
        document.body.classList.toggle('dark-mode', this.darkMode);
        localStorage.setItem('darkMode', this.darkMode);
    }

    saveApiKey() {
        this.showToast('API key is now managed by the server. No need to set it here.', 'info');
    }

    saveUsername() {
        const username = document.getElementById('username').value.trim();
        if (username) {
            localStorage.setItem('username', username);
            this.username = username;
            document.getElementById('user-name').textContent = username;
            this.showToast('Username saved!', 'success');
        }
    }

    loadUserSettings() {
        document.getElementById('user-name').textContent = this.username;
        document.getElementById('username').value = this.username;
        if (this.apiKey) {
            document.getElementById('api-key').value = this.apiKey;
        }
    }

    showToast(message, type = 'info') {
        // Remove existing toast
        const existingToast = document.querySelector('.toast');
        if (existingToast) {
            existingToast.remove();
        }

        // Create new toast
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        // Add styles
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 1000;
            animation: slideIn 0.3s ease-out;
            max-width: 300px;
        `;

        // Set background color based on type
        const colors = {
            success: '#4CAF50',
            error: '#f44336',
            info: '#2196F3',
            warning: '#ff9800'
        };
        toast.style.backgroundColor = colors[type] || colors.info;

        document.body.appendChild(toast);

        // Auto remove after 3 seconds
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.remove();
                }
            }, 300);
        }, 3000);
    }

    setupDarkMode() {
        const darkModeToggle = document.getElementById('dark-mode-toggle');
        darkModeToggle.checked = this.darkMode;
        document.body.classList.toggle('dark-mode', this.darkMode);
    }

    async copyToClipboard(elementId) {
        const element = document.getElementById(elementId);
        const text = element.textContent || element.innerText;
        
        if (!text || text.includes('placeholder') || text.includes('will appear here')) {
            this.showToast('No content to copy', 'error');
            return;
        }

        try {
            await navigator.clipboard.writeText(text);
            this.showToast('Content copied to clipboard!', 'success');
        } catch (err) {
            // Fallback for browsers that don't support clipboard API
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                this.showToast('Content copied to clipboard!', 'success');
            } catch (fallbackErr) {
                this.showToast('Failed to copy content', 'error');
            }
            document.body.removeChild(textArea);
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Add CSS animations for toast
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }

    .loading {
        color: #666;
        font-style: italic;
    }

    .error {
        color: #f44336;
    }

    .typing-indicator {
        opacity: 0.7;
    }

    .typing-indicator .message-content p {
        font-style: italic;
    }
`;
document.head.appendChild(style);

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.aiAssistant = new AIAssistant();
});