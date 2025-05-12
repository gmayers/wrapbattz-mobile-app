// LocationDetailsScreen.js
import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Button from '../components/Button';
import Card from '../components/Card';
import { useAuth } from '../context/AuthContext';

// Define the orange color to be used for buttons to match LocationsScreen
const ORANGE_COLOR = '#FF9500'; // Standard iOS orange

const LocationDetailsScreen = ({ navigation, route }) => {
  const { locationId } = route.params;
  
  // Enhanced usage of AuthContext
  const { 
    deviceService, 
    axiosInstance,
    logout, 
    isAdminOrOwner, 
    userData,
    error: authError,
    clearError,
    isLoading: authLoading
  } = useAuth();
  
  const [location, setLocation] = useState(null);
  const [devices, setDevices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDevicesLoading, setIsDevicesLoading] = useState(true);
  const [error, setError] = useState(null);

  // Clear AuthContext errors when component unmounts
  useEffect(() => {
    return () => {
      if (authError) clearError();
    };
  }, [authError, clearError]);

  // Fetch location details using direct API call
  const fetchLocationDetails = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Use direct axios call for consistency with original implementation
      const response = await axiosInstance.get(`/locations/${locationId}/`);
      const locationData = response.data;
      
      setLocation(locationData);
    } catch (error) {
      console.error('Error fetching location details:', error);
      
      if (error.response && error.response.status === 401) {
        Alert.alert('Session Expired', 'Please login again');
        logout();
      } else {
        const errorMsg = error.response?.data?.message || 'Failed to fetch location details. Please try again later.';
        setError(errorMsg);
        Alert.alert('Error', errorMsg);
      }
    } finally {
      setIsLoading(false);
    }
  }, [locationId, axiosInstance, logout]);

  // Fetch devices at this location using direct API call
  const fetchLocationDevices = useCallback(async () => {
    setIsDevicesLoading(true);
    
    try {
      // Use direct axios call for consistency with original implementation
      const response = await axiosInstance.get(`/devices/?location=${locationId}`);
      
      // Adapt to your response format
      let locationDevices = Array.isArray(response.data)
        ? response.data
        : response.data.results || [];
      
      setDevices(locationDevices);
    } catch (error) {
      console.error('Error fetching location devices:', error);
      
      if (error.response && error.response.status === 401) {
        Alert.alert('Session Expired', 'Please login again');
        logout();
      } else {
        const errorMsg = error.response?.data?.message || 'Failed to fetch location devices. Please try again later.';
        setError(errorMsg);
        Alert.alert('Error', errorMsg);
      }
      
      setDevices([]);
    } finally {
      setIsDevicesLoading(false);
    }
  }, [locationId, axiosInstance, logout]);

  // Execute fetch operations on component mount and when locationId changes
  useEffect(() => {
    fetchLocationDetails();
    fetchLocationDevices();
  }, [locationId, fetchLocationDetails, fetchLocationDevices]);

  // Set up the header with location name once it's loaded
  useEffect(() => {
    if (location) {
      navigation.setOptions({
        title: location.building_name || `${location.street_number} ${location.street_name}`,
        headerBackTitle: 'Locations',
      });
    }
  }, [location, navigation]);

  // Navigate to device details
  const handleViewDevice = useCallback((deviceId) => {
    navigation.navigate('DeviceDetails', { deviceId });
  }, [navigation]);

  // Navigate to assign device
  const handleAssignDevice = useCallback((deviceId) => {
    navigation.navigate('AssignDevice', { deviceId });
  }, [navigation]);

  // Navigate to create device
  const handleAddDevice = useCallback(() => {
    navigation.navigate('CreateDevice', { locationId });
  }, [navigation, locationId]);

  // Handle try again
  const handleTryAgain = useCallback(() => {
    setError(null);
    fetchLocationDetails();
    fetchLocationDevices();
  }, [fetchLocationDetails, fetchLocationDevices]);

  const renderDeviceCard = useCallback((device) => (
    <Card
      key={device.id}
      title={`${device.device_type}: ${device.identifier}`}
      style={styles.deviceCard}
    >
      <View style={styles.deviceContent}>
        <Text style={styles.deviceText}>Make: {device.make || 'N/A'}</Text>
        <Text style={styles.deviceText}>Model: {device.model || 'N/A'}</Text>
        <Text style={styles.deviceText}>Status: {device.status || 'Unknown'}</Text>
        {device.serial_number && (
          <Text style={styles.deviceText}>Serial: {device.serial_number}</Text>
        )}
        {device.description && (
          <Text style={styles.deviceText}>Description: {device.description}</Text>
        )}
        
        <View style={styles.deviceActions}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleViewDevice(device.id)}
          >
            {/* Changed color to orange to match LocationsScreen */}
            <Ionicons name="eye-outline" size={18} color={ORANGE_COLOR} />
            <Text style={styles.actionText}>View Device</Text>
          </TouchableOpacity>
          
          {isAdminOrOwner && (
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => handleAssignDevice(device.id)}
            >
              {/* Changed color to orange to match LocationsScreen */}
              <Ionicons name="swap-horizontal-outline" size={18} color={ORANGE_COLOR} />
              <Text style={styles.actionText}>Assign</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Card>
  ), [handleViewDevice, handleAssignDevice, isAdminOrOwner]);

  const renderAddressDetails = useCallback(() => {
    if (!location) return null;
    
    return (
      <Card title="Location Details" style={styles.addressCard}>
        <View style={styles.addressContent}>
          {location.building_name && (
            <Text style={styles.addressText}>{location.building_name}</Text>
          )}
          <Text style={styles.addressText}>
            {location.street_number} {location.street_name}
          </Text>
          {location.address_2 && (
            <Text style={styles.addressText}>{location.address_2}</Text>
          )}
          <Text style={styles.addressText}>
            {location.town_or_city}{location.county ? `, ${location.county}` : ''}
          </Text>
          <Text style={styles.addressText}>{location.postcode}</Text>
          
          {userData?.name && (
            <View style={styles.organizationInfo}>
              <Text style={styles.organizationText}>
                Organization: {userData.name}'s Organization
              </Text>
            </View>
          )}
        </View>
      </Card>
    );
  }, [location, userData]);

  // Check for auth errors
  if (authError) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Text style={styles.errorMessage}>{authError}</Text>
        <Button
          title="Try Again"
          onPress={() => {
            clearError();
            handleTryAgain();
          }}
          size="medium"
        />
      </SafeAreaView>
    );
  }

  // Show loading state
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={ORANGE_COLOR} />
          <Text style={styles.loadingText}>Loading location details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Show error state if location fetch failed
  if (error && !location) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
        <Text style={styles.errorMessage}>{error}</Text>
        <Button
          title="Try Again"
          onPress={handleTryAgain}
          size="medium"
          style={{ marginTop: 15 }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
      >
        {renderAddressDetails()}
        
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Devices at this Location</Text>
            {isAdminOrOwner && (
              <Button
                title="Add Device"
                onPress={handleAddDevice}
                size="small"
              />
            )}
          </View>
          
          {isDevicesLoading ? (
            <ActivityIndicator size="large" color={ORANGE_COLOR} style={styles.loader} />
          ) : devices.length > 0 ? (
            <>
              {devices.map(renderDeviceCard)}
            </>
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="cube-outline" size={48} color="#CCCCCC" />
              <Text style={styles.emptyText}>No devices assigned to this location</Text>
              {isAdminOrOwner && (
                <Button
                  title="Add First Device"
                  onPress={handleAddDevice}
                  size="small"
                  style={{ marginTop: 15 }}
                />
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    padding: 15,
  },
  section: {
    marginTop: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  addressCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  addressContent: {
    padding: 15,
  },
  addressText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
  },
  organizationInfo: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },
  organizationText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  deviceCard: {
    marginBottom: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  deviceContent: {
    padding: 15,
  },
  deviceText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  deviceActions: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    marginRight: 16,
  },
  // Changed color to orange to match LocationsScreen
  actionText: {
    marginLeft: 6,
    color: ORANGE_COLOR, // Changed from #007AFF to orange
    fontSize: 14,
  },
  loader: {
    marginVertical: 20,
  },
  // Enhanced empty state
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    marginTop: 10,
  },
  // Auth and general error container
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F5F5F5',
  },
  errorMessage: {
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 20,
    marginTop: 10,
  },
});

export default LocationDetailsScreen;