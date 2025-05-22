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
import Dropdown from '../components/Dropdown';
import { useAuth } from '../context/AuthContext';
import Button from '../components/Button';
import TabBar from '../components/TabBar';
import NfcManager from 'react-native-nfc-manager';
import DeviceCard from './home/components/DeviceCard';
import AssignDeviceModal from './home/components/AssignDevice/AssignDeviceModal';
import NfcManagerModal from './home/components/NFCManager/NFCManagerModal';

const { width } = Dimensions.get('window');

// Define the orange color to match other screens
const ORANGE_COLOR = '#FF9500';

const HomeScreen = ({ navigation }) => {
  const { logout, deviceService, userData, user, refreshRoleInfo } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [locations, setLocations] = useState([]);
  const [locationOptions, setLocationOptions] = useState([]);
  const [selectedReturnLocation, setSelectedReturnLocation] = useState('');
  const [loading, setIsLoading] = useState(true);
  const [assignDeviceModalVisible, setAssignDeviceModalVisible] = useState(false);
  const [nfcManagerModalVisible, setNfcManagerModalVisible] = useState(false);
  const [returnDeviceModalVisible, setReturnDeviceModalVisible] = useState(false);
  const [selectedReturnDevice, setSelectedReturnDevice] = useState(null);
  const [returnLoading, setReturnLoading] = useState(false);
  
  // Get role and user ID directly from userData
  const userRole = userData?.role;
  const userId = userData?.userId;
  const isAdminOrOwner = userRole === 'admin' || userRole === 'owner';
  
  // Get user's name
  const userName = userData?.name || user?.username || user?.email || 'User';

  // Static tabs array
  const tabs = [
    { key: 'dashboard', title: 'Home', icon: <Ionicons name="home-outline" size={24} /> },
    { key: 'reports', title: 'Reports', icon: <Ionicons name="document-text-outline" size={24} /> },
    { key: 'locations', title: 'Locations', icon: <Ionicons name="location-outline" size={24} /> },
    { key: 'profile', title: 'Profile', icon: <Ionicons name="person-outline" size={24} /> },
    { key: 'logout', title: 'Logout', icon: <Ionicons name="log-out-outline" size={24} /> }
  ];

  useEffect(() => {
    // Try to refresh role info from token on component mount
    if (refreshRoleInfo) {
      refreshRoleInfo();
    }
    
    NfcManager.start();
    fetchInitialData();

    return () => {
      NfcManager.cancelTechnologyRequest().catch(() => 0);
    };
  }, []);

  // Transform locations into dropdown format
  useEffect(() => {
    if (locations.length > 0) {
      const options = locations.map(location => ({
        label: location.name,
        value: location.id
      }));
      setLocationOptions(options);
      
      // Set a default location if we have options and none is selected yet
      if (options.length > 0 && (!selectedReturnLocation || selectedReturnLocation === '')) {
        setSelectedReturnLocation(options[0].value);
      }
    }
  }, [locations, selectedReturnLocation]);

  // When modal visibility changes
  useEffect(() => {
    if (returnDeviceModalVisible) {
      // If modal is becoming visible and we have options but no selection, set default
      if (locationOptions.length > 0 && (!selectedReturnLocation || selectedReturnLocation === '')) {
        setSelectedReturnLocation(locationOptions[0].value);
      }
    } else {
      // Reset location between openings
      setSelectedReturnLocation('');
      setReturnLoading(false);
    }
  }, [returnDeviceModalVisible, locationOptions, selectedReturnLocation]);

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
      setIsLoading(true);
      await Promise.all([
        fetchDevices(),
        fetchLocations()
      ]);
    } catch (error) {
      handleApiError(error, 'Failed to fetch initial data');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDevices = async () => {
    try {
      const myAssignments = await deviceService.getMyActiveAssignments();
      
      // Transform the data if necessary to match the expected format
      const formattedAssignments = myAssignments.map(assignment => ({
        id: assignment.id,
        device: assignment.device,
        user: userId,
        location: assignment.location,
        assigned_date: assignment.assigned_date,
        returned_date: assignment.returned_date
      }));
      
      setAssignments(formattedAssignments);
    } catch (error) {
      handleApiError(error, 'Failed to fetch devices');
    }
  };

const handleViewDeviceDetails = (deviceId) => {
  if (deviceId) {
    navigation.navigate('DeviceDetails', { deviceId });
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
      // Use the getLocationAssignments method to get devices by location
      const assignments = await deviceService.getLocationAssignments(locationId);
      
      // Process the assignments to extract available devices
      const availableDevices = assignments
        .filter(assignment => {
          // Filter for available devices or devices assigned to location
          return assignment.device && 
            (assignment.device.status === 'available' || 
             (assignment.location && assignment.location.id === parseInt(locationId) &&
              !assignment.returned_date));
        })
        .map(assignment => assignment.device);
        
      return availableDevices;
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
  };

  const handleConfirmReturn = async () => {
    // Final check - if no location is selected but options exist, select the first one
    if ((!selectedReturnLocation || selectedReturnLocation === '') && locationOptions.length > 0) {
      setSelectedReturnLocation(locationOptions[0].value);
      // Return early to wait for state update before proceeding
      return;
    }
    
    if (!selectedReturnLocation) {
      Alert.alert('Error', 'Please select a return location.');
      return;
    }

    if (!selectedReturnDevice) {
      Alert.alert('Error', 'No device selected for return');
      return;
    }
    
    // Get the assignment ID from the current_assignment field
    const assignmentId = selectedReturnDevice.current_assignment?.id;
    if (!assignmentId) {
      Alert.alert('Error', 'Device assignment information is missing');
      return;
    }
    
    setReturnLoading(true);
    
    try {
      // Using the updated returnDeviceToLocation method from deviceService
      await deviceService.returnDeviceToLocation(assignmentId, {
        location: selectedReturnLocation
      });
      
      Alert.alert(
        'Success',
        'Device has been returned successfully',
        [{ text: 'OK', onPress: () => {
          setReturnDeviceModalVisible(false);
          fetchDevices();
        }}]
      );
    } catch (error) {
      let errorMessage = 'Failed to return device. Please try again.';
      
      if (error.response && error.response.data) {
        if (typeof error.response.data === 'string') {
          errorMessage = error.response.data;
        } else if (error.response.data.detail) {
          errorMessage = error.response.data.detail;
        } else if (error.response.data.message) {
          errorMessage = error.response.data.message;
        }
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setReturnLoading(false);
    }
  };

  const handleReturnDeviceModalClose = () => {
    setReturnDeviceModalVisible(false);
    setSelectedReturnLocation('');
  };

  const handleTabPress = (key) => {
    switch (key) {
      case 'dashboard':
        break;
      case 'reports':
        navigation.navigate('Reports');
        break;
      case 'locations':
        navigation.navigate('Locations');
        break;
      case 'profile':
        navigation.navigate('Profile');
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
  <TouchableOpacity 
    key={assignment.id} 
    activeOpacity={0.7} 
    onPress={() => handleViewDeviceDetails(assignment.device?.id)}
    style={styles.deviceCardWrapper}
  >
    <DeviceCard
      assignment={assignment}
      onReturn={handleDeviceReturn}
      isClickable={true}
    />
  </TouchableOpacity>
);
  const handleAssignComplete = () => {
    setAssignDeviceModalVisible(false);
    fetchDevices();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header Section */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.welcomeContainer}>
            <Text style={styles.welcomeText}>
              Welcome {userName}
            </Text>
          </View>
          
          {/* Profile Button in Header */}
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => navigation.navigate('Profile')}
          >
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>
                {userName.charAt(0).toUpperCase()}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Admin/Owner Buttons - Device Fees button removed */}
        <View style={styles.buttonsContainer}>
          {isAdminOrOwner ? (
            <View style={styles.adminButtonContainer}>
              <Button
                title="Manage NFC"
                onPress={() => setNfcManagerModalVisible(true)}
                size="small"
                textColor="black"
                style={[styles.headerButton, { backgroundColor: ORANGE_COLOR }]}
              />
              <Button
                title="Assign Device"
                onPress={() => setAssignDeviceModalVisible(true)}
                size="small"
                textColor="black"
                style={[styles.headerButton, { backgroundColor: ORANGE_COLOR }]}
              />
            </View>
          ) : (
            // Regular User Button - Device Fees button removed
            <View style={styles.userButtonContainer}>
              <Button
                title="Request Device"
                onPress={() => setAssignDeviceModalVisible(true)}
                size="small"
                textColor="black"
                style={[styles.fullWidthButton, { backgroundColor: ORANGE_COLOR }]}
              />
            </View>
          )}
        </View>
      </View>

      {/* Device Assignments Section */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Your Assigned Devices
          </Text>
          {isAdminOrOwner && (
            <Button
              title="Add Device"
              onPress={() => navigation.navigate('AddDevice')}
              size="small"
              textColor="black"
              style={[styles.addDeviceButton, { backgroundColor: ORANGE_COLOR }]}
            />
          )}
        </View>
        <View style={styles.section}>
          {loading ? (
            <ActivityIndicator size="large" color={ORANGE_COLOR} style={styles.loader} />
          ) : (
            <View style={styles.devicesContainer}>
              {assignments.length === 0 ? (
                <Text style={styles.emptyText}>
                  You have no devices assigned
                </Text>
              ) : (
                <View style={styles.devicesGrid}>
                  {/* Always show up to 5 device cards in the main view */}
                  {assignments.slice(0, 5).map((assignment) => renderDeviceCard(assignment))}
                </View>
              )}
              
              {/* Always show View All button, now outside the conditional rendering */}
              <TouchableOpacity
                style={styles.viewAllButton}
                onPress={() => navigation?.navigate('AllDevices', { assignments })}
                activeOpacity={0.7}
              >
                <Text style={[styles.viewAllText, { color: ORANGE_COLOR }]}>
                  View All ({assignments.length} Devices)
                </Text>
                <Ionicons name="chevron-forward" size={16} color={ORANGE_COLOR} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom Tab Bar */}
      <TabBar
        tabs={tabs.filter(tab => tab.key !== 'locations' || isAdminOrOwner)}
        activeTab="dashboard"
        onTabPress={handleTabPress}
        backgroundColor="#FFFFFF"
        activeColor={ORANGE_COLOR}
        inactiveColor="#666666"
        showIcons
        showLabels
        height={Platform.OS === 'ios' ? 80 : 60}
        containerStyle={styles.tabBarContainer}
        labelStyle={styles.tabBarLabel}
        iconStyle={styles.tabBarIcon}
      />

      {/* Return Device Modal - Modified with new logic */}
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
                    
                    <View style={styles.modalScrollContent}>
                      <Text style={styles.modalText}>
                        Returning: <Text style={styles.modalTextBold}>{selectedReturnDevice.identifier}</Text>
                      </Text>
                      <Text style={styles.modalText}>
                        Type: <Text style={styles.modalTextBold}>{selectedReturnDevice.device_type}</Text>
                      </Text>

                      {/* Location Dropdown with fixed styles for truncation issue */}
                      <Text style={styles.modalLabel}>Select Location:</Text>
                      <Dropdown
                        value={selectedReturnLocation}
                        onValueChange={(value) => {
                          setSelectedReturnLocation(value);
                        }}
                        items={locationOptions}
                        placeholder="Select a location"
                        disabled={returnLoading}
                        testID="return-location-dropdown"
                        containerStyle={styles.dropdownContainer}
                        style={styles.dropdownStyle}
                        itemStyle={styles.dropdownItemStyle}
                        labelStyle={styles.dropdownLabelStyle}
                        placeholderStyle={styles.dropdownPlaceholderStyle}
                        activeItemStyle={styles.dropdownActiveItemStyle}
                        activeLabelStyle={styles.dropdownActiveLabelStyle}
                        arrowStyle={styles.dropdownArrowStyle}
                        arrowColor="#333"
                      />
                    </View>

                    <View style={styles.modalButtonContainer}>
                      <Button
                        title={returnLoading ? "Returning..." : "Confirm Return"}
                        onPress={handleConfirmReturn}
                        disabled={returnLoading || locationOptions.length === 0}
                        style={[styles.confirmButton, { backgroundColor: ORANGE_COLOR }]}
                        textColor="black"
                      />
                      <Button
                        title="Cancel"
                        onPress={handleReturnDeviceModalClose}
                        variant="outlined"
                        disabled={returnLoading}
                        style={styles.cancelButton}
                        textColor="#007AFF"
                      />
                    </View>
                    
                    {returnLoading && (
                      <ActivityIndicator 
                        size="large" 
                        color={ORANGE_COLOR}
                        style={styles.loader}
                      />
                    )}
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
    paddingHorizontal: '5%',
    paddingVertical: '3%',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    marginBottom: '3%',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  welcomeContainer: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    lineHeight: 30,
  },
  profileButton: {
    marginLeft: 10,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: ORANGE_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  buttonsContainer: {
    marginTop: 10,
    marginBottom: 5,
  },
  adminButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around', // Changed from space-between to space-around for better spacing
    paddingHorizontal: 10, // Added padding to give more breathing room
  },
  userButtonContainer: {
    width: '100%',
    paddingVertical: 5, // Added vertical padding
    alignItems: 'center', // Center content horizontally
  },
  headerButton: {
    marginBottom: 8,
    marginHorizontal: 10, // Added horizontal margin for spacing between buttons
    paddingHorizontal: 15, // Increased horizontal padding
    height: 45, // Slightly increased height
    minWidth: width > 375 ? (width / 2) - 60 : 'auto', // More space between buttons
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8, // Added explicit border radius
  },
  fullWidthButton: {
    paddingHorizontal: 15,
    height: 45, // Increased height to match headerButton
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8, // Added explicit border radius
    maxWidth: '80%', // Limit width for better aesthetics on wider screens
    alignSelf: 'center', // Center the button
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
    height: 40,
    minWidth: Platform.OS === 'ios' ? 140 : 'auto',
    justifyContent: 'center',
    alignItems: 'center',
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
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginTop: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    height: 48,
    width: '100%',
  },
  viewAllText: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  
  // Return Modal styles
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
    maxHeight: '80%',
  },
  modalContent: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  modalScrollContent: {
    flex: 1,
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  modalText: {
    fontSize: 16,
    marginBottom: 10,
    color: '#555',
  },
  modalLabel: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  modalTextBold: {
    fontWeight: 'bold',
    color: '#333',
  },
  
  // Fixed dropdown styles to prevent text truncation
  dropdownContainer: {
    width: '100%',
    marginBottom: 15,
    minHeight: 50,
    zIndex: 1000,
  },
  dropdownStyle: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cccccc',
    minHeight: 50,
    paddingLeft: 0,
    paddingRight: 30,
    paddingVertical: 12,
    justifyContent: 'space-between',
    flexDirection: 'row',
    alignItems: 'center',
  },
  dropdownLabelStyle: {
    fontSize: 16,
    color: '#333333',
    textAlign: 'left',
    flexShrink: 1,
    width: '100%',
    paddingLeft: 15,
  },
  dropdownPlaceholderStyle: {
    fontSize: 16,
    color: '#999999',
    textAlign: 'left',
    paddingLeft: 15,
  },
  dropdownItemStyle: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownActiveItemStyle: {
    backgroundColor: '#f0f8ff',
  },
  dropdownActiveLabelStyle: {
    color: ORANGE_COLOR,
    fontWeight: 'bold',
  },
  dropdownArrowStyle: {
    position: 'absolute',
    right: 10,
    top: '50%',
    marginTop: -6,
  },
  
  // Button styles
  modalButtonContainer: {
    marginTop: 15,
  },
  confirmButton: {
    marginBottom: 10,
    width: '100%',
    borderRadius: 8,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#E0E0E0',
    width: '100%',
    borderRadius: 8,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0,
  },
  loader: {
    marginTop: 10,
  },
  
  // Tab Bar styles
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
  
  // Other utility styles
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