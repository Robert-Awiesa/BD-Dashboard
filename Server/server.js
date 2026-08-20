const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');
require('dotenv').config();
const connectDB = require('./config/db');
const { evaluateReminders } = require('./services/reminderEngine');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware — reflect the request origin so the same API works whether the
// SPA is served from this server or a separate origin during local dev.
app.use(cors({ origin: true, credentials: true }));
// Raised from the 100kb default: bulk spreadsheet imports (prospecting leads,
// outreach recipient lists) post the parsed rows as one JSON array, and a few
// hundred rows serialises well past 100kb — which fails as an opaque
// "request entity too large" rather than anything the UI can explain.
app.use(express.json({ limit: '5mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
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

// Serve the built frontend so the SPA and API live on one origin (no CORS, and
// relative /uploads URLs resolve correctly). Built output is copied into
// ./dist by the root build script before this server starts.
const distDir = path.join(__dirname, 'dist');
app.use(express.static(distDir));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
  res.sendFile(path.join(distDir, 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err.message);
  res.status(500).json({ message: 'Internal server error', error: err.message });
});

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`\n  🚀 BD Workspace API Server`);
      console.log(`  ➜ Local:   http://localhost:${PORT}`);
      console.log(`  ➜ Health:  http://localhost:${PORT}/api/health`);
      console.log(`  ➜ Mode:    MongoDB\n`);
    });

    // Daily campaign reminder sweep (also runs once at startup so reminders
    // aren't missed if the server was down when the day's run would have fired)
    evaluateReminders().catch((err) => console.error('  ✗ Reminder evaluation failed:', err.message));
    cron.schedule('0 7 * * *', () => {
      evaluateReminders().catch((err) => console.error('  ✗ Reminder evaluation failed:', err.message));
    });
  })
  .catch((err) => {
    console.error('  ✗ Failed to connect to MongoDB:', err.message);
    process.exit(1);
  });