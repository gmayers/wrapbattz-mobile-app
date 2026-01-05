// src/components/SearchBar.js
import React from 'react';
import { View, TextInput, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ORANGE_COLOR = '#FF9500';

const SearchBar = ({ 
  value, 
  onChangeText, 
  placeholder = 'Search...', 
  style,
  autoCapitalize = 'none',
  autoCorrect = false 
}) => {
  return (
    <View style={[styles.container, style]}>
      <Ionicons 
        name="search-outline" 
        size={20} 
        color="#666" 
        style={styles.searchIcon} 
      />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#999"
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        clearButtonMode="while-editing" // iOS only
      />
      {Platform.OS === 'android' && value && (
        <Ionicons 
          name="close-circle" 
          size={20} 
          color="#666" 
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
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    marginHorizontal: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingVertical: 0, // Remove default padding
  },
  clearIcon: {
    marginLeft: 8,
  },
});

export default SearchBar;