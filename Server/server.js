const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const connectDB = require('./config/db');

const app = express();
const PORT = process.env.PORT || 5000;

const mongoose = require('mongoose');

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '5mb' }));
// Serve from wherever the upload middleware actually put things — on
// serverless that is the temp dir, not the repo folder.
const { UPLOAD_ROOT } = require('./middleware/upload');
app.use('/uploads', express.static(UPLOAD_ROOT));

// Health check answers WITHOUT touching the database, so it can distinguish
// "the function is broken" from "the function is fine but the database is not".
// It reports the DB state rather than hiding it — a red Backend Offline badge
// with no detail is what made the last failure so hard to place.
const DB_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];

app.get('/api/health', async (req, res) => {
  let dbStatus = DB_STATES[mongoose.connection.readyState] || 'unknown';
  let dbError = null;

  if (dbStatus !== 'connected') {
    try {
      await connectDB();
      dbStatus = DB_STATES[mongoose.connection.readyState] || 'unknown';
    } catch (err) {
      dbError = err.message;
      dbStatus = 'error';
    }
  }

  res.json({
    status: dbStatus === 'connected' ? 'ok' : 'degraded',
    database: dbStatus,
    databaseError: dbError,
    hasMongoUri: Boolean(process.env.MONGODB_URI),
    serverless: Boolean(process.env.VERCEL),
    timestamp: new Date().toISOString(),
  });
});

// Every data route needs a live connection. Awaiting it here — rather than
// firing connectDB() once at module load and hoping — means a cold start cannot
// serve a request before the database is ready, and a connection failure
// returns an explanatory 503 instead of an opaque 500 from deep inside a query.
app.use('/api', async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    res.status(503).json({
      message: 'Database unavailable',
      error: err.message,
      hint: 'If this is a timeout, check that MongoDB Atlas Network Access allows 0.0.0.0/0 — '
        + 'serverless functions do not have a fixed IP to allowlist.',
    });
  }
});

// Routes
app.use('/api/pipeline', require('./routes/pipelineRoutes'));
app.use('/api/tenders', require('./routes/tenderRoutes'));
app.use('/api/eois', require('./routes/eoiRoutes'));
app.use('/api/prospecting', require('./routes/prospectingRoutes'));
app.use('/api/cold-calls', require('./routes/coldCallRoutes'));
app.use('/api/social-content', require('./routes/socialContentRoutes'));
app.use('/api/campaigns', require('./routes/campaignRoutes'));
app.use('/api/events', require('./routes/eventRoutes'));
app.use('/api/milestones', require('./routes/milestoneRoutes'));
app.use('/api/dg-event', require('./routes/dgEventRoutes'));
app.use('/api/reminders', require('./routes/reminderRoutes'));
app.use('/api/media', require('./routes/mediaRoutes'));
app.use('/api/documents', require('./routes/documentRoutes'));
app.use('/api/content', require('./routes/contentRoutes'));
app.use('/api/clients', require('./routes/clientRoutes'));
app.use('/api/field-visits', require('./routes/fieldVisitRoutes'));
app.use('/api/tasks', require('./routes/taskRoutes'));
app.use('/api/outreach', require('./routes/outreachRoutes'));
app.use('/api/proposals', require('./routes/proposalRoutes'));

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err.message);
  res.status(500).json({ message: 'Internal server error', error: err.message });
});

// Local dev setup
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
}

module.exports = app;