// EditProfileScreen.js
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

const EditProfileScreen = ({ navigation, route }) => {
  const { updateUserProfile, user, userData } = useAuth();
  
  // Get profile data from route params or use empty object
  const initialProfileData = route.params?.profileData || {};
  
  const [formData, setFormData] = useState({
    first_name: initialProfileData.first_name || '',
    last_name: initialProfileData.last_name || '',
    phone_number: initialProfileData.phone_number || '',
    email: initialProfileData.email || user?.email || '',
  });
  
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  
  useEffect(() => {
    navigation.setOptions({
      title: 'Edit Profile',
    });
  }, [navigation]);
  
  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.first_name.trim()) {
      newErrors.first_name = 'First name is required';
    }
    
    if (!formData.last_name.trim()) {
      newErrors.last_name = 'Last name is required';
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
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
  
  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    
    try {
      const userId = userData?.userId || user?.id || initialProfileData.id;
      
      if (!userId) {
        throw new Error('User ID not found');
      }
      
      // Update profile using AuthContext method
      await updateUserProfile(userId, formData);
      
      Alert.alert(
        'Success',
        'Profile updated successfully',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (err) {
      console.error('Error updating profile:', err);
      
      if (err.response?.data) {
        // Format API validation errors
        const apiErrors = {};
        
        Object.keys(err.response.data).forEach((key) => {
          apiErrors[key] = err.response.data[key][0]; // Get first error message
        });
        
        setErrors(apiErrors);
      } else {
        Alert.alert('Error', 'Failed to update profile');
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
            <View style={styles.formGroup}>
              <Text style={styles.label}>First Name</Text>
              <TextInput
                style={[styles.input, errors.first_name ? styles.inputError : null]}
                value={formData.first_name}
                onChangeText={(text) => handleChange('first_name', text)}
                placeholder="Enter your first name"
              />
              {errors.first_name ? (
                <Text style={styles.errorText}>{errors.first_name}</Text>
              ) : null}
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.label}>Last Name</Text>
              <TextInput
                style={[styles.input, errors.last_name ? styles.inputError : null]}
                value={formData.last_name}
                onChangeText={(text) => handleChange('last_name', text)}
                placeholder="Enter your last name"
              />
              {errors.last_name ? (
                <Text style={styles.errorText}>{errors.last_name}</Text>
              ) : null}
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={[styles.input, errors.email ? styles.inputError : null]}
                value={formData.email}
                onChangeText={(text) => handleChange('email', text)}
                placeholder="Enter your email"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              {errors.email ? (
                <Text style={styles.errorText}>{errors.email}</Text>
              ) : null}
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.label}>Phone Number (Optional)</Text>
              <TextInput
                style={[styles.input, errors.phone_number ? styles.inputError : null]}
                value={formData.phone_number}
                onChangeText={(text) => handleChange('phone_number', text)}
                placeholder="Enter your phone number"
                keyboardType="phone-pad"
              />
              {errors.phone_number ? (
                <Text style={styles.errorText}>{errors.phone_number}</Text>
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
                    <Text style={styles.saveButtonText}>Save Changes</Text>
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
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#F9F9F9',
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
});

export default EditProfileScreen;