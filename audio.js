class AudioManager {
    constructor() {
        this.context = null;
        this.inputSource = null;
        this.outputGain = null;
        this.analyser = null;
        this.volumeDataArray = null;
        this.mediaStream = null;
        this.isStarted = false;
        this.listeners = {};
        this.volumeMonitorInterval = null;
    }

    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => callback(data));
        }
    }

    async startAudio() {
        try {
            console.log('🎵 Starting audio context...');
            
            // Create audio context
            this.context = new (window.AudioContext || window.webkitAudioContext)({
                latencyHint: 'interactive',
                sampleRate: 44100
            });
            
            if (this.context.state === 'suspended') {
                await this.context.resume();
            }
            
            console.log(`✓ Audio context created: ${this.context.sampleRate}Hz, ${this.context.destination.maxChannelCount} channels`);
            
            // Create output gain node
            this.outputGain = this.context.createGain();
            this.outputGain.gain.setValueAtTime(0.8, this.context.currentTime);
            
            // Create analyser node for volume monitoring
            this.analyser = this.context.createAnalyser();
            this.analyser.fftSize = 256;
            this.analyser.smoothingTimeConstant = 0.8;
            this.volumeDataArray = new Uint8Array(this.analyser.frequencyBinCount);
            
            // Connect: outputGain → analyser → destination
            this.outputGain.connect(this.analyser);
            this.analyser.connect(this.context.destination);
            
            console.log('✓ Output gain node and analyser created and connected to speakers');
            
            // Start volume monitoring
            this.startVolumeMonitoring();
            
            this.isStarted = true;
            this.emit('started');
            
            return this.context;
            
        } catch (error) {
            console.error('❌ Failed to start audio:', error);
            this.emit('error', `Failed to start audio: ${error.message}`);
            throw error;
        }
    }

    startVolumeMonitoring() {
        if (this.volumeMonitorInterval) {
            clearInterval(this.volumeMonitorInterval);
        }
        
        this.volumeMonitorInterval = setInterval(() => {
            if (this.analyser && this.volumeDataArray) {
                this.analyser.getByteFrequencyData(this.volumeDataArray);
                
                // Calculate average volume
                let sum = 0;
                for (let i = 0; i < this.volumeDataArray.length; i++) {
                    sum += this.volumeDataArray[i];
                }
                const averageVolume = sum / this.volumeDataArray.length;
                const normalizedVolume = averageVolume / 255; // Normalize to 0-1
                
                this.emit('volumeUpdate', normalizedVolume);
            }
        }, 50); // Update every 50ms for smooth animation
    }

    async connectMicrophone(deviceId = null) {
        if (!this.context) {
            throw new Error('Audio context not started. Call startAudio() first.');
        }

        try {
            console.log('🎤 Requesting microphone access...');
            
            // Stop existing stream if any
            if (this.mediaStream) {
                this.mediaStream.getTracks().forEach(track => track.stop());
                console.log('🛑 Stopped previous microphone stream');
            }

            // Configure audio constraints
            const constraints = {
                audio: {
                    deviceId: deviceId ? { exact: deviceId } : undefined,
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    latency: 0,
                    channelCount: { ideal: 1 },
                    sampleRate: { ideal: 44100 }
                }
            };

            // Get microphone stream
            this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
            
            // Log device info
            const audioTrack = this.mediaStream.getAudioTracks()[0];
            console.log(`✓ Microphone connected: ${audioTrack.label}`);
            console.log(`  Settings: ${JSON.stringify(audioTrack.getSettings())}`);

            // Create source node
            if (this.inputSource) {
                this.inputSource.disconnect();
            }
            
            this.inputSource = this.context.createMediaStreamSource(this.mediaStream);
            console.log('✓ Audio input source node created');
            
            this.emit('micConnected', audioTrack.label);
            return this.inputSource;
            
        } catch (error) {
            console.error('❌ Failed to connect microphone:', error);
            this.emit('error', `Failed to connect microphone: ${error.message}`);
            throw error;
        }
    }

    async getAudioInputs() {
        try {
            // Request permission first to get device labels
            try {
                const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                tempStream.getTracks().forEach(track => track.stop());
            } catch (permError) {
                console.warn('⚠ Microphone permission needed for device names');
            }
            
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioInputs = devices.filter(device => device.kind === 'audioinput');
            
            console.log(`📋 Found ${audioInputs.length} audio input devices:`);
            audioInputs.forEach((device, i) => {
                console.log(`  ${i}: ${device.label || 'Unknown Device'} (${device.deviceId.substr(0, 8)}...)`);
            });
            
            return audioInputs;
        } catch (error) {
            console.error('❌ Failed to get audio inputs:', error);
            return [];
        }
    }

    connectToOutput(sourceNode) {
        if (!this.outputGain) {
            throw new Error('Output gain not initialized');
        }
        
        sourceNode.connect(this.outputGain);
        console.log('🔊 Audio connected to output (speakers/headphones)');
    }

    setOutputVolume(volume) {
        if (this.outputGain) {
            this.outputGain.gain.setValueAtTime(volume, this.context.currentTime);
            console.log(`🔊 Output volume set to ${(volume * 100).toFixed(0)}%`);
        }
    }

    stop() {
        console.log('🛑 Stopping audio...');
        
        if (this.volumeMonitorInterval) {
            clearInterval(this.volumeMonitorInterval);
            this.volumeMonitorInterval = null;
        }
        
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
            console.log('✓ Microphone stream stopped');
        }

        if (this.inputSource) {
            this.inputSource.disconnect();
            this.inputSource = null;
            console.log('✓ Input source disconnected');
        }

        this.isStarted = false;
        this.emit('stopped');
    }
}