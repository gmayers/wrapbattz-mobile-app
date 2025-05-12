import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, Platform } from 'react-native';
import Dropdown from '../../../../components/Dropdown';
import Button from '../../../../components/Button';
import { useAuth } from '../../../../context/AuthContext';

// Define the orange color to match other screens
const ORANGE_COLOR = '#FF9500';

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
  
  // Import deviceService and axiosInstance from AuthContext
  const { deviceService, axiosInstance } = useAuth();
  
  // Transform locations into dropdown format and select first location
  useEffect(() => {
    console.log('SelectMenuTab - useEffect[locations] - locations count:', locations?.length);
    
    if (locations && locations.length > 0) {
      // Create location options
      const options = locations.map(location => ({
        label: location.name || `${location.street_number} ${location.street_name}`,
        value: location.id
      }));
      
      setLocationOptions(options);
      
      // Auto-select first location
      if (options.length > 0 && !selectedLocationId) {
        const firstLocationId = options[0].value;
        setSelectedLocationId(firstLocationId);
        
        // Find the location object from the id
        const locationObj = locations.find(loc => loc.id === firstLocationId);
        setSelectedLocationAssign(locationObj || null);
        
        // Fetch devices for the first location
        fetchDevicesForLocation(firstLocationId);
      }
    }
  }, [locations]);
  
  // Auto-select first device when availableDevices changes
  useEffect(() => {
    if (availableDevices && availableDevices.length > 0) {
      const options = availableDevices.map(device => ({
        label: `${device.make} ${device.model} - ${device.identifier}`,
        value: device.id
      }));
      
      setDeviceOptions(options);
      
      // Auto-select first device if one is available and none is selected
      if (options.length > 0 && !selectedDeviceId) {
        const firstDeviceId = options[0].value;
        setSelectedDeviceId(firstDeviceId);
        
        // Find the device object from the id
        const deviceObj = availableDevices.find(dev => 
          dev.id === parseInt(firstDeviceId) || dev.id === firstDeviceId
        );
        
        setSelectedDeviceAssign(deviceObj || null);
      }
    } else {
      setDeviceOptions([]);
      // Clear device selection if no devices are available
      setSelectedDeviceId('');
      setSelectedDeviceAssign(null);
    }
  }, [availableDevices]);

  // Helper function to fetch devices for a location
  const fetchDevicesForLocation = async (locationId) => {
    if (locationId) {
      try {
        const devices = await fetchDevicesByLocation(locationId);
        
        // Filter for available devices
        const availableDevices = devices.filter(device => 
          device.status === 'available'
        );
        
        setAvailableDevices(availableDevices || []);
      } catch (error) {
        console.error('SelectMenuTab - Error fetching devices for location:', error);
        handleApiError(error, 'Failed to fetch devices for the selected location');
        setAvailableDevices([]);
      }
    } else {
      setAvailableDevices([]);
    }
  };

  const handleLocationChange = (locationId) => {
    setSelectedLocationId(locationId);
    setSelectedDeviceId('');
    setSelectedDeviceAssign(null);
    
    // Find the location object from the id
    const locationObj = locations.find(loc => loc.id === locationId);
    setSelectedLocationAssign(locationObj || null);
    
    // Fetch devices for the selected location
    fetchDevicesForLocation(locationId);
  };

  const handleDeviceChange = (deviceId) => {
    setSelectedDeviceId(deviceId);
    
    // Find the device object from the id
    const deviceObj = availableDevices.find(dev => 
      dev.id === parseInt(deviceId) || dev.id === deviceId
    );
    
    setSelectedDeviceAssign(deviceObj || null);
  };

  const handleAssignSelect = async () => {
    if (!selectedDeviceId) {
      Alert.alert('Error', 'Please select a device to assign.');
      return;
    }

    setAssignLoading(true);

    try {
      console.log(`Assigning device ${selectedDeviceId} to current user`);
      
      // Use the dedicated assign-to-me endpoint which doesn't require any request body
      // This endpoint automatically assigns the device to the authenticated user
      const response = await axiosInstance.post(
        `/device-assignments/device/${selectedDeviceId}/assign-to-me/`
      );
      
      Alert.alert(
        'Success', 
        'Device assigned successfully to your account.',
        [{ text: 'OK', onPress: () => {
          onAssignComplete();
        }}]
      );
    } catch (error) {
      console.error('Assignment error:', error);
      
      // Log the error details
      if (error.response) {
        console.error('Error status:', error.response.status);
        console.error('Error data:', JSON.stringify(error.response.data, null, 2));
      }
      
      // Use the provided error handler or fallback to Alert
      if (handleApiError) {
        handleApiError(error, 'Failed to assign device');
      } else {
        let errorMessage = 'Failed to assign device. Please try again.';
        
        if (error.response && error.response.data) {
          if (typeof error.response.data === 'string') {
            errorMessage = error.response.data;
          } else if (error.response.data.detail) {
            errorMessage = error.response.data.detail;
          } else if (error.response.data.message) {
            errorMessage = error.response.data.message;
          }
        }
        
        Alert.alert('Assignment Error', errorMessage);
      }
    } finally {
      setAssignLoading(false);
    }
  };

  // Determine if button should be disabled based on selections and loading state
  const isButtonDisabled = !selectedDeviceId || assignLoading;

  return (
    <View style={styles.container}>
      <Text style={styles.headerText}>
        Select a device to assign to your account.
      </Text>

      {/* Location Dropdown */}
      <View style={styles.formSection}>
        <Text style={styles.inputLabel}>Location:</Text>
        <View style={styles.dropdownWrapper}>
          <Dropdown
            value={selectedLocationId}
            onValueChange={handleLocationChange}
            items={locationOptions}
            placeholder="Select a location"
            testID="location-dropdown"
            containerStyle={styles.dropdown}
            style={Platform.OS === 'ios' ? styles.iosDropdown : {}}
          />
        </View>
        <Text style={styles.helpText}>Select a location to view available devices</Text>
      </View>
      
      {/* Device Dropdown */}
      <View style={styles.formSection}>
        <Text style={styles.inputLabel}>Device:</Text>
        <View style={styles.dropdownWrapper}>
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
            containerStyle={styles.dropdown}
            style={[
              deviceOptions.length === 0 ? styles.disabledDropdown : {},
              Platform.OS === 'ios' ? styles.iosDropdown : {}
            ]}
          />
        </View>
      </View>
      
      {/* Flexible spacer to push button to bottom */}
      <View style={styles.flexSpacer} />
      
      {/* Assignment Button */}
      <Button
        title={assignLoading ? "Assigning..." : "Assign to My Account"}
        onPress={handleAssignSelect}
        disabled={isButtonDisabled}
        isLoading={assignLoading}
        style={[
          styles.assignButton,
          isButtonDisabled ? styles.disabledButton : {}
        ]}
        textColor="white"
        testID="assign-button"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  headerText: {
    fontSize: 16,
    color: '#555',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 22,
  },
  formSection: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  helpText: {
    fontSize: 12,
    color: '#777',
    marginTop: 4,
    fontStyle: 'italic',
  },
  dropdownWrapper: {
    // This wrapper helps with iOS z-index issues
    ...(Platform.OS === 'ios' ? {
      zIndex: 50,
      position: 'relative',
    } : {})
  },
  dropdown: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    // Crucial fix for iOS
    ...(Platform.OS === 'ios' ? {
      zIndex: 100,
    } : {})
  },
  iosDropdown: {
    // iOS-specific dropdown styling
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
  },
  disabledDropdown: {
    backgroundColor: '#f1f1f1',
    borderColor: '#ddd',
  },
  flexSpacer: {
    flex: 1,
    minHeight: 20,
  },
  assignButton: {
    marginTop: 16,
    backgroundColor: ORANGE_COLOR,
    paddingVertical: 12,
    borderRadius: 8,
  },
  disabledButton: {
    opacity: 0.5,
    backgroundColor: '#aaa',
  }
});

export default SelectMenuTab;