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
  const { deviceService } = useAuth();

  const cancelNfcRead = async () => {
    try {
      setAssignLoading(false);
      await NfcManager.cancelTechnologyRequest();
    } catch (error) {
      // Silent error handling
    }
  };

  const readNfcTag = async () => {
    try {
      // Initialize NFC Manager
      await NfcManager.start();
      
      // Request NFC technology
      await NfcManager.requestTechnology(NfcTech.Ndef);
      
      // Get tag data
      const tag = await NfcManager.getTag();
      
      if (!tag) {
        throw new Error('No NFC tag detected.');
      }
      
      if (!tag.ndefMessage || !tag.ndefMessage.length) {
        throw new Error('No NDEF message found on tag.');
      }
      
      // Process first NDEF record
      const record = tag.ndefMessage[0];
      
      if (!record || !record.payload) {
        throw new Error('Invalid NFC tag format');
      }
      
      // Decode the payload
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
          throw new Error('Failed to decode tag content');
        }
      }
      
      // Process as JSON if possible
      if (!textContent || !(textContent.startsWith('{') || textContent.startsWith('['))) {
        throw new Error('Tag does not contain valid data');
      }
      
      try {
        // Normalize and clean JSON string
        const cleanJson = normalizeJsonString(textContent.trim());
        
        // Parse the JSON data
        const jsonData = JSON.parse(cleanJson);
        
        // Extract device ID or identifier using various possible field names
        let deviceIdentifier = null;
        
        // Check for various possible identifier field names
        if (jsonData.identifier) {
          deviceIdentifier = jsonData.identifier;
        } else if (jsonData.ID) {
          deviceIdentifier = jsonData.ID;
        } else if (jsonData.id) {
          deviceIdentifier = jsonData.id;
        } else if (jsonData.device_id) {
          deviceIdentifier = jsonData.device_id;
        }
        
        if (!deviceIdentifier) {
          throw new Error('No device identifier found on this tag');
        }
        
        return deviceIdentifier;
      } catch (jsonError) {
        throw new Error('Invalid data format on tag');
      }
    } finally {
      // Always clean up
      try {
        await NfcManager.cancelTechnologyRequest();
      } catch (cleanupError) {
        // Silent cleanup error
      }
    }
  };

  const handleAssignNfc = async () => {
    let deviceIdentifier = null;
    
    try {
      setAssignLoading(true);
      
      // Read the NFC tag to get the device identifier
      deviceIdentifier = await readNfcTag();
      
      // Create assignment data with current date
      const assignmentData = {
        assigned_date: new Date().toISOString().split('T')[0] // Format as YYYY-MM-DD
      };
      
      // Use the assignDeviceByIdentifier method for NFC scans
      await deviceService.assignDeviceByIdentifier(deviceIdentifier, assignmentData);
      
      Alert.alert('Success', 'Device assigned successfully to your account.');
      
      // Call the onAssignComplete callback to update parent components
      if (onAssignComplete) {
        onAssignComplete();
      }
    } catch (error) {
      // Use the provided handleApiError function or fallback to Alert
      if (handleApiError) {
        handleApiError(error, `Failed to assign device${deviceIdentifier ? ` (Identifier: ${deviceIdentifier})` : ''}`);
      } else {
        Alert.alert('Error', error.message || 'Failed to assign device via NFC');
      }
    } finally {
      setAssignLoading(false);
    }
  };

  return (
    <View style={styles.container} testID="nfc-scan-tab-container">
      <View style={styles.contentWrapper}>
        <View style={styles.iconContainer}>
          <Ionicons name="scan-outline" size={80} color="#17a2b8" />
        </View>
        
        <Text style={styles.title}>Scan NFC Tag</Text>
        
        <Text style={styles.subtitle} testID="nfc-scan-subtitle">
          Scan an NFC tag to assign a device to your account.
        </Text>
        
        {assignLoading ? (
          <View style={styles.statusContainer} testID="nfc-scan-status-container">
            <Text style={styles.statusText} testID="nfc-scan-status-text">
              Ready to scan... Place NFC tag near device
            </Text>
            <Button
              title="Cancel"
              onPress={cancelNfcRead}
              style={styles.cancelButton}
              textColor="white"
            />
          </View>
        ) : (
          <Button
            title="Scan NFC Tag"
            onPress={handleAssignNfc}
            disabled={assignLoading}
            isLoading={assignLoading}
            style={styles.scanButton}
            textColor="white"
            testID="scan-nfc-button"
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  contentWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  iconContainer: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#555',
    marginBottom: 30,
    textAlign: 'center',
    lineHeight: 22,
  },
  scanButton: {
    backgroundColor: '#28a745', // Changed to green to match SelectMenuTab
    marginVertical: 20,
    width: '80%',
    alignSelf: 'center',
  },
  cancelButton: {
    backgroundColor: '#dc3545',
    marginTop: 15,
  },
  statusContainer: {
    marginTop: 20,
    padding: 20,
    backgroundColor: '#f0f7ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#c9e0ff',
    alignItems: 'center',
    width: '90%',
  },
  statusText: {
    fontSize: 16,
    color: '#0056b3',
    textAlign: 'center',
    marginBottom: 10,
  }
});

export default NFCScanTab;