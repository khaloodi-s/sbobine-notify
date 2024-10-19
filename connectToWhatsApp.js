const fs = require('fs');
const path = require('path');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('baileys');

// Path for local storage on Fly.io
const sessionPath = path.join(__dirname, '/data', 'auth_info_baileys'); 
let sock; // Declare sock at a higher scope to manage the connection

async function connectToWhatsApp() {
    if (sock) {
        return sock; // Return existing socket if already connected
    }

    const { state: authState, saveCreds } = await useMultiFileAuthState(sessionPath);

    sock = makeWASocket({
        auth: authState,
        printQRInTerminal: true, // Print QR code in terminal for authentication
        syncFullHistory: false,
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection closed due to:', lastDisconnect?.error, ', reconnecting:', shouldReconnect);

            if (shouldReconnect) {
                sock = null; // Reset sock to allow reconnection
                setTimeout(connectToWhatsApp, 5000); // Attempt to reconnect after 5 seconds
            }
        } else if (connection === 'open') {
            console.log('Successfully opened connection');
        }
    });

    sock.ev.on('creds.update', saveCreds); // Save credentials to local storage automatically

    // Delay sending the first message by 30 seconds
    setTimeout(async () => {
        const jid = '96565022680@s.whatsapp.net'; // Replace with a valid recipient JID

        try {
            await sock.presenceSubscribe(jid);
            await delay(500);

            await sock.sendPresenceUpdate('composing', jid);
            await delay(2000);

            await sock.sendPresenceUpdate('paused', jid);
            await sock.sendMessage(jid, { text: 'Hello from WhatsApp' });
            console.log('First message sent successfully after delay');
        } catch (error) {
            console.error('Failed to send the first message:', error);
        }
    }, 30000); // 30-second delay

    return sock; // Return the socket object
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

module.exports = connectToWhatsApp; // Export the function
