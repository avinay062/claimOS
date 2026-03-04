const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const connectDB = require('./config/db');
const { errorHandler, notFound } = require('./middleware/errorHandler');

// Phase 1 routes
const authRoutes          = require('./routes/auth');
const userRoutes          = require('./routes/users');
const statementRoutes     = require('./routes/statements');
const claimRoutes         = require('./routes/claims');
const productRoutes       = require('./routes/products');
const dashboardRoutes     = require('./routes/dashboard');
const auditRoutes         = require('./routes/audit');

// Phase 2 routes
const substantiationRoutes = require('./routes/substantiations');
const taskRoutes           = require('./routes/tasks');
const notificationRoutes   = require('./routes/notifications');

// Phase 3 routes
const locationRoutes       = require('./routes/locations');
const localAdaptationRoutes= require('./routes/localAdaptations');
const projectRoutes        = require('./routes/projects');
const searchRoutes         = require('./routes/search');
const riskRoutes           = require('./routes/risk');

// Phase 4 routes
const packCopyRoutes       = require('./routes/packCopy');

// Phase 5 routes
const analyticsRoutes      = require('./routes/analytics');

const { startAllCrons } = require('./workers/cronJobs');

const app = express();

connectDB();

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
app.use('/api/', limiter);
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV === 'development') app.use(morgan('dev'));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '5.0.0' });
});

// Phase 1
app.use('/api/auth',           authLimiter, authRoutes);
app.use('/api/users',          userRoutes);
app.use('/api/statements',     statementRoutes);
app.use('/api/claims',         claimRoutes);
app.use('/api/products',       productRoutes);
app.use('/api/dashboard',      dashboardRoutes);
app.use('/api/audit',          auditRoutes);

// Phase 2
app.use('/api/substantiations', substantiationRoutes);
app.use('/api/tasks',           taskRoutes);
app.use('/api/notifications',   notificationRoutes);

// Phase 3
app.use('/api/locations',          locationRoutes);
app.use('/api/local-adaptations',  localAdaptationRoutes);
app.use('/api/projects',           projectRoutes);
app.use('/api/search',             searchRoutes);
app.use('/api/risk',               riskRoutes);

// Phase 4
app.use('/api/pack-copy',          packCopyRoutes);

// Phase 5
app.use('/api/analytics',          analyticsRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚀 ClaimsOS API v5.0 running on port ${PORT} [${process.env.NODE_ENV}]`);
  startAllCrons();
});

module.exports = app;
