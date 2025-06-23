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
      // Use the new NFCService to read the tag
      const readResult = await nfcService.readNFC();
      
      if (!readResult.success) {
        throw new Error(readResult.error || 'Failed to read NFC tag');
      }
      
      // Extract the JSON data from the result
      let jsonData;
      if (readResult.data?.parsedData) {
        jsonData = readResult.data.parsedData;
      } else if (readResult.data?.jsonString) {
        jsonData = JSON.parse(readResult.data.jsonString);
      } else if (readResult.data?.content) {
        // Try to parse as JSON
        try {
          jsonData = JSON.parse(readResult.data.content);
        } catch (e) {
          throw new Error('Tag does not contain valid JSON data');
        }
      } else {
        throw new Error('No valid data found on tag');
      }
      
      // Extract device ID or identifier using various possible field names
      let deviceIdentifier = null;
      
      // Check for various possible identifier field names
      if (jsonData.deviceId) {
        deviceIdentifier = jsonData.deviceId;
      } else if (jsonData.identifier) {
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
    } catch (error) {
      // Re-throw with appropriate error message
      throw new Error(error.message || 'Failed to read NFC tag');
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