const express = require('express');
const connectToWhatsApp = require('./connectToWhatsApp');  // Import your connectToWhatsApp function
const sendMessageRouter = require('./sendMessage');  // Import the sendMessage router

const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse incoming JSON requests
app.use(express.json());

// Use the sendMessage router
app.use('/', sendMessageRouter);

// Initialize WhatsApp connection when the server starts
async function startWhatsAppConnection() {
    try {
        await connectToWhatsApp(); // Ensure connection is established
        console.log("WhatsApp connection successfully initialized.");
    } catch (error) {
        console.error("Failed to initialize WhatsApp connection:", error);
    }
}

// Other routes and logic...
app.get('/', (req, res) => {
    res.send('Hello from Fly.io!');
});

// Start the server and WhatsApp connection
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);

    // Start WhatsApp connection after the server is up
    startWhatsAppConnection();
});