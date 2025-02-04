// AssignModal.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableWithoutFeedback,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import Button from '../../../../components/Button';
import TabBar from '../../../../components/TabBar';
import NfcManager, { NfcTech } from 'react-native-nfc-manager';
import { useAuth } from '../../../../context/AuthContext';

const AssignModal = ({
  visible,
  onClose,
  onSuccess,
  locations = []
}) => {
  // State
  const [activeTab, setActiveTab] = useState('nfcScan');
  const [loading, setLoading] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [availableDevices, setAvailableDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);

  // Auth context
  const { getAccessToken } = useAuth();

  // Tabs configuration
  const tabs = [
    {
      key: 'nfcScan',
      title: 'NFC Scan',
      icon: <Ionicons name="scan-outline" size={20} />,
    },
    {
      key: 'selectMenu',
      title: 'Select Menu',
      icon: <Ionicons name="list-outline" size={20} />,
    },
  ];

  // Reset states when modal closes
  useEffect(() => {
    if (!visible) {
      setActiveTab('nfcScan');
      setSelectedLocation(null);
      setSelectedDevice(null);
      setAvailableDevices([]);
      setLoading(false);
    }
  }, [visible]);

  // Fetch devices for selected location
  const fetchDevicesByLocation = async (locationId) => {
    try {
      const token = await getAccessToken();
      const response = await fetch(
        `https://test.gmayersservices.com/api/devices/?location=${locationId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) throw new Error('Failed to fetch devices');

      const data = await response.json();
      setAvailableDevices(data);
    } catch (error) {
      console.error('Error fetching devices:', error);
      Alert.alert('Error', 'Failed to fetch devices for the selected location');
      setAvailableDevices([]);
    }
  };

  // Handle NFC scanning
  const handleNfcScan = async () => {
    setLoading(true);
    try {
      await NfcManager.requestTechnology(NfcTech.Ndef);
      const tag = await NfcManager.getTag();
      
      if (!tag) {
        throw new Error('No NFC tag found');
      }

      const token = await getAccessToken();
      const response = await fetch(
        'https://test.gmayersservices.com/api/assign-device/',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ device_id: tag.id }),
        }
      );

      if (!response.ok) throw new Error('Failed to assign device');

      Alert.alert('Success', 'Device assigned successfully');
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('NFC scan error:', error);
      Alert.alert('Error', error.message || 'Failed to scan NFC tag');
    } finally {
      NfcManager.cancelTechnologyRequest();
      setLoading(false);
    }
  };

  // Handle manual selection assignment
  const handleManualAssign = async () => {
    if (!selectedLocation || !selectedDevice) {
      Alert.alert('Error', 'Please select both location and device');
      return;
    }

    setLoading(true);
    try {
      const token = await getAccessToken();
      const response = await fetch(
        'https://test.gmayersservices.com/api/assign-device/',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            device_id: selectedDevice.id,
            location_id: selectedLocation.id,
          }),
        }
      );

      if (!response.ok) throw new Error('Failed to assign device');

      Alert.alert('Success', 'Device assigned successfully');
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Assignment error:', error);
      Alert.alert('Error', 'Failed to assign device');
    } finally {
      setLoading(false);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'nfcScan':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.tabTitle}>Scan NFC Tag</Text>
            <Text style={styles.tabDescription}>
              Place your device near an NFC tag to assign the device.
            </Text>
            <Button
              title={loading ? "Scanning..." : "Scan NFC Tag"}
              onPress={handleNfcScan}
              disabled={loading}
              style={styles.scanButton}
            />
          </View>
        );

      case 'selectMenu':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.tabTitle}>Select Device</Text>
            
            <Text style={styles.labelText}>Location:</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={selectedLocation}
                onValueChange={(value) => {
                  setSelectedLocation(value);
                  if (value) {
                    fetchDevicesByLocation(value.id);
                  } else {
                    setAvailableDevices([]);
                    setSelectedDevice(null);
                  }
                }}
                style={styles.picker}
              >
                <Picker.Item label="Select a location" value={null} />
                {locations.map((location) => (
                  <Picker.Item
                    key={location.id}
                    label={location.name}
                    value={location}
                  />
                ))}
              </Picker>
            </View>

            <Text style={styles.labelText}>Device:</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={selectedDevice}
                onValueChange={setSelectedDevice}
                enabled={availableDevices.length > 0}
                style={styles.picker}
              >
                <Picker.Item label="Select a device" value={null} />
                {availableDevices.map((device) => (
                  <Picker.Item
                    key={device.id}
                    label={device.identifier}
                    value={device}
                  />
                ))}
              </Picker>
            </View>

            <View style={styles.buttonContainer}>
              <Button
                title={loading ? "Assigning..." : "Assign Device"}
                onPress={handleManualAssign}
                disabled={loading || !selectedLocation || !selectedDevice}
                style={styles.assignButton}
              />
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalContainer}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Assign Device</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Ionicons name="close" size={24} color="#333" />
                </TouchableOpacity>
              </View>

              {/* Tab Bar */}
              <TabBar
                tabs={tabs}
                activeTab={activeTab}
                onTabPress={setActiveTab}
                backgroundColor="#F9F9F9"
                activeColor="#007AFF"
                inactiveColor="#666666"
                showIcons
                showLabels
                height={50}
                containerStyle={styles.tabBarContainer}
              />

              {/* Content */}
              <ScrollView 
                style={styles.contentContainer}
                contentContainerStyle={styles.contentContainerStyle}
              >
                {renderContent()}
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 5,
  },
  tabBarContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  contentContainer: {
    flex: 1,
  },
  contentContainerStyle: {
    padding: 15,
  },
  tabContent: {
    flex: 1,
  },
  tabTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  tabDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  labelText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    marginBottom: 16,
    backgroundColor: '#F8F8F8',
  },
  picker: {
    height: 50,
  },
  buttonContainer: {
    marginTop: 20,
  },
  scanButton: {
    marginTop: 10,
  },
  assignButton: {
    marginTop: 10,
  },
});

export default AssignModal;