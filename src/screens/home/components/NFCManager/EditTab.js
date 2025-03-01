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
            
            // Analyze first few bytes for debugging
            if (rawBuffer.length > 0) {
              const statusByte = rawBuffer[0];
              const languageLength = statusByte & 0x3F;
              const isUTF16 = !(statusByte & 0x80);
              
              addDebugLog(`Status byte: ${statusByte}, Language length: ${languageLength}, Encoding: ${isUTF16 ? 'UTF-16' : 'UTF-8'}`);
            }
            
            // Decode the NDEF Text Record payload
            let textContent;
            try {
              // First, log the raw payload for debugging
              const rawBuffer = new Uint8Array(record.payload);
              addDebugLog(`Raw payload (${rawBuffer.length} bytes): [${Array.from(rawBuffer).join(', ')}]`);
              addDebugLog(`Raw payload (hex): ${Array.from(rawBuffer).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
              
              // Try to understand the payload format
              if (rawBuffer.length > 0) {
                const statusByte = rawBuffer[0];
                const languageLength = statusByte & 0x3F;
                const isUTF16 = !(statusByte & 0x80);
                
                addDebugLog(`Status byte: ${statusByte} (${statusByte.toString(16)}h)`);
                addDebugLog(`Language code length: ${languageLength}`);
                addDebugLog(`Encoding: ${isUTF16 ? 'UTF-16' : 'UTF-8'}`);
                
                if (rawBuffer.length > 1 + languageLength) {
                  const langCode = Array.from(rawBuffer.slice(1, 1 + languageLength))
                    .map(code => String.fromCharCode(code))
                    .join('');
                  addDebugLog(`Language code: "${langCode}"`);
                }
              }
              
              // Try standard NDEF text decoding
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
                addDebugLog(`Text bytes length: ${textBytes.length}`);
                addDebugLog(`First few text bytes: [${textBytes.slice(0, Math.min(10, textBytes.length)).join(', ')}${textBytes.length > 10 ? '...' : ''}]`);
                
                // Convert to string based on encoding
                if (isUTF16) {
                  // UTF-16 encoding
                  addDebugLog('Attempting UTF-16 decoding');
                  const uint16Array = new Uint16Array(textBytes.length / 2);
                  for (let i = 0; i < textBytes.length; i += 2) {
                    uint16Array[i / 2] = (textBytes[i] << 8) | textBytes[i + 1];
                  }
                  textContent = String.fromCharCode.apply(null, uint16Array);
                } else {
                  // UTF-8 encoding
                  addDebugLog('Attempting UTF-8 decoding');
                  textContent = new TextDecoder().decode(new Uint8Array(textBytes));
                }
                
                addDebugLog(`Manually decoded text: "${textContent}"`);
              } catch (manualError) {
                addDebugLog(`Manual decoding failed: ${manualError.message}`);
                
                // One more attempt with direct TextDecoder
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
                  if (typeof value === 'object') {
                    editableFields[key] = JSON.stringify(value);
                  } else {
                    editableFields[key] = String(value);
                  }
                });
                
                setTagData(tagDataObj);
                setEditedFields(editableFields);
                Alert.alert('Success', 'NFC tag data loaded successfully!');
                return;
              } catch (jsonError) {
                addDebugLog(`JSON parse error: ${jsonError.message}`);
                
                // Try manually parsing the JSON
                try {
                  // From the logs, we can see the tag data is valid JSON but might have issues
                  // Let's try to clean it up more aggressively
                  const cleanText = textContent
                    .replace(/\n/g, '')  // Remove newlines
                    .replace(/\r/g, '')  // Remove carriage returns
                    .replace(/\t/g, '')  // Remove tabs
                    .trim();
                    
                  addDebugLog(`Attempting with cleaned text: ${cleanText}`);
                  
                  if (cleanText && (cleanText.startsWith('{') || cleanText.startsWith('['))) {
                    try {
                      const manuallyParsed = JSON.parse(cleanText);
                      addDebugLog(`Manual JSON parsing succeeded`);
                      
                      const { id, ...editableData } = manuallyParsed;
                      const tagDataObj = id ? { id } : {};
                      
                      const editableFields = {};
                      Object.entries(editableData).forEach(([key, value]) => {
                        if (typeof value === 'object') {
                          editableFields[key] = JSON.stringify(value);
                        } else {
                          editableFields[key] = String(value);
                        }
                      });
                      
                      setTagData(tagDataObj);
                      setEditedFields(editableFields);
                      Alert.alert('Success', 'NFC tag data loaded successfully!');
                      return;
                    } catch (manualJsonError) {
                      addDebugLog(`Manual JSON parsing also failed: ${manualJsonError.message}`);
                    }
                  }
                } catch (cleanupError) {
                  addDebugLog(`Error during text cleanup: ${cleanupError.message}`);
                }
                
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
                      if (typeof value === 'object') {
                        editableFields[key] = JSON.stringify(value);
                      } else {
                        editableFields[key] = String(value);
                      }
                    });
                    
                    setTagData(tagDataObj);
                    setEditedFields(editableFields);
                    Alert.alert('Success', 'NFC tag data loaded successfully (using fallback method)!');
                    return;
                  } else {
                    addDebugLog('Used ndefToJson helper but no valid data found');
                  }
                } catch (fallbackError) {
                  addDebugLog(`ndefToJson fallback also failed: ${fallbackError.message}`);
                }
                
                // Last attempt - try to directly parse the NDEF payload
                try {
                  // Based on the ReadTab logs, the payload format is:
                  // [status byte, language code bytes, JSON data bytes]
                  // We can try to extract the JSON data directly
                  
                  const rawBuffer = new Uint8Array(record.payload);
                  const statusByte = rawBuffer[0];
                  const languageLength = statusByte & 0x3F;
                  
                  // Extract just the payload part (skip status byte and language code)
                  const payloadBytes = rawBuffer.slice(1 + languageLength);
                  const directText = new TextDecoder().decode(payloadBytes);
                  
                  addDebugLog(`Direct payload extract: ${directText}`);
                  
                  if (directText && (directText.startsWith('{') || directText.startsWith('['))) {
                    try {
                      const directData = JSON.parse(directText);
                      addDebugLog(`Direct payload parsing succeeded`);
                      
                      const { id, ...editableData } = directData;
                      const tagDataObj = id ? { id } : {};
                      
                      const editableFields = {};
                      Object.entries(editableData).forEach(([key, value]) => {
                        if (typeof value === 'object') {
                          editableFields[key] = JSON.stringify(value);
                        } else {
                          editableFields[key] = String(value);
                        }
                      });
                      
                      setTagData(tagDataObj);
                      setEditedFields(editableFields);
                      Alert.alert('Success', 'NFC tag data loaded successfully (using direct method)!');
                      return;
                    } catch (directJsonError) {
                      addDebugLog(`Direct payload parsing failed: ${directJsonError.message}`);
                    }
                  }
                } catch (directError) {
                  addDebugLog(`Direct payload extraction failed: ${directError.message}`);
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

  // Function to write NFC tag with iOS-specific handling
  const writeToNfcTagIOS = async (jsonData) => {
    try {
      addDebugLog('Starting iOS write operation');
      
      // Convert all numeric values to strings to avoid MSdictionaryM issues
      const safejsonData = {};
      Object.entries(jsonData).forEach(([key, value]) => {
        addDebugLog(`Processing field "${key}" (type: ${typeof value})`);
        
        if (typeof value === 'number') {
          safejsonData[key] = String(value);
          addDebugLog(`Converting numeric value for "${key}": ${value} → "${String(value)}"`);
        } else {
          safejsonData[key] = value;
        }
      });
      
      // Convert JSON to string - ensure we're using only ASCII quotes
      const jsonString = JSON.stringify(safejsonData)
        .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
        .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'");
      
      addDebugLog(`JSON string to write: ${jsonString}`);

      // Create NDEF Text Record manually
      const languageCode = 'en';
      
      // Force UTF-8 encoding
      const statusByte = 0x80 | (languageCode.length & 0x3F);
      
      // Create payload array
      const payload = [statusByte];

      // Add language code
      for (const char of languageCode) {
        payload.push(char.charCodeAt(0));
      }
      
      // Add JSON data
      for (const char of jsonString) {
        payload.push(char.charCodeAt(0));
      }
      addDebugLog(`Payload length: ${payload.length} bytes`);

      // Create NDEF record
      const record = Ndef.record(
        Ndef.TNF_WELL_KNOWN,
        Ndef.RTD_TEXT,
        [],
        payload
      );
      
      // Write to tag
      addDebugLog('Writing NDEF message to tag');
      await NfcManager.writeNdefMessage([record]);
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
        
        // Platform-specific handling
        if (Platform.OS === 'ios') {
          addDebugLog('Using iOS write method');
          await writeToNfcTagIOS(dataToWrite);
        } else {
          // Android handling
          addDebugLog('Using Android write method');
          const jsonString = JSON.stringify(dataToWrite);
          addDebugLog(`Android JSON string: ${jsonString}`);
          
          const textRecord = Ndef.textRecord(jsonString);
          await NfcManager.writeNdefMessage([textRecord]);
        }
        
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
  };

  const handleAddField = () => {
    if (!newField.key.trim()) {
      Alert.alert('Error', 'Please enter a field name.');
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
        <ScrollView style={styles.editFieldsContainer}>
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
                <Text style={styles.fieldLabel}>{key}:</Text>
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
            style={[styles.writeButton, { marginTop: 20, marginBottom: 20 }]}
          />
          
          {/* Debug Logs */}
          {debugLogs.length > 0 && (
            <View style={styles.debugContainer}>
              <Text style={styles.debugTitle}>Debug Logs:</Text>
              <ScrollView style={styles.debugLogsContainer}>
                {debugLogs.map((log, index) => (
                  <Text key={index} style={styles.debugText}>{log}</Text>
                ))}
              </ScrollView>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
};

// Additional styles
const additionalStyles = {
  editFieldsContainer: {
    flex: 1,
    marginTop: 20,
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
  debugContainer: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#f8f8f8',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  debugTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  debugLogsContainer: {
    maxHeight: 200,
  },
  debugText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#333',
    marginBottom: 3,
  },
};

// Merge the additional styles
Object.assign(styles, additionalStyles);

export default EditTab;