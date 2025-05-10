// LocationsScreen.js
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
  Modal,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Button from '../components/Button';
import Card from '../components/Card';
import TabBar from '../components/TabBar';
import { useAuth } from '../context/AuthContext';

const LocationsScreen = ({ navigation }) => {
  const { axiosInstance, logout, isAdminOrOwner, deviceService, userData } = useAuth();
  const [locations, setLocations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('locations');
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

  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      // Reset active tab when returning
      setActiveTab('locations');
      fetchLocations();
    });
    return unsubscribe;
  }, [navigation]);

  const fetchLocations = async () => {
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
  };

  const handleTabPress = (key) => {
    if (key === activeTab) return;
    setActiveTab(key);
    switch (key) {
      case 'dashboard':
        navigation.navigate('Dashboard');
        break;
      case 'reports':
        navigation.navigate('Reports');
        break;
      case 'logout':
        Alert.alert(
          'Logout',
          'Are you sure you want to logout?',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => setActiveTab('locations') },
            { 
              text: 'Logout', 
              style: 'destructive',
              onPress: () => logout()
            }
          ]
        );
        break;
      default:
        break;
    }
  };

  const tabs = [
    {
      key: 'dashboard',
      title: 'Home',
      icon: <Ionicons name="home-outline" size={24} />,
    },
    {
      key: 'reports',
      title: 'Reports',
      icon: <Ionicons name="document-text-outline" size={24} />,
    },
    {
      key: 'locations',
      title: 'Locations',
      icon: <Ionicons name="location-outline" size={24} />,
    },
    {
      key: 'logout',
      title: 'Logout',
      icon: <Ionicons name="log-out-outline" size={24} />,
    }
  ];

  const handleInputChange = (field, value) => {
    setFormData({
      ...formData,
      [field]: value,
    });
    
    // Clear error for this field when user types
    if (formErrors[field]) {
      setFormErrors({
        ...formErrors,
        [field]: null,
      });
    }
  };

  const validateForm = () => {
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
  };

  const handleCreateLocation = async () => {
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
  };

  const renderLocationCard = (location) => (
    <Card
      key={location.id}
      title={location.building_name || `${location.street_number} ${location.street_name}`}
      style={styles.locationCard}
    >
      <View style={styles.locationContent}>
        <Text style={styles.locationText}>
          {location.street_number} {location.street_name}
        </Text>
        {location.address_2 ? (
          <Text style={styles.locationText}>{location.address_2}</Text>
        ) : null}
        <Text style={styles.locationText}>
          {location.town_or_city}{location.county ? `, ${location.county}` : ''}
        </Text>
        <Text style={styles.locationText}>{location.postcode}</Text>
        
        <View style={styles.locationActions}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigation.navigate('LocationDetails', { locationId: location.id })}
          >
            <Ionicons name="eye-outline" size={18} color="#007AFF" />
            <Text style={styles.actionText}>View Devices</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Card>
  );

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
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.header}>
        {isAdminOrOwner && (
          <Button
            title="Add Location"
            onPress={() => setModalVisible(true)}
            size="small"
          />
        )}
      </View>

      <View style={styles.contentContainer}>
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollViewContent}
        >
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Locations</Text>
            <Text style={styles.sectionSubtitle}>Manage your organization's locations</Text>
            
            {isLoading ? (
              <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
            ) : locations.length > 0 ? (
              <>
                {locations.map(renderLocationCard)}
              </>
            ) : (
              <Text style={styles.emptyText}>No locations found</Text>
            )}
          </View>
        </ScrollView>
      </View>

      {renderCreateLocationModal()}

      <TabBar
        tabs={tabs}
        activeTab={activeTab}
        onTabPress={handleTabPress}
        backgroundColor="#FFFFFF"
        activeColor="#007AFF"
        inactiveColor="#666666"
        showIcons={true}
        showLabels={true}
        height={Platform.OS === 'ios' ? 80 : 60}
        containerStyle={styles.tabBarContainer}
      />
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
  header: {
    padding: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    flexGrow: 1,
  },
  section: {
    padding: 15,
    paddingBottom: Platform.OS === 'ios' ? 100 : 80,
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
    marginBottom: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  locationContent: {
    padding: 15,
  },
  locationText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  locationActions: {
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
});

export default LocationsScreen;