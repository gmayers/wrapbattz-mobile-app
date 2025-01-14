// components/Dropdown/index.js
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Modal } from 'react-native';
import { Picker } from '@react-native-picker/picker';

const Dropdown = ({
  // Required props
  value,
  onValueChange,
  items,
  
  // Optional props
  label,
  placeholder = 'Select an option',
  error,
  
  // Style props
  containerStyle,
  labelStyle,
  dropdownStyle,
  
  // Disabled state
  disabled = false,
  
  // Custom props
  testID,
}) => {
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  // Find the selected item's label
  const selectedLabel = items.find(item => item.value === value)?.label || placeholder;

  // Render different picker variants for iOS and Android
  const renderPicker = () => {
    if (Platform.OS === 'ios') {
      return (
        <Modal
          visible={isPickerVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setIsPickerVisible(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            onPress={() => setIsPickerVisible(false)}
            activeOpacity={1}
          >
            <View style={styles.modalContent}>
              <View style={styles.pickerHeader}>
                <TouchableOpacity onPress={() => setIsPickerVisible(false)}>
                  <Text style={styles.doneButton}>Done</Text>
                </TouchableOpacity>
              </View>
              <Picker
                selectedValue={value}
                onValueChange={(itemValue) => {
                  onValueChange(itemValue);
                  setIsPickerVisible(false);
                }}
                testID={testID}
              >
                {items.map((item) => (
                  <Picker.Item 
                    key={item.value} 
                    label={item.label} 
                    value={item.value}
                    color={disabled ? '#999' : '#000'}
                  />
                ))}
              </Picker>
            </View>
          </TouchableOpacity>
        </Modal>
      );
    }

    return (
      <View style={[styles.pickerContainer, dropdownStyle]}>
        <Picker
          selectedValue={value}
          onValueChange={onValueChange}
          enabled={!disabled}
          style={styles.picker}
          testID={testID}
        >
          {items.map((item) => (
            <Picker.Item 
              key={item.value} 
              label={item.label} 
              value={item.value}
              color={disabled ? '#999' : '#000'}
            />
          ))}
        </Picker>
      </View>
    );
  };

  const handlePress = () => {
    if (!disabled) {
      setIsPickerVisible(true);
      setIsFocused(true);
    }
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text style={[styles.label, labelStyle]}>
          {label}
        </Text>
      )}
      
      {Platform.OS === 'ios' ? (
        <TouchableOpacity
          onPress={handlePress}
          style={[
            styles.dropdownButton,
            isFocused && styles.focused,
            disabled && styles.disabled,
            error && styles.error,
          ]}
          disabled={disabled}
          activeOpacity={0.7}
        >
          <Text 
            style={[
              styles.selectedText,
              !value && styles.placeholderText,
              disabled && styles.disabledText,
            ]}
          >
            {selectedLabel}
          </Text>
        </TouchableOpacity>
      ) : (
        <View
          style={[
            styles.dropdownButton,
            isFocused && styles.focused,
            disabled && styles.disabled,
            error && styles.error,
          ]}
        >
          {renderPicker()}
        </View>
      )}

      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}

      {Platform.OS === 'ios' && renderPicker()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  dropdownButton: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    minHeight: 48,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  focused: {
    borderColor: '#007AFF',
  },
  disabled: {
    backgroundColor: '#F5F5F5',
    borderColor: '#E0E0E0',
  },
  error: {
    borderColor: '#FF3B30',
  },
  selectedText: {
    fontSize: 16,
    color: '#333',
  },
  placeholderText: {
    color: '#999',
  },
  disabledText: {
    color: '#999',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 12,
    marginTop: 4,
  },
  // Android specific styles
  pickerContainer: {
    overflow: 'hidden',
  },
  picker: {
    marginLeft: -16, // Compensate for container padding
    width: '110%',   // Ensure dropdown arrow is visible
    height: 48,
  },
  // iOS Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingBottom: Platform.OS === 'ios' ? 20 : 0, // Extra padding for iOS home indicator
  },
  pickerHeader: {
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    padding: 16,
    alignItems: 'flex-end',
    backgroundColor: '#f8f8f8',
  },
  doneButton: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default Dropdown;