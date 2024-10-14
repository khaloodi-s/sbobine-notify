const express = require('express');
const connectToWhatsApp = require('./connectToWhatsApp'); // Import the connectToWhatsApp function

let sock; // Declare a variable to hold the WhatsApp socket

// Function to ensure the WhatsApp connection is active
const ensureConnection = async () => {
    if (!sock) {
        try {
            sock = await connectToWhatsApp(); // Establish connection if not already done
        } catch (error) {
            console.error('Failed to connect to WhatsApp:', error);
            throw new Error('Unable to establish WhatsApp connection');
        }
    }
};

const router = express.Router();

// Endpoint to send a message
router.post('/send-message', async (req, res) => {
    const { groupId, message } = req.body;

    try {
        await ensureConnection(); // Ensure socket is connected before sending a message

        // Check if socket connection is active
        if (!sock) {
            return res.status(500).json({ success: false, message: 'WhatsApp connection not available' });
        }

        // Send the message using the established socket
        await sock.sendMessage(groupId, { text: message });
        return res.status(200).json({ success: true, message: 'Message sent successfully' });
    } catch (error) {
        console.error('Failed to send message:', error);

        // Handle specific cases like disconnection or other known errors
        if (error?.output?.statusCode === 428 || error.message.includes('Connection Closed')) {
            sock = null; // Reset the socket if it's closed
        }

        return res.status(500).json({ success: false, message: 'Failed to send message' });
    }
});

module.exports = router;
