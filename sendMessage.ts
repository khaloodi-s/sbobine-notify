import express from 'express';
import { startSock } from './connectToWhatsApp'; // Import the startSock function
import { proto } from 'baileys'; // Import proto from baileys

let sock: any = null; // Declare a variable to hold the WhatsApp socket, initialized to null

// Function to ensure we have a connected socket
const ensureConnection = async () => {
    if (!sock) {
        sock = await startSock(); // Establish connection if not already done
    }
};

const router = express.Router();

// Endpoint to send a message
router.post('/send-message', async (req, res) => {
    const { groupId, message } = req.body;

    await ensureConnection(); // Ensure socket is connected

    try {
        // Construct the message using the correct structure
        const waMessage = {
            text: message, // The text message content
            // Specify the message type and additional properties
            quoted: null, // You can include a quoted message if needed
        } as proto.IMessage; // Cast to the appropriate message type

        await sock.sendMessage(groupId, waMessage); // Send the message using the socket
        return res.status(200).json({ success: true, message: 'Message sent successfully' });
    } catch (error) {
        console.error('Failed to send message:', error);
        return res.status(500).json({ success: false, message: 'Failed to send message' });
    }
});

export default router; // Export the router for use in other parts of the application