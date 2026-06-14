import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { beforeAll, afterAll, afterEach } from 'vitest';

// Set test environment variables
process.env.API_KEY = process.env.API_KEY || 'test-api-key';

let mongoServer;

beforeAll(async () => {
  // Transactions (G1) require a replica-set connection. CI must point MONGO_URI at a
  // replica set; locally we spin up a single-node in-memory replica set.
  const uri = process.env.MONGO_URI;
  if (uri) {
    await mongoose.connect(uri);
  } else {
    mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(mongoServer.getUri());
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});
