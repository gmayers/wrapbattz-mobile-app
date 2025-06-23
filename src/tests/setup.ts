// src/tests/setup.ts
import * as Sentry from '@sentry/react-native';

// Mock Sentry for testing
jest.mock('@sentry/react-native', () => ({
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  addBreadcrumb: jest.fn(),
  setContext: jest.fn(),
  setTag: jest.fn(),
  setUser: jest.fn(),
  configureScope: jest.fn(),
  withScope: jest.fn(),
  init: jest.fn(),
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock React Navigation
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    setOptions: jest.fn(),
    replace: jest.fn(),
    canGoBack: () => true,
  }),
  useRoute: () => ({
    params: {},
  }),
  useFocusEffect: jest.fn(),
  NavigationContainer: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock NFC Manager
jest.mock('react-native-nfc-manager', () => ({
  default: {
    start: jest.fn().mockResolvedValue(true),
    stop: jest.fn().mockResolvedValue(true),
    isSupported: jest.fn().mockResolvedValue(true),
    isEnabled: jest.fn().mockResolvedValue(true),
    requestTechnology: jest.fn().mockResolvedValue(true),
    cancelTechnologyRequest: jest.fn().mockResolvedValue(true),
    getTag: jest.fn().mockResolvedValue({
      id: Buffer.from('12345'),
      type: 'test',
      maxSize: 1024,
      isWritable: true,
      ndefMessage: [
        {
          payload: Buffer.from('{"id":"test-device","name":"Test Device"}'),
          type: Buffer.from('T'),
          id: Buffer.from(''),
        }
      ]
    }),
    ndefHandler: {
      writeNdefMessage: jest.fn().mockResolvedValue(true),
    },
    unregisterTagEvent: jest.fn().mockResolvedValue(true),
  },
  NfcTech: {
    Ndef: 'Ndef',
    MifareUltralight: 'MifareUltralight',
  },
  Ndef: {
    encodeMessage: jest.fn().mockReturnValue([1, 2, 3, 4]),
    text: {
      decodePayload: jest.fn().mockReturnValue('{"id":"test-device","name":"Test Device"}'),
    },
    textRecord: jest.fn().mockReturnValue({
      payload: Buffer.from('test'),
      type: Buffer.from('T'),
      id: Buffer.from(''),
    }),
  },
}));

// Mock Expo modules
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn().mockResolvedValue({
    execAsync: jest.fn(),
    runAsync: jest.fn(),
    getFirstAsync: jest.fn(),
    getAllAsync: jest.fn(),
    closeAsync: jest.fn(),
  }),
}));

// Mock Alert
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return {
    ...RN,
    Alert: {
      alert: jest.fn(),
    },
    Platform: {
      OS: 'ios',
      select: jest.fn((options) => options.ios),
    },
  };
});

// Global test helpers
global.testHelpers = {
  sentry: {
    captureTestError: (error: Error, context?: Record<string, any>) => {
      Sentry.captureException(error, { contexts: { test: context } });
    },
    captureTestMessage: (message: string, level: 'info' | 'warning' | 'error' = 'info') => {
      Sentry.captureMessage(message, level);
    },
  },
};

// Setup global test environment
beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  // Add breadcrumb for test completion
  Sentry.addBreadcrumb({
    message: 'Test completed',
    level: 'info',
    category: 'test',
  });
});

// Global error handler for tests
const originalConsoleError = console.error;
console.error = (...args) => {
  // Capture console errors in tests to Sentry
  if (args[0] && typeof args[0] === 'string' && args[0].includes('Warning:')) {
    // Skip React warnings in tests
    return;
  }
  
  global.testHelpers.sentry.captureTestError(new Error(args.join(' ')), {
    type: 'console.error',
    arguments: args,
  });
  
  originalConsoleError(...args);
};

export {};

declare global {
  namespace NodeJS {
    interface Global {
      testHelpers: {
        sentry: {
          captureTestError: (error: Error, context?: Record<string, any>) => void;
          captureTestMessage: (message: string, level?: 'info' | 'warning' | 'error') => void;
        };
      };
    }
  }
}