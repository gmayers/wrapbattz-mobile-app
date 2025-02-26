// screens/HomeScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
  Platform,
  ActivityIndicator,
  Dimensions,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '../context/AuthContext';
import Button from '../components/Button';
import TabBar from '../components/TabBar';
import NfcManager from 'react-native-nfc-manager';
import DeviceCard, { mockAssignments } from './home/components/DeviceCard';
import AssignDeviceModal from './home/components/AssignDevice/AssignDeviceModal';
import NfcManagerModal from './home/components/NFCManager/NFCManagerModal';

const { width } = Dimensions.get('window');

const HomeScreen = ({ navigation }) => {
  const { logout, deviceService } = useAuth();
  const [assignments, setAssignments] = useState(mockAssignments);
  const [locations, setLocations] = useState([]);
  const [selectedReturnLocation, setSelectedReturnLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [assignDeviceModalVisible, setAssignDeviceModalVisible] = useState(false);
  const [nfcManagerModalVisible, setNfcManagerModalVisible] = useState(false);
  const [returnDeviceModalVisible, setReturnDeviceModalVisible] = useState(false);
  const [selectedReturnDevice, setSelectedReturnDevice] = useState(null);

  const tabs = [
    { key: 'dashboard', title: 'Home', icon: <Ionicons name="home-outline" size={24} /> },
    { key: 'reports', title: 'Reports', icon: <Ionicons name="document-text-outline" size={24} /> },
    { key: 'logout', title: 'Logout', icon: <Ionicons name="log-out-outline" size={24} /> },
  ];

  useEffect(() => {
    NfcManager.start();
    fetchInitialData();

    return () => {
      NfcManager.cancelTechnologyRequest().catch(() => 0);
    };
  }, []);

  const handleApiError = (error, defaultMessage) => {
    if (error.response) {
      const errorMessage = error.response.data.detail || defaultMessage;
      Alert.alert('Error', errorMessage);
    } else if (error.request) {
      Alert.alert('Error', 'No response from server. Please try again later.');
    } else {
      Alert.alert('Error', error.message || defaultMessage);
    }

    if (error.response?.status === 401) {
      Alert.alert(
        'Session Expired',
        'Your session has expired. Please login again.',
        [{ text: 'OK', onPress: async () => await logout() }]
      );
    }
  };

  const fetchInitialData = async () => {
    try {
      await Promise.all([
        fetchDeviceAssignments(),
        fetchLocations()
      ]);
    } catch (error) {
      handleApiError(error, 'Failed to fetch initial data');
    }
  };

  const fetchDeviceAssignments = async () => {
    try {
      const data = await deviceService.getAssignments();
      const activeAssignments = data.filter(assignment => !assignment.returned_date);
      setAssignments(activeAssignments);
    } catch (error) {
      handleApiError(error, 'Failed to fetch device assignments');
    } finally {
      setLoading(false);
    }
  };

  const fetchLocations = async () => {
    try {
      const data = await deviceService.getLocations();
      setLocations(data);
    } catch (error) {
      handleApiError(error, 'Failed to fetch locations');
    }
  };

  const fetchDevicesByLocation = async (locationId) => {
    try {
      return await deviceService.getDevicesByLocation(locationId);
    } catch (error) {
      handleApiError(error, 'Failed to fetch devices for the selected location');
      return [];
    }
  };

  const handleDeviceReturn = (assignment) => {
    if (!assignment?.device) {
      Alert.alert('Error', 'Invalid device data');
      return;
    }
    setSelectedReturnDevice(assignment.device);
    setReturnDeviceModalVisible(true);
    setSelectedReturnLocation(null);
  };

  const handleConfirmReturn = async () => {
    if (!selectedReturnLocation) {
      Alert.alert('Error', 'Please select a location.');
      return;
    }

    try {
      const returnedDateTime = new Date().toISOString();
      const [returnedDate, returnedTime] = returnedDateTime.split('T');

      // Update device assignment
      await deviceService.returnDevice(selectedReturnDevice.id, {
        returned_date: returnedDate,
        returned_time: returnedTime.split('.')[0],
      });

      // Create device return entry
      await deviceService.createDeviceReturn({
        device_id: selectedReturnDevice.id,
        location: selectedReturnLocation.id,
        returned_date_time: returnedDateTime,
      });

      Alert.alert('Success', 'Device has been returned successfully');
      setReturnDeviceModalVisible(false);
      setSelectedReturnLocation(null);
      fetchDeviceAssignments();
    } catch (error) {
      handleApiError(error, 'Failed to return device');
    }
  };

  const handleTabPress = (key) => {
    switch (key) {
      case 'dashboard':
        break;
      case 'reports':
        navigation.navigate('Reports');
        break;
      case 'logout':
        Alert.alert(
          'Logout',
          'Are you sure you want to logout?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Logout',
              style: 'destructive',
              onPress: async () => {
                try {
                  await logout();
                } catch (error) {
                  console.error('Logout error:', error);
                  Alert.alert('Error', 'Failed to logout. Please try again.');
                }
              },
            },
          ],
          { cancelable: true }
        );
        break;
    }
  };

  const renderDeviceCard = (assignment) => (
    <DeviceCard
      key={assignment.id}
      assignment={assignment}
      onReturn={handleDeviceReturn}
    />
  );

  const handleAssignComplete = () => {
    setAssignDeviceModalVisible(false);
    fetchDeviceAssignments();
  };

  const handleReturnDeviceModalClose = () => {
    setReturnDeviceModalVisible(false);
    setSelectedReturnLocation(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header Section */}
      <View style={styles.header}>
        <View style={styles.welcomeContainer}>
          <Text style={styles.welcomeText} accessibilityRole="header">
            Welcome{'\n'}User
          </Text>
        </View>
        <View style={styles.spacer} />
        <View style={styles.buttonContainer}>
          <Button
            title="NFC Manager"
            onPress={() => setNfcManagerModalVisible(true)}
            size="small"
            textColor="black"
            style={styles.headerButton}
          />
          <Button
            title="Assign Device"
            onPress={() => setAssignDeviceModalVisible(true)}
            size="small"
            textColor="black"
            style={styles.headerButton}
          />
        </View>
      </View>

      {/* Device Assignments Section */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Devices Assigned</Text>
          <Button
            title="Add Device"
            onPress={() => navigation.navigate('AddDevice')}
            size="small"
            textColor="black"
            style={styles.addDeviceButton}
          />
        </View>
        <View style={styles.section}>
          {loading ? (
            <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
          ) : (
            <View style={styles.devicesContainer}>
              {assignments.length === 0 ? (
                <Text style={styles.emptyText}>No devices currently assigned</Text>
              ) : (
                <>
                  <View style={styles.devicesGrid}>
                    {assignments.slice(0, 5).map((assignment) => renderDeviceCard(assignment))}
                  </View>
                  {assignments.length > 5 && (
                    <TouchableOpacity
                      style={styles.viewAllButton}
                      onPress={() => navigation?.navigate('AllDevices', { assignments })}
                    >
                      <Text style={styles.viewAllText}>
                        View All ({assignments.length} Devices)
                      </Text>
                      <Ionicons name="chevron-forward" size={16} color="#007AFF" />
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom Tab Bar */}
      <TabBar
        tabs={tabs}
        activeTab="dashboard"
        onTabPress={handleTabPress}
        backgroundColor="#FFFFFF"
        activeColor="#007AFF"
        inactiveColor="#666666"
        showIcons
        showLabels
        height={Platform.OS === 'ios' ? 80 : 60}
        containerStyle={styles.tabBarContainer}
        labelStyle={styles.tabBarLabel}
        iconStyle={styles.tabBarIcon}
      />

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
                      Returning: <Text style={styles.modalTextBold}>{selectedReturnDevice.identifier}</Text>
                    </Text>
                    <Text style={styles.modalText}>
                      Type: <Text style={styles.modalTextBold}>{selectedReturnDevice.device_type}</Text>
                    </Text>

                    {/* Location Picker */}
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

      {/* Assign Device Modal */}
      <AssignDeviceModal
        visible={assignDeviceModalVisible}
        onClose={() => setAssignDeviceModalVisible(false)}
        locations={locations}
        fetchDevicesByLocation={fetchDevicesByLocation}
        onAssignComplete={handleAssignComplete}
        handleApiError={handleApiError}
      />

      {/* NFC Manager Modal */}
      <NfcManagerModal
        visible={nfcManagerModalVisible}
        onClose={() => setNfcManagerModalVisible(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: '4%',
    paddingBottom: Platform.OS === 'ios' ? 100 : 80,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: '5%',
    paddingVertical: '3%',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    marginBottom: '3%',
  },
  welcomeContainer: {
    flex: 2,
    justifyContent: 'center',
  },
  welcomeText: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#333',
    lineHeight: 32,
  },
  spacer: {
    width: '3%',
  },
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
  },
  headerButton: {
    marginLeft: '3%',
    paddingHorizontal: 12,
    minWidth: '30%',
    backgroundColor: 'orange',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '3%',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  addDeviceButton: {
    paddingHorizontal: 12,
    minWidth: '25%',
    backgroundColor: 'orange'
  },
  section: {
    marginBottom: '5%',
  },
  devicesContainer: {
    flex: 1,
  },
  devicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: '3%',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginTop: '3%',
    marginBottom: '2%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  viewAllText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '500',
    marginRight: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxHeight: '90%',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
  },
  modalContent: {
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
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
    width: '100%',
  },
  confirmButton: {
    backgroundColor: '#007AFF',
    marginTop: 10,
  },
  cancelButton: {
    backgroundColor: '#ccc',
    marginTop: 10,
  },
  tabBarContainer: {
    paddingBottom: Platform.OS === 'ios' ? 20 : 0,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 10,
  },
  tabBarLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  tabBarIcon: {
    fontSize: 24,
  },
  loader: {
    marginVertical: '5%',
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    marginVertical: '5%',
  },
});

export default HomeScreen;