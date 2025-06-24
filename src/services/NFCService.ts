// src/services/NFCService.ts - Unified NFC Service for iOS and Android
import { Platform, Alert } from 'react-native';
import NfcManager, { NfcTech, Ndef } from 'react-native-nfc-manager';
import { NFCTagData, NFCOperationResult, DeviceNFCData, NFCWriteOptions, NFCReadOptions } from '../types/nfc';

export class NFCService {
  private static instance: NFCService;
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): NFCService {
    if (!NFCService.instance) {
      NFCService.instance = new NFCService();
    }
    return NFCService.instance;
  }

  /**
   * Initialize NFC Manager
   */
  public async initialize(): Promise<boolean> {
    try {
      if (this.isInitialized) return true;
      
      const isSupported = await NfcManager.isSupported();
      if (!isSupported) {
        console.warn('[NFCService] NFC is not supported on this device');
        return false;
      }

      await NfcManager.start();
      this.isInitialized = true;
      console.log('[NFCService] NFC Manager initialized successfully');
      return true;
    } catch (error) {
      console.error('[NFCService] Failed to initialize NFC:', error);
      return false;
    }
  }

  /**
   * Check if NFC is available and enabled
   */
  public async isAvailable(): Promise<boolean> {
    try {
      const isSupported = await NfcManager.isSupported();
      const isEnabled = await NfcManager.isEnabled();
      return isSupported && isEnabled;
    } catch (error) {
      console.error('[NFCService] Error checking NFC availability:', error);
      return false;
    }
  }

  /**
   * Validate if a tag is NDEF formatted and compatible
   */
  private async validateNDEFTag(tag: any): Promise<{ isValid: boolean; error?: string }> {
    try {
      // Check if tag has NDEF message structure
      if (!tag.ndefMessage) {
        return { 
          isValid: false, 
          error: 'Tag is not NDEF formatted. Please use an NDEF-compatible tag.' 
        };
      }

      // Check for supported tag types - focus on NDEF-compatible tags
      const tagType = tag.type?.toLowerCase() || '';
      const techTypes = tag.techTypes || [];
      
      // NDEF-supported tag types
      const supportedTypes = [
        'mifare_ultralight', 'ntag', 'type1', 'type2', 'type3', 'type4',
        'iso14443_3a', 'iso14443_4', 'nfca', 'isodep'
      ];
      
      const isNDEFCompatible = supportedTypes.some(type => 
        tagType.includes(type) || 
        techTypes.some((tech: string) => tech.toLowerCase().includes(type))
      );

      if (!isNDEFCompatible) {
        console.warn('[NFCService] Tag type may not be fully NDEF compatible:', { tagType, techTypes });
        // Don't fail here, just warn - many tags work even if type detection is imperfect
      }

      // Check tag capacity if available
      if (tag.maxSize && tag.maxSize < 48) {
        return { 
          isValid: false, 
          error: 'Tag capacity is too small for NDEF operations (minimum 48 bytes required).' 
        };
      }

      // For write operations, check if tag is writable
      if (tag.hasOwnProperty('isWritable') && tag.isWritable === false) {
        console.warn('[NFCService] Tag appears to be read-only');
        // Don't fail here for read operations
      }

      return { isValid: true };
    } catch (error) {
      console.error('[NFCService] Error validating NDEF tag:', error);
      return { 
        isValid: false, 
        error: 'Could not validate tag format. Tag may be incompatible.' 
      };
    }
  }

  /**
   * Enhanced tag detection with NDEF validation
   */
  private async detectAndValidateTag(): Promise<{ tag: any; isValid: boolean; error?: string }> {
    try {
      const tag = await NfcManager.getTag();
      
      if (!tag) {
        return { 
          tag: null, 
          isValid: false, 
          error: 'No NFC tag detected. Please position the tag correctly near your device.' 
        };
      }
      
      console.log(`[NFCService] Tag detected: ${JSON.stringify({
        type: tag.type || 'unknown',
        maxSize: tag.maxSize || 'unknown',
        isWritable: tag.isWritable || false,
        id: tag.id ? tag.id.toString('hex') : 'unknown',
        techTypes: tag.techTypes || []
      })}`);
      
      // Validate NDEF compatibility
      const validation = await this.validateNDEFTag(tag);
      
      return { 
        tag, 
        isValid: validation.isValid, 
        error: validation.error 
      };
    } catch (error) {
      console.error('[NFCService] Error detecting tag:', error);
      return { 
        tag: null, 
        isValid: false, 
        error: 'Failed to detect NFC tag. Please try again.' 
      };
    }
  }

  /**
   * Normalize JSON string from NFC tag
   */
  private normalizeJsonString(jsonString: string): string {
    // Replace fancy quotes with standard quotes
    let normalized = jsonString
      .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')  // Replace various fancy double quotes
      .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'"); // Replace various fancy single quotes
    
    // Remove any control characters
    normalized = normalized.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
    
    // Fix any malformed JSON that might have occurred from improper encoding
    try {
      // Test if it's valid after normalization
      JSON.parse(normalized);
      return normalized;
    } catch (e) {
      // Further repairs for common issues
      
      // Replace unquoted property names - find words followed by colon
      normalized = normalized.replace(/(\s*)(\w+)(\s*):(\s*)/g, (match, before, word, middle, after) => {
        // Don't replace if it's already part of a properly quoted structure
        if ((/"\w+"(\s*):/.test(match) || /'?\w+'?(\s*):/.test(match))) {
          return match;
        }
        return `${before}"${word}"${middle}:${after}`;
      });
      
      return normalized;
    }
  }

  /**
   * Check if a string looks like JSON
   */
  private isLikelyJSON(value: string): boolean {
    if (typeof value !== 'string') return false;
    const trimmed = value.trim();
    return (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) || 
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    );
  }

  /**
   * Decode tag content with multiple approaches
   */
  private decodeTagContent(record: any): string {
    // Try standard NDEF text decoding first
    try {
      return Ndef.text.decodePayload(record.payload);
    } catch (e) {
      console.warn('[NFCService] Standard NDEF decoding failed, trying alternative methods');
    }
    
    // Manual decoding as fallback
    try {
      // Get a byte array from the payload
      const bytes = [...new Uint8Array(record.payload)];
      
      // First byte contains status and language length
      const statusByte = bytes[0];
      const languageLength = statusByte & 0x3F;
      const isUTF16 = !(statusByte & 0x80);
      
      // Skip language code and status byte
      const textBytes = bytes.slice(1 + languageLength);
      
      // Convert to string based on encoding
      if (isUTF16) {
        // UTF-16 encoding
        const uint16Array = new Uint16Array(textBytes.length / 2);
        for (let i = 0; i < textBytes.length; i += 2) {
          uint16Array[i / 2] = (textBytes[i] << 8) | textBytes[i + 1];
        }
        return String.fromCharCode.apply(null, Array.from(uint16Array));
      } else {
        // UTF-8 encoding
        return new TextDecoder().decode(new Uint8Array(textBytes));
      }
    } catch (manualError) {
      console.warn('[NFCService] Manual decoding failed, trying TextDecoder directly');
    }
    
    // Direct TextDecoder fallback
    try {
      const rawBytes = new Uint8Array(record.payload);
      const statusByte = rawBytes[0];
      const languageLength = statusByte & 0x3F;
      
      // Skip status byte and language code
      const contentBytes = rawBytes.slice(1 + languageLength);
      return new TextDecoder().decode(contentBytes);
    } catch (decoderError) {
      console.warn('[NFCService] All decoding methods failed');
      throw new Error('Unable to decode tag content using any available method');
    }
  }

  /**
   * Enhanced retry mechanism for NFC operations
   */
  private async withRetry<T>(
    operation: () => Promise<T>, 
    maxAttempts: number = 3, 
    delay: number = 500
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        console.warn(`[NFCService] Attempt ${attempt}/${maxAttempts} failed:`, error);
        
        if (attempt < maxAttempts) {
          // Don't retry on user cancellation or hardware issues
          if (lastError.message.includes('cancelled') || 
              lastError.message.includes('not available') ||
              lastError.message.includes('disabled')) {
            throw lastError;
          }
          
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError!;
  }

  /**
   * Read NFC tag and return JSON string
   */
  public async readNFC(options: NFCReadOptions = {}): Promise<NFCOperationResult> {
    const maxAttempts = Platform.OS === 'ios' ? 3 : 2; // iOS benefits more from retries
    
    return this.withRetry(async () => {
      try {
        console.log('[NFCService] Starting NFC read operation');
        
        // Ensure NFC is initialized
        if (!await this.initialize()) {
          throw new Error('NFC is not available or could not be initialized');
        }

        // iOS-specific: Ensure NFC is properly initialized
        if (Platform.OS === 'ios') {
          try {
            await NfcManager.start();
            console.log('[NFCService] NFC Manager started for iOS');
          } catch (startError) {
            console.warn('[NFCService] NFC Manager already started or error:', startError);
          }
        }

        // Request Technology with platform-specific timeout
        const timeout = options.timeout || (Platform.OS === 'ios' ? 60000 : 30000);
        const technologyRequest = Platform.OS === 'ios' 
          ? NfcManager.requestTechnology(NfcTech.Ndef, { timeout } as any)
          : NfcManager.requestTechnology(NfcTech.Ndef);
        
        await technologyRequest;
        console.log('[NFCService] NFC technology requested successfully');
        
        // Detect and validate tag with enhanced validation
        const { tag, isValid, error } = await this.detectAndValidateTag();
        
        if (!isValid || !tag) {
          throw new Error(error || 'Invalid or incompatible NFC tag detected.');
        }
        
        // Additional check for NDEF message
        if (!tag.ndefMessage || !tag.ndefMessage.length) {
          throw new Error('No NDEF message found on tag. This may not be an NDEF formatted tag or it may be empty.');
        }
        
        // Process first NDEF record
        const record = tag.ndefMessage[0];
        
        if (record && record.payload) {
          try {
            // Try multiple decoding approaches to maximize success
            const textContent = this.decodeTagContent(record);
            
            if (textContent) {
              console.log('[NFCService] Successfully decoded tag content');
              
              // Process the content based on its format
              if (this.isLikelyJSON(textContent)) {
                try {
                  // Normalize and validate JSON
                  const cleanJson = this.normalizeJsonString(textContent.trim());
                  const jsonData = JSON.parse(cleanJson);
                  
                  // Return the JSON string directly
                  return { 
                    success: true, 
                    data: { jsonString: cleanJson, parsedData: jsonData }
                  };
                } catch (jsonError) {
                  console.warn('[NFCService] JSON processing error:', jsonError);
                  return { success: true, data: { content: textContent } };
                }
              } else {
                // Not JSON format, just use the text content
                return { success: true, data: { content: textContent } };
              }
            } else {
              throw new Error('Failed to decode tag content. The format may be unsupported.');
            }
          } catch (decodeError) {
            console.error('[NFCService] Decode error:', decodeError);
            throw new Error(`Failed to decode tag content: ${(decodeError as Error).message}`);
          }
        } else {
          throw new Error('Tag contains an invalid or empty NDEF record.');
        }
      } catch (error) {
        console.error('[NFCService] Error in readNFC:', error);
        
        // Create user-friendly error message based on error type
        let userErrorMessage: string;
        const errorMessage = (error as Error).message;
        
        if (errorMessage.includes('NFC hardware') || errorMessage.includes('not available')) {
          userErrorMessage = 'NFC is not available or is disabled on this device. Please check your device settings.';
        } else if (errorMessage.includes('cancelled')) {
          userErrorMessage = 'NFC operation was cancelled.';
        } else if (errorMessage.includes('No NFC tag detected')) {
          userErrorMessage = 'No NFC tag detected. Please make sure the tag is positioned correctly near your device.';
        } else if (errorMessage.includes('No NDEF message')) {
          userErrorMessage = 'This tag may not be NDEF formatted or may be empty. Please format the tag or try a different one.';
        } else if (errorMessage.includes('decode')) {
          userErrorMessage = 'Could not read tag content. The tag format may be incompatible or corrupted.';
        } else {
          userErrorMessage = `Error reading NFC tag: ${errorMessage}`;
        }
        
        return { success: false, error: userErrorMessage };
      } finally {
        // Always cancel technology request when done
        try {
          await NfcManager.cancelTechnologyRequest();
          console.log('[NFCService] NFC technology request canceled');
        } catch (finallyError) {
          console.warn(`[NFCService] Error canceling NFC technology request: ${(finallyError as Error).message}`);
        }
      }
    }, maxAttempts);
  }

  /**
   * Write JSON string to NFC tag
   */
  public async writeNFC(jsonString: string, options: NFCWriteOptions = {}): Promise<NFCOperationResult> {
    const maxAttempts = Platform.OS === 'ios' ? 3 : 2; // iOS benefits more from retries
    
    return this.withRetry(async () => {
      try {
        console.log('[NFCService] Starting NFC write operation with JSON:', jsonString);
        
        // Ensure NFC is initialized
        if (!await this.initialize()) {
          throw new Error('NFC is not available or could not be initialized');
        }

      // Validate JSON string
      try {
        JSON.parse(jsonString);
      } catch (jsonError) {
        throw new Error('Invalid JSON string provided for writing to NFC tag');
      }

      // Normalize the JSON string
      const normalizedString = this.normalizeJsonString(jsonString);
      
      // Calculate byte length for capacity check
      const stringByteLength = new TextEncoder().encode(normalizedString).length;
      console.log(`[NFCService] Data size: ${stringByteLength} bytes`);

      // iOS-specific: Ensure NFC is properly initialized
      if (Platform.OS === 'ios') {
        try {
          await NfcManager.start();
          console.log('[NFCService] NFC Manager started for iOS');
        } catch (startError) {
          console.warn('[NFCService] NFC Manager already started or error:', startError);
        }
      }

      // Request NFC technology with platform-specific timeout
      const timeout = options.timeout || (Platform.OS === 'ios' ? 60000 : 30000);
      const technologyRequest = Platform.OS === 'ios' 
        ? NfcManager.requestTechnology(NfcTech.Ndef, { timeout } as any)
        : NfcManager.requestTechnology(NfcTech.Ndef);
      
      await technologyRequest;
      console.log('[NFCService] NFC technology requested successfully');
      
      // Detect and validate tag with enhanced validation
      const { tag, isValid, error } = await this.detectAndValidateTag();
      
      if (!isValid || !tag) {
        throw new Error(error || 'Invalid or incompatible NFC tag detected.');
      }
      
      // For write operations, ensure tag is writable
      if (tag.hasOwnProperty('isWritable') && tag.isWritable === false) {
        throw new Error('This tag appears to be read-only and cannot be written to.');
      }
      
      // Check capacity if available
      if (tag.maxSize && stringByteLength > tag.maxSize) {
        throw new Error(`Data size (${stringByteLength} bytes) exceeds tag capacity (${tag.maxSize} bytes).`);
      }

      // Handle merge option
      let finalJsonString = normalizedString;
      if (options.merge && tag.ndefMessage && tag.ndefMessage.length > 0) {
        try {
          const existingContent = this.decodeTagContent(tag.ndefMessage[0]);
          if (this.isLikelyJSON(existingContent)) {
            const existingData = JSON.parse(this.normalizeJsonString(existingContent));
            const newData = JSON.parse(normalizedString);
            const mergedData = { ...existingData, ...newData };
            finalJsonString = JSON.stringify(mergedData);
            console.log('[NFCService] Merged with existing data');
          }
        } catch (mergeError) {
          console.warn('[NFCService] Could not merge with existing data, writing new data only');
        }
      }
      
      // Create NDEF message bytes
      let bytes: number[];
      try {
        bytes = Ndef.encodeMessage([Ndef.textRecord(finalJsonString)]);
        console.log('[NFCService] NDEF message encoded successfully');
      } catch (encodeError) {
        throw new Error(`Failed to encode data: ${(encodeError as Error).message}`);
      }
      
      if (!bytes) {
        throw new Error('Failed to create NDEF message. The encoding returned null.');
      }
      
      // Final size check
      if (tag.maxSize && bytes.length > tag.maxSize) {
        throw new Error(`Encoded message size (${bytes.length} bytes) exceeds tag capacity (${tag.maxSize} bytes).`);
      }
      
      // Write the message to the tag with platform-specific handling
      if (Platform.OS === 'ios') {
        // iOS-specific write with retry mechanism
        let writeAttempts = 0;
        const maxAttempts = 3;
        
        while (writeAttempts < maxAttempts) {
          try {
            await NfcManager.ndefHandler.writeNdefMessage(bytes);
            console.log(`[NFCService] iOS write operation completed successfully on attempt ${writeAttempts + 1}`);
            break;
          } catch (iosWriteError) {
            writeAttempts++;
            console.warn(`[NFCService] iOS write attempt ${writeAttempts} failed:`, iosWriteError);
            
            if (writeAttempts >= maxAttempts) {
              throw iosWriteError;
            }
            
            // Short delay before retry
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      } else {
        // Android write
        await NfcManager.ndefHandler.writeNdefMessage(bytes);
        console.log('[NFCService] Android write operation completed successfully');
      }
        
        return { success: true, data: { jsonString: finalJsonString } };
      } catch (error) {
        console.error('[NFCService] Error in writeNFC:', error);
        
        // Create user-friendly error message based on error type
        let userErrorMessage: string;
        const errorMessage = (error as Error).message;
        
        if (errorMessage.includes('NFC hardware') || errorMessage.includes('not available')) {
          userErrorMessage = 'NFC is not available or is disabled on this device. Please check your device settings.';
        } else if (errorMessage.includes('cancelled')) {
          userErrorMessage = 'NFC operation was cancelled.';
        } else if (errorMessage.includes('Invalid JSON')) {
          userErrorMessage = 'Invalid data format provided for writing to NFC tag.';
        } else if (errorMessage.includes('tag capacity')) {
          userErrorMessage = errorMessage; // Already formatted for user
        } else if (errorMessage.includes('timeout')) {
          userErrorMessage = 'The tag was not held close enough to the device. Please try again and keep the tag steady.';
        } else if (errorMessage.includes('not writable') || errorMessage.includes('read-only')) {
          userErrorMessage = 'This tag cannot be written to. Please use a writable NFC tag.';
        } else if (errorMessage.includes('Tag connection lost')) {
          userErrorMessage = 'Tag connection lost. Please try again and keep the tag steady.';
        } else {
          userErrorMessage = `Failed to write to NFC tag: ${errorMessage}`;
        }
        
        return { success: false, error: userErrorMessage };
      } finally {
        // Always cancel technology request when done
        try {
          await NfcManager.cancelTechnologyRequest();
          console.log('[NFCService] NFC technology request canceled');
        } catch (finallyError) {
          console.warn(`[NFCService] Error canceling NFC technology request: ${(finallyError as Error).message}`);
        }
      }
    }, maxAttempts);
  }

  /**
   * Write device data to NFC tag (for Add Device functionality)
   */
  public async writeDeviceToNFC(deviceData: DeviceNFCData, options: NFCWriteOptions = {}): Promise<NFCOperationResult> {
    try {
      // Create JSON string with only the specified fields
      const deviceJson = JSON.stringify({
        deviceId: deviceData.deviceId,
        make: deviceData.make,
        model: deviceData.model,
        serialNumber: deviceData.serialNumber,
        maintenanceInterval: deviceData.maintenanceInterval,
        description: deviceData.description
      });
      
      console.log('[NFCService] Writing device data to NFC:', deviceJson);
      return await this.writeNFC(deviceJson, options);
    } catch (error) {
      console.error('[NFCService] Error writing device data to NFC:', error);
      return { success: false, error: `Failed to write device data: ${(error as Error).message}` };
    }
  }

  /**
   * Cancel any ongoing NFC operation
   */
  public async cancelOperation(): Promise<void> {
    try {
      await NfcManager.cancelTechnologyRequest();
      console.log('[NFCService] NFC operation cancelled');
    } catch (error) {
      console.warn('[NFCService] Error cancelling NFC operation:', error);
    }
  }

  /**
   * Clean up and close NFC Manager
   */
  public async cleanup(): Promise<void> {
    try {
      await this.cancelOperation();
      await NfcManager.unregisterTagEvent();
      this.isInitialized = false;
      console.log('[NFCService] NFC Manager cleaned up');
    } catch (error) {
      console.warn('[NFCService] Error during cleanup:', error);
    }
  }
}

// Export singleton instance
export const nfcService = NFCService.getInstance();