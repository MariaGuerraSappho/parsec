import RNBO from '@rnbo/js';

export async function loadRNBOEffect(patchData, audioContext) {
    try {
        // Create RNBO device using the correct API
        const device = await RNBO.createDevice({ 
            context: audioContext, 
            patcher: patchData 
        });
        
        // The device.node is the Web Audio node
        const node = device.node;
        
        console.log(`Loaded RNBO effect with ${device.parameters.length} parameters`);
        
        return { device, node };
    } catch (error) {
        console.error('Failed to load RNBO effect:', error);
        throw error;
    }
}

export async function loadBuiltInEffect(effectName, audioContext) {
    try {
        // Compute the base path relative to GitHub Pages
        const basePath = window.location.pathname.replace(/\/[^\/]*$/, '/');

        // Fetch patch from same directory as the HTML
        const response = await fetch(`${basePath}${effectName}.json`);

        if (!response.ok) {
            throw new Error(`Failed to fetch ${effectName}: ${response.statusText}`);
        }

        const patchData = await response.json();
        return await loadRNBOEffect(patchData, audioContext);
    } catch (error) {
        console.error(`Failed to load built-in effect ${effectName}:`, error);
        throw error;
    }
}
