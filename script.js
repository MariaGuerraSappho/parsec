class Parsec {
    constructor() {
        this.bluetooth = new BluetoothManager();
        this.audio = new AudioManager();
        this.websocket = null;
        this.isConnected = false;
        this.isWebSocketConnected = false;
        
        this.initializeUI();
        this.setupEventListeners();
        this.initializeWebSocketHost();
        this.log('Parsec initialized', 'info');
    }

    initializeUI() {
        // Initialize UI elements
        this.statusIndicator = document.getElementById('statusIndicator');
        this.statusText = document.getElementById('statusText');
        this.connectBtn = document.getElementById('connectBtn');
        this.logContainer = document.getElementById('logContainer');
        
        // Control elements
        this.modeButtons = document.querySelectorAll('.mode-btn');
        this.strengthSlider = document.getElementById('strengthSlider');
        this.intervalSlider = document.getElementById('intervalSlider');
        this.volumeSlider = document.getElementById('volumeSlider');
        this.audioInput = document.getElementById('audioInput');
        
        // Value display elements
        this.strengthValue = document.getElementById('strengthValue');
        this.intervalValue = document.getElementById('intervalValue');
        this.volumeValue = document.getElementById('volumeValue');

        // Populate audio inputs
        this.audio.getAudioInputs().then(devices => {
            devices.forEach(device => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.textContent = device.label || `Microphone ${device.deviceId.substr(0, 8)}`;
                this.audioInput.appendChild(option);
            });
        });
    }

    setupEventListeners() {
        // Connection
        this.connectBtn.addEventListener('click', () => this.toggleConnection());
        
        // BLE Controls
        this.modeButtons.forEach(btn => {
            btn.addEventListener('click', (e) => this.selectMode(e.target));
        });
        this.strengthSlider.addEventListener('input', () => this.updateStrength());
        this.intervalSlider.addEventListener('input', () => this.updateInterval());
        
        // Audio Controls
        this.volumeSlider.addEventListener('input', () => this.updateVolume());
        this.audioInput.addEventListener('change', () => this.selectAudioInput());
        
        // Log management
        document.getElementById('clearLog').addEventListener('click', () => this.clearLog());
        
        // Bluetooth events
        this.bluetooth.on('connected', () => this.onBluetoothConnected());
        this.bluetooth.on('disconnected', () => this.onBluetoothDisconnected());
        this.bluetooth.on('error', (error) => this.onBluetoothError(error));
        
        // Audio events
        this.audio.on('volumeUpdate', (volume) => this.onVolumeUpdate(volume));
        this.audio.on('error', (error) => this.log(`Audio error: ${error}`, 'error'));
    }

    selectMode(button) {
        // Update button states
        this.modeButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        
        // Update mode
        this.currentMode = parseInt(button.dataset.mode);
        this.updateMode();
    }

    async toggleConnection() {
        if (this.isConnected) {
            await this.disconnect();
        } else {
            await this.connect();
        }
    }

    async connect() {
        try {
            this.connectBtn.disabled = true;
            this.connectBtn.textContent = 'Connecting...';
            this.log('Attempting to connect to BuzzBox...', 'info');
            
            await this.bluetooth.connect();
        } catch (error) {
            this.log(`Connection failed: ${error.message}`, 'error');
            this.connectBtn.disabled = false;
            this.connectBtn.textContent = 'Connect BuzzBox';
        }
    }

    async disconnect() {
        try {
            await this.bluetooth.disconnect();
            this.audio.stop();
        } catch (error) {
            this.log(`Disconnection error: ${error.message}`, 'error');
        }
    }

    onBluetoothConnected() {
        this.isConnected = true;
        this.statusText.textContent = 'Connected';
        this.statusIndicator.querySelector('.status-dot').classList.add('connected');
        this.connectBtn.textContent = 'Disconnect';
        this.connectBtn.disabled = false;
        this.log('Connected to BuzzBox', 'success');
        
        // Send initial settings
        this.currentMode = 0; // Initialize current mode
        this.updateMode();
        this.updateStrength();
        this.updateInterval();
    }

    onBluetoothDisconnected() {
        this.isConnected = false;
        this.statusText.textContent = 'Disconnected';
        this.statusIndicator.querySelector('.status-dot').classList.remove('connected');
        this.connectBtn.textContent = 'Connect BuzzBox';
        this.connectBtn.disabled = false;
        this.log('Disconnected from BuzzBox', 'info');
    }

    onBluetoothError(error) {
        this.log(`Bluetooth error: ${error}`, 'error');
        this.connectBtn.disabled = false;
        this.connectBtn.textContent = 'Connect BuzzBox';
    }

    async updateMode() {
        const mode = this.currentMode || 0;
        if (this.isConnected) {
            try {
                await this.bluetooth.setMode(mode);
                this.log(`Mode set to: ${['Off', 'Continuous', 'Intermittent'][mode]}`, 'info');
            } catch (error) {
                this.log(`Failed to set mode: ${error.message}`, 'error');
            }
        }
    }

    async updateStrength() {
        const strength = parseInt(this.strengthSlider.value);
        this.strengthValue.textContent = strength;
        
        if (this.isConnected) {
            try {
                await this.bluetooth.setStrength(strength);
                this.log(`Strength set to: ${strength}`, 'info');
            } catch (error) {
                this.log(`Failed to set strength: ${error.message}`, 'error');
            }
        }
    }

    async updateInterval() {
        const interval = parseInt(this.intervalSlider.value);
        this.intervalValue.textContent = `${interval}s`;
        
        if (this.isConnected) {
            try {
                await this.bluetooth.setInterval(interval);
                this.log(`Interval set to: ${interval}s`, 'info');
            } catch (error) {
                this.log(`Failed to set interval: ${error.message}`, 'error');
            }
        }
    }

    updateVolume() {
        const volume = parseFloat(this.volumeSlider.value);
        this.volumeValue.textContent = volume.toFixed(2);
        this.audio.setVolume(volume);
    }

    async selectAudioInput() {
        const deviceId = this.audioInput.value;
        if (deviceId) {
            try {
                await this.audio.selectInput(deviceId);
                this.log(`Audio input selected: ${this.audioInput.selectedOptions[0].text}`, 'info');
            } catch (error) {
                this.log(`Failed to select audio input: ${error.message}`, 'error');
            }
        }
    }

    onVolumeUpdate(volume) {
        const volumeBar = document.getElementById('volumeBar');
        volumeBar.style.width = `${volume * 100}%`;
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

    initializeWebSocketHost() {
        // Connect to local WebSocket server as host (optional feature)
        this.websocketRetryCount = 0;
        this.maxWebSocketRetries = 3;
        this.connectWebSocket();
    }

    connectWebSocket() {
        // Don't spam connection attempts
        if (this.websocketRetryCount >= this.maxWebSocketRetries) {
            return; // Silent fail - websocket is optional
        }

        try {
            this.websocket = new WebSocket('ws://localhost:8080');
            
            this.websocket.onopen = () => {
                // Register as host
                this.websocket.send(JSON.stringify({ type: 'host' }));
                this.websocketRetryCount = 0; // Reset retry count on successful connection
            };
            
            this.websocket.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this.handleWebSocketMessage(message);
                } catch (error) {
                    this.log(`Invalid WebSocket message: ${error.message}`, 'error');
                }
            };
            
            this.websocket.onclose = () => {
                this.isWebSocketConnected = false;
                if (this.websocketRetryCount < this.maxWebSocketRetries) {
                    this.websocketRetryCount++;
                    setTimeout(() => this.connectWebSocket(), 5000);
                }
            };
            
            this.websocket.onerror = (error) => {
                this.websocketRetryCount++;
                // Silent fail - websocket is optional, no error messages needed
            };
            
        } catch (error) {
            // Silent fail for WebSocket initialization
        }
    }

    handleWebSocketMessage(message) {
        switch (message.type) {
            case 'host_registered':
                this.isWebSocketConnected = true;
                this.log('Remote control enabled - clients can now connect', 'success');
                break;
                
            case 'remote_control':
                this.handleRemoteControl(message);
                break;
                
            default:
                this.log(`Unknown WebSocket message type: ${message.type}`, 'info');
        }
    }

    async handleRemoteControl(message) {
        const clientIP = message.client_ip || 'unknown';
        
        try {
            if (message.mode !== undefined) {
                // Update mode
                this.modeButtons.forEach(btn => btn.classList.remove('active'));
                const modeBtn = document.querySelector(`[data-mode="${message.mode}"]`);
                if (modeBtn) {
                    modeBtn.classList.add('active');
                    this.currentMode = message.mode;
                    await this.updateMode();
                    this.log(`Remote control from ${clientIP}: Mode set to ${['Off', 'Continuous', 'Intermittent'][message.mode]}`, 'info');
                }
            }
            
            if (message.strength !== undefined) {
                // Update strength
                this.strengthSlider.value = message.strength;
                this.strengthValue.textContent = message.strength;
                await this.updateStrength();
                this.log(`Remote control from ${clientIP}: Strength set to ${message.strength}`, 'info');
            }
            
            if (message.interval !== undefined) {
                // Update interval
                this.intervalSlider.value = message.interval;
                this.intervalValue.textContent = `${message.interval}s`;
                await this.updateInterval();
                this.log(`Remote control from ${clientIP}: Interval set to ${message.interval}s`, 'info');
            }
            
        } catch (error) {
            this.log(`Failed to apply remote control from ${clientIP}: ${error.message}`, 'error');
        }
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.parsec = new Parsec();
});