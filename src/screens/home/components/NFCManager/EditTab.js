import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, Alert, TouchableOpacity, Platform, KeyboardAvoidingView, Keyboard } from 'react-native';
import Button from '../../../../components/Button';
import { nfcService } from '../../../../services/NFCService';
import { styles } from './styles';
import { Ionicons } from '@expo/vector-icons';
import NfcManager, { NfcTech, Ndef } from 'react-native-nfc-manager';
import { nfcLogger, NFCOperationType, NFCErrorCategory } from '../../../../utils/NFCLogger';


// NFCService handles normalization, so we don't need this function anymore


// New function to validate JSON structure
const validateJSON = (jsonString) => {
  try {
    JSON.parse(jsonString);
    return { valid: true, error: null };
  } catch (e) {
    return { valid: false, error: e.message };
  }
};

// Function to determine if a string is likely JSON
const isLikelyJSON = (value) => {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) || 
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  );
};

const EditTab = ({ onCancel }) => {
  const [isReading, setIsReading] = useState(false);
  const [isWriting, setIsWriting] = useState(false);
  const [tagData, setTagData] = useState(null);
  const [editedFields, setEditedFields] = useState({});
  const [newField, setNewField] = useState({ key: '', value: '' });
  const [firstKey, setFirstKey] = useState(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // State for field editing
  const [editingKeys, setEditingKeys] = useState({});
  const [jsonValidationState, setJsonValidationState] = useState({});

  // Change tracking state
  const [originalFields, setOriginalFields] = useState({}); // Original values from tag
  const [deletedFields, setDeletedFields] = useState(new Set()); // Fields marked for deletion
  const [addedFields, setAddedFields] = useState(new Set()); // Fields added by user

  // Helper to check if a field is modified (exists in original and value changed)
  const isFieldModified = (key) => {
    if (addedFields.has(key)) return false; // New fields aren't "modified"
    if (!originalFields.hasOwnProperty(key)) return false;
    return originalFields[key] !== editedFields[key];
  };

  // Helper to check if there are any pending changes
  const hasPendingChanges = () => {
    const hasModified = Object.keys(editedFields).some(key => isFieldModified(key));
    const hasDeleted = deletedFields.size > 0;
    const hasAdded = addedFields.size > 0;
    const hasPendingNew = newField.key.trim() || newField.value.trim();
    return hasModified || hasDeleted || hasAdded || hasPendingNew;
  };

  // Keyboard event listeners
  React.useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      setIsKeyboardVisible(true);
    });
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setIsKeyboardVisible(false);
    });

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
    };
  }, []);


const handleReadTag = async () => {
  let result = false;
  let loadedTagData = null;
  let loadedEditedFields = {};
  let loadedFirstKey = null;
  let alertMessage = null;
  let alertTitle = 'Success';

  try {
    setIsReading(true);
    setTagData(null);
    setEditedFields({});
    setFirstKey(null);
    // Reset change tracking
    setOriginalFields({});
    setDeletedFields(new Set());
    setAddedFields(new Set());
    setNewField({ key: '', value: '' });

    console.log('[EditTab] Starting enhanced tag read with NFCService');

    // Use the enhanced NFCService for reading
    const readResult = await nfcService.readNFC({ timeout: 60000 });

    if (readResult.success) {
      console.log('[EditTab] Successfully read tag using NFCService');

      // Handle empty tags - allow editing from scratch
      if (readResult.data?.isEmpty) {
        console.log('[EditTab] Tag is empty, starting with blank editor');
        loadedTagData = {};
        loadedEditedFields = {};
        loadedFirstKey = null;
        alertTitle = 'Empty Tag';
        alertMessage = 'Tag is formatted but empty. You can add new fields below.';
        result = true;
      } else if (readResult.data?.parsedData) {
        // Handle structured JSON data
        const jsonData = readResult.data.parsedData;

        if (typeof jsonData === 'object' && jsonData !== null && !Array.isArray(jsonData)) {
          // Set the first key to maintain EditTab functionality
          const keys = Object.keys(jsonData);
          if (keys.length > 0) {
            loadedFirstKey = keys[0];
          }

          loadedTagData = jsonData;
          loadedEditedFields = { ...jsonData };
          alertMessage = 'NFC tag data loaded successfully!';
          result = true;
        } else {
          // Handle non-object data
          loadedTagData = {};
          loadedEditedFields = { "content": JSON.stringify(jsonData) };
          alertMessage = 'Tag content loaded.';
          result = true;
        }
      } else if (readResult.data?.content) {
        // Handle plain text content
        loadedTagData = {};
        loadedEditedFields = { "content": readResult.data.content };
        alertMessage = 'Plain text content loaded.';
        result = true;
      } else if (readResult.data?.jsonString) {
        // Try to parse JSON string
        try {
          const parsed = JSON.parse(readResult.data.jsonString);

          if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
            const keys = Object.keys(parsed);
            if (keys.length > 0) {
              loadedFirstKey = keys[0];
            }

            loadedTagData = parsed;
            loadedEditedFields = { ...parsed };
            alertMessage = 'NFC tag data loaded successfully!';
            result = true;
          } else {
            loadedTagData = {};
            loadedEditedFields = { "content": readResult.data.jsonString };
            alertMessage = 'Tag content loaded.';
            result = true;
          }
        } catch (e) {
          loadedTagData = {};
          loadedEditedFields = { "content": readResult.data.jsonString };
          alertMessage = 'Raw content loaded.';
          result = true;
        }
      } else {
        throw new Error('No valid data found on tag');
      }
    } else {
      throw new Error(readResult.error || 'Failed to read NFC tag');
    }
  } catch (error) {
    console.error('[EditTab] Error in handleReadTag:', error);

    const errorMsg = error.message || '';

    // Check if this was a cancel operation (empty message or explicit cancel)
    const wasCancelled = !errorMsg || errorMsg.includes('cancelled') || errorMsg.includes('canceled');

    if (wasCancelled) {
      // Don't show error for cancelled operations - just log it
      console.log('[EditTab] NFC read was cancelled by user');
    } else {
      // Create user-friendly error message based on error type
      let userErrorMessage;

      if (errorMsg.includes('NFC hardware')) {
        userErrorMessage = 'NFC is not available or is disabled on this device. Please check your device settings.';
      } else if (errorMsg.includes('No NFC tag detected')) {
        userErrorMessage = 'No NFC tag detected. Please make sure the tag is positioned correctly near your device.';
      } else if (errorMsg.includes('No NDEF message')) {
        userErrorMessage = 'This tag may not be NDEF formatted or may be empty. Please format the tag or try a different one.';
      } else if (errorMsg.includes('decode')) {
        userErrorMessage = 'Could not read tag content. The tag format may be incompatible or corrupted.';
      } else {
        // Generic error with the technical message included
        userErrorMessage = `Error reading NFC tag: ${errorMsg}`;
      }

      Alert.alert('NFC Read Error', userErrorMessage, [
        {
          text: 'Retry',
          onPress: () => handleReadTag(),
          style: 'default'
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ]);
    }

    result = false;
  } finally {
    // Always cancel technology request when done
    try {
      await NfcManager.cancelTechnologyRequest();
      console.log('[EditTab] NFC technology request canceled');
    } catch (finallyError) {
      console.warn(`[EditTab] Error canceling NFC technology request: ${finallyError.message}`);
    }

    // Apply state updates with proper sequencing for React
    if (result && loadedTagData !== null) {
      console.log('[EditTab] Applying loaded data to state', {
        hasTagData: !!loadedTagData,
        fieldCount: Object.keys(loadedEditedFields).length,
        firstKey: loadedFirstKey
      });

      // Set state in sequence
      setFirstKey(loadedFirstKey);
      setEditedFields(loadedEditedFields);
      setOriginalFields({ ...loadedEditedFields }); // Save original for change tracking
      setTagData(loadedTagData);
    }

    // Set isReading false after state is applied
    setIsReading(false);

    // Show alert with slight delay to allow UI to update first
    if (alertMessage) {
      setTimeout(() => {
        Alert.alert(alertTitle, alertMessage);
      }, 100);
    }
  }

  return result;
};

// Helper function to read Mifare pages with retry
const readMifarePagesWithRetry = async (maxRetries = 3) => {
  let mifarePages = [];
  let retryCount = 0;
  
  while (retryCount < maxRetries) {
    try {
      const readLength = 60; // Adjust based on your tag type
      
      for (let i = 0; i < readLength; i++) {
        try {
          const pages = await NfcManager.mifareUltralightHandlerAndroid
            .mifareUltralightReadPages(i * 4);
          
          if (pages) {
            mifarePages.push(pages);
          }
        } catch (pageError) {
          // If we hit the end of available pages, stop
          if (pageError.message.includes('Out of bounds') || 
              pageError.message.includes('Invalid page') ||
              pageError.message.includes('I/O error')) {
            console.log(`[EditTab] Reached end of readable pages at page ${i*4}`);
            break;
          }
          throw pageError; // Rethrow other errors
        }
      }
      
      // If we got here successfully, return the pages
      return mifarePages;
    } catch (error) {
      retryCount++;
      console.warn(`[EditTab] Mifare read attempt ${retryCount} failed: ${error.message}`);
      
      if (retryCount >= maxRetries) {
        throw new Error(`Failed to read Mifare tag after ${maxRetries} attempts: ${error.message}`);
      }
      
      // Brief delay before retry
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  return mifarePages;
};

// Helper function to decode tag content with multiple approaches
const decodeTagContent = (record) => {
  // Try standard NDEF text decoding first
  try {
    return Ndef.text.decodePayload(record.payload);
  } catch (e) {
    console.warn('[EditTab] Standard NDEF decoding failed, trying alternative methods');
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
      return String.fromCharCode.apply(null, uint16Array);
    } else {
      // UTF-8 encoding
      return new TextDecoder().decode(new Uint8Array(textBytes));
    }
  } catch (manualError) {
    console.warn('[EditTab] Manual decoding failed, trying TextDecoder directly');
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
    console.warn('[EditTab] All decoding methods failed');
    throw new Error('Unable to decode tag content using any available method');
  }
};

// Helper function to process JSON tag content with console logging
const processJsonTagContent = (textContent) => {
  // Add console statement when reading data
  console.log('[EditTab] Processing tag JSON content:', textContent);

  // NFCService already handles normalization, so we just trim and parse
  const cleanJson = textContent.trim();

  // Parse the JSON
  const jsonData = JSON.parse(cleanJson);
  
  // Separate the ID field (if it exists) from other editable fields
  const { id, ...editableData } = jsonData;
  
  // Create a clean object for tagData and editedFields
  const tagDataObj = id ? { id } : {};
  
  // Convert all fields to strings for the TextInput component
  const editableFields = {};
  const jsonState = {};
  
  // Track the first key for making it uneditable
  let firstKey = null;
  
  Object.entries(editableData).forEach(([key, value], index) => {
    // Track the first key encountered
    if (index === 0 && firstKey === null) {
      firstKey = key;
    }
    
    if (typeof value === 'object' && value !== null) {
      // Properly stringify objects
      const stringifiedValue = JSON.stringify(value);
      editableFields[key] = stringifiedValue;
      jsonState[key] = { valid: true, error: null };
    } else {
      // Convert primitives to string
      editableFields[key] = String(value);
      // Check if the string looks like JSON
      if (isLikelyJSON(String(value))) {
        jsonState[key] = validateJSON(String(value));
      }
    }
  });
  
  // Store the first key in state for reference
  setFirstKey(firstKey);
  
  setTagData(tagDataObj);
  setEditedFields(editableFields);
  setJsonValidationState(jsonState);
};

// Improved write function with iOS-specific optimizations and enhanced logging
const handleWriteTag = async () => {
  let result = false;
  const operationId = nfcLogger.startOperation(NFCOperationType.WRITE, { source: 'EditTab' });

  try {
    // Check for invalid JSON first
    const invalidFields = Object.entries(jsonValidationState)
      .filter(([key, state]) => state && !state.valid)
      .map(([key]) => key);

    if (invalidFields.length > 0) {
      nfcLogger.endOperationWithError(operationId, new Error('Invalid JSON fields'), NFCErrorCategory.INVALID_DATA);
      Alert.alert(
        'Invalid JSON Detected',
        `Please fix the JSON formatting in these fields: ${invalidFields.join(', ')}`
      );
      return;
    }

    setIsWriting(true);
    nfcLogger.logStep(operationId, 'Write operation started');

    // iOS-specific: Ensure NFC is properly initialized
    if (Platform.OS === 'ios') {
      try {
        await NfcManager.start();
        nfcLogger.logStep(operationId, 'NFC Manager started for iOS');
      } catch (startError) {
        nfcLogger.logStep(operationId, 'NFC Manager already started', { warning: startError.message });
      }
    }

    // Auto-add pending new field if user typed something but forgot to press +
    if (newField.key.trim() || newField.value.trim()) {
      const keyToAdd = newField.key.trim() || 'field';
      const valueToAdd = newField.value;

      // Check for duplicate key
      if (!editedFields.hasOwnProperty(keyToAdd)) {
        // Validate JSON if it looks like JSON
        if (isLikelyJSON(valueToAdd) && !validateJSON(valueToAdd).valid) {
          Alert.alert('Invalid JSON', 'The new field value contains invalid JSON. Please fix it before saving.');
          return;
        }

        // Add the field
        setEditedFields(prev => ({
          ...prev,
          [keyToAdd]: valueToAdd
        }));

        // Track as added field
        setAddedFields(prev => {
          const updated = new Set(prev);
          updated.add(keyToAdd);
          return updated;
        });

        // Update local reference for this write operation
        editedFields[keyToAdd] = valueToAdd;

        // Clear the new field inputs
        setNewField({ key: '', value: '' });
      }
    }

    // Filter out deleted fields for writing
    const fieldsToWrite = Object.keys(editedFields).filter(key => !deletedFields.has(key));

    // Check if there are any fields to write
    if (fieldsToWrite.length === 0) {
      nfcLogger.endOperationWithError(operationId, new Error('No fields to write'), NFCErrorCategory.INVALID_DATA);
      Alert.alert('Error', 'There are no fields to write to the tag. All fields are marked for deletion.');
      return;
    }

    // Process the data for writing
    const processedData = {};

    // Add ID if it exists
    if (tagData?.id) {
      processedData.id = tagData.id;
    }

    // Process all other fields (excluding deleted ones)
    fieldsToWrite.forEach((key) => {
      const value = editedFields[key];
      // Handle string values that might be JSON
      if (typeof value === 'string' && isLikelyJSON(value)) {
        try {
          processedData[key] = JSON.parse(value);
        } catch (e) {
          // If parsing fails, use as string
          processedData[key] = value;
        }
      } else {
        processedData[key] = value;
      }
    });

    // Convert to JSON string (NFCService handles normalization)
    const jsonString = JSON.stringify(processedData);
    let normalizedString = jsonString; // Use let so we can reassign if needed for compact version

    // Calculate byte length for capacity check
    const stringByteLength = new TextEncoder().encode(normalizedString).length;
    nfcLogger.logStep(operationId, 'Data prepared', { dataSize: stringByteLength });

    // STEP 1: Request NFC technology with iOS-specific timeout
    nfcLogger.logStep(operationId, 'Requesting NFC technology');
    const technologyRequest = Platform.OS === 'ios'
      ? NfcManager.requestTechnology(NfcTech.Ndef, { timeout: 60000 }) // 60 seconds for iOS
      : NfcManager.requestTechnology(NfcTech.Ndef);

    await technologyRequest;
    nfcLogger.logStep(operationId, 'NFC technology acquired');

    // STEP 1.5: Verify tag is still connected before proceeding
    const tag = await NfcManager.getTag();
    if (!tag) {
      throw new Error('Tag connection lost. Keep the tag steady and try again.');
    }
    nfcLogger.logStep(operationId, 'Tag connection verified', {
      tagType: tag.type,
      maxSize: tag.maxSize,
      isWritable: tag.isWritable
    });
    
    // Check if tag is NDEF formatted and writable
    if (!tag.isWritable) {
      throw new Error('This tag appears to be read-only and cannot be written to.');
    }
    nfcLogger.logStep(operationId, 'Tag is writable');
    
    // Check capacity if available
    if (tag.maxSize && stringByteLength > tag.maxSize) {
      // Create a more compact version by removing optional fields
      const compactData = { ...processedData };
      
      // Remove fields that aren't critical (preserving id and key identifiers)
      Object.keys(compactData).forEach(key => {
        if (key !== 'id' && key !== 'ID' && typeof compactData[key] === 'string' && compactData[key].length > 30) {
          compactData[key] = compactData[key].substring(0, 30) + '...';
        }
      });
      
      const compactJson = JSON.stringify(compactData);
      const compactSize = new TextEncoder().encode(compactJson).length;
      
      if (compactSize > tag.maxSize) {
        throw new Error(`Data size (${stringByteLength} bytes) exceeds tag capacity (${tag.maxSize} bytes). Even a reduced version (${compactSize} bytes) is too large.`);
      } else {
        // Use the compact version instead
        console.log(`[EditTab] Using reduced data format to fit tag capacity: ${compactJson}`);
        Alert.alert(
          'Warning', 
          'Complete data is too large for this tag. Writing a reduced version with truncated fields.',
          [{ text: 'Continue', style: 'default' }]
        );
        // Update the string to write
        normalizedString = compactJson;
      }
    }
    
    // STEP 2: Create NDEF message bytes
    nfcLogger.logStep(operationId, 'Encoding NDEF message');
    let bytes;
    try {
      bytes = Ndef.encodeMessage([Ndef.textRecord(normalizedString)]);
      nfcLogger.logStep(operationId, 'NDEF message encoded', { messageSize: bytes?.length });
    } catch (encodeError) {
      throw new Error(`Failed to encode data: ${encodeError.message}`);
    }
    
    if (!bytes) {
      throw new Error('Failed to create NDEF message. The encoding returned null.');
    }
    
    // Final size check
    if (tag.maxSize && bytes.length > tag.maxSize) {
      throw new Error(`Encoded message size (${bytes.length} bytes) exceeds tag capacity (${tag.maxSize} bytes).`);
    }
    
    // STEP 3: Verify tag is still connected before writing
    nfcLogger.logStep(operationId, 'Verifying tag connection before write');
    const preWriteTag = await NfcManager.getTag();
    if (!preWriteTag) {
      throw new Error('Tag connection lost before write. Keep the tag steady and try again.');
    }
    nfcLogger.logStep(operationId, 'Tag still connected, proceeding with write');

    // STEP 4: Write the message to the tag with platform-specific handling
    try {
      nfcLogger.logStep(operationId, 'Writing NDEF message', { platform: Platform.OS });
      if (Platform.OS === 'ios') {
        // iOS-specific write with retry mechanism
        let writeAttempts = 0;
        const maxAttempts = 3;

        while (writeAttempts < maxAttempts) {
          try {
            await NfcManager.ndefHandler.writeNdefMessage(bytes);
            nfcLogger.logStep(operationId, 'iOS write completed', { attempt: writeAttempts + 1 });
            break;
          } catch (iosWriteError) {
            writeAttempts++;
            nfcLogger.logStep(operationId, 'iOS write attempt failed', {
              attempt: writeAttempts,
              error: iosWriteError.message
            });

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
        nfcLogger.logStep(operationId, 'Android write completed');
      }

      result = true;
      nfcLogger.endOperation(operationId, { success: true });

      // Reset change tracking - current state becomes the new "original"
      // Remove deleted fields from editedFields
      const finalFields = {};
      fieldsToWrite.forEach(key => {
        finalFields[key] = editedFields[key];
      });
      setEditedFields(finalFields);
      setOriginalFields({ ...finalFields });
      setDeletedFields(new Set());
      setAddedFields(new Set());

      Alert.alert('Success', 'Changes saved to NFC tag successfully!');
    } catch (writeError) {
      // Check for specific write errors
      if (writeError.message.includes('timeout')) {
        throw new Error('Write operation timed out. Please keep the tag close to your device and try again.');
      } else if (writeError.message.includes('read-only') || writeError.message.includes('not writable')) {
        throw new Error('This NFC tag is read-only and cannot be written to.');
      } else if (writeError.message.includes('Tag connection lost')) {
        throw new Error('Tag connection lost. Please try again and keep the tag steady.');
      } else {
        throw new Error(`Write failed: ${writeError.message}`);
      }
    }
  } catch (error) {
    // Categorize error and log with NFCLogger
    const errorCategory = nfcLogger.categorizeError(error);
    nfcLogger.endOperationWithError(operationId, error, errorCategory);

    // Get user-friendly error message
    let userErrorMessage = nfcLogger.getUserFriendlyMessage(errorCategory);

    // For specific errors, use the original message if it's more informative
    if (error.message.includes('tag capacity') || error.message.includes('connection lost')) {
      userErrorMessage = error.message;
    }

    // Don't show alert for cancelled operations
    if (errorCategory !== NFCErrorCategory.CANCELLED) {
      Alert.alert('NFC Write Error', userErrorMessage, [
        {
          text: 'Retry',
          onPress: () => handleWriteTag(),
          style: 'default'
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ]);
    }

    result = false;
  } finally {
    // STEP 4: Always cancel technology request when done
    try {
      await NfcManager.cancelTechnologyRequest();
      console.log('[EditTab] NFC technology request canceled');
    } catch (error) {
      console.warn(`[EditTab] Error canceling NFC technology request: ${error.message}`);
    }
    setIsWriting(false);
  }
  
  return result;
};
const handleFieldChange = (key, value) => {
  // Prevent changing the value of the first key
  if (key === firstKey) {
    Alert.alert('Error', 'The primary field cannot be modified.');
    return;
  }
  
  setEditedFields(prev => ({
    ...prev,
    [key]: value
  }));
  
  // Check JSON validity if the value looks like JSON
  if (isLikelyJSON(value)) {
    setJsonValidationState(prev => ({
      ...prev,
      [key]: validateJSON(value)
    }));
  } else {
    // If it no longer looks like JSON, remove validation state
    setJsonValidationState(prev => {
      const updated = { ...prev };
      delete updated[key];
      return updated;
    });
  }
};

// New improved key change handler with live feedback
const handleKeyChange = (oldKey, newKey) => {
  // Prevent editing the first key
  if (oldKey === firstKey) {
    Alert.alert('Error', 'The primary field cannot be renamed.');
    return;
  }
  
  // Update the editing state
  setEditingKeys(prev => ({
    ...prev,
    [oldKey]: newKey
  }));
};

// New function to commit key changes when editing is complete
const handleKeyChangeComplete = (oldKey) => {
  // Prevent editing the first key
  if (oldKey === firstKey) {
    setEditingKeys(prev => {
      const updated = { ...prev };
      delete updated[oldKey];
      return updated;
    });
    Alert.alert('Error', 'The primary field cannot be renamed.');
    return;
  }
  
  const newKey = editingKeys[oldKey]?.trim() || oldKey;
  
  // Handle empty keys - revert to original
  if (!newKey) {
    setEditingKeys(prev => {
      const updated = { ...prev };
      delete updated[oldKey];
      return updated;
    });
    Alert.alert('Error', 'Field name cannot be empty');
    return;
  }
  
  if (oldKey === newKey) {
    // No change needed, just clear the editing state
    setEditingKeys(prev => {
      const updated = { ...prev };
      delete updated[oldKey];
      return updated;
    });
    return;
  }
  
  // Check for duplicate keys, but ignore the current key
  if (oldKey !== newKey && editedFields.hasOwnProperty(newKey)) {
    Alert.alert('Error', `Field "${newKey}" already exists`);
    // Revert back to old key in the editing state
    setEditingKeys(prev => ({
      ...prev,
      [oldKey]: oldKey
    }));
    return;
  }
  
  // Commit the key change
  setEditedFields(prev => {
    const updatedFields = { ...prev };
    const value = updatedFields[oldKey];
    delete updatedFields[oldKey];
    updatedFields[newKey] = value;
    return updatedFields;
  });

  // Update addedFields set if this was an added field
  if (addedFields.has(oldKey)) {
    setAddedFields(prev => {
      const updated = new Set(prev);
      updated.delete(oldKey);
      updated.add(newKey);
      return updated;
    });
  }

  // Update deletedFields set if this was marked for deletion
  if (deletedFields.has(oldKey)) {
    setDeletedFields(prev => {
      const updated = new Set(prev);
      updated.delete(oldKey);
      updated.add(newKey);
      return updated;
    });
  }

  // Update originalFields if this key was from original data
  if (originalFields.hasOwnProperty(oldKey)) {
    setOriginalFields(prev => {
      const updated = { ...prev };
      const originalValue = updated[oldKey];
      delete updated[oldKey];
      updated[newKey] = originalValue;
      return updated;
    });
  }

  // Update JSON validation state if needed
  if (jsonValidationState.hasOwnProperty(oldKey)) {
    setJsonValidationState(prev => {
      const updated = { ...prev };
      const validationState = updated[oldKey];
      delete updated[oldKey];
      updated[newKey] = validationState;
      return updated;
    });
  }

  // Clear editing state for this key
  setEditingKeys(prev => {
    const updated = { ...prev };
    delete updated[oldKey];
    return updated;
  });
};

const handleAddField = () => {
  if (!newField.key.trim()) {
    Alert.alert('Error', 'Please enter a field name.');
    return;
  }

  if (editedFields.hasOwnProperty(newField.key.trim())) {
    Alert.alert('Error', `Field "${newField.key.trim()}" already exists`);
    return;
  }

  const keyToAdd = newField.key.trim();
  const valueToAdd = newField.value;

  // Add the new field to editedFields
  setEditedFields(prev => ({
    ...prev,
    [keyToAdd]: valueToAdd
  }));

  // Track this as a newly added field (not from original tag)
  setAddedFields(prev => {
    const updated = new Set(prev);
    updated.add(keyToAdd);
    return updated;
  });

  // Check if the value looks like JSON and validate if needed
  if (isLikelyJSON(valueToAdd)) {
    setJsonValidationState(prev => ({
      ...prev,
      [keyToAdd]: validateJSON(valueToAdd)
    }));
  }

  // Reset the new field inputs
  setNewField({ key: '', value: '' });
};

const handleDeleteField = (key) => {
  // Prevent deleting the first key
  if (key === firstKey) {
    Alert.alert('Error', 'The primary field cannot be deleted.');
    return;
  }

  // Toggle deletion state instead of actually removing
  setDeletedFields(prev => {
    const updated = new Set(prev);
    if (updated.has(key)) {
      // Unmark for deletion (recover)
      updated.delete(key);
    } else {
      // Mark for deletion
      updated.add(key);
    }
    return updated;
  });
};

const cancelOperation = () => {
  if (isReading || isWriting) {
    setIsReading(false);
    setIsWriting(false);
    NfcManager.cancelTechnologyRequest();
    onCancel?.();
  } else {
    onCancel?.();
  }
};

// Helper function to get field key border color based on validation
const getFieldKeyBorderColor = (key) => {
  // If the key is being edited and exists in another field, show error
  const editingValue = editingKeys[key];
  if (editingValue && 
      editingValue !== key && 
      editedFields.hasOwnProperty(editingValue)) {
    return '#ff4c4c'; // Red for duplicate
  }
  return '#ccc'; // Default gray
};

// Helper function to get field value border color based on JSON validation
const getFieldValueBorderColor = (key, value) => {
  // If this is a JSON field with validation state
  if (jsonValidationState[key]) {
    return jsonValidationState[key].valid ? '#4CAF50' : '#ff4c4c';
  }
  return '#ccc'; // Default gray
};


return (
  <KeyboardAvoidingView
    style={styles.nfcTabContent}
    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
  >
    <View style={{ flex: 1 }} testID="edit-tab-container">
      <Text style={styles.nfcTabTitle} testID="edit-tab-title">Edit NFC Tag</Text>
      <Text style={styles.nfcTabSubtitle} testID="edit-tab-subtitle">
        Read the NFC tag to load existing data into the form, make changes, and save.
      </Text>

    {isReading || isWriting ? (
      <View style={styles.buttonGroup} testID="operation-cancel-container">
        <Button
          title="Cancel Operation"
          onPress={cancelOperation}
          style={styles.cancelButton}
          testID="cancel-operation-button"
        />
      </View>
    ) : (
      <Button
        title={tagData ? "Reload Tag Data" : "Load Tag Data"}
        onPress={handleReadTag}
        style={styles.loadButton}
        disabled={isReading || isWriting}
        testID="load-tag-button"
      />
    )}

    {/* Helper text when no tag data is loaded */}
    {tagData === null && !isReading && !isWriting && (
      <View style={styles.helperContainer} testID="helper-container">
        <Ionicons name="information-circle-outline" size={48} color="#17a2b8" />
        <Text style={styles.helperTitle}>How to Edit NFC Tags</Text>
        <Text style={styles.helperText}>
          1. Tap "Load Tag Data" above{'\n'}
          2. Hold your NFC tag near the device{'\n'}
          3. Edit the tag's data fields below{'\n'}
          4. Tap "Write to Tag" to save changes
        </Text>
      </View>
    )}

    {(isReading || isWriting) && (
      <View style={styles.readingStatusContainer} testID="operation-status-container">
        <Text style={styles.readingStatusText} testID="operation-status-text">
          {isReading ? "Ready to read... Place NFC tag near device" : "Ready to write... Place NFC tag near device"}
        </Text>
      </View>
    )}

    {tagData !== null && !isReading && !isWriting && (
      <ScrollView
        style={styles.editFieldsContainer}
        contentContainerStyle={styles.editFieldsContentContainer}
        testID="edit-fields-scroll"
        scrollEnabled={!isKeyboardVisible || Platform.OS === 'ios'}
        keyboardShouldPersistTaps="handled"
      >
        {/* Show notice when tag has plain text (non-JSON) content */}
        {Object.keys(editedFields).length > 0 && !firstKey && editedFields.content !== undefined && (
          <View style={styles.plainTextNotice} testID="plain-text-notice">
            <Ionicons name="information-circle" size={20} color="#856404" />
            <Text style={styles.plainTextNoticeText}>
              This tag contains plain text data (not JSON format). You can edit the content below or add new fields.
            </Text>
          </View>
        )}

        {/* Show notice when tag is empty */}
        {Object.keys(editedFields).length === 0 && (
          <View style={styles.emptyTagNotice} testID="empty-tag-notice">
            <Ionicons name="document-outline" size={20} color="#0c5460" />
            <Text style={styles.emptyTagNoticeText}>
              This tag is empty. Add fields below to write data to it.
            </Text>
          </View>
        )}

        {tagData.id && (
          <View style={styles.idField} testID="id-field-container">
            <Text style={styles.fieldLabel} testID="id-field-label">ID (Not Editable):</Text>
            
            {/* Display ID in a read-only TextInput for better visibility and copying functionality */}
            <TextInput
              style={[styles.fieldInput, styles.idValueInput]}
              value={tagData.id}
              editable={false}  // Make it non-editable
              selectTextOnFocus={true}  // Allow selection for copying
              testID="id-field-value-input"
            />
            
            {/* Optional: Add a small helper text */}
            <Text style={styles.idHelperText}>
              Tag ID is preserved during editing and cannot be modified.
              You can select and copy this value if needed.
            </Text>
          </View>
        )}
        
        {/* Existing/Original Fields - Compact single row layout */}
        {Object.entries(editedFields)
          .filter(([key]) => !addedFields.has(key))
          .map(([key, value], index) => {
            const isDeleted = deletedFields.has(key);
            const isModified = isFieldModified(key);

            return (
              <View
                key={key}
                style={[
                  styles.fieldContainer,
                  isDeleted && styles.deletedFieldContainer,
                  isModified && !isDeleted && styles.modifiedFieldContainer,
                ]}
                testID={`field-container-${index}`}
              >
                <View style={[styles.fieldRow, isDeleted && { opacity: 0.5 }]}>
                  {/* Key input */}
                  {key === firstKey ? (
                    <View style={[styles.fieldKeyCompact, styles.uneditableKeyCompact]}>
                      <Text style={[styles.uneditableKeyText, isDeleted && styles.deletedText]} numberOfLines={1}>{key}</Text>
                    </View>
                  ) : (
                    <TextInput
                      style={[
                        styles.fieldKeyCompact,
                        { borderColor: getFieldKeyBorderColor(key) },
                        isDeleted && styles.deletedInput,
                      ]}
                      value={editingKeys[key] !== undefined ? editingKeys[key] : key}
                      onChangeText={(newKey) => handleKeyChange(key, newKey)}
                      onEndEditing={() => handleKeyChangeComplete(key)}
                      placeholder="Key"
                      editable={!isDeleted}
                      testID={`field-key-input-${index}`}
                    />
                  )}

                  {/* Value input */}
                  {key === firstKey ? (
                    <TextInput
                      style={[styles.fieldValueCompact, styles.uneditableValueCompact, isDeleted && styles.deletedInput]}
                      value={value}
                      editable={false}
                      selectTextOnFocus={true}
                      placeholder="Value"
                      testID={`field-value-input-${index}`}
                    />
                  ) : (
                    <TextInput
                      style={[
                        styles.fieldValueCompact,
                        { borderColor: getFieldValueBorderColor(key, value) },
                        isDeleted && styles.deletedInput,
                      ]}
                      value={value}
                      onChangeText={(text) => handleFieldChange(key, text)}
                      placeholder="Value"
                      editable={!isDeleted}
                      testID={`field-value-input-${index}`}
                    />
                  )}

                  {/* Delete/Restore toggle button */}
                  <TouchableOpacity
                    onPress={() => handleDeleteField(key)}
                    testID={`field-delete-button-${index}`}
                    disabled={key === firstKey}
                    style={[styles.deleteButton, key === firstKey && { opacity: 0.3 }]}
                  >
                    <Ionicons
                      name={isDeleted ? "refresh-outline" : "trash-outline"}
                      size={20}
                      color={isDeleted ? "#28a745" : "#ff4c4c"}
                    />
                  </TouchableOpacity>
                </View>

                {/* Show status indicator */}
                {isDeleted && (
                  <Text style={styles.deletedFieldHint}>Marked for deletion - tap restore to recover</Text>
                )}
                {isModified && !isDeleted && (
                  <Text style={styles.modifiedFieldHint}>Modified</Text>
                )}

                {/* Show validation error if JSON is invalid */}
                {jsonValidationState[key] && !jsonValidationState[key].valid && !isDeleted && (
                  <Text style={styles.jsonErrorText}>{jsonValidationState[key].error}</Text>
                )}

                {/* Show hint for primary field */}
                {key === firstKey && (
                  <Text style={styles.primaryFieldHint}>Primary field - read only</Text>
                )}
              </View>
            );
          })}

        {/* Divider for new fields section */}
        {addedFields.size > 0 && (
          <View style={styles.newFieldsDivider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>New Fields</Text>
            <View style={styles.dividerLine} />
          </View>
        )}

        {/* Added/New Fields */}
        {Object.entries(editedFields)
          .filter(([key]) => addedFields.has(key))
          .map(([key, value], index) => {
            const isDeleted = deletedFields.has(key);

            return (
              <View
                key={key}
                style={[
                  styles.fieldContainer,
                  styles.addedFieldContainer,
                  isDeleted && styles.deletedFieldContainer,
                ]}
                testID={`new-field-container-${index}`}
              >
                <View style={[styles.fieldRow, isDeleted && { opacity: 0.5 }]}>
                  {/* Key input */}
                  <TextInput
                    style={[
                      styles.fieldKeyCompact,
                      styles.addedFieldInput,
                      isDeleted && styles.deletedInput,
                    ]}
                    value={editingKeys[key] !== undefined ? editingKeys[key] : key}
                    onChangeText={(newKey) => handleKeyChange(key, newKey)}
                    onEndEditing={() => handleKeyChangeComplete(key)}
                    placeholder="Key"
                    editable={!isDeleted}
                    testID={`new-field-key-input-${index}`}
                  />

                  {/* Value input */}
                  <TextInput
                    style={[
                      styles.fieldValueCompact,
                      styles.addedFieldInput,
                      isDeleted && styles.deletedInput,
                    ]}
                    value={value}
                    onChangeText={(text) => handleFieldChange(key, text)}
                    placeholder="Value"
                    editable={!isDeleted}
                    testID={`new-field-value-input-${index}`}
                  />

                  {/* Delete/Restore toggle button */}
                  <TouchableOpacity
                    onPress={() => handleDeleteField(key)}
                    testID={`new-field-delete-button-${index}`}
                    style={styles.deleteButton}
                  >
                    <Ionicons
                      name={isDeleted ? "refresh-outline" : "trash-outline"}
                      size={20}
                      color={isDeleted ? "#28a745" : "#ff4c4c"}
                    />
                  </TouchableOpacity>
                </View>

                {/* Show status indicator */}
                {isDeleted && (
                  <Text style={styles.deletedFieldHint}>Marked for deletion - tap restore to recover</Text>
                )}
                {!isDeleted && (
                  <Text style={styles.addedFieldHint}>New field</Text>
                )}

                {/* Show validation error if JSON is invalid */}
                {jsonValidationState[key] && !jsonValidationState[key].valid && !isDeleted && (
                  <Text style={styles.jsonErrorText}>{jsonValidationState[key].error}</Text>
                )}
              </View>
            );
          })}
        
        {/* Add New Field */}
        <View style={styles.addFieldContainer} testID="add-field-container">
          <Text style={styles.addFieldTitle} testID="add-field-title">Add New Field</Text>
          <View style={styles.newFieldRow}>
            <TextInput
              style={[styles.fieldInput, styles.newFieldKey]}
              value={newField.key}
              onChangeText={(text) => setNewField(prev => ({ ...prev, key: text }))}
              placeholder="Field Name"
              testID="new-field-key-input"
            />
            <TextInput
              style={[
                styles.fieldInput, 
                styles.newFieldValue,
                isLikelyJSON(newField.value) && !validateJSON(newField.value).valid 
                  ? { borderColor: '#ff4c4c' } 
                  : {}
              ]}
              value={newField.value}
              onChangeText={(text) => setNewField(prev => ({ ...prev, value: text }))}
              placeholder="Field Value"
              testID="new-field-value-input"
            />
            <TouchableOpacity 
              style={styles.addFieldButton}
              onPress={handleAddField}
              testID="add-field-button"
            >
              <Ionicons name="add-circle" size={26} color="#007aff" />
            </TouchableOpacity>
          </View>
          
          {/* Add JSON validation error for new field if needed */}
          {isLikelyJSON(newField.value) && !validateJSON(newField.value).valid && (
            <Text style={styles.jsonErrorText}>{validateJSON(newField.value).error}</Text>
          )}
        </View>

        {/* Change summary */}
        {hasPendingChanges() && (
          <View style={styles.changeSummary} testID="change-summary">
            <Text style={styles.changeSummaryTitle}>Pending Changes:</Text>
            <View style={styles.changeSummaryItems}>
              {Object.keys(editedFields).filter(key => !addedFields.has(key) && isFieldModified(key) && !deletedFields.has(key)).length > 0 && (
                <View style={styles.changeSummaryItem}>
                  <View style={[styles.changeDot, { backgroundColor: '#ffc107' }]} />
                  <Text style={styles.changeSummaryText}>
                    {Object.keys(editedFields).filter(key => !addedFields.has(key) && isFieldModified(key) && !deletedFields.has(key)).length} modified
                  </Text>
                </View>
              )}
              {Array.from(addedFields).filter(key => !deletedFields.has(key)).length > 0 && (
                <View style={styles.changeSummaryItem}>
                  <View style={[styles.changeDot, { backgroundColor: '#4CAF50' }]} />
                  <Text style={styles.changeSummaryText}>
                    {Array.from(addedFields).filter(key => !deletedFields.has(key)).length} new
                  </Text>
                </View>
              )}
              {deletedFields.size > 0 && (
                <View style={styles.changeSummaryItem}>
                  <View style={[styles.changeDot, { backgroundColor: '#f44336' }]} />
                  <Text style={styles.changeSummaryText}>
                    {deletedFields.size} deleted
                  </Text>
                </View>
              )}
              {(newField.key.trim() || newField.value.trim()) && (
                <View style={styles.changeSummaryItem}>
                  <View style={[styles.changeDot, { backgroundColor: '#2196F3' }]} />
                  <Text style={styles.changeSummaryText}>1 pending (auto-add on save)</Text>
                </View>
              )}
            </View>
          </View>
        )}

        <Button
          title="Save Changes to Tag"
          onPress={handleWriteTag}
          disabled={isWriting}
          style={[styles.writeButton, { marginTop: 20, marginBottom: 40 }]}
          testID="save-changes-button"
        />
      </ScrollView>
    )}
    </View>
  </KeyboardAvoidingView>
);
}
// Additional styles
const additionalStyles = {
  nfcTabContent: {
    flex: 1,
    padding: 16,
    paddingBottom: 80, // Add padding to avoid overlap with tab navigation
  },
  editFieldsContainer: {
    flex: 1,
    marginTop: 20,
  },
  editFieldsContentContainer: {
    paddingBottom: 20, // Extra padding at the bottom of the scroll content
  },
  fieldContainer: {
    marginBottom: 12,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fieldKeyCompact: {
    flex: 2,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    fontSize: 14,
    marginRight: 8,
    backgroundColor: '#fff',
  },
  fieldValueCompact: {
    flex: 3,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    fontSize: 14,
    marginRight: 8,
    backgroundColor: '#fff',
  },
  uneditableKeyCompact: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
  },
  uneditableValueCompact: {
    backgroundColor: '#f0f0f0',
    color: '#555',
  },
  deleteButton: {
    padding: 8,
  },
  primaryFieldHint: {
    fontSize: 11,
    color: '#888',
    fontStyle: 'italic',
    marginTop: 4,
    marginLeft: 4,
  },
  fieldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  fieldKeyContainer: {
    flex: 1,
    marginRight: 10,
  },
  fieldKeyInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 8,
    fontSize: 14,
    fontWeight: '500',
    backgroundColor: '#f9f9f9',
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 5,
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    fontSize: 16,
  },
  idField: {
    marginBottom: 15,
    padding: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 5,
  },
  idValueInput: {
    backgroundColor: '#f0f0f0',  // Light gray background to indicate read-only
    color: '#555',  // Darker text to maintain readability
    fontWeight: '500',
    marginTop: 5,
  },
  idHelperText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 5,
  },
  // New styles for uneditable primary key
  uneditableKeyContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 8,
    backgroundColor: '#f0f0f0',
  },
  uneditableKeyText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#555',
  },
  uneditableKeyHelp: {
    fontSize: 10,
    fontStyle: 'italic',
    color: '#777',
    marginTop: 2,
  },

  uneditableValueContainer: {
  marginBottom: 5,
},
uneditableValueInput: {
  backgroundColor: '#f0f0f0',
  color: '#555',
  fontWeight: '500',
  textAlignVertical: 'top',
},
uneditableValueHelp: {
  fontSize: 10,
  fontStyle: 'italic',
  color: '#777',
  marginTop: 2,
},
  addFieldContainer: {
    marginTop: 20,
    marginBottom: 15,
    padding: 15,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  addFieldTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: '#444',
  },
  newFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  newFieldKey: {
    flex: 2,
    marginRight: 10,
  },
  newFieldValue: {
    flex: 3,
    marginRight: 10,
  },
  addFieldButton: {
    padding: 5,
  },
  jsonErrorText: {
    color: '#ff4c4c',
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
  plainTextNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff3cd',
    borderWidth: 1,
    borderColor: '#ffc107',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
  },
  plainTextNoticeText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 13,
    color: '#856404',
    lineHeight: 18,
  },
  emptyTagNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#d1ecf1',
    borderWidth: 1,
    borderColor: '#bee5eb',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
  },
  emptyTagNoticeText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 13,
    color: '#0c5460',
    lineHeight: 18,
  },
  // Change tracking styles
  modifiedFieldContainer: {
    backgroundColor: '#fff8e6',
    borderWidth: 1,
    borderColor: '#ffc107',
    borderRadius: 8,
    padding: 8,
    marginBottom: 12,
  },
  modifiedFieldHint: {
    fontSize: 11,
    color: '#856404',
    fontStyle: 'italic',
    marginTop: 4,
    marginLeft: 4,
  },
  addedFieldContainer: {
    backgroundColor: '#e8f5e9',
    borderWidth: 1,
    borderColor: '#4CAF50',
    borderRadius: 8,
    padding: 8,
    marginBottom: 12,
  },
  addedFieldInput: {
    borderColor: '#4CAF50',
  },
  addedFieldHint: {
    fontSize: 11,
    color: '#2e7d32',
    fontStyle: 'italic',
    marginTop: 4,
    marginLeft: 4,
  },
  deletedFieldContainer: {
    backgroundColor: '#ffebee',
    borderWidth: 1,
    borderColor: '#f44336',
    borderRadius: 8,
    padding: 8,
    marginBottom: 12,
  },
  deletedInput: {
    textDecorationLine: 'line-through',
    color: '#999',
  },
  deletedText: {
    textDecorationLine: 'line-through',
    color: '#999',
  },
  deletedFieldHint: {
    fontSize: 11,
    color: '#c62828',
    fontStyle: 'italic',
    marginTop: 4,
    marginLeft: 4,
  },
  newFieldsDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#4CAF50',
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 12,
    fontWeight: '600',
    color: '#4CAF50',
  },
  // Change summary styles
  changeSummary: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  changeSummaryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 8,
  },
  changeSummaryItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  changeSummaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  changeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  changeSummaryText: {
    fontSize: 13,
    color: '#6c757d',
  },
};

// Merge the additional styles
Object.assign(styles, additionalStyles);

 // <-- Add this closing brace to end the EditTab component

export default EditTab;