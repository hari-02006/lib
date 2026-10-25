require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const Book = require('./models/Book');
const booksRouter = require('./routes/books');

const app = express();
const port = process.env.PORT || 3000;
const mongoUri = process.env.MONGODB_URI;

const sampleBooks = [
  {
    title: 'Pride and Prejudice',
    author: 'Jane Austen',
    isbn: '9780141439518',
    category: 'Classic Fiction',
    quantity: 4,
    available: true,
    description: 'A witty and warm story of first impressions, family, and love.',
    coverImage: 'https://covers.openlibrary.org/b/isbn/9780141439518-L.jpg',
  },
  {
    title: 'The Great Gatsby',
    author: 'F. Scott Fitzgerald',
    isbn: '9780743273565',
    category: 'Classic Fiction',
    quantity: 3,
    available: true,
    description: 'A Jazz Age story of ambition, wealth, and the American dream.',
    coverImage: 'https://covers.openlibrary.org/b/isbn/9780743273565-L.jpg',
  },
  {
    title: 'To Kill a Mockingbird',
    author: 'Harper Lee',
    isbn: '9780061120084',
    category: 'Literature',
    quantity: 5,
    available: true,
    description: 'A moving novel about justice and growing up in the American South.',
    coverImage: 'https://covers.openlibrary.org/b/isbn/9780061120084-L.jpg',
  },
  {
    title: '1984',
    author: 'George Orwell',
    isbn: '9780451524935',
    category: 'Science Fiction',
    quantity: 2,
    available: false,
    description: 'A landmark dystopian novel about surveillance and individual freedom.',
    coverImage: 'https://covers.openlibrary.org/b/isbn/9780451524935-L.jpg',
  },
  {
    title: 'The Odyssey',
    author: 'Homer',
    isbn: '9780140449136',
    category: 'Epic Poetry',
    quantity: 3,
    available: true,
    description: 'The epic journey of Odysseus as he struggles to return home.',
    coverImage: 'https://covers.openlibrary.org/b/isbn/9780140449136-L.jpg',
  },
];

app.disable('x-powered-by');
app.use(express.json({ limit: '20kb' }));

app.get('/api', (req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1;
  res.status(databaseConnected ? 200 : 503).json({
    message: 'Book Management API is running!',
    database: databaseConnected ? 'connected' : 'disconnected',
  });
});

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
  if (await Book.estimatedDocumentCount() === 0) {
    await Book.insertMany(sampleBooks);
    console.log('Added five sample books to the empty collection.');
  }
  app.listen(port, () => {
    console.log(`Library Management API is listening on port ${port}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start the API:', error.message);
  process.exit(1);
});
