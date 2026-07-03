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
  Image,
  TextInput as RNTextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../../../components/Button';
import FormField from '../../../components/Form/FormField';
import PasswordField from '../../../components/Form/PasswordField';
import { useAuth } from '../../../context/AuthContext';
import { useTheme } from '../../../context/ThemeContext';
import { RegisterForm, ValidationResult, NavigationProp } from '../../../types';
import { FormValidation } from '../../../utils/FormValidation';
import GoogleSignInButton from '../../../components/GoogleSignInButton';
import { googleSignInAlert } from '../../../auth/googleSignIn';

interface RegisterScreenProps {
  navigation: NavigationProp;
}

const RegisterScreen: React.FC<RegisterScreenProps> = ({ navigation }) => {
  const { register, loginWithGoogle } = useAuth();
  const { colors } = useTheme();

  const [formData, setFormData] = useState<RegisterForm>({
    email: '',
    password: '',
    password2: '',
    first_name: '',
    last_name: '',
    organization_invite_code: '',
    phone_number: ''
});

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [googleLoading, setGoogleLoading] = useState<boolean>(false);
  const passwordInputRef = useRef<RNTextInput>(null);
  const confirmPasswordInputRef = useRef<RNTextInput>(null);

  const validateForm = (): boolean => {
    const validationRules = {
      email: FormValidation.commonRules.email(true),
      password: FormValidation.commonRules.password(12),
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
      const response = await register({
        email: formData.email,
        password: formData.password,
        first_name: formData.first_name,
        last_name: formData.last_name
});

      navigation.navigate('VerifyEmail', {
        emailVerificationId: response.email_verification_id,
        email: formData.email
});
    } catch (error: any) {
      const detail = error?.detail;
      if (detail && typeof detail === 'object') {
        const serverErrors = detail as Record<string, unknown>;
        const formattedErrors: Record<string, string> = {};
        Object.keys(serverErrors).forEach((key) => {
          const value = serverErrors[key];
          formattedErrors[key] = Array.isArray(value) ? String(value[0]) : String(value);
        });
        setErrors(formattedErrors);
      } else {
        Alert.alert(
          'Registration Failed',
          error?.message || 'An unexpected error occurred. Please try again.'
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const navigateToLogin = (): void => {
    navigation.navigate('Login');
  };

  const handleGoogleSignIn = async (): Promise<void> => {
    setGoogleLoading(true);
    try {
      await loginWithGoogle('sign-up');
      // Success or cancel: navigation falls out of auth state; nothing to do.
    } catch (err) {
      const alert = googleSignInAlert(err);
      Alert.alert(alert.title, alert.message);
    } finally {
      setGoogleLoading(false);
    }
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

            {/* Plan selection removed: TOOLTRAQ is a free B2B access client.
                Organizations subscribe on the web; no plans are chosen or sold
                in-app (App Store Guideline 3.1.3(c)). */}

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
              disabled={isSubmitting || googleLoading}
              loading={isSubmitting}
              style={{ marginTop: 20, backgroundColor: colors.primary }}
              textColorProp="black"
            />

            <View style={styles.dividerRow}>
              <View style={[styles.dividerLine, { backgroundColor: colors.borderLight }]} />
              <Text style={{ color: colors.textSecondary, marginHorizontal: 10, fontSize: 13 }}>or</Text>
              <View style={[styles.dividerLine, { backgroundColor: colors.borderLight }]} />
            </View>
            <GoogleSignInButton onPress={handleGoogleSignIn} loading={googleLoading} disabled={isSubmitting} />

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

const styles = StyleSheet.create({
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 20 },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth },
});

export default RegisterScreen;
