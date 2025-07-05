import { loadRNBOEffect, loadBuiltInEffect } from './rnbo-loader.js';

class Parsec {
    constructor() {
        this.bluetooth = new BluetoothManager();
        this.audio = new AudioManager();
        this.context = null;
        this.effectNodes = [];
        this.devices = [];
        this.inputSource = null;
        this.masterGainNode = null;
        this.isAudioStarted = false;
        this.currentInputType = 'none';
        this.isConnected = false;
        this.activeTab = 'effects';
        this.keyboardControlEnabled = false;
        this.isAudioPlaying = false; 
        this.randomModeTimer = null;
        this.isRandomBuzzing = false;
        this.currentRandomBuzzDuration = 0;
        this.currentRandomSilenceDuration = 0;
        this.hands = null;
        this.camera = null;
        this.isHandTrackingActive = false;
        this.webcamVisible = false;
        this.lastGestureTime = 0;
        this.gestureSmoothing = {
            pan: 0,
            volume: 0.5,
            primaryParam: 0
        };
        this.gestureParameterMapping = {
            wristX: { deviceIndex: null, paramIndex: null, paramName: 'None' },
            wristY: { deviceIndex: null, paramIndex: null, paramName: 'None' },
            handCurl: { deviceIndex: null, paramIndex: null, paramName: 'None' }
        };
        this.feedbackEnabled = false;
        this.feedbackNodes = {
            lowShelf: null,
            midPeaking: null,
            highShelf: null,
            compressor: null
        };
        this.presets = [];
        this.mainVideo = null;
        this.popupWindow = null;
        this.popupVideo = null;
        this.videoLoaded = false;
        this.effectsAnalyser = null; // Add effects analyser for monitoring output
        this.effectsVolumeBar = null;
        this.initializeElements();
        this.setupEventListeners();
        this.initializeHandTracking();
        this.loadPresets();
        this.log('Parsec initialized', 'info');
    }

    initializeElements() {
        this.elements = {
            startAudio: document.getElementById('startAudio'),
            playAudio: document.getElementById('playAudio'),
            pauseAudio: document.getElementById('pauseAudio'),
            audioFile: document.getElementById('audioFile'),
            inputSelect: document.getElementById('inputSelect'),
            masterVolume: document.getElementById('masterVolume'),
            audioStatusIndicator: document.getElementById('audioStatusIndicator'),
            effectsChain: document.getElementById('effectsChain'),
            controlsGrid: document.getElementById('controlsGrid'),
            clearChain: document.getElementById('clearChain'),
            loadingOverlay: document.getElementById('loadingOverlay'),
            tabButtons: document.querySelectorAll('.tab-btn'),
            tabContents: document.querySelectorAll('.tab-content'),
            statusIndicator: document.getElementById('statusIndicator'),
            statusText: document.getElementById('statusText'),
            connectBtn: document.getElementById('connectBtn'),
            batteryIndicator: document.getElementById('batteryIndicator'),
            batteryLevel: document.getElementById('batteryLevel'),
            logContainer: document.getElementById('logContainer'),
            modeButtons: document.querySelectorAll('.mode-btn[data-mode]'),
            strengthSlider: document.getElementById('strengthSlider'),
            intervalSlider: document.getElementById('intervalSlider'),
            keyboardControl: document.getElementById('keyboardControl'),
            volumeSlider: document.getElementById('volumeSlider'),
            audioInput: document.getElementById('audioInput'),
            strengthValue: document.getElementById('strengthValue'),
            intervalValue: document.getElementById('intervalValue'),
            volumeValue: document.getElementById('volumeValue'),
            masterVolumeValue: document.getElementById('masterVolumeValue'),
            feedbackToggle: document.getElementById('feedbackToggle'),
            eqLow: document.getElementById('eqLow'),
            eqMid: document.getElementById('eqMid'),
            eqHigh: document.getElementById('eqHigh'),
            eqLowValue: document.getElementById('eqLowValue'),
            eqMidValue: document.getElementById('eqMidValue'),
            eqHighValue: document.getElementById('eqHighValue'),
            compThreshold: document.getElementById('compThreshold'),
            compRatio: document.getElementById('compRatio'),
            compAttack: document.getElementById('compAttack'),
            compRelease: document.getElementById('compRelease'),
            compThresholdValue: document.getElementById('compThresholdValue'),
            compRatioValue: document.getElementById('compRatioValue'),
            compAttackValue: document.getElementById('compAttackValue'),
            compReleaseValue: document.getElementById('compReleaseValue'),
            presetName: document.getElementById('presetName'),
            savePreset: document.getElementById('savePreset'),
            presetBankGrid: document.getElementById('presetBankGrid'),
            videoFile: document.getElementById('videoFile'),
            loadVideo: document.getElementById('loadVideo'),
            playVideo: document.getElementById('playVideo'),
            pauseVideo: document.getElementById('pauseVideo'),
            popupVideo: document.getElementById('popupVideo'),
            mainVideo: document.getElementById('mainVideo'),
            videoContainer: document.getElementById('videoContainer'),
            videoFileName: document.getElementById('videoFileName'),
            videoDuration: document.getElementById('videoDuration'),
            toggleHandTracking: document.getElementById('toggleHandTracking'),
            toggleWebcam: document.getElementById('toggleWebcam'),
            webcamContainer: document.getElementById('webcamContainer'),
            webcamVideo: document.getElementById('webcamVideo'),
            webcamCanvas: document.getElementById('webcamCanvas'),
            effectsVolumeBar: document.getElementById('effectsVolumeBar')
        };
        this.mainVideo = this.elements.mainVideo;
    }

    setupEventListeners() {
        if (this.elements.startAudio) {
            this.elements.startAudio.addEventListener('click', () => this.startAudio());
        }
        if (this.elements.playAudio) {
            this.elements.playAudio.addEventListener('click', () => this.playAudio());
        }
        if (this.elements.pauseAudio) {
            this.elements.pauseAudio.addEventListener('click', () => this.pauseAudio());
        }
        if (this.elements.audioFile) {
            this.elements.audioFile.addEventListener('change', (e) => this.loadAudioFile(e));
        }
        const inputButtons = document.querySelectorAll('.input-btn');
        inputButtons.forEach(button => {
            button.addEventListener('click', () => this.changeInputType(button.dataset.input, button));
        });
        const effectButtons = document.querySelectorAll('.effect-btn');
        effectButtons.forEach(button => {
            button.addEventListener('click', () => this.toggleEffect(button.dataset.effect, button));
        });
        this.elements.tabButtons.forEach(button => {
            button.addEventListener('click', () => this.switchTab(button.dataset.tab));
        });
        if (this.elements.clearChain) {
            this.elements.clearChain.addEventListener('click', () => this.clearEffectsChain());
        }
        const randomiseBtn = document.getElementById('randomiseEffects');
        if (randomiseBtn) {
            randomiseBtn.addEventListener('click', () => this.randomiseEffects());
        }
        if (this.elements.masterVolume) {
            this.elements.masterVolume.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                if (this.elements.masterVolumeValue) {
                    this.elements.masterVolumeValue.textContent = value.toFixed(2);
                }
                if (this.masterGainNode) {
                    this.masterGainNode.gain.setValueAtTime(value, this.context.currentTime);
                }
                this.log(`Master volume: ${value.toFixed(2)}`, 'info');
            });
        }
        if (this.elements.connectBtn) {
            this.elements.connectBtn.addEventListener('click', () => this.toggleConnection());
        }
        this.elements.modeButtons.forEach(btn => {
            btn.addEventListener('click', (e) => this.selectMode(e.target));
        });
        if (this.elements.keyboardControl) {
            this.elements.keyboardControl.addEventListener('change', (e) => {
                this.keyboardControlEnabled = e.target.checked;
                this.log(`Keyboard control ${this.keyboardControlEnabled ? 'enabled' : 'disabled'} (Z = Continuous)`, 'info');
            });
        }
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));
        if (this.elements.strengthSlider) {
            this.elements.strengthSlider.addEventListener('input', () => this.updateStrength());
        }
        if (this.elements.intervalSlider) {
            this.elements.intervalSlider.addEventListener('input', () => this.updateInterval());
        }
        if (this.elements.volumeSlider) {
            this.elements.volumeSlider.addEventListener('input', () => {
                const volume = parseFloat(this.elements.volumeSlider.value);
                if (this.elements.volumeValue) {
                    this.elements.volumeValue.textContent = volume.toFixed(2);
                }
                this.audio.setVolume(volume);
                this.log(`Input gain: ${volume.toFixed(2)}`, 'info');
            });
        }
        if (this.elements.audioInput) {
            this.elements.audioInput.addEventListener('change', () => this.selectAudioInput());
        }
        const clearLogBtn = document.getElementById('clearLog');
        if (clearLogBtn) {
            clearLogBtn.addEventListener('click', () => this.clearLog());
        }
        this.bluetooth.on('connected', () => this.onBluetoothConnected());
        this.bluetooth.on('disconnected', () => this.onBluetoothDisconnected());
        this.bluetooth.on('error', (error) => this.onBluetoothError(error));
        this.bluetooth.on('batteryUpdate', (level) => this.onBatteryUpdate(level));
        this.audio.on('volumeUpdate', (volume) => this.onVolumeUpdate(volume));
        this.audio.on('error', (error) => this.log(`Audio error: ${error}`, 'error'));
        this.audio.getAudioInputs().then(devices => {
            if (this.elements.audioInput) {
                devices.forEach(device => {
                    const option = document.createElement('option');
                    option.value = device.deviceId;
                    option.textContent = device.label || `Microphone ${device.deviceId.substr(0, 8)}`;
                    this.elements.audioInput.appendChild(option);
                });
            }
        });
        const refreshInputsBtn = document.createElement('button');
        refreshInputsBtn.textContent = '🔄 Refresh Devices';
        refreshInputsBtn.className = 'clear-btn';
        refreshInputsBtn.style.fontSize = '0.8rem';
        refreshInputsBtn.style.padding = '4px 8px';
        refreshInputsBtn.addEventListener('click', () => this.refreshAudioInputs());
        if (this.elements.audioInput && this.elements.audioInput.parentNode) {
            this.elements.audioInput.parentNode.insertBefore(refreshInputsBtn, this.elements.audioInput.nextSibling);
        }
        if (this.elements.toggleHandTracking) {
            this.elements.toggleHandTracking.addEventListener('click', () => this.toggleHandTracking());
        }
        if (this.elements.toggleWebcam) {
            this.elements.toggleWebcam.addEventListener('click', () => this.toggleWebcam());
        }
        this.setupFeedbackControlListeners();
        this.setupCollapsiblePanels();
        if (this.elements.savePreset) {
            this.elements.savePreset.addEventListener('click', () => this.saveCurrentPreset());
        }
        if (this.elements.presetName) {
            this.elements.presetName.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.saveCurrentPreset();
                }
            });
        }
        if (this.elements.loadVideo) {
            this.elements.loadVideo.addEventListener('click', () => this.elements.videoFile.click());
        }
        if (this.elements.videoFile) {
            this.elements.videoFile.addEventListener('change', (e) => this.loadVideoFile(e));
        }
        if (this.elements.playVideo) {
            this.elements.playVideo.addEventListener('click', () => this.playVideo());
        }
        if (this.elements.pauseVideo) {
            this.elements.pauseVideo.addEventListener('click', () => this.pauseVideo());
        }
        if (this.elements.popupVideo) {
            this.elements.popupVideo.addEventListener('click', () => this.openVideoPopup());
        }
        if (this.mainVideo) {
            this.mainVideo.addEventListener('loadedmetadata', () => this.onVideoLoaded());
            this.mainVideo.addEventListener('timeupdate', () => this.updateVideoDuration());
            this.mainVideo.addEventListener('ended', () => this.onVideoEnded());
        }
    }

    setupFeedbackControlListeners() {
        if (this.elements.feedbackToggle) {
            this.elements.feedbackToggle.addEventListener('click', () => this.toggleFeedbackControl());
        }
        if (this.elements.eqLow) {
            this.elements.eqLow.addEventListener('input', () => this.updateEQBand('low'));
        }
        if (this.elements.eqMid) {
            this.elements.eqMid.addEventListener('input', () => this.updateEQBand('mid'));
        }
        if (this.elements.eqHigh) {
            this.elements.eqHigh.addEventListener('input', () => this.updateEQBand('high'));
        }
        if (this.elements.compThreshold) {
            this.elements.compThreshold.addEventListener('input', () => this.updateCompressor('threshold'));
        }
        if (this.elements.compRatio) {
            this.elements.compRatio.addEventListener('input', () => this.updateCompressor('ratio'));
        }
        if (this.elements.compAttack) {
            this.elements.compAttack.addEventListener('input', () => this.updateCompressor('attack'));
        }
        if (this.elements.compRelease) {
            this.elements.compRelease.addEventListener('input', () => this.updateCompressor('release'));
        }
    }

    setupCollapsiblePanels() {
        const collapseButtons = document.querySelectorAll('.collapse-btn');
        collapseButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = button.dataset.target;
                const targetElement = document.getElementById(targetId);
                const section = button.closest('section');
                if (targetElement && section) {
                    this.togglePanel(targetElement, button, section);
                }
            });
        });
        this.loadPanelStates();
    }

    togglePanel(content, button, section) {
        const isCollapsed = content.classList.contains('collapsed');
        const panelId = content.id;
        if (isCollapsed) {
            content.classList.remove('collapsed');
            section.classList.remove('collapsed');
            button.textContent = '−';
            this.log(`Expanded panel: ${panelId}`, 'info');
        } else {
            content.classList.add('collapsed');
            section.classList.add('collapsed');
            button.textContent = '+';
            this.log(`Collapsed panel: ${panelId}`, 'info');
        }
        this.savePanelState(panelId, !isCollapsed);
    }

    savePanelState(panelId, isExpanded) {
        try {
            const panelStates = JSON.parse(localStorage.getItem('parsec-panel-states') || '{}');
            panelStates[panelId] = isExpanded;
            localStorage.setItem('parsec-panel-states', JSON.stringify(panelStates));
        } catch (error) {
            // Ignore localStorage errors
        }
    }

    loadPanelStates() {
        try {
            const panelStates = JSON.parse(localStorage.getItem('parsec-panel-states') || '{}');
            Object.keys(panelStates).forEach(panelId => {
                const isExpanded = panelStates[panelId];
                const content = document.getElementById(panelId);
                const button = document.querySelector(`[data-target="${panelId}"]`);
                const section = content?.closest('section');
                if (content && button && section) {
                    if (!isExpanded) {
                        content.classList.add('collapsed');
                        section.classList.add('collapsed');
                        button.textContent = '+';
                    } else {
                        content.classList.remove('collapsed');
                        section.classList.remove('collapsed');
                        button.textContent = '−';
                    }
                }
            });
        } catch (error) {
            // Ignore localStorage errors
        }
    }

    async initializeHandTracking() {
        try {
            this.hands = new Hands({
                locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
                }
            });
            this.hands.setOptions({
                maxNumHands: 1,
                modelComplexity: 1,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5
            });
            this.hands.onResults((results) => this.onHandResults(results));
            this.log('Hand tracking initialized', 'info');
        } catch (error) {
            this.log(`Failed to initialize hand tracking: ${error.message}`, 'error');
        }
    }

    initializeFeedbackNodes() {
        if (!this.context || !this.isAudioStarted) {
            this.log('Audio context not ready for feedback control', 'error');
            return false;
        }
        try {
            this.feedbackNodes.lowShelf = this.context.createBiquadFilter();
            this.feedbackNodes.lowShelf.type = 'lowshelf';
            this.feedbackNodes.lowShelf.frequency.value = 250;
            this.feedbackNodes.lowShelf.gain.value = 0;
            this.feedbackNodes.midPeaking = this.context.createBiquadFilter();
            this.feedbackNodes.midPeaking.type = 'peaking';
            this.feedbackNodes.midPeaking.frequency.value = 1000;
            this.feedbackNodes.midPeaking.Q.value = 0.7;
            this.feedbackNodes.midPeaking.gain.value = 0;
            this.feedbackNodes.highShelf = this.context.createBiquadFilter();
            this.feedbackNodes.highShelf.type = 'highshelf';
            this.feedbackNodes.highShelf.frequency.value = 4000;
            this.feedbackNodes.highShelf.gain.value = 0;
            this.feedbackNodes.compressor = this.context.createDynamicsCompressor();
            this.feedbackNodes.compressor.threshold.value = -24;
            this.feedbackNodes.compressor.knee.value = 30;
            this.feedbackNodes.compressor.ratio.value = 4;
            this.feedbackNodes.compressor.attack.value = 0.003;
            this.feedbackNodes.compressor.release.value = 0.25;
            this.feedbackNodes.lowShelf.connect(this.feedbackNodes.midPeaking);
            this.feedbackNodes.midPeaking.connect(this.feedbackNodes.highShelf);
            this.feedbackNodes.highShelf.connect(this.feedbackNodes.compressor);
            this.log('Feedback control nodes initialized', 'success');
            return true;
        } catch (error) {
            this.log(`Failed to initialize feedback nodes: ${error.message}`, 'error');
            return false;
        }
    }

    toggleFeedbackControl() {
        if (!this.isAudioStarted) {
            this.log('Please start audio first', 'error');
            return;
        }
        this.feedbackEnabled = !this.feedbackEnabled;
        const toggleBtn = this.elements.feedbackToggle;
        const toggleLabel = toggleBtn.querySelector('.toggle-label');
        if (this.feedbackEnabled) {
            if (!this.feedbackNodes.lowShelf) {
                if (!this.initializeFeedbackNodes()) {
                    this.feedbackEnabled = false;
                    return;
                }
            }
            toggleBtn.classList.add('active');
            toggleLabel.textContent = 'ON';
        } else {
            toggleBtn.classList.remove('active');
            toggleLabel.textContent = 'OFF';
        }
        this.reconnectAudioChain();
        this.log(`Feedback control ${this.feedbackEnabled ? 'enabled' : 'disabled'}`, 'info');
    }

    updateEQBand(band) {
        const value = parseFloat(this.elements[`eq${band.charAt(0).toUpperCase() + band.slice(1)}`].value);
        const valueDisplay = this.elements[`eq${band.charAt(0).toUpperCase() + band.slice(1)}Value`];
        valueDisplay.textContent = `${value > 0 ? '+' : ''}${value.toFixed(1)}dB`;
        if (this.feedbackEnabled && this.feedbackNodes[`${band}Shelf`] || this.feedbackNodes[`${band}Peaking`]) {
            const node = band === 'mid' ? this.feedbackNodes.midPeaking : this.feedbackNodes[`${band}Shelf`];
            if (node) {
                node.gain.setValueAtTime(value, this.context.currentTime);
                this.log(`EQ ${band} set to ${value > 0 ? '+' : ''}${value.toFixed(1)}dB`, 'info');
            }
        }
    }

    updateCompressor(param) {
        const element = this.elements[`comp${param.charAt(0).toUpperCase() + param.slice(1)}`];
        const valueDisplay = this.elements[`comp${param.charAt(0).toUpperCase() + param.slice(1)}Value`];
        const value = parseFloat(element.value);
        let displayValue;
        switch (param) {
            case 'threshold':
                displayValue = `${value}dB`;
                break;
            case 'ratio':
                displayValue = `${value}:1`;
                break;
            case 'attack':
                displayValue = `${(value * 1000).toFixed(0)}ms`;
                break;
            case 'release':
                displayValue = `${(value * 1000).toFixed(0)}ms`;
                break;
        }
        valueDisplay.textContent = displayValue;
        if (this.feedbackEnabled && this.feedbackNodes.compressor) {
            const compressor = this.feedbackNodes.compressor;
            switch (param) {
                case 'threshold':
                    compressor.threshold.setValueAtTime(value, this.context.currentTime);
                    break;
                case 'ratio':
                    compressor.ratio.setValueAtTime(value, this.context.currentTime);
                    break;
                case 'attack':
                    compressor.attack.setValueAtTime(value, this.context.currentTime);
                    break;
                case 'release':
                    compressor.release.setValueAtTime(value, this.context.currentTime);
                    break;
            }
            this.log(`Compressor ${param} set to ${displayValue}`, 'info');
        }
    }

    reconnectAudioChain() {
        this.log('Rebuilding audio chain...', 'info');
        
        try {
            // Disconnect all existing connections
            this.effectNodes.forEach((node, index) => {
                try {
                    node.disconnect();
                } catch (e) {
                    // Node might already be disconnected
                }
            });

            if (this.inputSource) {
                try {
                    this.inputSource.disconnect();
                } catch (e) {
                    // Source might already be disconnected
                }
            }

            if (this.feedbackNodes.lowShelf) {
                try {
                    this.feedbackNodes.lowShelf.disconnect();
                    this.feedbackNodes.midPeaking.disconnect();
                    this.feedbackNodes.highShelf.disconnect();
                    this.feedbackNodes.compressor.disconnect();
                } catch (e) {
                    // Nodes might already be disconnected
                }
            }

            // Disconnect master gain from analyser temporarily
            try {
                this.masterGainNode.disconnect();
            } catch (e) {
                // Already disconnected
            }
        } catch (error) {
            this.log(`Error during disconnect phase: ${error.message}`, 'error');
        }

        if (!this.inputSource) {
            this.log('No input source available - audio chain cannot be built', 'info');
            // Reconnect master gain to effects analyser and destination
            this.masterGainNode.connect(this.effectsAnalyser);
            this.effectsAnalyser.connect(this.context.destination);
            return;
        }

        if (!this.masterGainNode) {
            this.log('Master gain node not available', 'error');
            return;
        }

        let currentNode = this.inputSource;
        let connectionsCount = 0;
        const connectionLog = [];

        try {
            connectionLog.push('Input Source');

            // Add feedback control if enabled
            if (this.feedbackEnabled && this.feedbackNodes.lowShelf) {
                currentNode.connect(this.feedbackNodes.lowShelf);
                currentNode = this.feedbackNodes.compressor; 
                connectionsCount++;
                connectionLog.push('Feedback EQ/Compressor');
                this.log('✓ Connected input → feedback processing', 'info');
            }

            // Get active effects with proper node validation
            const activeEffects = [];
            for (let i = 0; i < this.effectNodes.length; i++) {
                const deviceData = this.devices[i];
                const effectNode = this.effectNodes[i];
                
                if (deviceData && !deviceData.bypassed && effectNode) {
                    // Verify the effect node is valid
                    if (effectNode.connect && typeof effectNode.connect === 'function') {
                        activeEffects.push({ 
                            node: effectNode, 
                            name: deviceData.name,
                            index: i,
                            device: deviceData.device
                        });
                        this.log(`✓ Effect node validated: ${deviceData.name}`, 'info');
                    } else {
                        this.log(`✗ Invalid effect node for ${deviceData.name} - skipping`, 'error');
                    }
                }
            }

            this.log(`Found ${activeEffects.length} active effects to connect`, 'info');

            // Connect effects in sequence
            for (const effect of activeEffects) {
                try {
                    this.log(`Connecting ${currentNode.constructor.name} → ${effect.name}`, 'info');
                    currentNode.connect(effect.node);
                    currentNode = effect.node;
                    connectionsCount++;
                    connectionLog.push(effect.name);
                    this.log(`✓ Connected → ${effect.name}`, 'success');
                    
                    // Verify the connection by checking if the node has outputs
                    if (effect.node.numberOfOutputs === 0) {
                        this.log(`⚠ Warning: ${effect.name} has no outputs`, 'error');
                    }
                } catch (e) {
                    this.log(`✗ Failed to connect effect ${effect.name}: ${e.message}`, 'error');
                    // Continue with the chain using the previous node
                }
            }

            // Connect the final node to master gain
            this.log(`Connecting final node ${currentNode.constructor.name} → Master Gain`, 'info');
            currentNode.connect(this.masterGainNode);
            connectionsCount++;
            connectionLog.push('Master Output');
            
            // Reconnect master gain to effects analyser and destination
            this.masterGainNode.connect(this.effectsAnalyser);
            this.effectsAnalyser.connect(this.context.destination);
            connectionLog.push('Effects Monitor');
            connectionLog.push('Speakers/Headphones');

            const chainDescription = connectionLog.join(' → ');
            this.log(`✓ Audio chain built successfully: ${chainDescription}`, 'success');
            this.log(`Total connections: ${connectionsCount + 2}, Active effects: ${activeEffects.length}`, 'info');

            // Immediate connection test
            setTimeout(() => {
                this.testCompleteAudioChain();
                this.debugAudioChainIntegrity();
            }, 200);

        } catch (error) {
            this.log(`Critical error building audio chain: ${error.message}`, 'error');
            try {
                // Emergency fallback: direct connection
                this.inputSource.connect(this.masterGainNode);
                this.masterGainNode.connect(this.effectsAnalyser);
                this.effectsAnalyser.connect(this.context.destination);
                this.log('Emergency fallback: Input connected directly to output via analyser', 'info');
            } catch (fallbackError) {
                this.log(`Emergency fallback failed: ${fallbackError.message}`, 'error');
                this.log('Audio chain completely broken - please restart audio', 'error');
            }
        }
    }

    debugAudioChainIntegrity() {
        this.log('=== Audio Chain Integrity Check ===', 'info');
        
        // Check input source
        if (this.inputSource) {
            this.log(`✓ Input source: ${this.inputSource.constructor.name} (${this.inputSource.numberOfOutputs} outputs)`, 'info');
        } else {
            this.log('✗ No input source', 'error');
        }

        // Check each effect
        this.devices.forEach((deviceData, index) => {
            if (!deviceData.bypassed) {
                const effectNode = this.effectNodes[index];
                if (effectNode) {
                    const inputs = effectNode.numberOfInputs || 'unknown';
                    const outputs = effectNode.numberOfOutputs || 'unknown';
                    this.log(`✓ Effect ${deviceData.name}: ${inputs} inputs, ${outputs} outputs`, 'info');
                    
                    // Check if it's an RNBO device
                    if (deviceData.device && deviceData.device.parameters) {
                        this.log(`  RNBO device with ${deviceData.device.parameters.length} parameters`, 'info');
                    }
                } else {
                    this.log(`✗ Missing effect node for ${deviceData.name}`, 'error');
                }
            }
        });

        // Check master gain and analyser
        if (this.masterGainNode) {
            this.log(`✓ Master gain: ${this.masterGainNode.gain.value.toFixed(2)}`, 'info');
        }
        if (this.effectsAnalyser) {
            this.log(`✓ Effects analyser connected`, 'info');
        }

        this.log('=== End Integrity Check ===', 'info');
    }

    testCompleteAudioChain() {
        if (!this.effectsAnalyser || !this.masterGainNode) {
            return;
        }
        
        setTimeout(() => {
            const bufferLength = this.effectsAnalyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            this.effectsAnalyser.getByteTimeDomainData(dataArray);
            let sum = 0;
            let peak = 0;
            for (let i = 0; i < bufferLength; i++) {
                const sample = Math.abs(dataArray[i] - 128);
                sum += sample;
                peak = Math.max(peak, sample);
            }
            const avgVolume = (sum / bufferLength) / 128;
            const peakVolume = peak / 128;
            const outputLevel = Math.max(avgVolume * 1.5, peakVolume * 0.8);
            if (outputLevel > 0.002) {
                this.log(`✓ Effects output confirmed: ${(outputLevel * 100).toFixed(1)}% - Effects are working!`, 'success');
            } else {
                if (this.audio.analyserNode) {
                    const inputData = new Uint8Array(this.audio.analyserNode.frequencyBinCount);
                    this.audio.analyserNode.getByteTimeDomainData(inputData);
                    let inputSum = 0;
                    for (let i = 0; i < inputData.length; i++) {
                        inputSum += Math.abs(inputData[i] - 128);
                    }
                    const inputLevel = (inputSum / inputData.length) / 128;
                    if (inputLevel > 0.002) {
                        this.log(`Input signal present (${(inputLevel * 100).toFixed(1)}%) but not reaching effects output - check effect settings`, 'error');
                    } else {
                        this.log('⚠ No signal detected at input or effects output - check input levels', 'error');
                    }
                }
            }
        }, 500); 
    }

    startEffectsVolumeMonitoring() {
        if (!this.effectsAnalyser) {
            console.log('No effects analyser available for volume monitoring');
            return;
        }

        const bufferLength = this.effectsAnalyser.frequencyBinCount;
        const timeDataArray = new Uint8Array(bufferLength);
        
        let lastUpdateTime = 0;
        const updateInterval = 50; // Update every 50ms

        const monitor = (currentTime) => {
            if (!this.effectsAnalyser) return; // Stop if analyser is destroyed
            
            requestAnimationFrame(monitor);

            // Throttle volume updates
            if (currentTime - lastUpdateTime < updateInterval) {
                return;
            }
            lastUpdateTime = currentTime;

            // Get time domain data from effects output
            this.effectsAnalyser.getByteTimeDomainData(timeDataArray);

            // Calculate volume level
            let sum = 0;
            let peak = 0;
            for (let i = 0; i < bufferLength; i++) {
                const sample = Math.abs(timeDataArray[i] - 128);
                sum += sample;
                peak = Math.max(peak, sample);
            }
            
            const avgVolume = (sum / bufferLength) / 128;
            const peakVolume = peak / 128;
            
            // Combine average and peak for responsive display
            const displayVolume = Math.max(avgVolume * 1.5, peakVolume * 0.8);
            
            // Update effects volume bar
            if (this.effectsVolumeBar) {
                this.effectsVolumeBar.style.width = `${Math.min(displayVolume, 1.0) * 100}%`;
            }
        };

        console.log('✓ Effects volume monitoring started');
        monitor(performance.now());
    }

    async startAudio() {
        try {
            this.context = new (window.AudioContext || window.webkitAudioContext)({
                latencyHint: 'interactive',
                sampleRate: 44100
            });
            if (this.context.state === 'suspended') {
                await this.context.resume();
            }
            this.audio.setAudioContext(this.context);
            this.masterGainNode = this.context.createGain();
            this.masterGainNode.gain.setValueAtTime(0.5, this.context.currentTime);
            
            // Create effects analyser for monitoring output after effects processing
            this.effectsAnalyser = this.context.createAnalyser();
            this.effectsAnalyser.fftSize = 512;
            this.effectsAnalyser.smoothingTimeConstant = 0.3;
            this.effectsAnalyser.minDecibels = -90;
            this.effectsAnalyser.maxDecibels = -10;
            
            // Connect master gain → effects analyser → destination
            this.masterGainNode.connect(this.effectsAnalyser);
            this.effectsAnalyser.connect(this.context.destination);
            
            this.isAudioStarted = true;
            this.elements.startAudio.disabled = true;
            this.elements.startAudio.textContent = 'Audio Started';
            this.elements.startAudio.style.background = 'linear-gradient(45deg, #2ed573, #1dd1a1)';
            this.log('Audio context started - ready for effects and input', 'success');
            this.log(`Audio destination: ${this.context.destination.maxChannelCount} channels, ${this.context.sampleRate}Hz`, 'info');
            if (this.elements.masterVolumeValue) {
                this.elements.masterVolumeValue.textContent = '0.50';
            }
            
            // Start effects volume monitoring
            this.startEffectsVolumeMonitoring();
        } catch (error) {
            this.log(`Failed to start audio: ${error.message}`, 'error');
        }
    }

    async toggleMicrophone() {
        if (!this.isAudioStarted) return;
        try {
            if (this.currentInputType === 'mic') {
                this.changeInputType('none');
            } else {
                this.changeInputType('mic');
            }
        } catch (error) {
            this.log(`Failed to toggle microphone: ${error.message}`, 'error');
        }
    }

    updateInputNode() {
        const inputNode = this.elements.effectsChain.querySelector('.input-node');
        if (!inputNode) return;
        const iconElement = inputNode.querySelector('.node-icon');
        const labelElement = inputNode.querySelector('.node-label');
        switch (this.currentInputType) {
            case 'mic':
                iconElement.textContent = '🎤';
                labelElement.textContent = 'Microphone';
                break;
            case 'file':
                iconElement.textContent = '🎵';
                labelElement.textContent = 'Audio File';
                break;
            case 'none':
            default:
                iconElement.textContent = '🚫';
                labelElement.textContent = 'No Input';
                break;
        }
    }

    async changeInputType(type, button = null) {
        if (!this.isAudioStarted) {
            this.log('Please start audio first', 'error');
            return;
        }
        if (button) {
            document.querySelectorAll('.input-btn').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
        }
        if (this.inputSource) {
            try {
                this.inputSource.disconnect();
                this.log('Disconnected previous input source', 'info');
            } catch (e) {
                // Node might already be disconnected
            }
            this.inputSource = null;
        }
        this.currentInputType = type;
        try {
            switch (type) {
                case 'mic':
                    if (this.context.state !== 'running') {
                        await this.context.resume();
                        this.log('Audio context resumed', 'info');
                    }
                    const deviceId = this.elements.audioInput?.value || undefined;
                    if (!deviceId || deviceId === '') {
                        this.log('Please select an audio input device from the dropdown', 'error');
                        return;
                    }
                    const micGainNode = await this.audio.selectInput(deviceId);
                    this.inputSource = micGainNode;
                    const selectedOption = this.elements.audioInput.selectedOptions[0];
                    const deviceName = selectedOption ? selectedOption.textContent : 'Unknown Device';
                    this.log(`Microphone connected: ${deviceName}`, 'success');
                    setTimeout(() => {
                        this.testInputSignal();
                    }, 500);
                    break;
                case 'file':
                    this.elements.audioFile.click();
                    return;
                case 'none':
                default:
                    this.audio.stop();
                    this.log('Audio input disabled', 'info');
                    break;
            }
            this.updateInputNode();
            setTimeout(() => {
                this.reconnectAudioChain();
            }, 100);
        } catch (error) {
            this.log(`Failed to change input type: ${error.message}`, 'error');
            this.currentInputType = 'none';
            this.updateInputNode();
        }
    }

    testInputSignal() {
        if (this.inputSource && this.audio.analyserNode) {
            const bufferLength = this.audio.analyserNode.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            let testCount = 0;
            const maxTests = 15; 
            const testSignal = () => {
                if (testCount >= maxTests) {
                    this.log('Input signal test completed', 'info');
                    return;
                }
                this.audio.analyserNode.getByteTimeDomainData(dataArray);
                let sum = 0;
                let peak = 0;
                for (let i = 0; i < bufferLength; i++) {
                    const sample = Math.abs(dataArray[i] - 128);
                    sum += sample;
                    peak = Math.max(peak, sample);
                }
                const avgVolume = (sum / bufferLength) / 128;
                const peakVolume = peak / 128;
                const displayVolume = Math.max(avgVolume * 1.5, peakVolume * 0.8);
                if (displayVolume > 0.002) {
                    this.log(`✓ Input signal detected: ${(displayVolume * 100).toFixed(1)}% - Audio chain is working`, 'success');
                    return;
                } else {
                    testCount++;
                    setTimeout(testSignal, 300); 
                }
                if (testCount === maxTests) {
                    if (this.audio.analyserNode) {
                        setTimeout(() => {
                            this.audio.analyserNode.getByteTimeDomainData(dataArray);
                            let recheck = 0;
                            for (let i = 0; i < bufferLength; i++) {
                                recheck += Math.abs(dataArray[i] - 128);
                            }
                            const recheckLevel = (recheck / bufferLength) / 128;
                            if (recheckLevel > 0.001) {
                                this.log(`✓ Signal detected on recheck: ${(recheckLevel * 100).toFixed(1)}% - Input is working`, 'success');
                            } else {
                                this.log('⚠ No input signal detected - check microphone levels and permissions', 'error');
                            }
                        }, 500);
                    }
                }
            };
            testSignal();
        }
    }

    async loadAudioFile(event) {
        const file = event.target.files[0];
        if (!file || !this.isAudioStarted) return;
        try {
            if (this.context.state !== 'running') {
                await this.context.resume();
            }
            const arrayBuffer = await file.arrayBuffer();
            const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
            if (this.inputSource && this.inputSource.stop) {
                try {
                    this.inputSource.stop();
                } catch (e) {
                    // Source might already be stopped
                }
            }
            this.inputSource = this.context.createBufferSource();
            this.inputSource.buffer = audioBuffer;
            this.inputSource.loop = true;
            this.inputSource.start();
            this.currentInputType = 'file';
            document.querySelectorAll('.input-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelector('.input-btn[data-input="file"]').classList.add('active');
            this.updateInputNode();
            this.reconnectAudioChain();
            this.log(`Loaded audio file: ${file.name}`, 'success');
        } catch (error) {
            this.log(`Failed to load audio file: ${error.message}`, 'error');
        }
    }

    handleDrop(e) {
        const files = e.dataTransfer.files;
        this.processFiles(files);
    }

    handleFileUpload(e) {
        const files = e.target.files;
        this.processFiles(files);
    }

    async processFiles(files) {
        const jsonFiles = Array.from(files).filter(file => file.name.endsWith('.json'));
        if (jsonFiles.length === 0) {
            this.log('Please upload .json RNBO export files', 'error');
            return;
        }
        if (!this.isAudioStarted) {
            this.log('Please start audio first', 'error');
            return;
        }
        for (const file of jsonFiles) {
            await this.loadRNBOPatch(file);
        }
    }

    async loadRNBOPatch(file) {
        this.showLoading(true);
        try {
            const text = await file.text();
            const patchData = JSON.parse(text);
            const { device, node } = await loadRNBOEffect(patchData, this.context);
            this.effectNodes.push(node);
            this.devices.push({ device, node, name: file.name.replace('.export.json', ''), effectName: file.name.replace('.export.json', '') });
            this.addEffectToUI(device, file.name.replace('.export.json', ''), this.devices.length - 1);
            this.reconnectAudioChain();
            this.updateControlsPanel();
            this.log(`Loaded RNBO patch: ${file.name}`, 'success');
        } catch (error) {
            this.log(`Failed to load ${file.name}: ${error.message}`, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    addEffectToUI(device, name, index) {
        const effectNode = document.createElement('div');
        effectNode.className = 'audio-node effect-node';
        effectNode.dataset.index = index;
        effectNode.innerHTML = `
            <div class="bypass-toggle active" data-index="${index}"></div>
            <div class="node-header">
                <h3>${name}</h3>
                <button class="mode-btn" onclick="parsec.removeEffect(${index})">×</button>
            </div>
            <div class="node-inputs">
                <div class="input-port" data-type="audio"></div>
            </div>
            <div class="node-outputs">
                <div class="output-port" data-type="audio"></div>
            </div>
        `;
        const outputNode = this.elements.audioGraph.querySelector('.output-node');
        this.elements.audioGraph.insertBefore(effectNode, outputNode);
        const bypassToggle = effectNode.querySelector('.bypass-toggle');
        bypassToggle.addEventListener('click', () => this.toggleBypass(index));
        this.makeDraggable(effectNode);
    }

    addEffectToChain(device, name, index) {
        this.rebuildEffectsChain();
    }

    toggleBypass(index) {
        const deviceData = this.devices[index];
        if (!deviceData) return;
        const toggle = document.querySelector(`.bypass-toggle[data-index="${index}"]`);
        const isActive = toggle && toggle.classList.contains('active');
        toggle.classList.toggle('active');
        this.log(`Effect ${deviceData.name} ${isActive ? 'bypassed' : 'enabled'}`, 'info');
        this.reconnectAudioChain();
    }

    removeEffect(index) {
        if (index < 0 || index >= this.devices.length) return;
        const deviceData = this.devices[index];
        const effectName = deviceData.effectName;
        const button = document.querySelector(`[data-effect="${effectName}"]`);
        if (button) {
            button.classList.remove('active');
        }
        this.devices.splice(index, 1);
        this.effectNodes.splice(index, 1);
        this.rebuildEffectsChain();
        this.updateControlsPanel();
        this.reconnectAudioChain();
        this.log(`Removed effect: ${deviceData.name}`, 'info');
    }

    rebuildEffectsChain() {
        const chain = this.elements.effectsChain;
        const inputNode = chain.querySelector('.input-node');
        const outputNode = chain.querySelector('.output-node');
        const inputClone = inputNode.cloneNode(true);
        const outputClone = outputNode.cloneNode(true);
        chain.innerHTML = '';
        chain.appendChild(inputClone);
        this.devices.forEach((deviceData, index) => {
            const connector = document.createElement('div');
            connector.className = 'chain-connector';
            chain.appendChild(connector);
            const effectNode = document.createElement('div');
            effectNode.className = 'chain-node effect-node';
            effectNode.dataset.index = index;
            effectNode.innerHTML = `
                <button class="remove-btn" onclick="parsec.removeEffect(${index})" title="Remove effect">×</button>
                <div class="node-icon">🎵</div>
                <div class="node-label">${deviceData.name}</div>
            `;
            chain.appendChild(effectNode);
            this.makeDraggable(effectNode);
        });
        if (this.devices.length > 0) {
            const finalConnector = document.createElement('div');
            finalConnector.className = 'chain-connector';
            chain.appendChild(finalConnector);
        }
        chain.appendChild(outputClone);
    }

    showLoading(show) {
        this.elements.loadingOverlay.style.display = show ? 'flex' : 'none';
    }

    switchTab(tabName) {
        this.elements.tabButtons.forEach(button => {
            button.classList.toggle('active', button.dataset.tab === tabName);
        });
        this.elements.tabContents.forEach(content => {
            if (content.id === `${tabName}-tab`) {
                content.classList.remove('hidden');
            } else {
                content.classList.add('hidden');
            }
        });
        this.activeTab = tabName;
        this.log(`Switched to ${tabName} tab`, 'info');
    }

    selectMode(button) {
        this.elements.modeButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        this.currentMode = parseInt(button.dataset.mode);
        this.stopRandomMode();
        if (this.currentMode === 3) {
            this.elements.intervalValue.textContent = 'Random Mode Active';
            this.elements.intervalSlider.disabled = true;
            this.elements.intervalSlider.style.opacity = '0.5';
            if (this.isConnected) {
                this.startRandomMode();
            }
        } else {
            this.elements.intervalSlider.disabled = false;
            this.elements.intervalSlider.style.opacity = '1';
            this.updateInterval();
        }
        this.updateMode();
    }

    startRandomMode() {
        if (this.randomModeTimer) {
            clearTimeout(this.randomModeTimer);
        }
        this.log('Starting random mode...', 'info');
        this.scheduleNextRandomAction();
    }

    stopRandomMode() {
        if (this.randomModeTimer) {
            clearTimeout(this.randomModeTimer);
            this.randomModeTimer = null;
        }
        if (this.isRandomBuzzing && this.isConnected) {
            this.bluetooth.setMode(0); 
            this.isRandomBuzzing = false;
        }
        this.currentRandomBuzzDuration = 0;
        this.currentRandomSilenceDuration = 0;
        this.updateRandomModeDisplay();
    }

    scheduleNextRandomAction() {
        if (this.currentMode !== 3 || !this.isConnected) {
            return;
        }
        if (this.isRandomBuzzing) {
            this.currentRandomSilenceDuration = this.generateRandomDuration();
            this.bluetooth.setMode(0);
            this.isRandomBuzzing = false;
            this.log(`Random mode: Starting ${this.currentRandomSilenceDuration}s silence`, 'info');
            this.updateRandomModeDisplay();
            this.randomModeTimer = setTimeout(() => {
                this.scheduleNextRandomAction();
            }, this.currentRandomSilenceDuration * 1000);
        } else {
            this.currentRandomBuzzDuration = this.generateRandomDuration();
            this.bluetooth.setMode(1);
            this.isRandomBuzzing = true;
            this.log(`Random mode: Starting ${this.currentRandomBuzzDuration}s buzz`, 'info');
            this.updateRandomModeDisplay();
            this.randomModeTimer = setTimeout(() => {
                this.scheduleNextRandomAction();
            }, this.currentRandomBuzzDuration * 1000);
        }
    }

    generateRandomDuration() {
        return Math.random() * 9 + 1; 
    }

    updateRandomModeDisplay() {
        if (this.currentMode === 3) {
            let statusText = 'Random Mode: ';
            if (this.isRandomBuzzing && this.currentRandomBuzzDuration > 0) {
                statusText += `Buzzing for ${this.currentRandomBuzzDuration.toFixed(1)}s`;
            } else if (!this.isRandomBuzzing && this.currentRandomSilenceDuration > 0) {
                statusText += `Silent for ${this.currentRandomSilenceDuration.toFixed(1)}s`;
            } else {
                statusText += 'Initializing...';
            }
            this.elements.intervalValue.textContent = statusText;
        }
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
            this.elements.connectBtn.disabled = true;
            this.elements.connectBtn.textContent = 'Connecting...';
            this.log('Attempting to connect to BuzzBox...', 'info');
            await this.bluetooth.connect();
        } catch (error) {
            this.log(`Connection failed: ${error.message}`, 'error');
            this.elements.connectBtn.disabled = false;
            this.elements.connectBtn.textContent = 'Connect BuzzBox';
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
        this.elements.statusText.textContent = 'Connected';
        this.elements.statusIndicator.querySelector('.status-dot').classList.add('connected');
        this.elements.connectBtn.textContent = 'Disconnect';
        this.elements.connectBtn.disabled = false;
        this.elements.batteryIndicator.style.display = 'flex';
        this.log('Connected to BuzzBox', 'success');
        this.currentMode = 0;
        this.updateMode();
        this.updateStrength();
        this.updateInterval();
        if (this.currentMode === 3) {
            this.startRandomMode();
        }
    }

    onBluetoothDisconnected() {
        this.isConnected = false;
        this.elements.statusText.textContent = 'Disconnected';
        this.elements.statusIndicator.querySelector('.status-dot').classList.remove('connected');
        this.elements.connectBtn.textContent = 'Connect BuzzBox';
        this.elements.connectBtn.disabled = false;
        this.elements.batteryIndicator.style.display = 'none';
        this.stopRandomMode();
        if (this.elements.batteryLevel) {
            this.elements.batteryLevel.textContent = '--';
        }
        this.log('Disconnected from BuzzBox', 'info');
    }

    onBluetoothError(error) {
        this.log(`Bluetooth error: ${error}`, 'error');
        this.elements.connectBtn.disabled = false;
        this.elements.connectBtn.textContent = 'Connect BuzzBox';
    }

    onBatteryUpdate(batteryLevel) {
        if (this.elements.batteryLevel) {
            if (batteryLevel !== null && batteryLevel !== undefined) {
                this.elements.batteryLevel.textContent = `${batteryLevel}%`;
                const batteryIcon = this.elements.batteryIndicator.querySelector('.battery-icon');
                if (batteryLevel <= 20) {
                    batteryIcon.style.color = '#ff4757'; 
                } else if (batteryLevel <= 50) {
                    batteryIcon.style.color = '#ffa502'; 
                } else {
                    batteryIcon.style.color = '#2ed573'; 
                }
                this.log(`BuzzBox battery: ${batteryLevel}%`, 'info');
            } else {
                this.elements.batteryLevel.textContent = '--';
                const batteryIcon = this.elements.batteryIndicator.querySelector('.battery-icon');
                batteryIcon.style.color = '#888'; 
                this.log('BuzzBox battery level unavailable', 'info');
            }
        }
    }

    async updateMode() {
        const mode = this.currentMode || 0;
        if (this.isConnected) {
            try {
                const deviceMode = (this.currentMode === 3) ? (this.isRandomBuzzing ? 1 : 0) : mode;
                await this.bluetooth.setMode(deviceMode);
                if (this.currentMode !== 3) {
                    this.log(`Mode set to: ${['Off', 'Continuous', 'Intermittent', 'Random'][mode]}`, 'info');
                }
            } catch (error) {
                this.log(`Failed to set mode: ${error.message}`, 'error');
            }
        }
    }

    async updateInterval() {
        const interval = parseInt(this.elements.intervalSlider.value);
        const intervalText = this.currentMode === 3 ? 'Random Mode Active' : `${interval}s`;
        this.elements.intervalValue.textContent = intervalText;
        if (this.isConnected) {
            try {
                await this.bluetooth.setInterval(interval);
                this.log(`Interval set to: ${intervalText}`, 'info');
            } catch (error) {
                this.log(`Failed to set interval: ${error.message}`, 'error');
            }
        }
    }

    updateVolume() {
        const volume = parseFloat(this.elements.volumeSlider.value);
        if (this.elements.volumeValue) {
            this.elements.volumeValue.textContent = volume.toFixed(2);
        }
        this.audio.setVolume(volume);
    }

    async selectAudioInput() {
        const deviceId = this.elements.audioInput.value;
        if (deviceId && this.currentInputType === 'mic') {
            try {
                const micGainNode = await this.audio.selectInput(deviceId);
                this.inputSource = micGainNode;
                this.reconnectAudioChain();
                this.log(`Audio input selected: ${this.elements.audioInput.selectedOptions[0].text}`, 'info');
            } catch (error) {
                this.log(`Failed to select audio input: ${error.message}`, 'error');
            }
        }
    }

    async refreshAudioInputs() {
        try {
            const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            tempStream.getTracks().forEach(track => track.stop());
            const devices = await this.audio.getAudioInputs();
            if (this.elements.audioInput) {
                while (this.elements.audioInput.children.length > 1) {
                    this.elements.audioInput.removeChild(this.elements.audioInput.lastChild);
                }
                devices.forEach(device => {
                    const option = document.createElement('option');
                    option.value = device.deviceId;
                    option.textContent = device.label || `Microphone ${device.deviceId.substr(0, 8)}`;
                    this.elements.audioInput.appendChild(option);
                });
                this.log(`Found ${devices.length} audio input devices`, 'info');
            }
        } catch (error) {
            this.log(`Failed to refresh audio inputs: ${error.message}`, 'error');
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
        this.elements.logContainer.appendChild(logEntry);
        this.elements.logContainer.scrollTop = this.elements.logContainer.scrollHeight;
        while (this.elements.logContainer.children.length > 50) {
            this.elements.logContainer.removeChild(this.elements.logContainer.firstChild);
        }
    }

    clearLog() {
        this.elements.logContainer.innerHTML = '';
        this.log('Log cleared', 'info');
    }

    async randomiseEffects() {
        if (!this.isAudioStarted) {
            this.log('Please start audio first', 'error');
            return;
        }
        const availableEffects = [
            'rnbo.overdrive', 'rnbo.chorus', 'rnbo.tremolo', 'rnbo.vibrato',
            'rnbo.flanger', 'rnbo.wahwah', 'rnbo.ringmod', 'rnbo.freqshifter',
            'rnbo.pitchshifter', 'rnbo.octaver', 'rnbo.filterdelay', 'rnbo.platereverb',
            'rnbo.looper', 'rnbo.freezer', 'rnbo.guitarsynth'
        ];
        const numEffects = Math.floor(Math.random() * 4) + 2;
        const selectedEffects = [];
        while (selectedEffects.length < numEffects && selectedEffects.length < availableEffects.length) {
            const randomEffect = availableEffects[Math.floor(Math.random() * availableEffects.length)];
            if (!selectedEffects.includes(randomEffect)) {
                selectedEffects.push(randomEffect);
            }
        }
        const randomiseBtn = document.getElementById('randomiseEffects');
        const originalText = randomiseBtn.textContent;
        randomiseBtn.disabled = true;
        randomiseBtn.textContent = '🎲 Loading...';
        this.log(`Switching to new effects: ${selectedEffects.map(e => e.replace('rnbo.', '')).join(', ')}`, 'info');
        try {
            const fadeTime = 0.3; 
            const originalVolume = this.masterGainNode.gain.value;
            this.masterGainNode.gain.setTargetAtTime(0, this.context.currentTime, fadeTime / 3);
            await new Promise(resolve => setTimeout(resolve, fadeTime * 1000));
            this.clearEffectsChain();
            for (const effectName of selectedEffects) {
                try {
                    const { device, node } = await loadBuiltInEffect(effectName, this.context);
                    const displayName = effectName.replace('rnbo.', '').replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                    this.effectNodes.push(node);
                    this.devices.push({
                        device,
                        node,
                        name: displayName,
                        effectName,
                        bypassed: Math.random() < 0.1
                    });
                    const button = document.querySelector(`[data-effect="${effectName}"]`);
                    if (button) button.classList.add('active');
                } catch (error) {
                    this.log(`Failed to load ${effectName}: ${error.message}`, 'error');
                }
            }
            this.rebuildEffectsChain();
            this.updateControlsPanel();
            this.establishStableParameterMapping();
            this.log(`Hand gesture mapping updated for new effects`, 'info');
            await new Promise(resolve => setTimeout(resolve, 50));
            this.masterGainNode.gain.setTargetAtTime(originalVolume, this.context.currentTime, fadeTime / 3);
            this.log(`Successfully loaded ${this.devices.length} new effects with updated gesture mapping`, 'success');
        } catch (error) {
            this.log(`Failed to randomise effects: ${error.message}`, 'error');
            this.masterGainNode.gain.setValueAtTime(0.5, this.context.currentTime);
        } finally {
            this.showLoading(false);
            randomiseBtn.disabled = false;
            randomiseBtn.textContent = originalText;
        }
    }

    async toggleEffect(effectName, button) {
        if (!this.isAudioStarted) {
            this.log('Please start audio first', 'error');
            return;
        }

        const isActive = button.classList.contains('active');
        
        if (isActive) {
            // Remove effect
            const deviceIndex = this.devices.findIndex(d => d.effectName === effectName);
            if (deviceIndex !== -1) {
                this.removeEffect(deviceIndex);
            }
        } else {
            // Add effect
            this.showLoading(true);
            try {
                const { device, node } = await loadBuiltInEffect(effectName, this.context);
                const displayName = effectName.replace('rnbo.', '').replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                
                // Validate the node before adding
                if (!node || typeof node.connect !== 'function') {
                    throw new Error(`Invalid audio node returned for ${effectName}`);
                }

                this.log(`Loaded ${displayName} - Node type: ${node.constructor.name}, Inputs: ${node.numberOfInputs}, Outputs: ${node.numberOfOutputs}`, 'info');

                this.effectNodes.push(node);
                this.devices.push({
                    device,
                    node,
                    name: displayName,
                    effectName,
                    bypassed: false
                });

                button.classList.add('active');
                this.addEffectToChain(device, displayName, this.devices.length - 1);
                this.reconnectAudioChain();
                this.updateControlsPanel();
                this.establishStableParameterMapping();
                this.log(`Added effect: ${displayName}`, 'success');

                // Test the specific effect after a short delay
                setTimeout(() => {
                    this.testEffectOutput(displayName, this.devices.length - 1);
                }, 300);

            } catch (error) {
                this.log(`Failed to load ${effectName}: ${error.message}`, 'error');
                // Make sure button state is correct
                button.classList.remove('active');
            } finally {
                this.showLoading(false);
            }
        }
    }

    testEffectOutput(effectName, deviceIndex) {
        if (!this.effectsAnalyser || deviceIndex >= this.devices.length) {
            return;
        }

        const deviceData = this.devices[deviceIndex];
        if (!deviceData || deviceData.bypassed) {
            return;
        }

        // Test if the effect is processing audio
        setTimeout(() => {
            const bufferLength = this.effectsAnalyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            this.effectsAnalyser.getByteTimeDomainData(dataArray);
            
            let sum = 0;
            let peak = 0;
            for (let i = 0; i < bufferLength; i++) {
                const sample = Math.abs(dataArray[i] - 128);
                sum += sample;
                peak = Math.max(peak, sample);
            }
            
            const avgVolume = (sum / bufferLength) / 128;
            const peakVolume = peak / 128;
            const outputLevel = Math.max(avgVolume * 1.5, peakVolume * 0.8);
            
            if (outputLevel > 0.002) {
                this.log(`✓ ${effectName} is processing audio: ${(outputLevel * 100).toFixed(1)}% output`, 'success');
            } else {
                this.log(`⚠ ${effectName} may not be processing audio - check input signal and effect settings`, 'error');
                
                // Check if input is present
                if (this.audio.analyserNode) {
                    const inputData = new Uint8Array(this.audio.analyserNode.frequencyBinCount);
                    this.audio.analyserNode.getByteTimeDomainData(inputData);
                    let inputSum = 0;
                    for (let i = 0; i < inputData.length; i++) {
                        inputSum += Math.abs(inputData[i] - 128);
                    }
                    const inputLevel = (inputSum / inputData.length) / 128;
                    
                    if (inputLevel > 0.002) {
                        this.log(`Input signal present (${(inputLevel * 100).toFixed(1)}%) but ${effectName} not outputting - check effect parameters`, 'error');
                    }
                }
            }
        }, 500);
    }

    async playAudio() {
        if (!this.isAudioStarted || !this.masterGainNode) {
            this.log('Please start audio first', 'error');
            return;
        }
        if (this.context.state !== 'running') {
            await this.context.resume();
            this.log('Audio context resumed for playback', 'info');
        }
        if (!this.inputSource) {
            this.log('No audio input source selected. Please select microphone or audio file first.', 'error');
            return;
        }
        this.log('Verifying audio chain before playback...', 'info');
        setTimeout(() => {
            this.testInputSignal();
        }, 100);
        const targetVolume = parseFloat(this.elements.masterVolume?.value || 0.5);
        const currentVolume = this.masterGainNode.gain.value;
        if (currentVolume < 0.1) {
            this.masterGainNode.gain.cancelScheduledValues(this.context.currentTime);
            this.masterGainNode.gain.setValueAtTime(0.1, this.context.currentTime);
            this.masterGainNode.gain.linearRampToValueAtTime(targetVolume, this.context.currentTime + 1.0);
            this.log(`Audio fading in from ${currentVolume.toFixed(2)} to ${targetVolume.toFixed(2)}`, 'info');
        } else {
            this.masterGainNode.gain.setValueAtTime(targetVolume, this.context.currentTime);
            this.log(`Audio volume set to ${targetVolume.toFixed(2)}`, 'info');
        }
        if (this.elements.playAudio) {
            this.elements.playAudio.disabled = false;
            this.elements.playAudio.textContent = '▶ Play';
        }
        if (this.elements.pauseAudio) {
            this.elements.pauseAudio.disabled = false;
            this.elements.pauseAudio.textContent = '⏸ Pause';
        }
        this.isAudioPlaying = true;
        this.updateAudioStatusIndicator();
        const inputDesc = this.currentInputType === 'mic' ? 
            `microphone (${this.elements.audioInput?.selectedOptions[0]?.text || 'default'})` : 
            this.currentInputType;
        const effectsDesc = this.devices.filter(d => !d.bypassed).length;
        const feedbackDesc = this.feedbackEnabled ? ' + feedback control' : '';
        this.log(`▶ Audio playing: ${inputDesc} → ${effectsDesc} effects${feedbackDesc} → output`, 'success');
    }

    async pauseAudio() {
        if (!this.isAudioStarted || !this.masterGainNode) {
            this.log('Audio not available', 'error');
            return;
        }
        const fadeTime = 2.0;
        const currentVolume = this.masterGainNode.gain.value;
        this.masterGainNode.gain.cancelScheduledValues(this.context.currentTime);
        this.masterGainNode.gain.setValueAtTime(currentVolume, this.context.currentTime);
        this.masterGainNode.gain.linearRampToValueAtTime(0.001, this.context.currentTime + fadeTime);
        if (this.elements.pauseAudio) {
            this.elements.pauseAudio.disabled = true;
            this.elements.pauseAudio.textContent = '⏸ Pausing...';
        }
        if (this.elements.playAudio) {
            this.elements.playAudio.disabled = false;
            this.elements.playAudio.textContent = '▶ Play';
        }
        this.isAudioPlaying = false;
        this.updateAudioStatusIndicator();
        this.log(`Audio fading out from ${currentVolume.toFixed(2)} to silence...`, 'info');
        setTimeout(() => {
            if (this.elements.pauseAudio) {
                this.elements.pauseAudio.disabled = false;
                this.elements.pauseAudio.textContent = '⏸ Pause';
            }
        }, fadeTime * 1000);
    }

    updateAudioStatusIndicator() {
        if (this.elements.audioStatusIndicator) {
            const statusLabel = this.elements.audioStatusIndicator.querySelector('.status-label');
            const indicator = this.elements.audioStatusIndicator;
            if (this.isAudioPlaying) {
                indicator.classList.add('playing');
                statusLabel.textContent = 'ON';
            } else {
                indicator.classList.remove('playing');
                statusLabel.textContent = 'OFF';
            }
        }
    }

    async toggleAudio() {
        if (!this.isAudioStarted) {
            await this.startAudio();
            setTimeout(() => {
                if (!this.inputSource) {
                    this.log('Audio started. Please select an input source (microphone or file) to hear sound.', 'info');
                } else {
                    this.playAudio();
                }
            }, 100);
            this.log('Spacebar: Started audio engine', 'info');
            return;
        }
        if (this.isAudioPlaying) {
            this.pauseAudio();
            this.log('Spacebar: Pausing audio', 'info');
        } else {
            this.playAudio();
            this.log('Spacebar: Playing audio', 'info');
        }
    }

    async selectInput(deviceId) {
        try {
            if (!this.audioContext) {
                throw new Error('Audio context not initialized. Please start audio first.');
            }
            if (this.audioContext.state !== 'running') {
                await this.audioContext.resume();
            }
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    deviceId: deviceId ? { exact: deviceId } : undefined,
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    latency: 0.001,
                    channelCount: 1,
                    sampleRate: 44100,
                    sampleSize: 16
                }
            });
            this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
            this.gainNode = this.audioContext.createGain();
            this.analyserNode = this.audioContext.createAnalyser();
            this.analyserNode.fftSize = 512;
            this.analyserNode.smoothingTimeConstant = 0.8;
            this.analyserNode.minDecibels = -90;
            this.analyserNode.maxDecibels = -10;
            this.sourceNode.connect(this.gainNode);
            this.sourceNode.connect(this.analyserNode);
            this.startVisualization();
            return this.gainNode;
        } catch (error) {
            this.emit('error', error.message);
            throw error;
        }
    }

    setVolume(volume) {
        if (this.gainNode) {
            this.gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
        }
    }

    startVisualization() {
        // Implementation for visualization
    }

    stop() {
        // Implementation for stopping audio
    }

    toggleWebcam() {
        this.webcamVisible = !this.webcamVisible;
        this.elements.webcamContainer.style.display = this.webcamVisible ? 'block' : 'none';
        this.elements.toggleWebcam.textContent = this.webcamVisible ? 'Hide Webcam' : 'Show Webcam';
        const gestureInfo = document.getElementById('gestureInfo');
        if (gestureInfo) {
            gestureInfo.style.display = this.webcamVisible ? 'block' : 'none';
        }
    }

    async toggleHandTracking() {
        try {
            if (this.isHandTrackingActive) {
                if (this.camera) {
                    this.camera.stop();
                    this.camera = null;
                }
                this.isHandTrackingActive = false;
                this.elements.toggleHandTracking.textContent = 'Start Hand Tracking';
                this.log('Hand tracking stopped', 'info');
            } else {
                if (!this.hands) {
                    this.log('MediaPipe Hands not initialized', 'error');
                    return;
                }
                this.camera = new Camera(this.elements.webcamVideo, {
                    onFrame: async () => {
                        await this.hands.send({ image: this.elements.webcamVideo });
                    },
                    width: 320,
                    height: 240
                });
                await this.camera.start();
                this.isHandTrackingActive = true;
                this.elements.toggleHandTracking.textContent = 'Stop Hand Tracking';
                this.log('Hand tracking started', 'success');
            }
        } catch (error) {
            this.log(`Hand tracking error: ${error.message}`, 'error');
        }
    }

    onHandResults(results) {
        const canvas = this.elements.webcamCanvas;
        const ctx = canvas.getContext('2d');
        canvas.width = this.elements.webcamVideo.videoWidth;
        canvas.height = this.elements.webcamVideo.videoHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (results.multiHandLandmarks && results.multiHandedness) {
            for (let i = 0; i < results.multiHandLandmarks.length; i++) {
                const landmarks = results.multiHandLandmarks[i];
                const handedness = results.multiHandedness[i];
                if (handedness.label === 'Right') {
                    if (this.webcamVisible) {
                        this.drawHandLandmarks(ctx, landmarks);
                    }
                    if (this.devices.length > 0) {
                        const activeDevice = this.devices.find(d => !d.bypassed);
                        if (activeDevice) {
                            this.applyGestureToRNBO(activeDevice.device, landmarks);
                        }
                    }
                }
            }
        }
    }

    drawHandLandmarks(ctx, landmarks) {
        ctx.strokeStyle = '#4ecdc4';
        ctx.lineWidth = 2;
        const connections = [
            [0, 1], [1, 2], [2, 3], [3, 4], 
            [0, 5], [5, 6], [6, 7], [7, 8], 
            [0, 9], [9, 10], [10, 11], [11, 12], 
            [0, 13], [13, 14], [14, 15], [15, 16], 
            [0, 17], [17, 18], [18, 19], [19, 20], 
            [5, 9], [9, 13], [13, 17] 
        ];
        connections.forEach(([start, end]) => {
            const startPoint = landmarks[start];
            const endPoint = landmarks[end];
            ctx.beginPath();
            ctx.moveTo(startPoint.x * ctx.canvas.width, startPoint.y * ctx.canvas.height);
            ctx.lineTo(endPoint.x * ctx.canvas.width, endPoint.y * ctx.canvas.height);
            ctx.stroke();
        });
        ctx.fillStyle = '#ff6b6b';
        landmarks.forEach(landmark => {
            ctx.beginPath();
            ctx.arc(
                landmark.x * ctx.canvas.width,
                landmark.y * ctx.canvas.height,
                3, 0, 2 * Math.PI
            );
            ctx.fill();
        });
    }

    applyGestureToRNBO(device, landmarks) {
        const now = performance.now();
        if (now - this.lastGestureTime < 50) { 
            return;
        }
        this.lastGestureTime = now;
        const wrist = landmarks[0];
        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
        const middleTip = landmarks[12];
        const ringTip = landmarks[16];
        const pinkyTip = landmarks[20];
        const rawXParam = (wrist.x - 0.5) * 2; 
        const clampedX = Math.max(-1, Math.min(1, rawXParam * 1.2)); 
        this.gestureSmoothing.pan = this.smoothValue(this.gestureSmoothing.pan, clampedX, 0.15);
        const rawYParam = 1 - wrist.y; 
        const clampedY = Math.max(0, Math.min(1, rawYParam * 1.1)); 
        this.gestureSmoothing.primaryParam = this.smoothValue(this.gestureSmoothing.primaryParam, clampedY, 0.15);
        const indexToWristDist = Math.sqrt(
            Math.pow(indexTip.x - wrist.x, 2) + 
            Math.pow(indexTip.y - wrist.y, 2)
        );
        const middleToWristDist = Math.sqrt(
            Math.pow(middleTip.x - wrist.x, 2) + 
            Math.pow(middleTip.y - wrist.y, 2)
        );
        const ringToWristDist = Math.sqrt(
            Math.pow(ringTip.x - wrist.x, 2) + 
            Math.pow(ringTip.y - wrist.y, 2)
        );
        const pinkyToWristDist = Math.sqrt(
            Math.pow(pinkyTip.x - wrist.x, 2) + 
            Math.pow(pinkyTip.y - wrist.y, 2)
        );
        const avgWristDistance = (indexToWristDist + middleToWristDist + ringToWristDist + pinkyToWristDist) / 4;
        let handOpenness = (avgWristDistance - 0.12) / (0.25 - 0.12);
        handOpenness = Math.max(0, Math.min(1, handOpenness));
        const handCurl = 1 - handOpenness;
        this.gestureSmoothing.volume = this.smoothValue(this.gestureSmoothing.volume, handCurl, 0.2);
        this.establishStableParameterMapping();
        let xValue = 0, yValue = 0, curlValue = 0;
        if (this.gestureParameterMapping.wristX.deviceIndex !== null) {
            const deviceData = this.devices[this.gestureParameterMapping.wristX.deviceIndex];
            if (deviceData && !deviceData.bypassed && deviceData.device.parameters) {
                const param = deviceData.device.parameters[this.gestureParameterMapping.wristX.paramIndex];
                if (param) {
                    xValue = this.mapRange(this.gestureSmoothing.pan, -1, 1, param.min, param.max);
                    param.value = xValue;
                    if (deviceData.device.parametersById && deviceData.device.parametersById.get(param.id)) {
                        deviceData.device.parametersById.get(param.id).value = xValue;
                    }
                    try {
                        if (deviceData.device.setParameterValue) {
                            deviceData.device.setParameterValue(param.id, xValue);
                        }
                    } catch (e) {
                        // Fallback - parameter might be set via different method
                    }
                }
            }
        }
        if (this.gestureParameterMapping.wristY.deviceIndex !== null) {
            const deviceData = this.devices[this.gestureParameterMapping.wristY.deviceIndex];
            if (deviceData && !deviceData.bypassed && deviceData.device.parameters) {
                const param = deviceData.device.parameters[this.gestureParameterMapping.wristY.paramIndex];
                if (param) {
                    yValue = this.mapRange(this.gestureSmoothing.primaryParam, 0, 1, param.min, param.max);
                    param.value = yValue;
                    if (deviceData.device.parametersById && deviceData.device.parametersById.get(param.id)) {
                        deviceData.device.parametersById.get(param.id).value = yValue;
                    }
                    try {
                        if (deviceData.device.setParameterValue) {
                            deviceData.device.setParameterValue(param.id, yValue);
                        }
                    } catch (e) {
                        // Alternative parameter setting method
                    }
                }
            }
        }
        if (this.gestureParameterMapping.handCurl.deviceIndex !== null) {
            const deviceData = this.devices[this.gestureParameterMapping.handCurl.deviceIndex];
            if (deviceData && !deviceData.bypassed && deviceData.device.parameters) {
                const param = deviceData.device.parameters[this.gestureParameterMapping.handCurl.paramIndex];
                if (param) {
                    curlValue = this.mapRange(this.gestureSmoothing.volume, 0, 1, param.min, param.max);
                    param.value = curlValue;
                    if (deviceData.device.parametersById && deviceData.device.parametersById.get(param.id)) {
                        const rnboParam = deviceData.device.parametersById.get(param.id);
                        rnboParam.value = curlValue;
                    }
                    try {
                        if (deviceData.device.setParameterValue) {
                            deviceData.device.setParameterValue(param.id, curlValue);
                        }
                    } catch (e) {
                        // Alternative approach
                        try {
                            if (deviceData.device.parameters && deviceData.device.parameters[this.gestureParameterMapping.handCurl.paramIndex]) {
                                deviceData.device.parameters[this.gestureParameterMapping.handCurl.paramIndex].value = curlValue;
                            }
                        } catch (e2) {
                            // Log if we can't set the parameter
                            if (now % 2000 < 50) { 
                                this.log(`Could not apply hand curl to parameter ${param.name || param.id}`, 'error');
                            }
                        }
                    }
                }
            }
        }
        this.updateGestureDisplay('panParamName', this.gestureParameterMapping.wristX.paramName);
        this.updateGestureDisplay('panParamValue', this.gestureSmoothing.pan.toFixed(2));
        this.updateGestureDisplay('primaryParamName', this.gestureParameterMapping.wristY.paramName);
        this.updateGestureDisplay('primaryParamValue', this.gestureSmoothing.primaryParam.toFixed(2));
        this.updateGestureDisplay('volumeParamName', this.gestureParameterMapping.handCurl.paramName);
        this.updateGestureDisplay('volumeParamValue', `${this.gestureSmoothing.volume.toFixed(2)} (${(this.gestureSmoothing.volume * 100).toFixed(0)}%)`);
        this.updateControlsPanelGestureValues();
        if (now % 1000 < 50) { 
            this.log(`Hand Gestures - X: ${this.gestureSmoothing.pan.toFixed(2)}, Y: ${this.gestureSmoothing.primaryParam.toFixed(2)}, Curl: ${this.gestureSmoothing.volume.toFixed(2)} (avg dist: ${avgWristDistance.toFixed(3)})`, 'info');
            if (this.gestureParameterMapping.handCurl.paramName !== 'None') {
                this.log(`Hand curl mapped to: ${this.gestureParameterMapping.handCurl.paramName}, value: ${curlValue.toFixed(2)}`, 'info');
            }
        }
    }

    updateControlsPanelGestureValues() {
        this.devices.forEach((deviceData, deviceIndex) => {
            if (deviceData.bypassed) return;
            const { device } = deviceData;
            if (device.parameters) {
                device.parameters.forEach(param => {
                    const slider = document.querySelector(`input[data-param-id="${param.id}"]`);
                    const valueDisplay = document.querySelector(`span[data-param-id="${param.id}"]`);
                    if (slider) {
                        slider.value = param.value;
                    }
                    if (valueDisplay) {
                        valueDisplay.textContent = param.value.toFixed(2);
                    }
                });
            }
        });
    }

    updateGestureDisplay(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value;
        }
    }

    smoothValue(current, target, factor) {
        const diff = target - current;
        const adaptiveFactor = factor * (1 + Math.abs(diff) * 2);
        return current + (diff * Math.min(adaptiveFactor, 0.3));
    }

    mapRange(value, inMin, inMax, outMin, outMax) {
        return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
    }

    establishStableParameterMapping() {
        if (this.devices.length === 0) {
            this.gestureParameterMapping = {
                wristX: { deviceIndex: null, paramIndex: null, paramName: 'None' },
                wristY: { deviceIndex: null, paramIndex: null, paramName: 'None' },
                handCurl: { deviceIndex: null, paramIndex: null, paramName: 'None' }
            };
            return;
        }
        const availableParams = [];
        this.devices.forEach((deviceData, deviceIndex) => {
            if (deviceData.bypassed) return;
            if (deviceData.device.parameters) {
                deviceData.device.parameters.forEach((param, paramIndex) => {
                    if (param.name) {
                        availableParams.push({
                            deviceIndex,
                            paramIndex,
                            param,
                            fullName: `${deviceData.name}: ${param.name}`
                        });
                    }
                });
            }
        });
        const needsReassignment = availableParams.length >= 3 && (
            this.gestureParameterMapping.wristX.deviceIndex === null ||
            this.gestureParameterMapping.wristY.deviceIndex === null ||
            this.gestureParameterMapping.handCurl.deviceIndex === null ||
            !this.isValidMapping(this.gestureParameterMapping.wristX) ||
            !this.isValidMapping(this.gestureParameterMapping.wristY) ||
            !this.isValidMapping(this.gestureParameterMapping.handCurl)
        );
        if (needsReassignment || this.gestureParameterMapping.wristX.deviceIndex === null) {
            const deviceIndices = [...new Set(availableParams.map(p => p.deviceIndex))];
            if (availableParams.length > 0) {
                const mapping = availableParams[0];
                this.gestureParameterMapping.wristX = {
                    deviceIndex: mapping.deviceIndex,
                    paramIndex: mapping.paramIndex,
                    paramName: mapping.fullName
                };
            }
            if (availableParams.length > 1) {
                let mapping = availableParams.find(p => p.deviceIndex !== this.gestureParameterMapping.wristX.deviceIndex);
                if (!mapping) mapping = availableParams[1]; 
                this.gestureParameterMapping.wristY = {
                    deviceIndex: mapping.deviceIndex,
                    paramIndex: mapping.paramIndex,
                    paramName: mapping.fullName
                };
            }
            if (availableParams.length > 2) {
                let mapping = availableParams.find(p => 
                    p.deviceIndex !== this.gestureParameterMapping.wristX.deviceIndex &&
                    p.deviceIndex !== this.gestureParameterMapping.wristY.deviceIndex
                );
                if (!mapping) {
                    mapping = availableParams.find(p => 
                        !(p.deviceIndex === this.gestureParameterMapping.wristX.deviceIndex && 
                          p.paramIndex === this.gestureParameterMapping.wristX.paramIndex) &&
                        !(p.deviceIndex === this.gestureParameterMapping.wristY.deviceIndex && 
                          p.paramIndex === this.gestureParameterMapping.wristY.paramIndex)
                    );
                }
                if (!mapping) mapping = availableParams[2]; 
                this.gestureParameterMapping.handCurl = {
                    deviceIndex: mapping.deviceIndex,
                    paramIndex: mapping.paramIndex,
                    paramName: mapping.fullName
                };
            }
            this.log(`Hand gesture mapping updated:`, 'info');
            this.log(`  Wrist X → ${this.gestureParameterMapping.wristX.paramName}`, 'info');
            this.log(`  Wrist Y → ${this.gestureParameterMapping.wristY.paramName}`, 'info');
            this.log(`  Hand Curl → ${this.gestureParameterMapping.handCurl.paramName}`, 'info');
        }
    }

    isValidMapping(mapping) {
        if (mapping.deviceIndex === null || mapping.paramIndex === null) {
            return false;
        }
        const deviceData = this.devices[mapping.deviceIndex];
        if (!deviceData || deviceData.bypassed) {
            return false;
        }
        const param = deviceData.device.parameters && deviceData.device.parameters[mapping.paramIndex];
        return param !== undefined;
    }

    handleKeyDown(event) {
        if (this.isTypingInInput(event.target)) {
            return;
        }
        switch(event.key.toLowerCase()) {
            case ' ':
                event.preventDefault();
                this.toggleAudio();
                break;
            case 'x':
                event.preventDefault();
                this.pauseAudio();
                break;
            case 'z':
                event.preventDefault();
                this.triggerContinuousMode();
                break;
            case 'c':
                event.preventDefault();
                this.triggerModeByKey(0); 
                break;
            case 'v':
                event.preventDefault();
                this.triggerModeByKey(1); 
                break;
            case 'b':
                event.preventDefault();
                this.triggerModeByKey(2); 
                break;
            case 'n':
                event.preventDefault();
                this.triggerModeByKey(3); 
                break;
            case 'r':
                event.preventDefault();
                this.randomiseEffects();
                this.log('Keyboard triggered: Randomise Effects', 'info');
                break;
            case 'control':
                event.preventDefault();
                this.randomiseEffects();
                this.log('Keyboard triggered: Randomise Effects (Control key)', 'info');
                break;
            case 'arrowright':
                event.preventDefault();
                this.adjustMasterVolume(0.05);
                break;
            case 'arrowleft':
                event.preventDefault();
                this.adjustMasterVolume(-0.05);
                break;
        }
    }

    handleKeyUp(event) {
        if (!this.keyboardControlEnabled || this.isTypingInInput(event.target)) {
            return;
        }
        switch(event.key.toLowerCase()) {
            case 'z':
                event.preventDefault();
                this.triggerOffMode();
                break;
        }
    }

    isTypingInInput(target) {
        return target.tagName === 'INPUT' || 
               target.tagName === 'TEXTAREA' || 
               target.contentEditable === 'true';
    }

    triggerContinuousMode() {
        const continuousBtn = document.querySelector('.mode-btn[data-mode="1"]');
        if (continuousBtn && !continuousBtn.classList.contains('active')) {
            continuousBtn.click();
            this.log('Keyboard triggered: Continuous mode ON', 'info');
        }
    }

    triggerOffMode() {
        const offBtn = document.querySelector('.mode-btn[data-mode="0"]');
        if (offBtn && !offBtn.classList.contains('active')) {
            offBtn.click();
            this.log('Keyboard triggered: Mode OFF', 'info');
        }
    }

    triggerModeByKey(modeNumber) {
        const modeBtn = document.querySelector(`.mode-btn[data-mode="${modeNumber}"]`);
        if (modeBtn && !modeBtn.classList.contains('active')) {
            modeBtn.click();
            const modeNames = ['Off', 'Continuous', 'Intermittent', 'Random'];
            this.log(`Keyboard triggered: ${modeNames[modeNumber]} mode`, 'info');
        }
    }

    adjustMasterVolume(delta) {
        if (!this.elements.masterVolume || !this.masterGainNode) {
            this.log('Master volume not available', 'error');
            return;
        }
        const currentVolume = parseFloat(this.elements.masterVolume.value);
        const newVolume = Math.max(0, Math.min(1, currentVolume + delta));
        this.elements.masterVolume.value = newVolume;
        if (this.elements.masterVolumeValue) {
            this.elements.masterVolumeValue.textContent = newVolume.toFixed(2);
        }
        this.masterGainNode.gain.setValueAtTime(newVolume, this.context.currentTime);
        this.log(`Master volume: ${newVolume.toFixed(2)} (keyboard)`, 'info');
    }

    updateControlsPanel() {
        const controlsGrid = this.elements.controlsGrid;
        if (!controlsGrid) return;
        controlsGrid.innerHTML = '';
        const activeDevices = this.devices.filter(d => !d.bypassed);
        if (activeDevices.length === 0) {
            controlsGrid.innerHTML = `
                <div class="no-effects">
                    <p>Select effects above to see controls here</p>
                </div>
            `;
            return;
        }
        activeDevices.forEach((deviceData, index) => {
            const { device, name } = deviceData;
            if (!device.parameters || device.parameters.length === 0) {
                return; 
            }
            const controlGroup = document.createElement('div');
            controlGroup.className = 'effect-control-group';
            const toggleContainer = document.createElement('div');
            toggleContainer.className = 'effect-toggle-container';
            const toggleBtn = document.createElement('button');
            toggleBtn.className = 'effect-toggle-btn active';
            toggleBtn.innerHTML = `
                <span class="toggle-indicator"></span>
                <span class="toggle-label">ON</span>
            `;
            toggleBtn.addEventListener('click', () => {
                deviceData.bypassed = !deviceData.bypassed;
                toggleBtn.classList.toggle('active');
                toggleBtn.querySelector('.toggle-label').textContent = deviceData.bypassed ? 'OFF' : 'ON';
                this.reconnectAudioChain();
                this.log(`Effect ${name} ${deviceData.bypassed ? 'bypassed' : 'enabled'}`, 'info');
            });
            toggleContainer.appendChild(toggleBtn);
            controlGroup.appendChild(toggleContainer);
            const title = document.createElement('h4');
            title.textContent = name;
            controlGroup.appendChild(title);
            device.parameters.forEach(param => {
                if (!param.name) return; 
                const paramControl = document.createElement('div');
                paramControl.className = 'parameter-control';
                const label = document.createElement('label');
                label.textContent = param.name;
                const slider = document.createElement('input');
                slider.type = 'range';
                slider.min = param.min;
                slider.max = param.max;
                slider.step = (param.max - param.min) / 100;
                slider.value = param.value;
                slider.dataset.paramId = param.id;
                const valueSpan = document.createElement('span');
                valueSpan.className = 'parameter-value';
                valueSpan.textContent = param.value.toFixed(2);
                valueSpan.dataset.paramId = param.id;
                slider.addEventListener('input', () => {
                    const newValue = parseFloat(slider.value);
                    param.value = newValue;
                    valueSpan.textContent = newValue.toFixed(2);
                    if (device.parametersById && device.parametersById.get(param.id)) {
                        device.parametersById.get(param.id).value = newValue;
                    }
                    try {
                        if (device.setParameterValue) {
                            device.setParameterValue(param.id, newValue);
                        }
                    } catch (e) {
                        // Alternative parameter setting method
                    }
                });
                paramControl.appendChild(label);
                paramControl.appendChild(slider);
                paramControl.appendChild(valueSpan);
                controlGroup.appendChild(paramControl);
            });
            controlsGrid.appendChild(controlGroup);
        });
    }

    makeDraggable(element) {
        element.draggable = true;
        element.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', element.dataset.index);
            element.style.opacity = '0.5';
            this.elements.effectsChain.classList.add('dragging');
        });
        element.addEventListener('dragend', (e) => {
            element.style.opacity = '1';
            this.elements.effectsChain.classList.remove('dragging');
        });
        element.addEventListener('dragover', (e) => {
            e.preventDefault();
        });
        element.addEventListener('drop', (e) => {
            e.preventDefault();
            const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
            const toIndex = parseInt(element.dataset.index);
            if (fromIndex !== toIndex) {
                this.reorderEffect(fromIndex, toIndex);
            }
        });
    }

    reorderEffect(fromIndex, toIndex) {
        const deviceData = this.devices.splice(fromIndex, 1)[0];
        const effectNode = this.effectNodes.splice(fromIndex, 1)[0];
        this.devices.splice(toIndex, 0, deviceData);
        this.effectNodes.splice(toIndex, 0, effectNode);
        this.rebuildEffectsChain();
        this.reconnectAudioChain();
        this.updateControlsPanel();
        this.log(`Reordered effect from position ${fromIndex} to ${toIndex}`, 'info');
    }

    saveCurrentPreset() {
        const presetName = this.elements.presetName?.value.trim();
        if (!presetName) {
            this.log('Please enter a preset name', 'error');
            return;
        }
        if (this.devices.length === 0) {
            this.log('No effects loaded to save', 'error');
            return;
        }
        const preset = {
            id: Date.now(),
            name: presetName,
            date: new Date().toLocaleDateString(),
            effects: this.devices.map(deviceData => ({
                effectName: deviceData.effectName,
                name: deviceData.name,
                bypassed: deviceData.bypassed,
                parameters: deviceData.device.parameters ? deviceData.device.parameters.map(param => ({
                    id: param.id,
                    name: param.name,
                    value: param.value,
                    min: param.min,
                    max: param.max
                })) : []
            })),
            gestureMapping: JSON.parse(JSON.stringify(this.gestureParameterMapping)),
            masterVolume: this.elements.masterVolume?.value || 0.5,
            feedbackEnabled: this.feedbackEnabled,
            feedbackSettings: this.captureFeedbackSettings()
        };
        const existingIndex = this.presets.findIndex(p => p.name === presetName);
        if (existingIndex !== -1) {
            if (!confirm(`Preset "${presetName}" already exists. Overwrite?`)) {
                return;
            }
            this.presets[existingIndex] = preset;
        } else {
            this.presets.push(preset);
        }
        this.savePresets();
        this.updatePresetBankUI();
        this.elements.presetName.value = '';
        this.log(`Preset "${presetName}" saved with ${preset.effects.length} effects`, 'success');
    }

    captureFeedbackSettings() {
        return {
            eqLow: this.elements.eqLow?.value || 0,
            eqMid: this.elements.eqMid?.value || 0,
            eqHigh: this.elements.eqHigh?.value || 0,
            compThreshold: this.elements.compThreshold?.value || -24,
            compRatio: this.elements.compRatio?.value || 4,
            compAttack: this.elements.compAttack?.value || 0.003,
            compRelease: this.elements.compRelease?.value || 0.25
        };
    }

    async loadPreset(presetId) {
        const preset = this.presets.find(p => p.id === presetId);
        if (!preset) {
            this.log('Preset not found', 'error');
            return;
        }
        if (!this.isAudioStarted) {
            this.log('Please start audio first', 'error');
            return;
        }
        this.log(`Loading preset: ${preset.name}`, 'info');
        try {
            this.showLoading(true);
            const fadeTime = 0.3; 
            const originalVolume = this.masterGainNode.gain.value;
            this.masterGainNode.gain.setTargetAtTime(0, this.context.currentTime, fadeTime / 3);
            await new Promise(resolve => setTimeout(resolve, fadeTime * 1000));
            this.clearEffectsChain();
            for (const effectConfig of preset.effects) {
                try {
                    const { device, node } = await loadBuiltInEffect(effectConfig.effectName, this.context);
                    this.effectNodes.push(node);
                    this.devices.push({
                        device,
                        node,
                        name: effectConfig.name,
                        effectName: effectConfig.effectName,
                        bypassed: effectConfig.bypassed
                    });
                    if (effectConfig.parameters && device.parameters) {
                        effectConfig.parameters.forEach(paramConfig => {
                            const param = device.parameters.find(p => p.id === paramConfig.id);
                            if (param) {
                                param.value = paramConfig.value;
                                if (device.parametersById && device.parametersById.get(param.id)) {
                                    device.parametersById.get(param.id).value = paramConfig.value;
                                }
                                try {
                                    if (device.setParameterValue) {
                                        device.setParameterValue(param.id, paramConfig.value);
                                    }
                                } catch (e) {
                                    // Alternative parameter setting method
                                }
                            }
                        });
                    }
                    const button = document.querySelector(`[data-effect="${effectConfig.effectName}"]`);
                    if (button) button.classList.add('active');
                } catch (error) {
                    this.log(`Failed to load effect ${effectConfig.effectName}: ${error.message}`, 'error');
                }
            }
            this.gestureParameterMapping = JSON.parse(JSON.stringify(preset.gestureMapping));
            if (this.elements.masterVolume && preset.masterVolume !== undefined) {
                this.elements.masterVolume.value = preset.masterVolume;
                if (this.elements.masterVolumeValue) {
                    this.elements.masterVolumeValue.textContent = parseFloat(preset.masterVolume).toFixed(2);
                }
            }
            if (preset.feedbackSettings) {
                this.restoreFeedbackSettings(preset.feedbackSettings);
            }
            if (preset.feedbackEnabled !== undefined && preset.feedbackEnabled !== this.feedbackEnabled) {
                this.toggleFeedbackControl();
            }
            this.rebuildEffectsChain();
            this.updateControlsPanel();
            this.reconnectAudioChain();
            const targetVolume = parseFloat(preset.masterVolume || originalVolume);
            this.masterGainNode.gain.setTargetAtTime(targetVolume, this.context.currentTime, 0.2);
            this.log(`✓ Preset "${preset.name}" loaded: ${preset.effects.length} effects with gesture mapping`, 'success');
        } catch (error) {
            this.log(`Failed to load preset: ${error.message}`, 'error');
            this.masterGainNode.gain.setValueAtTime(originalVolume, this.context.currentTime);
        } finally {
            this.showLoading(false);
        }
    }

    restoreFeedbackSettings(settings) {
        if (this.elements.eqLow) this.elements.eqLow.value = settings.eqLow || 0;
        if (this.elements.eqMid) this.elements.eqMid.value = settings.eqMid || 0;
        if (this.elements.eqHigh) this.elements.eqHigh.value = settings.eqHigh || 0;
        if (this.elements.compThreshold) this.elements.compThreshold.value = settings.compThreshold || -24;
        if (this.elements.compRatio) this.elements.compRatio.value = settings.compRatio || 4;
        if (this.elements.compAttack) this.elements.compAttack.value = settings.compAttack || 0.003;
        if (this.elements.compRelease) this.elements.compRelease.value = settings.compRelease || 0.25;
        this.updateEQBand('low');
        this.updateEQBand('mid');
        this.updateEQBand('high');
        this.updateCompressor('threshold');
        this.updateCompressor('ratio');
        this.updateCompressor('attack');
        this.updateCompressor('release');
    }

    deletePreset(presetId) {
        const preset = this.presets.find(p => p.id === presetId);
        if (!preset) return;
        if (confirm(`Delete preset "${preset.name}"?`)) {
            this.presets = this.presets.filter(p => p.id !== presetId);
            this.savePresets();
            this.updatePresetBankUI();
            this.log(`Preset "${preset.name}" deleted`, 'info');
        }
    }

    savePresets() {
        try {
            localStorage.setItem('parsec-presets', JSON.stringify(this.presets));
        } catch (error) {
            this.log('Failed to save presets to storage', 'error');
        }
    }

    loadPresets() {
        try {
            const saved = localStorage.getItem('parsec-presets');
            if (saved) {
                this.presets = JSON.parse(saved);
                this.updatePresetBankUI();
                this.log(`Loaded ${this.presets.length} saved presets`, 'info');
            }
        } catch (error) {
            this.log('Failed to load presets from storage', 'error');
            this.presets = [];
        }
    }

    updatePresetBankUI() {
        if (!this.elements.presetBankGrid) return;
        if (this.presets.length === 0) {
            this.elements.presetBankGrid.innerHTML = `
                <div class="no-presets">
                    <p>No saved presets. Create your first preset by setting up effects and clicking "Save Preset" above.</p>
                </div>
            `;
            return;
        }
        this.elements.presetBankGrid.innerHTML = this.presets.map(preset => `
            <div class="preset-card">
                <div class="preset-header">
                    <div class="preset-name">${preset.name}</div>
                    <div class="preset-date">${preset.date}</div>
                </div>
                <div class="preset-info">
                    ${preset.effects.length} effects<br>
                    ${preset.gestureMapping.wristX.paramName !== 'None' ? 'Hand gestures mapped' : 'No gesture mapping'}
                    ${preset.feedbackEnabled ? '<br>Feedback control enabled' : ''}
                </div>
                <div class="preset-actions">
                    <button class="preset-btn load" onclick="parsec.loadPreset(${preset.id})">Load</button>
                    <button class="preset-btn delete" onclick="parsec.deletePreset(${preset.id})" title="Delete preset">🗑️</button>
                </div>
            </div>
        `).join('');
    }

    clearEffectsChain() {
        const effectButtons = document.querySelectorAll('.effect-btn');
        effectButtons.forEach(button => button.classList.remove('active'));
        this.effectNodes.forEach(node => {
            try { node.disconnect(); } catch (e) {}
        });
        this.effectNodes = [];
        this.devices = [];
        this.gestureParameterMapping = {
            wristX: { deviceIndex: null, paramIndex: null, paramName: 'None' },
            wristY: { deviceIndex: null, paramIndex: null, paramName: 'None' },
            handCurl: { deviceIndex: null, paramIndex: null, paramName: 'None' }
        };
        this.rebuildEffectsChain();
        this.updateControlsPanel();
        this.reconnectAudioChain();
        this.log('Effects chain cleared', 'info');
    }

    async loadVideoFile(event) {
        const file = event.target.files[0];
        if (!file) return;
        try {
            const videoURL = URL.createObjectURL(file);
            this.mainVideo.src = videoURL;
            this.videoLoaded = true;
            this.elements.videoContainer.style.display = 'block';
            this.elements.videoFileName.textContent = file.name;
            this.elements.playVideo.disabled = false;
            this.elements.pauseVideo.disabled = false;
            this.elements.popupVideo.disabled = false;
            if (this.popupWindow && !this.popupWindow.closed && this.popupVideo) {
                this.popupVideo.src = videoURL;
            }
            this.log(`Video loaded: ${file.name}`, 'success');
        } catch (error) {
            this.log(`Failed to load video: ${error.message}`, 'error');
        }
    }

    onVideoLoaded() {
        this.updateVideoDuration();
        this.log(`Video ready: ${this.formatTime(this.mainVideo.duration)}`, 'info');
    }

    updateVideoDuration() {
        if (this.mainVideo && this.elements.videoDuration) {
            const current = this.formatTime(this.mainVideo.currentTime);
            const total = this.formatTime(this.mainVideo.duration);
            this.elements.videoDuration.textContent = `${current} / ${total}`;
        }
    }

    formatTime(seconds) {
        if (isNaN(seconds)) return '00:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    async playVideo() {
        if (!this.videoLoaded || !this.mainVideo) {
            this.log('No video loaded', 'error');
            return;
        }
        try {
            await this.mainVideo.play();
            if (this.popupWindow && !this.popupWindow.closed && this.popupVideo) {
                try {
                    this.popupVideo.currentTime = this.mainVideo.currentTime;
                    await this.popupVideo.play();
                } catch (popupError) {
                    this.log(`Popup video play failed: ${popupError.message}`, 'error');
                }
            }
            this.log('Video playback started', 'info');
        } catch (error) {
            this.log(`Video play failed: ${error.message}`, 'error');
        }
    }

    async pauseVideo() {
        if (!this.videoLoaded || !this.mainVideo) {
            this.log('No video loaded', 'error');
            return;
        }
        try {
            this.mainVideo.pause();
            if (this.popupWindow && !this.popupWindow.closed && this.popupVideo) {
                this.popupVideo.pause();
            }
            this.log('Video playback paused', 'info');
        } catch (error) {
            this.log(`Video pause failed: ${error.message}`, 'error');
        }
    }

    onVideoEnded() {
        this.log('Video playback ended', 'info');
    }

    openVideoPopup() {
        if (!this.videoLoaded || !this.mainVideo.src) {
            this.log('No video loaded to display in popup', 'error');
            return;
        }
        try {
            if (this.popupWindow && !this.popupWindow.closed) {
                this.popupWindow.close();
            }
            this.popupWindow = window.open('', '_blank', 'width=800,height=600,resizable=yes,scrollbars=no,menubar=no,toolbar=no');
            if (!this.popupWindow) {
                this.log('Popup blocked. Please allow popups for this site.', 'error');
                return;
            }
            this.popupWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title></title>
                    <style>
                        body {
                            margin: 0;
                            padding: 0;
                            background-color: #000;
                            overflow: hidden;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            min-height: 100vh;
                        }
                        video {
                            width: 100%;
                            height: 100%;
                            object-fit: contain;
                        }
                    </style>
                </head>
                <body>
                    <video id="popupVideo" controls>
                        <source src="${this.mainVideo.src}" type="video/mp4">
                        Your browser does not support the video tag.
                    </video>
                    <script>
                        document.title = "";
                        document.addEventListener('contextmenu', e => e.preventDefault());
                        document.addEventListener('keydown', e => {
                            if (e.key === 'Escape') {
                                window.close();
                            }
                        });
                    </script>
                </body>
                </html>
            `);
            this.popupWindow.document.close();
            setTimeout(() => {
                this.popupVideo = this.popupWindow.document.getElementById('popupVideo');
                if (this.popupVideo) {
                    this.popupVideo.currentTime = this.mainVideo.currentTime;
                    this.popupVideo.play().catch(e => {
                        this.log(`Popup video auto-play failed: ${e.message}`, 'error');
                    });
                }
            }, 100);
            this.popupWindow.addEventListener('beforeunload', () => {
                this.popupVideo = null;
                this.popupWindow = null;
            });
            this.log('Video popup opened', 'success');
        } catch (error) {
            this.log(`Failed to open video popup: ${error.message}`, 'error');
        }
    }

}

window.parsec = new Parsec();