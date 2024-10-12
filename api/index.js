const express = require('express');
const connectToWhatsApp = require('./connectToWhatsApp');  // Import your connectToWhatsApp function
const sendMessageRouter = require('./sendMessage');  // Import the sendMessage router

const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse incoming JSON requests
app.use(express.json());

// Use the sendMessage router
app.use('/', sendMessageRouter);

// Other routes and logic...
app.get('/', (req, res) => {
    res.send('Hello from Fly.io!');
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
