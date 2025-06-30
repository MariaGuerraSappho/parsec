class BluetoothManager {
    constructor() {
        this.device = null;
        this.server = null;
        this.service = null;
        this.modeCharacteristic = null;
        this.strengthCharacteristic = null;
        this.intervalCharacteristic = null;
        this.listeners = {};
        
        // BuzzBox service and characteristic UUIDs
        this.SERVICE_UUID = '12345678-1234-5678-1234-56789abcdef0';
        this.MODE_CHARACTERISTIC_UUID = '12345678-1234-5678-1234-56789abcdef1';
        this.STRENGTH_CHARACTERISTIC_UUID = '12345678-1234-5678-1234-56789abcdef2';
        this.INTERVAL_CHARACTERISTIC_UUID = '12345678-1234-5678-1234-56789abcdef3';
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
                optionalServices: [this.SERVICE_UUID]
            });

            // Add disconnect listener
            this.device.addEventListener('gattserverdisconnected', () => {
                this.emit('disconnected');
            });

            // Connect to GATT server
            this.server = await this.device.gatt.connect();
            
            // Get service
            this.service = await this.server.getPrimaryService(this.SERVICE_UUID);
            
            // Get characteristics
            this.modeCharacteristic = await this.service.getCharacteristic(this.MODE_CHARACTERISTIC_UUID);
            this.strengthCharacteristic = await this.service.getCharacteristic(this.STRENGTH_CHARACTERISTIC_UUID);
            this.intervalCharacteristic = await this.service.getCharacteristic(this.INTERVAL_CHARACTERISTIC_UUID);
            
            this.emit('connected');
            
        } catch (error) {
            this.emit('error', error.message);
            throw error;
        }
    }

    async disconnect() {
        try {
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

