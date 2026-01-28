// components/Dropdown.js
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  FlatList,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const ORANGE_COLOR = '#FF9500';

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
  const hasValue = items.some(item => item.value === value);

  // Animation functions
  const showModal = () => {
    setIsPickerVisible(true);
    setIsFocused(true);
    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 65,
        friction: 10,
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

  const handleSelectItem = (itemValue) => {
    onValueChange(itemValue);
    hideModal();
  };

  const handlePress = () => {
    if (!disabled) {
      showModal();
    }
  };

  // Render item for the list
  const renderItem = ({ item }) => {
    const isSelected = item.value === value;
    return (
      <TouchableOpacity
        style={[
          styles.listItem,
          isSelected && styles.listItemSelected,
        ]}
        onPress={() => handleSelectItem(item.value)}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.listItemText,
            isSelected && styles.listItemTextSelected,
          ]}
        >
          {item.label}
        </Text>
        {isSelected && (
          <Ionicons name="checkmark" size={22} color={ORANGE_COLOR} />
        )}
      </TouchableOpacity>
    );
  };

  // Render the modal picker (same for both platforms)
  const renderPicker = () => {
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
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{label || 'Select Option'}</Text>
              <TouchableOpacity onPress={hideModal} style={styles.doneButtonContainer}>
                <Text style={styles.doneButton}>Done</Text>
              </TouchableOpacity>
            </View>

            {/* Options List */}
            <FlatList
              data={items}
              renderItem={renderItem}
              keyExtractor={(item) => item.key || item.value?.toString() || item.label}
              style={styles.optionsList}
              showsVerticalScrollIndicator={true}
              bounces={false}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />

            {/* Safe area bottom padding */}
            <View style={styles.safeAreaBottom} />
          </Animated.View>
        </Animated.View>
      </Modal>
    );
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text style={[styles.label, labelStyle]}>
          {label}
        </Text>
      )}

      <TouchableOpacity
        onPress={handlePress}
        style={[
          styles.dropdownButton,
          dropdownStyle,
          isFocused && styles.focused,
          disabled && styles.disabled,
          error && styles.error,
        ]}
        disabled={disabled}
        activeOpacity={0.7}
        testID={testID}
      >
        <Text
          style={[
            styles.selectedText,
            !hasValue && styles.placeholderText,
            disabled && styles.disabledText,
          ]}
          numberOfLines={1}
        >
          {selectedLabel}
        </Text>
        <Ionicons
          name="chevron-down"
          size={20}
          color={disabled ? '#999' : '#666'}
          style={styles.chevron}
        />
      </TouchableOpacity>

      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}

      {renderPicker()}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  focused: {
    borderColor: ORANGE_COLOR,
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
    flex: 1,
  },
  placeholderText: {
    color: '#999',
  },
  disabledText: {
    color: '#999',
  },
  chevron: {
    marginLeft: 8,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 12,
    marginTop: 4,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#F8F8F8',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
  },
  doneButtonContainer: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  doneButton: {
    color: ORANGE_COLOR,
    fontSize: 17,
    fontWeight: '600',
  },
  optionsList: {
    maxHeight: SCREEN_HEIGHT * 0.45,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
  },
  listItemSelected: {
    backgroundColor: '#FFF5E6',
  },
  listItemText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  listItemTextSelected: {
    color: ORANGE_COLOR,
    fontWeight: '600',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E5EA',
    marginLeft: 20,
  },
  safeAreaBottom: {
    height: Platform.OS === 'ios' ? 34 : 16,
    backgroundColor: '#FFFFFF',
  },
});

export default Dropdown;
