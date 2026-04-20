// src/screens/AuthScreens/Login/LoginScreen.tsx
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
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
import { useTheme } from '../../../context/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import { LoginForm, ValidationResult, NavigationProp } from '../../../types';
import { FormValidation } from '../../../utils/FormValidation';
import FormField from '../../../components/Form/FormField';
import PasswordField from '../../../components/Form/PasswordField';
import Button from '../../../components/Button';

const LoginScreen: React.FC = () => {
  const { login } = useAuth();
  const { colors } = useTheme();
  const navigation = useNavigation<NavigationProp>();

  const [formData, setFormData] = useState<LoginForm>({
    email: '',
    password: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string>('');
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

    // Clear login error when user starts typing
    if (loginError) {
      setLoginError('');
    }
  };

  const handleLogin = async (): Promise<void> => {
    if (!validateForm()) return;

    setIsLoading(true);
    setLoginError(''); // Clear any previous errors

    try {
      await login(formData.email, formData.password);
      // Login successful - navigation will happen automatically via AuthContext
    } catch (error: any) {
      console.error('Login error:', error);

      let errorMessage = 'Unable to connect to the server. Please check your internet connection and try again.';

      if (error.response) {
        const status = error.response.status;

        // Handle specific error codes
        if (status === 401) {
          errorMessage = 'Invalid email or password. Please try again.';
        } else if (status === 400) {
          errorMessage = error.response.data?.detail ||
                        error.response.data?.message ||
                        'Invalid credentials. Please check your email and password.';
        } else if (status === 403) {
          errorMessage = 'Your account has been disabled. Please contact support.';
        } else if (status >= 500) {
          errorMessage = 'Server error. Please try again later.';
        } else {
          errorMessage = error.response.data?.detail ||
                        error.response.data?.message ||
                        'Login failed. Please try again.';
        }
      } else if (error.request) {
        errorMessage = 'No response from server. Please check your internet connection.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      // Set the error to display in the UI
      setLoginError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle={colors.statusBar} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ flex: 1, justifyContent: 'center', paddingVertical: 40 }}>
            {/* Logo Section */}
            <View style={{ alignItems: 'center', marginBottom: 40 }}>
              <Image
                source={require('../../../../assets/logo-tooltraq.png')}
                style={{ width: 260, height: 82, alignSelf: 'center' }}
                resizeMode="contain"
              />
              <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 8, marginTop: 12 }}>Welcome Back</Text>
              <Text style={{ fontSize: 16, color: colors.textSecondary }}>Sign in to continue</Text>
            </View>

            {/* Error Banner */}
            {loginError ? (
              <View style={{ backgroundColor: colors.errorBackground, borderWidth: 1, borderColor: colors.error, borderRadius: 8, padding: 12, marginBottom: 20, width: '100%' }}>
                <Text style={{ color: colors.errorText, fontSize: 14, textAlign: 'center', fontWeight: '500' }}>{loginError}</Text>
              </View>
            ) : null}

            {/* Form Section */}
            <View style={{ width: '100%' }}>
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
                style={{ marginTop: 20, backgroundColor: colors.primary }}
                testID="login-button"
              />

              <TouchableOpacity
                style={{ alignItems: 'center', marginTop: 20 }}
                testID="forgot-password-button"
                onPress={() => navigation.navigate('ForgotPassword')}
              >
                <Text style={{ color: colors.primary, fontSize: 16 }}>
                  Forgot Password?
                </Text>
              </TouchableOpacity>

              {/* Register Section */}
              <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 20, paddingTop: 20, borderTopWidth: 1, borderTopColor: colors.borderLight }}>
                <Text style={{ fontSize: 16, color: colors.textSecondary }}>Don't have an account?</Text>
                <TouchableOpacity
                  testID="register-button"
                  onPress={() => navigation.navigate('Register')}
                >
                  <Text style={{ color: colors.primary, fontSize: 16, fontWeight: 'bold', marginLeft: 5 }}>Create Account</Text>
                </TouchableOpacity>
              </View>

              {/* Pricing Button */}
              <View style={{ alignItems: 'center', marginTop: 20 }}>
                <TouchableOpacity
                  style={{ backgroundColor: colors.surfaceAlt, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 25, borderWidth: 1, borderColor: colors.borderInput, width: '100%', alignItems: 'center' }}
                  testID="pricing-button"
                  onPress={() => navigation.navigate('Pricing')}
                >
                  <Text style={{ fontSize: 16, color: colors.textPrimary, fontWeight: '600' }}>View Subscription Plans</Text>
                </TouchableOpacity>
              </View>

            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default LoginScreen;
