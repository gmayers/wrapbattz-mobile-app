// src/utils/NFCUtils.ts - Unified NFC utilities
import { Platform, Alert } from 'react-native';
import NfcManager, { NfcTech, Ndef } from 'react-native-nfc-manager';
import { NFCTagData, NFCOperationResult } from '../types';

export class NFCUtils {
  private static instance: NFCUtils;
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): NFCUtils {
    if (!NFCUtils.instance) {
      NFCUtils.instance = new NFCUtils();
    }
    return NFCUtils.instance;
  }

  /**
   * Initialize NFC Manager
   */
  public async initialize(): Promise<boolean> {
    try {
      if (this.isInitialized) return true;
      
      const isSupported = await NfcManager.isSupported();
      if (!isSupported) {
        console.warn('[NFCUtils] NFC is not supported on this device');
        return false;
      }

      await NfcManager.start();
      this.isInitialized = true;
      console.log('[NFCUtils] NFC Manager initialized successfully');
      return true;
    } catch (error) {
      console.error('[NFCUtils] Failed to initialize NFC:', error);
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
      console.error('[NFCUtils] Error checking NFC availability:', error);
      return false;
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
      
      // Try to fix dangling quote issues
      let quoteCount = 0;
      for (let i = 0; i < normalized.length; i++) {
        if (normalized[i] === '"' && (i === 0 || normalized[i-1] !== '\\')) {
          quoteCount++;
        }
      }
      
      if (quoteCount % 2 !== 0) {
        console.log("[NFCUtils] Detected unbalanced quotes, attempting fix");
        
        // Add a closing quote before any commas or closing braces
        normalized = normalized.replace(/([^"\s,{}[\]]+)(\s*)(,|\}|\])/g, '$1"$2$3');
        
        // Fix any values that should start with a quote but don't
        normalized = normalized.replace(/:(\s*)([^"\s,{}[\]][^,{}[\]]*)/g, ':$1"$2"');
      }
      
      return normalized;
    }
  }

  /**
   * Validate JSON string
   */
  private validateJSON(jsonString: string): { valid: boolean; error: string | null } {
    try {
      JSON.parse(jsonString);
      return { valid: true, error: null };
    } catch (e) {
      return { valid: false, error: (e as Error).message };
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
      console.warn('[NFCUtils] Standard NDEF decoding failed, trying alternative methods');
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
      console.warn('[NFCUtils] Manual decoding failed, trying TextDecoder directly');
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
      console.warn('[NFCUtils] All decoding methods failed');
      throw new Error('Unable to decode tag content using any available method');
    }
  }

  /**
   * Process JSON tag content with console logging
   */
  private processJsonTagContent(textContent: string): NFCTagData {
    console.log('[NFCUtils] Processing tag JSON content:', textContent);
    
    // Normalize and clean JSON string
    const cleanJson = this.normalizeJsonString(textContent.trim());
    
    // Parse the JSON
    const jsonData = JSON.parse(cleanJson);
    
    // Separate the ID field (if it exists) from other editable fields
    const { id, ...editableData } = jsonData;
    
    // Create a clean object for tagData
    const result: NFCTagData = id ? { id } : {};
    
    // Convert all fields to strings for consistency
    Object.entries(editableData).forEach(([key, value]) => {
      if (typeof value === 'object' && value !== null) {
        // Properly stringify objects
        result[key] = JSON.stringify(value);
      } else {
        // Convert primitives to string
        result[key] = String(value);
      }
    });
    
    return result;
  }

  /**
   * Read NFC tag data
   */
  public async readTag(): Promise<NFCOperationResult> {
    try {
      console.log('[NFCUtils] Starting tag read operation');
      
      // Ensure NFC is initialized
      if (!await this.initialize()) {
        throw new Error('NFC is not available or could not be initialized');
      }
      
      // iOS-specific: Ensure NFC is properly initialized
      if (Platform.OS === 'ios') {
        try {
          await NfcManager.start();
          console.log('[NFCUtils] NFC Manager started for iOS');
        } catch (startError) {
          console.warn('[NFCUtils] NFC Manager already started or error:', startError);
        }
      }
      
      // Request Technology with platform-specific timeout
      const technologyRequest = Platform.OS === 'ios' 
        ? NfcManager.requestTechnology(NfcTech.Ndef, { timeout: 60000 } as any) // 60 seconds for iOS
        : NfcManager.requestTechnology(NfcTech.Ndef);
      
      await technologyRequest;
      console.log('[NFCUtils] NFC technology requested successfully');
      
      // Get tag information
      const tag = await NfcManager.getTag();
      
      if (!tag) {
        throw new Error('No NFC tag detected. Please position the tag correctly.');
      }
      
      console.log(`[NFCUtils] Tag detected: ${JSON.stringify({
        type: tag.type || 'unknown',
        maxSize: tag.maxSize || 'unknown',
        isWritable: (tag as any).isWritable || false,
        id: tag.id ? (tag.id as any).toString('hex') : 'unknown'
      })}`);
      
      // Check for NDEF message
      if (!tag.ndefMessage || !tag.ndefMessage.length) {
        // Try to check if this is a Mifare tag
        if (tag.techTypes && tag.techTypes.some((tech: string) => tech.includes('MifareUltralight'))) {
          console.log('[NFCUtils] Detected Mifare tag, attempting to read');
          try {
            // Cancel the current technology request
            await NfcManager.cancelTechnologyRequest();
            
            // Switch to Mifare technology
            await NfcManager.requestTechnology(NfcTech.MifareUltralight);
            
            // Read Mifare pages
            const mifareData = await this.readMifarePagesWithRetry();
            
            if (mifareData && mifareData.length > 0) {
              console.log('[NFCUtils] Successfully read Mifare tag');
              return { success: true, data: { content: 'Mifare data read successfully' } };
            }
          } catch (mifare_error) {
            console.warn('[NFCUtils] Mifare read failed:', mifare_error);
          }
        }
        
        throw new Error('No NDEF message found on tag. This may not be an NDEF formatted tag or it may be empty.');
      }
      
      // Process first NDEF record
      const record = tag.ndefMessage[0];
      
      if (record && record.payload) {
        try {
          // Try multiple decoding approaches to maximize success
          const textContent = this.decodeTagContent(record);
          
          if (textContent) {
            console.log('[NFCUtils] Successfully decoded tag content');
            
            // Process the content based on its format
            if (this.isLikelyJSON(textContent)) {
              try {
                // Process JSON content
                const jsonData = this.processJsonTagContent(textContent);
                return { success: true, data: jsonData };
              } catch (jsonError) {
                console.warn('[NFCUtils] JSON processing error:', jsonError);
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
          console.error('[NFCUtils] Decode error:', decodeError);
          throw new Error(`Failed to decode tag content: ${(decodeError as Error).message}`);
        }
      } else {
        throw new Error('Tag contains an invalid or empty NDEF record.');
      }
    } catch (error) {
      console.error('[NFCUtils] Error in readTag:', error);
      
      // Create user-friendly error message based on error type
      let userErrorMessage: string;
      const errorMessage = (error as Error).message;
      
      if (errorMessage.includes('NFC hardware')) {
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
        console.log('[NFCUtils] NFC technology request canceled');
      } catch (finallyError) {
        console.warn(`[NFCUtils] Error canceling NFC technology request: ${(finallyError as Error).message}`);
      }
    }
  }

  /**
   * Write data to NFC tag
   */
  public async writeTag(data: NFCTagData): Promise<NFCOperationResult> {
    try {
      console.log('[NFCUtils] Starting tag write operation with data:', data);
      
      // Ensure NFC is initialized
      if (!await this.initialize()) {
        throw new Error('NFC is not available or could not be initialized');
      }
      
      // Check if there are any fields to write
      if (!data || Object.keys(data).length === 0) {
        throw new Error('No data provided to write to the tag.');
      }
      
      // Convert to JSON string with normalized quotes
      const jsonString = JSON.stringify(data);
      const normalizedString = this.normalizeJsonString(jsonString);
      
      // Calculate byte length for capacity check
      const stringByteLength = new TextEncoder().encode(normalizedString).length;
      console.log(`[NFCUtils] Data size: ${stringByteLength} bytes`);
      
      // iOS-specific: Ensure NFC is properly initialized
      if (Platform.OS === 'ios') {
        try {
          await NfcManager.start();
          console.log('[NFCUtils] NFC Manager started for iOS');
        } catch (startError) {
          console.warn('[NFCUtils] NFC Manager already started or error:', startError);
        }
      }
      
      // Request NFC technology with platform-specific timeout
      const technologyRequest = Platform.OS === 'ios' 
        ? NfcManager.requestTechnology(NfcTech.Ndef, { timeout: 60000 } as any) // 60 seconds for iOS
        : NfcManager.requestTechnology(NfcTech.Ndef);
      
      await technologyRequest;
      console.log('[NFCUtils] NFC technology requested successfully');
      
      // Get tag information to check capacity
      const tag = await NfcManager.getTag();
      if (!tag) {
        throw new Error('Could not read NFC tag. Make sure it is positioned correctly.');
      }
      
      // Log tag details for debugging
      console.log(`[NFCUtils] Tag detected: ${JSON.stringify({
        type: tag.type,
        maxSize: tag.maxSize || 'unknown',
        isWritable: (tag as any).isWritable,
        id: tag.id ? (tag.id as any).toString('hex') : 'unknown'
      })}`);
      
      // Check if tag is NDEF formatted and writable
      if (!(tag as any).isWritable) {
        throw new Error('This tag appears to be read-only and cannot be written to.');
      }
      
      // Check capacity if available
      if (tag.maxSize && stringByteLength > tag.maxSize) {
        throw new Error(`Data size (${stringByteLength} bytes) exceeds tag capacity (${tag.maxSize} bytes).`);
      }
      
      // Create NDEF message bytes
      let bytes: number[];
      try {
        bytes = Ndef.encodeMessage([Ndef.textRecord(normalizedString)]);
        console.log('[NFCUtils] NDEF message encoded successfully');
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
            console.log(`[NFCUtils] iOS write operation completed successfully on attempt ${writeAttempts + 1}`);
            break;
          } catch (iosWriteError) {
            writeAttempts++;
            console.warn(`[NFCUtils] iOS write attempt ${writeAttempts} failed:`, iosWriteError);
            
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
        console.log('[NFCUtils] Android write operation completed successfully');
      }
      
      return { success: true, data };
    } catch (error) {
      console.error('[NFCUtils] Error in writeTag:', error);
      
      // Create user-friendly error message based on error type
      let userErrorMessage: string;
      const errorMessage = (error as Error).message;
      
      if (errorMessage.includes('NFC hardware')) {
        userErrorMessage = 'NFC is not available or is disabled on this device. Please check your device settings.';
      } else if (errorMessage.includes('cancelled')) {
        userErrorMessage = 'NFC operation was cancelled.';
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
        console.log('[NFCUtils] NFC technology request canceled');
      } catch (finallyError) {
        console.warn(`[NFCUtils] Error canceling NFC technology request: ${(finallyError as Error).message}`);
      }
    }
  }

  /**
   * Helper function to read Mifare pages with retry
   */
  private async readMifarePagesWithRetry(maxRetries = 3): Promise<any[]> {
    let mifarePages: any[] = [];
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
      try {
        const readLength = 60; // Adjust based on your tag type
        
        for (let i = 0; i < readLength; i++) {
          try {
            const pages = await (NfcManager as any).mifareUltralightHandlerAndroid
              .mifareUltralightReadPages(i * 4);
            
            if (pages) {
              mifarePages.push(pages);
            }
          } catch (pageError) {
            // If we hit the end of available pages, stop
            const errorMessage = (pageError as Error).message;
            if (errorMessage.includes('Out of bounds') || 
                errorMessage.includes('Invalid page') ||
                errorMessage.includes('I/O error')) {
              console.log(`[NFCUtils] Reached end of readable pages at page ${i*4}`);
              break;
            }
            throw pageError; // Rethrow other errors
          }
        }
        
        // If we got here successfully, return the pages
        return mifarePages;
      } catch (error) {
        retryCount++;
        console.warn(`[NFCUtils] Mifare read attempt ${retryCount} failed: ${(error as Error).message}`);
        
        if (retryCount >= maxRetries) {
          throw new Error(`Failed to read Mifare tag after ${maxRetries} attempts: ${(error as Error).message}`);
        }
        
        // Brief delay before retry
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    return mifarePages;
  }

  /**
   * Cancel any ongoing NFC operation
   */
  public async cancelOperation(): Promise<void> {
    try {
      await NfcManager.cancelTechnologyRequest();
      console.log('[NFCUtils] NFC operation cancelled');
    } catch (error) {
      console.warn('[NFCUtils] Error cancelling NFC operation:', error);
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
      console.log('[NFCUtils] NFC Manager cleaned up');
    } catch (error) {
      console.warn('[NFCUtils] Error during cleanup:', error);
    }
  }
}

// Export singleton instance
export const nfcUtils = NFCUtils.getInstance();