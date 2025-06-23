// src/tests/unit/NFCUtils.test.ts
import { NFCUtils } from '../../utils/NFCUtils';
import { default as NfcManager, NfcTech } from 'react-native-nfc-manager';
import * as Sentry from '@sentry/react-native';
import { Platform } from 'react-native';

// Mock Platform
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
  Alert: {
    alert: jest.fn(),
  },
}));

describe('NFCUtils', () => {
  let nfcUtils: NFCUtils;

  beforeEach(() => {
    jest.clearAllMocks();
    nfcUtils = NFCUtils.getInstance();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = NFCUtils.getInstance();
      const instance2 = NFCUtils.getInstance();
      
      expect(instance1).toBe(instance2);
      
      global.testHelpers.sentry.captureTestMessage(
        'NFCUtils singleton pattern verified',
        'info'
      );
    });
  });

  describe('Initialization', () => {
    it('should initialize NFC manager successfully', async () => {
      (NfcManager.isSupported as jest.Mock).mockResolvedValue(true);
      (NfcManager.start as jest.Mock).mockResolvedValue(true);

      const result = await nfcUtils.initialize();
      
      expect(result).toBe(true);
      expect(NfcManager.isSupported).toHaveBeenCalled();
      expect(NfcManager.start).toHaveBeenCalled();
      
      global.testHelpers.sentry.captureTestMessage(
        'NFC initialization successful',
        'info'
      );
    });

    it('should handle unsupported NFC', async () => {
      (NfcManager.isSupported as jest.Mock).mockResolvedValue(false);

      const result = await nfcUtils.initialize();
      
      expect(result).toBe(false);
      expect(NfcManager.start).not.toHaveBeenCalled();
      
      global.testHelpers.sentry.captureTestMessage(
        'NFC not supported - handled gracefully',
        'warning'
      );
    });

    it('should handle initialization errors', async () => {
      const error = new Error('NFC initialization failed');
      (NfcManager.isSupported as jest.Mock).mockRejectedValue(error);

      const result = await nfcUtils.initialize();
      
      expect(result).toBe(false);
      
      global.testHelpers.sentry.captureTestError(error, {
        test: 'NFC initialization error handling',
      });
    });

    it('should not reinitialize if already initialized', async () => {
      (NfcManager.isSupported as jest.Mock).mockResolvedValue(true);
      (NfcManager.start as jest.Mock).mockResolvedValue(true);

      // First initialization
      await nfcUtils.initialize();
      jest.clearAllMocks();

      // Second initialization attempt
      const result = await nfcUtils.initialize();
      
      expect(result).toBe(true);
      expect(NfcManager.isSupported).not.toHaveBeenCalled();
      expect(NfcManager.start).not.toHaveBeenCalled();
    });
  });

  describe('Availability Check', () => {
    it('should check NFC availability', async () => {
      (NfcManager.isSupported as jest.Mock).mockResolvedValue(true);
      (NfcManager.isEnabled as jest.Mock).mockResolvedValue(true);

      const result = await nfcUtils.isAvailable();
      
      expect(result).toBe(true);
      expect(NfcManager.isSupported).toHaveBeenCalled();
      expect(NfcManager.isEnabled).toHaveBeenCalled();
    });

    it('should handle disabled NFC', async () => {
      (NfcManager.isSupported as jest.Mock).mockResolvedValue(true);
      (NfcManager.isEnabled as jest.Mock).mockResolvedValue(false);

      const result = await nfcUtils.isAvailable();
      
      expect(result).toBe(false);
    });
  });

  describe('Tag Reading', () => {
    beforeEach(() => {
      (NfcManager.isSupported as jest.Mock).mockResolvedValue(true);
      (NfcManager.start as jest.Mock).mockResolvedValue(true);
      (NfcManager.requestTechnology as jest.Mock).mockResolvedValue(true);
      (NfcManager.cancelTechnologyRequest as jest.Mock).mockResolvedValue(true);
    });

    it('should read NFC tag successfully', async () => {
      const mockTag = {
        id: Buffer.from('12345'),
        type: 'test',
        maxSize: 1024,
        isWritable: true,
        ndefMessage: [
          {
            payload: Buffer.from('{"id":"test-device","name":"Test Device"}'),
            type: Buffer.from('T'),
          }
        ]
      };

      (NfcManager.getTag as jest.Mock).mockResolvedValue(mockTag);

      const result = await nfcUtils.readTag();
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(NfcManager.requestTechnology).toHaveBeenCalledWith(NfcTech.Ndef, { timeout: 60000 });
      
      global.testHelpers.sentry.captureTestMessage(
        'NFC tag read successfully',
        'info'
      );
    });

    it('should handle empty tag', async () => {
      (NfcManager.getTag as jest.Mock).mockResolvedValue(null);

      const result = await nfcUtils.readTag();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('No NFC tag detected');
      
      global.testHelpers.sentry.captureTestMessage(
        'No NFC tag detected - handled gracefully',
        'warning'
      );
    });

    it('should handle tag without NDEF message', async () => {
      const mockTag = {
        id: Buffer.from('12345'),
        type: 'test',
        ndefMessage: null,
      };

      (NfcManager.getTag as jest.Mock).mockResolvedValue(mockTag);

      const result = await nfcUtils.readTag();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('No NDEF message found');
    });

    it('should use platform-specific timeout on iOS', async () => {
      Platform.OS = 'ios';
      
      const mockTag = {
        id: Buffer.from('12345'),
        ndefMessage: [{ payload: Buffer.from('test') }]
      };
      (NfcManager.getTag as jest.Mock).mockResolvedValue(mockTag);

      await nfcUtils.readTag();
      
      expect(NfcManager.requestTechnology).toHaveBeenCalledWith(
        NfcTech.Ndef, 
        { timeout: 60000 }
      );
    });

    it('should handle read errors gracefully', async () => {
      const error = new Error('Read failed');
      (NfcManager.requestTechnology as jest.Mock).mockRejectedValue(error);

      const result = await nfcUtils.readTag();
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      
      global.testHelpers.sentry.captureTestError(error, {
        test: 'NFC tag read error',
      });
    });
  });

  describe('Tag Writing', () => {
    beforeEach(() => {
      (NfcManager.isSupported as jest.Mock).mockResolvedValue(true);
      (NfcManager.start as jest.Mock).mockResolvedValue(true);
      (NfcManager.requestTechnology as jest.Mock).mockResolvedValue(true);
      (NfcManager.cancelTechnologyRequest as jest.Mock).mockResolvedValue(true);
    });

    it('should write to NFC tag successfully', async () => {
      const mockTag = {
        id: Buffer.from('12345'),
        type: 'test',
        maxSize: 1024,
        isWritable: true,
      };

      const testData = {
        id: 'device-123',
        name: 'Test Device',
        location: 'Office',
      };

      (NfcManager.getTag as jest.Mock).mockResolvedValue(mockTag);
      (NfcManager.ndefHandler.writeNdefMessage as jest.Mock).mockResolvedValue(true);

      const result = await nfcUtils.writeTag(testData);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(testData);
      expect(NfcManager.ndefHandler.writeNdefMessage).toHaveBeenCalled();
      
      global.testHelpers.sentry.captureTestMessage(
        'NFC tag write successful',
        'info'
      );
    });

    it('should handle read-only tags', async () => {
      const mockTag = {
        id: Buffer.from('12345'),
        type: 'test',
        maxSize: 1024,
        isWritable: false,
      };

      const testData = { id: 'device-123' };

      (NfcManager.getTag as jest.Mock).mockResolvedValue(mockTag);

      const result = await nfcUtils.writeTag(testData);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('read-only');
    });

    it('should handle data too large for tag', async () => {
      const mockTag = {
        id: Buffer.from('12345'),
        type: 'test',
        maxSize: 10, // Very small capacity
        isWritable: true,
      };

      const largeData = {
        id: 'device-123',
        description: 'A'.repeat(1000), // Large string
      };

      (NfcManager.getTag as jest.Mock).mockResolvedValue(mockTag);

      const result = await nfcUtils.writeTag(largeData);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('exceeds tag capacity');
    });

    it('should handle empty data', async () => {
      const result = await nfcUtils.writeTag({});
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('No data provided');
    });

    it('should retry writing on iOS', async () => {
      Platform.OS = 'ios';
      
      const mockTag = {
        id: Buffer.from('12345'),
        type: 'test',
        maxSize: 1024,
        isWritable: true,
      };

      const testData = { id: 'device-123' };

      (NfcManager.getTag as jest.Mock).mockResolvedValue(mockTag);
      (NfcManager.ndefHandler.writeNdefMessage as jest.Mock)
        .mockRejectedValueOnce(new Error('Write failed'))
        .mockResolvedValueOnce(true);

      const result = await nfcUtils.writeTag(testData);
      
      expect(result.success).toBe(true);
      expect(NfcManager.ndefHandler.writeNdefMessage).toHaveBeenCalledTimes(2);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup NFC resources', async () => {
      (NfcManager.cancelTechnologyRequest as jest.Mock).mockResolvedValue(true);
      (NfcManager.unregisterTagEvent as jest.Mock).mockResolvedValue(true);

      await nfcUtils.cleanup();
      
      expect(NfcManager.cancelTechnologyRequest).toHaveBeenCalled();
      expect(NfcManager.unregisterTagEvent).toHaveBeenCalled();
      
      global.testHelpers.sentry.captureTestMessage(
        'NFC cleanup completed',
        'info'
      );
    });

    it('should handle cleanup errors gracefully', async () => {
      const error = new Error('Cleanup failed');
      (NfcManager.cancelTechnologyRequest as jest.Mock).mockRejectedValue(error);

      await nfcUtils.cleanup();
      
      // Should not throw error
      expect(true).toBe(true);
      
      global.testHelpers.sentry.captureTestError(error, {
        test: 'NFC cleanup error handling',
      });
    });
  });

  describe('Cancel Operation', () => {
    it('should cancel ongoing NFC operation', async () => {
      (NfcManager.cancelTechnologyRequest as jest.Mock).mockResolvedValue(true);

      await nfcUtils.cancelOperation();
      
      expect(NfcManager.cancelTechnologyRequest).toHaveBeenCalled();
    });
  });

  describe('JSON Processing', () => {
    it('should handle malformed JSON gracefully', async () => {
      const mockTag = {
        id: Buffer.from('12345'),
        ndefMessage: [
          {
            payload: Buffer.from('{"id":"test-device","name":}'), // Malformed JSON
            type: Buffer.from('T'),
          }
        ]
      };

      (NfcManager.isSupported as jest.Mock).mockResolvedValue(true);
      (NfcManager.start as jest.Mock).mockResolvedValue(true);
      (NfcManager.requestTechnology as jest.Mock).mockResolvedValue(true);
      (NfcManager.getTag as jest.Mock).mockResolvedValue(mockTag);

      const result = await nfcUtils.readTag();
      
      // Should handle malformed JSON without crashing
      expect(result.success).toBe(true);
      expect(result.data?.content).toBeDefined();
    });
  });

  describe('Error Scenarios', () => {
    it('should handle network-like errors', async () => {
      const networkError = new Error('Network request failed');
      (NfcManager.requestTechnology as jest.Mock).mockRejectedValue(networkError);

      const result = await nfcUtils.readTag();
      
      expect(result.success).toBe(false);
      
      global.testHelpers.sentry.captureTestError(networkError, {
        test: 'NFC network error simulation',
        operation: 'readTag',
      });
    });

    it('should handle cancelled operations', async () => {
      const cancelError = new Error('Operation was cancelled');
      (NfcManager.requestTechnology as jest.Mock).mockRejectedValue(cancelError);

      const result = await nfcUtils.readTag();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('cancelled');
    });
  });
});