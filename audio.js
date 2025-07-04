class AudioManager {
    constructor() {
        this.audioContext = null;
        this.mediaStream = null;
        this.sourceNode = null;
        this.gainNode = null;
        this.analyserNode = null;
        this.animationId = null;
        this.listeners = {};
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

    async getAudioInputs() {
        try {
            // Request permission first to get proper device labels
            try {
                const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                tempStream.getTracks().forEach(track => track.stop());
            } catch (permError) {
                // If permission denied, we'll get devices without labels
                this.emit('error', 'Microphone permission needed to show device names');
            }
            
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioInputs = devices.filter(device => device.kind === 'audioinput');
            
            // Log available devices for debugging
            audioInputs.forEach((device, index) => {
                console.log(`Audio Input ${index}: ${device.label || 'Unknown'} (${device.deviceId})`);
            });
            
            return audioInputs;
        } catch (error) {
            this.emit('error', error.message);
            return [];
        }
    }

    async selectInput(deviceId) {
        try {
            // Stop current stream if exists
            this.stop();

            // Verify audio context is available
            if (!this.audioContext) {
                throw new Error('Audio context not initialized. Please start audio first.');
            }

            // Ensure audio context is running
            if (this.audioContext.state !== 'running') {
                await this.audioContext.resume();
                console.log('Audio context resumed in AudioManager');
            }
            
            // Log the device selection attempt
            console.log(`Selecting audio input device: ${deviceId}`);
            
            // Get media stream with optimized constraints for real-time audio
            const constraints = {
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    latency: 0,
                    channelCount: { ideal: 2, min: 1 },
                    sampleRate: { ideal: 44100 },
                    sampleSize: { ideal: 16 }
                }
            };
            
            // Add device constraint if specific device ID provided
            if (deviceId && deviceId !== '') {
                constraints.audio.deviceId = { exact: deviceId };
            }
            
            this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
            
            // Log successful device connection
            const audioTrack = this.mediaStream.getAudioTracks()[0];
            if (audioTrack) {
                console.log(`✓ Connected to audio device: ${audioTrack.label}`);
                console.log(`Device settings: ${audioTrack.getSettings().sampleRate}Hz, ${audioTrack.getSettings().channelCount} channels`);
                this.emit('info', `Connected: ${audioTrack.label}`);
            }

            // Create audio processing nodes
            this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
            this.gainNode = this.audioContext.createGain();
            this.analyserNode = this.audioContext.createAnalyser();

            // Configure analyser for better monitoring and signal detection
            this.analyserNode.fftSize = 512;
            this.analyserNode.smoothingTimeConstant = 0.3;
            this.analyserNode.minDecibels = -90;
            this.analyserNode.maxDecibels = -10;

            // Set initial gain - higher for better signal
            this.gainNode.gain.setValueAtTime(1.0, this.audioContext.currentTime);

            // Connect audio path: source → gain node (this will connect to effects chain)
            this.sourceNode.connect(this.gainNode);
            
            // Connect analyser in parallel for monitoring (doesn't affect audio path)
            this.sourceNode.connect(this.analyserNode);

            console.log('✓ Audio input chain created: MediaStream → SourceNode → GainNode → [Effects Chain]');
            console.log('✓ Parallel connection: SourceNode → AnalyserNode (for monitoring)');
            
            // Start volume monitoring immediately
            this.startVolumeMonitoring();

            // Test signal after a brief delay
            setTimeout(() => {
                this.testInputLevel();
            }, 300);

            return this.gainNode;

        } catch (error) {
            console.error('Audio input selection failed:', error);
            this.emit('error', `Failed to connect to audio device: ${error.message}`);
            throw error;
        }
    }

    testInputLevel() {
        if (!this.analyserNode) return;

        const bufferLength = this.analyserNode.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        // Test input level
        this.analyserNode.getByteTimeDomainData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
            sum += Math.abs(dataArray[i] - 128);
        }
        const signalLevel = (sum / bufferLength) / 128;
        
        // Lower threshold to match volume meter sensitivity
        if (signalLevel > 0.002) {
            console.log(`✓ Input signal level: ${(signalLevel * 100).toFixed(1)}%`);
            this.emit('info', `Input signal: ${(signalLevel * 100).toFixed(1)}%`);
        } else {
            console.log('⚠ No input signal detected - speak into microphone or check levels');
            this.emit('error', 'No input signal - check microphone levels');
        }
    }

    setAudioContext(context) {
        this.audioContext = context;
    }

    setVolume(volume) {
        if (this.gainNode) {
            this.gainNode.gain.value = volume;
        }
    }

    startVolumeMonitoring() {
        if (!this.analyserNode) {
            console.log('No analyser node available for volume monitoring');
            return;
        }

        const bufferLength = this.analyserNode.frequencyBinCount;
        const timeDataArray = new Uint8Array(bufferLength);
        
        let lastUpdateTime = 0;
        const updateInterval = 50; // Update every 50ms for more responsive monitoring

        const monitor = (currentTime) => {
            this.animationId = requestAnimationFrame(monitor);

            // Throttle volume updates but be more responsive
            if (currentTime - lastUpdateTime < updateInterval) {
                return;
            }
            lastUpdateTime = currentTime;

            // Get time domain data
            this.analyserNode.getByteTimeDomainData(timeDataArray);

            // Calculate volume level with better sensitivity
            let sum = 0;
            let peak = 0;
            for (let i = 0; i < bufferLength; i++) {
                const sample = Math.abs(timeDataArray[i] - 128);
                sum += sample;
                peak = Math.max(peak, sample);
            }
            
            // Use both average and peak for better volume representation
            const avgVolume = (sum / bufferLength) / 128;
            const peakVolume = peak / 128;
            
            // Combine average and peak for more responsive display
            const displayVolume = Math.max(avgVolume * 1.5, peakVolume * 0.8);
            
            this.emit('volumeUpdate', Math.min(displayVolume, 1.0));
        };

        console.log('✓ Volume monitoring started');
        monitor(performance.now());
    }

    stop() {
        // Stop animation
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }

        // Stop media stream
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }

        // Don't close audio context - let main.js manage it
        // Clear nodes
        this.sourceNode = null;
        this.gainNode = null;
        this.analyserNode = null;
    }
}