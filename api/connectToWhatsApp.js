require('dotenv').config(); // THIS IS FOR LOCAL TESTING PURPOSES ONLY - COMMENT IT OUT BEFORE DEPLOYING
const { google } = require('googleapis');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('baileys');
const fs = require('fs');
const path = require('path');

// Initialize Google Drive API
const auth = new google.auth.OAuth2(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    process.env.REDIRECT_URI
);

// Set the credentials
auth.setCredentials({
    refresh_token: process.env.REFRESH_TOKEN,
});

// Initialize the Drive API
const drive = google.drive({ version: 'v3', auth });

// Google Drive file details
const folderId = '1qZwXlkTDAeORIR3sdzOOGiR39RBD25ZP'; // Replace with your Google Drive folder ID
const credsFileName = 'whatsapp_creds.json'; // File name for your auth creds

async function connectToWhatsApp() {
    let fileId;

    // Function to download the credentials file from Google Drive
    const getCredentialsFromDrive = async () => {
        console.log(`Attempting to retrieve credentials file: ${credsFileName} from folder: ${folderId}`);
        const res = await drive.files.list({
            q: `'${folderId}' in parents and name='${credsFileName}'`,
            fields: 'files(id, name)',
        });

        if (res.data.files.length === 0) {
            throw new Error(`Credentials file ${credsFileName} does not exist in folder ${folderId}`);
        }

        fileId = res.data.files[0].id; // Store the file ID here
        const tempFilePath = path.join(__dirname, credsFileName);
        const dest = fs.createWriteStream(tempFilePath);

        console.log(`Downloading credentials file with ID: ${fileId}`);
        const response = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });

        return new Promise((resolve, reject) => {
            response.data
                .pipe(dest)
                .on('finish', () => {
                    console.log('Credentials file downloaded successfully.');
                    resolve(require(tempFilePath));
                })
                .on('error', reject);
        });
    };

    let state;
    try {
        state = await getCredentialsFromDrive();
    } catch (error) {
        console.log(error.message);
        console.log('No existing credentials found. Please scan the QR code to authenticate.');
    }

    const { state: authState, saveCreds } = await useMultiFileAuthState(path.join(__dirname, 'auth_info_baileys'), {
        state,
    });

    console.log('Loaded credentials:', authState);

    const sock = makeWASocket({
        auth: authState,
        printQRInTerminal: true, // Print QR code in terminal
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

    sock.ev.on('creds.update', saveCreds);

    return sock; // Ensure to return the socket object
}

module.exports = connectToWhatsApp; // Export the function
