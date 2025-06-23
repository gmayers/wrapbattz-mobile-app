// src/tests/e2e/setup.ts
import { beforeAll, beforeEach, afterAll } from '@jest/globals';
import { device, cleanup } from 'detox';
import * as Sentry from '@sentry/react-native';

// Configure Sentry for E2E tests
Sentry.init({
  dsn: process.env.SENTRY_DSN || 'test-dsn',
  debug: true,
  environment: 'e2e-testing',
  beforeSend: (event) => {
    // Add E2E test context to all Sentry events
    event.contexts = {
      ...event.contexts,
      e2e: {
        test_name: expect.getState().currentTestName || 'unknown',
        device_type: device.getPlatform(),
        app_state: 'e2e-testing',
      },
    };
    return event;
  },
});

beforeAll(async () => {
  await device.launchApp({
    permissions: { notifications: 'YES' },
    launchArgs: { detoxEnableSynchronization: 0 },
  });
  
  Sentry.addBreadcrumb({
    message: 'E2E test suite started',
    level: 'info',
    category: 'e2e.setup',
    data: {
      platform: device.getPlatform(),
      device_name: device.name,
    },
  });
});

beforeEach(async () => {
  const testName = expect.getState().currentTestName || 'unknown';
  
  Sentry.addBreadcrumb({
    message: `Starting E2E test: ${testName}`,
    level: 'info',
    category: 'e2e.test',
    data: { test_name: testName },
  });
  
  // Reset app state before each test
  await device.reloadReactNative();
});

afterAll(async () => {
  Sentry.addBreadcrumb({
    message: 'E2E test suite completed',
    level: 'info',
    category: 'e2e.teardown',
  });
  
  await cleanup();
});

// Global error handlers for E2E tests
process.on('unhandledRejection', (error: Error) => {
  Sentry.captureException(error, {
    tags: {
      test_type: 'e2e',
      error_type: 'unhandledRejection',
    },
    contexts: {
      test: {
        name: expect.getState().currentTestName || 'unknown',
        suite: 'e2e',
      },
    },
  });
  
  console.error('Unhandled promise rejection in E2E test:', error);
});

process.on('uncaughtException', (error: Error) => {
  Sentry.captureException(error, {
    tags: {
      test_type: 'e2e',
      error_type: 'uncaughtException',
    },
    contexts: {
      test: {
        name: expect.getState().currentTestName || 'unknown',
        suite: 'e2e',
      },
    },
  });
  
  console.error('Uncaught exception in E2E test:', error);
});

export {};