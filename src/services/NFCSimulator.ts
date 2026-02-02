// src/services/NFCSimulator.ts - NFC Simulator for testing without NFC hardware
import { NFCOperationResult } from '../types/nfc';

/**
 * Simulated NFC tag structure
 */
export interface SimulatedTag {
  id: string;
  type: string;  // NTAG213/215/216
  maxSize: number;
  isWritable: boolean;
  isLocked: boolean;
  lockPassword?: string;
  content: string | null;
}

/**
 * Simulator configuration options
 */
export interface SimulatorConfig {
  enabled: boolean;
  simulatedDelay: number;  // Delay in ms to simulate NFC scan time
  failureRate: number;     // 0-1, chance of simulated failure
  selectedTagId: string;
}

/**
 * Default tags for testing various scenarios
 */
const DEFAULT_TAGS: Record<string, SimulatedTag> = {
  EMPTY_TAG: {
    id: '04A1B2C3D4E5F6',
    type: 'NTAG213',
    maxSize: 144,
    isWritable: true,
    isLocked: false,
    content: null,
  },
  DEVICE_TAG: {
    id: '04D1E2F3A4B5C6',
    type: 'NTAG215',
    maxSize: 504,
    isWritable: true,
    isLocked: false,
    content: JSON.stringify({
      deviceId: 'DEV-001',
      make: 'TestMake',
      model: 'TestModel',
      serialNumber: 'SN-12345',
      maintenanceInterval: 30,
      description: 'Test device for simulator',
    }),
  },
  LOCKED_TAG: {
    id: '04F1A2B3C4D5E6',
    type: 'NTAG213',
    maxSize: 144,
    isWritable: true,
    isLocked: true,
    lockPassword: 'test',
    content: JSON.stringify({
      _locked: true,
      _timestamp: new Date().toISOString(),
      _hint: 'This tag is password protected',
      _encryptedContent: '',
      _hasContent: false,
    }),
  },
  READ_ONLY_TAG: {
    id: '04B1C2D3E4F5A6',
    type: 'NTAG216',
    maxSize: 888,
    isWritable: false,
    isLocked: false,
    content: JSON.stringify({
      deviceId: 'DEV-READONLY',
      make: 'ReadOnly',
      model: 'Permanent',
    }),
  },
};

/**
 * NFC Simulator class for testing NFC operations without hardware
 */
export class NFCSimulator {
  private static instance: NFCSimulator;
  private tags: Map<string, SimulatedTag>;
  private config: SimulatorConfig;

  private constructor() {
    this.tags = new Map();
    this.config = {
      enabled: false,
      simulatedDelay: 500,
      failureRate: 0,
      selectedTagId: 'EMPTY_TAG',
    };
    this.resetTags();
  }

  public static getInstance(): NFCSimulator {
    if (!NFCSimulator.instance) {
      NFCSimulator.instance = new NFCSimulator();
    }
    return NFCSimulator.instance;
  }

  /**
   * Check if the simulator should be used instead of real NFC
   */
  public shouldUseSimulator(): boolean {
    return this.config.enabled;
  }

  /**
   * Enable or disable the simulator
   */
  public setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    console.log(`[NFCSimulator] Simulator ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Check if simulator is enabled
   */
  public isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Set the simulated delay for operations
   */
  public setSimulatedDelay(delay: number): void {
    this.config.simulatedDelay = delay;
  }

  /**
   * Set the failure rate (0-1)
   */
  public setFailureRate(rate: number): void {
    this.config.failureRate = Math.max(0, Math.min(1, rate));
  }

  /**
   * Select which tag to use for operations
   */
  public selectTag(tagId: string): boolean {
    if (this.tags.has(tagId)) {
      this.config.selectedTagId = tagId;
      console.log(`[NFCSimulator] Selected tag: ${tagId}`);
      return true;
    }
    console.warn(`[NFCSimulator] Tag not found: ${tagId}`);
    return false;
  }

  /**
   * Get the currently selected tag
   */
  public getSelectedTag(): SimulatedTag | undefined {
    return this.tags.get(this.config.selectedTagId);
  }

  /**
   * Get all available tag IDs
   */
  public getAvailableTagIds(): string[] {
    return Array.from(this.tags.keys());
  }

  /**
   * Get a specific tag by ID
   */
  public getTag(tagId: string): SimulatedTag | undefined {
    return this.tags.get(tagId);
  }

  /**
   * Reset all tags to default state
   */
  public resetTags(): void {
    this.tags.clear();
    Object.entries(DEFAULT_TAGS).forEach(([key, tag]) => {
      this.tags.set(key, { ...tag });
    });
    console.log('[NFCSimulator] Tags reset to defaults');
  }

  /**
   * Add a custom tag
   */
  public addTag(tagId: string, tag: SimulatedTag): void {
    this.tags.set(tagId, { ...tag });
    console.log(`[NFCSimulator] Added custom tag: ${tagId}`);
  }

  /**
   * Update a tag's content
   */
  public updateTagContent(tagId: string, content: string | null): boolean {
    const tag = this.tags.get(tagId);
    if (tag) {
      tag.content = content;
      return true;
    }
    return false;
  }

  /**
   * Get simulator configuration
   */
  public getConfig(): SimulatorConfig {
    return { ...this.config };
  }

  /**
   * Simulate delay for realistic behavior
   */
  private async simulateDelay(): Promise<void> {
    if (this.config.simulatedDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.config.simulatedDelay));
    }
  }

  /**
   * Check if operation should fail based on failure rate
   */
  private shouldFail(): boolean {
    return Math.random() < this.config.failureRate;
  }

  /**
   * Simulate reading an NFC tag
   */
  public async readNFC(): Promise<NFCOperationResult> {
    console.log('[NFCSimulator] Simulating NFC read');
    await this.simulateDelay();

    if (this.shouldFail()) {
      return { success: false, error: 'Simulated read failure - tag moved away' };
    }

    const tag = this.getSelectedTag();
    if (!tag) {
      return { success: false, error: 'No simulated tag selected' };
    }

    // Handle empty tags
    if (!tag.content) {
      return {
        success: true,
        data: {
          tagId: tag.id,
          isEmpty: true,
          message: 'Tag is formatted but contains no data. You can write data to it.',
        },
      };
    }

    // Parse and return content
    try {
      const parsedData = JSON.parse(tag.content);
      return {
        success: true,
        data: {
          tagId: tag.id,
          jsonString: tag.content,
          parsedData,
        },
      };
    } catch {
      return {
        success: true,
        data: {
          tagId: tag.id,
          content: tag.content,
        },
      };
    }
  }

  /**
   * Simulate writing to an NFC tag
   */
  public async writeNFC(jsonString: string): Promise<NFCOperationResult> {
    console.log('[NFCSimulator] Simulating NFC write');
    await this.simulateDelay();

    if (this.shouldFail()) {
      return { success: false, error: 'Simulated write failure - connection lost' };
    }

    const tag = this.getSelectedTag();
    if (!tag) {
      return { success: false, error: 'No simulated tag selected' };
    }

    if (!tag.isWritable) {
      return { success: false, error: 'This tag is read-only and cannot be written to.' };
    }

    if (tag.isLocked) {
      return { success: false, error: 'This tag is locked. Unlock it first before writing.' };
    }

    // Validate JSON
    try {
      JSON.parse(jsonString);
    } catch {
      return { success: false, error: 'Invalid JSON string provided' };
    }

    // Check capacity
    const byteLength = new TextEncoder().encode(jsonString).length;
    if (byteLength > tag.maxSize) {
      return {
        success: false,
        error: `Data size (${byteLength} bytes) exceeds tag capacity (${tag.maxSize} bytes).`,
      };
    }

    // Write to tag
    tag.content = jsonString;
    console.log(`[NFCSimulator] Wrote ${byteLength} bytes to tag ${tag.id}`);

    return { success: true, data: { jsonString } };
  }

  /**
   * Simulate formatting an NFC tag
   */
  public async formatTag(): Promise<NFCOperationResult> {
    console.log('[NFCSimulator] Simulating NFC format');
    await this.simulateDelay();

    if (this.shouldFail()) {
      return { success: false, error: 'Simulated format failure' };
    }

    const tag = this.getSelectedTag();
    if (!tag) {
      return { success: false, error: 'No simulated tag selected' };
    }

    if (!tag.isWritable) {
      return { success: false, error: 'This tag is read-only and cannot be formatted.' };
    }

    // Clear content
    tag.content = null;
    tag.isLocked = false;
    tag.lockPassword = undefined;

    return {
      success: true,
      data: {
        message: 'Tag formatted successfully. You can now write data to it.',
        wasFormatted: true,
      },
    };
  }

  /**
   * Simulate locking an NFC tag
   */
  public async lockTag(password: string): Promise<NFCOperationResult & { lockType?: string }> {
    console.log('[NFCSimulator] Simulating NFC lock');
    await this.simulateDelay();

    if (this.shouldFail()) {
      return { success: false, error: 'Simulated lock failure' };
    }

    const tag = this.getSelectedTag();
    if (!tag) {
      return { success: false, error: 'No simulated tag selected' };
    }

    if (!password || password.length < 4) {
      return { success: false, error: 'Password must be at least 4 characters long' };
    }

    if (tag.isLocked) {
      return { success: false, error: 'Tag is already locked' };
    }

    // Lock the tag
    tag.isLocked = true;
    tag.lockPassword = password;

    return {
      success: true,
      lockType: 'hardware',
      data: { message: 'Tag locked with hardware password protection' },
    };
  }

  /**
   * Simulate unlocking an NFC tag
   */
  public async unlockTag(password: string): Promise<NFCOperationResult & { lockType?: string }> {
    console.log('[NFCSimulator] Simulating NFC unlock');
    await this.simulateDelay();

    if (this.shouldFail()) {
      return { success: false, error: 'Simulated unlock failure' };
    }

    const tag = this.getSelectedTag();
    if (!tag) {
      return { success: false, error: 'No simulated tag selected' };
    }

    if (!tag.isLocked) {
      return { success: false, error: 'Tag is not locked' };
    }

    if (!password) {
      return { success: false, error: 'Password is required to unlock the tag' };
    }

    if (tag.lockPassword !== password) {
      return { success: false, error: 'Incorrect password. Please try again.' };
    }

    // Unlock the tag
    tag.isLocked = false;
    tag.lockPassword = undefined;

    return {
      success: true,
      lockType: 'hardware',
      data: { message: 'Tag unlocked successfully' },
    };
  }

  /**
   * Check if a tag is locked
   */
  public async isTagLocked(): Promise<NFCOperationResult & { locked: boolean; lockType?: string }> {
    console.log('[NFCSimulator] Simulating lock status check');
    await this.simulateDelay();

    const tag = this.getSelectedTag();
    if (!tag) {
      return { success: false, locked: false, error: 'No simulated tag selected' };
    }

    return {
      success: true,
      locked: tag.isLocked,
      lockType: tag.isLocked ? 'hardware' : undefined,
      data: {
        tagId: tag.id,
        isLocked: tag.isLocked,
      },
    };
  }
}

// Export singleton instance
export const nfcSimulator = NFCSimulator.getInstance();
