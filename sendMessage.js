const express = require('express');
const connectToWA = require('./connectToWA'); // Import that function
const { MessageType, MessageOptions, MimeType } = require('baileys')

let sock; // Declare a variable to hold the WhatsApp socket

// Function to ensure we have a connected socket
const ensureConnection = async () => {
    if (!sock) {
        sock = await connectToWA(); // Establish connection if not already done
    }
};

const router = express.Router();

// Endpoint to send a message
router.post('/send-message', async (req, res) => {
    const { groupId, message } = req.body;

    await ensureConnection(); // Ensure socket is connected

    try {
        await sock.sendMessage(groupId, { text: message });
        return res.status(200).json({ success: true, message: 'Message sent successfully' });
    } catch (error) {
        console.error('Failed to send message:', error);
        return res.status(500).json({ success: false, message: 'Failed to send message' });
    }
});

module.exports = router;