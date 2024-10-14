const fs = require('fs');
const path = require('path');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');

// Path for local storage on Fly.io
const sessionFilePath = path.join('/data', 'auth_info.json');
let sock;

async function connectToWhatsApp() {
    if (sock) {
        return sock; // Return existing socket if already connected
    }

    let state;

    // Check if the session file exists and load it if it does
    if (fs.existsSync(sessionFilePath)) {
        try {
            state = JSON.parse(fs.readFileSync(sessionFilePath, 'utf8'));
            console.log(`Loaded existing session from local storage found at ${sessionFilePath}.`);
        } catch (err) {
            console.error('Error reading session file, starting a new session:', err);
            state = null;
        }
    }

    const { state: authState, saveCreds } = await useMultiFileAuthState(path.join('/data', 'auth_info_baileys'), {
        state,
    });

    sock = makeWASocket({
        auth: authState,
        printQRInTerminal: true, // Show QR code in terminal
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'close') {
            const disconnectReason = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.statusCode;

            console.log('Connection closed due to:', disconnectReason, 'Reconnecting:', disconnectReason !== DisconnectReason.loggedOut);

            if (disconnectReason !== DisconnectReason.loggedOut) {
                // Reset the session files on failure to avoid reuse of bad state
                cleanupSessionFiles();
                sock = null; // Reset socket to allow reconnection
                connectToWhatsApp(); // Attempt to reconnect
            }
        } else if (connection === 'open') {
            console.log('Successfully opened connection');
        }
    });

    sock.ev.on('creds.update', async () => {
        await saveCreds(); // Save credentials to local storage
        fs.writeFileSync(sessionFilePath, JSON.stringify(authState), 'utf8'); // Save to local file
        console.log('Credentials saved to local storage.');
    });

    return sock;
}

// Cleanup function to remove old/invalid session files
function cleanupSessionFiles() {
    if (fs.existsSync(sessionFilePath)) {
        fs.unlinkSync(sessionFilePath); // Delete session file
        console.log('Deleted existing session file.');
    }
    const baileysAuthDir = path.join('/data', 'auth_info_baileys');
    if (fs.existsSync(baileysAuthDir)) {
        fs.rmSync(baileysAuthDir, { recursive: true }); // Delete Baileys auth directory
        console.log('Deleted Baileys auth directory.');
    }
}

module.exports = connectToWhatsApp;
