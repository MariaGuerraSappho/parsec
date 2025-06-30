const express = require('express');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const PORT = 8080;

// Serve static files
app.use(express.static(__dirname));

// Start HTTP server
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
});

// WebSocket server
const wss = new WebSocket.Server({ server });

let hostConnection = null;
const clients = new Set();

wss.on('connection', (ws, req) => {
    console.log('New WebSocket connection from:', req.socket.remoteAddress);
    
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());
            
            if (message.type === 'host') {
                // Host connection registration
                hostConnection = ws;
                console.log('Host connected');
                ws.send(JSON.stringify({ type: 'host_registered' }));
                
            } else if (message.type === 'client') {
                // Client connection registration
                clients.add(ws);
                console.log('Client connected, total clients:', clients.size);
                ws.send(JSON.stringify({ type: 'client_registered' }));
                
            } else if (message.type === 'control') {
                // Control message from client to host
                if (hostConnection && hostConnection.readyState === WebSocket.OPEN) {
                    hostConnection.send(JSON.stringify({
                        type: 'remote_control',
                        ...message.data,
                        client_ip: req.socket.remoteAddress
                    }));
                    console.log('Forwarded control message to host:', message.data);
                } else {
                    ws.send(JSON.stringify({ 
                        type: 'error', 
                        message: 'Host not connected' 
                    }));
                }
            }
            
        } catch (error) {
            console.error('Invalid message received:', error);
            ws.send(JSON.stringify({ 
                type: 'error', 
                message: 'Invalid message format' 
            }));
        }
    });
    
    ws.on('close', () => {
        if (ws === hostConnection) {
            hostConnection = null;
            console.log('Host disconnected');
        } else {
            clients.delete(ws);
            console.log('Client disconnected, remaining clients:', clients.size);
        }
    });
    
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

console.log('WebSocket server started on port', PORT);

