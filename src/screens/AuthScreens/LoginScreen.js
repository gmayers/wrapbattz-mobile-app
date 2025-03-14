import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Image,
  Alert
} from 'react-native';
import { EmailInput, PasswordInput } from '../../components/TextInput';
import Button from '../../components/Button';
import { useAuth } from '../../context/AuthContext';
import { useNavigation } from '@react-navigation/native';

const LoginScreen = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const passwordInputRef = useRef(null);
  const navigation = useNavigation();

  const validateForm = () => {
    let isValid = true;
    
    setEmailError('');
    setPasswordError('');

    if (!email) {
      setEmailError('Email is required');
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      setEmailError('Please enter a valid email');
      isValid = false;
    }

    if (!password) {
      setPasswordError('Password is required');
      isValid = false;
    } else if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      isValid = false;
    }

    return isValid;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      // Use the login function from AuthContext which now uses axios
      await login(email, password);
      
      // If login is successful, the AuthContext will handle the token storage
      // and state updates automatically
      
    } catch (error) {
      console.error('Login error:', error);
      
      let errorMessage = 'Unable to connect to the server. Please check your internet connection and try again.';
      
      // Handle different types of errors
      if (error.response) {
        // The server responded with a status code outside of 2xx
        errorMessage = error.response.data?.detail || 
                      error.response.data?.message || 
                      'Invalid credentials';
      } else if (error.request) {
        // The request was made but no response was received
        errorMessage = 'No response from server. Please check your internet connection.';
      } else if (error.message) {
        // Something happened in setting up the request
        errorMessage = error.message;
      }

      Alert.alert(
        'Login Failed',
        errorMessage
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            {/* Logo Section */}
            <View style={styles.logoContainer}>
              <Image
                source={require('../../../assets/logo.jpg')}
                style={styles.logo}
                resizeMode="contain"
              />
              <Text style={styles.welcomeText}>Welcome Back</Text>
              <Text style={styles.subtitleText}>Sign in to continue</Text>
            </View>

            {/* Form Section */}
            <View style={styles.formContainer}>
              <EmailInput
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  setEmailError(''); // Clear error when user types
                }}
                error={emailError}
                placeholder="Enter your email"
                testID="email-input"
                returnKeyType="next"
                onSubmitEditing={() => passwordInputRef.current?.focus()}
              />

              <PasswordInput
                ref={passwordInputRef}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  setPasswordError(''); // Clear error when user types
                }}
                error={passwordError}
                placeholder="Enter your password"
                testID="password-input"
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />

              <Button
                title="Sign In"
                onPress={handleLogin}
                loading={isLoading}
                textColor="black"
                style={styles.loginButton}
                testID="login-button"
              />

              <TouchableOpacity 
                style={styles.forgotPassword}
                testID="forgot-password-button"
                onPress={() => navigation.navigate('ForgotPassword')}
              >
                <Text style={styles.forgotPasswordText}>
                  Forgot Password?
                </Text>
              </TouchableOpacity>
              
              {/* Register Section */}
              <View style={styles.registerContainer}>
                <Text style={styles.registerText}>Don't have an account?</Text>
                <TouchableOpacity 
                  testID="register-button"
                  onPress={() => navigation.navigate('Register')}
                >
                  <Text style={styles.registerButtonText}>Create Account</Text>
                </TouchableOpacity>
              </View>
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
  keyboardView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 20,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitleText: {
    fontSize: 16,
    color: '#666',
  },
  formContainer: {
    width: '100%',
  },
  loginButton: {
    marginTop: 20,
    backgroundColor:'orange',
  },
  forgotPassword: {
    alignItems: 'center',
    marginTop: 20,
  },
  forgotPasswordText: {
    color: '#007AFF',
    fontSize: 16,
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },
  registerText: {
    fontSize: 16,
    color: '#666',
  },
  registerButtonText: {
    color: 'orange',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 5,
  },
});

export default LoginScreen;