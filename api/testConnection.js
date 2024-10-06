const connectToWhatsApp = require('./connectToWhatsApp');

const testConnection = async () => {
    try {
        const sock = await connectToWhatsApp();
        console.log('WhatsApp socket:', sock);
        // Optionally, you can send a test message or log more info here
    } catch (error) {
        console.error('Error connecting to WhatsApp:', error);
    }
};

testConnection();