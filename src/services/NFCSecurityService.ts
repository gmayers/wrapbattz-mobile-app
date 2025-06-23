// src/services/NFCSecurityService.ts - NFC Lock/Unlock functionality for NDEF tags
import { Platform, Alert } from 'react-native';
import NfcManager, { NfcTech, Ndef } from 'react-native-nfc-manager';
import { NFCOperationResult } from '../types/nfc';
import { nfcService } from './NFCService';

export interface NFCSecurityResult extends NFCOperationResult {
  lockType?: 'hardware' | 'software';
}

export class NFCSecurityService {
  private static instance: NFCSecurityService;

  private constructor() {}

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
   * Lock an NDEF tag with password protection
   */
  public async lockTag(password: string): Promise<NFCSecurityResult> {
    try {
      console.log('[NFCSecurityService] Starting tag lock operation');
      
      if (!password || password.length < 4) {
        throw new Error('Password must be at least 4 characters long');
      }

      // Ensure NFC is initialized
      if (!await nfcService.initialize()) {
        throw new Error('NFC is not available or could not be initialized');
      }

      // Request NFC technology with platform-specific timeout
      const timeout = Platform.OS === 'ios' ? 60000 : 30000;
      const technologyRequest = Platform.OS === 'ios' 
        ? NfcManager.requestTechnology(NfcTech.Ndef, { timeout } as any)
        : NfcManager.requestTechnology(NfcTech.Ndef);
      
      await technologyRequest;
      console.log('[NFCSecurityService] NFC technology requested successfully');
      
      // Get tag information
      const tag = await NfcManager.getTag();
      
      if (!tag) {
        throw new Error('No NFC tag detected. Please position the tag correctly.');
      }

      console.log(`[NFCSecurityService] Tag detected: ${JSON.stringify({
        type: tag.type || 'unknown',
        techTypes: tag.techTypes || [],
        isWritable: (tag as any).isWritable || false
      })}`);

      // Check if tag is writable
      if (!(tag as any).isWritable) {
        throw new Error('This tag appears to be read-only and cannot be locked.');
      }

      // Try hardware-based protection first for NTAG tags
      if (tag.techTypes && tag.techTypes.some((tech: string) => 
          tech.includes('MifareUltralight') || tech.includes('NTAG'))) {
        
        try {
          console.log('[NFCSecurityService] Attempting hardware-based lock for NTAG tag');
          
          // Cancel current NDEF technology request
          await NfcManager.cancelTechnologyRequest();
          
          // Request MifareUltralight technology for direct commands
          await NfcManager.requestTechnology(NfcTech.MifareUltralight);
          
          const passwordBytes = this.passwordToBytes(password);
          
          // Set password in PWD (page 43, 0x2B) and PACK (page 44, 0x2C)
          const pwdPage = [passwordBytes[0], passwordBytes[1], passwordBytes[2], passwordBytes[3]];
          const packPage = [0x00, 0x00, 0x00, 0x00]; // PACK response
          
          // Write PWD page (0x2B = 43)
          await (NfcManager as any).mifareUltralightHandlerAndroid.mifareUltralightWritePage(43, pwdPage);
          
          // Write PACK page (0x2C = 44) 
          await (NfcManager as any).mifareUltralightHandlerAndroid.mifareUltralightWritePage(44, packPage);
          
          // Set AUTH0 to enable password protection from page 4 onwards
          // Configuration page (0x29 = 41)
          const configPage = [
            0x04, // AUTH0: start password protection from page 4
            0x00, // ACCESS: no access restrictions
            0x00, // Reserved
            0x00  // Reserved
          ];
          
          await (NfcManager as any).mifareUltralightHandlerAndroid.mifareUltralightWritePage(41, configPage);
          
          console.log('[NFCSecurityService] Hardware lock completed successfully');
          return { 
            success: true, 
            lockType: 'hardware',
            data: { message: 'Tag locked with hardware password protection' }
          };
          
        } catch (hardwareError) {
          console.warn('[NFCSecurityService] Hardware lock failed, trying software approach:', hardwareError);
          
          // Cancel MifareUltralight and go back to NDEF
          await NfcManager.cancelTechnologyRequest();
          await NfcManager.requestTechnology(NfcTech.Ndef);
        }
      }

      // Software-based protection (modify NDEF content)
      console.log('[NFCSecurityService] Applying software-based lock');
      
      // Read existing content
      let existingContent = '';
      try {
        if (tag.ndefMessage && tag.ndefMessage.length > 0) {
          const record = tag.ndefMessage[0];
          if (record && record.payload) {
            existingContent = Ndef.text.decodePayload(record.payload);
          }
        }
      } catch (readError) {
        console.warn('[NFCSecurityService] Could not read existing content:', readError);
        existingContent = '';
      }

      // Create locked data structure
      const lockedData = {
        _locked: true,
        _timestamp: new Date().toISOString(),
        _hint: 'This tag is password protected',
        _encryptedContent: existingContent ? this.encryptContent(existingContent, password) : '',
        _hasContent: existingContent.length > 0
      };

      const jsonString = JSON.stringify(lockedData);

      // Write the locked data
      const bytes = Ndef.encodeMessage([Ndef.textRecord(jsonString)]);
      
      if (Platform.OS === 'ios') {
        // iOS-specific write with retry mechanism
        let writeAttempts = 0;
        const maxAttempts = 3;
        
        while (writeAttempts < maxAttempts) {
          try {
            await NfcManager.ndefHandler.writeNdefMessage(bytes);
            console.log(`[NFCSecurityService] iOS software lock completed on attempt ${writeAttempts + 1}`);
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
        // Android write
        await NfcManager.ndefHandler.writeNdefMessage(bytes);
        console.log('[NFCSecurityService] Android software lock completed');
      }

      return { 
        success: true, 
        lockType: 'software',
        data: { message: 'Tag locked with encrypted content protection' }
      };

    } catch (error) {
      console.error('[NFCSecurityService] Error in lockTag:', error);
      
      // Create user-friendly error message
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
      // Always cancel technology request when done
      try {
        await NfcManager.cancelTechnologyRequest();
        console.log('[NFCSecurityService] NFC technology request canceled');
      } catch (finallyError) {
        console.warn(`[NFCSecurityService] Error canceling technology request: ${(finallyError as Error).message}`);
      }
    }
  }

  /**
   * Unlock an NDEF tag by removing password protection
   */
  public async unlockTag(password: string): Promise<NFCSecurityResult> {
    try {
      console.log('[NFCSecurityService] Starting tag unlock operation');
      
      if (!password) {
        throw new Error('Password is required to unlock the tag');
      }

      // Ensure NFC is initialized
      if (!await nfcService.initialize()) {
        throw new Error('NFC is not available or could not be initialized');
      }

      // Request NFC technology
      const timeout = Platform.OS === 'ios' ? 60000 : 30000;
      const technologyRequest = Platform.OS === 'ios' 
        ? NfcManager.requestTechnology(NfcTech.Ndef, { timeout } as any)
        : NfcManager.requestTechnology(NfcTech.Ndef);
      
      await technologyRequest;
      console.log('[NFCSecurityService] NFC technology requested successfully');
      
      // Get tag information
      const tag = await NfcManager.getTag();
      
      if (!tag) {
        throw new Error('No NFC tag detected. Please position the tag correctly.');
      }

      // Check if tag has NDEF message
      if (!tag.ndefMessage || !tag.ndefMessage.length) {
        throw new Error('No NDEF message found on tag or tag is not locked.');
      }

      // Try hardware unlock first for NTAG tags
      if (tag.techTypes && tag.techTypes.some((tech: string) => 
          tech.includes('MifareUltralight') || tech.includes('NTAG'))) {
        
        try {
          console.log('[NFCSecurityService] Attempting hardware unlock for NTAG tag');
          
          // Cancel NDEF and switch to MifareUltralight
          await NfcManager.cancelTechnologyRequest();
          await NfcManager.requestTechnology(NfcTech.MifareUltralight);
          
          const passwordBytes = this.passwordToBytes(password);
          
          // Send PWD_AUTH command (0x1B) to authenticate
          const authResponse = await (NfcManager as any).mifareUltralightHandlerAndroid
            .mifareUltralightTransceive([0x1B, ...passwordBytes]);
          
          // If we get here, authentication succeeded
          console.log('[NFCSecurityService] Hardware authentication successful');
          
          // Disable password protection by setting AUTH0 to 0xFF
          const configPage = [
            0xFF, // AUTH0: disable password protection
            0x00, // ACCESS: no access restrictions  
            0x00, // Reserved
            0x00  // Reserved
          ];
          
          await (NfcManager as any).mifareUltralightHandlerAndroid.mifareUltralightWritePage(41, configPage);
          
          console.log('[NFCSecurityService] Hardware unlock completed successfully');
          return { 
            success: true, 
            lockType: 'hardware',
            data: { message: 'Hardware password protection removed successfully' }
          };
          
        } catch (hardwareError) {
          console.warn('[NFCSecurityService] Hardware unlock failed:', hardwareError);
          
          if (hardwareError.message && hardwareError.message.toLowerCase().includes('auth')) {
            throw new Error('Incorrect password. Please try again.');
          }
          
          // Try software approach
          await NfcManager.cancelTechnologyRequest();
          await NfcManager.requestTechnology(NfcTech.Ndef);
        }
      }

      // Software-based unlock (decrypt NDEF content)
      console.log('[NFCSecurityService] Attempting software unlock');
      
      const record = tag.ndefMessage[0];
      if (!record || !record.payload) {
        throw new Error('Invalid NDEF record format on tag.');
      }

      // Decode the content
      let textContent: string;
      try {
        textContent = Ndef.text.decodePayload(record.payload);
      } catch (decodeError) {
        throw new Error('Could not decode tag content. Tag may not be locked with this system.');
      }

      // Check if it's our locked format
      let lockedData: any;
      try {
        lockedData = JSON.parse(textContent);
      } catch (parseError) {
        throw new Error('Tag does not contain valid locked data format.');
      }

      if (!lockedData._locked) {
        throw new Error('This tag does not appear to be locked.');
      }

      // Decrypt the original content
      let originalContent = '';
      if (lockedData._hasContent && lockedData._encryptedContent) {
        try {
          originalContent = this.decryptContent(lockedData._encryptedContent, password);
          
          // Verify decryption worked by checking if result is valid
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
        : Ndef.encodeMessage([Ndef.textRecord('{}')]); // Empty JSON if no content
      
      if (Platform.OS === 'ios') {
        // iOS-specific write with retry mechanism
        let writeAttempts = 0;
        const maxAttempts = 3;
        
        while (writeAttempts < maxAttempts) {
          try {
            await NfcManager.ndefHandler.writeNdefMessage(bytes);
            console.log(`[NFCSecurityService] iOS software unlock completed on attempt ${writeAttempts + 1}`);
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
        // Android write
        await NfcManager.ndefHandler.writeNdefMessage(bytes);
        console.log('[NFCSecurityService] Android software unlock completed');
      }

      return { 
        success: true, 
        lockType: 'software',
        data: { 
          message: 'Tag unlocked successfully',
          restoredContent: originalContent || 'No content was stored'
        }
      };

    } catch (error) {
      console.error('[NFCSecurityService] Error in unlockTag:', error);
      
      // Create user-friendly error message
      let userErrorMessage: string;
      const errorMessage = (error as Error).message;
      
      if (errorMessage.includes('NFC hardware') || errorMessage.includes('not available')) {
        userErrorMessage = 'NFC is not available or is disabled on this device.';
      } else if (errorMessage.includes('cancelled')) {
        userErrorMessage = 'NFC operation was cancelled.';
      } else if (errorMessage.includes('Incorrect password')) {
        userErrorMessage = 'Incorrect password. Please try again.';
      } else if (errorMessage.includes('not locked')) {
        userErrorMessage = 'This tag does not appear to be locked.';
      } else if (errorMessage.includes('Password is required')) {
        userErrorMessage = errorMessage;
      } else {
        userErrorMessage = `Failed to unlock NFC tag: ${errorMessage}`;
      }
      
      return { success: false, error: userErrorMessage };
    } finally {
      // Always cancel technology request when done
      try {
        await NfcManager.cancelTechnologyRequest();
        console.log('[NFCSecurityService] NFC technology request canceled');
      } catch (finallyError) {
        console.warn(`[NFCSecurityService] Error canceling technology request: ${(finallyError as Error).message}`);
      }
    }
  }

  /**
   * Check if a tag is locked
   */
  public async isTagLocked(): Promise<NFCOperationResult & { locked: boolean; lockType?: string }> {
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