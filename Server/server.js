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
    bootErrors,
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

// Mounting is wrapped so one bad module cannot take the whole API down at
// initialisation. Anything that fails is recorded and surfaced by /api/health,
// which turns an opaque FUNCTION_INVOCATION_FAILED into a named culprit.
const bootErrors = [];

const mount = (routePath, modulePath) => {
  try {
    app.use(routePath, require(modulePath));
  } catch (err) {
    bootErrors.push({ route: routePath, module: modulePath, error: err.message });
    console.error(`Failed to mount ${routePath} from ${modulePath}: ${err.stack || err.message}`);
  }
};

mount('/api/pipeline', './routes/pipelineRoutes');
mount('/api/tenders', './routes/tenderRoutes');
mount('/api/eois', './routes/eoiRoutes');
mount('/api/prospecting', './routes/prospectingRoutes');
mount('/api/cold-calls', './routes/coldCallRoutes');
mount('/api/social-content', './routes/socialContentRoutes');
mount('/api/campaigns', './routes/campaignRoutes');
mount('/api/events', './routes/eventRoutes');
mount('/api/milestones', './routes/milestoneRoutes');
mount('/api/dg-event', './routes/dgEventRoutes');
mount('/api/reminders', './routes/reminderRoutes');
mount('/api/media', './routes/mediaRoutes');
mount('/api/documents', './routes/documentRoutes');
mount('/api/content', './routes/contentRoutes');
mount('/api/clients', './routes/clientRoutes');
mount('/api/field-visits', './routes/fieldVisitRoutes');
mount('/api/tasks', './routes/taskRoutes');
mount('/api/outreach', './routes/outreachRoutes');
mount('/api/proposals', './routes/proposalRoutes');




















// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err.message);
  res.status(500).json({ message: 'Internal server error', error: err.message });
});

// Local dev only. Binding a port inside a serverless container is never
// correct, so check the platform flag as well as NODE_ENV rather than
// trusting NODE_ENV alone to be set the way we expect.
const IS_SERVERLESS = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
if (!IS_SERVERLESS && process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
}

module.exports = app;