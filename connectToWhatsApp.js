const fs = require('fs/promises');
const path = require('path');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('baileys');
const axios = require('axios');
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fixieUrl = new URL(process.env.FIXIE_PROXY);

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
        browser: ["Firefox", "Ubuntu", "20.0"],
        syncFullHistory: false,
        options: {
            proxy: {
                protocol: "http",
                host: fixieUrl.hostname,
                port: fixieUrl.port,
                auth: {
                    username: fixieUrl.username,
                    password: fixieUrl.password
                }
            }
        }
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, isNewLogin } = update;

        if (isNewLogin) {
            console.log("Requesting pairing code...");
            try {
                const pairingCode = await sock.requestPairingCode(201025965327);
                console.log("Pairing code: ", pairingCode);
            } catch (error) {
                console.error("Error generating pairing code", error);
            }
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection closed due to:', lastDisconnect?.error, ', reconnecting:', shouldReconnect);

            if (!shouldReconnect) {
                try {
                    await fs.rm(sessionPath, { recursive: true, force: true });
                    console.log("Old session files wiped successfully.");
                } catch (err) {
                    console.error("Error wiping old files:", err);
                }
                
                try {
                    await fs.mkdir(sessionPath, { recursive: true });
                    console.log("New auth file directory created successfully.");
                } catch (err) {
                    console.error("Error creating new auth file directory:", err);
                }
            }
            sock = null; // Reset sock to allow reconnection
            setTimeout(connectToWhatsApp, 5000);
            }
            else if (connection === 'open') {
            console.log('Successfully opened connection');
        }
    });

    sock.ev.on('creds.update', saveCreds); // Save credentials to local storage automatically

    // Delay sending the first message by 30 seconds
    setTimeout(async () => {
        const jid = '96565022680@s.whatsapp.net'; // Replace with a valid recipient JID

        try {
            await delay(5000);
            await sock.presenceSubscribe(jid);
            await delay(1000);

            await sock.sendPresenceUpdate('composing', jid);
            await delay(2000);

            await sock.sendPresenceUpdate('paused', jid);
            await sock.sendMessage(jid, { text: 'Booted Successfully' });
            console.log('First message sent successfully after delay');
        } catch (error) {
            console.error('Failed to send the first message:', error);
        }
    }, 30000); // 30-second delay

    sock.ev.on('messages.upsert', async (chatUpdate) => {
        const message = chatUpdate.messages[0];
        if (!message.key.fromMe && message.message && message.message.conversation) {
            const text = message.message.conversation;

            if (text === '!ping') {
                const replyMessage = { text: 'pong' };
                await sock.sendMessage(message.key.remoteJid, replyMessage);
                console.log(`Sent reply: pong to ${message.key.remoteJid}`);
            }
        }
    });

    return sock; // Return the socket object
}

module.exports = connectToWhatsApp; // Export the function
