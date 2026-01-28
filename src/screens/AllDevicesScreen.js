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
  Dimensions,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ORANGE_COLOR = '#FF9500';
import { useAuth } from '../context/AuthContext';
import Button from '../components/Button';
import Card from '../components/Card';
import StandardDeviceCard from '../components/StandardDeviceCard';

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
    // Skip 401 errors - they're handled globally by the axios interceptor
    if (error.response?.status === 401) {
      return;
    }

    if (error.response) {
      const errorMessage = error.response.data.detail || defaultMessage;
      Alert.alert('Error', errorMessage);
    } else if (error.request) {
      Alert.alert('Error', 'No response from server. Please try again later.');
    } else {
      Alert.alert('Error', error.message || defaultMessage);
    }
  };

  // Fetches current user's assignments using my_assignments endpoint
  const fetchMyAssignments = async () => {
    try {
      setLoadingMyAssignments(true);
      
      const response = await axiosInstance.get('/device-assignments/my_assignments/');
      const allAssignments = response.data;
      
      setMyAssignments(allAssignments);
      console.log('My assignments count:', allAssignments.length);
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
      navigation.navigate('DeviceDetails', { 
        deviceId,
        sourceScreen: 'AllDevices'
      });
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
    <StandardDeviceCard
      key={assignment.id}
      assignment={assignment}
      onReturn={(assignment) => handleDeviceReturn(assignment, { stopPropagation: () => {} })}
      onViewDetails={handleViewDeviceDetails}
      style={styles.deviceCard}
      showActiveStatus={true}
      showReturnButton={true}
    />
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
                navigation.navigate('DeviceDetails', { 
                  deviceId: device.id,
                  sourceScreen: 'AllDevices'
                });
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
              Organization Devices
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
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalOverlayTouchable}
            onPress={handleReturnDeviceModalClose}
            activeOpacity={1}
          />
          <View style={styles.modalContainer}>
            {selectedReturnDevice && selectedReturnDevice.device && (
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Return Device</Text>
                  <TouchableOpacity onPress={handleReturnDeviceModalClose}>
                    <Ionicons name="close" size={24} color="#666" />
                  </TouchableOpacity>
                </View>

                <Text style={styles.modalText}>
                  Returning: <Text style={styles.modalTextBold}>{selectedReturnDevice.device.identifier}</Text>
                </Text>
                <Text style={styles.modalText}>
                  Type: <Text style={styles.modalTextBold}>{selectedReturnDevice.device.device_type}</Text>
                </Text>

                <Text style={styles.modalSectionTitle}>Select Return Location:</Text>

                <FlatList
                  data={locations}
                  keyExtractor={(item) => item.id.toString()}
                  style={styles.locationList}
                  renderItem={({ item }) => {
                    const isSelected = selectedReturnLocation?.id === item.id;
                    return (
                      <TouchableOpacity
                        style={[
                          styles.locationListItem,
                          isSelected && styles.locationListItemSelected,
                        ]}
                        onPress={() => setSelectedReturnLocation(item)}
                      >
                        <View style={styles.locationListItemContent}>
                          <Ionicons
                            name="location-outline"
                            size={20}
                            color={isSelected ? ORANGE_COLOR : '#666'}
                          />
                          <Text
                            style={[
                              styles.locationListItemText,
                              isSelected && styles.locationListItemTextSelected,
                            ]}
                          >
                            {item.name || `${item.street_number} ${item.street_name}`}
                          </Text>
                        </View>
                        {isSelected && (
                          <Ionicons name="checkmark" size={22} color={ORANGE_COLOR} />
                        )}
                      </TouchableOpacity>
                    );
                  }}
                  ListEmptyComponent={
                    <Text style={styles.emptyListText}>No locations available</Text>
                  }
                  ItemSeparatorComponent={() => <View style={styles.listSeparator} />}
                />

                <View style={styles.modalButtons}>
                  <Button
                    title="Cancel"
                    onPress={handleReturnDeviceModalClose}
                    variant="outlined"
                    style={styles.cancelButton}
                  />
                  <Button
                    title="Confirm Return"
                    onPress={handleConfirmReturn}
                    style={styles.confirmButton}
                    disabled={!selectedReturnLocation}
                  />
                </View>
              </View>
            )}
          </View>
        </View>
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
    marginBottom: 15,
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
    justifyContent: 'flex-end',
  },
  modalOverlayTouchable: {
    flex: 1,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    maxHeight: '80%',
  },
  modalContent: {
    paddingHorizontal: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalText: {
    fontSize: 16,
    marginBottom: 10,
    marginTop: 12,
    color: '#555',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  modalTextBold: {
    fontWeight: 'bold',
    color: '#333',
  },
  modalSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  locationList: {
    maxHeight: 250,
    marginHorizontal: 20,
  },
  locationListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  locationListItemSelected: {
    backgroundColor: '#FFF5E6',
    marginHorizontal: -4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  locationListItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  locationListItemText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
    flex: 1,
  },
  locationListItemTextSelected: {
    color: ORANGE_COLOR,
    fontWeight: '600',
  },
  emptyListText: {
    textAlign: 'center',
    color: '#999',
    paddingVertical: 20,
    fontSize: 14,
  },
  listSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E5EA',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
    paddingHorizontal: 20,
  },
  confirmButton: {
    flex: 1,
    backgroundColor: ORANGE_COLOR,
    borderColor: ORANGE_COLOR,
  },
  cancelButton: {
    flex: 1,
    borderColor: ORANGE_COLOR,
  },
});

export default AllDevicesScreen;