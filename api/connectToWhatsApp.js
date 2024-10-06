const { Storage } = require('@google-cloud/storage');
const { default: makeWASocket, useMultiFileAuthState } = require('baileys');
const fs = require('fs');
const path = require('path');

// Initialize Google Cloud Storage
const storage = new Storage({
  credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS),
});

const bucketName = 'your-bucket-name'; // Replace with your bucket name

const connectToWhatsApp = async () => {
  // Function to fetch credentials from Google Cloud Storage
  const getCredentialsFromGCS = async () => {
    const filePath = 'path/to/creds.json'; // Path in your GCS bucket
    const file = storage.bucket(bucketName).file(filePath);

    const [exists] = await file.exists();
    if (!exists) {
      throw new Error(`Credentials file ${filePath} does not exist in bucket ${bucketName}`);
    }

    const tempFilePath = path.join(__dirname, 'creds.json');
    await file.download({ destination: tempFilePath });
    return require(tempFilePath);
  };

  const state = await getCredentialsFromGCS();
  const { state: authState, saveCreds } = await useMultiFileAuthState(path.join(__dirname, 'auth'), {
    state,
  });

  console.log('Loaded credentials:', authState);

  const sock = makeWASocket({ auth: authState });

  sock.ev.on('creds.update', async (creds) => {
    await storage.bucket(bucketName).file('path/to/creds.json').save(JSON.stringify(creds));
    saveCreds(creds);
  });

  // Other connection and event handling code...

  return sock; // Return the socket
};

module.exports = connectToWhatsApp; // Export the function
