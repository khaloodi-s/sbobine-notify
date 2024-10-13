const connectToWhatsApp = require('./connectToWhatsApp');

let sock; // Declare a variable to hold the WhatsApp socket

const testConnection = async () => {
    try {
        sock = await connectToWhatsApp(); // Use the existing function to connect
        console.log('WhatsApp socket:', sock);

        // Wait for the connection to be established
        const waitForConnection = () => {
            return new Promise((resolve, reject) => {
                const checkConnection = (update) => {
                    const { connection, lastDisconnect } = update;

                    if (connection === 'open') {
                        sock.ev.off('connection.update', checkConnection); // Unsubscribe from updates
                        resolve(); // Resolve when connection is open
                    } else if (connection === 'close') {
                        sock.ev.off('connection.update', checkConnection);
                        reject(new Error(`Connection closed. Reason: ${lastDisconnect?.error || 'Unknown'}`));
                    }
                };

                sock.ev.on('connection.update', checkConnection); // Listen for connection updates
            });
        };

        await waitForConnection(); // Wait until the connection is open
        console.log('Connection established!');

        // Send a test message (change the phone number and message as needed)
        const testMessage = 'Test message from WhatsApp API';
        const testPhoneNumber = '+96565022680@s.whatsapp.net'; // Replace with an actual phone number

        try {
            await sock.sendMessage(testPhoneNumber, { text: testMessage });
            console.log(`Sent test message to ${testPhoneNumber}`);
        } catch (sendError) {
            console.error('Error sending message:', sendError);
        }
    } catch (error) {
        console.error('Error connecting to WhatsApp:', error.message || error);
    } finally {
        if (sock) {
            try {
                await sock.logout(); // Disconnect the WhatsApp session
                console.log('WhatsApp socket logged out.');
            } catch (logoutError) {
                console.error('Error logging out:', logoutError.message || logoutError);
            }
        }
    }
};

testConnection();
