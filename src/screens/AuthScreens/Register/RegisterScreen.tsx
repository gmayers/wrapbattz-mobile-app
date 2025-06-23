// src/screens/AuthScreens/Register/RegisterScreen.tsx
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
  TextInput as RNTextInput,
} from 'react-native';
import Button from '../../../components/Button';
import FormField from '../../../components/Form/FormField';
import PasswordField from '../../../components/Form/PasswordField';
import { useAuth } from '../../../context/AuthContext';
import { RegisterForm, ValidationResult, NavigationProp } from '../../../types';
import { FormValidation } from '../../../utils/FormValidation';

interface RegisterScreenProps {
  navigation: NavigationProp;
}

const RegisterScreen: React.FC<RegisterScreenProps> = ({ navigation }) => {
  const { axiosInstance } = useAuth();
  
  const [formData, setFormData] = useState<RegisterForm>({
    email: '',
    password: '',
    password2: '',
    first_name: '',
    last_name: '',
    organization_invite_code: '',
    phone_number: '',
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const passwordInputRef = useRef<RNTextInput>(null);
  const confirmPasswordInputRef = useRef<RNTextInput>(null);

  const validateForm = (): boolean => {
    const validationRules = {
      email: FormValidation.commonRules.email(true),
      password: FormValidation.commonRules.password(8),
      password2: FormValidation.commonRules.confirmPassword(formData.password),
      first_name: FormValidation.commonRules.required(),
      last_name: FormValidation.commonRules.required(),
      phone_number: FormValidation.commonRules.phone(true),
      // organization_invite_code is optional, no validation rules needed
    };

    const result: ValidationResult = FormValidation.validateForm(formData, validationRules);
    setErrors(result.errors);
    return result.isValid;
  };

  const handleInputChange = (key: keyof RegisterForm, value: string): void => {
    setFormData(prev => ({ ...prev, [key]: value }));
    
    // Clear error when typing
    if (errors[key]) {
      setErrors(prev => ({ ...prev, [key]: '' }));
    }
  };

  const handleRegister = async (): Promise<void> => {
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    
    // Prepare the registration data exactly as required by the API
    const registrationData = {
      email: formData.email,
      password: formData.password,
      password2: formData.password2,
      first_name: formData.first_name,
      last_name: formData.last_name,
      organization_invite_code: formData.organization_invite_code || '',
      phone_number: formData.phone_number || ''
    };
    
    console.log('Registration data:', JSON.stringify(registrationData, null, 2));
    
    try {
      console.log('API Base URL:', axiosInstance.defaults.baseURL);
      
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
    } catch (error: any) {
      console.error('Registration error:', error);
      
      if (error.response) {
        console.error('Error status:', error.response.status);
        console.error('Error data:', JSON.stringify(error.response.data, null, 2));
        
        // Handle server validation errors
        if (error.response.data && typeof error.response.data === 'object') {
          const serverErrors = error.response.data;
          const formattedErrors: Record<string, string> = {};
          
          Object.keys(serverErrors).forEach(key => {
            formattedErrors[key] = Array.isArray(serverErrors[key]) 
              ? serverErrors[key][0] 
              : serverErrors[key];
          });
          
          setErrors(formattedErrors);
        } else {
          Alert.alert(
            'Registration Failed',
            'The server encountered an error. Please try again later.'
          );
        }
      } else if (error.request) {
        console.error('Network error - no response received');
        Alert.alert(
          'Connection Error',
          'Could not connect to the server. Please check your internet connection and try again.'
        );
      } else {
        Alert.alert(
          'Registration Failed',
          error.message || 'An unexpected error occurred. Please try again.'
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const navigateToLogin = (): void => {
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
                <FormField
                  label="First Name"
                  value={formData.first_name}
                  onChangeText={(text) => handleInputChange('first_name', text)}
                  placeholder="Enter first name"
                  error={errors.first_name}
                  required
                />
              </View>
              <View style={styles.halfInput}>
                <FormField
                  label="Last Name"
                  value={formData.last_name}
                  onChangeText={(text) => handleInputChange('last_name', text)}
                  placeholder="Enter last name"
                  error={errors.last_name}
                  required
                />
              </View>
            </View>

            <FormField
              label="Email"
              value={formData.email}
              onChangeText={(text) => handleInputChange('email', text)}
              placeholder="Enter your email"
              keyboardType="email-address"
              autoCapitalize="none"
              error={errors.email}
              required
            />

            <FormField
              label="Organization Invite Code (Optional)"
              value={formData.organization_invite_code}
              onChangeText={(text) => handleInputChange('organization_invite_code', text)}
              placeholder="Enter organization invite code if you have one"
              error={errors.organization_invite_code}
            />

            <FormField
              label="Phone Number"
              value={formData.phone_number}
              onChangeText={(text) => handleInputChange('phone_number', text)}
              placeholder="Enter phone number"
              keyboardType="phone-pad"
              error={errors.phone_number}
              required
            />

            <PasswordField
              label="Password"
              value={formData.password}
              onChangeText={(text) => handleInputChange('password', text)}
              placeholder="Create a password"
              error={errors.password}
              required
            />

            <PasswordField
              label="Confirm Password"
              value={formData.password2}
              onChangeText={(text) => handleInputChange('password2', text)}
              placeholder="Confirm your password"
              error={errors.password2}
              required
            />

            <Button
              title="Register"
              onPress={handleRegister}
              disabled={isSubmitting}
              loading={isSubmitting}
              style={styles.registerButton}
              textColorProp="black"
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
    paddingBottom: 30,
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
    backgroundColor: '#FF9500',
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