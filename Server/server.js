const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const connectDB = require('./config/db');

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to DB asynchronously (cached internally by mongoose across invocations)
connectDB().catch((err) => console.error('MongoDB initial connection error:', err.message));

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '5mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check should respond immediately without awaiting DB
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