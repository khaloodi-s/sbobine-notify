const { default: makeWASocket, useMultiFileAuthState } = require('baileys');
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

// Function to connect to WhatsApp
const connectToWhatsApp = async () => {
  if (sock) return sock; // Return existing socket if already connected

  // Load authentication state from file and Firestore
  const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, 'auth'), {
    state: await db.collection('whatsappSessions').doc('session').get().then(doc => doc.data() || {})
  });

  console.log('Loaded credentials:', state); // Log loaded credentials

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: true, // Print QR code in the terminal for initial connections
  });

  // Handle credential updates
  sock.ev.on('creds.update', async (creds) => {
    // Check for 'me' property in credentials
    if (!creds.me) {
      console.error('Credentials do not contain "me" property:', creds);
      return; // Exit if 'me' is not present
    }

    // Filter out undefined properties and save credentials to Firestore
    const filteredCreds = Object.fromEntries(
      Object.entries(creds).filter(([_, v]) => v !== undefined)
    );

    await db.collection('whatsappSessions').doc('session').set(filteredCreds);
    saveCreds(creds);
  });

  // Listen for connection updates
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'close') {
      console.log('Connection closed. Attempting to reconnect...');
      
      const shouldReconnect = lastDisconnect.error?.output?.statusCode !== 401; // Check if the disconnection was not due to an unauthorized access
      if (shouldReconnect) {
        setTimeout(connectToWhatsApp, 5000); // Reconnect after 5 seconds
      } else {
        console.error('Connection closed due to unauthorized access. Please check credentials.');
      }
    } else if (connection === 'open') {
      console.log('Connected to WhatsApp!');
    }
  });

  return sock; // Return the socket
};

module.exports = connectToWhatsApp; // Export the function
