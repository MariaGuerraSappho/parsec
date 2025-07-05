export class GestureMapper {
    constructor() {
        this.mappings = new Map(); // gesture -> parameter mappings
        this.effects = []; // Reference to current effects chain
        this.listeners = {};
        this.isActive = false;
        this.smoothingBuffer = new Map(); // For gesture smoothing
        this.smoothingFactor = 0.1;
        
        console.log('🎭 GestureMapper initialized');
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

    setEffects(effects) {
        this.effects = effects;
        console.log(`🎭 GestureMapper updated with ${effects.length} effects`);
    }

    randomizeAllMappings() {
        this.mappings.clear();
        
        // Get all available gestures
        const gestureTypes = ['pinch', 'fist', 'spread', 'pointUp', 'thumbUp', 'peace', 'palmDistance', 'handHeight', 'handTilt'];
        
        // Get all available parameters from all effects
        const allParameters = [];
        this.effects.forEach((effect, effectIndex) => {
            if (effect.device && effect.device.parameters) {
                effect.device.parameters.forEach(param => {
                    if (param.name && param.min !== undefined && param.max !== undefined) {
                        allParameters.push({
                            effectIndex,
                            effect,
                            param,
                            id: `${effectIndex}-${param.id}`
                        });
                    }
                });
            }
        });

        if (allParameters.length === 0) {
            console.log('⚠ No parameters available for mapping');
            return;
        }

        // Randomly map gestures to parameters
        const maxMappings = Math.min(gestureTypes.length, allParameters.length);
        const usedGestures = new Set();
        const usedParameters = new Set();

        for (let i = 0; i < maxMappings; i++) {
            // Pick random gesture
            let gestureType;
            do {
                gestureType = gestureTypes[Math.floor(Math.random() * gestureTypes.length)];
            } while (usedGestures.has(gestureType));
            usedGestures.add(gestureType);

            // Pick random parameter
            let paramData;
            do {
                paramData = allParameters[Math.floor(Math.random() * allParameters.length)];
            } while (usedParameters.has(paramData.id));
            usedParameters.add(paramData.id);

            // Create mapping
            this.mappings.set(gestureType, {
                effectIndex: paramData.effectIndex,
                effect: paramData.effect,
                param: paramData.param,
                gestureType,
                min: paramData.param.min,
                max: paramData.param.max,
                inverted: Math.random() > 0.5 // Randomly invert some mappings
            });

            console.log(`🎭 Mapped ${gestureType} → ${paramData.effect.name} ${paramData.param.name} (${paramData.param.min}-${paramData.param.max})`);
        }

        this.emit('mappingsChanged', Array.from(this.mappings.entries()));
    }

    clearMappings() {
        this.mappings.clear();
        this.smoothingBuffer.clear();
        console.log('🎭 All gesture mappings cleared');
        this.emit('mappingsChanged', []);
    }

    processGestures(gestureData) {
        if (!this.isActive || this.mappings.size === 0) {
            return;
        }

        const { gestures } = gestureData;
        
        // Process each mapped gesture
        this.mappings.forEach((mapping, gestureType) => {
            const gesture = gestures[gestureType];
            if (!gesture) return;

            let gestureValue = gesture.value;
            
            // Apply smoothing
            const smoothingKey = `${gestureType}-${mapping.effectIndex}-${mapping.param.id}`;
            if (this.smoothingBuffer.has(smoothingKey)) {
                const previousValue = this.smoothingBuffer.get(smoothingKey);
                gestureValue = previousValue + (gestureValue - previousValue) * this.smoothingFactor;
            }
            this.smoothingBuffer.set(smoothingKey, gestureValue);

            // Map gesture value to parameter range
            let paramValue;
            if (mapping.inverted) {
                paramValue = mapping.max - (gestureValue * (mapping.max - mapping.min));
            } else {
                paramValue = mapping.min + (gestureValue * (mapping.max - mapping.min));
            }

            // Apply to effect parameter
            if (mapping.effect.device && mapping.effect.device.parametersById) {
                const rnboParam = mapping.effect.device.parametersById.get(mapping.param.id);
                if (rnboParam) {
                    rnboParam.value = paramValue;
                    mapping.param.value = paramValue;
                }
            }

            // Emit parameter change for UI updates
            this.emit('parameterChanged', {
                gestureType,
                effectIndex: mapping.effectIndex,
                paramName: mapping.param.name,
                value: paramValue,
                normalizedValue: gestureValue
            });
        });
    }

    setActive(active) {
        this.isActive = active;
        console.log(`🎭 GestureMapper ${active ? 'activated' : 'deactivated'}`);
        this.emit('activeChanged', active);
    }

    getCurrentMappings() {
        return Array.from(this.mappings.entries());
    }
}