// ReturnModal.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableWithoutFeedback,
  Alert,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Dropdown from '../../../../components/Dropdown';
import Button from '../../../../components/Button';
import Card from '../../../../components/Card';
import { useAuth } from '../../../../context/AuthContext';

const ReturnModal = ({
  visible,
  onClose,
  onSuccess,
  device,
  locations = [],
}) => {
  // State
  const [selectedLocation, setSelectedLocation] = useState('');
  const [locationOptions, setLocationOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const { axiosInstance } = useAuth();

  // Transform locations into dropdown format when locations change
  useEffect(() => {
    console.log('[RM-2000] ReturnModal - locations changed:', locations);
    console.log('[RM-2001] ReturnModal - current selectedLocation:', selectedLocation);
    
    if (locations.length > 0) {
      const options = locations.map(location => ({
        label: location.name,
        value: location.id
      }));
      console.log('[RM-2002] ReturnModal - created location options:', options);
      setLocationOptions(options);
      
      // Set a default location if we have options and none is selected yet
      if (options.length > 0 && (!selectedLocation || selectedLocation === '')) {
        console.log('[RM-2003] ReturnModal - setting default location to:', options[0].value);
        setSelectedLocation(options[0].value);
      }
    }
  }, [locations, selectedLocation]);

  // When modal visibility changes
  useEffect(() => {
    console.log('[RM-3000] ReturnModal - modal visibility changed:', visible);
    console.log('[RM-3001] ReturnModal - locations available:', locations.length);
    console.log('[RM-3002] ReturnModal - location options:', locationOptions.length);
    
    if (visible) {
      console.log('[RM-3003] ReturnModal - modal opened, selected location:', selectedLocation);
      // If modal is becoming visible and we have options but no selection, set default
      if (locationOptions.length > 0 && (!selectedLocation || selectedLocation === '')) {
        console.log('[RM-3004] ReturnModal - setting default location on modal open:', locationOptions[0].value);
        setSelectedLocation(locationOptions[0].value);
      }
    } else {
      // Reset location between openings
      setSelectedLocation('');
      console.log('[RM-3005] ReturnModal - modal closed, resetting loading state');
      setLoading(false);
    }
  }, [visible, locationOptions, selectedLocation]);

  // Additional useEffect to track locationOptions changes specifically
  useEffect(() => {
    console.log('[RM-7000] ReturnModal - locationOptions changed, count:', locationOptions.length);
    if (locationOptions.length > 0) {
      console.log('[RM-7001] ReturnModal - first option:', locationOptions[0]);
    }
  }, [locationOptions]);

  // Additional useEffect to track selectedLocation changes
  useEffect(() => {
    console.log('[RM-8000] ReturnModal - selectedLocation changed to:', selectedLocation);
  }, [selectedLocation]);

  // Handle return submission
  const handleSubmit = async () => {
    console.log('[RM-4000] ReturnModal - handleSubmit called');
    console.log('[RM-4001] ReturnModal - current selectedLocation:', selectedLocation);
    console.log('[RM-4002] ReturnModal - locationOptions:', locationOptions);
    
    // Final check - if no location is selected but options exist, select the first one
    if ((!selectedLocation || selectedLocation === '') && locationOptions.length > 0) {
      console.log('[RM-4003] ReturnModal - setting default location in handleSubmit:', locationOptions[0].value);
      setSelectedLocation(locationOptions[0].value);
      console.log('[RM-4004] ReturnModal - returning early to wait for state update');
      // Return early to wait for state update before proceeding
      return;
    }
    
    if (!selectedLocation) {
      console.log('[RM-4005] ReturnModal - ERROR: No location selected');
      Alert.alert('Error', 'Please select a return location');
      return;
    }

    if (!device) {
      console.log('[RM-4006] ReturnModal - ERROR: No device selected');
      Alert.alert('Error', 'No device selected for return');
      return;
    }
    
    console.log('[RM-4007] ReturnModal - proceeding with submission, location:', selectedLocation);
    setLoading(true);
    
    try {
      const currentDate = new Date().toISOString();
      console.log('[RM-4008] ReturnModal - current date:', currentDate);

      // Use axiosInstance instead of fetch for consistent handling
      // Update assignment status
      console.log('[RM-4009] ReturnModal - updating device assignment:', device.id);
      await axiosInstance.patch(
        `/device-assignments/${device.id}/`,
        {
          returned_date: currentDate.split('T')[0],
          returned_time: currentDate.split('T')[1].split('.')[0],
        }
      );
      
      // Create return record
      console.log('[RM-4010] ReturnModal - creating device return record');
      await axiosInstance.post(
        '/device-returns/',
        {
          device_id: device.id,
          location: selectedLocation,
          returned_date_time: currentDate,
        }
      );

      console.log('[RM-4011] ReturnModal - submission successful');
      Alert.alert(
        'Success',
        'Device has been returned successfully',
        [{ text: 'OK', onPress: () => {
          console.log('[RM-4012] ReturnModal - success alert confirmed');
          onSuccess?.();
          onClose();
        }}]
      );
    } catch (error) {
      console.error('[RM-4013] Return error:', error);
      let errorMessage = 'Failed to return device. Please try again.';
      
      if (error.response && error.response.data) {
        console.log('[RM-4014] ReturnModal - error response data:', error.response.data);
        if (typeof error.response.data === 'string') {
          errorMessage = error.response.data;
        } else if (error.response.data.detail) {
          errorMessage = error.response.data.detail;
        } else if (error.response.data.message) {
          errorMessage = error.response.data.message;
        }
      }
      
      console.log('[RM-4015] ReturnModal - showing error alert:', errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      console.log('[RM-4016] ReturnModal - resetting loading state');
      setLoading(false);
    }
  };

  if (!device) {
    console.log('[RM-9000] ReturnModal - no device, returning null');
    return null;
  }

  console.log('[RM-9001] ReturnModal - rendering with selectedLocation:', selectedLocation);

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
              {/* Header */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Return Device</Text>
                <TouchableWithoutFeedback onPress={onClose}>
                  <Ionicons name="close" size={24} color="#333" />
                </TouchableWithoutFeedback>
              </View>

              <ScrollView 
                style={styles.contentContainer}
                contentContainerStyle={styles.contentContainerStyle}
              >
                {/* Device Info */}
                <Card style={styles.deviceCard}>
                  <View style={styles.deviceInfo}>
                    <Text style={styles.deviceId}>
                      Device ID: {device.identifier}
                    </Text>
                    <Text style={styles.deviceType}>
                      Type: {device.device_type}
                    </Text>
                    <View style={styles.divider} />
                    <Text style={styles.deviceDetails}>
                      Make: {device.make}
                    </Text>
                    <Text style={styles.deviceDetails}>
                      Model: {device.model}
                    </Text>
                  </View>
                </Card>

                {/* Location Selection */}
                <View style={styles.formSection}>
                  <Text style={styles.sectionTitle}>Select Return Location</Text>
                  {locationOptions.length > 0 ? (
                    <>
                      <Text style={styles.debugText}>
                        Debug - Selected: {selectedLocation || 'none'} - Options: {locationOptions.length}
                      </Text>
                      <Dropdown
                        value={selectedLocation}
                        onValueChange={(value) => {
                          console.log('[RM-5000] ReturnModal - dropdown value changed to:', value);
                          setSelectedLocation(value);
                        }}
                        items={locationOptions}
                        placeholder="Select a location"
                        disabled={loading}
                        testID="return-location-dropdown"
                        containerStyle={styles.dropdownContainer}
                        style={selectedLocation ? {} : styles.requiredField} // Highlight if empty
                      />
                    </>
                  ) : (
                    <Text style={styles.noLocationsText}>
                      No locations available
                    </Text>
                  )}
                </View>

                {/* Action Buttons */}
                <View style={styles.buttonContainer}>
                  <Button
                    title="Cancel"
                    onPress={onClose}
                    variant="outlined"
                    disabled={loading}
                    style={styles.cancelButton}
                  />
                  <Button
                    title={loading ? "Returning..." : "Confirm Return"}
                    onPress={() => {
                      console.log('[RM-6000] ReturnModal - confirm button pressed');
                      handleSubmit();
                    }}
                    disabled={loading || locationOptions.length === 0}
                    style={styles.confirmButton}
                  />
                </View>

                {loading && (
                  <ActivityIndicator 
                    size="large" 
                    color="#007AFF" 
                    style={styles.loader}
                  />
                )}
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
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  contentContainer: {
    flex: 1,
  },
  contentContainerStyle: {
    padding: 15,
  },
  deviceCard: {
    marginBottom: 20,
  },
  deviceInfo: {
    padding: 10,
  },
  deviceId: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  deviceType: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 10,
  },
  deviceDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  formSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  dropdownContainer: {
    marginBottom: 20,
    zIndex: 1000,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  cancelButton: {
    flex: 1,
  },
  confirmButton: {
    flex: 1,
    backgroundColor: 'orange',
  },
  loader: {
    marginTop: 20,
  },
  noLocationsText: {
    fontSize: 14,
    color: '#f44336',
    fontStyle: 'italic',
    marginBottom: 10,
  },
  requiredField: {
    borderColor: 'red',
    borderWidth: 1,
  },
  debugText: {
    fontSize: 12,
    color: '#666',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    backgroundColor: '#f8f8f8',
    padding: 4,
    marginBottom: 8,
    borderRadius: 4,
  },
});

export default ReturnModal;