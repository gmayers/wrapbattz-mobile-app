// components/home/components/AssignDevice/NFCScanTab.js
import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Button from '../../../../components/Button';
import NfcManager, { NfcTech, Ndef } from 'react-native-nfc-manager';
import { useAuth } from '../../../../context/AuthContext';

// Helper function to normalize JSON strings
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
      // Add a closing quote before any commas or closing braces
      normalized = normalized.replace(/([^"\s,{}[\]]+)(\s*)(,|\}|\])/g, '$1"$2$3');
      
      // Fix any values that should start with a quote but don't
      normalized = normalized.replace(/:(\s*)([^"\s,{}[\]][^,{}[\]]*)/g, ':$1"$2"');
    }
    
    return normalized;
  }
};

const NFCScanTab = ({ onAssignComplete, handleApiError }) => {
  const [assignLoading, setAssignLoading] = useState(false);
  const [debugLogs, setDebugLogs] = useState([]);
  const { axiosInstance, getAccessToken } = useAuth();

  const addDebugLog = (message) => {
    console.log(`[NFCScanTab] ${message}`);
    setDebugLogs(prevLogs => [...prevLogs, `[${new Date().toISOString()}] ${message}`]);
  };

  const readNfcTag = async () => {
    try {
      addDebugLog('Starting NFC read operation');
      
      // Initialize NFC Manager
      await NfcManager.start();
      addDebugLog('NFC Manager initialized');
      
      // STEP 1: Request NFC technology
      addDebugLog('Requesting NFC technology: Ndef');
      await NfcManager.requestTechnology(NfcTech.Ndef);
      addDebugLog('Ndef technology acquired');
      
      // Get tag data
      addDebugLog('Getting tag data');
      const tag = await NfcManager.getTag();
      addDebugLog(`Tag detected: ${tag ? 'Yes' : 'No'}`);
      
      if (!tag) {
        addDebugLog('Error: No tag detected');
        throw new Error('No NFC tag detected');
      }
      
      addDebugLog(`Tag ID: ${tag.id || 'Unknown'}`);
      
      if (!tag.ndefMessage || !tag.ndefMessage.length) {
        addDebugLog('Error: No NDEF message found on tag');
        throw new Error('No NDEF message found on tag');
      }
      
      addDebugLog(`NDEF message contains ${tag.ndefMessage.length} records`);
      
      // Process first NDEF record
      const record = tag.ndefMessage[0];
      
      if (!record || !record.payload) {
        addDebugLog('Error: Invalid record format');
        throw new Error('Invalid NFC tag format');
      }
      
      // Decode the payload
      let textContent;
      try {
        textContent = Ndef.text.decodePayload(record.payload);
        addDebugLog(`Decoded text content: ${textContent.substring(0, 50)}${textContent.length > 50 ? '...' : ''}`);
      } catch (e) {
        addDebugLog(`Error decoding payload: ${e.message}`);
        
        // Try manual decoding if standard method fails
        try {
          const bytes = [...new Uint8Array(record.payload)];
          const statusByte = bytes[0];
          const languageLength = statusByte & 0x3F;
          
          // Skip language code and status byte
          const textBytes = bytes.slice(1 + languageLength);
          textContent = new TextDecoder().decode(new Uint8Array(textBytes));
          addDebugLog(`Manual decoding successful: ${textContent.substring(0, 50)}${textContent.length > 50 ? '...' : ''}`);
        } catch (manualError) {
          addDebugLog(`Manual decoding failed: ${manualError.message}`);
          throw new Error('Failed to decode tag content');
        }
      }
      
      // Check if it's valid JSON
      if (!textContent || !(textContent.startsWith('{') || textContent.startsWith('['))) {
        addDebugLog('Tag does not contain JSON data');
        throw new Error('Tag does not contain valid data');
      }
      
      try {
        // Normalize and parse JSON
        const cleanJson = normalizeJsonString(textContent.trim());
        addDebugLog(`Normalized JSON: ${cleanJson}`);
        
        const parsedData = JSON.parse(cleanJson);
        addDebugLog(`Successfully parsed JSON data: ${JSON.stringify(parsedData)}`);
        
        // Check for device identifier
        // First try to find an "ID" field (case insensitive)
        let deviceId = null;
        
        // Check for various possible ID field names
        if (parsedData.ID) {
          deviceId = parsedData.ID;
        } else if (parsedData.id) {
          deviceId = parsedData.id;
        } else if (parsedData.identifier) {
          deviceId = parsedData.identifier;
        } else if (parsedData.device_id) {
          deviceId = parsedData.device_id;
        }
        
        if (!deviceId) {
          addDebugLog('No ID field found in tag data');
          throw new Error('No device ID found on this tag');
        }
        
        addDebugLog(`Found device ID: ${deviceId}`);
        return deviceId;
      } catch (jsonError) {
        addDebugLog(`JSON parse error: ${jsonError.message}`);
        throw new Error('Invalid data format on tag');
      }
    } finally {
      // Always clean up
      addDebugLog('Canceling technology request');
      NfcManager.cancelTechnologyRequest();
    }
  };

  const handleAssignNfc = async () => {
    try {
      setAssignLoading(true);
      addDebugLog('Starting device assignment process');
      
      // Read the NFC tag to get the device ID
      const deviceId = await readNfcTag();
      addDebugLog(`Successfully read device ID: ${deviceId}`);
      
      // Use axios instance from Auth context to make the request
      // This ensures proper token handling and error management
      addDebugLog('Sending assignment request to API');
      
      const response = await axiosInstance.post('/device-assignments/', {
        device_id: deviceId,
        assigned_date: new Date().toISOString().split('T')[0] // Format as YYYY-MM-DD
      });
      
      addDebugLog(`API request successful: ${JSON.stringify(response.data)}`);
      Alert.alert('Success', 'Device assigned successfully to your account.');
      
      // Call the onAssignComplete callback to update parent components
      if (onAssignComplete) {
        onAssignComplete();
      }
    } catch (error) {
      addDebugLog(`Error: ${error.message}`);
      
      // Use the provided handleApiError function or fallback to Alert
      if (handleApiError) {
        handleApiError(error, 'Failed to assign device via NFC');
      } else {
        Alert.alert('Error', error.message || 'Failed to assign device via NFC');
      }
    } finally {
      setAssignLoading(false);
      addDebugLog('Assignment process completed');
    }
  };

  return (
    <View style={styles.assignTabContent} testID="nfc-scan-tab-container">
      <Text style={styles.assignTabSubtitle} testID="nfc-scan-subtitle">
        Scan an NFC tag to assign a device to your account.
      </Text>
      
      {assignLoading ? (
        <View style={styles.statusContainer} testID="nfc-scan-status-container">
          <Text style={styles.statusText} testID="nfc-scan-status-text">
            Ready to scan... Place NFC tag near device
          </Text>
        </View>
      ) : (
        <Button
          title="Scan NFC Tag"
          onPress={handleAssignNfc}
          disabled={assignLoading}
          isLoading={assignLoading}
          style={styles.assignNfcButton}
          testID="scan-nfc-button"
        />
      )}
      
      {debugLogs.length > 0 && __DEV__ && (
        <View style={styles.debugContainer}>
          <Text style={styles.debugTitle}>Debug Logs:</Text>
          <ScrollView style={styles.debugLogs}>
            {debugLogs.map((log, index) => (
              <Text key={index} style={styles.debugLog}>{log}</Text>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  assignTabContent: {
    padding: 16,
    flex: 1,
  },
  assignTabSubtitle: {
    fontSize: 16,
    color: '#555',
    marginBottom: 20,
    textAlign: 'center',
  },
  assignNfcButton: {
    backgroundColor: '#17a2b8',
    marginVertical: 20,
  },
  statusContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#f0f7ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#c9e0ff',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 16,
    color: '#0056b3',
    textAlign: 'center',
  },
  debugContainer: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  debugTitle: {
    fontWeight: 'bold',
    marginBottom: 5,
  },
  debugLogs: {
    maxHeight: 200,
  },
  debugLog: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#666',
    marginBottom: 2,
  },
});

export default NFCScanTab;