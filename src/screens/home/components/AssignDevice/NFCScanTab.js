// components/home/components/AssignDevice/NFCScanTab.js
import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Button from '../../../../components/Button';
import DeviceInfoDisplay from '../../../../components/DeviceInfoDisplay';
import { nfcService } from '../../../../services/NFCService';
import { useAuth } from '../../../../context/AuthContext';


const NFCScanTab = ({ onAssignComplete, handleApiError }) => {
  const [assignLoading, setAssignLoading] = useState(false);
  const [scannedDeviceData, setScannedDeviceData] = useState(null);
  const [deviceIdentifier, setDeviceIdentifier] = useState(null);
  const { deviceService } = useAuth();

  const cancelNfcRead = async () => {
    try {
      setAssignLoading(false);
      setScannedDeviceData(null);
      setDeviceIdentifier(null);
      await nfcService.cancelOperation();
    } catch (error) {
      // Silent error handling
    }
  };

  /**
   * Read NFC tag and get the hardware UUID for device lookup
   * Simplified: Uses tag's hardware UUID instead of parsing JSON data
   */
  const readNfcTag = async () => {
    try {
      console.log('[NFCScanTab] Starting NFC read for device lookup');

      const readResult = await nfcService.readNFC({ timeout: 60000 });

      if (!readResult.success) {
        throw new Error(readResult.error || 'Failed to read NFC tag');
      }

      // Get the hardware UUID from the tag
      const tagId = readResult.data?.tagId;

      if (!tagId) {
        throw new Error('Could not read NFC tag ID. Please try again.');
      }

      console.log('[NFCScanTab] Got NFC hardware UUID:', tagId);
      return { tagId };
    } catch (error) {
      console.error('[NFCScanTab] Error reading NFC tag:', error);
      throw new Error(error.message || 'Failed to read NFC tag');
    }
  };

  const handleScanNfc = async () => {
    try {
      setAssignLoading(true);
      setScannedDeviceData(null);
      setDeviceIdentifier(null);

      // Step 1: Read NFC tag to get hardware UUID
      const { tagId } = await readNfcTag();

      // Step 2: Look up device by NFC UUID via API
      console.log('[NFCScanTab] Looking up device by NFC UUID:', tagId);
      const device = await deviceService.getDeviceByNfcUuid(tagId);

      if (!device) {
        throw new Error(
          'Device not found.\n\n' +
          'This NFC tag is not registered with any device in your organization.\n\n' +
          'If this is a new device, please add it first using the Add Device screen.'
        );
      }

      console.log('[NFCScanTab] Found device:', device.identifier);

      // Step 3: Store device data for display
      setScannedDeviceData(device);
      setDeviceIdentifier(device.identifier);

      // Step 4: Assign using device ID
      await assignDevice(device.id);
    } catch (error) {
      // Reset state on error
      setScannedDeviceData(null);
      setDeviceIdentifier(null);

      // Use the provided handleApiError function or fallback to Alert
      if (handleApiError) {
        handleApiError(error, 'Failed to scan device tag');
      } else {
        Alert.alert('Error', error.message || 'Failed to scan device tag');
      }
    } finally {
      setAssignLoading(false);
    }
  };

  const assignDevice = async (deviceId) => {
    try {
      // Use assignDeviceToMe with the device ID (simpler than identifier-based)
      await deviceService.assignDeviceToMe(deviceId, {});

      Alert.alert('Success', 'Device assigned successfully to your account.');

      // Call the onAssignComplete callback to update parent components
      if (onAssignComplete) {
        onAssignComplete();
      }
    } catch (error) {
      throw error; // Re-throw to be handled by caller
    }
  };

  return (
    <ScrollView style={styles.container} testID="nfc-scan-tab-container">
      <View style={styles.contentWrapper}>
        <View style={styles.iconContainer}>
          <Ionicons name="scan-outline" size={80} color="#17a2b8" />
        </View>

        <Text style={styles.title}>Scan NFC Tag</Text>

        <Text style={styles.subtitle} testID="nfc-scan-subtitle">
          Scan an NFC tag to view device info and assign it to your account.
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
            onPress={handleScanNfc}
            disabled={assignLoading}
            isLoading={assignLoading}
            style={styles.scanButton}
            textColor="white"
            testID="scan-nfc-button"
          />
        )}

        {/* Display scanned device info after successful scan and assignment */}
        {scannedDeviceData && deviceIdentifier && !assignLoading && (
          <View style={styles.deviceInfoContainer}>
            <DeviceInfoDisplay deviceData={scannedDeviceData} />
            <View style={styles.assignedBadge}>
              <Ionicons name="checkmark-circle" size={20} color="#28a745" />
              <Text style={styles.assignedText}>
                Assigned to your account
              </Text>
            </View>
          </View>
        )}
      </View>
    </ScrollView>
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
  },
  deviceInfoContainer: {
    width: '100%',
    marginTop: 20,
  },
  assignedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 15,
    padding: 12,
    backgroundColor: '#d4edda',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#c3e6cb',
  },
  assignedText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#155724',
  },
});

export default NFCScanTab;