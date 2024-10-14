const fs = require('fs');
const path = require('path');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');

// Path for storing session data on Fly.io
const sessionFolderPath = path.join('/data', 'auth_info_baileys');
const sessionFilePath = path.join('/data', 'auth_info.json');

let sock; // Declare sock at a higher scope to manage the connection

// Function to connect to WhatsApp
async function connectToWhatsApp() {
    if (sock) {
        return sock; // Return existing socket if already connected
    }

    // Load the authentication state
    const { state, saveCreds } = await useMultiFileAuthState(sessionFolderPath);

    sock = makeWASocket({
        auth: state,
        printQRInTerminal: true, // Print QR code for authentication if needed
    });

    // Connection updates (handles disconnections and reconnections)
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error?.output?.statusCode) !== DisconnectReason.loggedOut;
            console.log('Connection closed due to:', lastDisconnect?.error, ', reconnecting:', shouldReconnect);

            if (shouldReconnect) {
                setTimeout(connectToWhatsApp, 5000); // Reconnect after 5 seconds
            }
        } else if (connection === 'open') {
            console.log('Connection successfully opened');
        }
    });

    // Save credentials when they are updated
    sock.ev.on('creds.update', async () => {
        await saveCreds(); // Save credentials using Baileys helper
        fs.writeFile(sessionFilePath, JSON.stringify(state), 'utf8', (err) => {
            if (err) {
                console.error('Error saving credentials:', err);
            } else {
                console.log('Credentials saved to local storage.');
            }
        });
    });

    // Message event handler (responding to incoming messages)
    sock.ev.on('messages.upsert', async (m) => {
        try {
            console.log('New message:', JSON.stringify(m, null, 2));
            const jid = m.messages[0].key.remoteJid;
            console.log('Replying to:', jid);
            await sock.sendMessage(jid, { text: 'Hello there!' });
        } catch (error) {
            console.error('Error handling message:', error);
        }
    });

    return sock; // Return the socket object
}

module.exports = connectToWhatsApp;
