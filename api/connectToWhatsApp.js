const { default: makeWASocket, useMultiFileAuthState } = require('baileys');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Initialize Firebase Admin SDK
const serviceAccount = require('./serviceAccountKey.json');
initializeApp({
  credential: cert(serviceAccount),
});
const db = getFirestore();

let sock;

const connectToWhatsApp = async () => {
  if (sock) return sock; // Return existing socket if already connected

  // Retrieve the auth state from Firestore
  const authDoc = await db.collection('whatsappSessions').doc('session').get();
  const authState = authDoc.exists ? authDoc.data() : {};

  const { state, saveCreds } = await useMultiFileAuthState(null, { state: authState });

  sock = makeWASocket({ auth: state });

  // Listen for connection updates
  sock.ev.on('creds.update', async (creds) => {
    // Filter out undefined properties
    const filteredCreds = Object.fromEntries(
      Object.entries(creds).filter(([_, v]) => v !== undefined)
    );

    // Save updated credentials to Firestore
    await db.collection('whatsappSessions').doc('session').set(filteredCreds);
    saveCreds(creds);
  });

  sock.ev.on('connection.update', (update) => {
    const { connection } = update;
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
