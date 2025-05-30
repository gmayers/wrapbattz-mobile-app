import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  SafeAreaView,
  StatusBar,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../context/AuthContext'; // Adjust path as needed

const SuggestFeatureScreen = ({ navigation }) => {
  const { mobileService, getApiKey, mobileApiInstance } = useAuth();
  const [featureSuggestion, setFeatureSuggestion] = useState('');
  const [feedbackText, setFeedbackText] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiKeyLoaded, setApiKeyLoaded] = useState(false);

  // Check if API key is available on component mount
  useEffect(() => {
    const checkApiKey = async () => {
      try {
        const key = await getApiKey();
        console.log("API Key in SuggestFeatureScreen:", key);
        
        if (key) {
          setApiKeyLoaded(true);
        } else {
          Alert.alert(
            'Configuration Error',
            'API key not found. Please restart the app or contact support.',
            [{ text: 'OK', onPress: () => navigation.goBack() }]
          );
        }
      } catch (error) {
        console.error('Error checking API key:', error);
        Alert.alert(
          'Error',
          'Failed to verify app configuration. Please try again later.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      }
    };

    checkApiKey();
  }, []);

  // Form validation
  const validateForm = () => {
    if (!featureSuggestion.trim()) {
      Alert.alert('Missing Information', 'Please describe the feature you would like to see.');
      return false;
    }
    
    if (email && !isValidEmail(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address or leave it blank.');
      return false;
    }
    
    return true;
  };

  // Simple email validation
  const isValidEmail = (email) => {
    return /\S+@\S+\.\S+/.test(email);
  };

  // Handle form submission
  const handleSubmit = async () => {
    Keyboard.dismiss(); // Dismiss the keyboard
    
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    
    try {
      // Get the API key directly before submission
      const apiKey = await getApiKey();
      console.log("Using API key for submission:", apiKey);
      
      // Format data according to the API schema
      const suggestionData = {
        feature_description: featureSuggestion.trim(),
        additional_feedback: feedbackText.trim() || null,
        name: name.trim() || null,
        email: email.trim() || null,
      };
      
      console.log("Submitting data:", JSON.stringify(suggestionData));
      
      // Manual approach with direct API key usage
      const response = await mobileApiInstance.post('/mobile/feature-suggestions/', suggestionData, {
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json',
        }
      });
      
      console.log("API Response:", response.status, response.data);
      
      // Show success message
      Alert.alert(
        'Thank You!',
        'Your feature suggestion has been submitted successfully. We appreciate your feedback!',
        [
          { 
            text: 'OK', 
            onPress: () => {
              // Clear form and navigate back
              resetForm();
              navigation.goBack();
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error submitting feature suggestion:', error);
      console.error('Error details:', error.response?.data);
      
      let errorMessage = 'Failed to submit your suggestion. Please try again.';
      if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset form fields
  const resetForm = () => {
    setFeatureSuggestion('');
    setFeedbackText('');
    setName('');
    setEmail('');
  };

  const handleCancel = () => {
    Keyboard.dismiss(); // Dismiss keyboard before navigation
    navigation.goBack();
  };

  // Show loading indicator while API key is being checked
  if (!apiKeyLoaded) {
    return (
      <SafeAreaView style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#FF7700" />
        <Text style={styles.loadingText}>Initializing...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerContainer}>
            <Text style={styles.headerTitle}>Suggest a Feature</Text>
            <Text style={styles.headerSubtitle}>
              Help us improve BattWrapz by suggesting new features or providing feedback on existing ones.
            </Text>
          </View>

          <View style={styles.formContainer}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Feature Suggestion*</Text>
              <TextInput
                style={styles.textArea}
                placeholder="Describe the feature you would like to see..."
                placeholderTextColor="#999"
                multiline
                numberOfLines={5}
                value={featureSuggestion}
                onChangeText={setFeatureSuggestion}
                textAlignVertical="top" // Ensure text starts from the top
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Additional Feedback</Text>
              <TextInput
                style={styles.textArea}
                placeholder="Any other feedback or suggestions?"
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
                value={feedbackText}
                onChangeText={setFeedbackText}
                textAlignVertical="top" // Ensure text starts from the top
              />
            </View>

            <View style={styles.contactSection}>
              <Text style={styles.sectionTitle}>Contact Information (Optional)</Text>
              <Text style={styles.sectionSubtitle}>
                Include your contact details if you'd like us to follow up with you about your suggestion.
              </Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Name</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Your name"
                  placeholderTextColor="#999"
                  value={name}
                  onChangeText={setName}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Your email address"
                  placeholderTextColor="#999"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>
            </View>

            <View style={styles.buttonContainer}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={handleCancel}
                disabled={isSubmitting}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.submitButton, 
                  isSubmitting && styles.submitButtonDisabled
                ]}
                onPress={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>Submit Feedback</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// Existing styles...
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  keyboardAvoidView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 100, // Extra padding at the bottom to ensure buttons stay visible
  },
  headerContainer: {
    backgroundColor: '#FF7700',
    padding: 20,
    paddingTop: 30,
    paddingBottom: 30,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 20,
  },
  formContainer: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    height: 50, // Fixed height for text inputs
  },
  textArea: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    minHeight: 120,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    textAlignVertical: 'top', // Ensure text starts from the top
  },
  contactSection: {
    marginTop: 10,
    marginBottom: 20,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#777',
    marginBottom: 15,
    lineHeight: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 30, // Add more bottom margin
  },
  submitButton: {
    backgroundColor: '#FF7700',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flex: 3,
    alignItems: 'center',
    justifyContent: 'center',
    height: 50, // Fixed height for consistent appearance
  },
  submitButtonDisabled: {
    backgroundColor: '#FFAA66',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flex: 1,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DDDDDD',
    height: 50, // Fixed height for consistent appearance
  },
  cancelButtonText: {
    color: '#666666',
    fontSize: 16,
  },
});

export default SuggestFeatureScreen;