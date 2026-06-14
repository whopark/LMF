// Design Ref: §3 D-1 — direct Mongoose scripts, no server/JWT required
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');

const DEFAULT_URI = 'mongodb://localhost:27017/lab_accreditation';

async function connect() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || DEFAULT_URI;
  await mongoose.connect(uri);
  return uri;
}

async function disconnect() {
  await mongoose.disconnect();
}

module.exports = { connect, disconnect };
