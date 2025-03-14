import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, Alert, TouchableOpacity, Platform } from 'react-native';
import Button from '../../../../components/Button';
import NfcManager, { Ndef } from 'react-native-nfc-manager';
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

const EditTab = ({ withNfcManager, ndefToJson, onCancel }) => {
  const [isReading, setIsReading] = useState(false);
  const [isWriting, setIsWriting] = useState(false);
  const [tagData, setTagData] = useState(null);
  const [editedFields, setEditedFields] = useState({});
  const [newField, setNewField] = useState({ key: '', value: '' });
  
  // Keep debugLogs in state but don't display them in the UI
  const [debugLogs, setDebugLogs] = useState([]);

  const addDebugLog = (message) => {
    console.log(`[EditTab] ${message}`);
    setDebugLogs(prevLogs => [...prevLogs, `[${new Date().toISOString()}] ${message}`]);
  };

  const handleReadTag = async () => {
    try {
      setIsReading(true);
      setTagData(null);
      setDebugLogs([]);
      addDebugLog('Starting read operation to load tag data');
      
      await withNfcManager(async () => {
        addDebugLog('NFC technology acquired');
        
        const tag = await NfcManager.getTag();
        addDebugLog(`Tag detected: ${tag ? 'Yes' : 'No'}`);
        
        if (!tag) {
          addDebugLog('Error: No tag detected');
          Alert.alert('Error', 'No NFC tag detected.');
          return;
        }
        
        addDebugLog(`Tag ID: ${tag.id || 'Unknown'}`);
        addDebugLog(`Tag tech types: ${JSON.stringify(tag.techTypes || [])}`);
        
        if (!tag.ndefMessage || !tag.ndefMessage.length) {
          addDebugLog('Error: No NDEF message found on tag');
          Alert.alert('Error', 'No NDEF message found on tag.');
          return;
        }
        
        addDebugLog(`NDEF message contains ${tag.ndefMessage.length} records`);
        
        // Process first NDEF record
        const record = tag.ndefMessage[0];
        
        addDebugLog(`Record type: ${record?.type ? new TextDecoder().decode(record.type) : 'null'}`);
        
        if (record && record.payload) {
          try {
            // For debugging
            const rawBuffer = new Uint8Array(record.payload);
            addDebugLog(`Raw payload (${rawBuffer.length} bytes): [${Array.from(rawBuffer).slice(0, 20).join(', ')}...]`);
            
            // Try standard NDEF text decoding
            let textContent;
            try {
              textContent = Ndef.text.decodePayload(record.payload);
              addDebugLog(`Standard decoded text: "${textContent}"`);
            } catch (e) {
              addDebugLog(`Error during standard decoding: ${e.message}`);
              
              // Manual decoding fallback
              try {
                // Get a byte array from the payload
                const bytes = [...new Uint8Array(record.payload)];
                
                // First byte contains status and language length
                const statusByte = bytes[0];
                const languageLength = statusByte & 0x3F;
                const isUTF16 = !(statusByte & 0x80);
                
                addDebugLog(`Manual decode - Status byte: ${statusByte}, Language length: ${languageLength}, Encoding: ${isUTF16 ? 'UTF-16' : 'UTF-8'}`);
                
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
                
                addDebugLog(`Manually decoded text: "${textContent}"`);
              } catch (manualError) {
                addDebugLog(`Manual decoding failed: ${manualError.message}`);
                
                // Direct TextDecoder fallback
                try {
                  const rawBytes = new Uint8Array(record.payload);
                  const statusByte = rawBytes[0];
                  const languageLength = statusByte & 0x3F;
                  
                  // Skip status byte and language code
                  const contentBytes = rawBytes.slice(1 + languageLength);
                  textContent = new TextDecoder().decode(contentBytes);
                  
                  addDebugLog(`TextDecoder fallback result: "${textContent}"`);
                } catch (decoderError) {
                  addDebugLog(`TextDecoder fallback failed: ${decoderError.message}`);
                  throw e; // rethrow the original error
                }
              }
            }
            
            // Process the content based on its format
            if (textContent && (textContent.startsWith('{') || textContent.startsWith('['))) {
              try {
                // Normalize and clean JSON string
                const cleanJson = normalizeJsonString(textContent.trim());
                addDebugLog(`Normalized JSON: ${cleanJson.substring(0, 100)}${cleanJson.length > 100 ? '...' : ''}`);
                
                // Parse the JSON
                const jsonData = JSON.parse(cleanJson);
                addDebugLog(`Parsed JSON data successfully`);
                
                // Separate the ID field (if it exists) from other editable fields
                const { id, ...editableData } = jsonData;
                
                // Create a clean object for tagData and editedFields
                const tagDataObj = id ? { id } : {};
                
                // Convert all fields to strings for the TextInput component
                const editableFields = {};
                Object.entries(editableData).forEach(([key, value]) => {
                  addDebugLog(`Processing field "${key}" with value type: ${typeof value}`);
                  if (typeof value === 'object' && value !== null) {
                    // Properly stringify objects
                    editableFields[key] = JSON.stringify(value);
                  } else {
                    // Convert primitives to string
                    editableFields[key] = String(value);
                  }
                });
                
                setTagData(tagDataObj);
                setEditedFields(editableFields);
                Alert.alert('Success', 'NFC tag data loaded successfully!');
                return;
              } catch (jsonError) {
                addDebugLog(`JSON parse error: ${jsonError.message}`);
                
                // Try using ndefToJson as a fallback
                try {
                  addDebugLog('Attempting to use ndefToJson helper');
                  const fallbackData = ndefToJson(tag);
                  if (fallbackData && Object.keys(fallbackData).length > 0) {
                    addDebugLog(`Successfully used ndefToJson as fallback: ${JSON.stringify(fallbackData)}`);
                    
                    const { id, ...editableData } = fallbackData;
                    const tagDataObj = id ? { id } : {};
                    
                    const editableFields = {};
                    Object.entries(editableData).forEach(([key, value]) => {
                      if (typeof value === 'object' && value !== null) {
                        editableFields[key] = JSON.stringify(value);
                      } else {
                        editableFields[key] = String(value);
                      }
                    });
                    
                    setTagData(tagDataObj);
                    setEditedFields(editableFields);
                    Alert.alert('Success', 'NFC tag data loaded successfully (using fallback method)!');
                    return;
                  }
                } catch (fallbackError) {
                  addDebugLog(`ndefToJson fallback failed: ${fallbackError.message}`);
                }
                
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
              addDebugLog('Error: Empty or invalid text content');
              Alert.alert('Error', 'Tag contains empty or invalid content.');
            }
          } catch (e) {
            addDebugLog(`Error decoding payload: ${e.message}`);
            Alert.alert('Error', 'Failed to decode tag content.');
          }
        } else {
          addDebugLog('Error: Invalid record format');
          Alert.alert('Error', 'Tag contains an invalid NDEF record format.');
        }
      });
    } catch (error) {
      addDebugLog(`Error in read operation: ${error.message}`);
      Alert.alert('Error', `Failed to read NFC tag: ${error.message}`);
    } finally {
      setIsReading(false);
      addDebugLog('Read operation completed');
    }
  };

  // Unified write function that works on both iOS and Android
  const writeToNfcTag = async (jsonData) => {
    try {
      addDebugLog(`Starting write operation for platform: ${Platform.OS}`);
      
      // Standardize data format - convert all values to appropriate format
      const processedData = {};
      Object.entries(jsonData).forEach(([key, value]) => {
        addDebugLog(`Processing field "${key}" (type: ${typeof value})`);
        
        // Handle string values that might be JSON
        if (typeof value === 'string' && 
           ((value.startsWith('{') && value.endsWith('}')) || 
            (value.startsWith('[') && value.endsWith(']')))) {
          try {
            processedData[key] = JSON.parse(value);
            addDebugLog(`Parsed JSON string for field "${key}"`);
          } catch (e) {
            // If parsing fails, use as string
            processedData[key] = value;
            addDebugLog(`Failed to parse JSON string for field "${key}", using as string`);
          }
        } else if (typeof value === 'number') {
          // Convert numbers to strings for iOS compatibility
          processedData[key] = Platform.OS === 'ios' ? String(value) : value;
          if (Platform.OS === 'ios') {
            addDebugLog(`Converting number to string for iOS: ${key} = ${value} → "${String(value)}"`);
          }
        } else {
          processedData[key] = value;
        }
      });
      
      // Convert JSON to string with clean quotes
      const jsonString = JSON.stringify(processedData)
        .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
        .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'");
      
      addDebugLog(`JSON string to write: ${jsonString}`);

      // Create a standard NDEF Text Record
      const textRecord = Ndef.textRecord(jsonString);
      addDebugLog('Created NDEF text record using standard method');
      
      // Write to tag
      addDebugLog('Writing NDEF message to tag');
      await NfcManager.writeNdefMessage([textRecord]);
      addDebugLog('Successfully wrote NDEF message');
      
      return true;
    } catch (error) {
      addDebugLog(`Write failed: ${error.message}`);
      throw error;
    }
  };

  const handleWriteTag = async () => {
    try {
      setIsWriting(true);
      addDebugLog('Starting write operation');
      
      // Check if there are any fields to write
      if (Object.keys(editedFields).length === 0) {
        addDebugLog('No fields to write');
        Alert.alert('Error', 'There are no fields to write to the tag.');
        setIsWriting(false);
        return;
      }
      
      // Combine ID field with edited fields
      const dataToWrite = tagData?.id 
        ? { id: tagData.id, ...editedFields }
        : editedFields;
      
      addDebugLog(`Preparing to write ${Object.keys(dataToWrite).length} fields`);
      
      await withNfcManager(async () => {
        addDebugLog('NFC technology acquired');
        
        // Use the unified write function
        await writeToNfcTag(dataToWrite);
        
        addDebugLog('Write operation completed successfully');
        Alert.alert('Success', 'Changes saved to NFC tag successfully!');
      });
    } catch (error) {
      addDebugLog(`Error in write operation: ${error.message}`);
      Alert.alert('Error', `Failed to write changes to NFC tag: ${error.message}`);
    } finally {
      setIsWriting(false);
      addDebugLog('Write operation completed');
    }
  };

  const handleFieldChange = (key, value) => {
    setEditedFields(prev => ({
      ...prev,
      [key]: value
    }));
    addDebugLog(`Updated field value for "${key}"`);
  };

  const handleKeyChange = (oldKey, newKey) => {
    if (!newKey.trim()) {
      Alert.alert('Error', 'Field name cannot be empty');
      return;
    }
    
    if (oldKey === newKey) {
      return; // No change needed
    }
    
    if (editedFields.hasOwnProperty(newKey)) {
      Alert.alert('Error', `Field "${newKey}" already exists`);
      return;
    }
    
    setEditedFields(prev => {
      const updatedFields = { ...prev };
      const value = updatedFields[oldKey];
      delete updatedFields[oldKey];
      updatedFields[newKey] = value;
      return updatedFields;
    });
    
    addDebugLog(`Renamed field "${oldKey}" to "${newKey}"`);
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
    
    // Add the new field to editedFields
    setEditedFields(prev => ({
      ...prev,
      [newField.key.trim()]: newField.value
    }));
    
    // Reset the new field inputs
    setNewField({ key: '', value: '' });
    
    addDebugLog(`Added new field: ${newField.key.trim()} = ${newField.value}`);
  };

  const handleDeleteField = (key) => {
    setEditedFields(prev => {
      const updated = { ...prev };
      delete updated[key];
      return updated;
    });
    
    addDebugLog(`Deleted field: ${key}`);
  };

  const cancelOperation = () => {
    if (isReading || isWriting) {
      setIsReading(false);
      setIsWriting(false);
      addDebugLog('Operation cancelled by user');
      onCancel?.();
    }
  };

  return (
    <View style={styles.nfcTabContent}>
      <Text style={styles.nfcTabTitle}>Edit NFC Tag</Text>
      <Text style={styles.nfcTabSubtitle}>
        Read the NFC tag to load existing data into the form, make changes, and save.
      </Text>

      {isReading || isWriting ? (
        <View style={styles.buttonGroup}>
          <Button
            title="Cancel Operation"
            onPress={cancelOperation}
            style={styles.cancelButton}
          />
        </View>
      ) : (
        <Button
          title={tagData ? "Reload Tag Data" : "Load Tag Data"}
          onPress={handleReadTag}
          style={styles.loadButton}
          disabled={isReading || isWriting}
        />
      )}

      {(isReading || isWriting) && (
        <View style={styles.readingStatusContainer}>
          <Text style={styles.readingStatusText}>
            {isReading ? "Ready to read... Place NFC tag near device" : "Ready to write... Place NFC tag near device"}
          </Text>
        </View>
      )}

      {tagData !== null && !isReading && !isWriting && (
        <ScrollView style={styles.editFieldsContainer} contentContainerStyle={styles.editFieldsContentContainer}>
          {tagData.id && (
            <View style={styles.idField}>
              <Text style={styles.fieldLabel}>ID (Not Editable):</Text>
              <Text style={styles.idValue}>{tagData.id}</Text>
            </View>
          )}
          
          {/* Existing Fields */}
          {Object.entries(editedFields).map(([key, value]) => (
            <View key={key} style={styles.fieldContainer}>
              <View style={styles.fieldHeader}>
                <View style={styles.fieldKeyContainer}>
                  <TextInput
                    style={styles.fieldKeyInput}
                    value={key}
                    onChangeText={(newKey) => {}}
                    onEndEditing={(e) => handleKeyChange(key, e.nativeEvent.text)}
                    placeholder="Field Name"
                  />
                </View>
                <TouchableOpacity onPress={() => handleDeleteField(key)}>
                  <Ionicons name="trash-outline" size={18} color="#ff4c4c" />
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.fieldInput}
                value={value}
                onChangeText={(text) => handleFieldChange(key, text)}
                placeholder={`Enter ${key}`}
                multiline={value && value.length > 40}
              />
            </View>
          ))}
          
          {/* Add New Field */}
          <View style={styles.addFieldContainer}>
            <Text style={styles.addFieldTitle}>Add New Field</Text>
            <View style={styles.newFieldRow}>
              <TextInput
                style={[styles.fieldInput, styles.newFieldKey]}
                value={newField.key}
                onChangeText={(text) => setNewField(prev => ({ ...prev, key: text }))}
                placeholder="Field Name"
              />
              <TextInput
                style={[styles.fieldInput, styles.newFieldValue]}
                value={newField.value}
                onChangeText={(text) => setNewField(prev => ({ ...prev, value: text }))}
                placeholder="Field Value"
              />
              <TouchableOpacity 
                style={styles.addFieldButton}
                onPress={handleAddField}
              >
                <Ionicons name="add-circle" size={26} color="#007aff" />
              </TouchableOpacity>
            </View>
          </View>

          <Button
            title="Save Changes to Tag"
            onPress={handleWriteTag}
            disabled={isWriting}
            style={[styles.writeButton, { marginTop: 20, marginBottom: 40 }]}
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
};

// Merge the additional styles
Object.assign(styles, additionalStyles);

export default EditTab;