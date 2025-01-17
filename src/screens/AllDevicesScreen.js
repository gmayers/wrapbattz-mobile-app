// AllDevicesScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
  Modal,
  TouchableWithoutFeedback,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Button from '../components/Button';
import Card from '../components/Card';

const { width } = Dimensions.get('window');

const AllDevicesScreen = ({ navigation }) => {
  const { getAccessToken, logout } = useAuth();
  const [devices, setDevices] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [returnDeviceModalVisible, setReturnDeviceModalVisible] = useState(false);
  const [selectedReturnDevice, setSelectedReturnDevice] = useState(null);
  const [selectedReturnLocation, setSelectedReturnLocation] = useState(null);

  useEffect(() => {
    fetchDevices();
    fetchLocations();
  }, []);

  const fetchDevices = async () => {
    try {
      const token = await getAccessToken();
      if (!token) {
        Alert.alert('Error', 'Authentication token not found. Please log in again.');
        await logout();
        return;
      }

      const response = await axios.get('https://test.gmayersservices.com/api/device-assignments/', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      // Filter only active assignments
      const activeDevices = response.data.filter(assignment => !assignment.returned_date);
      setDevices(activeDevices);
    } catch (error) {
      handleApiError(error, 'Failed to fetch devices.');
    } finally {
      setLoading(false);
    }
  };

  const fetchLocations = async () => {
    try {
      const token = await getAccessToken();
      if (!token) {
        Alert.alert('Error', 'Authentication token not found. Please log in again.');
        await logout();
        return;
      }

      const response = await axios.get('https://test.gmayersservices.com/api/locations/', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      setLocations(response.data);
    } catch (error) {
      handleApiError(error, 'Failed to fetch locations.');
    }
  };

  const handleApiError = (error, defaultMessage) => {
    if (error.response) {
      const errorMessage = error.response.data.detail || defaultMessage;
      Alert.alert('Error', errorMessage);
    } else if (error.request) {
      Alert.alert('Error', 'No response from server. Please try again later.');
    } else {
      Alert.alert('Error', error.message || defaultMessage);
    }

    if (error.response && error.response.status === 401) {
      Alert.alert(
        'Session Expired',
        'Your session has expired. Please login again.',
        [{ text: 'OK', onPress: async () => await logout() }]
      );
    }
  };

  const handleDeviceReturn = (device) => {
    if (!device) {
      Alert.alert('Error', 'Invalid device data');
      return;
    }
    
    setSelectedReturnDevice(device);
    setReturnDeviceModalVisible(true);
    setSelectedReturnLocation(null);
  };

  const handleConfirmReturn = async () => {
    if (!selectedReturnLocation) {
      Alert.alert('Error', 'Please select a location.');
      return;
    }

    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      const returnedDateTime = new Date().toISOString();

      await axios.patch(
        `https://test.gmayersservices.com/api/device-assignments/${selectedReturnDevice.id}/`,
        {
          returned_date: returnedDateTime.split('T')[0],
          returned_time: returnedDateTime.split('T')[1].split('.')[0],
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const newEntryData = {
        device_id: selectedReturnDevice.id,
        location: selectedReturnLocation.id,
        returned_date_time: returnedDateTime,
      };

      await axios.post(
        'https://test.gmayersservices.com/api/device-returns/',
        newEntryData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      Alert.alert('Success', 'Device has been returned successfully');
      setReturnDeviceModalVisible(false);
      setSelectedReturnLocation(null);
      fetchDevices(); // Refresh the devices list
    } catch (error) {
      handleApiError(error, 'Failed to return device.');
    }
  };

  const renderDeviceCard = (device) => (
    <Card
      key={device.id}
      title={device.device.identifier}
      subtitle={device.device.device_type}
      style={styles.deviceCard}
    >
      <View style={styles.cardContent}>
        <View style={styles.cardInfo}>
          <Text style={styles.infoText}>Make: {device.device.make}</Text>
          <Text style={styles.infoText}>Model: {device.device.model}</Text>
          <Text style={styles.infoText}>Assigned: {device.assigned_date}</Text>
        </View>
        <View style={styles.cardActions}>
          <Button
            title="Return"
            variant="outlined"
            size="small"
            onPress={() => handleDeviceReturn(device)}
            style={styles.returnButton}
          />
        </View>
      </View>
    </Card>
  );

  const handleReturnDeviceModalClose = () => {
    setReturnDeviceModalVisible(false);
    setSelectedReturnLocation(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color="#007AFF" />
          <Text style={styles.backText}>Devices</Text>
        </TouchableOpacity>
        <Button
          title="Add Device"
          onPress={() => navigation.navigate('AddDevice')}
          size="small"
        />
      </View>

      {/* Device List */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          {loading ? (
            <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
          ) : devices.length > 0 ? (
            <View style={styles.devicesGrid}>
              {devices.map(renderDeviceCard)}
            </View>
          ) : (
            <Text style={styles.emptyText}>No devices found</Text>
          )}
        </View>
      </ScrollView>

      {/* Return Device Modal */}
      <Modal
        visible={returnDeviceModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={handleReturnDeviceModalClose}
      >
        <TouchableWithoutFeedback onPress={handleReturnDeviceModalClose}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContainer}>
                {selectedReturnDevice && (
                  <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>Return Device</Text>
                    <Text style={styles.modalText}>
                      Returning: <Text style={styles.modalTextBold}>{selectedReturnDevice.device.identifier}</Text>
                    </Text>
                    <Text style={styles.modalText}>
                      Type: <Text style={styles.modalTextBold}>{selectedReturnDevice.device.device_type}</Text>
                    </Text>

                    <Text style={styles.modalText}>Select Location:</Text>
                    <View style={styles.pickerContainer}>
                      <Picker
                        selectedValue={selectedReturnLocation}
                        onValueChange={(itemValue) => setSelectedReturnLocation(itemValue)}
                        style={styles.picker}
                      >
                        <Picker.Item label="Select a location" value={null} />
                        {locations.map((location) => (
                          <Picker.Item key={location.id} label={location.name} value={location} />
                        ))}
                      </Picker>
                    </View>

                    <Button
                      title="Confirm Return"
                      onPress={handleConfirmReturn}
                      style={styles.confirmButton}
                    />
                    <Button
                      title="Cancel"
                      onPress={handleReturnDeviceModalClose}
                      variant="outlined"
                      style={styles.cancelButton}
                    />
                  </View>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backText: {
    fontSize: 17,
    color: '#007AFF',
    marginLeft: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 15,
  },
  section: {
    flex: 1,
  },
  devicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  deviceCard: {
    width: (width * 0.45),
    marginBottom: 15,
  },
  cardContent: {
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  cardInfo: {
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  cardActions: {
    width: '100%',
  },
  returnButton: {
    width: '100%',
  },
  loader: {
    marginTop: 20,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    marginTop: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
  },
  modalContent: {
    paddingBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  modalText: {
    fontSize: 16,
    marginBottom: 10,
    color: '#555',
  },
  modalTextBold: {
    fontWeight: 'bold',
    color: '#333',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    marginBottom: 15,
  },
  picker: {
    height: 50,
  },
  confirmButton: {
    backgroundColor: '#007AFF',
    marginTop: 10,
  },
  cancelButton: {
    marginTop: 10,
  },
});

export default AllDevicesScreen;