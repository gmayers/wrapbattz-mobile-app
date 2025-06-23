// src/tests/e2e/jest.config.js
module.exports = {
  rootDir: '../../..',
  testMatch: ['<rootDir>/src/tests/e2e/**/*.test.ts'],
  testTimeout: 120000,
  maxWorkers: 1,
  globalSetup: 'detox/runners/jest/globalSetup',
  globalTeardown: 'detox/runners/jest/globalTeardown',
  reporters: [
    'detox/runners/jest/reporter',
    ['jest-junit', {
      outputDirectory: 'test-results/e2e',
      outputName: 'results.xml',
    }]
  ],
  testEnvironment: 'detox/runners/jest/testEnvironment',
  verbose: true,
  setupFilesAfterEnv: ['<rootDir>/src/tests/e2e/setup.ts'],
};