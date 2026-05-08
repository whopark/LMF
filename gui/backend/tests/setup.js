import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { beforeAll, afterAll, afterEach } from 'vitest';

// Set test environment variables
process.env.API_KEY = process.env.API_KEY || 'test-api-key';

let mongoServer;

beforeAll(async () => {
  // CI에서는 서비스 컨테이너 사용, 로컬에서는 in-memory 서버 사용
  const uri = process.env.MONGO_URI;
  if (uri) {
    await mongoose.connect(uri);
  } else {
    mongoServer = await MongoMemoryServer.create();
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
