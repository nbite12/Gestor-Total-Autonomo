const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const dataRoutes = require('./routes/data');
const authMiddleware = require('./middleware/auth');

const app = express();

// --- Middleware ---
app.use(cors({ origin: process.env.FRONTEND_URL }));
app.use(express.json({ limit: '10mb' })); // Increase limit to handle file attachments

// --- Database Connection ---
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected successfully.'))
  .catch(err => {
      console.error('MongoDB connection error:', err);
      // Ensure the process exits if it can't connect to the DB,
      // so Vercel logs will clearly show a startup failure.
      process.exit(1);
  });


// --- API Routes ---
app.use('/api/auth', authRoutes);
// Protect data routes
app.use('/api/data', authMiddleware, dataRoutes);

// A health check route to verify that the backend is running
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is running' });
});

// Catch-all for API routes not found
app.use('/api/*', (req, res) => {
    res.status(404).json({ message: 'API endpoint not found' });
});

// Export the app for Vercel's serverless environment
module.exports = app;
