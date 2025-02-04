// AssignTabs.js
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import Button from '../../../../components/Button';
import TabBar from '../../../../components/TabBar';

const AssignTabs = ({
  activeTab,
  onTabChange,
  loading,
  selectedLocation,
  onLocationChange,
  selectedDevice,
  onDeviceChange,
  locations = [],
  availableDevices = [],
  onAssign,
  onNfcScan,
}) => {
  // Tab configuration
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

  // Handle location selection
  const handleLocationSelect = (value) => {
    onLocationChange(value);
  };

  // Validation for manual assignment
  const validateManualAssignment = () => {
    if (!selectedLocation) {
      Alert.alert('Error', 'Please select a location');
      return false;
    }
    if (!selectedDevice) {
      Alert.alert('Error', 'Please select a device');
      return false;
    }
    return true;
  };

  // Handle manual assignment
  const handleManualAssign = () => {
    if (validateManualAssignment()) {
      onAssign();
    }
  };

  // Render NFC Scan tab content
  const renderNfcScanTab = () => (
    <View style={styles.tabContent}>
      <Text style={styles.tabTitle}>Scan NFC Tag</Text>
      <Text style={styles.tabDescription}>
        Place your device near an NFC tag to assign the device.
      </Text>
      <View style={styles.nfcIconContainer}>
        <Ionicons name="scan" size={48} color="#007AFF" />
      </View>
      <Button
        title={loading ? "Scanning..." : "Scan NFC Tag"}
        onPress={onNfcScan}
        disabled={loading}
        style={styles.scanButton}
        accessibilityLabel="Scan NFC Tag"
        accessibilityHint="Activates NFC scanning to assign a device"
      />
    </View>
  );

  // Render Select Menu tab content
  const renderSelectMenuTab = () => (
    <View style={styles.tabContent}>
      <Text style={styles.tabTitle}>Select Device</Text>
      
      <View style={styles.formGroup}>
        <Text style={styles.labelText}>Location:</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={selectedLocation}
            onValueChange={handleLocationSelect}
            style={styles.picker}
            enabled={!loading}
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
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.labelText}>Device:</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={selectedDevice}
            onValueChange={onDeviceChange}
            style={styles.picker}
            enabled={!loading && availableDevices.length > 0}
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
        {selectedLocation && availableDevices.length === 0 && (
          <Text style={styles.noDevicesText}>
            No devices available at this location
          </Text>
        )}
      </View>

      <Button
        title={loading ? "Assigning..." : "Assign Device"}
        onPress={handleManualAssign}
        disabled={loading || !selectedLocation || !selectedDevice}
        style={styles.assignButton}
        accessibilityLabel="Assign Device"
        accessibilityHint="Assigns the selected device"
      />
    </View>
  );

  return (
    <View style={styles.container}>
      <TabBar
        tabs={tabs}
        activeTab={activeTab}
        onTabPress={onTabChange}
        backgroundColor="#F9F9F9"
        activeColor="#007AFF"
        inactiveColor="#666666"
        showIcons
        showLabels
        height={50}
        containerStyle={styles.tabBarContainer}
      />
      
      <View style={styles.tabContentContainer}>
        {activeTab === 'nfcScan' ? renderNfcScanTab() : renderSelectMenuTab()}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabBarContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tabContentContainer: {
    flex: 1,
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
  nfcIconContainer: {
    alignItems: 'center',
    marginVertical: 30,
  },
  formGroup: {
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
    backgroundColor: '#F8F8F8',
    marginBottom: 8,
  },
  picker: {
    height: 50,
  },
  noDevicesText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 4,
  },
  scanButton: {
    marginTop: 10,
  },
  assignButton: {
    marginTop: 20,
  },
});

export default AssignTabs;