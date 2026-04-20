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
  Image,
  TextInput as RNTextInput,
} from 'react-native';
import Button from '../../../components/Button';
import FormField from '../../../components/Form/FormField';
import PasswordField from '../../../components/Form/PasswordField';
import { useAuth } from '../../../context/AuthContext';
import { useTheme } from '../../../context/ThemeContext';
import { RegisterForm, ValidationResult, NavigationProp } from '../../../types';
import { FormValidation } from '../../../utils/FormValidation';

interface RegisterScreenProps {
  navigation: NavigationProp;
  route?: {
    params?: {
      selectedPlan?: {
        type: string;
        billing: string;
        price: string;
      };
    };
  };
}

const RegisterScreen: React.FC<RegisterScreenProps> = ({ navigation, route }) => {
  const { register } = useAuth();
  const { colors } = useTheme();

  // Get selected plan from navigation params
  const selectedPlan = route?.params?.selectedPlan;

  const [formData, setFormData] = useState<RegisterForm>({
    email: '',
    password: '',
    password2: '',
    first_name: '',
    last_name: '',
    organization_invite_code: '',
    phone_number: '',
  });

  // State for plan selection when not coming from pricing page
  const [selectedPlanType, setSelectedPlanType] = useState<string>(
    selectedPlan?.type || 'starter'
  );
  const [billingCycle, setBillingCycle] = useState<string>(
    selectedPlan?.billing || 'annual'
  );

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

    try {
      await register({
        email: formData.email,
        password: formData.password,
        password2: formData.password2,
        first_name: formData.first_name,
        last_name: formData.last_name,
        organization_invite_code: formData.organization_invite_code || '',
        phone_number: formData.phone_number || '',
      });

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
      if (error.response) {
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

  const navigateToPricing = (): void => {
    navigation.navigate('Pricing');
  };

  const toggleBillingCycle = (): void => {
    setBillingCycle(billingCycle === 'annual' ? 'monthly' : 'annual');
  };

  const getPlanPrice = (): string => {
    if (selectedPlanType === 'starter') return 'FREE';
    return billingCycle === 'annual' ? '25p' : '30p';
  };

  const getPlanDescription = (): string => {
    if (selectedPlanType === 'starter') {
      return 'First 3 assets free forever';
    }
    return billingCycle === 'annual'
      ? 'per asset/month, billed annually'
      : 'per asset/month, billed monthly';
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 25}
        enabled
      >
        <ScrollView
          style={{ flex: 1, backgroundColor: colors.background }}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 30 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={true}
          bounces={false}
        >
          <View style={{ padding: 20 }}>
            {/* Logo and Brand */}
            <View style={{ alignItems: 'center', marginBottom: 20 }}>
              <Image
                source={require('../../../../assets/logo-tooltraq.png')}
                style={{ width: 260, height: 82, alignSelf: 'center' }}
                resizeMode="contain"
              />
            </View>

            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.primary, marginBottom: 8, textAlign: 'center' }}>Step 1 of 2</Text>
            <Text style={{ fontSize: 28, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 10, textAlign: 'center' }}>Create an Account</Text>
            <Text style={{ fontSize: 15, color: colors.textSecondary, marginBottom: 30, textAlign: 'center', lineHeight: 22 }}>
              Register your personal account to get started with TOOLTRAQ. After this, you'll set up your organization where you can manage devices, locations, and team members.
            </Text>

            {/* Subscription Plan Selection */}
            <View style={{ marginBottom: 20, backgroundColor: colors.surface, borderRadius: 12, padding: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary }}>Choose Your Plan</Text>
                <TouchableOpacity onPress={navigateToPricing}>
                  <Text style={{ fontSize: 14, color: colors.primary, fontWeight: '500' }}>View all plans →</Text>
                </TouchableOpacity>
              </View>

              {/* Billing Toggle */}
              {selectedPlanType !== 'starter' && (
                <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                  <Text style={{ fontSize: 14, color: billingCycle === 'monthly' ? colors.textPrimary : colors.textMuted, paddingHorizontal: 10, fontWeight: billingCycle === 'monthly' ? '600' : 'normal' }}>
                    Monthly
                  </Text>
                  <TouchableOpacity style={{ width: 44, height: 24, borderRadius: 12, backgroundColor: colors.primary, position: 'relative', marginHorizontal: 8 }} onPress={toggleBillingCycle}>
                    <View style={{ position: 'absolute', width: 18, height: 18, backgroundColor: colors.background, borderRadius: 9, top: 3, ...(billingCycle === 'monthly' ? { left: 3 } : { right: 3 }) }} />
                  </TouchableOpacity>
                  <Text style={{ fontSize: 14, color: billingCycle === 'annual' ? colors.textPrimary : colors.textMuted, paddingHorizontal: 10, fontWeight: billingCycle === 'annual' ? '600' : 'normal' }}>
                    Annually {billingCycle === 'annual' && '(Save 16%)'}
                  </Text>
                </View>
              )}

              {/* Plan Cards */}
              <View style={{ gap: 12 }}>
                <TouchableOpacity
                  style={{
                    backgroundColor: selectedPlanType === 'starter' ? colors.primaryLight : colors.card,
                    borderRadius: 10,
                    padding: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderWidth: 1.5,
                    borderColor: selectedPlanType === 'starter' ? colors.primary : colors.border,
                    position: 'relative',
                  }}
                  onPress={() => setSelectedPlanType('starter')}
                >
                  <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.borderInput, marginRight: 12, alignItems: 'center', justifyContent: 'center' }}>
                    {selectedPlanType === 'starter' && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary }} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: 2 }}>Starter</Text>
                    <Text style={{ fontSize: 20, fontWeight: '700', color: colors.primary, marginBottom: 2 }}>FREE</Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>First 3 assets free</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{
                    backgroundColor: selectedPlanType === 'professional' ? colors.primaryLight : colors.card,
                    borderRadius: 10,
                    padding: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderWidth: 1.5,
                    borderColor: selectedPlanType === 'professional' ? colors.primary : colors.border,
                    position: 'relative',
                  }}
                  onPress={() => setSelectedPlanType('professional')}
                >
                  {selectedPlanType === 'professional' && (
                    <View style={{ position: 'absolute', top: -8, right: 12, backgroundColor: colors.primary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                      <Text style={{ color: colors.background, fontSize: 10, fontWeight: '600' }}>Popular</Text>
                    </View>
                  )}
                  <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.borderInput, marginRight: 12, alignItems: 'center', justifyContent: 'center' }}>
                    {selectedPlanType === 'professional' && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary }} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: 2 }}>Professional</Text>
                    <Text style={{ fontSize: 20, fontWeight: '700', color: colors.primary, marginBottom: 2 }}>{getPlanPrice()}</Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>{getPlanDescription()}</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary, marginBottom: 6 }}>Your Details</Text>
            <Text style={{ fontSize: 14, color: colors.textMuted, marginBottom: 16, lineHeight: 20 }}>
              This is the account owner's information. You'll use your email and password to log in.
            </Text>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
              <View style={{ width: '48%' }}>
                <FormField
                  label="First Name"
                  value={formData.first_name}
                  onChangeText={(text) => handleInputChange('first_name', text)}
                  placeholder="Enter first name"
                  error={errors.first_name}
                  required
                />
              </View>
              <View style={{ width: '48%' }}>
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
              style={{ marginTop: 20, backgroundColor: colors.primary }}
              textColorProp="black"
            />

            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 20, marginBottom: 30 }}>
              <Text style={{ fontSize: 16, color: colors.textSecondary }}>Already have an account?</Text>
              <TouchableOpacity onPress={navigateToLogin}>
                <Text style={{ fontSize: 16, color: colors.primary, fontWeight: 'bold', marginLeft: 5 }}>Login</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default RegisterScreen;
