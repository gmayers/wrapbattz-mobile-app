import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, Platform } from 'react-native';
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
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  
  // Import axiosInstance from AuthContext
  const { axiosInstance } = useAuth();
  
  // Transform locations into dropdown format and select first location
  useEffect(() => {
    if (locations && locations.length > 0) {
      // Create location options
      const options = locations.map(location => ({
        label: location.name || `${location.street_number} ${location.street_name}`,
        value: location.id
      }));
      
      setLocationOptions(options);
      
      // Auto-select first location if no location is selected yet
      if (!selectedLocationId && !initialLoadComplete) {
        const firstLocationId = options[0].value;
        console.log(`Auto-selecting first location: ${firstLocationId}`);
        setSelectedLocationId(firstLocationId);
        
        // Find the location object from the id
        const locationObj = locations.find(loc => loc.id === firstLocationId);
        setSelectedLocationAssign(locationObj || null);
        
        // Fetch devices for the first location
        fetchDevicesForLocation(firstLocationId);
        setInitialLoadComplete(true);
      }
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

  // Helper function to fetch devices for a location
  const fetchDevicesForLocation = (locationId) => {
    if (locationId) {
      fetchDevicesByLocation(locationId)
        .then(devices => {
          // Filter devices to show only available ones
          const availableDevices = devices.filter(device => 
            device.status === 'available'
          );
          console.log(`Found ${availableDevices.length} available devices at location ${locationId}`);
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

  const handleLocationChange = (locationId) => {
    console.log(`Location changed to: ${locationId}`);
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
    console.log(`Device changed to: ${deviceId}`);
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
    <View style={styles.container}>
      <Text style={styles.headerText}>
        Select a location and device to assign to your account.
      </Text>

      {/* Improved iOS-compatible dropdown for locations */}
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
      </View>
      
      {/* Improved iOS-compatible dropdown for devices */}
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
      
      {/* Device info card with improved styling */}
      {selectedDeviceAssign && (
        <View style={styles.deviceInfoCard}>
          <Text style={styles.deviceInfoTitle}>Selected Device</Text>
          <View style={styles.deviceInfoRow}>
            <Text style={styles.deviceInfoLabel}>ID:</Text>
            <Text style={styles.deviceInfoValue}>{selectedDeviceAssign.identifier}</Text>
          </View>
          <View style={styles.deviceInfoRow}>
            <Text style={styles.deviceInfoLabel}>Make:</Text>
            <Text style={styles.deviceInfoValue}>{selectedDeviceAssign.make}</Text>
          </View>
          <View style={styles.deviceInfoRow}>
            <Text style={styles.deviceInfoLabel}>Model:</Text>
            <Text style={styles.deviceInfoValue}>{selectedDeviceAssign.model}</Text>
          </View>
        </View>
      )}
      
      {/* Bottom spacer to push button to bottom when no device is selected */}
      {!selectedDeviceAssign && <View style={styles.flexSpacer} />}
      
      {/* Enhanced button with better styling */}
      <Button
        title="Assign to My Account"
        onPress={handleAssignSelect}
        disabled={!selectedDeviceId || assignLoading}
        isLoading={assignLoading}
        style={styles.assignButton}
        textColor="white"
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
  deviceInfoCard: {
    marginTop: 24,
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  deviceInfoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
    textAlign: 'center',
  },
  deviceInfoRow: {
    flexDirection: 'row',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  deviceInfoLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#555',
    width: 80,
  },
  deviceInfoValue: {
    fontSize: 15,
    color: '#333',
    flex: 1,
  },
  flexSpacer: {
    flex: 1,
    minHeight: 20,
  },
  assignButton: {
    marginTop: 16,
    backgroundColor: '#28a745', // Changed to green to differentiate from orange close button
    paddingVertical: 12,
    borderRadius: 8,
  },
});

export default SelectMenuTab;