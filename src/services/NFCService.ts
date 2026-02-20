// src/services/NFCService.ts - Unified NFC Service for iOS and Android
import { Platform, Alert } from 'react-native';
import NfcManager, { NfcTech, Ndef } from 'react-native-nfc-manager';
import { NFCTagData, NFCOperationResult, DeviceNFCData, NFCWriteOptions, NFCReadOptions } from '../types/nfc';
import { nfcLogger, NFCOperationType, NFCErrorCategory } from '../utils/NFCLogger';
// Temporarily disabled to test if this import causes issues
// import { nfcSimulator } from './NFCSimulator';

export class NFCService {
  private static instance: NFCService;
  private isInitialized = false;

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
      console.warn('[NFCService] Could not convert tag ID:', e);
      return undefined;
    }
  }

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
   * Note: Empty NDEF tags (formatted but no data) are considered valid
   */
  private async validateNDEFTag(tag: any): Promise<{ isValid: boolean; error?: string; isEmpty?: boolean }> {
    try {
      // Check if tag has NDEF capability (not just message presence)
      // Empty but formatted NDEF tags may have ndefMessage: [] or ndefMessage: undefined
      const hasNdefCapability = tag.ndefMessage !== undefined ||
                                tag.type?.toLowerCase().includes('ndef') ||
                                tag.techTypes?.some((t: string) => t.toLowerCase().includes('ndef'));

      if (!hasNdefCapability) {
        // Check for supported tag types that should support NDEF
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
          return {
            isValid: false,
            error: 'Tag is not NDEF formatted. Please use an NDEF-compatible tag.'
          };
        }

        // Tag type suggests NDEF support but no capability detected - warn but allow
        console.warn('[NFCService] Tag type suggests NDEF support but capability not detected, allowing...');
      }

      // Check if tag is empty (formatted but no data)
      const isEmpty = !tag.ndefMessage ||
                     (Array.isArray(tag.ndefMessage) && tag.ndefMessage.length === 0);

      if (isEmpty) {
        console.log('[NFCService] Tag is NDEF formatted but empty (no data)');
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

      return { isValid: true, isEmpty };
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
  private async detectAndValidateTag(): Promise<{ tag: any; isValid: boolean; error?: string; isEmpty?: boolean }> {
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
        id: this.getTagIdHex(tag.id) || 'unknown',
        techTypes: tag.techTypes || []
      })}`);

      // Validate NDEF compatibility
      const validation = await this.validateNDEFTag(tag);

      return {
        tag,
        isValid: validation.isValid,
        error: validation.error,
        isEmpty: validation.isEmpty
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
    // Simulator check temporarily disabled for testing
    // if (nfcSimulator.shouldUseSimulator()) {
    //   return nfcSimulator.readNFC();
    // }

    const maxAttempts = Platform.OS === 'ios' ? 3 : 2; // iOS benefits more from retries
    const operationId = nfcLogger.startOperation(NFCOperationType.READ, { platform: Platform.OS });

    return this.withRetry(async () => {
      try {
        nfcLogger.logStep(operationId, 'Read operation starting');

        // Ensure NFC is initialized
        if (!await this.initialize()) {
          throw new Error('NFC is not available or could not be initialized');
        }
        nfcLogger.logStep(operationId, 'NFC initialized');

        // Request Technology with platform-specific timeout
        const timeout = options.timeout || (Platform.OS === 'ios' ? 60000 : 30000);
        nfcLogger.logStep(operationId, 'Requesting NFC technology', { timeout });
        const technologyRequest = Platform.OS === 'ios'
          ? NfcManager.requestTechnology(NfcTech.Ndef, { timeout, alertMessage: 'Hold your device near the NFC tag' } as any)
          : NfcManager.requestTechnology(NfcTech.Ndef);

        await technologyRequest;
        nfcLogger.logStep(operationId, 'NFC technology acquired');
        
        // Detect and validate tag with enhanced validation
        nfcLogger.logStep(operationId, 'Detecting and validating tag');
        const { tag, isValid, error, isEmpty } = await this.detectAndValidateTag();

        if (!isValid || !tag) {
          throw new Error(error || 'Invalid or incompatible NFC tag detected.');
        }

        const tagId = this.getTagIdHex(tag.id);
        nfcLogger.logStep(operationId, 'Tag validated', { tagId, isEmpty, tagType: tag.type });

        // Handle empty but valid NDEF tags
        if (isEmpty || !tag.ndefMessage || !tag.ndefMessage.length) {
          nfcLogger.logStep(operationId, 'Tag is empty but NDEF formatted');
          nfcLogger.endOperation(operationId, { success: true, isEmpty: true, tagId });
          if (Platform.OS === 'ios') { try { await NfcManager.setAlertMessageIOS('Done!'); } catch (e) { /* ignore */ } }
          return {
            success: true,
            data: {
              tagId,
              isEmpty: true,
              message: 'Tag is formatted but contains no data. You can write data to it.'
            }
          };
        }

        // Process first NDEF record
        const record = tag.ndefMessage[0];

        if (record && record.payload) {
          try {
            // Try multiple decoding approaches to maximize success
            nfcLogger.logStep(operationId, 'Decoding tag content');
            const textContent = this.decodeTagContent(record);

            if (textContent) {
              nfcLogger.logStep(operationId, 'Content decoded successfully');

              // Process the content based on its format
              if (this.isLikelyJSON(textContent)) {
                try {
                  // Normalize and validate JSON
                  const cleanJson = this.normalizeJsonString(textContent.trim());
                  const jsonData = JSON.parse(cleanJson);

                  nfcLogger.endOperation(operationId, { success: true, tagId, hasJson: true });
                  if (Platform.OS === 'ios') { try { await NfcManager.setAlertMessageIOS('Done!'); } catch (e) { /* ignore */ } }
                  return {
                    success: true,
                    data: {
                      tagId,
                      jsonString: cleanJson,
                      parsedData: jsonData
                    }
                  };
                } catch (jsonError) {
                  nfcLogger.logStep(operationId, 'JSON parsing failed, returning as text', { warning: (jsonError as Error).message });
                  nfcLogger.endOperation(operationId, { success: true, tagId, hasJson: false });
                  if (Platform.OS === 'ios') { try { await NfcManager.setAlertMessageIOS('Done!'); } catch (e) { /* ignore */ } }
                  return {
                    success: true,
                    data: {
                      tagId,
                      content: textContent
                    }
                  };
                }
              } else {
                // Not JSON format, just use the text content
                nfcLogger.endOperation(operationId, { success: true, tagId, hasJson: false });
                if (Platform.OS === 'ios') { try { await NfcManager.setAlertMessageIOS('Done!'); } catch (e) { /* ignore */ } }
                return {
                  success: true,
                  data: {
                    tagId,
                    content: textContent
                  }
                };
              }
            } else {
              throw new Error('Failed to decode tag content. The format may be unsupported.');
            }
          } catch (decodeError) {
            nfcLogger.logStep(operationId, 'Decode error', { error: (decodeError as Error).message });
            throw new Error(`Failed to decode tag content: ${(decodeError as Error).message}`);
          }
        } else {
          throw new Error('Tag contains an invalid or empty NDEF record.');
        }
      } catch (error) {
        // Categorize and log error
        const errorCategory = nfcLogger.categorizeError(error as Error);
        nfcLogger.endOperationWithError(operationId, error as Error, errorCategory);

        // Get user-friendly error message
        const userErrorMessage = nfcLogger.getUserFriendlyMessage(errorCategory);

        return { success: false, error: userErrorMessage };
      } finally {
        // Always cancel technology request when done
        try {
          await NfcManager.cancelTechnologyRequest();
          nfcLogger.logStep(operationId, 'Technology request canceled');
        } catch (finallyError) {
          // Silent - operation may already be cleaned up
        }
      }
    }, maxAttempts);
  }

  /**
   * Write JSON string to NFC tag
   */
  public async writeNFC(jsonString: string, options: NFCWriteOptions = {}): Promise<NFCOperationResult> {
    // Simulator check temporarily disabled for testing
    // if (nfcSimulator.shouldUseSimulator()) {
    //   return nfcSimulator.writeNFC(jsonString);
    // }

    const maxAttempts = Platform.OS === 'ios' ? 3 : 2; // iOS benefits more from retries
    const operationId = nfcLogger.startOperation(NFCOperationType.WRITE, { platform: Platform.OS });

    return this.withRetry(async () => {
      try {
        nfcLogger.logStep(operationId, 'Write operation starting');

        // Ensure NFC is initialized
        if (!await this.initialize()) {
          throw new Error('NFC is not available or could not be initialized');
        }
        nfcLogger.logStep(operationId, 'NFC initialized');

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
      nfcLogger.logStep(operationId, 'Data prepared', { dataSize: stringByteLength });

      // Request NFC technology with platform-specific timeout
      const timeout = options.timeout || (Platform.OS === 'ios' ? 60000 : 30000);
      nfcLogger.logStep(operationId, 'Requesting NFC technology', { timeout });
      const technologyRequest = Platform.OS === 'ios'
        ? NfcManager.requestTechnology(NfcTech.Ndef, { timeout, alertMessage: 'Hold your device near the NFC tag' } as any)
        : NfcManager.requestTechnology(NfcTech.Ndef);

      await technologyRequest;
      nfcLogger.logStep(operationId, 'NFC technology acquired');
      
      // Detect and validate tag with enhanced validation
      nfcLogger.logStep(operationId, 'Detecting and validating tag');
      const { tag, isValid, error } = await this.detectAndValidateTag();

      if (!isValid || !tag) {
        throw new Error(error || 'Invalid or incompatible NFC tag detected.');
      }

      const tagId = this.getTagIdHex(tag.id);
      nfcLogger.logStep(operationId, 'Tag validated', { tagId, tagType: tag.type, maxSize: tag.maxSize });

      // For write operations, ensure tag is writable
      if (tag.hasOwnProperty('isWritable') && tag.isWritable === false) {
        throw new Error('This tag appears to be read-only and cannot be written to.');
      }
      nfcLogger.logStep(operationId, 'Tag is writable');

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
      nfcLogger.logStep(operationId, 'Encoding NDEF message');
      let bytes: number[];
      try {
        bytes = Ndef.encodeMessage([Ndef.textRecord(finalJsonString)]);
        nfcLogger.logStep(operationId, 'NDEF message encoded', { messageSize: bytes?.length });
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

      // Verify tag is still connected before writing
      nfcLogger.logStep(operationId, 'Verifying tag connection before write');
      const preWriteTag = await NfcManager.getTag();
      if (!preWriteTag) {
        throw new Error('Tag connection lost before write. Keep the tag steady and try again.');
      }
      nfcLogger.logStep(operationId, 'Tag still connected, proceeding with write');

      // Write the message to the tag with platform-specific handling
      nfcLogger.logStep(operationId, 'Writing NDEF message', { platform: Platform.OS });
      if (Platform.OS === 'ios') {
        // iOS-specific write with retry mechanism
        let writeAttempts = 0;
        const maxWriteAttempts = 3;

        while (writeAttempts < maxWriteAttempts) {
          try {
            await NfcManager.ndefHandler.writeNdefMessage(bytes);
            nfcLogger.logStep(operationId, 'iOS write completed', { attempt: writeAttempts + 1 });
            break;
          } catch (iosWriteError) {
            writeAttempts++;
            nfcLogger.logStep(operationId, 'iOS write attempt failed', {
              attempt: writeAttempts,
              error: (iosWriteError as Error).message
            });

            if (writeAttempts >= maxWriteAttempts) {
              throw iosWriteError;
            }

            // Short delay before retry
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      } else {
        // Android write
        await NfcManager.ndefHandler.writeNdefMessage(bytes);
        nfcLogger.logStep(operationId, 'Android write completed');
      }

        nfcLogger.endOperation(operationId, { success: true, tagId });
        if (Platform.OS === 'ios') { try { await NfcManager.setAlertMessageIOS('Done!'); } catch (e) { /* ignore */ } }
        return { success: true, data: { jsonString: finalJsonString } };
      } catch (error) {
        // Categorize and log error
        const errorCategory = nfcLogger.categorizeError(error as Error);
        nfcLogger.endOperationWithError(operationId, error as Error, errorCategory);

        // Get user-friendly error message
        let userErrorMessage = nfcLogger.getUserFriendlyMessage(errorCategory);

        // For specific errors with detailed messages, use the original
        const errorMessage = (error as Error).message;
        if (errorMessage.includes('tag capacity') || errorMessage.includes('connection lost')) {
          userErrorMessage = errorMessage;
        }

        return { success: false, error: userErrorMessage };
      } finally {
        // Always cancel technology request when done
        try {
          await NfcManager.cancelTechnologyRequest();
          nfcLogger.logStep(operationId, 'Technology request canceled');
        } catch (finallyError) {
          // Silent - operation may already be cleaned up
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
   * Format a non-NDEF tag to NDEF format
   * Supports multiple approaches: NdefFormatable, NfcA with transceive, and NDEF write
   */
  public async formatTag(): Promise<NFCOperationResult> {
    // Simulator check temporarily disabled for testing
    // if (nfcSimulator.shouldUseSimulator()) {
    //   return nfcSimulator.formatTag();
    // }

    const maxAttempts = Platform.OS === 'ios' ? 3 : 2;
    const operationId = nfcLogger.startOperation(NFCOperationType.FORMAT, { platform: Platform.OS });

    return this.withRetry(async () => {
      try {
        nfcLogger.logStep(operationId, 'Format operation starting');

        // Ensure NFC is initialized
        if (!await this.initialize()) {
          throw new Error('NFC is not available or could not be initialized');
        }
        nfcLogger.logStep(operationId, 'NFC initialized');

        // Try multiple approaches to format the tag
        nfcLogger.logStep(operationId, 'Attempting to format tag');
        let tag: any = null;
        let tagId: string | undefined;

        // Approaches 1 & 2: Android-only (iOS doesn't support NdefFormatable or reliable NfcA transceive)
        if (Platform.OS !== 'ios') {
          // Approach 1: Try NdefFormatable first (for truly blank tags)
          try {
            nfcLogger.logStep(operationId, 'Trying NdefFormatable technology');
            await NfcManager.requestTechnology(NfcTech.NdefFormatable);

            tag = await NfcManager.getTag();
            if (!tag) {
              throw new Error('No NFC tag detected');
            }
            tagId = this.getTagIdHex(tag.id);
            nfcLogger.logStep(operationId, 'Tag detected via NdefFormatable', { tagId, tagType: tag.type });

            const emptyMessage = Ndef.encodeMessage([Ndef.textRecord('')]);
            await NfcManager.ndefFormatableHandlerAndroid.formatNdef(emptyMessage);

            nfcLogger.endOperation(operationId, { success: true, method: 'NdefFormatable', wasFormatted: true });
            return {
              success: true,
              data: {
                message: 'Tag formatted to NDEF successfully. You can now write data to it.',
                wasFormatted: true,
                method: 'NdefFormatable'
              }
            };
          } catch (formatableError) {
            nfcLogger.logStep(operationId, 'NdefFormatable not available', { error: (formatableError as Error).message });
            try {
              await NfcManager.cancelTechnologyRequest();
            } catch (e) {
              // Ignore cleanup errors
            }
          }

          // Approach 2: Try NfcA with transceive commands (works for blank NTAG/Type 2 tags)
          try {
            nfcLogger.logStep(operationId, 'Trying NfcA technology with transceive');
            await NfcManager.requestTechnology(NfcTech.NfcA);

            tag = await NfcManager.getTag();
            if (!tag) {
              throw new Error('No NFC tag detected');
            }
            tagId = this.getTagIdHex(tag.id);
            nfcLogger.logStep(operationId, 'Tag detected via NfcA', { tagId, tagType: tag.type });

            // Write NDEF TLV to page 4 to initialize NDEF format
            const formatCommand = [0xa2, 0x04, 0x03, 0x00, 0xfe, 0x00];

            nfcLogger.logStep(operationId, 'Sending NfcA format command', { command: formatCommand });
            await (NfcManager as any).nfcAHandler.transceive(formatCommand);

            nfcLogger.endOperation(operationId, { success: true, method: 'NfcA', wasFormatted: true });
            return {
              success: true,
              data: {
                message: 'Tag formatted to NDEF successfully using NfcA. You can now write data to it.',
                wasFormatted: true,
                method: 'NfcA'
              }
            };
          } catch (nfcAError) {
            nfcLogger.logStep(operationId, 'NfcA format failed', { error: (nfcAError as Error).message });
            try {
              await NfcManager.cancelTechnologyRequest();
            } catch (e) {
              // Ignore cleanup errors
            }
          }
        }

        // Approach 3: Try NDEF technology (primary approach for iOS, fallback for Android)
        try {
          nfcLogger.logStep(operationId, 'Trying NDEF technology');
          const formatTimeout = Platform.OS === 'ios' ? 60000 : 30000;
          await NfcManager.requestTechnology(NfcTech.Ndef, Platform.OS === 'ios'
            ? { timeout: formatTimeout, alertMessage: 'Hold your device near the NFC tag' } as any
            : undefined);

          tag = await NfcManager.getTag();
          if (!tag) {
            throw new Error('No NFC tag detected. Please position the tag correctly near your device.');
          }
          tagId = this.getTagIdHex(tag.id);
          nfcLogger.logStep(operationId, 'Tag detected via NDEF', { tagId, tagType: tag.type });

          // Tag is already NDEF - clear existing data by writing empty message
          nfcLogger.logStep(operationId, 'Tag already NDEF formatted, clearing data');

          const emptyTextRecord = Ndef.textRecord('');
          const bytes = Ndef.encodeMessage([emptyTextRecord]);

          if (Platform.OS === 'ios') {
            // iOS-specific write with retry
            let writeAttempts = 0;
            const maxWriteAttempts = 3;

            while (writeAttempts < maxWriteAttempts) {
              try {
                await NfcManager.ndefHandler.writeNdefMessage(bytes);
                break;
              } catch (iosWriteError) {
                writeAttempts++;
                if (writeAttempts >= maxWriteAttempts) {
                  throw iosWriteError;
                }
                await new Promise(resolve => setTimeout(resolve, 500));
              }
            }
          } else {
            await NfcManager.ndefHandler.writeNdefMessage(bytes);
          }

          nfcLogger.endOperation(operationId, { success: true, method: 'NDEF', wasCleared: true });
          if (Platform.OS === 'ios') { try { await NfcManager.setAlertMessageIOS('Done!'); } catch (e) { /* ignore */ } }
          return {
            success: true,
            data: {
              message: 'Tag already NDEF formatted. Existing data has been cleared.',
              wasFormatted: false,
              wasCleared: true,
              method: 'NDEF'
            }
          };
        } catch (ndefError) {
          nfcLogger.logStep(operationId, 'NDEF approach failed', { error: (ndefError as Error).message });

          // Check if this was a write error on an otherwise valid tag
          const errorMsg = (ndefError as Error).message.toLowerCase();
          if (errorMsg.includes('read-only') || errorMsg.includes('not writable') || errorMsg.includes('write-protected')) {
            throw new Error('This tag is write-protected and cannot be formatted.');
          }
        }

        // All approaches failed
        throw new Error('Unable to format tag. The tag may not be compatible or may be damaged.');
      } catch (error) {
        // Categorize and log error
        const errorCategory = nfcLogger.categorizeError(error as Error);
        nfcLogger.endOperationWithError(operationId, error as Error, errorCategory);

        // Get user-friendly error message
        const userErrorMessage = nfcLogger.getUserFriendlyMessage(errorCategory);

        return { success: false, error: userErrorMessage };
      } finally {
        // Always cancel technology request
        try {
          await NfcManager.cancelTechnologyRequest();
          nfcLogger.logStep(operationId, 'Technology request canceled');
        } catch (cancelError) {
          // Silent - operation may already be cleaned up
        }
      }
    }, maxAttempts);
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