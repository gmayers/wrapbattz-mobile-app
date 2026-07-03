// screens/OnboardingScreens/CreateOrganizationScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import FormField from '../components/Form/FormField';
import { organizations as organizationsApi } from '../api/endpoints';
import { ApiError } from '../api/errors';

const CreateOrganizationScreen = ({ navigation, route }) => {
  const { updateOnboarding, refreshUser, isLoading, logout } = useAuth();
  const { colors } = useTheme();

  const isEditMode = route?.params?.mode === 'edit';

  // Form state
  const [name, setName] = useState('');
  const [tradingName, setTradingName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [county, setCounty] = useState('');
  const [postcode, setPostcode] = useState('');

  // Validation state
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [loadingOrg, setLoadingOrg] = useState(false);

  // In edit mode, prefill the form with the existing organization data
  useEffect(() => {
    if (!isEditMode) return;
    let cancelled = false;
    const fetchOrg = async () => {
      setLoadingOrg(true);
      try {
        const org = await organizationsApi.getMyOrganization();
        if (cancelled) return;
        setName(org.name ?? '');
        setTradingName(org.trading_name ?? '');
        setEmail(org.email ?? '');
        setPhone(org.phone ?? '');
        setWebsite(org.website ?? '');
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof ApiError ? err.message : 'Failed to load organization details.';
        Alert.alert('Error', msg);
      } finally {
        if (!cancelled) setLoadingOrg(false);
      }
    };
    fetchOrg();
    return () => { cancelled = true; };
  }, [isEditMode]);
  
  // Form validation
  const validateForm = () => {
    let isValid = true;
    let formErrors = {};
    
    // Validate required fields
    if (!name.trim()) {
      formErrors.name = 'Organization name is required';
      isValid = false;
    }

    // Address fields are only collected (and required) during the create/onboarding flow.
    // In edit mode they are not stored on the org and not validated.
    if (!isEditMode) {
      if (!addressLine1.trim()) {
        formErrors.addressLine1 = 'Address line 1 is required';
        isValid = false;
      }

      if (!city.trim()) {
        formErrors.city = 'City/Town is required';
        isValid = false;
      }

      if (!postcode.trim()) {
        formErrors.postcode = 'Postcode is required';
        isValid = false;
      } else {
        // Simple UK postcode validation
        const postcodeRegex = /^[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}$/i;
        if (!postcodeRegex.test(postcode)) {
          formErrors.postcode = 'Please enter a valid UK postcode';
          isValid = false;
        }
      }
    }
    
    // Email validation if provided
    if (email && !/\S+@\S+\.\S+/.test(email)) {
      formErrors.email = 'Please enter a valid email address';
      isValid = false;
    }
    
    // Phone validation if provided - More flexible phone validation
    if (phone && phone.trim() && !/^[\d\+\-\(\) ]{10,15}$/.test(phone.replace(/\s/g, ''))) {
      formErrors.phone = 'Please enter a valid phone number';
      isValid = false;
    }
    
    // Website validation if provided - More flexible
    if (website && website.trim() && !(/^https?:\/\/.+/.test(website))) {
      formErrors.website = 'Website must start with http:// or https://';
      isValid = false;
    }
    
    setErrors(formErrors);
    return isValid;
  };
  
  // Handle form submission
  const handleSubmit = async () => {
    console.log(isEditMode ? '=== UPDATE ORGANIZATION SUBMIT ===' : '=== CREATE ORGANIZATION SUBMIT ===');
    console.log('Starting form submission...');

    if (!validateForm()) {
      console.log('Form validation failed');
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        name: name.trim(),
        trading_name: tradingName.trim() || '',
        email: email.trim() || null,
        phone: phone.trim() || '',
        website: website.trim() || '',
      };

      if (isEditMode) {
        // PATCH existing organization
        await organizationsApi.updateMyOrganization(payload);
        Alert.alert('Saved', 'Your organization details have been updated.', [
          { text: 'OK', onPress: () => { if (navigation.canGoBack()) navigation.goBack(); } },
        ]);
      } else {
        // POST new organization (onboarding flow)
        await organizationsApi.createOrganization(payload);
        await updateOnboarding({ has_completed_onboarding: true });
        await refreshUser();
        Alert.alert(
          'Success',
          'Your organization has been created successfully!',
          [{
            text: 'Continue',
            onPress: () => {
              console.log('Navigating to Dashboard...');
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.replace('Dashboard');
              }
            },
          }]
        );
      }
    } catch (error) {
      const defaultMsg = isEditMode
        ? 'Failed to update organization. Please try again.'
        : 'Failed to create organization. Please try again.';
      let errorMessage = defaultMsg;

      if (error instanceof ApiError) {
        const detail = error.detail;
        if (detail && typeof detail === 'object') {
          const errorMessages = Object.entries(detail).map(([key, value]) => {
            if (Array.isArray(value)) return `${key}: ${value.join(', ')}`;
            if (typeof value === 'string') return `${key}: ${value}`;
            return `${key}: ${JSON.stringify(value)}`;
          });
          if (errorMessages.length > 0) errorMessage = errorMessages.join('\n');
        } else if (error.message) {
          errorMessage = error.message;
        }
      } else if (error?.message) {
        errorMessage = error.message;
      }

      Alert.alert('Error', errorMessage);
    } finally {
      setSubmitting(false);
    }
  };
  
  const isFormLoading = isLoading || submitting || loadingOrg;
  
  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 25}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
          bounces={false}
        >
        <View style={styles.header}>
          {!isEditMode && (
            <Text style={[styles.stepIndicator, { color: colors.primary }]}>Step 2 of 2</Text>
          )}
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {isEditMode ? 'Organization Details' : 'Create Your Organization'}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {isEditMode
              ? 'Update your organization information below.'
              : 'Your organization is your workspace in TOOLTRAQ. All your devices, locations, and team members will be managed under this organization.'}
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Organization Details</Text>
          <Text style={styles.sectionDescription}>
            Enter your company or business details. This information will appear on reports and is used to identify your organization.
          </Text>

          <FormField
            label="Organization Name"
            value={name}
            onChangeText={setName}
            placeholder="Enter organization name"
            error={errors.name}
            required={true}
            editable={!isFormLoading}
          />

          <FormField
            label="Trading Name"
            value={tradingName}
            onChangeText={setTradingName}
            placeholder="Trading name (if different)"
            editable={!isFormLoading}
          />

          <FormField
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="Organization email address"
            error={errors.email}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!isFormLoading}
          />

          <FormField
            label="Phone"
            value={phone}
            onChangeText={setPhone}
            placeholder="Organization phone number"
            error={errors.phone}
            keyboardType="phone-pad"
            editable={!isFormLoading}
          />

          <FormField
            label="Website"
            value={website}
            onChangeText={setWebsite}
            placeholder="https://example.com"
            error={errors.website}
            keyboardType="url"
            autoCapitalize="none"
            editable={!isFormLoading}
          />
        </View>

        {!isEditMode && (
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Registered Address</Text>
            <Text style={styles.sectionDescription}>
              Your business address is used for billing and compliance purposes. This can be updated later from your organization settings.
            </Text>

            <FormField
              label="Address Line 1"
              value={addressLine1}
              onChangeText={setAddressLine1}
              placeholder="Street address, P.O. box, etc."
              error={errors.addressLine1}
              required={true}
              editable={!isFormLoading}
            />

            <FormField
              label="Address Line 2"
              value={addressLine2}
              onChangeText={setAddressLine2}
              placeholder="Apartment, suite, unit, building, floor, etc."
              editable={!isFormLoading}
            />

            <FormField
              label="City/Town"
              value={city}
              onChangeText={setCity}
              placeholder="City or town"
              error={errors.city}
              required={true}
              editable={!isFormLoading}
            />

            <FormField
              label="County"
              value={county}
              onChangeText={setCounty}
              placeholder="County"
              editable={!isFormLoading}
            />

            <FormField
              label="Postcode"
              value={postcode}
              onChangeText={setPostcode}
              placeholder="Postcode"
              error={errors.postcode}
              required={true}
              autoCapitalize="characters"
              editable={!isFormLoading}
            />
          </View>
        )}
        
        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: colors.primary }, isFormLoading && styles.disabledButton]}
          onPress={handleSubmit}
          disabled={isFormLoading}
        >
          {isFormLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.submitButtonText}>{isEditMode ? 'Save' : 'Create Organization'}</Text>
              <Ionicons name={isEditMode ? 'checkmark' : 'arrow-forward'} size={20} color="#fff" />
            </>
          )}
        </TouchableOpacity>
        
        <Text style={styles.noteText}>
          * Required fields
        </Text>

        {!isEditMode && (
          <TouchableOpacity
            style={styles.logoutLink}
            onPress={() => {
              Alert.alert(
                "Log Out",
                "Are you sure you want to log out?",
                [
                  { text: "Cancel", style: "cancel" },
                  { text: "Log Out", style: "destructive", onPress: logout }
                ]
              );
            }}
            disabled={isFormLoading}
          >
            <Ionicons name="log-out-outline" size={16} color="#666" />
            <Text style={styles.logoutLinkText}>Log out and try a different account</Text>
          </TouchableOpacity>
        )}

        {/* Debug info - remove in production */}
        {__DEV__ && (
          <View style={styles.debugInfo}>
            <Text style={styles.debugText}>Debug Info:</Text>
            <Text style={styles.debugText}>isLoading: {isLoading.toString()}</Text>
            <Text style={styles.debugText}>submitting: {submitting.toString()}</Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f9fa'
},
  container: {
    flex: 1
},
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 30
},
  header: {
    padding: 20,
    paddingTop: 10
},
  stepIndicator: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF5500',
    marginBottom: 8
},
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8
},
  subtitle: {
    fontSize: 15,
    color: '#666',
    marginBottom: 20,
    lineHeight: 22
},
  sectionDescription: {
    fontSize: 14,
    color: '#888',
    marginBottom: 16,
    lineHeight: 20
},
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
},
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16
},
  submitButton: {
    backgroundColor: '#FF5500', // Orange brand color
    borderRadius: 8,
    paddingVertical: 15,
    paddingHorizontal: 20,
    marginHorizontal: 20,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF5500',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4
},
  disabledButton: {
    opacity: 0.7
},
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8
},
  noteText: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    marginBottom: 20
},
  logoutLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
    paddingVertical: 10
},
  logoutLinkText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
    textDecorationLine: 'underline'
},
  debugInfo: {
    margin: 20,
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 5
},
  debugText: {
    fontSize: 12,
    color: '#666'
}
});

export default CreateOrganizationScreen;