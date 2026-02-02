// src/services/NFCSecurityService.ts - NFC Lock/Unlock functionality for NDEF tags
import { Platform, Alert } from 'react-native';
import NfcManager, { NfcTech, Ndef } from 'react-native-nfc-manager';
import { NFCOperationResult } from '../types/nfc';
import { nfcService } from './NFCService';
import { nfcLogger, NFCOperationType, NFCErrorCategory } from '../utils/NFCLogger';
// Temporarily disabled to test if this import causes issues
// import { nfcSimulator } from './NFCSimulator';

export interface NFCSecurityResult extends NFCOperationResult {
  lockType?: 'hardware' | 'software';
}

/**
 * NTAG configuration page addresses for different tag types
 * These addresses are used for password protection configuration
 */
interface NTAGConfig {
  pwdPage: number;   // Password storage page
  packPage: number;  // Password ACK page
  cfgPage: number;   // Configuration page (AUTH0, ACCESS)
  totalPages: number;
}

const NTAG_CONFIGS: Record<string, NTAGConfig> = {
  NTAG213: { pwdPage: 0x2B, packPage: 0x2C, cfgPage: 0x29, totalPages: 45 },   // 43, 44, 41
  NTAG215: { pwdPage: 0x85, packPage: 0x86, cfgPage: 0x83, totalPages: 135 },  // 133, 134, 131
  NTAG216: { pwdPage: 0xE5, packPage: 0xE6, cfgPage: 0xE3, totalPages: 231 },  // 229, 230, 227
};

export class NFCSecurityService {
  private static instance: NFCSecurityService;

  private constructor() {}

  /**
   * Safely convert tag ID to hex string
   * Handles both Buffer (Node.js) and Uint8Array (React Native) formats
   */
  private getTagIdHex(tagId: any): string | undefined {
    if (!tagId) return undefined;

    // If already a string, normalize it
    if (typeof tagId === 'string') {
      return tagId.toUpperCase();
    }

    try {
      // Handle Uint8Array or array-like objects (React Native)
      const bytes = Array.from(new Uint8Array(tagId));
      return bytes.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    } catch (e) {
      console.warn('[NFCSecurityService] Could not convert tag ID:', e);
      return undefined;
    }
  }

  public static getInstance(): NFCSecurityService {
    if (!NFCSecurityService.instance) {
      NFCSecurityService.instance = new NFCSecurityService();
    }
    return NFCSecurityService.instance;
  }

  /**
   * Encrypt content using simple XOR (for demonstration - use proper encryption in production)
   */
  private encryptContent(content: string, password: string): string {
    let result = '';
    for (let i = 0; i < content.length; i++) {
      const charCode = content.charCodeAt(i) ^ password.charCodeAt(i % password.length);
      result += String.fromCharCode(charCode);
    }
    return result;
  }

  /**
   * Decrypt content using simple XOR
   */
  private decryptContent(encryptedContent: string, password: string): string {
    return this.encryptContent(encryptedContent, password); // XOR is symmetric
  }

  /**
   * Convert password to 4-byte array for NTAG authentication
   */
  private passwordToBytes(password: string): number[] {
    const passwordBytes = new TextEncoder().encode(password.padEnd(4, '\0').slice(0, 4));
    return Array.from(passwordBytes);
  }

  /**
   * Detect NTAG type from tag info and return configuration
   * NDEF capacity (maxSize) differs from total memory:
   * - NTAG213: ~137 bytes NDEF capacity (144 bytes user memory)
   * - NTAG215: ~492 bytes NDEF capacity (504 bytes user memory)
   * - NTAG216: ~868 bytes NDEF capacity (888 bytes user memory)
   */
  private detectNTAGConfig(tag: any): NTAGConfig | null {
    // Try to detect from tag type string
    const tagType = (tag.type || '').toUpperCase();
    const techTypes = (tag.techTypes || []).map((t: string) => t.toUpperCase());

    // Check for NTAG identifiers in type or tech types
    const tagInfo = tagType + ' ' + techTypes.join(' ');

    // Check explicit tag type identifiers first
    if (tagInfo.includes('216')) {
      return NTAG_CONFIGS.NTAG216;
    } else if (tagInfo.includes('215')) {
      return NTAG_CONFIGS.NTAG215;
    } else if (tagInfo.includes('213')) {
      return NTAG_CONFIGS.NTAG213;
    }

    // Detect by NDEF capacity (maxSize) - use ranges that match actual reported values
    if (tag.maxSize) {
      // NTAG216: NDEF capacity typically 868-888 bytes
      if (tag.maxSize >= 800) return NTAG_CONFIGS.NTAG216;
      // NTAG215: NDEF capacity typically 480-504 bytes (often reports 492)
      if (tag.maxSize >= 400) return NTAG_CONFIGS.NTAG215;
      // NTAG213: NDEF capacity typically 137-144 bytes
      if (tag.maxSize >= 100) return NTAG_CONFIGS.NTAG213;
    }

    // Fallback for generic NTAG/Ultralight
    if (tagInfo.includes('ULTRALIGHT') || tagInfo.includes('NTAG')) {
      return NTAG_CONFIGS.NTAG213;
    }

    return null;
  }

  /**
   * Send NfcA transceive command with error handling
   */
  private async nfcATransceive(command: number[]): Promise<number[]> {
    try {
      const response = await (NfcManager as any).nfcAHandler.transceive(command);
      return response ? Array.from(response) : [];
    } catch (error) {
      console.error('[NFCSecurityService] NfcA transceive error:', error);
      throw error;
    }
  }

  /**
   * Lock an NDEF tag with password protection
   * Uses NfcA transceive for cross-platform hardware lock support
   */
  public async lockTag(password: string): Promise<NFCSecurityResult> {
    // Simulator check temporarily disabled for testing
    // if (nfcSimulator.shouldUseSimulator()) {
    //   return nfcSimulator.lockTag(password);
    // }

    const operationId = nfcLogger.startOperation(NFCOperationType.LOCK, { platform: Platform.OS });

    try {
      nfcLogger.logStep(operationId, 'Starting tag lock operation');

      if (!password || password.length < 4) {
        throw new Error('Password must be at least 4 characters long');
      }

      // Ensure NFC is initialized
      if (!await nfcService.initialize()) {
        throw new Error('NFC is not available or could not be initialized');
      }
      nfcLogger.logStep(operationId, 'NFC initialized');

      // First, get tag info using NDEF to check compatibility
      const timeout = Platform.OS === 'ios' ? 60000 : 30000;
      await NfcManager.requestTechnology(NfcTech.Ndef, Platform.OS === 'ios' ? { timeout } as any : undefined);

      const tag = await NfcManager.getTag();
      if (!tag) {
        throw new Error('No NFC tag detected. Please position the tag correctly.');
      }

      const tagId = this.getTagIdHex(tag.id);
      nfcLogger.logStep(operationId, 'Tag detected', {
        tagId,
        tagType: tag.type,
        techTypes: tag.techTypes,
        maxSize: tag.maxSize
      });

      // Read existing content before locking
      let existingContent = '';
      try {
        if (tag.ndefMessage && tag.ndefMessage.length > 0) {
          const record = tag.ndefMessage[0];
          if (record && record.payload) {
            existingContent = Ndef.text.decodePayload(record.payload);
          }
        }
      } catch (readError) {
        nfcLogger.logStep(operationId, 'Could not read existing content', { warning: (readError as Error).message });
      }

      // Cancel NDEF and try NfcA for hardware lock
      await NfcManager.cancelTechnologyRequest();

      // Try hardware-based protection using NfcA (cross-platform)
      const ntagConfig = this.detectNTAGConfig(tag);
      if (ntagConfig) {
        try {
          nfcLogger.logStep(operationId, 'Attempting hardware lock via NfcA', { config: ntagConfig });

          await NfcManager.requestTechnology(NfcTech.NfcA);

          const passwordBytes = this.passwordToBytes(password);

          // Write PWD page: WRITE command (0xA2) + page address + 4 bytes data
          const writePwdCmd = [0xa2, ntagConfig.pwdPage, ...passwordBytes];
          nfcLogger.logStep(operationId, 'Writing PWD page', { page: ntagConfig.pwdPage });
          await this.nfcATransceive(writePwdCmd);

          // Write PACK page: 2 bytes PACK + 2 bytes padding
          const writePackCmd = [0xa2, ntagConfig.packPage, 0x00, 0x00, 0x00, 0x00];
          nfcLogger.logStep(operationId, 'Writing PACK page', { page: ntagConfig.packPage });
          await this.nfcATransceive(writePackCmd);

          // Write CFG0 page to enable password protection from page 4
          // CFG0 layout: [MIRROR, RFUI, MIRROR_PAGE, AUTH0]
          // AUTH0=0x04 means password required starting from page 4
          const writeCfgCmd = [0xa2, ntagConfig.cfgPage, 0x00, 0x00, 0x00, 0x04];
          nfcLogger.logStep(operationId, 'Writing CFG0 page (enabling protection)', { page: ntagConfig.cfgPage });
          await this.nfcATransceive(writeCfgCmd);

          nfcLogger.endOperation(operationId, { success: true, lockType: 'hardware' });
          return {
            success: true,
            lockType: 'hardware',
            data: { message: 'Tag locked with hardware password protection' }
          };

        } catch (hardwareError) {
          // Enhanced error logging to help diagnose lock failures
          console.log('[NFCSecurityService] Hardware lock error details:', {
            message: (hardwareError as Error).message,
            name: (hardwareError as Error).name,
            stack: (hardwareError as Error).stack
          });
          nfcLogger.logStep(operationId, 'Hardware lock failed', { error: (hardwareError as Error).message });
          try {
            await NfcManager.cancelTechnologyRequest();
          } catch (e) {
            // Ignore cleanup errors
          }
        }
      }

      // Fallback: Software-based protection (modify NDEF content)
      nfcLogger.logStep(operationId, 'Falling back to software-based lock');

      await NfcManager.requestTechnology(NfcTech.Ndef, Platform.OS === 'ios' ? { timeout } as any : undefined);

      // Create locked data structure
      const lockedData = {
        _locked: true,
        _timestamp: new Date().toISOString(),
        _hint: 'This tag is password protected',
        _encryptedContent: existingContent ? this.encryptContent(existingContent, password) : '',
        _hasContent: existingContent.length > 0
      };

      const jsonString = JSON.stringify(lockedData);
      const bytes = Ndef.encodeMessage([Ndef.textRecord(jsonString)]);

      if (Platform.OS === 'ios') {
        let writeAttempts = 0;
        const maxAttempts = 3;

        while (writeAttempts < maxAttempts) {
          try {
            await NfcManager.ndefHandler.writeNdefMessage(bytes);
            nfcLogger.logStep(operationId, 'iOS software lock completed', { attempt: writeAttempts + 1 });
            break;
          } catch (iosWriteError) {
            writeAttempts++;
            if (writeAttempts >= maxAttempts) {
              throw iosWriteError;
            }
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      } else {
        await NfcManager.ndefHandler.writeNdefMessage(bytes);
        nfcLogger.logStep(operationId, 'Android software lock completed');
      }

      nfcLogger.endOperation(operationId, { success: true, lockType: 'software' });
      return {
        success: true,
        lockType: 'software',
        data: { message: 'Tag locked with encrypted content protection' }
      };

    } catch (error) {
      const errorCategory = nfcLogger.categorizeError(error as Error);
      nfcLogger.endOperationWithError(operationId, error as Error, errorCategory);

      let userErrorMessage: string;
      const errorMessage = (error as Error).message;

      if (errorMessage.includes('NFC hardware') || errorMessage.includes('not available')) {
        userErrorMessage = 'NFC is not available or is disabled on this device.';
      } else if (errorMessage.includes('cancelled')) {
        userErrorMessage = 'NFC operation was cancelled.';
      } else if (errorMessage.includes('Password must be')) {
        userErrorMessage = errorMessage;
      } else if (errorMessage.includes('read-only')) {
        userErrorMessage = 'This tag cannot be modified. Please use a writable NFC tag.';
      } else {
        userErrorMessage = `Failed to lock NFC tag: ${errorMessage}`;
      }

      return { success: false, error: userErrorMessage };
    } finally {
      try {
        await NfcManager.cancelTechnologyRequest();
        nfcLogger.logStep(operationId, 'NFC technology request canceled');
      } catch (finallyError) {
        // Silent cleanup
      }
    }
  }

  /**
   * Unlock an NDEF tag by removing password protection
   * Uses NfcA transceive for cross-platform hardware unlock support
   */
  public async unlockTag(password: string): Promise<NFCSecurityResult> {
    // Simulator check temporarily disabled for testing
    // if (nfcSimulator.shouldUseSimulator()) {
    //   return nfcSimulator.unlockTag(password);
    // }

    const operationId = nfcLogger.startOperation(NFCOperationType.UNLOCK, { platform: Platform.OS });

    try {
      nfcLogger.logStep(operationId, 'Starting tag unlock operation');

      if (!password) {
        throw new Error('Password is required to unlock the tag');
      }

      // Ensure NFC is initialized
      if (!await nfcService.initialize()) {
        throw new Error('NFC is not available or could not be initialized');
      }
      nfcLogger.logStep(operationId, 'NFC initialized');

      // First, get tag info using NDEF
      const timeout = Platform.OS === 'ios' ? 60000 : 30000;
      await NfcManager.requestTechnology(NfcTech.Ndef, Platform.OS === 'ios' ? { timeout } as any : undefined);

      const tag = await NfcManager.getTag();
      if (!tag) {
        throw new Error('No NFC tag detected. Please position the tag correctly.');
      }

      const tagId = this.getTagIdHex(tag.id);
      nfcLogger.logStep(operationId, 'Tag detected', {
        tagId,
        tagType: tag.type,
        techTypes: tag.techTypes,
        hasNdefMessage: !!tag.ndefMessage?.length
      });

      // Read NDEF content for software unlock fallback
      let textContent = '';
      let lockedData: any = null;

      if (tag.ndefMessage && tag.ndefMessage.length > 0) {
        const record = tag.ndefMessage[0];
        if (record && record.payload) {
          try {
            textContent = Ndef.text.decodePayload(record.payload);
            lockedData = JSON.parse(textContent);
          } catch (e) {
            // Not valid JSON, might be hardware locked
          }
        }
      }

      // Cancel NDEF and try NfcA for hardware unlock
      await NfcManager.cancelTechnologyRequest();

      // Try hardware-based unlock using NfcA (cross-platform)
      const ntagConfig = this.detectNTAGConfig(tag);
      if (ntagConfig) {
        try {
          nfcLogger.logStep(operationId, 'Attempting hardware unlock via NfcA', { config: ntagConfig });

          await NfcManager.requestTechnology(NfcTech.NfcA);

          const passwordBytes = this.passwordToBytes(password);

          // Send PWD_AUTH command (0x1B) + 4 bytes password
          const authCmd = [0x1b, ...passwordBytes];
          nfcLogger.logStep(operationId, 'Sending PWD_AUTH command');

          try {
            const authResponse = await this.nfcATransceive(authCmd);
            nfcLogger.logStep(operationId, 'Authentication successful', { responseLength: authResponse.length });

            // Disable password protection by setting AUTH0 to 0xFF (no protection)
            // CFG0 layout: [MIRROR, RFUI, MIRROR_PAGE, AUTH0]
            // AUTH0=0xFF means no password protection (disabled)
            const writeCfgCmd = [0xa2, ntagConfig.cfgPage, 0x00, 0x00, 0x00, 0xff];
            nfcLogger.logStep(operationId, 'Disabling password protection', { page: ntagConfig.cfgPage });
            await this.nfcATransceive(writeCfgCmd);

            nfcLogger.endOperation(operationId, { success: true, lockType: 'hardware' });
            return {
              success: true,
              lockType: 'hardware',
              data: { message: 'Hardware password protection removed successfully' }
            };

          } catch (authError) {
            const errMsg = (authError as Error).message.toLowerCase();
            if (errMsg.includes('auth') || errMsg.includes('nack') || errMsg.includes('failed')) {
              throw new Error('Incorrect password. Please try again.');
            }
            throw authError;
          }

        } catch (hardwareError) {
          const errMsg = (hardwareError as Error).message;
          nfcLogger.logStep(operationId, 'Hardware unlock failed', { error: errMsg });

          // If it's a password error, don't fall back to software
          if (errMsg.includes('Incorrect password')) {
            throw hardwareError;
          }

          try {
            await NfcManager.cancelTechnologyRequest();
          } catch (e) {
            // Ignore cleanup errors
          }
        }
      }

      // Fallback: Software-based unlock (decrypt NDEF content)
      nfcLogger.logStep(operationId, 'Attempting software-based unlock');

      await NfcManager.requestTechnology(NfcTech.Ndef, Platform.OS === 'ios' ? { timeout } as any : undefined);

      // Re-read tag if needed
      if (!lockedData) {
        const rereadTag = await NfcManager.getTag();
        if (rereadTag?.ndefMessage?.length) {
          const record = rereadTag.ndefMessage[0];
          if (record?.payload) {
            try {
              textContent = Ndef.text.decodePayload(record.payload);
              lockedData = JSON.parse(textContent);
            } catch (e) {
              throw new Error('Could not decode tag content. Tag may not be locked with this system.');
            }
          }
        }
      }

      if (!lockedData?._locked) {
        throw new Error('This tag does not appear to be software-locked.');
      }

      nfcLogger.logStep(operationId, 'Found software-locked data');

      // Decrypt the original content
      let originalContent = '';
      if (lockedData._hasContent && lockedData._encryptedContent) {
        try {
          originalContent = this.decryptContent(lockedData._encryptedContent, password);

          // Verify decryption worked
          if (originalContent.includes('\0') || originalContent.length === 0) {
            throw new Error('Incorrect password');
          }
        } catch (decryptError) {
          throw new Error('Incorrect password. Could not decrypt content.');
        }
      }

      // Write the decrypted content back to the tag
      const bytes = originalContent
        ? Ndef.encodeMessage([Ndef.textRecord(originalContent)])
        : Ndef.encodeMessage([Ndef.textRecord('{}')]);

      if (Platform.OS === 'ios') {
        let writeAttempts = 0;
        const maxAttempts = 3;

        while (writeAttempts < maxAttempts) {
          try {
            await NfcManager.ndefHandler.writeNdefMessage(bytes);
            nfcLogger.logStep(operationId, 'iOS software unlock completed', { attempt: writeAttempts + 1 });
            break;
          } catch (iosWriteError) {
            writeAttempts++;
            if (writeAttempts >= maxAttempts) {
              throw iosWriteError;
            }
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      } else {
        await NfcManager.ndefHandler.writeNdefMessage(bytes);
        nfcLogger.logStep(operationId, 'Android software unlock completed');
      }

      nfcLogger.endOperation(operationId, { success: true, lockType: 'software' });
      return {
        success: true,
        lockType: 'software',
        data: {
          message: 'Tag unlocked successfully',
          restoredContent: originalContent || 'No content was stored'
        }
      };

    } catch (error) {
      const errorCategory = nfcLogger.categorizeError(error as Error);
      nfcLogger.endOperationWithError(operationId, error as Error, errorCategory);

      let userErrorMessage: string;
      const errorMessage = (error as Error).message;

      if (errorMessage.includes('NFC hardware') || errorMessage.includes('not available')) {
        userErrorMessage = 'NFC is not available or is disabled on this device.';
      } else if (errorMessage.includes('cancelled')) {
        userErrorMessage = 'NFC operation was cancelled.';
      } else if (errorMessage.includes('Incorrect password')) {
        userErrorMessage = 'Incorrect password. Please try again.';
      } else if (errorMessage.includes('not locked') || errorMessage.includes('not software-locked')) {
        userErrorMessage = 'This tag does not appear to be locked.';
      } else if (errorMessage.includes('Password is required')) {
        userErrorMessage = errorMessage;
      } else {
        userErrorMessage = `Failed to unlock NFC tag: ${errorMessage}`;
      }

      return { success: false, error: userErrorMessage };
    } finally {
      try {
        await NfcManager.cancelTechnologyRequest();
        nfcLogger.logStep(operationId, 'NFC technology request canceled');
      } catch (finallyError) {
        // Silent cleanup
      }
    }
  }

  /**
   * Check if a tag is locked
   */
  public async isTagLocked(): Promise<NFCOperationResult & { locked: boolean; lockType?: string }> {
    // Simulator check temporarily disabled for testing
    // if (nfcSimulator.shouldUseSimulator()) {
    //   return nfcSimulator.isTagLocked();
    // }

    try {
      console.log('[NFCSecurityService] Checking if tag is locked');
      
      // Use the main NFC service to read the tag
      const readResult = await nfcService.readNFC();
      
      if (!readResult.success) {
        return { 
          success: false, 
          locked: false, 
          error: readResult.error || 'Could not read tag'
        };
      }

      // Check if the content indicates a locked tag
      let isLocked = false;
      let lockType = 'unknown';

      if (readResult.data?.parsedData) {
        const data = readResult.data.parsedData;
        if (data._locked === true) {
          isLocked = true;
          lockType = 'software';
        }
      }

      return {
        success: true,
        locked: isLocked,
        lockType: lockType,
        data: readResult.data
      };

    } catch (error) {
      console.error('[NFCSecurityService] Error checking lock status:', error);
      return { 
        success: false, 
        locked: false, 
        error: (error as Error).message 
      };
    }
  }
}

// Export singleton instance
export const nfcSecurityService = NFCSecurityService.getInstance();