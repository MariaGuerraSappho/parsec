class AudioManager {
    constructor() {
        this.audioContext = null;
        this.mediaStream = null;
        this.sourceNode = null;
        this.gainNode = null;
        this.analyserNode = null;
        this.canvas = null;
        this.canvasContext = null;
        this.animationId = null;
        this.listeners = {};
        
        this.initializeCanvas();
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

    initializeCanvas() {
        this.canvas = document.getElementById('waveform');
        this.canvasContext = this.canvas.getContext('2d');
        
        // Set canvas size
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    resizeCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * window.devicePixelRatio;
        this.canvas.height = rect.height * window.devicePixelRatio;
        this.canvasContext.scale(window.devicePixelRatio, window.devicePixelRatio);
    }

    async getAudioInputs() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            return devices.filter(device => device.kind === 'audioinput');
        } catch (error) {
            this.emit('error', error.message);
            return [];
        }
    }

    async selectInput(deviceId) {
        try {
            // Stop current stream if exists
            this.stop();

            // Create audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Get media stream
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    deviceId: deviceId ? { exact: deviceId } : undefined,
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            });

            // Create audio nodes
            this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
            this.gainNode = this.audioContext.createGain();
            this.analyserNode = this.audioContext.createAnalyser();

            // Configure analyser
            this.analyserNode.fftSize = 2048;
            this.analyserNode.smoothingTimeConstant = 0.8;

            // Connect nodes
            this.sourceNode.connect(this.gainNode);
            this.gainNode.connect(this.analyserNode);

            // Start visualization
            this.startVisualization();

        } catch (error) {
            this.emit('error', error.message);
            throw error;
        }
    }

    setVolume(volume) {
        if (this.gainNode) {
            this.gainNode.gain.value = volume;
        }
    }

    startVisualization() {
        if (!this.analyserNode) return;

        const bufferLength = this.analyserNode.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        const timeDataArray = new Uint8Array(bufferLength);

        const draw = () => {
            this.animationId = requestAnimationFrame(draw);

            // Get frequency and time domain data
            this.analyserNode.getByteFrequencyData(dataArray);
            this.analyserNode.getByteTimeDomainData(timeDataArray);

            // Calculate volume level
            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
                sum += Math.abs(timeDataArray[i] - 128);
            }
            const volume = sum / bufferLength / 128;
            this.emit('volumeUpdate', volume);

            // Draw waveform
            this.drawWaveform(timeDataArray);
        };

        draw();
    }

    drawWaveform(dataArray) {
        const canvas = this.canvas;
        const ctx = this.canvasContext;
        const width = canvas.width / window.devicePixelRatio;
        const height = canvas.height / window.devicePixelRatio;

        // Clear canvas
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.fillRect(0, 0, width, height);

        // Draw waveform
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#4ecdc4';
        ctx.beginPath();

        const sliceWidth = width / dataArray.length;
        let x = 0;

        for (let i = 0; i < dataArray.length; i++) {
            const v = dataArray[i] / 128.0;
            const y = (v * height) / 2;

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }

            x += sliceWidth;
        }

        ctx.stroke();

        // Add glow effect
        ctx.shadowColor = '#4ecdc4';
        ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.shadowBlur = 0;
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

        // Close audio context
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
            this.audioContext = null;
        }

        // Clear nodes
        this.sourceNode = null;
        this.gainNode = null;
        this.analyserNode = null;

        // Clear canvas
        if (this.canvasContext) {
            const width = this.canvas.width / window.devicePixelRatio;
            const height = this.canvas.height / window.devicePixelRatio;
            this.canvasContext.clearRect(0, 0, width, height);
        }
    }
}

