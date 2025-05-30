// RegisterScreen.js
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from 'react-native';
import Button from '../../components/Button';
import { BaseTextInput, EmailInput, PasswordInput } from '../../components/TextInput';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios'; // Import axios directly

const RegisterScreen = ({ navigation }) => {
  const { axiosInstance } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    first_name: '',
    last_name: '',
    organization_invite_code: '',
    phone_number: '',
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const passwordInputRef = useRef(null);
  const confirmPasswordInputRef = useRef(null);

  const validateForm = () => {
    let isValid = true;
    const newErrors = {};

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email || !emailRegex.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
      isValid = false;
    }

    // Password validation
    if (!formData.password || formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
      isValid = false;
    }

    // Confirm password validation
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
      isValid = false;
    }

    // Name validation
    if (!formData.first_name) {
      newErrors.first_name = 'First name is required';
      isValid = false;
    }

    if (!formData.last_name) {
      newErrors.last_name = 'Last name is required';
      isValid = false;
    }

    // Phone number validation (basic)
    if (!formData.phone_number) {
      newErrors.phone_number = 'Phone number is required';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleInputChange = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    // Clear error when typing
    if (errors[key]) {
      setErrors(prev => ({ ...prev, [key]: null }));
    }
  };

  const handleRegister = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    
    // Prepare the registration data exactly as required by the API
    const registrationData = {
      email: formData.email,
      password: formData.password,
      password2: formData.password, // Use same password to ensure match
      first_name: formData.first_name,
      last_name: formData.last_name,
      organization_invite_code: formData.organization_invite_code || '',
      phone_number: formData.phone_number || ''
    };
    
    console.log('Registration data:', JSON.stringify(registrationData, null, 2));
    
    try {
      // First, log what base URL is being used
      console.log('API Base URL:', axiosInstance.defaults.baseURL);
      
      // Direct API call
      const response = await axiosInstance.post('/auth/register/', registrationData);
      
      console.log('Registration response:', response.data);
      
      Alert.alert(
        'Registration Successful',
        'Your account has been created. Please check your email to verify your account before logging in.',
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('Login')
          }
        ]
      );
    } catch (error) {
      console.error('Registration error:', error);
      
      if (error.response) {
        console.error('Error status:', error.response.status);
        console.error('Error data:', JSON.stringify(error.response.data, null, 2));
        
        // Handle server validation errors
        if (error.response.data && typeof error.response.data === 'object') {
          const serverErrors = error.response.data;
          const formattedErrors = {};
          
          Object.keys(serverErrors).forEach(key => {
            formattedErrors[key] = Array.isArray(serverErrors[key]) 
              ? serverErrors[key][0] 
              : serverErrors[key];
          });
          
          setErrors(formattedErrors);
        } else {
          // Generic server error message
          Alert.alert(
            'Registration Failed',
            'The server encountered an error. Please try again later.'
          );
        }
      } else if (error.request) {
        // Network error
        console.error('Network error - no response received');
        Alert.alert(
          'Connection Error',
          'Could not connect to the server. Please check your internet connection and try again.'
        );
      } else {
        // Other errors
        Alert.alert(
          'Registration Failed',
          error.message || 'An unexpected error occurred. Please try again.'
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const navigateToLogin = () => {
    navigation.navigate('Login');
  };

  return (
    <SafeAreaView style={styles.safeContainer}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 25}
        enabled
      >
        <ScrollView 
          style={styles.container}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={true}
          bounces={false}
        >
          <View style={styles.formContainer}>
            <Text style={styles.headerText}>Create an Account</Text>
            <Text style={styles.subHeaderText}>
              Join us to track and manage your devices
            </Text>

            <View style={styles.inputRow}>
              <View style={styles.halfInput}>
                <BaseTextInput
                  label="First Name"
                  value={formData.first_name}
                  onChangeText={(text) => handleInputChange('first_name', text)}
                  placeholder="Enter first name"
                  error={errors.first_name}
                />
              </View>
              <View style={styles.halfInput}>
                <BaseTextInput
                  label="Last Name"
                  value={formData.last_name}
                  onChangeText={(text) => handleInputChange('last_name', text)}
                  placeholder="Enter last name"
                  error={errors.last_name}
                />
              </View>
            </View>

            <EmailInput
              value={formData.email}
              onChangeText={(text) => handleInputChange('email', text)}
              error={errors.email}
              placeholder="Enter your email"
              returnKeyType="next"
              onSubmitEditing={() => passwordInputRef.current?.focus()}
            />

            <BaseTextInput
              label="Organization Invite Code (Optional)"
              value={formData.organization_invite_code}
              onChangeText={(text) => handleInputChange('organization_invite_code', text)}
              placeholder="Enter organization invite code if you have one"
              error={errors.organization_invite_code}
            />

            <BaseTextInput
              label="Phone Number"
              value={formData.phone_number}
              onChangeText={(text) => handleInputChange('phone_number', text)}
              placeholder="Enter phone number"
              keyboardType="phone-pad"
              error={errors.phone_number}
            />

            <PasswordInput
              ref={passwordInputRef}
              value={formData.password}
              onChangeText={(text) => handleInputChange('password', text)}
              error={errors.password}
              placeholder="Create a password"
              returnKeyType="next"
              onSubmitEditing={() => confirmPasswordInputRef.current?.focus()}
            />

            <PasswordInput
              ref={confirmPasswordInputRef}
              value={formData.confirmPassword}
              onChangeText={(text) => handleInputChange('confirmPassword', text)}
              error={errors.confirmPassword}
              placeholder="Confirm your password"
              returnKeyType="done"
              onSubmitEditing={handleRegister}
            />

            <Button
              title="Register"
              onPress={handleRegister}
              disabled={isSubmitting}
              loading={isSubmitting}
              style={styles.registerButton}
              textColor="black"
            />

            <View style={styles.loginPrompt}>
              <Text style={styles.loginText}>Already have an account?</Text>
              <TouchableOpacity onPress={navigateToLogin}>
                <Text style={styles.loginLink}>Login</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardView: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 30, // Extra padding at the bottom to ensure space when keyboard is open
  },
  formContainer: {
    padding: 20,
  },
  headerText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  subHeaderText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  halfInput: {
    width: '48%',
  },
  registerButton: {
    marginTop: 20,
    backgroundColor: 'orange',
  },
  loginPrompt: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  loginText: {
    fontSize: 16,
    color: '#666',
  },
  loginLink: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: 'bold',
    marginLeft: 5,
  },
});

export default RegisterScreen;