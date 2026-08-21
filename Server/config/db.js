const mongoose = require('mongoose');

// Serverless platforms freeze and reuse containers between requests, and run
// many containers in parallel. Calling mongoose.connect() per invocation opens
// a fresh pool each time and exhausts the Atlas connection limit, so the
// connection PROMISE is cached on the global object — that survives across
// invocations within a warm container, and concurrent requests during a cold
// start all await the same in-flight connection instead of racing to open
// their own.
let cached = global.__bdMongoose;
if (!cached) {
  cached = global.__bdMongoose = { conn: null, promise: null };
}

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      'MONGODB_URI is not set. On Vercel, add it under Project Settings > Environment Variables '
      + 'and redeploy — variables are only injected at build/run time, not picked up from .env.'
    );
  }

  // readyState 1 = connected. A cached handle whose socket has since dropped
  // must not be handed back as if it were live.
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(uri, {
        dbName: process.env.MONGODB_DB_NAME || 'bd_workspace',
        // Vercel Hobby functions are killed at 10s, so failing server selection
        // must surface well inside that or the request dies with no useful error.
        serverSelectionTimeoutMS: 8000,
        // Small pool per container: many containers x large pool overwhelms Atlas.
        maxPoolSize: 10,
      })
      .then((m) => {
        console.log(`MongoDB connected (${m.connection.name})`);
        return m;
      })
      .catch((err) => {
        // Clear the cache so the next request retries rather than being stuck
        // awaiting a promise that already rejected.
        cached.promise = null;
        throw err;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
};

module.exports = connectDB;
