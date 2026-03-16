import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useColorScheme, StatusBar } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_STORAGE_KEY = '@theme_preference';

const lightTheme = {
  background: '#FFFFFF',
  surface: '#F8F9FA',
  surfaceAlt: '#F0F0F0',
  card: '#FFFFFF',
  primary: '#FF9500',
  primaryDark: '#FF8C00',
  primaryLight: '#FFF3E0',
  primaryTint10: 'rgba(255, 149, 0, 0.1)',
  primaryTint6: 'rgba(255, 149, 0, 0.06)',
  primaryTint5: 'rgba(255, 149, 0, 0.05)',
  textPrimary: '#333333',
  textSecondary: '#666666',
  textTertiary: '#444444',
  textMuted: '#999999',
  border: '#E0E0E0',
  borderLight: '#EEEEEE',
  borderInput: '#DDDDDD',
  disabled: '#CCCCCC',
  shadow: '#000000',
  statusBar: 'dark-content',
  success: '#4CAF50',
  error: '#F44336',
  warning: '#FF9800',
  info: '#2196F3',
  accentPurple: '#9C27B0',
  errorBackground: '#FEE2E2',
  errorText: '#991B1B',
  successBg: '#E8F5E9',
  successBorder: '#A5D6A7',
  successText: '#2E7D32',
  errorBg: '#FFEBEE',
  errorBorder: '#EF9A9A',
  errorTextAlt: '#C62828',
  infoBg: '#E3F2FD',
  infoBorder: '#90CAF9',
  infoText: '#1976D2',
  infoHighlightBg: '#F0F7FF',
  infoHighlightBorder: '#C9E0FF',
  infoHighlightText: '#0056B3',
};

const darkTheme = {
  background: '#121212',
  surface: '#1E1E1E',
  surfaceAlt: '#252525',
  card: '#2A2A2A',
  primary: '#FF7700',
  primaryDark: '#FF9500',
  primaryLight: '#3D2600',
  primaryTint10: 'rgba(255, 119, 0, 0.1)',
  primaryTint6: 'rgba(255, 119, 0, 0.06)',
  primaryTint5: 'rgba(255, 119, 0, 0.05)',
  textPrimary: '#FFFFFF',
  textSecondary: '#DDDDDD',
  textTertiary: '#AAAAAA',
  textMuted: '#CCCCCC',
  border: '#333333',
  borderLight: '#2A2A2A',
  borderInput: '#444444',
  disabled: '#555555',
  shadow: '#000000',
  statusBar: 'light-content',
  success: '#4CAF50',
  error: '#F44336',
  warning: '#FF9800',
  info: '#2196F3',
  accentPurple: '#9C27B0',
  errorBackground: '#3D1212',
  errorText: '#FCA5A5',
  successBg: '#1B3D1F',
  successBorder: '#2E7D32',
  successText: '#A5D6A7',
  errorBg: '#3D1212',
  errorBorder: '#C62828',
  errorTextAlt: '#EF9A9A',
  infoBg: '#0D2744',
  infoBorder: '#1976D2',
  infoText: '#90CAF9',
  infoHighlightBg: '#0D2744',
  infoHighlightBorder: '#1976D2',
  infoHighlightText: '#90CAF9',
};

const fonts = {
  heading: 'Brookline',
  body: undefined,
};

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState('system');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((stored) => {
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          setThemeModeState(stored);
        }
        setIsLoaded(true);
      })
      .catch(() => setIsLoaded(true));
  }, []);

  const isDark = useMemo(() => {
    if (themeMode === 'system') {
      return systemColorScheme === 'dark';
    }
    return themeMode === 'dark';
  }, [themeMode, systemColorScheme]);

  const colors = useMemo(() => (isDark ? darkTheme : lightTheme), [isDark]);

  const setThemeMode = useCallback(async (mode) => {
    setThemeModeState(mode);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (e) {
      // silently fail
    }
  }, []);

  const value = useMemo(
    () => ({ colors, isDark, themeMode, setThemeMode, fonts, isLoaded }),
    [colors, isDark, themeMode, setThemeMode, isLoaded],
  );

  return (
    <ThemeContext.Provider value={value}>
      <StatusBar barStyle={colors.statusBar} backgroundColor={colors.background} />
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    return { colors: lightTheme, isDark: false, themeMode: 'system', setThemeMode: () => {}, fonts, isLoaded: true };
  }
  return context;
}
