import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.js'],
    testTimeout: 30000,
    hookTimeout: 60000,
    fileParallelism: false, // 파일 간 순차 실행 (DB 연결 공유)
    sequence: {
      hooks: 'stack', // 훅 실행 순서 보장
    },
  },
});
