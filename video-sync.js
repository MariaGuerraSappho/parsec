export class VideoSyncManager {
    constructor() {
        this.mainVideo = null;
        this.projectorWindow = null;
        this.currentVideoBlob = null;
        this.syncInterval = null;
        this.listeners = {};
        this.isProjectorConnected = false;
        
        console.log('🎬 VideoSyncManager initialized');
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

    initialize(videoElement) {
        this.mainVideo = videoElement;
        this.setupVideoEvents();
        console.log('🎬 Video sync initialized');
    }

    setupVideoEvents() {
        if (!this.mainVideo) return;

        // Sync events
        this.mainVideo.addEventListener('play', () => {
            // Only send to projector if it's ready
            if (this.isProjectorConnected) {
                this.sendToProjector({ type: 'play' });
            }
            this.startSyncInterval();
        });

        this.mainVideo.addEventListener('pause', () => {
            this.sendToProjector({ type: 'pause' });
            this.stopSyncInterval();
        });

        this.mainVideo.addEventListener('seeked', () => {
            this.sendToProjector({ 
                type: 'syncTime', 
                time: this.mainVideo.currentTime 
            });
        });

        this.mainVideo.addEventListener('loadedmetadata', () => {
            this.emit('videoLoaded', {
                duration: this.mainVideo.duration,
                fileName: this.currentFileName || 'Unknown'
            });
        });

        // Listen for projector window messages
        window.addEventListener('message', (event) => {
            if (event.data.type === 'projectorReady') {
                this.isProjectorConnected = true;
                this.emit('projectorConnected');
                
                // Start main video playback when projector is ready
                if (this.mainVideo && this.mainVideo.src) {
                    this.mainVideo.play().catch(console.error);
                }
            }
        });
    }

    loadVideo(file) {
        if (!file || !this.mainVideo) return;

        // Create blob URL
        if (this.currentVideoBlob) {
            URL.revokeObjectURL(this.currentVideoBlob);
        }

        this.currentVideoBlob = URL.createObjectURL(file);
        this.currentFileName = file.name;
        this.mainVideo.src = this.currentVideoBlob;

        // Send to projector if connected
        if (this.isProjectorConnected) {
            this.sendVideoToProjector();
        }

        console.log(`🎬 Video loaded: ${file.name}`);
        this.emit('videoChanged', { fileName: file.name, url: this.currentVideoBlob });
    }

    openProjectorWindow() {
        if (this.projectorWindow && !this.projectorWindow.closed) {
            this.projectorWindow.focus();
            return;
        }

        const videoURL = this.currentVideoBlob || '';
        
        const projectorHTML = `
            <!DOCTYPE html>
            <html>
                <head>
                    <meta charset="utf-8">
                    <title>Projector</title>
                    <style>
                        html, body {
                            margin: 0;
                            padding: 0;
                            background: black;
                            overflow: hidden;
                            width: 100vw;
                            height: 100vh;
                            font-family: Arial, sans-serif;
                        }
                        video {
                            position: absolute;
                            top: 50%;
                            left: 50%;
                            transform: translate(-50%, -50%);
                            max-width: 100vw;
                            max-height: 100vh;
                            object-fit: contain;
                        }
                        .click-overlay {
                            position: absolute;
                            top: 0;
                            left: 0;
                            width: 100vw;
                            height: 100vh;
                            background: rgba(0, 0, 0, 0.8);
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            cursor: pointer;
                            z-index: 1000;
                        }
                        .click-overlay.hidden {
                            display: none;
                        }
                        .click-button {
                            background: linear-gradient(45deg, #4ecdc4, #44a08d);
                            color: white;
                            border: none;
                            padding: 20px 40px;
                            border-radius: 10px;
                            font-size: 24px;
                            font-weight: bold;
                            cursor: pointer;
                            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
                            transition: transform 0.2s ease;
                        }
                        .click-button:hover {
                            transform: scale(1.05);
                        }
                    </style>
                </head>
                <body>
                    <div class="click-overlay" id="clickOverlay">
                        <button class="click-button" id="startButton">🎬 Click to Start Projector</button>
                    </div>
                    <video id="projector-video" ${videoURL ? `src="${videoURL}"` : ''} muted playsinline preload="metadata"></video>
                    <script>
                        const video = document.getElementById('projector-video');
                        const overlay = document.getElementById('clickOverlay');
                        const startButton = document.getElementById('startButton');
                        let isMainWindowControlling = false;
                        let isInFullscreen = false;
                        let isReady = false;
                        
                        // Function to request fullscreen
                        function requestFullscreen(element) {
                            if (element.requestFullscreen) {
                                element.requestFullscreen();
                            } else if (element.webkitRequestFullscreen) {
                                element.webkitRequestFullscreen();
                            } else if (element.mozRequestFullScreen) {
                                element.mozRequestFullScreen();
                            } else if (element.msRequestFullscreen) {
                                element.msRequestFullscreen();
                            }
                        }
                        
                        // Add double-click handler for fullscreen
                        video.addEventListener('dblclick', (e) => {
                            e.preventDefault();
                            if (!isInFullscreen) {
                                requestFullscreen(video);
                            } else {
                                // Exit fullscreen
                                if (document.exitFullscreen) {
                                    document.exitFullscreen();
                                } else if (document.webkitExitFullscreen) {
                                    document.webkitExitFullscreen();
                                } else if (document.mozCancelFullScreen) {
                                    document.mozCancelFullScreen();
                                } else if (document.msExitFullscreen) {
                                    document.msExitFullscreen();
                                }
                            }
                        });
                        
                        // Handle start button click
                        startButton.addEventListener('click', async () => {
                            try {
                                // Hide overlay
                                overlay.classList.add('hidden');
                                
                                // Start video if there's a source
                                if (video.src) {
                                    await video.play();
                                }
                                
                                isReady = true;
                                
                                // Notify parent window that projector is ready
                                if (window.opener) {
                                    window.opener.postMessage({ type: 'projectorReady' }, '*');
                                }
                                
                                console.log('Projector ready and video started');
                                
                            } catch (error) {
                                console.error('Failed to start projector video:', error);
                                // Show overlay again if there was an error
                                overlay.classList.remove('hidden');
                            }
                        });

                        window.addEventListener('message', (event) => {
                            // Only process messages if projector is ready
                            if (!isReady) return;
                            
                            try {
                                isMainWindowControlling = true;
                                if (event.data.type === 'syncTime') {
                                    if (Math.abs(video.currentTime - event.data.time) > 0.1) {
                                        video.currentTime = event.data.time;
                                    }
                                } else if (event.data.type === 'play') {
                                    video.play().catch(console.error);
                                } else if (event.data.type === 'pause') {
                                    video.pause();
                                } else if (event.data.type === 'loadVideo') {
                                    video.src = event.data.url;
                                    console.log('Projector loaded video:', event.data.url);
                                }
                                setTimeout(() => { isMainWindowControlling = false; }, 100);
                            } catch (error) {
                                console.error('Projector message error:', error);
                            }
                        }, false);

                        // Handle fullscreen changes
                        document.addEventListener('fullscreenchange', () => {
                            isInFullscreen = !!document.fullscreenElement;
                            console.log('Fullscreen changed:', isInFullscreen);
                            
                            // If entering fullscreen and video is paused, resume it
                            if (isInFullscreen && video.paused && isReady) {
                                setTimeout(() => {
                                    if (window.opener && window.opener.parsec && window.opener.parsec.mainVideo) {
                                        const mainVideo = window.opener.parsec.mainVideo;
                                        if (!mainVideo.paused) {
                                            video.play().catch(console.error);
                                            console.log('Resumed video after fullscreen');
                                        }
                                    }
                                }, 100);
                            }
                        });

                        // Handle webkit fullscreen (Safari/Chrome)
                        document.addEventListener('webkitfullscreenchange', () => {
                            isInFullscreen = !!document.webkitFullscreenElement;
                            console.log('Webkit fullscreen changed:', isInFullscreen);
                            
                            if (isInFullscreen && video.paused && isReady) {
                                setTimeout(() => {
                                    if (window.opener && window.opener.parsec && window.opener.parsec.mainVideo) {
                                        const mainVideo = window.opener.parsec.mainVideo;
                                        if (!mainVideo.paused) {
                                            video.play().catch(console.error);
                                            console.log('Resumed video after webkit fullscreen');
                                        }
                                    }
                                }, 100);
                            }
                        });

                        // Fallback: prevent unwanted pausing while in fullscreen
                        video.addEventListener('pause', (event) => {
                            // If video pauses while in fullscreen and not controlled by main window, resume it
                            if (isInFullscreen && !isMainWindowControlling && isReady) {
                                setTimeout(() => {
                                    if (window.opener && window.opener.parsec && window.opener.parsec.mainVideo) {
                                        const mainVideo = window.opener.parsec.mainVideo;
                                        if (!mainVideo.paused) {
                                            video.play().catch(console.error);
                                            console.log('Auto-resumed video during fullscreen');
                                        }
                                    }
                                }, 50);
                            }
                        });

                        // Handle window close
                        window.addEventListener('beforeunload', () => {
                            if (window.opener) {
                                window.opener.postMessage({ type: 'projectorClosed' }, '*');
                            }
                        });

                        // Load video if URL was provided, but don't auto-play
                        if (video.src) {
                            video.load();
                        }
                    </script>
                </body>
            </html>
        `;

        try {
            // Open window with parameters to minimize browser chrome
            this.projectorWindow = window.open(
                '',
                'projector',
                'width=' + screen.availWidth + ',height=' + screen.availHeight + ',top=0,left=0,resizable=yes,scrollbars=no,toolbar=no,menubar=no,location=no,directories=no,status=no'
            );

            if (this.projectorWindow) {
                // Write the HTML content directly to the window
                this.projectorWindow.document.write(projectorHTML);
                this.projectorWindow.document.close();

                // Monitor projector window
                this.monitorProjectorWindow();
                console.log('🎬 Projector window opened');
            } else {
                throw new Error('Failed to open projector window - popup may be blocked');
            }

        } catch (error) {
            console.error('🎬 Failed to open projector window:', error);
            this.emit('error', `Failed to open projector: ${error.message}`);
        }
    }

    monitorProjectorWindow() {
        const checkProjector = setInterval(() => {
            if (this.projectorWindow && this.projectorWindow.closed) {
                clearInterval(checkProjector);
                this.isProjectorConnected = false;
                this.projectorWindow = null;
                this.stopSyncInterval();
                this.emit('projectorDisconnected');
                console.log('🎬 Projector window closed');
            }
        }, 1000);
    }

    sendVideoToProjector() {
        if (this.currentVideoBlob) {
            this.sendToProjector({
                type: 'loadVideo',
                url: this.currentVideoBlob
            });
        }
    }

    sendToProjector(message) {
        if (this.projectorWindow && !this.projectorWindow.closed) {
            try {
                this.projectorWindow.postMessage(message, '*');
            } catch (error) {
                console.error('🎬 Failed to send message to projector:', error);
            }
        }
    }

    startSyncInterval() {
        this.stopSyncInterval();
        this.syncInterval = setInterval(() => {
            if (this.mainVideo && !this.mainVideo.paused) {
                this.sendToProjector({
                    type: 'syncTime',
                    time: this.mainVideo.currentTime
                });
            }
        }, 200); // Sync every 200ms for smooth playback
    }

    stopSyncInterval() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
    }

    play() {
        if (this.mainVideo) {
            // Only play if projector is ready, or if no projector window is open
            if (this.isProjectorConnected || !this.projectorWindow || this.projectorWindow.closed) {
                this.mainVideo.play().catch(console.error);
            }
        }
    }

    pause() {
        if (this.mainVideo) {
            this.mainVideo.pause();
        }
    }

    closeProjector() {
        if (this.projectorWindow && !this.projectorWindow.closed) {
            this.projectorWindow.close();
        }
        this.isProjectorConnected = false;
        this.projectorWindow = null;
        this.stopSyncInterval();
        this.emit('projectorDisconnected');
    }

    cleanup() {
        this.closeProjector();
        this.stopSyncInterval();
        
        if (this.currentVideoBlob) {
            URL.revokeObjectURL(this.currentVideoBlob);
            this.currentVideoBlob = null;
        }
    }
}