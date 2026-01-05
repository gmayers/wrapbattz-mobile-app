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
  const { axiosInstance } = useAuth();

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
    
    // Prepare the registration data exactly as required by the API
    const registrationData = {
      email: formData.email,
      password: formData.password,
      password2: formData.password2,
      first_name: formData.first_name,
      last_name: formData.last_name,
      organization_invite_code: formData.organization_invite_code || '',
      phone_number: formData.phone_number || '',
      subscription_plan: selectedPlanType,
      billing_cycle: billingCycle
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

            {/* Subscription Plan Selection */}
            <View style={styles.planSection}>
              <View style={styles.planHeader}>
                <Text style={styles.planSectionTitle}>Select Your Plan</Text>
                <TouchableOpacity onPress={navigateToPricing}>
                  <Text style={styles.viewAllPlansLink}>View all plans →</Text>
                </TouchableOpacity>
              </View>

              {/* Billing Toggle */}
              {selectedPlanType !== 'starter' && (
                <View style={styles.billingToggle}>
                  <Text style={[styles.billingOption, billingCycle === 'monthly' && styles.billingOptionActive]}>
                    Monthly
                  </Text>
                  <TouchableOpacity style={styles.toggleSwitch} onPress={toggleBillingCycle}>
                    <View style={[styles.toggleThumb, billingCycle === 'monthly' && styles.toggleThumbLeft]} />
                  </TouchableOpacity>
                  <Text style={[styles.billingOption, billingCycle === 'annual' && styles.billingOptionActive]}>
                    Annually {billingCycle === 'annual' && '(Save 16%)'}
                  </Text>
                </View>
              )}

              {/* Plan Cards */}
              <View style={styles.planCards}>
                <TouchableOpacity
                  style={[
                    styles.planCard,
                    selectedPlanType === 'starter' && styles.planCardSelected,
                  ]}
                  onPress={() => setSelectedPlanType('starter')}
                >
                  <View style={styles.planRadio}>
                    {selectedPlanType === 'starter' && <View style={styles.planRadioSelected} />}
                  </View>
                  <View style={styles.planContent}>
                    <Text style={styles.planName}>Starter</Text>
                    <Text style={styles.planPrice}>FREE</Text>
                    <Text style={styles.planDesc}>First 3 assets free</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.planCard,
                    selectedPlanType === 'professional' && styles.planCardSelected,
                  ]}
                  onPress={() => setSelectedPlanType('professional')}
                >
                  {selectedPlanType === 'professional' && (
                    <View style={styles.popularBadge}>
                      <Text style={styles.popularText}>Popular</Text>
                    </View>
                  )}
                  <View style={styles.planRadio}>
                    {selectedPlanType === 'professional' && <View style={styles.planRadioSelected} />}
                  </View>
                  <View style={styles.planContent}>
                    <Text style={styles.planName}>Professional</Text>
                    <Text style={styles.planPrice}>{getPlanPrice()}</Text>
                    <Text style={styles.planDesc}>{getPlanDescription()}</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>

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
  // Plan Selection Styles
  planSection: {
    marginBottom: 20,
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    padding: 16,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  planSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  viewAllPlansLink: {
    fontSize: 14,
    color: '#FF9500',
    fontWeight: '500',
  },
  billingToggle: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  billingOption: {
    fontSize: 14,
    color: '#999',
    paddingHorizontal: 10,
  },
  billingOptionActive: {
    color: '#333',
    fontWeight: '600',
  },
  toggleSwitch: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FF9500',
    position: 'relative',
    marginHorizontal: 8,
  },
  toggleThumb: {
    position: 'absolute',
    width: 18,
    height: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 9,
    top: 3,
    right: 3,
  },
  toggleThumbLeft: {
    right: 'auto',
    left: 3,
  },
  planCards: {
    gap: 12,
  },
  planCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    position: 'relative',
  },
  planCardSelected: {
    borderColor: '#FF9500',
    backgroundColor: '#FFF5E6',
  },
  popularBadge: {
    position: 'absolute',
    top: -8,
    right: 12,
    backgroundColor: '#FF9500',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  popularText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  planRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ddd',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planRadioSelected: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF9500',
  },
  planContent: {
    flex: 1,
  },
  planName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  planPrice: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FF9500',
    marginBottom: 2,
  },
  planDesc: {
    fontSize: 12,
    color: '#666',
  },
});

export default RegisterScreen;