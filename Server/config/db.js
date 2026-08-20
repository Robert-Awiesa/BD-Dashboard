const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set in the environment');
  }

  await mongoose.connect(uri, {
    dbName: process.env.MONGODB_DB_NAME || 'bd_workspace',
  });

  console.log(`  ➜ MongoDB:  connected (${mongoose.connection.name})`);
};

module.exports = connectDB;
