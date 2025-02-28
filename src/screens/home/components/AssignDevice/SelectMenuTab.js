import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Button from '../../../../components/Button';

const SelectMenuTab = ({ 
  locations,
  onAssignComplete,
  fetchDevicesByLocation,
  handleApiError 
}) => {
  const [selectedLocationAssign, setSelectedLocationAssign] = useState(null);
  const [selectedDeviceAssign, setSelectedDeviceAssign] = useState(null);
  const [availableDevices, setAvailableDevices] = useState([]);
  const [assignLoading, setAssignLoading] = useState(false);

  const handleAssignSelect = async () => {
    if (!selectedLocationAssign || !selectedDeviceAssign) {
      Alert.alert('Error', 'Please select both location and device.');
      return;
    }

    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      await axios.post(
        'https://test.gmayersservices.com/api/assign-device/',
        {
          device_id: selectedDeviceAssign.id,
          location_id: selectedLocationAssign.id,
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      Alert.alert('Success', `Device ${selectedDeviceAssign.name} assigned to ${selectedLocationAssign.name}.`);
      onAssignComplete();
    } catch (error) {
      handleApiError(error, 'Failed to assign device via selection.');
    }
  };

  return (
    <View style={styles.assignTabContent}>
      <Text style={styles.assignTabSubtitle}>Select location and device to assign.</Text>

      <Text style={styles.pickerLabel}>Location:</Text>
      <View style={styles.pickerContainer}>
        <Picker
          selectedValue={selectedLocationAssign}
          onValueChange={(itemValue) => {
            setSelectedLocationAssign(itemValue);
            if (itemValue) {
              fetchDevicesByLocation(itemValue.id);
            } else {
              setAvailableDevices([]);
              setSelectedDeviceAssign(null);
            }
          }}
          style={styles.picker}
        >
          <Picker.Item label="Select a location" value={null} />
          {locations.map((location) => (
            <Picker.Item
              key={location.id}
              label={location.name || 'Unnamed Location'}
              value={location}
            />
          ))}
        </Picker>
      </View>
      
      <Text style={styles.pickerLabel}>Device:</Text>
      <View style={styles.pickerContainer}>
        <Picker
          selectedValue={selectedDeviceAssign}
          onValueChange={(itemValue) => setSelectedDeviceAssign(itemValue)}
          enabled={availableDevices.length > 0}
          style={styles.picker}
        >
          <Picker.Item label="Select a device" value={null} />
          {availableDevices.map((device) => (
            <Picker.Item
              key={device.id}
              label={device.name || 'Unnamed Device'}
              value={device}
            />
          ))}
        </Picker>
      </View>
      
      <View style={styles.assignButtonsContainer}>
        <Button
          title="Submit"
          onPress={handleAssignSelect}
          disabled={assignLoading}
          isLoading={assignLoading}
          style={styles.submitButton}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  assignTabContent: {
    padding: 10,
  },
  assignTabSubtitle: {
    fontSize: 14,
    color: '#555',
    marginBottom: 15,
  },
  pickerLabel: {
    fontSize: 14,
    color: '#333',
    marginBottom: 5,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    marginBottom: 15,
  },
  picker: {
    height: 50,
    width: '100%',
  },
  assignButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  submitButton: {
    backgroundColor: '#28a745',
    flex: 1,
    marginRight: 10,
  },
});

export default SelectMenuTab;