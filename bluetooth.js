class BluetoothManager {
    constructor() {
        this.device = null;
        this.server = null;
        this.service = null;
        this.batteryService = null;
        this.modeCharacteristic = null;
        this.strengthCharacteristic = null;
        this.intervalCharacteristic = null;
        this.batteryLevelCharacteristic = null;
        this.listeners = {};
        this.batteryPollInterval = null; // Add polling interval tracker
        this.randomModeInterval = null;
        this.randomModeActive = false;
        this.currentRandomState = { buzzing: false, buzzDuration: 0, silenceDuration: 0 };
        
        // Add GATT operation queue to prevent overlapping operations
        this.gattQueue = [];
        this.gattBusy = false;
        
        // BuzzBox service and characteristic UUIDs
        this.SERVICE_UUID = '12345678-1234-5678-1234-56789abcdef0';
        this.MODE_CHARACTERISTIC_UUID = '12345678-1234-5678-1234-56789abcdef1';
        this.STRENGTH_CHARACTERISTIC_UUID = '12345678-1234-5678-1234-56789abcdef2';
        this.INTERVAL_CHARACTERISTIC_UUID = '12345678-1234-5678-1234-56789abcdef3';
        this.BATTERY_LEVEL_CHARACTERISTIC_UUID = '12345678-1234-5678-1234-56789abcdef4'; // Custom battery characteristic
        
        // Remove standard Battery Service UUID - using custom service instead
        console.log('🔵 BluetoothManager initialized');
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

    async connect() {
        try {
            // Check if Web Bluetooth is supported
            if (!navigator.bluetooth) {
                throw new Error('Web Bluetooth is not supported in this browser');
            }

            // Request device
            this.device = await navigator.bluetooth.requestDevice({
                filters: [{ name: 'BuzzBox' }],
                optionalServices: [this.SERVICE_UUID] // Only need custom service
            });

            // Add disconnect listener
            this.device.addEventListener('gattserverdisconnected', () => {
                this.stopBatteryPolling(); // Stop polling on disconnect
                this.emit('disconnected');
            });

            // Connect to GATT server
            this.server = await this.device.gatt.connect();
            
            // Get main service
            this.service = await this.server.getPrimaryService(this.SERVICE_UUID);
            
            // Get characteristics
            this.modeCharacteristic = await this.service.getCharacteristic(this.MODE_CHARACTERISTIC_UUID);
            this.strengthCharacteristic = await this.service.getCharacteristic(this.STRENGTH_CHARACTERISTIC_UUID);
            this.intervalCharacteristic = await this.service.getCharacteristic(this.INTERVAL_CHARACTERISTIC_UUID);
            
            // Get battery level characteristic from the same service
            try {
                this.batteryLevelCharacteristic = await this.service.getCharacteristic(this.BATTERY_LEVEL_CHARACTERISTIC_UUID);
                
                // Read initial battery level
                await this.readBatteryLevel();
                
                // Start automatic battery polling every 10 seconds
                this.startBatteryPolling();
                
            } catch (error) {
                this.emit('error', `Battery characteristic not available: ${error.message}`);
                // Emit battery update with null to show "--"
                this.emit('batteryUpdate', null);
            }
            
            this.emit('connected');
            
        } catch (error) {
            this.emit('error', error.message);
            throw error;
        }
    }

    /**
     * Start automatic battery level polling every 10 seconds
     */
    startBatteryPolling() {
        // Clear any existing interval
        this.stopBatteryPolling();
        
        // Set up new polling interval
        this.batteryPollInterval = setInterval(async () => {
            try {
                await this.readBatteryLevel();
            } catch (error) {
                this.emit('error', `Battery polling failed: ${error.message}`);
                // If polling fails, emit null to show "--"
                this.emit('batteryUpdate', null);
            }
        }, 10000); // Poll every 10 seconds
    }

    /**
     * Stop automatic battery level polling
     */
    stopBatteryPolling() {
        if (this.batteryPollInterval) {
            clearInterval(this.batteryPollInterval);
            this.batteryPollInterval = null;
        }
    }

    /**
     * Queue GATT operations to prevent "operation already in progress" errors
     */
    async queueGattOperation(operation) {
        return new Promise((resolve, reject) => {
            this.gattQueue.push({ operation, resolve, reject });
            this.processGattQueue();
        });
    }

    async processGattQueue() {
        if (this.gattBusy || this.gattQueue.length === 0) {
            return;
        }

        this.gattBusy = true;
        const { operation, resolve, reject } = this.gattQueue.shift();

        try {
            const result = await operation();
            resolve(result);
        } catch (error) {
            reject(error);
        } finally {
            this.gattBusy = false;
            // Process next operation after a small delay
            setTimeout(() => this.processGattQueue(), 50);
        }
    }

    async readBatteryLevel() {
        try {
            if (!this.batteryLevelCharacteristic) {
                return null;
            }
            
            return await this.queueGattOperation(async () => {
                const value = await this.batteryLevelCharacteristic.readValue();
                const batteryLevel = value.getUint8(0);
                
                this.emit('batteryUpdate', batteryLevel);
                return batteryLevel;
            });
            
        } catch (error) {
            this.emit('error', `Failed to read battery level: ${error.message}`);
            this.emit('batteryUpdate', null); // Emit null to trigger "--" display
            return null;
        }
    }

    async disconnect() {
        try {
            // Stop random mode and battery polling
            this.stopRandomMode();
            this.stopBatteryPolling();
            
            if (this.device && this.device.gatt.connected) {
                await this.device.gatt.disconnect();
            }
        } catch (error) {
            this.emit('error', error.message);
            throw error;
        }
    }

    async setMode(mode) {
        try {
            if (!this.modeCharacteristic) {
                throw new Error('Mode characteristic not available');
            }
            
            // Handle special modes
            if (mode === 2) {
                // Random mode - start the random pattern
                this.startRandomMode();
                this.emit('modeChanged', mode);
                return;
            } else if (mode === 3) {
                // Single buzz mode
                await this.singleBuzz();
                this.emit('modeChanged', mode);
                return;
            } else {
                // Stop random mode if it's running
                this.stopRandomMode();
            }
            
            await this.queueGattOperation(async () => {
                const buffer = new Uint8Array([mode]);
                await this.modeCharacteristic.writeValue(buffer);
            });
            
            console.log(`🔵 Mode set to: ${mode}`);
            this.emit('modeChanged', mode);
            
        } catch (error) {
            this.emit('error', error.message);
            throw error;
        }
    }

    startRandomMode() {
        if (this.randomModeActive) {
            this.stopRandomMode();
        }
        
        this.randomModeActive = true;
        console.log('🔵 Starting random mode');
        
        const runRandomCycle = async () => {
            if (!this.randomModeActive) return;
            
            // Generate random durations - buzz up to 10 seconds, silence up to 5 seconds
            const buzzDuration = 500 + Math.random() * 9500; // 500ms to 10000ms (10 seconds)
            const silenceDuration = 1000 + Math.random() * 4000; // 1000ms to 5000ms (5 seconds)
            
            this.currentRandomState = {
                buzzing: true,
                buzzDuration: Math.round(buzzDuration),
                silenceDuration: Math.round(silenceDuration)
            };
            
            this.emit('randomStateChanged', this.currentRandomState);
            
            try {
                // Start buzz
                await this.writeMode(1);
                console.log(`🔵 Random buzz: ${buzzDuration}ms`);
                
                // Wait for buzz duration
                await this.delay(buzzDuration);
                
                if (!this.randomModeActive) return;
                
                // Stop buzz
                await this.writeMode(0);
                this.currentRandomState.buzzing = false;
                this.emit('randomStateChanged', this.currentRandomState);
                
                console.log(`🔵 Random silence: ${silenceDuration}ms`);
                
                // Wait for silence duration
                await this.delay(silenceDuration);
                
                if (this.randomModeActive) {
                    // Schedule next cycle with a small delay to prevent overlapping operations
                    this.randomModeInterval = setTimeout(runRandomCycle, 100);
                }
                
            } catch (error) {
                console.error('🔵 Error in random mode:', error);
                this.emit('error', `Random mode error: ${error.message}`);
                this.stopRandomMode();
            }
        };
        
        // Start the first cycle
        runRandomCycle();
    }

    stopRandomMode() {
        if (this.randomModeInterval) {
            clearTimeout(this.randomModeInterval);
            this.randomModeInterval = null;
        }
        
        if (this.randomModeActive) {
            this.randomModeActive = false;
            console.log('🔵 Random mode stopped');
            
            // Explicitly turn off buzzer when stopping random mode
            this.writeMode(0).catch(error => {
                console.error('🔵 Failed to turn off buzzer after stopping random mode:', error);
            });
            
            this.emit('randomModeStopped');
        }
    }

    async singleBuzz() {
        try {
            console.log('🔵 Single buzz triggered');
            await this.writeMode(1);
            await this.delay(200); // Short buzz
            await this.writeMode(0);
            this.emit('singleBuzzComplete');
        } catch (error) {
            console.error('🔵 Single buzz error:', error);
            this.emit('error', `Single buzz error: ${error.message}`);
        }
    }

    async writeMode(mode) {
        if (!this.modeCharacteristic) {
            throw new Error('Mode characteristic not available');
        }
        
        return await this.queueGattOperation(async () => {
            const buffer = new Uint8Array([mode]);
            await this.modeCharacteristic.writeValue(buffer);
        });
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async setStrength(strength) {
        try {
            if (!this.strengthCharacteristic) {
                throw new Error('Strength characteristic not available');
            }
            
            await this.queueGattOperation(async () => {
                const buffer = new Uint8Array([strength]);
                await this.strengthCharacteristic.writeValue(buffer);
            });
            
        } catch (error) {
            this.emit('error', error.message);
            throw error;
        }
    }

    async setInterval(interval) {
        try {
            if (!this.intervalCharacteristic) {
                throw new Error('Interval characteristic not available');
            }
            
            await this.queueGattOperation(async () => {
                const buffer = new Uint8Array([interval]);
                await this.intervalCharacteristic.writeValue(buffer);
            });
            
        } catch (error) {
            this.emit('error', error.message);
            throw error;
        }
    }

    isConnected() {
        return this.device && this.device.gatt && this.device.gatt.connected;
    }
}