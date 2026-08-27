const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const connectDB = require('./config/db');

const app = express();
const PORT = process.env.PORT || 5000;

const mongoose = require('mongoose');

// Deployed as ONE Render service, the frontend is same-origin and needs no
// CORS at all. CORS_ORIGINS exists for the split case (frontend hosted
// separately) — set it to a comma-separated list rather than reflecting any
// origin, which with credentials:true would let any site call this API.
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: allowedOrigins.length ? allowedOrigins : true,
  credentials: true,
}));
app.use(express.json({ limit: '5mb' }));
// Uploads live in GridFS, not on disk — a container filesystem does not
// survive a deploy, which is how every stored file went missing while the
// database rows kept pointing at them. The URL shape is unchanged, so rows
// written before this keep resolving once their file is re-uploaded.
const fileStore = require('./services/fileStore');

// An upload is stored before the route runs, so a route that then rejects the
// request would leave the file behind with nothing referencing it.
app.use((req, res, next) => {
  res.on('finish', () => {
    if (res.statusCode < 400 || !req.file?.filename) return;
    const { bucket, filename, resourceType } = req.file;
    if (bucket) fileStore.removeQuietly(bucket, filename, resourceType);
  });
  next();
});

app.get('/uploads/:bucket/:filename', async (req, res) => {
  const { bucket, filename } = req.params;
  try {
    const found = await fileStore.stream(bucket, filename, res);
    if (!found) res.status(404).json({ message: 'File not found' });
  } catch (error) {
    // Headers may already be on their way once streaming has begun.
    if (!res.headersSent) res.status(500).json({ message: error.message });
    else res.end();
  }
});

// Anything else under /uploads is a bad path rather than a missing file.
app.use('/uploads', (req, res) => res.status(404).json({ message: 'File not found' }));

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
    // The database NAME, not just the connection state. Test suites check this
    // before wiping collections, so they cannot run against the live data.
    databaseName: mongoose.connection.name || null,
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
mount('/api/team', './routes/teamRoutes');
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
mount('/api/partners', './routes/partnerRoutes');




















// ---------------------------------------------------------------------------
// Frontend. The root build script copies workspace/dist into Server/dist, so a
// single Render web service serves the API and the SPA from one origin — which
// is why the client can use a relative "/api" base and needs no CORS.
// ---------------------------------------------------------------------------
const DIST_DIR = path.join(__dirname, 'dist');
app.use(express.static(DIST_DIR));

// SPA fallback. Written as plain middleware rather than app.get('*') because
// Express 5 uses path-to-regexp v8, where a bare '*' is no longer a valid path.
// Anything that is not an API or upload request falls through to index.html.
app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
  // The { root } form, not an absolute path: Express 5 delegates to send(),
  // which rejects a Windows-style absolute path with a bare "Not Found" even
  // when the file is right there. This form works on both platforms.
  res.sendFile('index.html', { root: DIST_DIR }, (err) => {
    // No build present (e.g. API-only deploy) — fall through to the 404.
    if (err) next();
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err.message);
  res.status(500).json({ message: 'Internal server error', error: err.message });
});

// Local dev only. Binding a port inside a serverless container is never
// correct, so check the platform flag as well as NODE_ENV rather than
// trusting NODE_ENV alone to be set the way we expect.
const IS_SERVERLESS = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

// The nightly reminder sweep. Nine evaluators depend on it (stale documents,
// quiet clients, overdue commitments, renewals, unwritten visit reports,
// unscored email batches, milestones, events, proposals) and it has not run in
// production since it was stripped out for serverless, where there is no
// long-lived process to host it. A persistent Render service can.
const startReminderSweep = () => {
  if (IS_SERVERLESS || process.env.DISABLE_CRON === 'true') return;
  const cron = require('node-cron');
  const { evaluateReminders } = require('./services/reminderEngine');
  const { syncGhanaHolidays } = require('./services/ghanaHolidayService');

  const sweep = () =>
    connectDB()
      .then(() => syncGhanaHolidays())
      .then(evaluateReminders)
      .then((r) => console.log(`Reminder sweep: ${r.length} reminder(s) raised`))
      .catch((err) => console.error('Reminder sweep failed:', err.message));

  // Once on boot so a redeploy cannot skip a day, then every morning at 07:00.
  // upsertReminder is keyed on (sourceType, sourceId, day), so running twice in
  // one day updates rather than duplicates.
  sweep();
  cron.schedule('0 7 * * *', sweep);
  console.log('Reminder sweep scheduled (daily 07:00)');
};

if (!IS_SERVERLESS) {
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    startReminderSweep();
  });
}

module.exports = app;