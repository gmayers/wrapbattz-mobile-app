// src/screens/HomeScreen/HomeScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  StatusBar,
  Platform,
  Alert,
} from 'react-native';
import NfcManager from 'react-native-nfc-manager';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import AssignDeviceModal from '../home/components/AssignDevice/AssignDeviceModal';
import NfcManagerModal from '../home/components/NFCManager/NFCManagerModal';

// Import modular components
import Header from './components/Header';
import DevicesList from './components/DevicesList';
import ReturnDeviceModal from './components/ReturnDeviceModal';

// Import custom hooks
import { useDevices } from './hooks/useDevices';
import { useLocations } from './hooks/useLocations';

const ORANGE_COLOR = '#FF9500';

interface HomeScreenProps {
  navigation: any;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const { logout, userData, user, refreshRoleInfo } = useAuth();
  
  // Modal states
  const [assignDeviceModalVisible, setAssignDeviceModalVisible] = useState(false);
  const [nfcManagerModalVisible, setNfcManagerModalVisible] = useState(false);
  const [returnDeviceModalVisible, setReturnDeviceModalVisible] = useState(false);
  const [selectedReturnDevice, setSelectedReturnDevice] = useState(null);
  const [returnLoading, setReturnLoading] = useState(false);
  
  // Custom hooks for data management
  const {
    assignments,
    loading: devicesLoading,
    fetchDevices,
    handleDeviceReturn,
    fetchDevicesByLocation,
  } = useDevices();
  
  const {
    locations,
    locationOptions,
    selectedReturnLocation,
    setSelectedReturnLocation,
    fetchLocations,
    resetSelection,
  } = useLocations();
  
  // User data
  const userRole = userData?.role;
  const isAdminOrOwner = userRole === 'admin' || userRole === 'owner';
  const userName = userData?.name || user?.username || user?.email || 'User';


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

  // Reset return location when modal visibility changes
  useEffect(() => {
    if (returnDeviceModalVisible) {
      // If modal is becoming visible and we have options but no selection, set default
      if (locationOptions.length > 0 && (!selectedReturnLocation || selectedReturnLocation === '')) {
        setSelectedReturnLocation(locationOptions[0].value);
      }
    } else {
      // Reset location between openings
      resetSelection();
      setReturnLoading(false);
    }
  }, [returnDeviceModalVisible, locationOptions, selectedReturnLocation, setSelectedReturnLocation, resetSelection]);

  const fetchInitialData = async () => {
    try {
      await Promise.all([
        fetchDevices(),
        fetchLocations()
      ]);
    } catch (error) {
      console.error('Failed to fetch initial data:', error);
    }
  };

  // Header event handlers
  const handleProfilePress = () => {
    navigation.navigate('Profile');
  };

  const handleManageNFCPress = () => {
    setNfcManagerModalVisible(true);
  };

  const handleAssignDevicePress = () => {
    setAssignDeviceModalVisible(true);
  };

  // DevicesList event handlers
  const handleViewDeviceDetails = (deviceId: string) => {
    if (deviceId) {
      navigation.navigate('DeviceDetails', { 
        deviceId,
        sourceScreen: 'Home'
      });
    }
  };

  const handleDeviceReturnModal = (assignment: any) => {
    if (!assignment?.device) {
      Alert.alert('Error', 'Invalid device data');
      return;
    }
    setSelectedReturnDevice(assignment.device);
    setReturnDeviceModalVisible(true);
  };

  const handleViewAllDevices = () => {
    navigation?.navigate('AllDevices', { assignments });
  };

  const handleAddDevice = () => {
    navigation.navigate('AddDevice');
  };

  // ReturnDeviceModal event handlers
  const handleConfirmReturn = async () => {
    // Final check - if no location is selected but options exist, select the first one
    if ((!selectedReturnLocation || selectedReturnLocation === '') && locationOptions.length > 0) {
      setSelectedReturnLocation(locationOptions[0].value);
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
      await handleDeviceReturn(assignmentId, selectedReturnLocation);
      setReturnDeviceModalVisible(false);
    } catch (error) {
      // Error is already handled in the hook
    } finally {
      setReturnLoading(false);
    }
  };

  const handleReturnModalClose = () => {
    setReturnDeviceModalVisible(false);
    setSelectedReturnDevice(null);
  };


  const handleAssignComplete = () => {
    setAssignDeviceModalVisible(false);
    fetchDevices();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header Section */}
      <Header
        userName={userName}
        isAdminOrOwner={isAdminOrOwner}
        onProfilePress={handleProfilePress}
        onManageNFCPress={handleManageNFCPress}
        onAssignDevicePress={handleAssignDevicePress}
      />

      {/* Device Assignments Section */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <DevicesList
          assignments={assignments}
          loading={devicesLoading}
          isAdminOrOwner={isAdminOrOwner}
          onDevicePress={handleViewDeviceDetails}
          onDeviceReturn={handleDeviceReturnModal}
          onViewAllPress={handleViewAllDevices}
          onAddDevicePress={handleAddDevice}
        />
      </ScrollView>


      {/* Return Device Modal */}
      <ReturnDeviceModal
        visible={returnDeviceModalVisible}
        selectedDevice={selectedReturnDevice}
        locationOptions={locationOptions}
        selectedLocation={selectedReturnLocation}
        loading={returnLoading}
        onLocationChange={setSelectedReturnLocation}
        onConfirmReturn={handleConfirmReturn}
        onClose={handleReturnModalClose}
      />

      {/* Assign Device Modal */}
      <AssignDeviceModal
        visible={assignDeviceModalVisible}
        onClose={() => setAssignDeviceModalVisible(false)}
        locations={locations}
        fetchDevicesByLocation={fetchDevicesByLocation}
        onAssignComplete={handleAssignComplete}
        handleApiError={(error: any, message: string) => {
          Alert.alert('Error', message);
        }}
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
    paddingBottom: 20,
  },
});

export default HomeScreen;