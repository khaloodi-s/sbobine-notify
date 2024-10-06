const { default: makeWASocket, useMultiFileAuthState } = require('baileys');
const { Storage } = require('@google-cloud/storage');
const fs = require('fs');
const path = require('path');

// Initialize Google Cloud Storage
const storage = new Storage({
  keyFilename: './serviceAccountKey.json', // Path to your service account key file
});

const bucketName = 'whatsapp-credentials'; // Replace with your GCS bucket name
const credsFileName = 'creds.json'; // The file name for your credentials

let sock;

const connectToWhatsApp = async () => {
  if (sock) return sock; // Return existing socket if already connected

  // Function to load credentials from GCS
  const loadCredsFromGCS = async () => {
    const file = storage.bucket(bucketName).file(credsFileName);
    try {
      const [exists] = await file.exists();
      if (!exists) return {}; // Return empty object if file doesn't exist

      const [contents] = await file.download();
      return JSON.parse(contents.toString()); // Parse and return JSON content
    } catch (error) {
      console.error('Error loading credentials from GCS:', error);
      return {};
    }
  };

  const initialState = await loadCredsFromGCS();
  const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, 'auth'), {
    state: initialState,
  });

  console.log('Loaded credentials:', state); // Log the credentials to check their structure

  sock = makeWASocket({ auth: state });

  // Listen for connection updates
  sock.ev.on('creds.update', async (creds) => {
    // Check if 'me' is defined in the credentials
    if (!creds.me) {
      console.error('Credentials do not contain "me" property:', creds);
      return; // Exit if 'me' is not present
    }

    // Filter out undefined properties
    const filteredCreds = Object.fromEntries(
      Object.entries(creds).filter(([_, v]) => v !== undefined)
    );

    // Save the credentials to GCS
    const credsBuffer = Buffer.from(JSON.stringify(filteredCreds));
    const file = storage.bucket(bucketName).file(credsFileName);
    await file.save(credsBuffer);
    console.log('Credentials saved to GCS');
    
    saveCreds(creds);
  });

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      console.log('Connection closed. Reconnecting...');
      connectToWhatsApp(); // Reconnect on close
    } else if (connection === 'open') {
      console.log('Connected to WhatsApp!');
    }
  });

  return sock; // Return the socket
};

module.exports = connectToWhatsApp; // Export the function