const express = require('express');
const app = express();
const port = process.env.PORT || 3000; // Use port provided by Vercel

app.get('/', (req, res) => {
  res.send('Hello from Vercel!');
});

app.listen(port, () => {
  console.log(`App listening at http://localhost:${port}`);
});