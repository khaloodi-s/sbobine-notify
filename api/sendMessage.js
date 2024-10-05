const { send } = require('micro');
const connectToWhatsApp = require('./connectToWhatsApp'); // Import the connectToWhatsApp function
const { json } = require('micro');

const sendMessage = async (req, res) => {
  const { groupId, message } = await json(req);

  const sock = await connectToWhatsApp(); // Get the existing connection
  try {
    await sock.sendMessage(groupId, { text: message });
    send(res, 200, { success: true, message: 'Message sent successfully' });
  } catch (error) {
    console.error('Failed to send message:', error);
    send(res, 500, { success: false, message: 'Failed to send message' });
  }
};

module.exports = sendMessage;
