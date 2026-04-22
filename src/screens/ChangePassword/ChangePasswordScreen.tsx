// src/screens/ChangePassword/ChangePasswordScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { PasswordChangeForm, ValidationResult, NavigationProp } from '../../types';
import { FormValidation } from '../../utils/FormValidation';
import PasswordField from '../../components/Form/PasswordField';
import * as authApi from '../../api/endpoints/auth';
import { ApiError } from '../../api/errors';

const ORANGE_COLOR = '#FFC72C';

interface ChangePasswordScreenProps {
  navigation: NavigationProp;
}

const ChangePasswordScreen: React.FC<ChangePasswordScreenProps> = ({ navigation }) => {
  // useAuth is kept only so the screen fails loud if mounted outside the provider.
  useAuth();
  const { colors } = useTheme();

  const [formData, setFormData] = useState<PasswordChangeForm>({
    current_password: '',
    new_password: '',
    confirm_password: ''
});
  
  const [loading, setLoading] = useState<boolean>(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    navigation.setOptions({
      title: 'Change Password'
});
  }, [navigation]);

  const validateForm = (): boolean => {
    const validationRules = {
      current_password: FormValidation.commonRules.required(),
      new_password: FormValidation.commonRules.password(12),
      confirm_password: FormValidation.commonRules.confirmPassword(formData.new_password)
};

    const result: ValidationResult = FormValidation.validateForm(formData, validationRules);
    setErrors(result.errors);
    return result.isValid;
  };

  const handleChange = (field: keyof PasswordChangeForm, value: string): void => {
    setFormData(prev => ({
      ...prev,
      [field]: value
}));

    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
}));
    }
  };

  const handleSubmit = async (): Promise<void> => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      await authApi.changePassword({
        current_password: formData.current_password,
        new_password: formData.new_password
});

      Alert.alert(
        'Success',
        'Password changed successfully',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (err) {
      const detail = err instanceof ApiError ? err.detail : undefined;
      if (detail && typeof detail === 'object') {
        const apiErrors: Record<string, string> = {};
        const pick = (key: string): string | undefined => {
          const value = (detail as Record<string, unknown>)[key];
          if (Array.isArray(value) && value.length > 0) return String(value[0]);
          if (typeof value === 'string') return value;
          return undefined;
        };
        const current = pick('current_password') ?? pick('old_password');
        const next = pick('new_password') ?? pick('password');
        if (current) apiErrors.current_password = current;
        if (next) apiErrors.new_password = next;
        const nonField = pick('detail') ?? pick('non_field_errors');
        if (nonField) Alert.alert('Error', nonField);
        setErrors(apiErrors);
      } else {
        Alert.alert(
          'Error',
          (err instanceof ApiError && err.message) || 'Failed to change password. Please try again.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.surface }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidView}
      >
        <ScrollView>
          <View style={styles.formContainer}>
            <View style={[styles.infoContainer, { backgroundColor: colors.surfaceAlt }]}>
              <Ionicons name="information-circle-outline" size={24} color={colors.textSecondary} />
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                Your password must be at least 8 characters long and include a mix of letters,
                numbers, and special characters for security.
              </Text>
            </View>

            <PasswordField
              label="Current Password"
              value={formData.current_password}
              onChangeText={(value) => handleChange('current_password', value)}
              placeholder="Enter your current password"
              error={errors.current_password}
              required
            />

            <PasswordField
              label="New Password"
              value={formData.new_password}
              onChangeText={(value) => handleChange('new_password', value)}
              placeholder="Enter your new password"
              error={errors.new_password}
              required
            />

            <PasswordField
              label="Confirm New Password"
              value={formData.confirm_password}
              onChangeText={(value) => handleChange('confirm_password', value)}
              placeholder="Confirm your new password"
              error={errors.confirm_password}
              required
            />

            <View style={styles.buttonContainer}>
              {loading ? (
                <ActivityIndicator size="large" color={colors.primary} />
              ) : (
                <>
                  <TouchableOpacity
                    style={[styles.cancelButton, { backgroundColor: colors.surfaceAlt }]}
                    onPress={() => navigation.goBack()}
                  >
                    <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.saveButton, { backgroundColor: colors.primary }]}
                    onPress={handleSubmit}
                  >
                    <Text style={[styles.saveButtonText, { color: colors.onPrimary }]}>Update Password</Text>
                  </TouchableOpacity>
                </>
              )}
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
    backgroundColor: '#FFFFFF'
},
  keyboardAvoidView: {
    flex: 1
},
  formContainer: {
    padding: 20
},
  infoContainer: {
    flexDirection: 'row',
    backgroundColor: '#F9F9F9',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    alignItems: 'flex-start'
},
  infoText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 10,
    flex: 1,
    lineHeight: 20
},
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 30
},
  cancelButton: {
    flex: 1,
    backgroundColor: '#F2F2F2',
    padding: 15,
    borderRadius: 8,
    marginRight: 10,
    alignItems: 'center'
},
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666'
},
  saveButton: {
    flex: 1,
    backgroundColor: ORANGE_COLOR,
    padding: 15,
    borderRadius: 8,
    marginLeft: 10,
    alignItems: 'center'
},
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF'
}
});

export default ChangePasswordScreen;