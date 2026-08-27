const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const requestId = require('./middleware/requestId');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(requestId); // Attach unique requestId to every request (§82)

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/plans', require('./routes/plans'));
app.use('/api/salons', require('./routes/salons'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/staff', require('./routes/staff'));
app.use('/api/services', require('./routes/services'));
app.use('/api/attendance', require('./routes/attendance'));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', message: `Route ${req.originalUrl} not found` });
});

// Global error handler (§51 — never expose stack traces, internal paths, or DB details in production)
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  console.error(`[${req.requestId}] Error:`, err);

  // Never expose internals in production
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
    return res.status(statusCode).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
    });
  }

  res.status(statusCode).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: err.message,
  });
});

const PORT = process.env.PORT || 5000;

// Connect to DB immediately (Mongoose handles queuing queries until connected)
connectDB();

// Only listen on a port if not running in a Serverless environment (like Vercel)
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Salon CRM API running on port ${PORT}`);
  });
}

module.exports = app;
