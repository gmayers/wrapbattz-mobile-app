// src/screens/ChangePassword/ChangePasswordScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { PasswordChangeForm, ValidationResult, NavigationProp } from '../../types';
import { FormValidation } from '../../utils/FormValidation';
import PasswordField from '../../components/Form/PasswordField';

const ORANGE_COLOR = '#FF9500';

interface ChangePasswordScreenProps {
  navigation: NavigationProp;
}

const ChangePasswordScreen: React.FC<ChangePasswordScreenProps> = ({ navigation }) => {
  const { axiosInstance, userData } = useAuth();
  
  const [formData, setFormData] = useState<PasswordChangeForm>({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  
  const [loading, setLoading] = useState<boolean>(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    navigation.setOptions({
      title: 'Change Password',
    });
  }, [navigation]);

  const validateForm = (): boolean => {
    const validationRules = {
      current_password: FormValidation.commonRules.required(),
      new_password: FormValidation.commonRules.password(8),
      confirm_password: FormValidation.commonRules.confirmPassword(formData.new_password),
    };

    const result: ValidationResult = FormValidation.validateForm(formData, validationRules);
    setErrors(result.errors);
    return result.isValid;
  };

  const handleChange = (field: keyof PasswordChangeForm, value: string): void => {
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

  const handleSubmit = async (): Promise<void> => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const userId = userData?.userId || userData?.id;

      if (userId) {
        // Try updating through profile endpoint
        await axiosInstance.patch(`/profile/${userId}/`, {
          password: formData.new_password,
          password_confirm: formData.confirm_password,
          current_password: formData.current_password
        });
      } else {
        // Fallback to auth endpoint
        await axiosInstance.post('/auth/password/change/', {
          old_password: formData.current_password,
          new_password1: formData.new_password,
          new_password2: formData.confirm_password,
        });
      }

      Alert.alert(
        'Success',
        'Password changed successfully',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (err: any) {
      console.error('Error changing password:', err);

      if (err.response?.data) {
        // Format API validation errors
        const apiErrors: Record<string, string> = {};

        // Handle different error field names
        if (err.response.data.old_password) {
          apiErrors.current_password = Array.isArray(err.response.data.old_password) 
            ? err.response.data.old_password[0] 
            : err.response.data.old_password;
        }
        if (err.response.data.current_password) {
          apiErrors.current_password = Array.isArray(err.response.data.current_password) 
            ? err.response.data.current_password[0] 
            : err.response.data.current_password;
        }

        if (err.response.data.new_password1) {
          apiErrors.new_password = Array.isArray(err.response.data.new_password1) 
            ? err.response.data.new_password1[0] 
            : err.response.data.new_password1;
        }
        if (err.response.data.password) {
          apiErrors.new_password = Array.isArray(err.response.data.password) 
            ? err.response.data.password[0] 
            : err.response.data.password;
        }

        if (err.response.data.new_password2) {
          apiErrors.confirm_password = Array.isArray(err.response.data.new_password2) 
            ? err.response.data.new_password2[0] 
            : err.response.data.new_password2;
        }
        if (err.response.data.password_confirm) {
          apiErrors.confirm_password = Array.isArray(err.response.data.password_confirm) 
            ? err.response.data.password_confirm[0] 
            : err.response.data.password_confirm;
        }

        if (err.response.data.non_field_errors) {
          const message = Array.isArray(err.response.data.non_field_errors) 
            ? err.response.data.non_field_errors[0] 
            : err.response.data.non_field_errors;
          Alert.alert('Error', message);
        }

        setErrors(apiErrors);
      } else {
        Alert.alert('Error', 'Failed to change password. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidView}
      >
        <ScrollView>
          <View style={styles.formContainer}>
            <View style={styles.infoContainer}>
              <Ionicons name="information-circle-outline" size={24} color="#666" />
              <Text style={styles.infoText}>
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
                <ActivityIndicator size="large" color={ORANGE_COLOR} />
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => navigation.goBack()}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.saveButton}
                    onPress={handleSubmit}
                  >
                    <Text style={styles.saveButtonText}>Update Password</Text>
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
    backgroundColor: '#FFFFFF',
  },
  keyboardAvoidView: {
    flex: 1,
  },
  formContainer: {
    padding: 20,
  },
  infoContainer: {
    flexDirection: 'row',
    backgroundColor: '#F9F9F9',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 10,
    flex: 1,
    lineHeight: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 30,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F2F2F2',
    padding: 15,
    borderRadius: 8,
    marginRight: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  saveButton: {
    flex: 1,
    backgroundColor: ORANGE_COLOR,
    padding: 15,
    borderRadius: 8,
    marginLeft: 10,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default ChangePasswordScreen;