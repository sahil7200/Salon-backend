const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

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

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
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
