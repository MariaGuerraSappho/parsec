import { loadRNBOEffect, loadBuiltInEffect } from './rnbo-loader.js';
import { HandTracker } from './hand-tracking.js';
import { GestureMapper } from './gesture-mapper.js';
import { VideoSyncManager } from './video-sync.js';

class ParsecSimple {
    constructor() {
        this.audio = new AudioManager();
        this.effectsChain = []; // Array to store multiple effects
        this.currentEffect = null;
        this.isAudioStarted = false;
        
        // Hand tracking and gesture mapping
        this.handTracker = new HandTracker();
        this.gestureMapper = new GestureMapper();
        this.isHandTrackingActive = false;
        
        // Bluetooth manager
        this.bluetooth = new BluetoothManager();
        
        // Video sync manager
        this.videoSync = new VideoSyncManager();
        
        this.initializeElements();
        this.setupEventListeners();
        this.setupHandTracking();
        this.setupBluetoothManager();
        this.setupVideoSync();
        this.loadAvailableInputs();
        this.updateEffectsChainUI();
        this.loadPresets(); // Load saved presets on startup
        
        console.log('🚀 Parsec Audio Processor initialized');
        this.log('Parsec initialized - Ready to start audio', 'info');
    }

    initializeElements() {
        this.elements = {
            startAudio: document.getElementById('startAudio'),
            inputSelect: document.getElementById('audioInput'),
            masterVolume: document.getElementById('masterVolume'),
            masterVolumeValue: document.getElementById('masterVolumeValue'),
            statusText: document.getElementById('statusText'),
            logContainer: document.getElementById('logContainer'),
            effectsGrid: document.querySelector('.effects-grid'),
            controlsGrid: document.getElementById('controlsGrid'),
            currentEffectName: document.getElementById('currentEffectName'),
            // Hand tracking elements
            handVideo: document.getElementById('handVideo'),
            handCanvas: document.getElementById('handCanvas'),
            startHandTracking: document.getElementById('startHandTracking'),
            stopHandTracking: document.getElementById('stopHandTracking'),
            randomizeGestures: document.getElementById('randomizeGestures'),
            clearGestures: document.getElementById('clearGestures'),
            gestureToggle: document.getElementById('gestureToggle'),
            gestureMappingList: document.getElementById('gestureMappingList'),
            // Bluetooth elements
            connectBuzzBox: document.getElementById('connectBuzzBox'),
            bleStatusDot: document.getElementById('bleStatusDot'),
            bleStatusText: document.getElementById('bleStatusText'),
            buzzboxControls: document.getElementById('buzzboxControls'),
            strengthSlider: document.getElementById('strengthSlider'),
            strengthValue: document.getElementById('strengthValue'),
            intervalSlider: document.getElementById('intervalSlider'),
            intervalValue: document.getElementById('intervalValue'),
            batteryLevel: document.getElementById('batteryLevel'),
            randomModeInfo: document.getElementById('randomModeInfo'),
            randomStatusText: document.getElementById('randomStatusText'),
            currentBuzzDuration: document.getElementById('currentBuzzDuration'),
            currentSilenceDuration: document.getElementById('currentSilenceDuration'),
            // Video elements
            mainVideo: document.getElementById('mainVideo'),
            videoFileInput: document.getElementById('videoFileInput'),
            loadVideoBtn: document.getElementById('loadVideoBtn'),
            playVideoBtn: document.getElementById('playVideoBtn'),
            pauseVideoBtn: document.getElementById('pauseVideoBtn'),
            openProjectorBtn: document.getElementById('openProjectorBtn'),
            closeProjectorBtn: document.getElementById('closeProjectorBtn'),
            projectorStatusDot: document.getElementById('projectorStatusDot'),
            projectorStatusText: document.getElementById('projectorStatusText'),
            videoFileName: document.getElementById('videoFileName'),
            videoDuration: document.getElementById('videoDuration'),
            // Preset elements
            presetNameInput: document.getElementById('presetNameInput'),
            savePresetBtn: document.getElementById('savePresetBtn'),
            presetBankGrid: document.getElementById('presetBankGrid')
        };
    }

    setupEventListeners() {
        // Start audio button
        if (this.elements.startAudio) {
            this.elements.startAudio.addEventListener('click', () => this.startAudio());
        }

        // Input device selection
        if (this.elements.inputSelect) {
            this.elements.inputSelect.addEventListener('change', () => this.selectAudioInput());
        }

        // Master volume control
        if (this.elements.masterVolume) {
            this.elements.masterVolume.addEventListener('input', (e) => {
                const volume = parseFloat(e.target.value);
                this.audio.setOutputVolume(volume);
                if (this.elements.masterVolumeValue) {
                    this.elements.masterVolumeValue.textContent = volume.toFixed(2);
                }
            });
        }

        // Effect buttons - now add to chain instead of replacing
        const effectButtons = document.querySelectorAll('.effect-btn');
        effectButtons.forEach(button => {
            button.addEventListener('click', () => this.addEffectToChain(button.dataset.effect));
        });

        // Chain control buttons
        const randomizeBtn = document.getElementById('randomiseEffects');
        if (randomizeBtn) {
            randomizeBtn.addEventListener('click', () => this.randomizeEffectsChain());
        }

        const clearChainBtn = document.getElementById('clearChain');
        if (clearChainBtn) {
            clearChainBtn.addEventListener('click', () => this.clearEffectsChain());
        }

        // Clear log button
        const clearLogBtn = document.getElementById('clearLog');
        if (clearLogBtn) {
            clearLogBtn.addEventListener('click', () => this.clearLog());
        }

        // Audio manager events
        this.audio.on('started', () => this.onAudioStarted());
        this.audio.on('micConnected', (deviceName) => this.onMicConnected(deviceName));
        this.audio.on('error', (error) => this.onAudioError(error));
        this.audio.on('stopped', () => this.onAudioStopped());
        this.audio.on('volumeUpdate', (volume) => this.updateVolumeVisualizer(volume));
        
        // Hand tracking controls
        if (this.elements.startHandTracking) {
            this.elements.startHandTracking.addEventListener('click', () => this.startHandTracking());
        }
        if (this.elements.stopHandTracking) {
            this.elements.stopHandTracking.addEventListener('click', () => this.stopHandTracking());
        }
        if (this.elements.randomizeGestures) {
            this.elements.randomizeGestures.addEventListener('click', () => this.randomizeGestureMappings());
        }
        if (this.elements.clearGestures) {
            this.elements.clearGestures.addEventListener('click', () => this.clearGestureMappings());
        }
        if (this.elements.gestureToggle) {
            this.elements.gestureToggle.addEventListener('click', () => this.toggleGestureMapping());
        }

        // Bluetooth control button
        if (this.elements.connectBuzzBox) {
            this.elements.connectBuzzBox.addEventListener('click', () => this.connectBuzzBox());
        }

        // Mode buttons
        const modeButtons = document.querySelectorAll('.mode-btn');
        modeButtons.forEach(button => {
            button.addEventListener('click', () => this.setBluetoothMode(parseInt(button.dataset.mode)));
        });

        // Strength slider
        if (this.elements.strengthSlider) {
            this.elements.strengthSlider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                this.bluetooth.setStrength(value);
                if (this.elements.strengthValue) {
                    this.elements.strengthValue.textContent = value;
                }
            });
        }

        // Interval slider
        if (this.elements.intervalSlider) {
            this.elements.intervalSlider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                this.bluetooth.setInterval(value);
                if (this.elements.intervalValue) {
                    this.elements.intervalValue.textContent = `${value}s`;
                }
            });
        }

        // Video controls
        if (this.elements.loadVideoBtn) {
            this.elements.loadVideoBtn.addEventListener('click', () => {
                this.elements.videoFileInput.click();
            });
        }

        if (this.elements.videoFileInput) {
            this.elements.videoFileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    this.videoSync.loadVideo(file);
                }
            });
        }

        if (this.elements.playVideoBtn) {
            this.elements.playVideoBtn.addEventListener('click', () => {
                this.videoSync.play();
            });
        }

        if (this.elements.pauseVideoBtn) {
            this.elements.pauseVideoBtn.addEventListener('click', () => {
                this.videoSync.pause();
            });
        }

        if (this.elements.openProjectorBtn) {
            this.elements.openProjectorBtn.addEventListener('click', () => {
                this.videoSync.openProjectorWindow();
            });
        }

        if (this.elements.closeProjectorBtn) {
            this.elements.closeProjectorBtn.addEventListener('click', () => {
                this.videoSync.closeProjector();
            });
        }

        // Keyboard controls
        document.addEventListener('keydown', (e) => this.handleKeyboardInput(e));

        // Preset controls
        if (this.elements.savePresetBtn) {
            this.elements.savePresetBtn.addEventListener('click', () => this.saveCurrentPreset());
        }

        if (this.elements.presetNameInput) {
            this.elements.presetNameInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    this.saveCurrentPreset();
                }
            });
        }
    }

    handleKeyboardInput(e) {
        // Prevent handling if user is typing in an input field
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
            return;
        }

        switch (e.code) {
            case 'Space':
                e.preventDefault();
                this.toggleAudio();
                break;
                
            case 'ArrowLeft':
                e.preventDefault();
                this.adjustVolume(-0.05); // Decrease by 5%
                break;
                
            case 'ArrowRight':
                e.preventDefault();
                this.adjustVolume(0.05); // Increase by 5%
                break;
                
            case 'ArrowUp':
                e.preventDefault();
                this.adjustBuzzBoxStrength(10); // Increase by 10
                break;
                
            case 'ArrowDown':
                e.preventDefault();
                this.adjustBuzzBoxStrength(-10); // Decrease by 10
                break;
                
            case 'ControlLeft':
            case 'ControlRight':
                e.preventDefault();
                this.randomizeEffectsChain();
                break;
                
            case 'AltLeft':
            case 'AltRight':
                e.preventDefault();
                this.randomizeGestureMappings();
                break;
                
            case 'KeyC':
                e.preventDefault();
                this.setBluetoothMode(0); // Off
                break;
                
            case 'KeyV':
                e.preventDefault();
                this.setBluetoothMode(1); // Continuous
                break;
                
            case 'KeyB':
                e.preventDefault();
                this.setBluetoothMode(2); // Random
                break;
                
            case 'KeyN':
                e.preventDefault();
                this.setBluetoothMode(3); // Single
                break;
        }
    }

    toggleAudio() {
        if (!this.isAudioStarted) {
            this.startAudio();
        } else {
            // For now, we don't have a stop function, so we just log
            this.log('Audio stop not implemented - use Space to start', 'info');
        }
    }

    adjustVolume(delta) {
        if (!this.elements.masterVolume) return;
        
        const currentVolume = parseFloat(this.elements.masterVolume.value);
        const newVolume = Math.max(0, Math.min(1, currentVolume + delta));
        
        this.elements.masterVolume.value = newVolume;
        this.audio.setOutputVolume(newVolume);
        
        if (this.elements.masterVolumeValue) {
            this.elements.masterVolumeValue.textContent = newVolume.toFixed(2);
        }
        
        this.log(`Volume: ${(newVolume * 100).toFixed(0)}%`, 'info');
    }

    adjustBuzzBoxStrength(delta) {
        if (!this.elements.strengthSlider || !this.bluetooth.isConnected()) {
            this.log('BuzzBox not connected', 'error');
            return;
        }
        
        const currentStrength = parseInt(this.elements.strengthSlider.value);
        const newStrength = Math.max(0, Math.min(255, currentStrength + delta));
        
        this.elements.strengthSlider.value = newStrength;
        this.bluetooth.setStrength(newStrength);
        
        if (this.elements.strengthValue) {
            this.elements.strengthValue.textContent = newStrength;
        }
        
        this.log(`BuzzBox strength: ${newStrength}`, 'info');
    }

    setupVideoSync() {
        this.videoSync.initialize(this.elements.mainVideo);
        
        this.videoSync.on('projectorConnected', () => {
            this.updateProjectorUI(true);
            this.log('Projector window connected', 'success');
        });

        this.videoSync.on('projectorDisconnected', () => {
            this.updateProjectorUI(false);
            this.log('Projector window disconnected', 'info');
        });

        this.videoSync.on('videoLoaded', (data) => {
            this.updateVideoUI(data);
            this.log(`Video loaded: ${data.fileName}`, 'success');
        });

        this.videoSync.on('error', (error) => {
            this.log(`Video error: ${error}`, 'error');
        });
        
        // Expose mainVideo reference for projector window access
        this.mainVideo = this.elements.mainVideo;
    }

    updateProjectorUI(connected) {
        if (this.elements.projectorStatusDot) {
            this.elements.projectorStatusDot.classList.toggle('connected', connected);
        }
        
        if (this.elements.projectorStatusText) {
            this.elements.projectorStatusText.textContent = connected ? 'Connected' : 'Not connected';
        }
        
        if (this.elements.closeProjectorBtn) {
            this.elements.closeProjectorBtn.disabled = !connected;
        }

        if (this.elements.openProjectorBtn) {
            this.elements.openProjectorBtn.disabled = connected;
        }
    }

    updateVideoUI(data) {
        if (this.elements.videoFileName) {
            this.elements.videoFileName.textContent = data.fileName;
        }
        
        if (this.elements.videoDuration && data.duration) {
            const minutes = Math.floor(data.duration / 60);
            const seconds = Math.floor(data.duration % 60);
            this.elements.videoDuration.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
    }

    setupHandTracking() {
        // Hand tracker events
        this.handTracker.on('initialized', () => {
            this.log('Hand tracking initialized', 'success');
            this.isHandTrackingActive = true;
            this.updateHandTrackingUI();
        });

        this.handTracker.on('error', (error) => {
            this.log(`Hand tracking error: ${error}`, 'error');
            this.isHandTrackingActive = false;
            this.updateHandTrackingUI();
        });

        this.handTracker.on('gestureUpdate', (gestureData) => {
            this.gestureMapper.processGestures(gestureData);
        });

        // Gesture mapper events
        this.gestureMapper.on('mappingsChanged', (mappings) => {
            this.updateGestureMappingUI(mappings);
        });

        this.gestureMapper.on('parameterChanged', (changeData) => {
            this.updateParameterUI(changeData);
        });

        this.gestureMapper.on('activeChanged', (active) => {
            this.updateGestureToggleUI(active);
        });
    }

    setupBluetoothManager() {
        // Bluetooth manager events
        this.bluetooth.on('connected', () => {
            this.log('BuzzBox connected', 'success');
            this.updateBluetoothUI(true);
        });

        this.bluetooth.on('disconnected', () => {
            this.log('BuzzBox disconnected', 'info');
            this.updateBluetoothUI(false);
        });

        this.bluetooth.on('error', (error) => {
            this.log(`BuzzBox error: ${error}`, 'error');
        });

        this.bluetooth.on('batteryUpdate', (level) => {
            this.updateBatteryUI(level);
        });

        this.bluetooth.on('modeChanged', (mode) => {
            this.updateModeUI(mode);
        });

        this.bluetooth.on('randomStateChanged', (state) => {
            this.updateRandomModeUI(state);
        });

        this.bluetooth.on('randomModeStopped', () => {
            this.hideRandomModeInfo();
        });
    }

    async startHandTracking() {
        try {
            if (!this.elements.handVideo || !this.elements.handCanvas) {
                throw new Error('Hand tracking elements not found');
            }

            this.log('Starting hand tracking...', 'info');
            await this.handTracker.initialize(this.elements.handVideo, this.elements.handCanvas);
            
        } catch (error) {
            this.log(`Failed to start hand tracking: ${error.message}`, 'error');
        }
    }

    stopHandTracking() {
        this.handTracker.stop();
        this.isHandTrackingActive = false;
        this.updateHandTrackingUI();
        this.log('Hand tracking stopped', 'info');
    }

    randomizeGestureMappings() {
        if (this.effectsChain.length === 0) {
            this.log('Add effects to the chain first', 'error');
            return;
        }

        this.gestureMapper.setEffects(this.effectsChain);
        this.gestureMapper.randomizeAllMappings();
        this.log('Gesture mappings randomized', 'success');
    }

    clearGestureMappings() {
        this.gestureMapper.clearMappings();
        this.log('Gesture mappings cleared', 'info');
    }

    toggleGestureMapping() {
        const newState = !this.gestureMapper.isActive;
        this.gestureMapper.setActive(newState);
        this.log(`Gesture mapping ${newState ? 'enabled' : 'disabled'}`, 'info');
    }

    updateHandTrackingUI() {
        if (this.elements.startHandTracking) {
            this.elements.startHandTracking.disabled = this.isHandTrackingActive;
        }
        if (this.elements.stopHandTracking) {
            this.elements.stopHandTracking.disabled = !this.isHandTrackingActive;
        }
    }

    updateGestureMappingUI(mappings) {
        if (!this.elements.gestureMappingList) return;

        this.elements.gestureMappingList.innerHTML = '';

        if (mappings.length === 0) {
            this.elements.gestureMappingList.innerHTML = '<div class="no-mappings">No gesture mappings active</div>';
            return;
        }

        mappings.forEach(([gestureType, mapping]) => {
            const mappingItem = document.createElement('div');
            mappingItem.className = 'gesture-mapping-item';
            
            const gestureLabel = this.getGestureLabel(gestureType);
            const effectName = mapping.effect.name.replace('rnbo.', '');
            
            mappingItem.innerHTML = `
                <div class="gesture-name">${gestureLabel}</div>
                <div class="mapping-arrow">→</div>
                <div class="parameter-name">${effectName}</div>
                <div class="parameter-name">${mapping.param.name}</div>
                <div class="parameter-value" id="gesture-${gestureType}-value">0.00</div>
            `;
            
            this.elements.gestureMappingList.appendChild(mappingItem);
        });
    }

    updateParameterUI(changeData) {
        // Update gesture mapping display
        const valueElement = document.getElementById(`gesture-${changeData.gestureType}-value`);
        if (valueElement) {
            valueElement.textContent = changeData.value.toFixed(2);
        }

        // Update parameter controls if they exist
        const parameterControls = document.querySelectorAll(`[data-effect-index="${changeData.effectIndex}"] input[type="range"]`);
        parameterControls.forEach(control => {
            const label = control.parentNode.querySelector('label');
            if (label && label.textContent.includes(changeData.paramName)) {
                control.value = changeData.value;
                const valueSpan = control.parentNode.querySelector('.parameter-value');
                if (valueSpan) {
                    valueSpan.textContent = changeData.value.toFixed(2);
                }
            }
        });
    }

    updateGestureToggleUI(active) {
        if (this.elements.gestureToggle) {
            this.elements.gestureToggle.textContent = active ? 'Disable Gestures' : 'Enable Gestures';
            this.elements.gestureToggle.className = active ? 'gesture-toggle-btn active' : 'gesture-toggle-btn';
        }
    }

    updateParameterControls() {
        if (!this.elements.controlsGrid) return;

        // Clear existing controls
        this.elements.controlsGrid.innerHTML = '';

        if (this.effectsChain.length === 0) {
            this.elements.controlsGrid.innerHTML = `
                <div class="no-parameters">
                    <p>Add effects to the chain to see controls here</p>
                </div>
            `;
            return;
        }

        // Create controls for each effect
        this.effectsChain.forEach((effect, effectIndex) => {
            if (!effect.device || !effect.device.parameters) return;

            const effectGroup = document.createElement('div');
            effectGroup.className = 'effect-control-group';
            effectGroup.dataset.effectIndex = effectIndex;

            const displayName = effect.name.replace('rnbo.', '').replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            
            effectGroup.innerHTML = `
                <h4>${displayName}</h4>
                <div class="effect-controls"></div>
            `;

            const controlsContainer = effectGroup.querySelector('.effect-controls');

            // Add parameter controls
            effect.device.parameters.forEach(param => {
                if (param.name && param.min !== undefined && param.max !== undefined) {
                    const paramControl = document.createElement('div');
                    paramControl.className = 'parameter-control';
                    
                    const paramId = `param-${effectIndex}-${param.id}`;
                    paramControl.innerHTML = `
                        <label for="${paramId}">${param.name}</label>
                        <input 
                            type="range" 
                            id="${paramId}" 
                            min="${param.min}" 
                            max="${param.max}" 
                            step="${(param.max - param.min) / 100}"
                            value="${param.value || param.min}"
                            data-effect-index="${effectIndex}"
                            data-param-id="${param.id}"
                        >
                        <span class="parameter-value">${(param.value || param.min).toFixed(2)}</span>
                    `;
                    
                    controlsContainer.appendChild(paramControl);
                    
                    // Add event listener for parameter changes
                    const slider = paramControl.querySelector('input[type="range"]');
                    const valueSpan = paramControl.querySelector('.parameter-value');
                    
                    slider.addEventListener('input', (e) => {
                        const newValue = parseFloat(e.target.value);
                        param.value = newValue;
                        valueSpan.textContent = newValue.toFixed(2);
                        
                        // Update RNBO parameter
                        if (effect.device.parametersById) {
                            const rnboParam = effect.device.parametersById.get(param.id);
                            if (rnboParam) {
                                rnboParam.value = newValue;
                            }
                        }
                    });
                }
            });

            this.elements.controlsGrid.appendChild(effectGroup);
        });
    }

    getGestureLabel(gestureType) {
        const labels = {
            pinch: '🤏 Pinch',
            fist: '✊ Fist',
            spread: '🖐 Spread',
            pointUp: '☝️ Point Up',
            thumbUp: '👍 Thumb Up',
            peace: '✌️ Peace',
            palmDistance: '📏 Distance',
            handHeight: '📐 Height',
            handTilt: '🔄 Tilt'
        };
        return labels[gestureType] || gestureType;
    }

    async startAudio() {
        try {
            this.elements.startAudio.disabled = true;
            this.elements.startAudio.textContent = 'Starting...';
            
            console.log('🎵 === STARTING AUDIO PIPELINE ===');
            this.log('Starting audio engine...', 'info');

            // Start audio context
            const context = await this.audio.startAudio();
            
            // Connect microphone
            await this.connectMicrophone();
            
            this.isAudioStarted = true;
            console.log('✅ Audio pipeline ready');
            this.log('Audio pipeline ready - select an effect to begin processing', 'success');

        } catch (error) {
            console.error('❌ Failed to start audio pipeline:', error);
            this.log(`Failed to start audio: ${error.message}`, 'error');
            this.elements.startAudio.disabled = false;
            this.elements.startAudio.textContent = 'Start Audio';
        }
    }

    async connectMicrophone() {
        const deviceId = this.elements.inputSelect?.value || null;
        await this.audio.connectMicrophone(deviceId);
    }

    async selectAudioInput() {
        if (!this.isAudioStarted) {
            this.log('Please start audio first', 'error');
            return;
        }

        try {
            await this.connectMicrophone();
            if (this.rnboNode) {
                this.reconnectAudioChain();
            }
        } catch (error) {
            this.log(`Failed to change audio input: ${error.message}`, 'error');
        }
    }

    async addEffectToChain(effectName) {
        if (!this.isAudioStarted) {
            this.log('Please start audio first', 'error');
            return;
        }

        try {
            console.log(`🔄 Adding effect to chain: ${effectName}`);
            this.log(`Adding ${effectName} to effects chain...`, 'info');

            // Load new RNBO effect
            const { device, node } = await loadBuiltInEffect(effectName, this.audio.context);
            
            const effectData = {
                name: effectName,
                device: device,
                node: node,
                id: Date.now() + Math.random() // Unique ID for each effect instance
            };

            this.effectsChain.push(effectData);
            
            console.log(`✅ Effect added to chain: ${effectName} (Chain length: ${this.effectsChain.length})`);
            
            // Update UI and reconnect audio
            this.updateEffectsChainUI();
            this.updateParameterControls();
            this.reconnectAudioChain();

            const displayName = effectName.replace('rnbo.', '').replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            this.log(`✅ ${displayName} added to chain (${this.effectsChain.length} effects)`, 'success');

            // Update gesture mapper with new effects
            this.gestureMapper.setEffects(this.effectsChain);

        } catch (error) {
            console.error(`❌ Failed to add effect ${effectName}:`, error);
            this.log(`Failed to add ${effectName}: ${error.message}`, 'error');
        }
    }

    removeEffectFromChain(index) {
        if (index >= 0 && index < this.effectsChain.length) {
            const effect = this.effectsChain[index];
            
            // Disconnect the effect
            if (effect.node) {
                effect.node.disconnect();
            }
            
            // Remove from chain
            this.effectsChain.splice(index, 1);
            
            console.log(`🗑️ Removed effect from chain: ${effect.name}`);
            this.log(`Removed ${effect.name.replace('rnbo.', '')} from chain`, 'info');
            
            // Update UI and reconnect audio
            this.updateEffectsChainUI();
            this.updateParameterControls();
            this.reconnectAudioChain();

            // Update gesture mapper with new effects
            this.gestureMapper.setEffects(this.effectsChain);
        }
    }

    clearEffectsChain() {
        console.log('🗑️ Clearing effects chain');
        
        // Disconnect all effects
        this.effectsChain.forEach(effect => {
            if (effect.node) {
                effect.node.disconnect();
            }
        });
        
        this.effectsChain = [];
        this.updateEffectsChainUI();
        this.updateParameterControls();
        this.reconnectAudioChain();
        
        this.log('Effects chain cleared', 'info');

        // Update gesture mapper with new effects
        this.gestureMapper.setEffects(this.effectsChain);
    }

    randomizeEffectsChain() {
        console.log('🎲 Randomizing effects chain');
        this.log('Randomizing effects chain...', 'info');
        
        // Clear existing chain
        this.clearEffectsChain();
        
        // Available effects
        const availableEffects = [
            'rnbo.overdrive', 'rnbo.chorus', 'rnbo.tremolo', 'rnbo.vibrato',
            'rnbo.flanger', 'rnbo.wahwah', 'rnbo.ringmod', 'rnbo.freqshifter',
            'rnbo.pitchshifter', 'rnbo.octaver', 'rnbo.filterdelay', 'rnbo.platereverb'
        ];
        
        // Random chain length (2-5 effects)
        const chainLength = Math.floor(Math.random() * 4) + 2;
        
        // Add random effects
        for (let i = 0; i < chainLength; i++) {
            const randomEffect = availableEffects[Math.floor(Math.random() * availableEffects.length)];
            
            // Add with a small delay to avoid overwhelming the audio system
            setTimeout(() => {
                this.addEffectToChain(randomEffect).then(() => {
                    // After effect is added, randomize its parameters
                    if (this.effectsChain.length > 0) {
                        this.randomizeEffectParameters(this.effectsChain.length - 1);
                    }
                });
            }, i * 100);
        }
        
        this.log(`🎲 Randomized chain with ${chainLength} effects`, 'success');
    }

    randomizeEffectParameters(effectIndex) {
        if (effectIndex >= 0 && effectIndex < this.effectsChain.length) {
            const effect = this.effectsChain[effectIndex];
            
            if (effect.device && effect.device.parameters) {
                effect.device.parameters.forEach(param => {
                    if (param.name && param.min !== undefined && param.max !== undefined) {
                        // Generate random value within parameter range
                        const randomValue = param.min + Math.random() * (param.max - param.min);
                        param.value = randomValue;
                        
                        // Apply to RNBO device
                        if (effect.device.parametersById && effect.device.parametersById.get(param.id)) {
                            effect.device.parametersById.get(param.id).value = randomValue;
                        }
                        
                        console.log(`🎲 ${effect.name} ${param.name}: ${randomValue.toFixed(2)}`);
                    }
                });
            }
        }
    }

    updateEffectsChainUI() {
        const chainContainer = document.getElementById('effectsChain');
        if (!chainContainer) return;
        
        // Clear existing chain UI
        chainContainer.innerHTML = '';
        
        // Add input node
        const inputNode = document.createElement('div');
        inputNode.className = 'chain-node input-node';
        inputNode.innerHTML = `
            <div class="node-icon">🎤</div>
            <div class="node-label">Microphone</div>
        `;
        chainContainer.appendChild(inputNode);
        
        // Add effect nodes
        this.effectsChain.forEach((effect, index) => {
            // Add connector
            const connector = document.createElement('div');
            connector.className = 'chain-connector';
            chainContainer.appendChild(connector);
            
            // Add effect node
            const effectNode = document.createElement('div');
            effectNode.className = 'chain-node effect-node';
            effectNode.dataset.index = index;
            effectNode.draggable = true;
            
            const displayName = effect.name.replace('rnbo.', '').replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            
            effectNode.innerHTML = `
                <button class="remove-btn" onclick="parsec.removeEffectFromChain(${index})" title="Remove effect">×</button>
                <div class="node-icon">🎵</div>
                <div class="node-label">${displayName}</div>
            `;
            
            // Add drag and drop functionality
            effectNode.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', index.toString());
                e.dataTransfer.effectAllowed = 'move';
                effectNode.style.opacity = '0.5';
            });
            
            effectNode.addEventListener('dragend', () => {
                effectNode.style.opacity = '1';
            });
            
            effectNode.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            });
            
            effectNode.addEventListener('drop', (e) => {
                e.preventDefault();
                const draggedIndex = parseInt(e.dataTransfer.getData('text/plain'));
                const targetIndex = parseInt(effectNode.dataset.index);
                
                if (draggedIndex !== targetIndex) {
                    this.reorderEffectsChain(draggedIndex, targetIndex);
                }
            });
            
            chainContainer.appendChild(effectNode);
        });
        
        // Add output node
        if (this.effectsChain.length > 0) {
            const connector = document.createElement('div');
            connector.className = 'chain-connector';
            chainContainer.appendChild(connector);
        }
        
        const outputNode = document.createElement('div');
        outputNode.className = 'chain-node output-node';
        outputNode.innerHTML = `
            <div class="node-icon">🔊</div>
            <div class="node-label">Output</div>
        `;
        chainContainer.appendChild(outputNode);
    }

    reorderEffectsChain(fromIndex, toIndex) {
        if (fromIndex < 0 || fromIndex >= this.effectsChain.length || 
            toIndex < 0 || toIndex >= this.effectsChain.length) {
            return;
        }
        
        // Move effect in array
        const effect = this.effectsChain.splice(fromIndex, 1)[0];
        this.effectsChain.splice(toIndex, 0, effect);
        
        console.log(`🔄 Reordered effects chain: moved ${effect.name} from ${fromIndex} to ${toIndex}`);
        
        // Update UI and reconnect audio
        this.updateEffectsChainUI();
        this.reconnectAudioChain();
        
        this.log(`Reordered effects chain`, 'info');
    }

    reconnectAudioChain() {
        if (!this.audio.inputSource) {
            console.log('⚠ Cannot connect audio chain - no input source');
            return;
        }

        try {
            // Disconnect everything first
            this.audio.inputSource.disconnect();
            this.effectsChain.forEach(effect => {
                if (effect.node) {
                    effect.node.disconnect();
                }
            });

            if (this.effectsChain.length === 0) {
                // No effects - connect input directly to output
                this.audio.connectToOutput(this.audio.inputSource);
                console.log('🔗 Audio chain connected: Mic → Output (no effects)');
                this.log('Audio chain: Microphone → Output (no effects)', 'info');
            } else {
                // Connect effects in sequence
                let currentSource = this.audio.inputSource;
                
                this.effectsChain.forEach((effect, index) => {
                    currentSource.connect(effect.node);
                    currentSource = effect.node;
                    console.log(`🔗 Connected effect ${index + 1}: ${effect.name}`);
                });
                
                // Connect last effect to output
                this.audio.connectToOutput(currentSource);
                
                console.log(`🔗 Audio chain connected: Mic → ${this.effectsChain.length} Effects → Output`);
                this.log(`✅ Audio chain: Microphone → ${this.effectsChain.length} Effects → Output`, 'success');
            }

        } catch (error) {
            console.error('❌ Failed to connect audio chain:', error);
            this.log(`Failed to connect audio chain: ${error.message}`, 'error');
        }
    }

    async loadAvailableInputs() {
        try {
            const devices = await this.audio.getAudioInputs();
            
            if (this.elements.inputSelect) {
                // Clear existing options except the first one
                while (this.elements.inputSelect.children.length > 1) {
                    this.elements.inputSelect.removeChild(this.elements.inputSelect.lastChild);
                }

                devices.forEach(device => {
                    const option = document.createElement('option');
                    option.value = device.deviceId;
                    option.textContent = device.label || `Audio Input ${device.deviceId.substr(0, 8)}...`;
                    this.elements.inputSelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error('❌ Failed to load audio inputs:', error);
        }
    }

    onAudioStarted() {
        this.elements.startAudio.textContent = 'Audio Started';
        this.elements.startAudio.style.background = 'linear-gradient(45deg, #2ed573, #1dd1a1)';
        if (this.elements.statusText) {
            this.elements.statusText.textContent = 'Audio Ready';
        }
        // Make status dot green when audio is ready
        const statusDot = document.querySelector('.status-dot');
        if (statusDot) {
            statusDot.classList.add('connected');
        }
    }

    onMicConnected(deviceName) {
        this.log(`Microphone connected: ${deviceName}`, 'success');
    }

    onAudioError(error) {
        this.log(`Audio error: ${error}`, 'error');
    }

    onAudioStopped() {
        this.log('Audio stopped', 'info');
    }

    updateVolumeVisualizer(volume) {
        const volumeBar = document.getElementById('volumeBar');
        if (volumeBar) {
            const percentage = Math.min(100, volume * 100);
            volumeBar.style.width = `${percentage}%`;
            
            // Change color based on volume level
            if (percentage > 80) {
                volumeBar.style.background = 'linear-gradient(90deg, #2ed573, #ffa502, #ff4757)';
            } else if (percentage > 50) {
                volumeBar.style.background = 'linear-gradient(90deg, #2ed573, #ffa502)';
            } else {
                volumeBar.style.background = 'linear-gradient(90deg, #2ed573, #2ed573)';
            }
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
        
        if (this.elements.logContainer) {
            this.elements.logContainer.appendChild(logEntry);
            this.elements.logContainer.scrollTop = this.elements.logContainer.scrollHeight;
            
            // Limit log entries
            while (this.elements.logContainer.children.length > 50) {
                this.elements.logContainer.removeChild(this.elements.logContainer.firstChild);
            }
        }

        console.log(`[${type.toUpperCase()}] ${message}`);
    }

    clearLog() {
        if (this.elements.logContainer) {
            this.elements.logContainer.innerHTML = '';
        }
        this.log('Log cleared', 'info');
    }

    async connectBuzzBox() {
        try {
            this.elements.connectBuzzBox.disabled = true;
            this.elements.connectBuzzBox.textContent = 'Connecting...';
            this.log('Connecting to BuzzBox...', 'info');
            
            await this.bluetooth.connect();
            
        } catch (error) {
            this.log(`Failed to connect to BuzzBox: ${error.message}`, 'error');
            this.elements.connectBuzzBox.disabled = false;
            this.elements.connectBuzzBox.textContent = 'Connect BuzzBox';
        }
    }

    async setBluetoothMode(mode) {
        try {
            await this.bluetooth.setMode(mode);
            this.log(`BuzzBox mode set to: ${this.getModeLabel(mode)}`, 'info');
        } catch (error) {
            this.log(`Failed to set mode: ${error.message}`, 'error');
        }
    }

    getModeLabel(mode) {
        const labels = { 0: 'Off', 1: 'Continuous', 2: 'Random', 3: 'Single' };
        return labels[mode] || 'Unknown';
    }

    updateBluetoothUI(connected) {
        if (this.elements.bleStatusDot) {
            this.elements.bleStatusDot.classList.toggle('connected', connected);
        }
        
        if (this.elements.bleStatusText) {
            this.elements.bleStatusText.textContent = connected ? 'Connected' : 'Disconnected';
        }
        
        if (this.elements.connectBuzzBox) {
            this.elements.connectBuzzBox.textContent = connected ? 'Connected' : 'Connect BuzzBox';
            this.elements.connectBuzzBox.disabled = connected;
        }
        
        if (this.elements.buzzboxControls) {
            this.elements.buzzboxControls.classList.toggle('disabled', !connected);
        }
        
        // Enable/disable sliders
        if (this.elements.strengthSlider) {
            this.elements.strengthSlider.disabled = !connected;
        }
        if (this.elements.intervalSlider) {
            this.elements.intervalSlider.disabled = !connected;
        }
    }

    updateBatteryUI(level) {
        if (this.elements.batteryLevel) {
            this.elements.batteryLevel.textContent = level !== null ? `${level}%` : '--';
        }
    }

    updateModeUI(mode) {
        // Update mode button states
        const modeButtons = document.querySelectorAll('.mode-btn');
        modeButtons.forEach(button => {
            button.classList.toggle('active', parseInt(button.dataset.mode) === mode);
        });
        
        // Show/hide random mode info
        if (mode === 2) {
            this.showRandomModeInfo();
        } else {
            this.hideRandomModeInfo();
        }
    }

    showRandomModeInfo() {
        if (this.elements.randomModeInfo) {
            this.elements.randomModeInfo.style.display = 'block';
        }
    }

    hideRandomModeInfo() {
        if (this.elements.randomModeInfo) {
            this.elements.randomModeInfo.style.display = 'none';
        }
    }

    updateRandomModeUI(state) {
        if (this.elements.randomStatusText) {
            this.elements.randomStatusText.textContent = state.buzzing ? 'Buzzing...' : 'Silent...';
        }
        
        if (this.elements.currentBuzzDuration) {
            this.elements.currentBuzzDuration.textContent = (state.buzzDuration / 1000).toFixed(1) + 's';
        }
        
        if (this.elements.currentSilenceDuration) {
            this.elements.currentSilenceDuration.textContent = (state.silenceDuration / 1000).toFixed(1) + 's';
        }
    }

    saveCurrentPreset() {
        const presetName = this.elements.presetNameInput?.value.trim();
        if (!presetName) {
            this.log('Please enter a preset name', 'error');
            return;
        }

        if (this.effectsChain.length === 0) {
            this.log('No effects in chain to save', 'error');
            return;
        }

        try {
            // Get current gesture mappings safely
            let gestureMappings = [];
            try {
                const currentMappings = this.gestureMapper.getCurrentMappings();
                if (Array.isArray(currentMappings)) {
                    gestureMappings = currentMappings.map(([gestureType, mapping]) => ({
                        gestureType,
                        effectIndex: mapping.effectIndex,
                        paramId: mapping.param.id,
                        paramName: mapping.param.name,
                        inverted: mapping.inverted || false
                    }));
                }
            } catch (gestureError) {
                console.warn('Could not retrieve gesture mappings:', gestureError);
                gestureMappings = [];
            }

            // Create preset data
            const presetData = {
                name: presetName,
                timestamp: Date.now(),
                effectsChain: this.effectsChain.map(effect => ({
                    name: effect.name,
                    parameters: effect.device?.parameters?.map(param => ({
                        id: param.id,
                        name: param.name,
                        value: param.value || param.min || 0,
                        min: param.min || 0,
                        max: param.max || 1
                    })) || []
                })),
                gestureMappings: gestureMappings
            };

            // Save to localStorage
            const existingPresets = this.getStoredPresets();
            existingPresets[presetName] = presetData;
            localStorage.setItem('parsec-presets', JSON.stringify(existingPresets));

            this.log(`Preset "${presetName}" saved successfully`, 'success');
            if (this.elements.presetNameInput) {
                this.elements.presetNameInput.value = '';
            }
            this.loadPresets();

        } catch (error) {
            console.error('Failed to save preset:', error);
            this.log(`Failed to save preset: ${error.message}`, 'error');
        }
    }

    async loadPreset(presetName) {
        try {
            const presets = this.getStoredPresets();
            const preset = presets[presetName];
            
            if (!preset) {
                throw new Error('Preset not found');
            }

            this.log(`Loading preset "${presetName}"...`, 'info');

            // Clear current effects chain
            this.clearEffectsChain();

            // Load effects chain
            for (const effectData of preset.effectsChain) {
                await this.addEffectToChain(effectData.name);
                
                // Wait for effect to be added
                const currentEffect = this.effectsChain[this.effectsChain.length - 1];
                if (currentEffect && currentEffect.device) {
                    // Restore parameter values
                    effectData.parameters.forEach(paramData => {
                        const param = currentEffect.device.parameters?.find(p => p.id === paramData.id);
                        if (param) {
                            param.value = paramData.value;
                            // Update RNBO parameter
                            if (currentEffect.device.parametersById) {
                                const rnboParam = currentEffect.device.parametersById.get(paramData.id);
                                if (rnboParam) {
                                    rnboParam.value = paramData.value;
                                }
                            }
                        }
                    });
                }
                
                // Small delay between effects to prevent audio system overload
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            // Update UI
            this.updateParameterControls();

            // Restore gesture mappings if available
            if (preset.gestureMappings && preset.gestureMappings.length > 0) {
                setTimeout(() => {
                    this.gestureMapper.clearMappings();
                    this.gestureMapper.setEffects(this.effectsChain);
                    
                    // Restore mappings
                    preset.gestureMappings.forEach(mappingData => {
                        if (mappingData.effectIndex < this.effectsChain.length) {
                            const effect = this.effectsChain[mappingData.effectIndex];
                            const param = effect.device?.parameters?.find(p => p.id === mappingData.paramId);
                            
                            if (param) {
                                this.gestureMapper.mappings.set(mappingData.gestureType, {
                                    effectIndex: mappingData.effectIndex,
                                    effect: effect,
                                    param: param,
                                    gestureType: mappingData.gestureType,
                                    min: param.min,
                                    max: param.max,
                                    inverted: mappingData.inverted
                                });
                            }
                        }
                    });
                    
                    // Update gesture UI
                    this.gestureMapper.emit('mappingsChanged', this.gestureMapper.getCurrentMappings());
                }, 500); // Give effects time to fully initialize
            }

            this.log(`✅ Preset "${presetName}" loaded successfully`, 'success');

        } catch (error) {
            console.error('Failed to load preset:', error);
            this.log(`Failed to load preset: ${error.message}`, 'error');
        }
    }

    deletePreset(presetName) {
        try {
            const presets = this.getStoredPresets();
            if (presets[presetName]) {
                delete presets[presetName];
                localStorage.setItem('parsec-presets', JSON.stringify(presets));
                this.log(`Preset "${presetName}" deleted`, 'info');
                this.loadPresets();
            }
        } catch (error) {
            console.error('Failed to delete preset:', error);
            this.log(`Failed to delete preset: ${error.message}`, 'error');
        }
    }

    getStoredPresets() {
        try {
            const stored = localStorage.getItem('parsec-presets');
            return stored ? JSON.parse(stored) : {};
        } catch (error) {
            console.error('Failed to parse stored presets:', error);
            return {};
        }
    }

    loadPresets() {
        if (!this.elements.presetBankGrid) return;

        try {
            const presets = this.getStoredPresets();
            const presetNames = Object.keys(presets);

            this.elements.presetBankGrid.innerHTML = '';

            if (presetNames.length === 0) {
                this.elements.presetBankGrid.innerHTML = '<div class="no-presets">No presets saved yet</div>';
                return;
            }

            // Sort with proper error handling for missing timestamps
            presetNames.sort((a, b) => {
                const timeB = (presets[b] && presets[b].timestamp) ? presets[b].timestamp : 0;
                const timeA = (presets[a] && presets[a].timestamp) ? presets[a].timestamp : 0;
                return timeB - timeA; // Most recent first
            });

            presetNames.forEach(presetName => {
                const preset = presets[presetName];
                
                // Add safety checks for preset data
                if (!preset || typeof preset !== 'object') {
                    console.warn(`Invalid preset data for "${presetName}", skipping`);
                    return;
                }
                
                const presetCard = document.createElement('div');
                presetCard.className = 'preset-card';

                const date = new Date(preset.timestamp || Date.now()).toLocaleDateString();
                const effectCount = (preset.effectsChain && Array.isArray(preset.effectsChain)) ? preset.effectsChain.length : 0;
                const gestureCount = (preset.gestureMappings && Array.isArray(preset.gestureMappings)) ? preset.gestureMappings.length : 0;

                presetCard.innerHTML = `
                    <div class="preset-header">
                        <div class="preset-name">${presetName}</div>
                        <div class="preset-date">${date}</div>
                    </div>
                    <div class="preset-info">
                        ${effectCount} effect${effectCount !== 1 ? 's' : ''}<br>
                        ${gestureCount} gesture mapping${gestureCount !== 1 ? 's' : ''}
                    </div>
                    <div class="preset-actions">
                        <button class="preset-btn load" onclick="parsec.loadPreset('${presetName}')">Load</button>
                        <button class="preset-btn delete" onclick="parsec.deletePreset('${presetName}')" title="Delete">🗑️</button>
                    </div>
                `;

                this.elements.presetBankGrid.appendChild(presetCard);
            });

        } catch (error) {
            console.error('Failed to load presets:', error);
            this.elements.presetBankGrid.innerHTML = '<div class="no-presets">Error loading presets</div>';
        }
    }
}

// Make removeEffectFromChain globally accessible
window.parsec = null;

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    window.parsec = new ParsecSimple();
});