require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const Book = require('./models/Book');
const booksRouter = require('./routes/books');

const app = express();
const port = process.env.PORT || 3000;
const mongoUri = process.env.MONGODB_URI;

app.disable('x-powered-by');
app.use(express.json({ limit: '20kb' }));

app.get('/api/health', (req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1;
  res.status(databaseConnected ? 200 : 503).json({
    status: databaseConnected ? 'ok' : 'unavailable',
    database: databaseConnected ? 'connected' : 'disconnected',
  });
});

app.use('/api/books', booksRouter);
app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({ message: 'Request body contains invalid JSON' });
  }

  if (error.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Request body is too large' });
  }

  if (error.name === 'ValidationError') {
    const details = Object.values(error.errors).map((item) => item.message);
    return res.status(400).json({ message: 'Validation failed', errors: details });
  }

  if (error.code === 11000) {
    return res.status(409).json({ message: 'A book with this ISBN already exists' });
  }

  if (error.name === 'CastError') {
    return res.status(400).json({ message: 'Invalid value provided' });
  }

  console.error(error);
  return res.status(500).json({ message: 'Internal server error' });
});

async function startServer() {
  if (!mongoUri || mongoUri.includes('<username>') || mongoUri.includes('<cluster-url>')) {
    throw new Error('Set a valid MONGODB_URI in the .env file before starting the server');
  }

  await mongoose.connect(mongoUri);
  await Book.init();
  app.listen(port, () => {
    console.log(`Library Management API is listening on port ${port}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start the API:', error.message);
  process.exit(1);
});
