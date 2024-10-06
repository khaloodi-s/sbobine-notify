const { default: makeWASocket, useMultiFileAuthState } = require('baileys'); // Ensure this line is correct
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin SDK
const serviceAccount = require('./serviceAccountKey.json');
initializeApp({
  credential: cert(serviceAccount),
});
const db = getFirestore();

let sock;

const connectToWhatsApp = async () => {
  if (sock) return sock; // Return existing socket if already connected

  const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, 'auth'), {
    state: await db.collection('whatsappSessions').doc('session').get().then(doc => doc.data() || {})
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

    await db.collection('whatsappSessions').doc('session').set(filteredCreds);
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