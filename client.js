class ParsecClient {
    constructor() {
        this.websocket = null;
        this.isConnected = false;
        this.hostIP = '';
        
        this.initializeUI();
        this.setupEventListeners();
        this.log('Parsec Remote initialized', 'info');
    }

    initializeUI() {
        // Initialize UI elements
        this.statusIndicator = document.getElementById('statusIndicator');
        this.statusText = document.getElementById('statusText');
        this.connectBtn = document.getElementById('connectBtn');
        this.hostInput = document.getElementById('hostInput');
        this.logContainer = document.getElementById('logContainer');
        
        // Control elements
        this.modeButtons = document.querySelectorAll('.mode-btn');
        this.strengthSlider = document.getElementById('strengthSlider');
        this.intervalSlider = document.getElementById('intervalSlider');
        
        // Value display elements
        this.strengthValue = document.getElementById('strengthValue');
        this.intervalValue = document.getElementById('intervalValue');
        
        // Set default host IP
        this.hostInput.value = window.location.hostname || 'localhost';
    }

    setupEventListeners() {
        // Connection
        this.connectBtn.addEventListener('click', () => this.toggleConnection());
        
        // Controls - only work when connected
        this.modeButtons.forEach(btn => {
            btn.addEventListener('click', (e) => this.selectMode(e.target));
        });
        this.strengthSlider.addEventListener('input', () => this.updateStrength());
        this.intervalSlider.addEventListener('input', () => this.updateInterval());
        
        // Log management
        document.getElementById('clearLog').addEventListener('click', () => this.clearLog());
    }

    selectMode(button) {
        if (!this.isConnected) {
            this.log('Not connected to host', 'error');
            return;
        }
        
        // Update button states
        this.modeButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        
        // Send mode change
        const mode = parseInt(button.dataset.mode);
        this.sendControl({ mode });
    }

    async toggleConnection() {
        if (this.isConnected) {
            this.disconnect();
        } else {
            await this.connect();
        }
    }

    async connect() {
        try {
            this.hostIP = this.hostInput.value.trim() || 'localhost';
            this.connectBtn.disabled = true;
            this.connectBtn.textContent = 'Connecting...';
            this.log(`Attempting to connect to host at ${this.hostIP}:8080...`, 'info');
            
            this.websocket = new WebSocket(`ws://${this.hostIP}:8080`);
            
            this.websocket.onopen = () => {
                // Register as client
                this.websocket.send(JSON.stringify({ type: 'client' }));
            };
            
            this.websocket.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this.handleMessage(message);
                } catch (error) {
                    this.log(`Invalid message received: ${error.message}`, 'error');
                }
            };
            
            this.websocket.onclose = () => {
                this.onDisconnected();
            };
            
            this.websocket.onerror = (error) => {
                this.log(`WebSocket error: ${error.message || 'Connection failed'}`, 'error');
                this.connectBtn.disabled = false;
                this.connectBtn.textContent = 'Connect to Host';
            };
            
        } catch (error) {
            this.log(`Connection failed: ${error.message}`, 'error');
            this.connectBtn.disabled = false;
            this.connectBtn.textContent = 'Connect to Host';
        }
    }

    disconnect() {
        if (this.websocket) {
            this.websocket.close();
        }
    }

    handleMessage(message) {
        switch (message.type) {
            case 'client_registered':
                this.onConnected();
                break;
            case 'error':
                this.log(`Host error: ${message.message}`, 'error');
                break;
            default:
                this.log(`Unknown message type: ${message.type}`, 'info');
        }
    }

    onConnected() {
        this.isConnected = true;
        this.statusText.textContent = 'Connected to Host';
        this.statusIndicator.querySelector('.status-dot').classList.add('connected');
        this.connectBtn.textContent = 'Disconnect';
        this.connectBtn.disabled = false;
        this.log(`Connected to host at ${this.hostIP}:8080`, 'success');
    }

    onDisconnected() {
        this.isConnected = false;
        this.statusText.textContent = 'Disconnected';
        this.statusIndicator.querySelector('.status-dot').classList.remove('connected');
        this.connectBtn.textContent = 'Connect to Host';
        this.connectBtn.disabled = false;
        this.log('Disconnected from host', 'info');
        this.websocket = null;
    }

    sendControl(data) {
        if (!this.websocket || !this.isConnected) {
            this.log('Cannot send control - not connected to host', 'error');
            return;
        }
        
        try {
            this.websocket.send(JSON.stringify({
                type: 'control',
                data: data
            }));
            
            // Log the control action
            const action = Object.keys(data)[0];
            const value = data[action];
            this.log(`Sent ${action}: ${value}`, 'info');
            
        } catch (error) {
            this.log(`Failed to send control: ${error.message}`, 'error');
        }
    }

    updateStrength() {
        const strength = parseInt(this.strengthSlider.value);
        this.strengthValue.textContent = strength;
        
        if (this.isConnected) {
            this.sendControl({ strength });
        }
    }

    updateInterval() {
        const interval = parseInt(this.intervalSlider.value);
        this.intervalValue.textContent = `${interval}s`;
        
        if (this.isConnected) {
            this.sendControl({ interval });
        }
    }

    log(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry log-${type}`;
        
        logEntry.innerHTML = `
            <span class="log-timestamp">${timestamp}</span>
            <span class="log-message">${message}</span>
        `;
        
        this.logContainer.appendChild(logEntry);
        this.logContainer.scrollTop = this.logContainer.scrollHeight;
        
        // Keep only last 50 entries
        while (this.logContainer.children.length > 50) {
            this.logContainer.removeChild(this.logContainer.firstChild);
        }
    }

    clearLog() {
        this.logContainer.innerHTML = '';
        this.log('Log cleared', 'info');
    }
}

// Initialize the client when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.parsecClient = new ParsecClient();
});