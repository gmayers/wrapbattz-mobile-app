import React from 'react';
import { SectionList, StyleSheet, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { getSectionsForRole, SettingsRow as SettingsRowConfig } from './sections';
import SettingsRow from './components/SettingsRow';
import SettingsSectionHeader from './components/SettingsSectionHeader';
import ThemePickerRow from './components/ThemePickerRow';
import { useWhatsNewPrompt } from '../../components/WhatsNewModal';
import { account, organizations } from '../../api/endpoints';

const SettingsScreen: React.FC = () => {
  const { userData, logout, deleteAccount, updateOnboarding } = useAuth();
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const { openManually: openWhatsNew } = useWhatsNewPrompt();
  const sections = getSectionsForRole(userData?.role as any);

  const handleRowPress = (row: SettingsRowConfig) => {
    if (row.kind === 'nav' && row.destination) {
      navigation.navigate(row.destination, row.params);
      return;
    }
    if (row.kind === 'action' && row.onPressType === 'whatsNew') {
      openWhatsNew();
      return;
    }
    if (row.kind === 'action' && row.onPressType === 'addDemoData') {
      Alert.alert(
        'Add Demo Tools',
        'This adds a Demo Warehouse site and a set of sample tools so you can try out assignments, transfers, and reports. You can remove them again from here at any time.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Add Demo Tools', onPress: async () => {
            try {
              await organizations.createDemoData();
              Alert.alert('Demo Tools Added', 'The Demo Warehouse site and sample tools are now in your organization.');
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Failed to add demo tools. Please try again.');
            }
          } },
        ],
        { cancelable: true }
      );
      return;
    }
    if (row.kind === 'action' && row.onPressType === 'removeDemoData') {
      Alert.alert(
        'Remove Demo Tools',
        'This removes the Demo Warehouse site and all demo tools. Your own tools and sites are not affected.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Remove', style: 'destructive', onPress: async () => {
            try {
              await organizations.deleteDemoData();
              Alert.alert('Demo Tools Removed', 'All demo data has been removed from your organization.');
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Failed to remove demo tools. Please try again.');
            }
          } },
        ],
        { cancelable: true }
      );
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
    if (row.kind === 'action' && row.onPressType === 'resetOnboarding') {
      Alert.alert(
        'Reset Onboarding',
        'This replays the setup wizard for your account. Your organization, tools, sites and team members are not changed.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Reset', onPress: async () => {
            try {
              // The wizard is role-branched server-side, so the first step is
              // not a constant — ask for this user's flow rather than guessing.
              const state = await account.getOnboarding();
              const firstStep = state?.steps?.[0]?.key;
              await updateOnboarding({
                has_completed_onboarding: false,
                has_seen_onboarding_outro: false,
                ...(firstStep ? { onboarding_step: firstStep } : {}),
              });
              navigation.navigate('OnboardingWizard');
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Failed to reset onboarding. Please try again.');
            }
          } },
        ],
        { cancelable: true }
      );
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
