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
import { useAuth } from '../context/AuthContext';
import Button from '../components/Button';
import Card from '../components/Card';

const { width } = Dimensions.get('window');

const AllDevicesScreen = ({ navigation, route }) => {
  const {
    axiosInstance,
    logout,
    deviceService,
    userData,
    isAdminOrOwner
  } = useAuth();

  const [activeTab, setActiveTab] = useState('assignments');
  // State for "My Assignments" tab
  const [myAssignments, setMyAssignments] = useState([]);
  const [loadingMyAssignments, setLoadingMyAssignments] = useState(true);

  // State for "Organization Devices" (now Organization Assignments) tab
  const [organizationAssignments, setOrganizationAssignments] = useState([]);
  const [loadingOrgAssignments, setLoadingOrgAssignments] = useState(true);

  const [locations, setLocations] = useState([]);
  const [returnDeviceModalVisible, setReturnDeviceModalVisible] = useState(false);
  const [selectedReturnDevice, setSelectedReturnDevice] = useState(null);
  const [selectedReturnLocation, setSelectedReturnLocation] = useState(null);

  useEffect(() => {
    fetchMyAssignments(); // Fetches assignments for the current user
    fetchLocations();

    if (isAdminOrOwner) {
      fetchOrganizationAssignments(); // Fetches all assignments for the organization
    }
  }, [isAdminOrOwner]);

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

  // Fetches current user's assignments (active ones after filtering)
  const fetchMyAssignments = async () => {
    try {
      setLoadingMyAssignments(true);
      // Use getMyAssignments for the "My Assignments" tab
      const data = await deviceService.getMyAssignments();

      // Filter only active assignments
      const activeUserAssignments = data.filter(assignment => !assignment.returned_date);
      setMyAssignments(activeUserAssignments);
    } catch (error) {
      handleApiError(error, 'Failed to fetch your device assignments');
    } finally {
      setLoadingMyAssignments(false);
    }
  };

  // Fetches all assignments for the organization
  const fetchOrganizationAssignments = async () => {
    try {
      setLoadingOrgAssignments(true);
      // Use getAssignments for the "Organization Devices" tab (which now shows assignments)
      const data = await deviceService.getAssignments();
      setOrganizationAssignments(data);
      // Note: No client-side filtering for active assignments here unless specified for this tab
    } catch (error) {
      handleApiError(error, 'Failed to fetch organization assignments.');
    } finally {
      setLoadingOrgAssignments(false);
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

  const handleDeviceReturn = (deviceAssignment, event) => { // Parameter is an assignment object
    // Stop propagation to prevent navigation to details when clicking return button
    event.stopPropagation();
    
    if (!deviceAssignment || !deviceAssignment.device) {
      Alert.alert('Error', 'Invalid device assignment data');
      return;
    }

    setSelectedReturnDevice(deviceAssignment); // selectedReturnDevice is an assignment
    setReturnDeviceModalVisible(true);
    setSelectedReturnLocation(null);
  };

  const handleViewDeviceDetails = (deviceId) => {
    if (deviceId) {
      navigation.navigate('DeviceDetails', { deviceId });
    }
  };

  const handleConfirmReturn = async () => {
    if (!selectedReturnLocation || !selectedReturnLocation.id) {
      Alert.alert('Error', 'Please select a location.');
      return;
    }

    if (!selectedReturnDevice || !selectedReturnDevice.id) {
      Alert.alert('Error', 'No device assignment selected for return.');
      return;
    }

    try {
      const returnedDateTime = new Date().toISOString();

      await deviceService.returnDeviceToLocation(selectedReturnDevice.id, { // .id is assignmentId
        location: selectedReturnLocation.id,
        returned_date_time: returnedDateTime,
      });

      Alert.alert('Success', 'Device has been returned successfully');
      setReturnDeviceModalVisible(false);
      setSelectedReturnLocation(null);
      fetchMyAssignments(); // Refresh my assignments list
      if (isAdminOrOwner) {
        fetchOrganizationAssignments(); // Refresh organization assignments list
      }
    } catch (error) {
      handleApiError(error, 'Failed to return device.');
    }
  };

  const renderAssignmentCard = (assignment) => (
    <TouchableOpacity
      key={assignment.id}
      activeOpacity={0.7}
      onPress={() => handleViewDeviceDetails(assignment.device?.id)}
      style={styles.deviceCardWrapper}
    >
      <Card
        title={assignment.device.identifier}
        subtitle={assignment.device.device_type}
        style={styles.deviceCard}
      >
        <View style={styles.cardContent}>
          <View style={styles.cardInfo}>
            <Text style={styles.infoText}>Make: {assignment.device.make}</Text>
            <Text style={styles.infoText}>Model: {assignment.device.model}</Text>
            <Text style={styles.infoText}>Assigned: {assignment.assigned_date}</Text>
            {assignment.returned_date && (
              <Text style={styles.infoText}>Returned: {assignment.returned_date}</Text>
            )}
            {assignment.assigned_to_user && (
              <Text style={styles.infoText}>
                User: {assignment.assigned_to_user.first_name} {assignment.assigned_to_user.last_name}
              </Text>
            )}
            {assignment.assigned_to_location && (
              <Text style={styles.infoText}>Location: {assignment.assigned_to_location.name}</Text>
            )}
          </View>
          <View style={styles.cardActions}>
            {!assignment.returned_date && (
              <Button
                title="Return"
                variant="outlined"
                size="small"
                onPress={(event) => handleDeviceReturn(assignment, event)}
                style={styles.returnButton}
              />
            )}
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );

  // Renders a card for a device (currently not used for list rendering in this screen based on new requirements)
  // Kept for potential future use or if linked from elsewhere (e.g. DeviceDetails screen)
  const renderDeviceCard = (device) => (
    <TouchableOpacity
      key={device.id}
      activeOpacity={0.7}
      onPress={() => handleViewDeviceDetails(device.id)}
      style={styles.deviceCardWrapper}
    >
      <Card
        title={device.identifier}
        subtitle={device.device_type}
        style={styles.deviceCard}
      >
        <View style={styles.cardContent}>
          <View style={styles.cardInfo}>
            <Text style={styles.infoText}>Make: {device.make}</Text>
            <Text style={styles.infoText}>Model: {device.model}</Text>
            <Text style={styles.infoText}>Serial: {device.serial_number}</Text>
            <Text style={styles.infoText}>Status: {device.active ? 'Active' : 'Inactive'}</Text>
          </View>
          <View style={styles.cardActions}>
            <Button
              title="View Details"
              variant="outlined"
              size="small"
              onPress={(event) => {
                event.stopPropagation();
                navigation.navigate('DeviceDetails', { deviceId: device.id });
              }}
              style={styles.returnButton}
            />
          </View>
        </View>
      </Card>
    </TouchableOpacity>
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
          <Ionicons name="chevron-back" size={24} color="#FF8C00" />
          <Text style={styles.backText}>Devices</Text>
        </TouchableOpacity>
        {isAdminOrOwner && (
          <Button
            title="Add Device"
            onPress={() => navigation.navigate('AddDevice')}
            size="small"
          />
        )}
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'assignments' && styles.activeTabButton
          ]}
          onPress={() => setActiveTab('assignments')}
        >
          <Text style={[
            styles.tabText,
            activeTab === 'assignments' && styles.activeTabText
          ]}>
            My Assignments
          </Text>
        </TouchableOpacity>

        {isAdminOrOwner && (
          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === 'all' && styles.activeTabButton
            ]}
            onPress={() => setActiveTab('all')}
          >
            <Text style={[
              styles.tabText,
              activeTab === 'all' && styles.activeTabText
            ]}>
              Organization Assignments
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* My Assignments Tab Content */}
      {activeTab === 'assignments' && (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.section}>
            {loadingMyAssignments ? (
              <ActivityIndicator size="large" color="#FF8C00" style={styles.loader} />
            ) : myAssignments.length > 0 ? (
              <View style={styles.devicesGrid}>
                {myAssignments.map(renderAssignmentCard)}
              </View>
            ) : (
              <Text style={styles.emptyText}>No active device assignments found</Text>
            )}
          </View>
        </ScrollView>
      )}

      {/* All Organization Assignments Tab Content */}
      {activeTab === 'all' && isAdminOrOwner && (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.section}>
            {loadingOrgAssignments ? (
              <ActivityIndicator size="large" color="#FF8C00" style={styles.loader} />
            ) : organizationAssignments.length > 0 ? (
              <View style={styles.devicesGrid}>
                {organizationAssignments.map(renderAssignmentCard)}
              </View>
            ) : (
              <Text style={styles.emptyText}>No organization assignments found</Text>
            )}
          </View>
        </ScrollView>
      )}

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
                {selectedReturnDevice && selectedReturnDevice.device && ( // Ensure device object exists
                  <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>Return Device</Text>
                    <Text style={styles.modalText}>
                      Returning: <Text style={styles.modalTextBold}>{selectedReturnDevice.device.identifier}</Text>
                    </Text>
                    <Text style={styles.modalText}>
                      Type: <Text style={styles.modalTextBold}>{selectedReturnDevice.device.device_type}</Text>
                    </Text>

                    <Text style={styles.modalText}>Select Return Location:</Text>
                    <View style={styles.pickerContainer}>
                      <Picker
                        selectedValue={selectedReturnLocation}
                        onValueChange={(itemValue) => setSelectedReturnLocation(itemValue)}
                        style={styles.picker}
                        prompt="Select a location"
                      >
                        <Picker.Item label="-- Select a location --" value={null} />
                        {locations.map((location) => (
                          <Picker.Item key={location.id} label={location.name} value={location} />
                        ))}
                      </Picker>
                    </View>

                    <Button
                      title="Confirm Return"
                      onPress={handleConfirmReturn}
                      style={styles.confirmButton}
                      disabled={!selectedReturnLocation}
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
    color: '#FF8C00', // Updated to orange
    marginLeft: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  activeTabButton: {
    borderBottomColor: '#FF8C00', // Updated to orange
  },
  tabText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#666',
  },
  activeTabText: {
    color: '#FF8C00', // Updated to orange
    fontWeight: '600',
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
    borderColor: '#FFA500', // Subtle orange border
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: '#FFF3E0', // Light orange background
  },
  cardContent: {
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: 10,
  },
  cardInfo: {
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    color: '#4A3B31', // Darker text for contrast on light orange
    marginBottom: 4,
  },
  cardActions: {
    width: '100%',
    marginTop: 5,
  },
  returnButton: {
    width: '100%',
    borderColor: '#FF8C00', // Orange border for button
    backgroundColor: 'transparent',
    borderRadius: 5,
  },
  loader: {
    marginTop: 20,
    color: '#FF8C00', // Orange loader
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
    paddingHorizontal: 20,
    paddingVertical: 25,
  },
  modalContent: {},

  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF8C00', // Orange modal title
    marginBottom: 20,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 16,
    marginBottom: 10,
    color: '#555',
    lineHeight: 22,
  },
  modalTextBold: {
    fontWeight: 'bold',
    color: '#333',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#FFA500', // Orange border for picker
    borderRadius: 8,
    marginBottom: 20,
    justifyContent: 'center',
  },
  picker: {
    height: Platform.OS === 'ios' ? 120 : 50,
    width: '100%',
  },
  confirmButton: {
    marginTop: 10,
    backgroundColor: '#FF8C00', // Orange confirm button
    borderColor: '#FF8C00',
  },
  cancelButton: {
    marginTop: 10,
    borderColor: '#FF8C00', // 
    color: '#FF8C00', // 
    textColor: 'orange'
  },
});

export default AllDevicesScreen;