import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  Alert,
} from 'react-native';
import { EmailInput } from '../../components/TextInput';
import Button from '../../components/Button';
import { useAuth } from '../../context/AuthContext'; // Import AuthContext

const ForgotPasswordPage = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { requestPasswordReset } = useAuth(); // Use auth context

  const validateEmail = () => {
    console.log('FP-1: Validating email:', email);
    if (!email) {
      const error = 'Email is required';
      console.log('FP-2: Validation error:', error);
      setEmailError(error);
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      const error = 'Please enter a valid email';
      console.log('FP-3: Validation error:', error);
      setEmailError(error);
      return false;
    }
    console.log('FP-4: Email validation successful');
    return true;
  };

  const handleSubmit = async () => {
    console.log('FP-5: Submit button pressed');
    if (!validateEmail()) {
      console.log('FP-6: Email validation failed, aborting submission');
      return;
    }

    setIsLoading(true);
    console.log('FP-7: Setting loading state to true');
    
    try {
      console.log('FP-8: Sending password reset request for email:', email);
      const response = await requestPasswordReset(email);

      console.log('FP-9: Password reset response received');
      console.log('FP-10: Response data:', JSON.stringify(response, null, 2));

      // Show success message
      Alert.alert(
        'Success',
        'If an account exists with this email, you will receive password reset instructions shortly.',
        [
          {
            text: 'OK',
            onPress: () => {
              console.log('FP-11: Success alert acknowledged, navigating back');
              navigation.goBack();
            },
          },
        ]
      );
    } catch (error) {
      console.error('FP-12: Password reset error:', error);
      console.error('FP-13: Error response status:', error.response?.status);
      console.error('FP-14: Error response data:', JSON.stringify(error.response?.data, null, 2));
      
      const errorMessage = error.message || 
                          error.response?.data?.detail || 
                          error.response?.data?.message || 
                          'An error occurred while sending reset instructions. Please try again.';
      
      console.error('FP-15: Displaying error message to user:', errorMessage);
      
      Alert.alert(
        'Error',
        errorMessage,
      );
    } finally {
      console.log('FP-16: Setting loading state to false');
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeContainer}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        enabled
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.content}>
            <View style={styles.logoContainer}>
              <Image
                source={require('../../../assets/logo.jpg')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>

            <View style={styles.formContainer}>
              <Text style={styles.title}>Forgot Password</Text>
              <Text style={styles.description}>
                Enter your email address and we'll send you instructions to reset your password.
              </Text>

              <EmailInput
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  setEmailError('');
                }}
                error={emailError}
                returnKeyType="send"
                onSubmitEditing={() => {
                  console.log('FP-19: Email input submit pressed');
                  handleSubmit();
                }}
                editable={!isLoading}
              />

              <Button
                title="Send Reset Instructions"
                onPress={handleSubmit}
                loading={isLoading}
                disabled={isLoading}
                style={styles.submitButton}
                textColor="black"
              />
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
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center', // Center content vertically
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    minHeight: '100%',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 200,
    height: 80,
  },
  formContainer: {
    width: '100%',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
    lineHeight: 22,
  },
  submitButton: {
    marginTop: 20,
    backgroundColor: 'orange',
  },
});

export default ForgotPasswordPage;