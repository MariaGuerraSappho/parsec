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
        
        // BuzzBox service and characteristic UUIDs
        this.SERVICE_UUID = '12345678-1234-5678-1234-56789abcdef0';
        this.MODE_CHARACTERISTIC_UUID = '12345678-1234-5678-1234-56789abcdef1';
        this.STRENGTH_CHARACTERISTIC_UUID = '12345678-1234-5678-1234-56789abcdef2';
        this.INTERVAL_CHARACTERISTIC_UUID = '12345678-1234-5678-1234-56789abcdef3';
        this.BATTERY_LEVEL_CHARACTERISTIC_UUID = '12345678-1234-5678-1234-56789abcdef4'; // Custom battery characteristic
        
        // Remove standard Battery Service UUID - using custom service instead
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

    async readBatteryLevel() {
        try {
            if (!this.batteryLevelCharacteristic) {
                return null;
            }
            
            const value = await this.batteryLevelCharacteristic.readValue();
            const batteryLevel = value.getUint8(0);
            
            this.emit('batteryUpdate', batteryLevel);
            return batteryLevel;
            
        } catch (error) {
            this.emit('error', `Failed to read battery level: ${error.message}`);
            this.emit('batteryUpdate', null); // Emit null to trigger "--" display
            return null;
        }
    }

    async disconnect() {
        try {
            // Stop battery polling before disconnecting
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
            
            const buffer = new Uint8Array([mode]);
            await this.modeCharacteristic.writeValue(buffer);
            
        } catch (error) {
            this.emit('error', error.message);
            throw error;
        }
    }

    async setStrength(strength) {
        try {
            if (!this.strengthCharacteristic) {
                throw new Error('Strength characteristic not available');
            }
            
            const buffer = new Uint8Array([strength]);
            await this.strengthCharacteristic.writeValue(buffer);
            
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
            
            const buffer = new Uint8Array([interval]);
            await this.intervalCharacteristic.writeValue(buffer);
            
        } catch (error) {
            this.emit('error', error.message);
            throw error;
        }
    }

    isConnected() {
        return this.device && this.device.gatt && this.device.gatt.connected;
    }
}