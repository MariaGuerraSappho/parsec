export class HandTracker {
    constructor() {
        this.hands = null;
        this.camera = null;
        this.video = null;
        this.canvas = null;
        this.canvasCtx = null;
        this.isInitialized = false;
        this.listeners = {};
        this.lastResults = null;
        
        // Gesture recognition parameters
        this.gestures = {
            pinch: { active: false, value: 0, threshold: 0.05 },
            fist: { active: false, value: 0, threshold: 0.3 },
            spread: { active: false, value: 0, threshold: 0.8 },
            pointUp: { active: false, value: 0, threshold: 0.7 },
            thumbUp: { active: false, value: 0, threshold: 0.6 },
            peace: { active: false, value: 0, threshold: 0.5 },
            palmDistance: { active: false, value: 0, min: 0, max: 1 },
            handHeight: { active: false, value: 0, min: 0, max: 1 },
            handTilt: { active: false, value: 0, min: -1, max: 1 }
        };
        
        console.log('🤚 HandTracker initialized');
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

    async initialize(videoElement, canvasElement) {
        try {
            this.video = videoElement;
            this.canvas = canvasElement;
            this.canvasCtx = this.canvas.getContext('2d');

            // Initialize MediaPipe Hands using window object
            this.hands = new window.Hands({
                locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
                }
            });

            this.hands.setOptions({
                maxNumHands: 2,
                modelComplexity: 1,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5
            });

            this.hands.onResults((results) => this.onResults(results));

            // Initialize camera using getUserMedia directly
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    width: 640, 
                    height: 480 
                } 
            });
            
            this.video.srcObject = stream;
            this.video.addEventListener('loadedmetadata', () => {
                this.video.play();
                this.startCameraLoop();
            });
            
            this.isInitialized = true;
            
            console.log('✅ Hand tracking initialized');
            this.emit('initialized');
            
        } catch (error) {
            console.error('❌ Failed to initialize hand tracking:', error);
            this.emit('error', error.message);
            throw error;
        }
    }

    startCameraLoop() {
        const processFrame = async () => {
            if (this.video && this.video.readyState === 4) {
                await this.hands.send({ image: this.video });
            }
            if (this.isInitialized) {
                requestAnimationFrame(processFrame);
            }
        };
        processFrame();
    }

    onResults(results) {
        this.lastResults = results;
        
        // Clear canvas
        this.canvasCtx.save();
        this.canvasCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.canvasCtx.drawImage(results.image, 0, 0, this.canvas.width, this.canvas.height);

        if (results.multiHandLandmarks) {
            // Process each hand
            results.multiHandLandmarks.forEach((landmarks, handIndex) => {
                const handedness = results.multiHandedness[handIndex];
                const isRightHand = handedness.label === 'Right';
                
                // Draw hand landmarks using window objects
                window.drawConnectors(this.canvasCtx, landmarks, window.Hands.HAND_CONNECTIONS, {
                    color: isRightHand ? '#00FF00' : '#FF0000',
                    lineWidth: 2
                });
                window.drawLandmarks(this.canvasCtx, landmarks, {
                    color: isRightHand ? '#00FF00' : '#FF0000',
                    lineWidth: 1
                });
                
                // Recognize gestures
                const gestures = this.recognizeGestures(landmarks);
                
                // Emit gesture data
                this.emit('gestureUpdate', {
                    handIndex,
                    isRightHand,
                    landmarks,
                    gestures
                });
            });
        }

        this.canvasCtx.restore();
    }

    recognizeGestures(landmarks) {
        const gestures = { ...this.gestures };
        
        // Helper function to calculate distance between two points
        const distance = (p1, p2) => {
            return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
        };

        // Pinch gesture (thumb tip to index finger tip)
        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
        const pinchDistance = distance(thumbTip, indexTip);
        gestures.pinch.value = Math.max(0, 1 - (pinchDistance / 0.1));
        gestures.pinch.active = pinchDistance < gestures.pinch.threshold;

        // Fist gesture (all fingertips close to palm)
        const palmCenter = landmarks[9]; // Middle finger MCP
        const fingertips = [landmarks[4], landmarks[8], landmarks[12], landmarks[16], landmarks[20]];
        const avgDistanceToPalm = fingertips.reduce((sum, tip) => sum + distance(tip, palmCenter), 0) / fingertips.length;
        gestures.fist.value = Math.max(0, 1 - (avgDistanceToPalm / 0.15));
        gestures.fist.active = avgDistanceToPalm < gestures.fist.threshold;

        // Spread gesture (fingers spread apart)
        const fingerDistances = [
            distance(landmarks[8], landmarks[12]),  // index to middle
            distance(landmarks[12], landmarks[16]), // middle to ring
            distance(landmarks[16], landmarks[20])  // ring to pinky
        ];
        const avgFingerSpread = fingerDistances.reduce((sum, dist) => sum + dist, 0) / fingerDistances.length;
        gestures.spread.value = Math.min(1, avgFingerSpread / 0.1);
        gestures.spread.active = avgFingerSpread > gestures.spread.threshold;

        // Point up gesture (index finger extended, others closed)
        const indexMcp = landmarks[5];
        const indexPip = landmarks[6];
        const indexDip = landmarks[7];
        const indexExtended = landmarks[8].y < indexDip.y && indexDip.y < indexPip.y && indexPip.y < indexMcp.y;
        
        const middleMcp = landmarks[9];
        const middleClosed = landmarks[12].y > middleMcp.y;
        const ringClosed = landmarks[16].y > landmarks[13].y;
        const pinkyClosed = landmarks[20].y > landmarks[17].y;
        
        gestures.pointUp.active = indexExtended && middleClosed && ringClosed && pinkyClosed;
        gestures.pointUp.value = gestures.pointUp.active ? 1 : 0;

        // Thumb up gesture
        const thumbExtended = landmarks[4].y < landmarks[3].y && landmarks[3].y < landmarks[2].y;
        const othersClosed = middleClosed && ringClosed && pinkyClosed && landmarks[8].y > landmarks[5].y;
        gestures.thumbUp.active = thumbExtended && othersClosed;
        gestures.thumbUp.value = gestures.thumbUp.active ? 1 : 0;

        // Peace gesture (index and middle extended)
        const middleExtended = landmarks[12].y < landmarks[11].y && landmarks[11].y < landmarks[10].y;
        gestures.peace.active = indexExtended && middleExtended && ringClosed && pinkyClosed;
        gestures.peace.value = gestures.peace.active ? 1 : 0;

        // Palm distance from camera (using hand size as proxy)
        const wristToPinky = distance(landmarks[0], landmarks[20]);
        gestures.palmDistance.value = Math.min(1, Math.max(0, wristToPinky / 0.3));

        // Hand height (normalized Y position)
        const handCenterY = landmarks[9].y;
        gestures.handHeight.value = 1 - handCenterY; // Invert so up is higher value

        // Hand tilt (wrist to middle finger angle)
        const wrist = landmarks[0];
        const middleFinger = landmarks[12];
        const angle = Math.atan2(middleFinger.y - wrist.y, middleFinger.x - wrist.x);
        gestures.handTilt.value = Math.sin(angle); // -1 to 1 range

        return gestures;
    }

    stop() {
        this.isInitialized = false;
        
        if (this.video && this.video.srcObject) {
            this.video.srcObject.getTracks().forEach(track => track.stop());
            this.video.srcObject = null;
        }
        
        console.log('🛑 Hand tracking stopped');
    }
}