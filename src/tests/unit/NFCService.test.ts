// src/tests/unit/NFCService.test.ts

// Mock react-native-nfc-manager before importing NFCService
const mockNdefHandler = {
  writeNdefMessage: jest.fn(() => Promise.resolve()),
};

const mockNfcManagerObj = {
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
  ndefHandler: mockNdefHandler,
  ndefFormatableHandlerAndroid: {
    formatNdef: jest.fn(() => Promise.resolve()),
  },
};

jest.mock('react-native-nfc-manager', () => ({
  __esModule: true,
  NfcTech: {
    Ndef: 'Ndef',
    NdefFormatable: 'NdefFormatable',
  },
  Ndef: {
    encodeMessage: jest.fn(() => [0x00, 0x01, 0x02]),
    textRecord: jest.fn((text: string) => ({ payload: text, type: 'T' })),
    text: {
      decodePayload: jest.fn(() => 'decoded text'),
    },
  },
  default: mockNfcManagerObj,
}));

const mockNfcLoggerObj = {
  startOperation: jest.fn().mockReturnValue('mock-operation-id'),
  logStep: jest.fn(),
  endOperation: jest.fn(),
  endOperationWithError: jest.fn(),
  categorizeError: jest.fn().mockReturnValue('UNKNOWN'),
  getUserFriendlyMessage: jest.fn().mockReturnValue('An error occurred'),
};

// Mock NFCLogger
jest.mock('../../utils/NFCLogger', () => ({
  __esModule: true,
  nfcLogger: mockNfcLoggerObj,
  NFCOperationType: {
    READ: 'READ',
    WRITE: 'WRITE',
    FORMAT: 'FORMAT',
  },
  NFCErrorCategory: {
    HARDWARE_NOT_AVAILABLE: 'HARDWARE_NOT_AVAILABLE',
    TAG_NOT_DETECTED: 'TAG_NOT_DETECTED',
    TAG_EMPTY: 'TAG_EMPTY',
    WRITE_FAILED: 'WRITE_FAILED',
    READ_FAILED: 'READ_FAILED',
    TAG_READ_ONLY: 'TAG_READ_ONLY',
    CAPACITY_EXCEEDED: 'CAPACITY_EXCEEDED',
    CANCELLED: 'CANCELLED',
    CONNECTION_LOST: 'CONNECTION_LOST',
    UNKNOWN: 'UNKNOWN',
  },
}));

import { NFCService } from '../../services/NFCService';

// Use the mock objects directly
const mockNfcManager = mockNfcManagerObj;
const mockNfcLogger = mockNfcLoggerObj;

describe('NFCService', () => {
  let nfcService: NFCService;

  beforeEach(() => {
    jest.clearAllMocks();
    // Get fresh instance for each test
    nfcService = NFCService.getInstance();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = NFCService.getInstance();
      const instance2 = NFCService.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe('Initialization', () => {
    it('should initialize NFC manager successfully', async () => {
      mockNfcManager.isSupported.mockResolvedValue(true);
      mockNfcManager.start.mockResolvedValue(undefined);

      const result = await nfcService.initialize();

      expect(result).toBe(true);
      expect(mockNfcManager.isSupported).toHaveBeenCalled();
      expect(mockNfcManager.start).toHaveBeenCalled();
    });

    it('should handle unsupported NFC', async () => {
      mockNfcManager.isSupported.mockResolvedValue(false);

      // Need a fresh instance to test uninitialized state
      const freshService = NFCService.getInstance();
      // Force re-initialization by accessing internal state
      (freshService as any).isInitialized = false;

      const result = await freshService.initialize();

      expect(result).toBe(false);
    });

    it('should handle initialization errors', async () => {
      const error = new Error('NFC initialization failed');
      mockNfcManager.isSupported.mockRejectedValue(error);

      const freshService = NFCService.getInstance();
      (freshService as any).isInitialized = false;

      const result = await freshService.initialize();

      expect(result).toBe(false);
    });
  });

  describe('Availability Check', () => {
    it('should check NFC availability', async () => {
      mockNfcManager.isSupported.mockResolvedValue(true);
      mockNfcManager.isEnabled.mockResolvedValue(true);

      const result = await nfcService.isAvailable();

      expect(result).toBe(true);
      expect(mockNfcManager.isSupported).toHaveBeenCalled();
      expect(mockNfcManager.isEnabled).toHaveBeenCalled();
    });

    it('should handle disabled NFC', async () => {
      mockNfcManager.isSupported.mockResolvedValue(true);
      mockNfcManager.isEnabled.mockResolvedValue(false);

      const result = await nfcService.isAvailable();

      expect(result).toBe(false);
    });
  });

  describe('readNFC', () => {
    beforeEach(() => {
      mockNfcManager.isSupported.mockResolvedValue(true);
      mockNfcManager.start.mockResolvedValue(undefined);
      mockNfcManager.requestTechnology.mockResolvedValue(undefined);
      mockNfcManager.cancelTechnologyRequest.mockResolvedValue(undefined);
    });

    it('should handle empty but valid NDEF tags', async () => {
      const mockTag = {
        id: new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05]),
        type: 'NfcA',
        maxSize: 1024,
        isWritable: true,
        techTypes: ['android.nfc.tech.Ndef'],
        ndefMessage: [], // Empty NDEF message
      };

      mockNfcManager.getTag.mockResolvedValue(mockTag);

      const result = await nfcService.readNFC();

      expect(result.success).toBe(true);
      expect(result.data?.isEmpty).toBe(true);
    });

    it('should handle no tag detected', async () => {
      mockNfcManager.getTag.mockResolvedValue(null);
      mockNfcLogger.getUserFriendlyMessage.mockReturnValue('No NFC tag detected.');

      const result = await nfcService.readNFC();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle cancelled operations', async () => {
      const cancelError = new Error('Operation was cancelled');
      mockNfcManager.requestTechnology.mockRejectedValue(cancelError);
      mockNfcLogger.categorizeError.mockReturnValue('CANCELLED');
      mockNfcLogger.getUserFriendlyMessage.mockReturnValue('The operation was cancelled.');

      const result = await nfcService.readNFC();

      expect(result.success).toBe(false);
      expect(mockNfcLogger.endOperationWithError).toHaveBeenCalled();
    });
  });

  describe('writeNFC', () => {
    beforeEach(() => {
      mockNfcManager.isSupported.mockResolvedValue(true);
      mockNfcManager.start.mockResolvedValue(undefined);
      mockNfcManager.requestTechnology.mockResolvedValue(undefined);
      mockNfcManager.cancelTechnologyRequest.mockResolvedValue(undefined);
    });

    it('should write JSON data to NFC tag successfully', async () => {
      const mockTag = {
        id: new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05]),
        type: 'NfcA',
        maxSize: 1024,
        isWritable: true,
        techTypes: ['android.nfc.tech.Ndef'],
      };

      const testData = JSON.stringify({ id: 'test-device', name: 'Test Device' });

      mockNfcManager.getTag.mockResolvedValue(mockTag);
      mockNfcManager.ndefHandler.writeNdefMessage.mockResolvedValue(undefined);

      const result = await nfcService.writeNFC(testData);

      expect(result.success).toBe(true);
      expect(result.data?.jsonString).toBeDefined();
      expect(mockNfcManager.ndefHandler.writeNdefMessage).toHaveBeenCalled();
      expect(mockNfcLogger.startOperation).toHaveBeenCalled();
    });

    it('should handle read-only tags', async () => {
      const mockTag = {
        id: new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05]),
        type: 'NfcA',
        maxSize: 1024,
        isWritable: false,
        techTypes: ['android.nfc.tech.Ndef'],
      };

      const testData = JSON.stringify({ id: 'test-device' });

      mockNfcManager.getTag.mockResolvedValue(mockTag);
      mockNfcLogger.categorizeError.mockReturnValue('TAG_READ_ONLY');
      mockNfcLogger.getUserFriendlyMessage.mockReturnValue('This tag is read-only and cannot be written to.');

      const result = await nfcService.writeNFC(testData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('read-only');
    });

    it('should handle invalid JSON data', async () => {
      mockNfcLogger.categorizeError.mockReturnValue('INVALID_DATA');
      mockNfcLogger.getUserFriendlyMessage.mockReturnValue('Invalid data format.');

      const result = await nfcService.writeNFC('not valid json {');

      expect(result.success).toBe(false);
    });

    it('should verify tag connection before writing', async () => {
      const mockTag = {
        id: new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05]),
        type: 'NfcA',
        maxSize: 1024,
        isWritable: true,
        techTypes: ['android.nfc.tech.Ndef'],
      };

      const testData = JSON.stringify({ id: 'test-device' });

      // Return tag first time, then null (simulating connection loss)
      mockNfcManager.getTag
        .mockResolvedValueOnce(mockTag)
        .mockResolvedValueOnce(null);

      mockNfcLogger.categorizeError.mockReturnValue('CONNECTION_LOST');
      mockNfcLogger.getUserFriendlyMessage.mockReturnValue('Tag connection lost.');

      const result = await nfcService.writeNFC(testData);

      expect(result.success).toBe(false);
    });
  });

  describe('formatTag', () => {
    beforeEach(() => {
      mockNfcManager.isSupported.mockResolvedValue(true);
      mockNfcManager.start.mockResolvedValue(undefined);
      mockNfcManager.cancelTechnologyRequest.mockResolvedValue(undefined);
    });

    it('should format already NDEF tag by clearing data', async () => {
      const mockTag = {
        id: new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05]),
        type: 'NfcA',
        maxSize: 1024,
        isWritable: true,
        techTypes: ['android.nfc.tech.Ndef'],
      };

      mockNfcManager.requestTechnology
        .mockRejectedValueOnce(new Error('Not formatable'))
        .mockResolvedValueOnce(undefined);
      mockNfcManager.getTag.mockResolvedValue(mockTag);
      mockNfcManager.ndefHandler.writeNdefMessage.mockResolvedValue(undefined);

      const result = await nfcService.formatTag();

      expect(result.success).toBe(true);
      expect(result.data?.wasCleared).toBe(true);
    });

    it('should handle incompatible tags', async () => {
      // formatTag now tries 3 technologies: NdefFormatable, NfcA, and Ndef
      mockNfcManager.requestTechnology
        .mockRejectedValueOnce(new Error('Not formatable'))
        .mockRejectedValueOnce(new Error('Not NfcA'))
        .mockRejectedValueOnce(new Error('Not NDEF'));

      mockNfcLogger.categorizeError.mockReturnValue('UNKNOWN');
      mockNfcLogger.getUserFriendlyMessage.mockReturnValue('Tag is not compatible.');

      const result = await nfcService.formatTag();

      expect(result.success).toBe(false);
    });
  });

  describe('Error Categorization', () => {
    it('should categorize hardware not available errors', async () => {
      const error = new Error('NFC hardware not available');
      mockNfcManager.isSupported.mockResolvedValue(true);
      mockNfcManager.start.mockResolvedValue(undefined);
      mockNfcManager.requestTechnology.mockRejectedValue(error);
      mockNfcLogger.categorizeError.mockReturnValue('HARDWARE_NOT_AVAILABLE');
      mockNfcLogger.getUserFriendlyMessage.mockReturnValue('NFC is not available.');

      const result = await nfcService.readNFC();

      expect(result.success).toBe(false);
      expect(mockNfcLogger.categorizeError).toHaveBeenCalledWith(error);
    });

    it('should categorize timeout errors', async () => {
      const error = new Error('Operation timed out');
      mockNfcManager.isSupported.mockResolvedValue(true);
      mockNfcManager.start.mockResolvedValue(undefined);
      mockNfcManager.requestTechnology.mockRejectedValue(error);
      mockNfcLogger.categorizeError.mockReturnValue('TIMEOUT');
      mockNfcLogger.getUserFriendlyMessage.mockReturnValue('The operation timed out.');

      const result = await nfcService.readNFC();

      expect(result.success).toBe(false);
      expect(mockNfcLogger.categorizeError).toHaveBeenCalledWith(error);
    });
  });

  describe('Cancel Operation', () => {
    it('should cancel ongoing NFC operation', async () => {
      mockNfcManager.cancelTechnologyRequest.mockResolvedValue(undefined);

      await nfcService.cancelOperation();

      expect(mockNfcManager.cancelTechnologyRequest).toHaveBeenCalled();
    });

    it('should handle cancel errors gracefully', async () => {
      mockNfcManager.cancelTechnologyRequest.mockRejectedValue(new Error('Cancel failed'));

      // Should not throw
      await expect(nfcService.cancelOperation()).resolves.not.toThrow();
    });
  });

  describe('Cleanup', () => {
    it('should cleanup NFC resources', async () => {
      mockNfcManager.cancelTechnologyRequest.mockResolvedValue(undefined);
      mockNfcManager.unregisterTagEvent.mockResolvedValue(undefined);

      await nfcService.cleanup();

      expect(mockNfcManager.cancelTechnologyRequest).toHaveBeenCalled();
      expect(mockNfcManager.unregisterTagEvent).toHaveBeenCalled();
    });
  });

  describe('writeDeviceToNFC', () => {
    beforeEach(() => {
      mockNfcManager.isSupported.mockResolvedValue(true);
      mockNfcManager.start.mockResolvedValue(undefined);
      mockNfcManager.requestTechnology.mockResolvedValue(undefined);
      mockNfcManager.cancelTechnologyRequest.mockResolvedValue(undefined);
    });

    it('should write device data to NFC tag', async () => {
      const mockTag = {
        id: new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05]),
        type: 'NfcA',
        maxSize: 1024,
        isWritable: true,
        techTypes: ['android.nfc.tech.Ndef'],
      };

      const deviceData = {
        deviceId: 'DEV-001',
        make: 'TestMake',
        model: 'TestModel',
        serialNumber: 'SN-12345',
        maintenanceInterval: 30,
        description: 'Test device',
      };

      mockNfcManager.getTag.mockResolvedValue(mockTag);
      mockNfcManager.ndefHandler.writeNdefMessage.mockResolvedValue(undefined);

      const result = await nfcService.writeDeviceToNFC(deviceData);

      expect(result.success).toBe(true);
      expect(mockNfcManager.ndefHandler.writeNdefMessage).toHaveBeenCalled();
    });
  });
});
