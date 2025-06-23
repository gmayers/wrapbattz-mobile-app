// src/screens/AuthScreens/Login/LoginScreen.tsx
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Image,
  Alert,
  TextInput as RNTextInput,
} from 'react-native';
import { useAuth } from '../../../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { LoginForm, ValidationResult, NavigationProp } from '../../../types';
import { FormValidation } from '../../../utils/FormValidation';
import FormField from '../../../components/Form/FormField';
import PasswordField from '../../../components/Form/PasswordField';
import Button from '../../../components/Button';

const LoginScreen: React.FC = () => {
  const { login } = useAuth();
  const navigation = useNavigation<NavigationProp>();
  
  const [formData, setFormData] = useState<LoginForm>({
    email: '',
    password: '',
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const passwordInputRef = useRef<RNTextInput>(null);

  const validateForm = (): boolean => {
    const validationRules = {
      email: FormValidation.commonRules.email(true),
      password: [
        { type: 'required' as const, message: 'Password is required' },
        { type: 'minLength' as const, value: 6, message: 'Password must be at least 6 characters' }
      ],
    };

    const result: ValidationResult = FormValidation.validateForm(formData, validationRules);
    setErrors(result.errors);
    return result.isValid;
  };

  const handleChange = (field: keyof LoginForm, value: string): void => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));

    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: '',
      }));
    }
  };

  const handleLogin = async (): Promise<void> => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      await login(formData.email, formData.password);
    } catch (error: any) {
      console.error('Login error:', error);
      
      let errorMessage = 'Unable to connect to the server. Please check your internet connection and try again.';
      
      if (error.response) {
        errorMessage = error.response.data?.detail || 
                      error.response.data?.message || 
                      'Invalid credentials';
      } else if (error.request) {
        errorMessage = 'No response from server. Please check your internet connection.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      Alert.alert('Login Failed', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            {/* Logo Section */}
            <View style={styles.logoContainer}>
              <Image
                source={require('../../../../assets/logo.jpg')}
                style={styles.logo}
                resizeMode="contain"
              />
              <Text style={styles.welcomeText}>Welcome Back</Text>
              <Text style={styles.subtitleText}>Sign in to continue</Text>
            </View>

            {/* Form Section */}
            <View style={styles.formContainer}>
              <FormField
                label="Email"
                value={formData.email}
                onChangeText={(value) => handleChange('email', value)}
                placeholder="Enter your email"
                keyboardType="email-address"
                autoCapitalize="none"
                error={errors.email}
                required
              />

              <PasswordField
                label="Password"
                value={formData.password}
                onChangeText={(value) => handleChange('password', value)}
                placeholder="Enter your password"
                error={errors.password}
                required
              />

              <Button
                title="Sign In"
                onPress={handleLogin}
                loading={isLoading}
                textColorProp="black"
                style={styles.loginButton}
                testID="login-button"
              />

              <TouchableOpacity 
                style={styles.forgotPassword}
                testID="forgot-password-button"
                onPress={() => navigation.navigate('ForgotPassword')}
              >
                <Text style={styles.forgotPasswordText}>
                  Forgot Password?
                </Text>
              </TouchableOpacity>
              
              {/* Register Section */}
              <View style={styles.registerContainer}>
                <Text style={styles.registerText}>Don't have an account?</Text>
                <TouchableOpacity 
                  testID="register-button"
                  onPress={() => navigation.navigate('Register')}
                >
                  <Text style={styles.registerButtonText}>Create Account</Text>
                </TouchableOpacity>
              </View>
              
              {/* Pricing Button */}
              <View style={styles.pricingButtonContainer}>
                <TouchableOpacity 
                  style={styles.pricingButton}
                  testID="pricing-button"
                  onPress={() => navigation.navigate('Pricing')}
                >
                  <Text style={styles.pricingButtonText}>View Subscription Plans</Text>
                </TouchableOpacity>
              </View>
            </View>
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
  keyboardView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 20,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitleText: {
    fontSize: 16,
    color: '#666',
  },
  formContainer: {
    width: '100%',
  },
  loginButton: {
    marginTop: 20,
    backgroundColor: '#FF9500',
  },
  forgotPassword: {
    alignItems: 'center',
    marginTop: 20,
  },
  forgotPasswordText: {
    color: '#007AFF',
    fontSize: 16,
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },
  registerText: {
    fontSize: 16,
    color: '#666',
  },
  registerButtonText: {
    color: '#FF9500',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 5,
  },
  pricingButtonContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  pricingButton: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#ddd',
    width: '100%',
    alignItems: 'center',
  },
  pricingButtonText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
});

export default LoginScreen;