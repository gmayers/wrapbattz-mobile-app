// LocationDetailsScreen.js
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Button from '../components/Button';
import Card from '../components/Card';
import { useAuth } from '../context/AuthContext';

const LocationDetailsScreen = ({ navigation, route }) => {
  const { locationId } = route.params;
  const { axiosInstance, logout, isAdminOrOwner } = useAuth();
  
  const [location, setLocation] = useState(null);
  const [devices, setDevices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDevicesLoading, setIsDevicesLoading] = useState(true);

  useEffect(() => {
    fetchLocationDetails();
    fetchLocationDevices();
  }, [locationId]);

  useEffect(() => {
    // Set up the header with location name once it's loaded
    if (location) {
      navigation.setOptions({
        title: location.building_name || `${location.street_number} ${location.street_name}`,
        headerBackTitle: 'Locations',
      });
    }
  }, [location, navigation]);

  const fetchLocationDetails = async () => {
    setIsLoading(true);
    try {
      const response = await axiosInstance.get(`/locations/${locationId}/`);
      setLocation(response.data);
    } catch (error) {
      console.error('Error fetching location details:', error);
      if (error.response && error.response.status === 401) {
        Alert.alert('Session Expired', 'Please login again');
        logout();
      } else {
        Alert.alert('Error', 'Failed to fetch location details. Please try again later.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLocationDevices = async () => {
    setIsDevicesLoading(true);
    try {
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
        Alert.alert('Error', 'Failed to fetch location devices. Please try again later.');
      }
      setDevices([]);
    } finally {
      setIsDevicesLoading(false);
    }
  };

  const renderDeviceCard = (device) => (
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
            onPress={() => navigation.navigate('DeviceDetails', { deviceId: device.id })}
          >
            <Ionicons name="eye-outline" size={18} color="#007AFF" />
            <Text style={styles.actionText}>View Device</Text>
          </TouchableOpacity>
          
          {isAdminOrOwner && (
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => navigation.navigate('AssignDevice', { deviceId: device.id })}
            >
              <Ionicons name="swap-horizontal-outline" size={18} color="#007AFF" />
              <Text style={styles.actionText}>Assign</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Card>
  );

  const renderAddressDetails = () => {
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
        </View>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading location details...</Text>
        </View>
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
                onPress={() => navigation.navigate('CreateDevice', { locationId: locationId })}
                size="small"
              />
            )}
          </View>
          
          {isDevicesLoading ? (
            <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
          ) : devices.length > 0 ? (
            <>
              {devices.map(renderDeviceCard)}
            </>
          ) : (
            <Text style={styles.emptyText}>No devices assigned to this location</Text>
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
  actionText: {
    marginLeft: 6,
    color: '#007AFF',
    fontSize: 14,
  },
  loader: {
    marginVertical: 20,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    marginVertical: 20,
  },
});

export default LocationDetailsScreen;