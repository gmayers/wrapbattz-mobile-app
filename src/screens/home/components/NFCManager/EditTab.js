import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, Alert, TouchableOpacity, Platform, KeyboardAvoidingView, Keyboard } from 'react-native';
import Button from '../../../../components/Button';
import { nfcService } from '../../../../services/NFCService';
import { styles } from './styles';
import { Ionicons } from '@expo/vector-icons';
import NfcManager, { NfcTech, Ndef } from 'react-native-nfc-manager';


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
  const [firstKey, setFirstKey] = useState(null); // New state to track the first key
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  
  // New state for field editing
  const [editingKeys, setEditingKeys] = useState({});
  const [jsonValidationState, setJsonValidationState] = useState({});

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
  
  try {
    setIsReading(true);
    setTagData(null);
    setEditedFields({});
    
    console.log('[EditTab] Starting enhanced tag read with NFCService');
    
    // Use the enhanced NFCService for reading
    const readResult = await nfcService.readNFC({ timeout: 60000 });
    
    if (readResult.success) {
      console.log('[EditTab] Successfully read tag using NFCService');

      // Handle empty tags - allow editing from scratch
      if (readResult.data?.isEmpty) {
        console.log('[EditTab] Tag is empty, starting with blank editor');
        setTagData({});
        setEditedFields({});
        setFirstKey(null);
        Alert.alert('Empty Tag', 'Tag is formatted but empty. You can add new fields below.');
        result = true;
        return result;
      }

      if (readResult.data?.parsedData) {
        // Handle structured JSON data
        const jsonData = readResult.data.parsedData;
        
        if (typeof jsonData === 'object' && jsonData !== null && !Array.isArray(jsonData)) {
          // Set the first key to maintain EditTab functionality
          const keys = Object.keys(jsonData);
          if (keys.length > 0) {
            setFirstKey(keys[0]);
          }
          
          setTagData(jsonData);
          setEditedFields({ ...jsonData });
          
          Alert.alert('Success', 'NFC tag data loaded successfully!');
          result = true;
        } else {
          // Handle non-object data
          setTagData({});
          setEditedFields({ "content": JSON.stringify(jsonData) });
          Alert.alert('Success', 'Tag content loaded.');
          result = true;
        }
      } else if (readResult.data?.content) {
        // Handle plain text content
        setTagData({});
        setEditedFields({ "content": readResult.data.content });
        Alert.alert('Success', 'Plain text content loaded.');
        result = true;
      } else if (readResult.data?.jsonString) {
        // Try to parse JSON string
        try {
          const parsed = JSON.parse(readResult.data.jsonString);
          
          if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
            const keys = Object.keys(parsed);
            if (keys.length > 0) {
              setFirstKey(keys[0]);
            }
            
            setTagData(parsed);
            setEditedFields({ ...parsed });
            Alert.alert('Success', 'NFC tag data loaded successfully!');
            result = true;
          } else {
            setTagData({});
            setEditedFields({ "content": readResult.data.jsonString });
            Alert.alert('Success', 'Tag content loaded.');
            result = true;
          }
        } catch (e) {
          setTagData({});
          setEditedFields({ "content": readResult.data.jsonString });
          Alert.alert('Success', 'Raw content loaded.');
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

// Improved write function with iOS-specific optimizations
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
    
    // iOS-specific: Ensure NFC is properly initialized
    if (Platform.OS === 'ios') {
      try {
        await NfcManager.start();
        console.log('[EditTab] NFC Manager started for iOS');
      } catch (startError) {
        console.warn('[EditTab] NFC Manager already started or error:', startError);
      }
    }
    
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
    
    // Convert to JSON string (NFCService handles normalization)
    const jsonString = JSON.stringify(processedData);
    let normalizedString = jsonString; // Use let so we can reassign if needed for compact version

    // Calculate byte length for capacity check
    const stringByteLength = new TextEncoder().encode(normalizedString).length;
    console.log(`[EditTab] Data size: ${stringByteLength} bytes`);
    
    // STEP 1: Request NFC technology with iOS-specific timeout
    const technologyRequest = Platform.OS === 'ios' 
      ? NfcManager.requestTechnology(NfcTech.Ndef, { timeout: 60000 }) // 60 seconds for iOS
      : NfcManager.requestTechnology(NfcTech.Ndef);
    
    await technologyRequest;
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
    
    // STEP 3: Write the message to the tag with platform-specific handling
    try {
      if (Platform.OS === 'ios') {
        // iOS-specific write with retry mechanism
        let writeAttempts = 0;
        const maxAttempts = 3;
        
        while (writeAttempts < maxAttempts) {
          try {
            await NfcManager.ndefHandler.writeNdefMessage(bytes);
            console.log(`[EditTab] iOS write operation completed successfully on attempt ${writeAttempts + 1}`);
            break;
          } catch (iosWriteError) {
            writeAttempts++;
            console.warn(`[EditTab] iOS write attempt ${writeAttempts} failed:`, iosWriteError);
            
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
        console.log('[EditTab] Android write operation completed successfully');
      }
      
      result = true;
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
  // Prevent deleting the first key
  if (key === firstKey) {
    Alert.alert('Error', 'The primary field cannot be deleted.');
    return;
  }
  
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
  <KeyboardAvoidingView 
    style={styles.nfcTabContent} 
    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
  >
    <View testID="edit-tab-container">
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
        
        {/* Existing Fields */}
        {Object.entries(editedFields).map(([key, value], index) => (
          <View key={key} style={styles.fieldContainer} testID={`field-container-${index}`}>
            <View style={styles.fieldHeader}>
              <View style={styles.fieldKeyContainer}>
                {key === firstKey ? (
                  // For the first key, render as non-editable
                  <View style={styles.uneditableKeyContainer}>
                    <Text style={styles.uneditableKeyText}>{key}</Text>
                    <Text style={styles.uneditableKeyHelp}>(Primary key - cannot be modified)</Text>
                  </View>
                ) : (
                  // For all other keys, use editable TextInput
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
                )}
              </View>
              <TouchableOpacity 
                onPress={() => handleDeleteField(key)}
                testID={`field-delete-button-${index}`}
                disabled={key === firstKey} // Disable delete button for first key
                style={key === firstKey ? { opacity: 0.5 } : {}} // Visual indication that it's disabled
              >
                <Ionicons name="trash-outline" size={18} color="#ff4c4c" />
              </TouchableOpacity>
            </View>
            
            {/* For the first key, show value in a read-only field */}
            {key === firstKey ? (
              <View style={styles.uneditableValueContainer}>
                <TextInput
                  style={[
                    styles.fieldInput,
                    styles.uneditableValueInput,
                    { minHeight: value && value.length > 40 ? 100 : 40 }
                  ]}
                  value={value}
                  editable={false}
                  selectTextOnFocus={true}  // Still allow selection for copying
                  multiline={true}
                  testID={`field-value-input-${index}`}
                />
                <Text style={styles.uneditableValueHelp}>
                  Primary field value - cannot be modified. Select to copy.
                </Text>
              </View>
            ) : (
              // For all other fields, use editable TextInput
              <TextInput
                style={[
                  styles.fieldInput,
                  { 
                    borderColor: getFieldValueBorderColor(key, value),
                    minHeight: value && value.length > 40 ? 100 : 40,
                    textAlignVertical: 'top'  // Helps with Android text positioning
                  }
                ]}
                value={value}
                onChangeText={(text) => handleFieldChange(key, text)}
                placeholder={`Enter ${key}`}
                multiline={true}  // Always set to true instead of conditionally
                testID={`field-value-input-${index}`}
              />
            )}
            
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
};

// Merge the additional styles
Object.assign(styles, additionalStyles);

 // <-- Add this closing brace to end the EditTab component

export default EditTab;