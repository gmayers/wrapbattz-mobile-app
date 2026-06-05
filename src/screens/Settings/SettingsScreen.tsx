import React from 'react';
import { SectionList, StyleSheet, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { getSectionsForRole, SettingsRow as SettingsRowConfig } from './sections';
import SettingsRow from './components/SettingsRow';
import SettingsSectionHeader from './components/SettingsSectionHeader';
import ThemePickerRow from './components/ThemePickerRow';

const SettingsScreen: React.FC = () => {
  const { userData, logout, deleteAccount } = useAuth();
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const sections = getSectionsForRole(userData?.role as any);

  const handleRowPress = (row: SettingsRowConfig) => {
    if (row.kind === 'nav' && row.destination) {
      navigation.navigate(row.destination);
      return;
    }
    if (row.kind === 'action' && row.onPressType === 'logout') {
      Alert.alert('Logout', 'Are you sure you want to logout?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: async () => {
          try { await logout(); } catch { Alert.alert('Error', 'Failed to logout.'); }
        } },
      ], { cancelable: true });
      return;
    }
    if (row.kind === 'action' && row.onPressType === 'deleteAccount') {
      // Two-step destructive confirmation to prevent accidental deletion.
      Alert.alert(
        'Delete Account',
        'This permanently deletes your account and your personal data. This cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete Account', style: 'destructive', onPress: () => {
            Alert.alert(
              'Confirm Deletion',
              'Are you absolutely sure? Your account will be permanently deleted.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete Permanently', style: 'destructive', onPress: async () => {
                  try {
                    // On success the auth state flips to unauthenticated and the
                    // app routes back to the login screen automatically.
                    await deleteAccount();
                  } catch (e: any) {
                    Alert.alert('Error', e?.message || 'Failed to delete account. Please try again.');
                  }
                } },
              ],
              { cancelable: true }
            );
          } },
        ],
        { cancelable: true }
      );
      return;
    }
  };

  const data = sections.map(s => ({ title: s.title, key: s.key, data: s.rows }));

  return (
    <SectionList
      style={[styles.root, { backgroundColor: colors.background }]}
      sections={data as any}
      keyExtractor={item => item.key}
      renderSectionHeader={({ section }) => <SettingsSectionHeader title={(section as any).title} />}
      renderItem={({ item }) => {
        if (item.kind === 'themePicker') return <ThemePickerRow />;
        return <SettingsRow row={item} onPress={handleRowPress} />;
      }}
      stickySectionHeadersEnabled={false}
    />
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
});

export default SettingsScreen;
