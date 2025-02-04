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
import { Picker } from '@react-native-picker/picker';
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
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const { getAccessToken } = useAuth();

  // Reset state when modal closes
  useEffect(() => {
    if (!visible) {
      setSelectedLocation(null);
      setLoading(false);
    }
  }, [visible]);

  // Handle return submission
  const handleSubmit = async () => {
    if (!selectedLocation) {
      Alert.alert('Error', 'Please select a return location');
      return;
    }

    if (!device) {
      Alert.alert('Error', 'No device selected for return');
      return;
    }

    setLoading(true);
    try {
      const token = await getAccessToken();
      const currentDate = new Date().toISOString();

      // Update assignment status
      const assignmentResponse = await fetch(
        `https://test.gmayersservices.com/api/device-assignments/${device.id}/`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            returned_date: currentDate.split('T')[0],
            returned_time: currentDate.split('T')[1].split('.')[0],
          }),
        }
      );

      if (!assignmentResponse.ok) {
        throw new Error('Failed to update assignment status');
      }

      // Create return record
      const returnResponse = await fetch(
        'https://test.gmayersservices.com/api/device-returns/',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            device_id: device.id,
            location: selectedLocation.id,
            returned_date_time: currentDate,
          }),
        }
      );

      if (!returnResponse.ok) {
        throw new Error('Failed to create return record');
      }

      Alert.alert(
        'Success',
        'Device has been returned successfully',
        [{ text: 'OK', onPress: () => {
          onSuccess?.();
          onClose();
        }}]
      );
    } catch (error) {
      console.error('Return error:', error);
      Alert.alert('Error', 'Failed to return device. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!device) return null;

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
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={selectedLocation}
                      onValueChange={setSelectedLocation}
                      enabled={!loading}
                      style={styles.picker}
                    >
                      <Picker.Item 
                        label="Select a location" 
                        value={null} 
                        color="#999"
                      />
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
                    onPress={handleSubmit}
                    disabled={loading || !selectedLocation}
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
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#F8F8F8',
    marginBottom: 20,
  },
  picker: {
    height: 50,
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
  },
  loader: {
    marginTop: 20,
  },
});

export default ReturnModal;