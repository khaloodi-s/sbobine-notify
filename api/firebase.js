const admin = require('firebase-admin');

const serviceAccount = require('./path/to/your-service-account-file.json'); // Path to your Firebase service account key

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://<your-project-id>.firebaseio.com" // Replace <your-project-id> with your actual project ID
});

const db = admin.firestore();

module.exports = db; // Export the Firestore database instance