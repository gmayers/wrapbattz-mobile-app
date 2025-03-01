import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import Dropdown from '../../../../components/Dropdown';
import Button from '../../../../components/Button';

const SelectMenuTab = ({ 
  locations,
  onAssignComplete,
  fetchDevicesByLocation,
  handleApiError 
}) => {
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [selectedLocationAssign, setSelectedLocationAssign] = useState(null);
  const [selectedDeviceAssign, setSelectedDeviceAssign] = useState(null);
  const [availableDevices, setAvailableDevices] = useState([]);
  const [locationOptions, setLocationOptions] = useState([]);
  const [deviceOptions, setDeviceOptions] = useState([]);
  const [assignLoading, setAssignLoading] = useState(false);
  
  // Transform locations into dropdown format
  useEffect(() => {
    if (locations && locations.length > 0) {
      const options = locations.map(location => ({
        label: location.name || 'Unnamed Location',
        value: location.id  // Store the ID here
      }));
      setLocationOptions(options);
    }
  }, [locations]);
  
  // Update device options when available devices change
  useEffect(() => {
    if (availableDevices && availableDevices.length > 0) {
      const options = availableDevices.map(device => ({
        label: device.name || 'Unnamed Device',
        value: device.id  // Store the ID here
      }));
      setDeviceOptions(options);
    } else {
      setDeviceOptions([]);
    }
  }, [availableDevices]);

  const handleLocationChange = (locationId) => {
    setSelectedLocationId(locationId);
    setSelectedDeviceId('');
    setSelectedDeviceAssign(null);
    
    // Find the location object from the id
    const locationObj = locations.find(loc => loc.id === locationId);
    setSelectedLocationAssign(locationObj || null);
    
    if (locationId) {
      fetchDevicesByLocation(locationId)
        .then(devices => {
          setAvailableDevices(devices || []);
        })
        .catch(error => {
          handleApiError(error, 'Failed to fetch devices for the selected location');
          setAvailableDevices([]);
        });
    } else {
      setAvailableDevices([]);
    }
  };

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
      <Dropdown
        value={selectedLocationId}
        onValueChange={handleLocationChange}
        items={locationOptions}
        placeholder="Select a location"
        testID="location-dropdown"
        containerStyle={styles.dropdownContainer}
      />
      
      <Text style={styles.pickerLabel}>Device:</Text>
      <Dropdown
        value={selectedDeviceId}
        onValueChange={(deviceId) => {
          setSelectedDeviceId(deviceId);
          const deviceObj = availableDevices.find(dev => dev.id === deviceId);
          setSelectedDeviceAssign(deviceObj || null);
        }}
        items={deviceOptions}
        placeholder="Select a device"
        disabled={deviceOptions.length === 0}
        testID="device-dropdown"
        containerStyle={styles.dropdownContainer}
      />
      
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
  dropdownContainer: {
    marginBottom: 15,
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