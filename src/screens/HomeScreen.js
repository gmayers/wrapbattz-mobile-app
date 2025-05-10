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

const HomeScreen = ({ navigation }) => {
  const { logout, deviceService, userData, user, refreshRoleInfo, axiosInstance } = useAuth();
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

  // Define tabs based on user role
  const getTabsForUser = () => {
    const baseTabs = [
      { key: 'dashboard', title: 'Home', icon: <Ionicons name="home-outline" size={24} /> },
      { key: 'reports', title: 'Reports', icon: <Ionicons name="document-text-outline" size={24} /> },
    ];
    
    // Add locations tab only for admin or owner roles
    if (isAdminOrOwner) {
      baseTabs.push({ 
        key: 'locations', 
        title: 'Locations', 
        icon: <Ionicons name="location-outline" size={24} /> 
      });
    }
    
    // Always add logout tab at the end
    baseTabs.push({ 
      key: 'logout', 
      title: 'Logout', 
      icon: <Ionicons name="log-out-outline" size={24} /> 
    });
    
    return baseTabs;
  };

  const tabs = getTabsForUser();

  useEffect(() => {
    // Try to refresh role info from token on component mount
    refreshRoleInfo().then(success => {
      if (success) {
        console.log("[HS-1000] Role info refreshed successfully");
      } else {
        console.log("[HS-1001] Could not refresh role info");
      }
    });
    
    NfcManager.start();
    fetchInitialData();

    return () => {
      NfcManager.cancelTechnologyRequest().catch(() => 0);
    };
  }, []);

  // Transform locations into dropdown format
  useEffect(() => {
    console.log('[HS-2000] Locations changed:', locations.length);
    console.log('[HS-2001] Current selectedReturnLocation:', selectedReturnLocation);
    
    if (locations.length > 0) {
      const options = locations.map(location => ({
        label: location.name,
        value: location.id
      }));
      console.log('[HS-2002] Created location options:', options.length);
      setLocationOptions(options);
      
      // Set a default location if we have options and none is selected yet
      if (options.length > 0 && (!selectedReturnLocation || selectedReturnLocation === '')) {
        console.log('[HS-2003] Setting default location to:', options[0].value);
        setSelectedReturnLocation(options[0].value);
      }
    }
  }, [locations, selectedReturnLocation]);

  // When modal visibility changes
  useEffect(() => {
    console.log('[HS-3000] Return modal visibility changed:', returnDeviceModalVisible);
    console.log('[HS-3001] Locations available:', locations.length);
    console.log('[HS-3002] Location options:', locationOptions.length);
    
    if (returnDeviceModalVisible) {
      console.log('[HS-3003] Modal opened, selected location:', selectedReturnLocation);
      // If modal is becoming visible and we have options but no selection, set default
      if (locationOptions.length > 0 && (!selectedReturnLocation || selectedReturnLocation === '')) {
        console.log('[HS-3004] Setting default location on modal open:', locationOptions[0].value);
        setSelectedReturnLocation(locationOptions[0].value);
      }
    } else {
      // Reset location between openings
      setSelectedReturnLocation('');
      console.log('[HS-3005] Modal closed, resetting loading state');
      setReturnLoading(false);
    }
  }, [returnDeviceModalVisible, locationOptions, selectedReturnLocation]);

  const handleApiError = (error, defaultMessage) => {
    console.log('[HS-4000] API Error:', error);
    console.log('[HS-4001] Response data:', error.response?.data);
    console.log('[HS-4002] Status code:', error.response?.status);
    
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
      console.log(`[HS-5000] Fetching devices for user role: ${userRole}`);
      
      // Use the my_assigned_devices endpoint for all user types
      const myDevices = await deviceService.getMyAssignedDevices();
      console.log(`[HS-5001] Found ${myDevices.length} assigned devices`);
      
      // Transform device data into assignment-like structure for compatibility with DeviceCard
      const formattedAssignments = myDevices.map(device => ({
        id: `device-${device.id}`, // Create unique ID for each item
        device: device, // Set the device object
        user: userId, // Add user ID
        location: null,
        assigned_date: device.created_at ? new Date(device.created_at).toISOString().split('T')[0] : null,
        returned_date: null
      }));
      
      console.log(`[HS-5002] Formatted ${formattedAssignments.length} assignments`);
      setAssignments(formattedAssignments);
    } catch (error) {
      console.log('[HS-5003] Error fetching devices:', error);
      handleApiError(error, 'Failed to fetch devices');
    }
  };

  const fetchLocations = async () => {
    try {
      const data = await deviceService.getLocations();
      console.log('[HS-6000] Fetched locations:', data.length);
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
    console.log('[HS-7000] Opening return modal for device:', assignment.device.identifier);
    setSelectedReturnDevice(assignment.device);
    setReturnDeviceModalVisible(true);
  };

  const handleConfirmReturn = async () => {
    console.log('[HS-8000] handleConfirmReturn called');
    console.log('[HS-8001] Current selectedReturnLocation:', selectedReturnLocation);
    console.log('[HS-8002] locationOptions:', locationOptions.length);
    
    // Final check - if no location is selected but options exist, select the first one
    if ((!selectedReturnLocation || selectedReturnLocation === '') && locationOptions.length > 0) {
      console.log('[HS-8003] Setting default location in handleConfirmReturn:', locationOptions[0].value);
      setSelectedReturnLocation(locationOptions[0].value);
      console.log('[HS-8004] Returning early to wait for state update');
      // Return early to wait for state update before proceeding
      return;
    }
    
    if (!selectedReturnLocation) {
      console.log('[HS-8005] ERROR: No location selected');
      Alert.alert('Error', 'Please select a return location.');
      return;
    }

    if (!selectedReturnDevice) {
      console.log('[HS-8006] ERROR: No device selected');
      Alert.alert('Error', 'No device selected for return');
      return;
    }
    
    // Get the assignment ID from the current_assignment field
    const assignmentId = selectedReturnDevice.current_assignment?.id;
    if (!assignmentId) {
      console.log('[HS-8006b] ERROR: No assignment ID found in device data');
      Alert.alert('Error', 'Device assignment information is missing');
      return;
    }
    
    console.log('[HS-8007] Proceeding with submission, location:', selectedReturnLocation);
    console.log('[HS-8007b] Using assignment ID:', assignmentId, 'instead of device ID:', selectedReturnDevice.id);
    setReturnLoading(true);
    
    try {
      const currentDate = new Date().toISOString();
      console.log('[HS-8008] Current date:', currentDate);
      
      // Update device assignment - now using the correct assignment ID
      console.log('[HS-8009] Updating device assignment:', assignmentId);
      await axiosInstance.patch(
        `/device-assignments/${assignmentId}/`,
        {
          returned_date: currentDate.split('T')[0],
          returned_time: currentDate.split('T')[1].split('.')[0],
        }
      );
      
      // Create return record
      console.log('[HS-8010] Creating device return record');
      await axiosInstance.post(
        '/device-returns/',
        {
          device_id: selectedReturnDevice.id,
          location: selectedReturnLocation,
          returned_date_time: currentDate,
        }
      );
      
      console.log('[HS-8011] Submission successful');
      Alert.alert(
        'Success',
        'Device has been returned successfully',
        [{ text: 'OK', onPress: () => {
          console.log('[HS-8012] Success alert confirmed');
          setReturnDeviceModalVisible(false);
          fetchDevices();
        }}]
      );
    } catch (error) {
      console.log('[HS-8013] Return error:', error);
      let errorMessage = 'Failed to return device. Please try again.';
      
      if (error.response && error.response.data) {
        console.log('[HS-8014] Error response data:', error.response.data);
        if (typeof error.response.data === 'string') {
          errorMessage = error.response.data;
        } else if (error.response.data.detail) {
          errorMessage = error.response.data.detail;
        } else if (error.response.data.message) {
          errorMessage = error.response.data.message;
        }
      }
      
      console.log('[HS-8015] Showing error alert:', errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      console.log('[HS-8016] Resetting loading state');
      setReturnLoading(false);
    }
  };

  const handleReturnDeviceModalClose = () => {
    console.log('[HS-9000] Closing return device modal');
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
                  console.log('[HS-10000] Logout error:', error);
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
    fetchDevices();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header Section */}
      <View style={styles.header}>
        <View style={styles.welcomeContainer}>
          <Text style={styles.welcomeText}>
            Welcome {userName}
          </Text>
        </View>

        {/* Admin/Owner Buttons */}
        {isAdminOrOwner ? (
          <View style={styles.adminButtonContainer}>
            <Button
              title="Manage NFC"
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
        ) : (
          // Regular User Button
          <View style={styles.userButtonContainer}>
            <Button
              title="Request Device"
              onPress={() => setAssignDeviceModalVisible(true)}
              size="small"
              textColor="black"
              style={styles.fullWidthButton}
            />
          </View>
        )}
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
              style={styles.addDeviceButton}
            />
          )}
        </View>
        <View style={styles.section}>
          {loading ? (
            <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
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
                <Text style={styles.viewAllText}>
                  View All ({assignments.length} Devices)
                </Text>
                <Ionicons name="chevron-forward" size={16} color="chocolate" />
              </TouchableOpacity>
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
                          console.log('[HS-11000] Dropdown value changed to:', value);
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
                        onPress={() => {
                          console.log('[HS-12000] Confirm return button pressed');
                          handleConfirmReturn();
                        }}
                        disabled={returnLoading || locationOptions.length === 0}
                        style={styles.confirmButton}
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
                        color="#007AFF" 
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: '5%',
    paddingVertical: '3%',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    marginBottom: '3%',
    flexWrap: 'wrap',
  },
  welcomeContainer: {
    flex: 1,
    marginRight: 10, // Add spacing between text and buttons
    maxWidth: '60%', // Limit text width on larger screens
  },
  welcomeText: {
    fontSize: 24, // Slightly smaller for iOS
    fontWeight: 'bold',
    color: '#333',
    lineHeight: 30,
    flexWrap: 'wrap', // Enable text wrapping
  },
  adminButtonContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap', // Allow buttons to wrap
    justifyContent: 'flex-end',
    marginTop: 8, // Add space when wrapped
    width: '100%', // Full width for wrapping
  },
  // User button container - single button layout
  userButtonContainer: {
    width: '100%', // Full width for single button
    marginTop: 8, // Add space when wrapped
  },
  headerButton: {
    marginLeft: 8,
    paddingHorizontal: 12,
    height: 40,
    minWidth: Platform.OS === 'ios' ? 120 : 'auto', // Smaller min width on iOS
    backgroundColor: 'orange',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullWidthButton: {
    paddingHorizontal: 12,
    height: 40,
    minWidth: Platform.OS === 'ios' ? 160 : 'auto', // Adjust for iOS
    backgroundColor: 'orange',
    justifyContent: 'center',
    alignItems: 'center',
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
    minWidth: Platform.OS === 'ios' ? 140 : 'auto', // Increased minimum width on iOS
    backgroundColor: 'orange',
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
    color: 'chocolate',
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
    paddingLeft: 0, // Remove left padding to allow text to start at the edge
    paddingRight: 30, // Add more space for the dropdown arrow
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
    width: '100%', // Take all available width
    paddingLeft: 15, // Add padding inside the text element instead
  },
  dropdownPlaceholderStyle: {
    fontSize: 16,
    color: '#999999',
    textAlign: 'left',
    paddingLeft: 15, // Match the padding with the label
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
    color: '#007AFF',
    fontWeight: 'bold',
  },
  dropdownArrowStyle: {
    position: 'absolute',
    right: 10,
    top: '50%',
    marginTop: -6,
  },
  
  // Button styles to match the screenshot
  modalButtonContainer: {
    marginTop: 15,
  },
  confirmButton: {
    backgroundColor: 'orange',
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