require('dotenv').config(); // THIS IS FOR LOCAL TESTING PURPOSES ONLY - COMMENT IT OUT BEFORE DEPLOYING
const fs = require('fs');
const path = require('path');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('baileys');

const sessionFilePath = path.join('/data', 'auth_info.json'); // Path for local storage on Fly.io

async function connectToWhatsApp() {
    let state;

    // Check if the session file exists and load it if it does
    if (fs.existsSync(sessionFilePath)) {
        state = JSON.parse(fs.readFileSync(sessionFilePath, 'utf8'));
        console.log('Loaded existing session from local storage.');
    } else {
        console.log('No existing session found. Please scan the QR code to authenticate.');
    }

    const { state: authState, saveCreds } = await useMultiFileAuthState(path.join('/data', 'auth_info_baileys'), {
        state,
    });

    const sock = makeWASocket({
        auth: authState,
        printQRInTerminal: true, // Print QR code in terminal for authentication
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection closed due to:', lastDisconnect?.error, ', reconnecting:', shouldReconnect);

            if (shouldReconnect) {
                connectToWhatsApp(); // Reconnect if not logged out
            }
        } else if (connection === 'open') {
            console.log('Successfully opened connection');
        }
    });

    sock.ev.on('messages.upsert', async (messageUpdate) => {
        console.log(JSON.stringify(messageUpdate, undefined, 2));

        const message = messageUpdate.messages[0];
        const remoteJid = message.key.remoteJid;

        if (remoteJid) {
            console.log('Replying to', remoteJid);
            await sock.sendMessage(remoteJid, { text: 'Hello there!' });
        }
    });

    sock.ev.on('creds.update', async () => {
        await saveCreds(); // Save credentials to local storage
        fs.writeFileSync(sessionFilePath, JSON.stringify(authState), 'utf8'); // Save to local file
        console.log('Credentials saved to local storage.');
    });

    return sock; // Ensure to return the socket object
}

module.exports = connectToWhatsApp; // Export the function
