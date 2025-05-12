// CreateLocationScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  StatusBar,
  Alert,
  Platform,
  KeyboardAvoidingView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Button from '../components/Button';
import { useAuth } from '../context/AuthContext';

// Define the orange color to match other screens
const ORANGE_COLOR = '#FF9500';

const CreateLocationScreen = ({ navigation, route }) => {
  // Use AuthContext
  const { 
    deviceService, 
    axiosInstance, 
    userData, 
    logout, 
    error: authError, 
    clearError, 
    isLoading: authLoading 
  } = useAuth();

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
  const [error, setError] = useState(null);

  // Clear auth errors when component unmounts
  useEffect(() => {
    return () => {
      if (authError) clearError();
    };
  }, [authError, clearError]);

  // Set up navigation options
  useEffect(() => {
    navigation.setOptions({
      title: 'Create Location',
      headerBackTitle: 'Back',
    });
  }, [navigation]);

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
    setError(null);
    
    try {
      // Add organization ID from user data context
      const completeFormData = { 
        ...formData,
        organization: userData?.orgId
      };
      
      // Use deviceService if available, otherwise use axiosInstance
      if (deviceService && typeof deviceService.createLocation === 'function') {
        await deviceService.createLocation(completeFormData);
      } else {
        await axiosInstance.post('/locations/', completeFormData);
      }
      
      Alert.alert(
        'Success', 
        'Location created successfully',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error('Error creating location:', error);
      
      if (error.response?.data?.errors) {
        setFormErrors(error.response.data.errors);
      } else if (error.response?.status === 401) {
        Alert.alert('Session Expired', 'Please login again');
        logout();
      } else {
        const errorMsg = error.response?.data?.message || 'Failed to create location. Please try again.';
        setError(errorMsg);
        Alert.alert('Error', errorMsg);
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [deviceService, axiosInstance, formData, userData, validateForm, navigation, logout]);

  // Render error banner
  const renderErrorBanner = () => {
    if (!error) return null;
    
    return (
      <View style={styles.errorBanner}>
        <Text style={styles.errorBannerText}>{error}</Text>
        <TouchableOpacity onPress={() => setError(null)}>
          <Ionicons name="close-circle" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    );
  };

  // If AuthContext has an error, show error screen
  if (authError) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Text style={styles.errorMessage}>{authError}</Text>
        <Button
          title="Try Again"
          onPress={clearError}
          size="medium"
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollViewContent}
          keyboardShouldPersistTaps="handled"
        >
          {renderErrorBanner()}
          
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Create New Location</Text>
            <Text style={styles.headerSubtitle}>
              Please fill in the details of the new location
            </Text>
          </View>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>Building Name (Optional)</Text>
            <TextInput
              style={styles.input}
              value={formData.building_name}
              onChangeText={(text) => handleInputChange('building_name', text)}
              placeholder="Enter building name"
              placeholderTextColor="#999"
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
                placeholder="Enter number"
                placeholderTextColor="#999"
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
                placeholderTextColor="#999"
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
              placeholderTextColor="#999"
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
              placeholderTextColor="#999"
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
                placeholderTextColor="#999"
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
                placeholderTextColor="#999"
              />
              {formErrors.postcode ? (
                <Text style={styles.errorText}>{formErrors.postcode}</Text>
              ) : null}
            </View>
          </View>
          
          <View style={styles.formGroup}>
            {userData?.orgId ? (
              <Text style={styles.organizationText}>
                This location will be associated with {userData.name ? userData.name + "'s" : "your"} organization.
              </Text>
            ) : (
              <Text style={styles.warningText}>
                No organization ID found. This location may not be correctly assigned.
              </Text>
            )}
          </View>
          
          <View style={styles.buttonContainer}>
            <Button
              title="Cancel"
              onPress={() => navigation.goBack()}
              type="secondary"
              size="medium"
              style={{ marginRight: 10 }}
            />
            <Button
              title={isSubmitting ? "Creating..." : "Create Location"}
              onPress={handleCreateLocation}
              size="medium"
              disabled={isSubmitting || authLoading}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666',
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
    padding: 12,
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
  errorBanner: {
    backgroundColor: '#EF4444',
    padding: 10,
    borderRadius: 8,
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorBannerText: {
    color: '#FFFFFF',
    fontSize: 14,
    flex: 1,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 30,
  },
  organizationText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  warningText: {
    fontSize: 14,
    color: '#F59E0B',
    fontStyle: 'italic',
  },
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

export default CreateLocationScreen;