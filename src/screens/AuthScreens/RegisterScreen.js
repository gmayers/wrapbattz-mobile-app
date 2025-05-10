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

const RegisterScreen = ({ navigation }) => {
  const { axiosInstance } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    first_name: '',
    last_name: '',
    organization_invite_code: '', // Updated field name to match API
    phone_number: '',
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const passwordInputRef = useRef(null);
  const confirmPasswordInputRef = useRef(null);

  const validateForm = () => {
    console.log('REG-1: Validating registration form');
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
    console.log('REG-2: Validation result:', isValid ? 'Valid' : 'Invalid', 
      Object.keys(newErrors).length > 0 ? 'with errors' : '');
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
    console.log('REG-3: Register button pressed');
    if (!validateForm()) {
      console.log('REG-4: Form validation failed, aborting registration');
      return;
    }

    setIsSubmitting(true);
    console.log('REG-5: Setting submission state to true');
    
    try {
      console.log('REG-6: Sending registration request');
      // API call to register user with correct endpoint and fields
      const response = await axiosInstance.post('/auth/register/register/', {
        email: formData.email,
        // No username field since CustomUser doesn't use it
        password: formData.password,
        password2: formData.confirmPassword,
        first_name: formData.first_name,
        last_name: formData.last_name,
        organization_invite_code: formData.organization_invite_code || '',
        phone_number: formData.phone_number
      });

      console.log('REG-7: Registration successful, response:', response.status);
      
      // Show success message with email verification instructions
      Alert.alert(
        'Registration Successful',
        'Your account has been created. Please check your email to verify your account before logging in.',
        [
          {
            text: 'OK',
            onPress: () => {
              console.log('REG-8: Success alert acknowledged, navigating to login');
              // Navigate to login screen after registration
              navigation.navigate('Login');
            }
          }
        ]
      );
    } catch (error) {
      console.error('REG-9: Registration error:', error);
      console.error('REG-10: Error response status:', error.response?.status);
      console.error('REG-11: Error response data:', JSON.stringify(error.response?.data, null, 2));
      
      if (error.response && error.response.data) {
        // Handle server validation errors
        const serverErrors = error.response.data;
        const formattedErrors = {};
        
        Object.keys(serverErrors).forEach(key => {
          formattedErrors[key] = Array.isArray(serverErrors[key]) 
            ? serverErrors[key][0] 
            : serverErrors[key];
        });
        
        console.log('REG-12: Setting server validation errors:', JSON.stringify(formattedErrors, null, 2));
        setErrors(formattedErrors);
      } else {
        // General error
        console.log('REG-13: Displaying general error alert');
        Alert.alert(
          'Registration Failed',
          error.message || 'An unexpected error occurred. Please try again.'
        );
      }
    } finally {
      console.log('REG-14: Setting submission state to false');
      setIsSubmitting(false);
    }
  };

  const navigateToLogin = () => {
    console.log('REG-15: Navigate to login screen');
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