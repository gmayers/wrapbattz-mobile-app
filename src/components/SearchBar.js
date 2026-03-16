// src/components/SearchBar.js
import React from 'react';
import { View, TextInput, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

const SearchBar = ({
  value,
  onChangeText,
  placeholder = 'Search...',
  style,
  autoCapitalize = 'none',
  autoCorrect = false
}) => {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }, style]}>
      <Ionicons
        name="search-outline"
        size={20}
        color={colors.textSecondary}
        style={styles.searchIcon}
      />
      <TextInput
        style={[styles.input, { color: colors.textPrimary }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        clearButtonMode="while-editing" // iOS only
      />
      {Platform.OS === 'android' && value && (
        <Ionicons
          name="close-circle"
          size={20}
          color={colors.textSecondary}
          style={styles.clearIcon}
          onPress={() => onChangeText('')}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    marginHorizontal: 16,
    marginVertical: 8,
    borderWidth: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 0, // Remove default padding
  },
  clearIcon: {
    marginLeft: 8,
  },
});

export default SearchBar;