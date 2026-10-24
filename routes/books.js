const express = require('express');
const mongoose = require('mongoose');
const Book = require('../models/Book');

const router = express.Router();
const editableFields = ['title', 'author', 'isbn', 'category', 'description', 'quantity', 'available'];
const requiredFields = ['title', 'author', 'isbn', 'category', 'quantity'];

function validateBookInput(body, isUpdate = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return 'Request body must be a JSON object';
  }

  const fields = Object.keys(body);
  const unsupportedFields = fields.filter((field) => !editableFields.includes(field));
  if (unsupportedFields.length > 0) {
    return `Unsupported field(s): ${unsupportedFields.join(', ')}`;
  }

  if (isUpdate && fields.length === 0) {
    return 'At least one field must be provided for an update';
  }

  if (!isUpdate) {
    const missingFields = requiredFields.filter(
      (field) => body[field] === undefined || body[field] === null,
    );
    if (missingFields.length > 0) {
      return `Missing required field(s): ${missingFields.join(', ')}`;
    }
  }

  for (const field of ['title', 'author', 'isbn', 'category']) {
    if (body[field] !== undefined) {
      if (typeof body[field] !== 'string' || body[field].trim().length === 0) {
        return `${field} must be a non-empty string`;
      }
    }
  }

  if (body.quantity !== undefined) {
    if (typeof body.quantity !== 'number' || !Number.isFinite(body.quantity) || body.quantity < 0) {
      return 'Quantity must be a non-negative number';
    }
  }

  if (body.available !== undefined && typeof body.available !== 'boolean') {
    return 'Available must be a boolean';
  }

  if (body.description !== undefined) {
    if (typeof body.description !== 'string' || body.description.length > 500) {
      return 'Description must be a string of at most 500 characters';
    }
  }

  return null;
}

function isValidBookId(id) {
  return /^[a-f\d]{24}$/i.test(id) && mongoose.Types.ObjectId.isValid(id);
}

router.post('/', async (req, res, next) => {
  const validationError = validateBookInput(req.body);
  if (validationError) {
    return res.status(400).json({ message: validationError });
  }

  try {
    const book = await Book.create(req.body);
    return res.status(201).json(book);
  } catch (error) {
    return next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const books = await Book.find().sort({ createdAt: -1 });
    return res.status(200).json(books);
  } catch (error) {
    return next(error);
  }
});

router.get('/stats', async (req, res, next) => {
  try {
    const [totalTitles, availableTitles, unavailableTitles, categoryCount, quantityResult] =
      await Promise.all([
        Book.countDocuments(),
        Book.countDocuments({ available: true }),
        Book.countDocuments({ available: false }),
        Book.distinct('category'),
        Book.aggregate([{ $group: { _id: null, total: { $sum: '$quantity' } } }]),
      ]);

    return res.status(200).json({
      totalTitles,
      availableTitles,
      unavailableTitles,
      categoryCount: categoryCount.length,
      totalCopies: quantityResult[0]?.total || 0,
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/categories', async (req, res, next) => {
  try {
    const categories = await Book.distinct('category');
    return res.status(200).json(categories.sort((a, b) => a.localeCompare(b)));
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  if (!isValidBookId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid book ID' });
  }

  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }
    return res.status(200).json(book);
  } catch (error) {
    return next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  if (!isValidBookId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid book ID' });
  }

  const validationError = validateBookInput(req.body, true);
  if (validationError) {
    return res.status(400).json({ message: validationError });
  }

  try {
    const book = await Book.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
      context: 'query',
    });
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }
    return res.status(200).json(book);
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  if (!isValidBookId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid book ID' });
  }

  try {
    const book = await Book.findByIdAndDelete(req.params.id);
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }
    return res.status(200).json({ message: 'Book deleted successfully', id: book._id });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
