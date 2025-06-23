// jest.setup.js
// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
}));

// Mock Sentry
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

// Mock NFC Manager
jest.mock('react-native-nfc-manager', () => {
  const mockNfcManager = {
    start: jest.fn(() => Promise.resolve()),
    stop: jest.fn(() => Promise.resolve()),
    isSupported: jest.fn(() => Promise.resolve(true)),
    isEnabled: jest.fn(() => Promise.resolve(true)),
    registerTagEvent: jest.fn(() => Promise.resolve()),
    unregisterTagEvent: jest.fn(() => Promise.resolve()),
    requestTechnology: jest.fn(() => Promise.resolve()),
    getTag: jest.fn(() => Promise.resolve({})),
    closeTechnology: jest.fn(() => Promise.resolve()),
    cancelTechnologyRequest: jest.fn(() => Promise.resolve()),
    writeNdefMessage: jest.fn(() => Promise.resolve()),
    getNdefMessage: jest.fn(() => Promise.resolve([])),
    goToNfcSettings: jest.fn(() => Promise.resolve()),
    getLaunchTagEvent: jest.fn(() => Promise.resolve(null)),
  };

  return {
    NfcTech: {
      Ndef: 'Ndef',
      NfcA: 'NfcA',
      NfcB: 'NfcB',
      NfcF: 'NfcF',
      NfcV: 'NfcV',
      IsoDep: 'IsoDep',
      MifareClassic: 'MifareClassic',
      MifareUltralight: 'MifareUltralight',
    },
    NfcEvents: {
      DiscoverTag: 'DiscoverTag',
      SessionClosed: 'SessionClosed',
      StateChanged: 'StateChanged',
    },
    default: mockNfcManager,
  };
});

// Mock Expo modules
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(() => Promise.resolve()),
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: jest.fn(() => ({
    execSync: jest.fn(),
    getFirstSync: jest.fn(() => ({})),
    getAllSync: jest.fn(() => []),
    runSync: jest.fn(() => ({ lastInsertRowId: 1, changes: 1 })),
    prepareSync: jest.fn(() => ({
      executeSync: jest.fn(),
      finalizeSync: jest.fn(),
    })),
  })),
}));

jest.mock('axios', () => ({
  create: jest.fn(() => ({
    get: jest.fn(() => Promise.resolve({ data: {} })),
    post: jest.fn(() => Promise.resolve({ data: {} })),
    put: jest.fn(() => Promise.resolve({ data: {} })),
    delete: jest.fn(() => Promise.resolve({ data: {} })),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  })),
  get: jest.fn(() => Promise.resolve({ data: {} })),
  post: jest.fn(() => Promise.resolve({ data: {} })),
  put: jest.fn(() => Promise.resolve({ data: {} })),
  delete: jest.fn(() => Promise.resolve({ data: {} })),
}));

// Mock Expo Vector Icons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
  MaterialIcons: 'MaterialIcons',
  FontAwesome: 'FontAwesome',
  AntDesign: 'AntDesign',
  Feather: 'Feather',
  MaterialCommunityIcons: 'MaterialCommunityIcons',
  Entypo: 'Entypo',
  Foundation: 'Foundation',
  EvilIcons: 'EvilIcons',
  Octicons: 'Octicons',
  SimpleLineIcons: 'SimpleLineIcons',
  Zocial: 'Zocial',
}));

// Mock Expo Font
jest.mock('expo-font', () => ({
  loadAsync: jest.fn(() => Promise.resolve()),
  isLoaded: jest.fn(() => true),
  isLoading: jest.fn(() => false),
}));

// Mock Expo Linear Gradient
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: 'LinearGradient',
}));

// Global test helpers
global.testHelpers = {
  sentry: {
    captureTestError: jest.fn(),
    captureTestMessage: jest.fn(),
  },
};