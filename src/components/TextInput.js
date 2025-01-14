// components/TextInput/index.js
import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Base TextInput Component
const BaseTextInput = ({
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  autoCapitalize = 'none',
  secureTextEntry = false,
  error,
  label,
  containerStyle,
  inputStyle,
  rightComponent,
  onBlur,
  onFocus,
  testID,
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = (e) => {
    setIsFocused(true);
    onFocus?.(e);
  };

  const handleBlur = (e) => {
    setIsFocused(false);
    onBlur?.(e);
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.inputContainer,
          isFocused && styles.inputFocused,
          error && styles.inputError,
        ]}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#999"
          style={[styles.input, inputStyle]}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          onFocus={handleFocus}
          onBlur={handleBlur}
          testID={testID}
        />
        {rightComponent}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

// Email Input Component
const EmailInput = ({
  value,
  onChangeText,
  error,
  label = 'Email',
  containerStyle,
  ...props
}) => {
  return (
    <BaseTextInput
      value={value}
      onChangeText={onChangeText}
      placeholder="Enter your email"
      keyboardType="email-address"
      autoCapitalize="none"
      label={label}
      error={error}
      containerStyle={containerStyle}
      testID="email-input"
      rightComponent={
        <Ionicons
          name="mail"
          size={20}
          color="#999"
          style={styles.icon}
        />
      }
      {...props}
    />
  );
};

// Password Input Component
const PasswordInput = ({
  value,
  onChangeText,
  error,
  label = 'Password',
  containerStyle,
  placeholder = "Enter your password",
  ...props
}) => {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  return (
    <BaseTextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      secureTextEntry={!isPasswordVisible}
      label={label}
      error={error}
      containerStyle={containerStyle}
      testID="password-input"
      rightComponent={
        <TouchableOpacity
          onPress={() => setIsPasswordVisible(!isPasswordVisible)}
          style={styles.eyeButton}
          testID="toggle-password-visibility"
        >
          <Ionicons
            name={isPasswordVisible ? 'eye-off' : 'eye'}
            size={20}
            color="#999"
          />
        </TouchableOpacity>
      }
      {...props}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    minHeight: 48,
  },
  inputFocused: {
    borderColor: '#007AFF',
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#333',
  },
  icon: {
    marginRight: 16,
  },
  eyeButton: {
    padding: 10,
    marginRight: 6,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 12,
    marginTop: 4,
  },
});

export { BaseTextInput, EmailInput, PasswordInput };

// Usage Example:
/*
import { EmailInput, PasswordInput } from './components/TextInput';

const LoginForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  return (
    <View>
      <EmailInput
        value={email}
        onChangeText={setEmail}
        error={emailError}
      />
      
      <PasswordInput
        value={password}
        onChangeText={setPassword}
        error={passwordError}
      />
    </View>
  );
};
*/