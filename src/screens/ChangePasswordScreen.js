// ChangePasswordScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

// Orange color to match existing UI
const ORANGE_COLOR = '#FF9500';

const ChangePasswordScreen = ({ navigation }) => {
  const { axiosInstance } = useAuth();
  
  const [formData, setFormData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [passwordVisible, setPasswordVisible] = useState({
    current_password: false,
    new_password: false,
    confirm_password: false,
  });
  
  useEffect(() => {
    navigation.setOptions({
      title: 'Change Password',
    });
  }, [navigation]);
  
  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.current_password) {
      newErrors.current_password = 'Current password is required';
    }
    
    if (!formData.new_password) {
      newErrors.new_password = 'New password is required';
    } else if (formData.new_password.length < 8) {
      newErrors.new_password = 'Password must be at least 8 characters';
    }
    
    if (!formData.confirm_password) {
      newErrors.confirm_password = 'Please confirm your password';
    } else if (formData.new_password !== formData.confirm_password) {
      newErrors.confirm_password = 'Passwords do not match';
    }
    
    setErrors(newErrors);
    
    return Object.keys(newErrors).length === 0;
  };
  
  const handleChange = (field, value) => {
    setFormData({
      ...formData,
      [field]: value,
    });
    
    // Clear error for this field
    if (errors[field]) {
      setErrors({
        ...errors,
        [field]: null,
      });
    }
  };
  
  const togglePasswordVisibility = (field) => {
    setPasswordVisible({
      ...passwordVisible,
      [field]: !passwordVisible[field],
    });
  };
  
  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    
    try {
      // Call the password change endpoint
      await axiosInstance.post('/auth/password/change/', {
        old_password: formData.current_password,
        new_password1: formData.new_password,
        new_password2: formData.confirm_password,
      });
      
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
    } catch (err) {
      console.error('Error changing password:', err);
      
      if (err.response?.data) {
        // Format API validation errors
        const apiErrors = {};
        
        if (err.response.data.old_password) {
          apiErrors.current_password = err.response.data.old_password[0];
        }
        
        if (err.response.data.new_password1) {
          apiErrors.new_password = err.response.data.new_password1[0];
        }
        
        if (err.response.data.new_password2) {
          apiErrors.confirm_password = err.response.data.new_password2[0];
        }
        
        if (err.response.data.non_field_errors) {
          Alert.alert('Error', err.response.data.non_field_errors[0]);
        }
        
        setErrors(apiErrors);
      } else {
        Alert.alert('Error', 'Failed to change password');
      }
    } finally {
      setLoading(false);
    }
  };
  
  const renderPasswordInput = (field, placeholder) => (
    <View style={styles.passwordContainer}>
      <TextInput
        style={[
          styles.passwordInput,
          errors[field] ? styles.inputError : null,
        ]}
        value={formData[field]}
        onChangeText={(text) => handleChange(field, text)}
        placeholder={placeholder}
        secureTextEntry={!passwordVisible[field]}
      />
      <TouchableOpacity
        style={styles.visibilityToggle}
        onPress={() => togglePasswordVisibility(field)}
      >
        <Ionicons
          name={passwordVisible[field] ? 'eye-off-outline' : 'eye-outline'}
          size={24}
          color="#666"
        />
      </TouchableOpacity>
    </View>
  );
  
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
            
            <View style={styles.formGroup}>
              <Text style={styles.label}>Current Password</Text>
              {renderPasswordInput('current_password', 'Enter your current password')}
              {errors.current_password ? (
                <Text style={styles.errorText}>{errors.current_password}</Text>
              ) : null}
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.label}>New Password</Text>
              {renderPasswordInput('new_password', 'Enter your new password')}
              {errors.new_password ? (
                <Text style={styles.errorText}>{errors.new_password}</Text>
              ) : null}
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.label}>Confirm New Password</Text>
              {renderPasswordInput('confirm_password', 'Confirm your new password')}
              {errors.confirm_password ? (
                <Text style={styles.errorText}>{errors.confirm_password}</Text>
              ) : null}
            </View>
            
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
            
            <TouchableOpacity
              style={styles.forgotPasswordButton}
              onPress={() => navigation.navigate('ForgotPassword')}
            >
              <Text style={styles.forgotPasswordText}>Forgot your password?</Text>
            </TouchableOpacity>
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
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#F9F9F9',
  },
  passwordInput: {
    flex: 1,
    padding: 12,
    fontSize: 16,
  },
  visibilityToggle: {
    padding: 12,
  },
  inputError: {
    borderColor: '#EF4444',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    marginTop: 5,
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
  forgotPasswordButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  forgotPasswordText: {
    fontSize: 16,
    color: ORANGE_COLOR,
    textDecorationLine: 'underline',
  },
});

export default ChangePasswordScreen;