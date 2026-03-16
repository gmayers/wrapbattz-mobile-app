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
import { useTheme } from '../context/ThemeContext';

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
  const { colors } = useTheme();
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
          { backgroundColor: colors.surface },
          isSelected && { backgroundColor: colors.primaryTint10 },
        ]}
        onPress={() => handleSelectItem(item.value)}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.listItemText,
            { color: colors.textPrimary },
            isSelected && { color: colors.primary, fontWeight: '600' },
          ]}
        >
          {item.label}
        </Text>
        {isSelected && (
          <Ionicons name="checkmark" size={22} color={colors.primary} />
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
                backgroundColor: colors.surface,
                shadowColor: colors.shadow,
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            {/* Header */}
            <View style={[styles.modalHeader, { backgroundColor: colors.surfaceAlt, borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{label || 'Select Option'}</Text>
              <TouchableOpacity onPress={hideModal} style={styles.doneButtonContainer}>
                <Text style={[styles.doneButton, { color: colors.primary }]}>Done</Text>
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
              ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.border }]} />}
            />

            {/* Safe area bottom padding */}
            <View style={[styles.safeAreaBottom, { backgroundColor: colors.surface }]} />
          </Animated.View>
        </Animated.View>
      </Modal>
    );
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text style={[styles.label, { color: colors.textPrimary }, labelStyle]}>
          {label}
        </Text>
      )}

      <TouchableOpacity
        onPress={handlePress}
        style={[
          styles.dropdownButton,
          { borderColor: colors.borderInput, backgroundColor: colors.surface },
          dropdownStyle,
          isFocused && { borderColor: colors.primary },
          disabled && { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
          error && { borderColor: colors.error },
        ]}
        disabled={disabled}
        activeOpacity={0.7}
        testID={testID}
      >
        <Text
          style={[
            styles.selectedText,
            { color: colors.textPrimary },
            !hasValue && { color: colors.textMuted },
            disabled && { color: colors.textMuted },
          ]}
          numberOfLines={1}
        >
          {selectedLabel}
        </Text>
        <Ionicons
          name="chevron-down"
          size={20}
          color={disabled ? colors.textMuted : colors.textSecondary}
          style={styles.chevron}
        />
      </TouchableOpacity>

      {error && (
        <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
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
    marginBottom: 8,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 8,
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  selectedText: {
    fontSize: 16,
    flex: 1,
  },
  chevron: {
    marginLeft: 8,
  },
  errorText: {
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
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: SCREEN_HEIGHT * 0.6,
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
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  doneButtonContainer: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  doneButton: {
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
  },
  listItemText: {
    fontSize: 16,
    flex: 1,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 20,
  },
  safeAreaBottom: {
    height: Platform.OS === 'ios' ? 34 : 16,
  },
});

export default Dropdown;
