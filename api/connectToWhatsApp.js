const { google } = require('googleapis');
const { default: makeWASocket, useMultiFileAuthState } = require('baileys');
const fs = require('fs');
const path = require('path');

// Initialize Google Drive API using OAuth2 credentials
const auth = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URI
);
auth.setCredentials({
  refresh_token: process.env.REFRESH_TOKEN,
});

const drive = google.drive({ version: 'v3', auth });

// Google Drive file details
const folderId = '1qZwXlkTDAeORIR3sdzOOGiR39RBD25ZP'; // Your Google Drive folder ID
const credsFileName = 'whatsapp_creds.json'; // File name for WhatsApp creds

const connectToWhatsApp = async () => {
  // Function to download credentials from Google Drive
  const getCredentialsFromDrive = async () => {
    try {
      const res = await drive.files.list({
        q: `'${folderId}' in parents and name='${credsFileName}'`,
        fields: 'files(id, name)',
      });

      if (res.data.files.length === 0) {
        throw new Error(`Credentials file ${credsFileName} does not exist in folder ${folderId}`);
      }

      const fileId = res.data.files[0].id;
      const tempFilePath = path.join(__dirname, credsFileName);
      const dest = fs.createWriteStream(tempFilePath);

      // Download the file
      await new Promise((resolve, reject) => {
        drive.files.get(
          { fileId, alt: 'media' },
          { responseType: 'stream' },
          (err, { data }) => {
            if (err) return reject(err);
            data
              .on('end', () => resolve())
              .on('error', reject)
              .pipe(dest);
          }
        );
      });

      return require(tempFilePath);
    } catch (error) {
      console.error('Error downloading credentials from Google Drive:', error);
      throw error;
    }
  };

  // Fetch credentials
  const state = await getCredentialsFromDrive();

  // Initialize WhatsApp socket with credentials
  const { state: authState, saveCreds } = await useMultiFileAuthState(path.join(__dirname, 'auth'), {
    state,
  });

  console.log('Loaded credentials:', authState);

  const sock = makeWASocket({ auth: authState });

  // Update credentials and upload back to Google Drive on change
  sock.ev.on('creds.update', async (creds) => {
    try {
      const fileIdRes = await drive.files.list({
        q: `'${folderId}' in parents and name='${credsFileName}'`,
        fields: 'files(id)',
      });

      const fileId = fileIdRes.data.files[0].id;

      const tempFilePath = path.join(__dirname, credsFileName);
      fs.writeFileSync(tempFilePath, JSON.stringify(creds)); // Write updated creds to file

      const media = {
        mimeType: 'application/json',
        body: fs.createReadStream(tempFilePath),
      };

      // Update the file on Google Drive
      await drive.files.update({
        fileId,
        media,
        resource: { name: credsFileName, parents: [folderId] },
      });

      saveCreds(creds); // Save creds locally after uploading to Drive
      console.log('Credentials updated successfully in Google Drive.');
    } catch (error) {
      console.error('Error updating credentials on Google Drive:', error);
    }
  });

  // Handle connection status updates
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
