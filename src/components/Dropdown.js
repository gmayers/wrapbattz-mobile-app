// components/Dropdown/index.js
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Modal, Animated, Dimensions } from 'react-native';
import { Picker } from '@react-native-picker/picker';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

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
  const [slideAnim] = useState(new Animated.Value(SCREEN_HEIGHT));
  const [overlayOpacity] = useState(new Animated.Value(0));

  // Find the selected item's label
  const selectedLabel = items.find(item => item.value === value)?.label || placeholder;

  // Enhanced animation functions for iOS
  const showModal = () => {
    setIsPickerVisible(true);
    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 65,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const hideModal = () => {
    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsPickerVisible(false);
      setIsFocused(false);
    });
  };

  // Render different picker variants for iOS and Android
  const renderPicker = () => {
    if (Platform.OS === 'ios') {
      return (
        <Modal
          visible={isPickerVisible}
          animationType="none"
          transparent={true}
          onRequestClose={hideModal}
          statusBarTranslucent={true}
        >
          <Animated.View 
            style={[
              styles.modalOverlay, 
              { 
                opacity: overlayOpacity,
                backgroundColor: 'rgba(0, 0, 0, 0.4)'
              }
            ]}
          >
            <TouchableOpacity
              style={styles.modalOverlayTouchable}
              onPress={hideModal}
              activeOpacity={1}
            />
            <Animated.View 
              style={[
                styles.modalContent,
                {
                  transform: [{ translateY: slideAnim }]
                }
              ]}
            >
              <View style={styles.pickerHeader}>
                <TouchableOpacity onPress={hideModal} style={styles.doneButtonContainer}>
                  <Text style={styles.doneButton}>Done</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={value}
                  onValueChange={(itemValue) => {
                    onValueChange(itemValue);
                    setTimeout(hideModal, 100); // Slight delay for better UX
                  }}
                  testID={testID}
                  style={styles.iosPicker}
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
              {/* Safe area bottom padding */}
              <View style={styles.safeAreaBottom} />
            </Animated.View>
          </Animated.View>
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
      setIsFocused(true);
      if (Platform.OS === 'ios') {
        showModal();
      } else {
        setIsPickerVisible(true);
      }
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
    marginLeft: -4, // Compensate for container padding
    width: '100%',   // Ensure dropdown arrow is visible
    height: 48,
  },
  // iOS Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalOverlayTouchable: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: SCREEN_HEIGHT * 0.6,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  pickerContainer: {
    paddingHorizontal: 16,
  },
  pickerHeader: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'flex-end',
    backgroundColor: '#F2F2F7',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  doneButtonContainer: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  doneButton: {
    color: '#007AFF',
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 22,
  },
  iosPicker: {
    height: 216, // Standard iOS picker height
  },
  safeAreaBottom: {
    height: Platform.OS === 'ios' ? 34 : 16, // iOS home indicator safe area
    backgroundColor: '#FFFFFF',
  },
});

export default Dropdown;