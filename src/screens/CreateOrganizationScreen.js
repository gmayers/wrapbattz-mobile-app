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
  const { createOrganization, isLoading } = useAuth();
  
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
    
    // Phone validation if provided
    if (phone && !/^[\d\+\-\(\) ]{10,15}$/.test(phone)) {
      formErrors.phone = 'Please enter a valid phone number (10-15 digits)';
      isValid = false;
    }
    
    // Website validation if provided
    if (website && !website.startsWith('http')) {
      formErrors.website = 'Website must start with http:// or https://';
      isValid = false;
    }
    
    setErrors(formErrors);
    return isValid;
  };
  
  // Handle form submission
  const handleSubmit = async () => {
    if (!validateForm()) {
      // Scroll to the first error
      return;
    }
    
    try {
      const organizationData = {
        name,
        trading_name: tradingName,
        email,
        phone,
        website,
        registered_address_line1: addressLine1,
        registered_address_line2: addressLine2,
        registered_city: city,
        registered_county: county,
        registered_postcode: postcode,
        // Trading address defaults to registered address for simplicity
        trading_address_line1: addressLine1,
        trading_address_line2: addressLine2,
        trading_city: city,
        trading_county: county,
        trading_postcode: postcode
      };
      
      // Call the API to create the organization
      await createOrganization(organizationData);
      
      // Success message
      Alert.alert(
        "Success",
        "Your organization has been created successfully!",
        [{ text: "OK", onPress: () => navigation.navigate('Dashboard') }]
      );
      
    } catch (error) {
      console.error('Error creating organization:', error);
      
      // Format error message
      let errorMessage = 'Failed to create organization';
      
      // Check if error has a response
      if (error.response) {
        const responseData = error.response.data;
        
        // Handle object errors (field validation errors)
        if (typeof responseData === 'object' && responseData !== null) {
          const errorMessages = [];
          
          // Loop through all error fields
          Object.entries(responseData).forEach(([key, value]) => {
            const errorText = Array.isArray(value) ? value.join(' ') : value;
            errorMessages.push(`${key}: ${errorText}`);
          });
          
          errorMessage = errorMessages.join('\n');
        } 
        // Handle string error
        else if (typeof responseData === 'string') {
          errorMessage = responseData;
        }
        // Handle detail field error
        else if (responseData.detail) {
          errorMessage = responseData.detail;
        }
      }
      
      Alert.alert("Error", errorMessage);
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
        keyboardType={keyboardType}
        multiline={multiline}
        autoCapitalize={autoCapitalize}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
  
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
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
          style={[styles.submitButton, isLoading && styles.disabledButton]}
          onPress={handleSubmit}
          disabled={isLoading}
        >
          {isLoading ? (
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
});

export default CreateOrganizationScreen;