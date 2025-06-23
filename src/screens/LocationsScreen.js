// LocationsScreen.js
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
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Button from '../components/Button';
import Card from '../components/Card';
import { useAuth } from '../context/AuthContext';

const { width } = Dimensions.get('window');

// Define the orange color to be used for buttons
const ORANGE_COLOR = '#FF9500'; // Standard iOS orange

const LocationsScreen = ({ navigation }) => {
  // Enhanced usage of AuthContext
  const { 
    deviceService, 
    logout, 
    isAdminOrOwner, 
    userData,
    user,
    refreshRoleInfo,
    error: authError, 
    clearError 
  } = useAuth();

  const [locations, setLocations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [formData, setFormData] = useState({
    building_name: '',
    street_number: '',
    street_name: '',
    address_2: '',
    town_or_city: '',
    county: '',
    postcode: '',
  });
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Get user's name
  const userName = userData?.name || user?.username || user?.email || 'User';

  // Reset AuthContext errors when component unmounts
  useEffect(() => {
    return () => {
      if (authError) clearError();
    };
  }, [authError, clearError]);

  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
    
    // Only refresh role info once when component mounts
    if (refreshRoleInfo) {
      refreshRoleInfo();
    }
  }, [navigation]);

  const fetchLocations = useCallback(async () => {
    setIsLoading(true);
    try {
      const locationsData = await deviceService.getLocations();
      
      // Adapt to your response format
      let allLocations = Array.isArray(locationsData)
        ? locationsData
        : locationsData.results || [];
      
      setLocations(allLocations);
    } catch (error) {
      console.error('Error fetching locations:', error);
      if (error.response && error.response.status === 401) {
        Alert.alert('Session Expired', 'Please login again');
        logout();
      } else {
        Alert.alert('Error', 'Failed to fetch locations. Please try again later.');
      }
      setLocations([]);
    } finally {
      setIsLoading(false);
    }
  }, [deviceService, logout]);

  // Use useCallback for event handlers to prevent unnecessary re-renders
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchLocations();
    });
    return unsubscribe;
  }, [navigation, fetchLocations]);



  const handleInputChange = useCallback((field, value) => {
    setFormData(prevData => ({
      ...prevData,
      [field]: value,
    }));
    
    // Clear error for this field when user types
    setFormErrors(prevErrors => {
      if (prevErrors[field]) {
        return {
          ...prevErrors,
          [field]: null,
        };
      }
      return prevErrors;
    });
  }, []);

  const validateForm = useCallback(() => {
    const errors = {};
    
    if (!formData.street_name.trim()) {
      errors.street_name = 'Street name is required';
    }
    
    if (!formData.town_or_city.trim()) {
      errors.town_or_city = 'Town/City is required';
    }
    
    if (!formData.postcode.trim()) {
      errors.postcode = 'Postcode is required';
    }
    
    if (!formData.street_number.trim()) {
      errors.street_number = 'Street number is required';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  const handleCreateLocation = useCallback(async () => {
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Add organization ID from user data context
      const completeFormData = { 
        ...formData,
        organization: userData?.orgId // Add organization ID from context
      };
      
      // Use the deviceService to create location
      await deviceService.createLocation(completeFormData);
      
      // Close modal and reset form
      setModalVisible(false);
      setFormData({
        building_name: '',
        street_number: '',
        street_name: '',
        address_2: '',
        town_or_city: '',
        county: '',
        postcode: '',
      });
      
      // Refresh locations list
      fetchLocations();
      
      Alert.alert('Success', 'Location created successfully');
    } catch (error) {
      console.error('Error creating location:', error);
      
      if (error.response?.data?.errors) {
        setFormErrors(error.response.data.errors);
      } else if (error.response?.status === 401) {
        Alert.alert('Session Expired', 'Please login again');
        logout();
      } else {
        Alert.alert(
          'Error', 
          error.response?.data?.message || 'Failed to create location. Please try again.'
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [deviceService, formData, logout, userData, validateForm, fetchLocations]);

  const renderLocationCard = useCallback((location) => (
    <TouchableOpacity 
      key={location.id}
      onPress={() => navigation.navigate('LocationDetails', { locationId: location.id })}
      activeOpacity={0.7}
    >
      <Card style={styles.locationCard}>
        <View style={styles.locationContent}>
          {/* Location Header */}
          <View style={styles.locationHeader}>
            <View style={styles.locationTitleContainer}>
              <Text style={styles.locationTitle}>
                {location.name || location.building_name || `${location.street_number} ${location.street_name}`}
              </Text>
              <View style={styles.locationTypeContainer}>
                <Ionicons name="location" size={14} color={ORANGE_COLOR} />
                <Text style={styles.locationType}>Location</Text>
              </View>
            </View>
            <View style={styles.locationIcon}>
              <Ionicons name="chevron-forward" size={20} color="#CCC" />
            </View>
          </View>
          
          {/* Address Details */}
          <View style={styles.addressContainer}>
            <View style={styles.addressRow}>
              <Ionicons name="home-outline" size={16} color="#666" />
              <Text style={styles.addressText}>
                {location.street_number} {location.street_name}
              </Text>
            </View>
            
            {location.address_2 && (
              <View style={styles.addressRow}>
                <Ionicons name="business-outline" size={16} color="#666" />
                <Text style={styles.addressText}>{location.address_2}</Text>
              </View>
            )}
            
            <View style={styles.addressRow}>
              <Ionicons name="map-outline" size={16} color="#666" />
              <Text style={styles.addressText}>
                {location.town_or_city}{location.county ? `, ${location.county}` : ''} {location.postcode}
              </Text>
            </View>
          </View>
          
          {/* Action Button */}
          <View style={styles.locationActions}>
            <View style={styles.viewDevicesButton}>
              <Ionicons name="cube-outline" size={18} color={ORANGE_COLOR} />
              <Text style={styles.viewDevicesText}>View Available Devices</Text>
            </View>
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  ), [navigation]);

  const renderCreateLocationModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={modalVisible}
      onRequestClose={() => setModalVisible(false)}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalContainer}
      >
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Create New Location</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          
          <ScrollView 
            style={styles.formContainer}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.formGroup}>
              <Text style={styles.label}>Building Name (Optional)</Text>
              <TextInput
                style={styles.input}
                value={formData.building_name}
                onChangeText={(text) => handleInputChange('building_name', text)}
                placeholder="Enter building name"
              />
            </View>
            
            <View style={styles.formRow}>
              <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.label}>Street Number*</Text>
                <TextInput
                  style={[
                    styles.input,
                    formErrors.street_number ? styles.inputError : null,
                  ]}
                  value={formData.street_number}
                  onChangeText={(text) => handleInputChange('street_number', text)}
                  placeholder="Enter street number"
                />
                {formErrors.street_number ? (
                  <Text style={styles.errorText}>{formErrors.street_number}</Text>
                ) : null}
              </View>
              
              <View style={[styles.formGroup, { flex: 2 }]}>
                <Text style={styles.label}>Street Name*</Text>
                <TextInput
                  style={[
                    styles.input,
                    formErrors.street_name ? styles.inputError : null,
                  ]}
                  value={formData.street_name}
                  onChangeText={(text) => handleInputChange('street_name', text)}
                  placeholder="Enter street name"
                />
                {formErrors.street_name ? (
                  <Text style={styles.errorText}>{formErrors.street_name}</Text>
                ) : null}
              </View>
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.label}>Address Line 2 (Optional)</Text>
              <TextInput
                style={styles.input}
                value={formData.address_2}
                onChangeText={(text) => handleInputChange('address_2', text)}
                placeholder="Enter additional address information"
              />
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.label}>Town/City*</Text>
              <TextInput
                style={[
                  styles.input,
                  formErrors.town_or_city ? styles.inputError : null,
                ]}
                value={formData.town_or_city}
                onChangeText={(text) => handleInputChange('town_or_city', text)}
                placeholder="Enter town or city"
              />
              {formErrors.town_or_city ? (
                <Text style={styles.errorText}>{formErrors.town_or_city}</Text>
              ) : null}
            </View>
            
            <View style={styles.formRow}>
              <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.label}>County (Optional)</Text>
                <TextInput
                  style={styles.input}
                  value={formData.county}
                  onChangeText={(text) => handleInputChange('county', text)}
                  placeholder="Enter county"
                />
              </View>
              
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.label}>Postcode*</Text>
                <TextInput
                  style={[
                    styles.input,
                    formErrors.postcode ? styles.inputError : null,
                  ]}
                  value={formData.postcode}
                  onChangeText={(text) => handleInputChange('postcode', text)}
                  placeholder="Enter postcode"
                />
                {formErrors.postcode ? (
                  <Text style={styles.errorText}>{formErrors.postcode}</Text>
                ) : null}
              </View>
            </View>
          </ScrollView>
          
          <View style={styles.modalFooter}>
            <Button
              title="Cancel"
              onPress={() => setModalVisible(false)}
              type="secondary"
              size="medium"
              style={{ marginRight: 10 }}
            />
            <Button
              title={isSubmitting ? "Creating..." : "Create Location"}
              onPress={handleCreateLocation}
              size="medium"
              disabled={isSubmitting}
              textColor="black"
              style={{ backgroundColor: ORANGE_COLOR }}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  // If AuthContext itself has an error state, we could show it here
  if (authError) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Text style={styles.errorMessage}>{authError}</Text>
        <Button
          title="Try Again"
          onPress={() => {
            clearError();
            fetchLocations();
          }}
          size="medium"
          textColor="black"
          style={{ backgroundColor: ORANGE_COLOR }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Updated Header Section */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.welcomeContainer}>
            <Text style={styles.welcomeText}>
              Locations
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

        {/* If userData exists and user has permission, show add button */}
        {isAdminOrOwner && userData && (
          <Button
            title="Add Location"
            onPress={() => setModalVisible(true)}
            size="small"
            textColor="black"
            style={{ backgroundColor: ORANGE_COLOR }}
          />
        )}
      </View>

      <View style={styles.contentContainer}>
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollViewContent}
        >
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Organization Locations</Text>
            <Text style={styles.sectionSubtitle}>
              {userData?.orgId 
                ? `Manage ${userData.name ? userData.name + "'s" : "your"} organization's locations` 
                : "Manage your organization's locations"}
            </Text>
            
            {isLoading ? (
              <ActivityIndicator size="large" color={ORANGE_COLOR} style={styles.loader} />
            ) : locations.length > 0 ? (
              <>
                {locations.map(renderLocationCard)}
              </>
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="location-outline" size={48} color="#CCCCCC" />
                <Text style={styles.emptyText}>No locations found</Text>
                {isAdminOrOwner && (
                  <Button
                    title="Add Your First Location"
                    onPress={() => setModalVisible(true)}
                    size="small"
                    textColor="black"
                    style={[{ marginTop: 15, backgroundColor: ORANGE_COLOR }]}
                  />
                )}
              </View>
            )}
          </View>
        </ScrollView>
      </View>

      {renderCreateLocationModal()}

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  contentContainer: {
    flex: 1,
    position: 'relative',
  },
  // Updated header styling
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
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    padding: '4%',
    paddingBottom: 20,
  },
  section: {
    width: '100%',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#333',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
  },
  locationCard: {
    marginBottom: 15,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  locationContent: {
    padding: 20,
  },
  locationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  locationTitleContainer: {
    flex: 1,
    marginRight: 12,
  },
  locationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 6,
  },
  locationTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  locationType: {
    fontSize: 12,
    color: ORANGE_COLOR,
    fontWeight: '600',
    marginLeft: 4,
  },
  locationIcon: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 24,
    height: 24,
  },
  addressContainer: {
    marginBottom: 16,
    gap: 8,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  addressText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
    lineHeight: 20,
  },
  locationActions: {
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 16,
  },
  viewDevicesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFF7ED',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFE4B5',
  },
  viewDevicesText: {
    marginLeft: 8,
    color: ORANGE_COLOR,
    fontSize: 14,
    fontWeight: '600',
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
  // Modal styles
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 12,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
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
    borderBottomColor: '#EEEEEE',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  formContainer: {
    padding: 15,
    maxHeight: 400,
  },
  formGroup: {
    marginBottom: 16,
  },
  formRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDDDDD',
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    backgroundColor: '#FAFAFA',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 4,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },
  // Auth error container
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
  },
});

export default LocationsScreen;