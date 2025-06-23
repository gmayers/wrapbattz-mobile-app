// src/components/Form/PasswordField.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FormFieldProps } from '../../types';

interface PasswordFieldProps extends Omit<FormFieldProps, 'secureTextEntry'> {
  showToggle?: boolean;
}

const PasswordField: React.FC<PasswordFieldProps> = ({
  label,
  value,
  onChangeText,
  placeholder = 'Enter password',
  error,
  required = false,
  editable = true,
  showToggle = true,
}) => {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const togglePasswordVisibility = () => {
    setIsPasswordVisible(!isPasswordVisible);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {label} {required && <Text style={styles.required}>*</Text>}
      </Text>
      <View style={[styles.inputContainer, error && styles.inputError]}>
        <TextInput
          style={[styles.input, !editable && styles.inputDisabled]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#999"
          secureTextEntry={!isPasswordVisible}
          editable={editable}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {showToggle && (
          <TouchableOpacity
            style={styles.toggleButton}
            onPress={togglePasswordVisibility}
            disabled={!editable}
          >
            <Ionicons
              name={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
              size={24}
              color={editable ? '#666' : '#999'}
            />
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  required: {
    color: '#FF9500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#F9F9F9',
  },
  input: {
    flex: 1,
    height: 48,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#333',
  },
  inputDisabled: {
    backgroundColor: '#F0F0F0',
    color: '#666',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  toggleButton: {
    padding: 12,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    marginTop: 5,
  },
});

export default PasswordField;