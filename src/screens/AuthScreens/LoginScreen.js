// LoginScreen.js
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
import AsyncStorage from '@react-native-async-storage/async-storage';
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
      const response = await fetch('https://test.gmayersservices.com/api/auth/token/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle specific error messages from the server
        const errorMessage = data.detail || data.message || 'Invalid credentials';
        Alert.alert(
          'Login Failed',
          errorMessage
        );
        return;
      }

      if (!data.access || !data.refresh) {
        Alert.alert(
          'Login Failed',
          'Invalid response from server - missing tokens'
        );
        return;
      }

      await AsyncStorage.multiSet([
        ['accessToken', data.access],
        ['refreshToken', data.refresh]
      ]);

      await login(email, password);
      
    } catch (error) {
      console.error('Login error:', error);
      
      // Network or other errors
      Alert.alert(
        'Connection Error',
        'Unable to connect to the server. Please check your internet connection and try again.'
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
                onChangeText={setEmail}
                error={emailError}
                placeholder="Enter your email"
                testID="email-input"
                returnKeyType="next"
                onSubmitEditing={() => passwordInputRef.current?.focus()}
              />

              <PasswordInput
                ref={passwordInputRef}
                value={password}
                onChangeText={setPassword}
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
  },
  forgotPassword: {
    alignItems: 'center',
    marginTop: 20,
  },
  forgotPasswordText: {
    color: '#007AFF',
    fontSize: 16,
  },
});

export default LoginScreen;