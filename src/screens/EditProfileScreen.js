// EditProfileScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { normalizeFormError } from '../api/errors';
import { requestEmailChange, confirmEmailChange } from '../api/endpoints/account';

// Fields this screen renders an error slot for. Anything else has to be
// alerted, or the failure never reaches the user.
const RENDERED_FIELDS = ['first_name', 'last_name', 'email', 'phone_number'];

const EditProfileScreen = ({ navigation, route }) => {
  const { updateUser, refreshUser, user } = useAuth();
  const { colors } = useTheme();
  
  // Get profile data from route params; fall back to the current user so
  // fields aren't blank when navigating here from Settings without params.
  const initialProfileData = route.params?.profileData || {};

  const seedFromUser = (u) => ({
    first_name: u?.first_name || '',
    last_name: u?.last_name || '',
    phone_number: u?.phone_number || '',
    email: u?.email || '',
  });

  const [formData, setFormData] = useState(() => {
    const fromParams = {
      first_name: initialProfileData.first_name || '',
      last_name: initialProfileData.last_name || '',
      phone_number: initialProfileData.phone_number || '',
      email: initialProfileData.email || '',
    };
    // If route params provided at least an email, use them; otherwise seed from user.
    if (fromParams.email) return fromParams;
    return seedFromUser(user);
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Verified email-change flow: once /account/email/change/ has sent a
  // code, the form is replaced with a code-entry step that calls
  // /account/email/confirm/. pendingEmail records the address the code
  // was sent to, so the confirmation copy stays correct even if the
  // user later edits formData.email again (they can't — the field is
  // hidden while pendingEmailChange is true, but this avoids relying on
  // stale closures either way).
  const [pendingEmailChange, setPendingEmailChange] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [confirming, setConfirming] = useState(false);

  // If user loads asynchronously after mount, seed the form — but only when
  // email is still empty (consistent with the lazy initializer's discriminator;
  // don't clobber in-progress edits).
  useEffect(() => {
    if (!user) return;
    setFormData((prev) => {
      if (prev.email) return prev;
      return seedFromUser(user);
    });
  }, [user]);

  useEffect(() => {
    navigation.setOptions({
      title: 'Edit Profile'
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
      [field]: value
});
    
    // Clear error for this field
    if (errors[field]) {
      setErrors({
        ...errors,
        [field]: null
});
    }
  };
  
  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // Email is never sent here — the new /account/ endpoint rejects it
      // silently (UserUpdate has no email field), and mutating the address
      // requires the verified email-change flow below.
      await updateUser({
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone_number: formData.phone_number,
      });
    } catch (err) {
      const { fieldErrors, message } = normalizeFormError(err, 'Failed to update profile');

      const inlineErrors = {};
      const unrenderable = [];
      Object.entries(fieldErrors).forEach(([key, value]) => {
        if (RENDERED_FIELDS.includes(key)) inlineErrors[key] = value;
        else unrenderable.push(value);
      });

      setErrors(inlineErrors);

      if (Object.keys(inlineErrors).length === 0) {
        Alert.alert('Error', unrenderable.join('\n') || message);
      }
      setLoading(false);
      return;
    }

    const trimmedEmail = formData.email.trim();
    const currentEmail = (user?.email || '').trim();
    const emailChanged = trimmedEmail.toLowerCase() !== currentEmail.toLowerCase();

    if (!emailChanged) {
      setLoading(false);
      Alert.alert(
        'Success',
        'Profile updated successfully',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
      return;
    }

    try {
      // Step 1 of the verified flow: request a code to the new mailbox.
      // The address only changes once that code is confirmed below.
      await requestEmailChange({ new_email: trimmedEmail });
      setPendingEmail(trimmedEmail);
      setPendingEmailChange(true);
    } catch (err) {
      // Rate-limited (429) and validation failures (already in use, same
      // as current, etc.) all arrive as a friendly `message` with no
      // matching form field — show them against the email field, the
      // existing inline-error slot for this screen.
      const { message } = normalizeFormError(err, 'Failed to send verification code');
      setErrors((prev) => ({ ...prev, email: message }));
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmCode = async () => {
    if (!code.trim()) {
      setCodeError('Enter the 6-digit code');
      return;
    }

    setConfirming(true);
    setCodeError('');

    try {
      // Step 2: presenting the code finalizes the change server-side.
      await confirmEmailChange({ code: code.trim() });
      await refreshUser();
      setPendingEmailChange(false);
      setCode('');

      Alert.alert(
        'Success',
        'Profile updated successfully',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (err) {
      // Invalid/expired/locked codes and the confirm endpoint's own
      // rate limit all surface here with a friendly `message`.
      const { message } = normalizeFormError(err, 'Failed to confirm email change');
      setCodeError(message);
    } finally {
      setConfirming(false);
    }
  };

  const handleCancelEmailChange = () => {
    // Nothing has changed server-side yet — the address only mutates on a
    // confirmed code — so this just returns to the editable form.
    setPendingEmailChange(false);
    setCode('');
    setCodeError('');
  };
  
  if (pendingEmailChange) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoidView}
        >
          <ScrollView>
            <View style={styles.formContainer}>
              <Text style={[styles.label, { color: colors.textPrimary }]}>
                Enter the code we sent to {pendingEmail}
              </Text>

              <View style={styles.formGroup}>
                <TextInput
                  testID="email-code-input"
                  style={[
                    styles.input,
                    { borderColor: colors.border, backgroundColor: colors.surface, color: colors.textPrimary },
                    codeError ? { borderColor: colors.error } : null,
                  ]}
                  value={code}
                  onChangeText={(text) => {
                    setCode(text);
                    if (codeError) setCodeError('');
                  }}
                  placeholder="6-digit code"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  maxLength={6}
                />
                {codeError ? (
                  <Text style={[styles.errorText, { color: colors.error }]}>{codeError}</Text>
                ) : null}
              </View>

              <View style={styles.buttonContainer}>
                {confirming ? (
                  <ActivityIndicator size="large" color={colors.primary} />
                ) : (
                  <>
                    <TouchableOpacity
                      testID="cancel-code-button"
                      style={[styles.cancelButton, { backgroundColor: colors.surfaceAlt }]}
                      onPress={handleCancelEmailChange}
                    >
                      <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>Cancel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      testID="confirm-code-button"
                      style={[styles.saveButton, { backgroundColor: colors.primary }]}
                      onPress={handleConfirmCode}
                    >
                      <Text style={styles.saveButtonText}>Confirm</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidView}
      >
        <ScrollView>
          <View style={styles.formContainer}>
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.textPrimary }]}>First Name</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.textPrimary }, errors.first_name ? { borderColor: colors.error } : null]}
                value={formData.first_name}
                onChangeText={(text) => handleChange('first_name', text)}
                placeholder="Enter your first name"
                placeholderTextColor={colors.textMuted}
              />
              {errors.first_name ? (
                <Text style={[styles.errorText, { color: colors.error }]}>{errors.first_name}</Text>
              ) : null}
            </View>
            
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.textPrimary }]}>Last Name</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.textPrimary }, errors.last_name ? { borderColor: colors.error } : null]}
                value={formData.last_name}
                onChangeText={(text) => handleChange('last_name', text)}
                placeholder="Enter your last name"
                placeholderTextColor={colors.textMuted}
              />
              {errors.last_name ? (
                <Text style={[styles.errorText, { color: colors.error }]}>{errors.last_name}</Text>
              ) : null}
            </View>
            
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.textPrimary }]}>Email</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.textPrimary }, errors.email ? { borderColor: colors.error } : null]}
                value={formData.email}
                onChangeText={(text) => handleChange('email', text)}
                placeholder="Enter your email"
                placeholderTextColor={colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              {errors.email ? (
                <Text style={[styles.errorText, { color: colors.error }]}>{errors.email}</Text>
              ) : null}
            </View>
            
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.textPrimary }]}>Phone Number (Optional)</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.textPrimary }, errors.phone_number ? { borderColor: colors.error } : null]}
                value={formData.phone_number}
                onChangeText={(text) => handleChange('phone_number', text.replace(/[^0-9+\s-]/g, ''))}
                placeholder="Enter your phone number"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
                maxLength={11}
              />
              {errors.phone_number ? (
                <Text style={[styles.errorText, { color: colors.error }]}>{errors.phone_number}</Text>
              ) : null}
            </View>
            
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
    flex: 1
},
  keyboardAvoidView: {
    flex: 1
},
  formContainer: {
    padding: 20
},
  formGroup: {
    marginBottom: 20
},
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8
},
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16
},
  inputError: {
  },
  errorText: {
    fontSize: 14,
    marginTop: 5
},
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 30
},
  cancelButton: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    marginRight: 10,
    alignItems: 'center'
},
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600'
},
  saveButton: {
    flex: 1,
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

export default EditProfileScreen;