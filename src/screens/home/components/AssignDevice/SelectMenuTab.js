import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import Dropdown from '../../../../components/Dropdown';
import Button from '../../../../components/Button';
import { useAuth } from '../../../../context/AuthContext';

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
  
  // Import axiosInstance from AuthContext
  const { axiosInstance } = useAuth();
  
  // Transform locations into dropdown format
  useEffect(() => {
    if (locations && locations.length > 0) {
      const options = locations.map(location => ({
        label: location.name || `${location.street_number} ${location.street_name}`,
        value: location.id
      }));
      setLocationOptions(options);
    }
  }, [locations]);
  
  // Update device options when available devices change
  useEffect(() => {
    if (availableDevices && availableDevices.length > 0) {
      const options = availableDevices.map(device => ({
        label: `${device.make} ${device.model} - ${device.identifier}`,
        value: device.id
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
          // Filter devices to show only available ones
          const availableDevices = devices.filter(device => 
            device.status === 'available'
          );
          setAvailableDevices(availableDevices || []);
        })
        .catch(error => {
          handleApiError(error, 'Failed to fetch devices for the selected location');
          setAvailableDevices([]);
        });
    } else {
      setAvailableDevices([]);
    }
  };

  const handleDeviceChange = (deviceId) => {
    setSelectedDeviceId(deviceId);
    // Find the device object from the id
    const deviceObj = availableDevices.find(dev => dev.id === deviceId);
    setSelectedDeviceAssign(deviceObj || null);
  };

  const handleAssignSelect = async () => {
    if (!selectedDeviceId) {
      Alert.alert('Error', 'Please select a device to assign.');
      return;
    }

    setAssignLoading(true);

    try {
      console.log('Assigning device via selection menu:', {
        device_id: selectedDeviceId,
        assigned_date: new Date().toISOString().split('T')[0]
      });

      // Use axiosInstance from AuthContext to automatically handle authentication
      const response = await axiosInstance.post(
        '/device-assignments/',
        {
          device_id: selectedDeviceId,
          assigned_date: new Date().toISOString().split('T')[0] // Format as YYYY-MM-DD
        }
      );

      console.log('Assignment successful:', response.data);
      
      Alert.alert(
        'Success', 
        'Device assigned successfully to your account.',
        [{ text: 'OK', onPress: onAssignComplete }]
      );
    } catch (error) {
      console.error('Assignment error:', error);
      
      // Use the provided error handler or fallback to Alert
      if (handleApiError) {
        handleApiError(error, 'Failed to assign device');
      } else {
        let errorMessage = 'Failed to assign device. Please try again.';
        
        if (error.response) {
          // The server responded with an error
          if (error.response.data && typeof error.response.data === 'object') {
            // Try to extract meaningful error messages
            const errors = [];
            Object.entries(error.response.data).forEach(([key, value]) => {
              if (Array.isArray(value)) {
                errors.push(`${key}: ${value.join(', ')}`);
              } else if (typeof value === 'string') {
                errors.push(`${key}: ${value}`);
              }
            });
            
            if (errors.length > 0) {
              errorMessage = errors.join('\n');
            } else if (error.response.data.detail) {
              errorMessage = error.response.data.detail;
            }
          }
        }
        
        Alert.alert('Assignment Error', errorMessage);
      }
    } finally {
      setAssignLoading(false);
    }
  };

  return (
    <View style={styles.assignTabContent}>
      <Text style={styles.assignTabSubtitle}>
        Select a location and device to assign to your account.
      </Text>

      <View style={styles.formSection}>
        <Text style={styles.pickerLabel}>Location:</Text>
        <Dropdown
          value={selectedLocationId}
          onValueChange={handleLocationChange}
          items={locationOptions}
          placeholder="Select a location"
          testID="location-dropdown"
          containerStyle={[
            styles.dropdownContainer,
            Platform.OS === 'ios' ? styles.iosDropdownContainer : {}
          ]}
        />
      </View>
      
      <View style={styles.formSection}>
        <Text style={styles.pickerLabel}>Device:</Text>
        <Dropdown
          value={selectedDeviceId}
          onValueChange={handleDeviceChange}
          items={deviceOptions}
          placeholder={
            selectedLocationId 
              ? deviceOptions.length > 0 
                ? "Select a device" 
                : "No available devices at this location"
              : "Select a location first"
          }
          disabled={!selectedLocationId || deviceOptions.length === 0}
          testID="device-dropdown"
          containerStyle={[
            styles.dropdownContainer,
            Platform.OS === 'ios' ? styles.iosDropdownContainer : {}
          ]}
        />
      </View>
      
      {selectedDeviceAssign && (
        <View style={styles.deviceInfo}>
          <Text style={styles.deviceInfoTitle}>Selected Device:</Text>
          <Text style={styles.deviceInfoText}>ID: {selectedDeviceAssign.identifier}</Text>
          <Text style={styles.deviceInfoText}>Make: {selectedDeviceAssign.make}</Text>
          <Text style={styles.deviceInfoText}>Model: {selectedDeviceAssign.model}</Text>
        </View>
      )}
      
      <View style={styles.assignButtonsContainer}>
        <Button
          title="Assign to Me"
          onPress={handleAssignSelect}
          disabled={!selectedDeviceId || assignLoading}
          isLoading={assignLoading}
          style={styles.submitButton}
        />
      </View>
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
  formSection: {
    marginBottom: 16,
    zIndex: 10, // For iOS dropdown rendering
  },
  pickerLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  dropdownContainer: {
    marginBottom: 5,
  },
  iosDropdownContainer: {
    zIndex: 1000,
    position: 'relative',
  },
  deviceInfo: {
    marginTop: 20,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  deviceInfoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#495057',
  },
  deviceInfoText: {
    fontSize: 14,
    color: '#495057',
    marginBottom: 4,
  },
  assignButtonsContainer: {
    marginTop: 24,
  },
  submitButton: {
    backgroundColor: '#28a745',
  },
});

export default SelectMenuTab;