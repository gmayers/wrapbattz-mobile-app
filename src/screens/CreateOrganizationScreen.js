// screens/OnboardingScreens/CreateOrganizationScreen.js
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert
} from 'react-native';
import { useAuth } from '../context/AuthContext'; 
import { Ionicons } from '@expo/vector-icons';

const CreateOrganizationScreen = ({ navigation }) => {
  const { createOrganization, isLoading, updateOnboardingStatus } = useAuth();
  
  // Form state
  const [name, setName] = useState('');
  const [tradingName, setTradingName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [county, setCounty] = useState('');
  const [postcode, setPostcode] = useState('');
  
  // Validation state
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  
  // Form validation
  const validateForm = () => {
    let isValid = true;
    let formErrors = {};
    
    // Validate required fields
    if (!name.trim()) {
      formErrors.name = 'Organization name is required';
      isValid = false;
    }
    
    if (!addressLine1.trim()) {
      formErrors.addressLine1 = 'Address line 1 is required';
      isValid = false;
    }
    
    if (!city.trim()) {
      formErrors.city = 'City/Town is required';
      isValid = false;
    }
    
    if (!postcode.trim()) {
      formErrors.postcode = 'Postcode is required';
      isValid = false;
    } else {
      // Simple UK postcode validation
      const postcodeRegex = /^[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}$/i;
      if (!postcodeRegex.test(postcode)) {
        formErrors.postcode = 'Please enter a valid UK postcode';
        isValid = false;
      }
    }
    
    // Email validation if provided
    if (email && !/\S+@\S+\.\S+/.test(email)) {
      formErrors.email = 'Please enter a valid email address';
      isValid = false;
    }
    
    // Phone validation if provided - More flexible phone validation
    if (phone && phone.trim() && !/^[\d\+\-\(\) ]{10,15}$/.test(phone.replace(/\s/g, ''))) {
      formErrors.phone = 'Please enter a valid phone number';
      isValid = false;
    }
    
    // Website validation if provided - More flexible
    if (website && website.trim() && !(/^https?:\/\/.+/.test(website))) {
      formErrors.website = 'Website must start with http:// or https://';
      isValid = false;
    }
    
    setErrors(formErrors);
    return isValid;
  };
  
  // Handle form submission
  const handleSubmit = async () => {
    console.log('=== CREATE ORGANIZATION SUBMIT ===');
    console.log('Starting form submission...');
    
    if (!validateForm()) {
      console.log('Form validation failed');
      return;
    }
    
    setSubmitting(true);
    
    try {
      const organizationData = {
        name: name.trim(),
        trading_name: tradingName.trim() || '', // Optional field
        email: email.trim() || '', // Optional field
        phone: phone.trim() || '', // Optional field
        website: website.trim() || '', // Optional field
        registered_address_line1: addressLine1.trim(),
        registered_address_line2: addressLine2.trim() || '', // Optional field
        registered_city: city.trim(),
        registered_county: county.trim() || '', // Optional field
        registered_postcode: postcode.trim(),
        // Trading address defaults to registered address for simplicity
        trading_address_line1: addressLine1.trim(),
        trading_address_line2: addressLine2.trim() || '',
        trading_city: city.trim(),
        trading_county: county.trim() || '',
        trading_postcode: postcode.trim()
      };
      
      console.log('Organization data:', organizationData);
      
      // Call the API to create the organization
      const result = await createOrganization(organizationData);
      console.log('Organization creation result:', result);
      
      // The createOrganization function in AuthContext should already call updateOnboardingStatus
      // But let's ensure it's called
      await updateOnboardingStatus(true);
      console.log('Onboarding status updated');
      
      // Success message and navigation
      Alert.alert(
        "Success",
        "Your organization has been created successfully!",
        [{ 
          text: "Continue", 
          onPress: () => {
            console.log('Navigating to Dashboard...');
            // Navigate to Dashboard which should now show the main app
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.replace('Dashboard');
            }
          }
        }]
      );
      
    } catch (error) {
      console.error('Error creating organization:', error);
      
      // Format error message
      let errorMessage = 'Failed to create organization. Please try again.';
      
      // Check if error has a response
      if (error.response) {
        const responseData = error.response.data;
        console.log('Error response data:', responseData);
        
        // Handle object errors (field validation errors)
        if (typeof responseData === 'object' && responseData !== null) {
          const errorMessages = [];
          
          // Loop through all error fields
          Object.entries(responseData).forEach(([key, value]) => {
            if (Array.isArray(value)) {
              errorMessages.push(`${key}: ${value.join(', ')}`);
            } else if (typeof value === 'string') {
              errorMessages.push(`${key}: ${value}`);
            } else {
              errorMessages.push(`${key}: ${JSON.stringify(value)}`);
            }
          });
          
          if (errorMessages.length > 0) {
            errorMessage = errorMessages.join('\n');
          }
        } 
        // Handle string error
        else if (typeof responseData === 'string') {
          errorMessage = responseData;
        }
        // Handle detail field error
        else if (responseData.detail) {
          errorMessage = responseData.detail;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert("Error", errorMessage);
    } finally {
      setSubmitting(false);
    }
  };
  
  // Input field with error handling
  const InputField = ({ 
    label, 
    value, 
    onChangeText, 
    placeholder,
    error,
    required = false,
    keyboardType = 'default',
    multiline = false,
    autoCapitalize = 'sentences'
  }) => (
    <View style={styles.inputContainer}>
      <Text style={styles.label}>
        {label} {required && <Text style={styles.required}>*</Text>}
      </Text>
      <TextInput
        style={[
          styles.input, 
          multiline && styles.textArea,
          error && styles.inputError
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#999"
        keyboardType={keyboardType}
        multiline={multiline}
        autoCapitalize={autoCapitalize}
        editable={!submitting && !isLoading}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
  
  const isFormLoading = isLoading || submitting;
  
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Create Your Organization</Text>
          <Text style={styles.subtitle}>
            This is the first step in setting up your BattWrapz account
          </Text>
        </View>
        
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Organization Details</Text>
          
          <InputField
            label="Organization Name"
            value={name}
            onChangeText={setName}
            placeholder="Enter organization name"
            error={errors.name}
            required={true}
          />
          
          <InputField
            label="Trading Name"
            value={tradingName}
            onChangeText={setTradingName}
            placeholder="Trading name (if different)"
          />
          
          <InputField
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="Organization email address"
            error={errors.email}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          
          <InputField
            label="Phone"
            value={phone}
            onChangeText={setPhone}
            placeholder="Organization phone number"
            error={errors.phone}
            keyboardType="phone-pad"
          />
          
          <InputField
            label="Website"
            value={website}
            onChangeText={setWebsite}
            placeholder="https://example.com"
            error={errors.website}
            keyboardType="url"
            autoCapitalize="none"
          />
        </View>
        
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Registered Address</Text>
          
          <InputField
            label="Address Line 1"
            value={addressLine1}
            onChangeText={setAddressLine1}
            placeholder="Street address, P.O. box, etc."
            error={errors.addressLine1}
            required={true}
          />
          
          <InputField
            label="Address Line 2"
            value={addressLine2}
            onChangeText={setAddressLine2}
            placeholder="Apartment, suite, unit, building, floor, etc."
          />
          
          <InputField
            label="City/Town"
            value={city}
            onChangeText={setCity}
            placeholder="City or town"
            error={errors.city}
            required={true}
          />
          
          <InputField
            label="County"
            value={county}
            onChangeText={setCounty}
            placeholder="County"
          />
          
          <InputField
            label="Postcode"
            value={postcode}
            onChangeText={setPostcode}
            placeholder="Postcode"
            error={errors.postcode}
            required={true}
            autoCapitalize="characters"
          />
        </View>
        
        <TouchableOpacity
          style={[styles.submitButton, isFormLoading && styles.disabledButton]}
          onPress={handleSubmit}
          disabled={isFormLoading}
        >
          {isFormLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.submitButtonText}>Create Organization</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </>
          )}
        </TouchableOpacity>
        
        <Text style={styles.noteText}>
          * Required fields
        </Text>
        
        {/* Debug info - remove in production */}
        {__DEV__ && (
          <View style={styles.debugInfo}>
            <Text style={styles.debugText}>Debug Info:</Text>
            <Text style={styles.debugText}>isLoading: {isLoading.toString()}</Text>
            <Text style={styles.debugText}>submitting: {submitting.toString()}</Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    padding: 20,
    paddingTop: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#555',
    marginBottom: 6,
  },
  required: {
    color: '#FF5500', // Orange to match the brand color
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    backgroundColor: '#fafafa',
    color: '#333',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  inputError: {
    borderColor: '#FF5500',
  },
  errorText: {
    color: '#FF5500',
    fontSize: 12,
    marginTop: 4,
  },
  submitButton: {
    backgroundColor: '#FF5500', // Orange brand color
    borderRadius: 8,
    paddingVertical: 15,
    paddingHorizontal: 20,
    marginHorizontal: 20,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF5500',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  disabledButton: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  noteText: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    marginBottom: 30,
  },
  debugInfo: {
    margin: 20,
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 5,
  },
  debugText: {
    fontSize: 12,
    color: '#666',
  },
});

export default CreateOrganizationScreen;