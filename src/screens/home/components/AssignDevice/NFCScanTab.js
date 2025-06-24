// components/home/components/AssignDevice/NFCScanTab.js
import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Button from '../../../../components/Button';
import { nfcService } from '../../../../services/NFCService';
import { useAuth } from '../../../../context/AuthContext';


const NFCScanTab = ({ onAssignComplete, handleApiError }) => {
  const [assignLoading, setAssignLoading] = useState(false);
  const { deviceService } = useAuth();

  const cancelNfcRead = async () => {
    try {
      setAssignLoading(false);
      await nfcService.cancelOperation();
    } catch (error) {
      // Silent error handling
    }
  };

  const readNfcTag = async () => {
    try {
      console.log('[NFCScanTab] Starting enhanced NFC read with validation');
      
      // Use the enhanced NFCService with longer timeout for reliability
      const readResult = await nfcService.readNFC({ timeout: 60000 });
      
      if (!readResult.success) {
        // Use the detailed error messages from NFCService
        throw new Error(readResult.error || 'Failed to read NFC tag');
      }
      
      console.log('[NFCScanTab] NFC read successful, processing data');
      
      // Extract the JSON data from the result with enhanced handling
      let jsonData;
      if (readResult.data?.parsedData) {
        jsonData = readResult.data.parsedData;
        console.log('[NFCScanTab] Using parsed JSON data');
      } else if (readResult.data?.jsonString) {
        try {
          jsonData = JSON.parse(readResult.data.jsonString);
          console.log('[NFCScanTab] Parsed JSON string successfully');
        } catch (parseError) {
          throw new Error('Tag contains invalid JSON format. Please ensure the tag was written correctly.');
        }
      } else if (readResult.data?.content) {
        // Try to parse as JSON
        try {
          jsonData = JSON.parse(readResult.data.content);
          console.log('[NFCScanTab] Parsed content as JSON');
        } catch (e) {
          throw new Error('Tag does not contain valid JSON data. This may not be a device tag.');
        }
      } else {
        throw new Error('No valid data found on tag. The tag may be empty or corrupted.');
      }
      
      // Validate that we have an object (not array or primitive)
      if (!jsonData || typeof jsonData !== 'object' || Array.isArray(jsonData)) {
        throw new Error('Tag does not contain valid device data format.');
      }
      
      // Extract device ID or identifier using various possible field names
      let deviceIdentifier = null;
      
      // Check for various possible identifier field names (case-insensitive)
      const possibleKeys = ['deviceId', 'identifier', 'ID', 'id', 'device_id', 'serialNumber', 'serial_number'];
      
      for (const key of possibleKeys) {
        if (jsonData[key] && String(jsonData[key]).trim()) {
          deviceIdentifier = String(jsonData[key]).trim();
          console.log(`[NFCScanTab] Found device identifier in field '${key}': ${deviceIdentifier}`);
          break;
        }
      }
      
      // Also check case-insensitive variations
      if (!deviceIdentifier) {
        const lowerKeys = Object.keys(jsonData).map(k => k.toLowerCase());
        for (const possibleKey of possibleKeys) {
          const lowerKey = possibleKey.toLowerCase();
          const foundKey = Object.keys(jsonData).find(k => k.toLowerCase() === lowerKey);
          if (foundKey && jsonData[foundKey] && String(jsonData[foundKey]).trim()) {
            deviceIdentifier = String(jsonData[foundKey]).trim();
            console.log(`[NFCScanTab] Found device identifier in field '${foundKey}': ${deviceIdentifier}`);
            break;
          }
        }
      }
      
      if (!deviceIdentifier) {
        const availableFields = Object.keys(jsonData).join(', ');
        throw new Error(`No device identifier found on this tag. Available fields: ${availableFields}. Please ensure this is a valid device tag.`);
      }
      
      // Additional validation for identifier format
      if (deviceIdentifier.length < 3) {
        throw new Error('Device identifier is too short. This may not be a valid device tag.');
      }
      
      console.log('[NFCScanTab] Successfully extracted device identifier:', deviceIdentifier);
      return deviceIdentifier;
    } catch (error) {
      console.error('[NFCScanTab] Error reading NFC tag:', error);
      // Re-throw with enhanced error context
      const errorMessage = error.message || 'Failed to read NFC tag';
      throw new Error(errorMessage);
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