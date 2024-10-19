// require('dotenv').config(); THIS IS FOR LOCAL TESTING PURPOSES ONLY - COMMENT IT OUT BEFORE DEPLOYING
const fs = require('fs');
const path = require('path');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('baileys');

// Path for local storage on Fly.io
const sessionFilePath = path.join('/data', 'auth_info.json'); 
let sock; // Declare sock at a higher scope to manage the connection

async function connectToWhatsApp() {
    if (sock) {
        return sock; // Return existing socket if already connected
    }

    let state;

    // Check if the session file exists and load it if it does
    // if (fs.existsSync(sessionFilePath)) {
        // state = JSON.parse(fs.readFileSync(sessionFilePath, 'utf8'));
        // console.log(`Loaded existing session from local storage found at ${sessionFilePath}.`);
    //} else {
        //console.log('No existing session found. Please scan the QR code to authenticate.');
    //}

    const { state: authState, saveCreds } = await useMultiFileAuthState(path.join('/data', 'auth_info_baileys'), {
        state,
    });

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