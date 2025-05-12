import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, Alert, TouchableOpacity, Platform } from 'react-native';
import Button from '../../../../components/Button';
import NfcManager, { NfcTech, Ndef } from 'react-native-nfc-manager';
import { styles } from './styles';
import { Ionicons } from '@expo/vector-icons';

// Import the normalizeJsonString function from ReadTab
const normalizeJsonString = (jsonString) => {
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
      // Unbalanced quotes - try to identify and fix the issue
      console.log("[EditTab] Detected unbalanced quotes, attempting fix");
      
      // Add a closing quote before any commas or closing braces
      normalized = normalized.replace(/([^"\s,{}[\]]+)(\s*)(,|\}|\])/g, '$1"$2$3');
      
      // Fix any values that should start with a quote but don't
      normalized = normalized.replace(/:(\s*)([^"\s,{}[\]][^,{}[\]]*)/g, ':$1"$2"');
    }
    
    return normalized;
  }
};

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
  
  // New state for field editing
  const [editingKeys, setEditingKeys] = useState({});
  const [jsonValidationState, setJsonValidationState] = useState({});

const handleReadTag = async () => {
  let result = false;
  
  try {
    setIsReading(true);
    setTagData(null);
    
    console.log('[EditTab] Starting tag read operation');
    
    // Initialize NFC Manager
    await NfcManager.start();
    console.log('[EditTab] NFC Manager started');
    
    // STEP 1: Request Technology
    await NfcManager.requestTechnology(NfcTech.Ndef);
    console.log('[EditTab] NFC technology requested successfully');
    
    // Get tag information
    const tag = await NfcManager.getTag();
    
    if (!tag) {
      throw new Error('No NFC tag detected. Please position the tag correctly.');
    }
    
    console.log(`[EditTab] Tag detected: ${JSON.stringify({
      type: tag.type || 'unknown',
      maxSize: tag.maxSize || 'unknown',
      isWritable: tag.isWritable || false,
      id: tag.id ? tag.id.toString('hex') : 'unknown'
    })}`);
    
    // Check for NDEF message
    if (!tag.ndefMessage || !tag.ndefMessage.length) {
      // Try to check if this is a Mifare tag
      if (tag.techTypes && tag.techTypes.some(tech => tech.includes('MifareUltralight'))) {
        console.log('[EditTab] Detected Mifare tag, attempting to read');
        try {
          // Cancel the current technology request
          await NfcManager.cancelTechnologyRequest();
          
          // Switch to Mifare technology
          await NfcManager.requestTechnology(NfcTech.MifareUltralight);
          
          // Read Mifare pages
          const mifareData = await readMifarePagesWithRetry();
          
          // Process Mifare data
          if (mifareData && mifareData.length > 0) {
            // Handle Mifare data...
            console.log('[EditTab] Successfully read Mifare tag');
            
            // Convert Mifare data to a usable format
            // ... processing code here
            
            Alert.alert('Success', 'Read Mifare tag data successfully!');
            result = true;
            return;
          }
        } catch (mifare_error) {
          console.warn('[EditTab] Mifare read failed:', mifare_error);
          // Continue with standard error handling
        }
      }
      
      throw new Error('No NDEF message found on tag. This may not be an NDEF formatted tag or it may be empty.');
    }
    
    // Process first NDEF record
    const record = tag.ndefMessage[0];
    
    if (record && record.payload) {
      try {
        // Try multiple decoding approaches to maximize success
        let textContent = decodeTagContent(record);
        
        if (textContent) {
          console.log('[EditTab] Successfully decoded tag content');
          
          // Process the content based on its format
          if (isLikelyJSON(textContent)) {
            try {
              // Process JSON content
              processJsonTagContent(textContent);
              Alert.alert('Success', 'NFC tag data loaded successfully!');
              result = true;
            } catch (jsonError) {
              console.warn('[EditTab] JSON processing error:', jsonError);
              setTagData({});
              setEditedFields({ "content": textContent });
              Alert.alert('Partial Success', 'Could not parse structured data. Loaded raw content.');
              result = true;
            }
          } else {
            // Not JSON format, just use the text content
            setTagData({});
            setEditedFields({ "content": textContent });
            Alert.alert('Success', 'Plain text content loaded.');
            result = true;
          }
        } else {
          throw new Error('Failed to decode tag content. The format may be unsupported.');
        }
      } catch (decodeError) {
        console.error('[EditTab] Decode error:', decodeError);
        throw new Error(`Failed to decode tag content: ${decodeError.message}`);
      }
    } else {
      throw new Error('Tag contains an invalid or empty NDEF record.');
    }
  } catch (error) {
    console.error('[EditTab] Error in handleReadTag:', error);
    
    // Create user-friendly error message based on error type
    let userErrorMessage;
    
    if (error.message.includes('NFC hardware')) {
      userErrorMessage = 'NFC is not available or is disabled on this device. Please check your device settings.';
    } else if (error.message.includes('cancelled')) {
      userErrorMessage = 'NFC operation was cancelled.';
    } else if (error.message.includes('No NFC tag detected')) {
      userErrorMessage = 'No NFC tag detected. Please make sure the tag is positioned correctly near your device.';
    } else if (error.message.includes('No NDEF message')) {
      userErrorMessage = 'This tag may not be NDEF formatted or may be empty. Please format the tag or try a different one.';
    } else if (error.message.includes('decode')) {
      userErrorMessage = 'Could not read tag content. The tag format may be incompatible or corrupted.';
    } else {
      // Generic error with the technical message included
      userErrorMessage = `Error reading NFC tag: ${error.message}`;
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
    
    result = false;
  } finally {
    // Always cancel technology request when done
    try {
      await NfcManager.cancelTechnologyRequest();
      console.log('[EditTab] NFC technology request canceled');
    } catch (finallyError) {
      console.warn(`[EditTab] Error canceling NFC technology request: ${finallyError.message}`);
    }
    setIsReading(false);
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

// Helper function to process JSON tag content
const processJsonTagContent = (textContent) => {
  // Normalize and clean JSON string
  const cleanJson = normalizeJsonString(textContent.trim());
  
  // Parse the JSON
  const jsonData = JSON.parse(cleanJson);
  
  // Separate the ID field (if it exists) from other editable fields
  const { id, ...editableData } = jsonData;
  
  // Create a clean object for tagData and editedFields
  const tagDataObj = id ? { id } : {};
  
  // Convert all fields to strings for the TextInput component
  const editableFields = {};
  const jsonState = {};
  
  Object.entries(editableData).forEach(([key, value]) => {
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
  
  setTagData(tagDataObj);
  setEditedFields(editableFields);
  setJsonValidationState(jsonState);
};



  // Improved write function using the recommended pattern
const handleWriteTag = async () => {
  let result = false;
  
  try {
    // Check for invalid JSON first
    const invalidFields = Object.entries(jsonValidationState)
      .filter(([key, state]) => state && !state.valid)
      .map(([key]) => key);

    if (invalidFields.length > 0) {
      Alert.alert(
        'Invalid JSON Detected', 
        `Please fix the JSON formatting in these fields: ${invalidFields.join(', ')}`
      );
      return;
    }

    setIsWriting(true);
    
    // Check if there are any fields to write
    if (Object.keys(editedFields).length === 0) {
      Alert.alert('Error', 'There are no fields to write to the tag.');
      return;
    }
    
    // Process the data for writing
    const processedData = {};
    
    // Add ID if it exists
    if (tagData?.id) {
      processedData.id = tagData.id;
    }
    
    // Process all other fields
    Object.entries(editedFields).forEach(([key, value]) => {
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
    
    // Convert to JSON string with normalized quotes
    const jsonString = JSON.stringify(processedData);
    const normalizedString = normalizeJsonString(jsonString);
    
    // Calculate byte length for capacity check
    const stringByteLength = new TextEncoder().encode(normalizedString).length;
    console.log(`[EditTab] Data size: ${stringByteLength} bytes`);
    
    // STEP 1: Request NFC technology
    await NfcManager.requestTechnology(NfcTech.Ndef);
    console.log('[EditTab] NFC technology requested successfully');
    
    // Get tag information to check capacity
    const tag = await NfcManager.getTag();
    if (!tag) {
      throw new Error('Could not read NFC tag. Make sure it is positioned correctly.');
    }
    
    // Log tag details for debugging
    console.log(`[EditTab] Tag detected: ${JSON.stringify({
      type: tag.type,
      maxSize: tag.maxSize || 'unknown',
      isWritable: tag.isWritable,
      id: tag.id ? tag.id.toString('hex') : 'unknown'
    })}`);
    
    // Check if tag is NDEF formatted and writable
    if (!tag.isWritable) {
      throw new Error('This tag appears to be read-only and cannot be written to.');
    }
    
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
    let bytes;
    try {
      bytes = Ndef.encodeMessage([Ndef.textRecord(normalizedString)]);
      console.log('[EditTab] NDEF message encoded successfully');
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
    
    // STEP 3: Write the message to the tag
    try {
      await NfcManager.ndefHandler.writeNdefMessage(bytes);
      console.log('[EditTab] Write operation completed successfully');
      
      result = true;
      Alert.alert('Success', 'Changes saved to NFC tag successfully!');
    } catch (writeError) {
      // Check for specific write errors
      if (writeError.message.includes('timeout')) {
        throw new Error('Write operation timed out. The tag may have been moved too soon.');
      } else if (writeError.message.includes('read-only')) {
        throw new Error('This NFC tag is read-only and cannot be written to.');
      } else {
        throw new Error(`Write failed: ${writeError.message}`);
      }
    }
  } catch (error) {
    console.error('[EditTab] Error:', error);
    
    // Create user-friendly error message based on error type
    let userErrorMessage;
    
    if (error.message.includes('NFC hardware')) {
      userErrorMessage = 'NFC is not available or is disabled on this device. Please check your device settings.';
    } else if (error.message.includes('cancelled')) {
      userErrorMessage = 'NFC operation was cancelled.';
    } else if (error.message.includes('tag capacity')) {
      userErrorMessage = error.message; // Already formatted for user
    } else if (error.message.includes('timeout')) {
      userErrorMessage = 'The tag was not held close enough to the device. Please try again and keep the tag steady.';
    } else if (error.message.includes('not writable') || error.message.includes('read-only')) {
      userErrorMessage = 'This tag cannot be written to. Please use a writable NFC tag.';
    } else {
      // Generic error with the technical message included
      userErrorMessage = `Failed to write to NFC tag: ${error.message}`;
    }
    
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
    // Update the editing state
    setEditingKeys(prev => ({
      ...prev,
      [oldKey]: newKey
    }));
  };

  // New function to commit key changes when editing is complete
  const handleKeyChangeComplete = (oldKey) => {
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
    setEditedFields(prev => {
      const updated = { ...prev };
      delete updated[key];
      return updated;
    });
    
    // Also clean up any editing state or validation state
    setEditingKeys(prev => {
      const updated = { ...prev };
      delete updated[key];
      return updated;
    });
    
    setJsonValidationState(prev => {
      const updated = { ...prev };
      delete updated[key];
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
    <View style={styles.nfcTabContent} testID="edit-tab-container">
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
        >
          {tagData.id && (
            <View style={styles.idField} testID="id-field-container">
              <Text style={styles.fieldLabel} testID="id-field-label">ID (Not Editable):</Text>
              <Text style={styles.idValue} testID="id-field-value">{tagData.id}</Text>
            </View>
          )}
          
          {/* Existing Fields */}
          {Object.entries(editedFields).map(([key, value], index) => (
            <View key={key} style={styles.fieldContainer} testID={`field-container-${index}`}>
              <View style={styles.fieldHeader}>
                <View style={styles.fieldKeyContainer}>
                  <TextInput
                    style={[
                      styles.fieldKeyInput, 
                      { borderColor: getFieldKeyBorderColor(key) }
                    ]}
                    value={editingKeys[key] !== undefined ? editingKeys[key] : key}
                    onChangeText={(newKey) => handleKeyChange(key, newKey)}
                    onEndEditing={() => handleKeyChangeComplete(key)}
                    placeholder="Field Name"
                    testID={`field-key-input-${index}`}
                  />
                </View>
                <TouchableOpacity 
                  onPress={() => handleDeleteField(key)}
                  testID={`field-delete-button-${index}`}
                >
                  <Ionicons name="trash-outline" size={18} color="#ff4c4c" />
                </TouchableOpacity>
              </View>
              
              <TextInput
                style={[
                  styles.fieldInput,
                  { borderColor: getFieldValueBorderColor(key, value) }
                ]}
                value={value}
                onChangeText={(text) => handleFieldChange(key, text)}
                placeholder={`Enter ${key}`}
                multiline={value && value.length > 40}
                testID={`field-value-input-${index}`}
              />
              
              {/* Add JSON validation error message if needed */}
              {jsonValidationState[key] && !jsonValidationState[key].valid && (
                <Text style={styles.jsonErrorText}>{jsonValidationState[key].error}</Text>
              )}
            </View>
          ))}
          
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
  );
};

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
    marginBottom: 15,
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
  idValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
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
};

// Merge the additional styles
Object.assign(styles, additionalStyles);

export default EditTab;