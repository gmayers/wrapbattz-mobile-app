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
    try {
      setIsReading(true);
      setTagData(null);
      
      // Initialize NFC Manager
      await NfcManager.start();
      
      await NfcManager.requestTechnology(NfcTech.Ndef);
      
      const tag = await NfcManager.getTag();
      
      if (!tag) {
        Alert.alert('Error', 'No NFC tag detected.');
        return;
      }
      
      if (!tag.ndefMessage || !tag.ndefMessage.length) {
        Alert.alert('Error', 'No NDEF message found on tag.');
        return;
      }
      
      // Process first NDEF record
      const record = tag.ndefMessage[0];
      
      if (record && record.payload) {
        try {
          // Try standard NDEF text decoding
          let textContent;
          try {
            textContent = Ndef.text.decodePayload(record.payload);
          } catch (e) {
            // Manual decoding fallback
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
                textContent = String.fromCharCode.apply(null, uint16Array);
              } else {
                // UTF-8 encoding
                textContent = new TextDecoder().decode(new Uint8Array(textBytes));
              }
            } catch (manualError) {
              // Direct TextDecoder fallback
              try {
                const rawBytes = new Uint8Array(record.payload);
                const statusByte = rawBytes[0];
                const languageLength = statusByte & 0x3F;
                
                // Skip status byte and language code
                const contentBytes = rawBytes.slice(1 + languageLength);
                textContent = new TextDecoder().decode(contentBytes);
              } catch (decoderError) {
                throw e; // rethrow the original error
              }
            }
          }
          
          // Process the content based on its format
          if (textContent && (textContent.startsWith('{') || textContent.startsWith('['))) {
            try {
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
              Alert.alert('Success', 'NFC tag data loaded successfully!');
              return;
            } catch (jsonError) {
              // If all parsing fails, just use the text as is
              setTagData({});
              setEditedFields({ "content": textContent });
              Alert.alert('Partial Success', 'Could not parse structured data. Loaded raw content.');
            }
          } else if (textContent) {
            // Not JSON format, just use the text content
            setTagData({});
            setEditedFields({ "content": textContent });
            Alert.alert('Success', 'Plain text content loaded.');
          } else {
            Alert.alert('Error', 'Tag contains empty or invalid content.');
          }
        } catch (e) {
          Alert.alert('Error', 'Failed to decode tag content.');
        }
      } else {
        Alert.alert('Error', 'Tag contains an invalid NDEF record format.');
      }
    } catch (error) {
      Alert.alert('Error', `Failed to read NFC tag: ${error.message}`);
    } finally {
      // Always cancel technology request when done
      NfcManager.cancelTechnologyRequest();
      setIsReading(false);
    }
  };

  // Improved write function using the recommended pattern
  const handleWriteTag = async () => {
    try {
      // Check for invalid JSON first
      const invalidFields = Object.entries(jsonValidationState)
        .filter(([key, state]) => state && !state.valid)
        .map(([key]) => key);

      if (invalidFields.length > 0) {
        Alert.alert(
          'Invalid JSON Detected', 
          `Please fix the JSON formatting in the following fields: ${invalidFields.join(', ')}`
        );
        return;
      }

      setIsWriting(true);
      
      // Check if there are any fields to write
      if (Object.keys(editedFields).length === 0) {
        Alert.alert('Error', 'There are no fields to write to the tag.');
        setIsWriting(false);
        return;
      }
      
      // Process the data
      
      // Standardize data format - convert values to appropriate format
      const processedData = {};
      
      // Add ID if it exists
      if (tagData?.id) {
        processedData.id = tagData.id;
      }
      
      // Process all other fields
      Object.entries(editedFields).forEach(([key, value]) => {
        // Handle string values that might be JSON
        if (typeof value === 'string' && 
           ((value.startsWith('{') && value.endsWith('}')) || 
            (value.startsWith('[') && value.endsWith(']')))) {
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
      
      // Convert to JSON string with clean quotes
      const jsonString = JSON.stringify(processedData)
        .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
        .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'");
      
      // STEP 1: Request NFC technology
      await NfcManager.requestTechnology(NfcTech.Ndef);
      
      // STEP 2: Create NDEF message bytes
      const bytes = Ndef.encodeMessage([Ndef.textRecord(jsonString)]);
      
      if (bytes) {
        // STEP 3: Write the message to the tag
        await NfcManager.ndefHandler.writeNdefMessage(bytes);
        
        Alert.alert('Success', 'Changes saved to NFC tag successfully!');
      } else {
        throw new Error('Failed to encode NDEF message');
      }
    } catch (error) {
      Alert.alert('Error', `Failed to write changes to NFC tag: ${error.message}`);
    } finally {
      // STEP 4: Always cancel technology request when done
      NfcManager.cancelTechnologyRequest();
      setIsWriting(false);
    }
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