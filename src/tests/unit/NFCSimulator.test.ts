// src/tests/unit/NFCSimulator.test.ts
import { NFCSimulator, nfcSimulator } from '../../services/NFCSimulator';

describe('NFCSimulator', () => {
  beforeEach(() => {
    // Reset simulator state before each test
    nfcSimulator.setEnabled(true);
    nfcSimulator.resetTags();
    nfcSimulator.setSimulatedDelay(0); // No delay for tests
    nfcSimulator.setFailureRate(0); // No random failures for tests
  });

  afterEach(() => {
    nfcSimulator.setEnabled(false);
  });

  describe('Singleton', () => {
    it('should return the same instance', () => {
      const instance1 = NFCSimulator.getInstance();
      const instance2 = NFCSimulator.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Configuration', () => {
    it('should enable and disable simulator', () => {
      nfcSimulator.setEnabled(false);
      expect(nfcSimulator.isEnabled()).toBe(false);
      expect(nfcSimulator.shouldUseSimulator()).toBe(false);

      nfcSimulator.setEnabled(true);
      expect(nfcSimulator.isEnabled()).toBe(true);
      expect(nfcSimulator.shouldUseSimulator()).toBe(true);
    });

    it('should set simulated delay', () => {
      nfcSimulator.setSimulatedDelay(1000);
      const config = nfcSimulator.getConfig();
      expect(config.simulatedDelay).toBe(1000);
    });

    it('should clamp failure rate between 0 and 1', () => {
      nfcSimulator.setFailureRate(0.5);
      expect(nfcSimulator.getConfig().failureRate).toBe(0.5);

      nfcSimulator.setFailureRate(-0.5);
      expect(nfcSimulator.getConfig().failureRate).toBe(0);

      nfcSimulator.setFailureRate(1.5);
      expect(nfcSimulator.getConfig().failureRate).toBe(1);
    });
  });

  describe('Tag Management', () => {
    it('should have default tags available', () => {
      const tagIds = nfcSimulator.getAvailableTagIds();
      expect(tagIds).toContain('EMPTY_TAG');
      expect(tagIds).toContain('DEVICE_TAG');
      expect(tagIds).toContain('LOCKED_TAG');
      expect(tagIds).toContain('READ_ONLY_TAG');
    });

    it('should select a tag', () => {
      const success = nfcSimulator.selectTag('DEVICE_TAG');
      expect(success).toBe(true);

      const config = nfcSimulator.getConfig();
      expect(config.selectedTagId).toBe('DEVICE_TAG');
    });

    it('should return false when selecting non-existent tag', () => {
      const success = nfcSimulator.selectTag('NON_EXISTENT');
      expect(success).toBe(false);
    });

    it('should get selected tag details', () => {
      nfcSimulator.selectTag('DEVICE_TAG');
      const tag = nfcSimulator.getSelectedTag();

      expect(tag).toBeDefined();
      expect(tag?.id).toBe('04D1E2F3A4B5C6');
      expect(tag?.type).toBe('NTAG215');
      expect(tag?.isWritable).toBe(true);
    });

    it('should reset tags to defaults', () => {
      nfcSimulator.selectTag('DEVICE_TAG');
      nfcSimulator.updateTagContent('DEVICE_TAG', '{"test": "modified"}');

      nfcSimulator.resetTags();

      const tag = nfcSimulator.getTag('DEVICE_TAG');
      expect(tag?.content).toContain('DEV-001');
    });

    it('should add custom tags', () => {
      nfcSimulator.addTag('CUSTOM_TAG', {
        id: '04CUSTOM',
        type: 'NTAG213',
        maxSize: 144,
        isWritable: true,
        isLocked: false,
        content: '{"custom": true}',
      });

      const tag = nfcSimulator.getTag('CUSTOM_TAG');
      expect(tag).toBeDefined();
      expect(tag?.id).toBe('04CUSTOM');
    });
  });

  describe('Read Operations', () => {
    it('should read empty tag', async () => {
      nfcSimulator.selectTag('EMPTY_TAG');
      const result = await nfcSimulator.readNFC();

      expect(result.success).toBe(true);
      expect(result.data?.isEmpty).toBe(true);
      expect(result.data?.tagId).toBe('04A1B2C3D4E5F6');
    });

    it('should read device tag with JSON content', async () => {
      nfcSimulator.selectTag('DEVICE_TAG');
      const result = await nfcSimulator.readNFC();

      expect(result.success).toBe(true);
      expect(result.data?.tagId).toBe('04D1E2F3A4B5C6');
      expect(result.data?.parsedData).toBeDefined();
      expect(result.data?.parsedData.deviceId).toBe('DEV-001');
    });

    it('should return false when selecting non-existent tag for read', async () => {
      // selectTag returns false for non-existent tags but keeps current selection
      // So the read will still work with the current tag
      const success = nfcSimulator.selectTag('NON_EXISTENT');
      expect(success).toBe(false);

      // The current tag selection should remain unchanged
      const result = await nfcSimulator.readNFC();
      expect(result.success).toBe(true);
    });
  });

  describe('Write Operations', () => {
    it('should write to writable tag', async () => {
      nfcSimulator.selectTag('EMPTY_TAG');
      const jsonData = JSON.stringify({ test: 'data', value: 123 });

      const result = await nfcSimulator.writeNFC(jsonData);

      expect(result.success).toBe(true);
      expect(result.data?.jsonString).toBe(jsonData);

      // Verify content was written
      const tag = nfcSimulator.getSelectedTag();
      expect(tag?.content).toBe(jsonData);
    });

    it('should fail to write to read-only tag', async () => {
      nfcSimulator.selectTag('READ_ONLY_TAG');
      const result = await nfcSimulator.writeNFC('{"test": true}');

      expect(result.success).toBe(false);
      expect(result.error).toContain('read-only');
    });

    it('should fail to write to locked tag', async () => {
      nfcSimulator.selectTag('LOCKED_TAG');
      const result = await nfcSimulator.writeNFC('{"test": true}');

      expect(result.success).toBe(false);
      expect(result.error).toContain('locked');
    });

    it('should fail with invalid JSON', async () => {
      nfcSimulator.selectTag('EMPTY_TAG');
      const result = await nfcSimulator.writeNFC('not valid json');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid JSON');
    });

    it('should fail when data exceeds capacity', async () => {
      nfcSimulator.selectTag('EMPTY_TAG'); // 144 bytes max

      // Create JSON larger than 144 bytes
      const largeData = JSON.stringify({
        field1: 'a'.repeat(50),
        field2: 'b'.repeat(50),
        field3: 'c'.repeat(50),
      });

      const result = await nfcSimulator.writeNFC(largeData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('exceeds tag capacity');
    });
  });

  describe('Format Operations', () => {
    it('should format writable tag', async () => {
      nfcSimulator.selectTag('DEVICE_TAG');
      const result = await nfcSimulator.formatTag();

      expect(result.success).toBe(true);
      expect(result.data?.wasFormatted).toBe(true);

      // Verify content was cleared
      const tag = nfcSimulator.getSelectedTag();
      expect(tag?.content).toBeNull();
    });

    it('should fail to format read-only tag', async () => {
      nfcSimulator.selectTag('READ_ONLY_TAG');
      const result = await nfcSimulator.formatTag();

      expect(result.success).toBe(false);
      expect(result.error).toContain('read-only');
    });
  });

  describe('Lock Operations', () => {
    it('should lock a tag with password', async () => {
      nfcSimulator.selectTag('EMPTY_TAG');
      const result = await nfcSimulator.lockTag('testpassword');

      expect(result.success).toBe(true);
      expect(result.lockType).toBe('hardware');

      // Verify tag is locked
      const tag = nfcSimulator.getSelectedTag();
      expect(tag?.isLocked).toBe(true);
      expect(tag?.lockPassword).toBe('testpassword');
    });

    it('should fail to lock with short password', async () => {
      nfcSimulator.selectTag('EMPTY_TAG');
      const result = await nfcSimulator.lockTag('ab');

      expect(result.success).toBe(false);
      expect(result.error).toContain('at least 4 characters');
    });

    it('should fail to lock already locked tag', async () => {
      nfcSimulator.selectTag('LOCKED_TAG');
      const result = await nfcSimulator.lockTag('newpassword');

      expect(result.success).toBe(false);
      expect(result.error).toContain('already locked');
    });
  });

  describe('Unlock Operations', () => {
    it('should unlock tag with correct password', async () => {
      nfcSimulator.selectTag('LOCKED_TAG');
      const result = await nfcSimulator.unlockTag('test');

      expect(result.success).toBe(true);
      expect(result.lockType).toBe('hardware');

      // Verify tag is unlocked
      const tag = nfcSimulator.getSelectedTag();
      expect(tag?.isLocked).toBe(false);
      expect(tag?.lockPassword).toBeUndefined();
    });

    it('should fail to unlock with wrong password', async () => {
      nfcSimulator.selectTag('LOCKED_TAG');
      const result = await nfcSimulator.unlockTag('wrongpassword');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Incorrect password');
    });

    it('should fail to unlock non-locked tag', async () => {
      nfcSimulator.selectTag('EMPTY_TAG');
      const result = await nfcSimulator.unlockTag('anypassword');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not locked');
    });
  });

  describe('Lock Status Check', () => {
    it('should return locked status for locked tag', async () => {
      nfcSimulator.selectTag('LOCKED_TAG');
      const result = await nfcSimulator.isTagLocked();

      expect(result.success).toBe(true);
      expect(result.locked).toBe(true);
      expect(result.lockType).toBe('hardware');
    });

    it('should return unlocked status for unlocked tag', async () => {
      nfcSimulator.selectTag('EMPTY_TAG');
      const result = await nfcSimulator.isTagLocked();

      expect(result.success).toBe(true);
      expect(result.locked).toBe(false);
      expect(result.lockType).toBeUndefined();
    });
  });

  describe('Failure Simulation', () => {
    it('should simulate failures based on failure rate', async () => {
      nfcSimulator.selectTag('EMPTY_TAG');
      nfcSimulator.setFailureRate(1); // 100% failure rate

      const result = await nfcSimulator.readNFC();
      expect(result.success).toBe(false);
    });
  });
});
