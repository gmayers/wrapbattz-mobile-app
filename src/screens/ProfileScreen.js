// ProfileScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import * as authApi from '../api/endpoints/auth';
import { tools as toolsApi } from '../api/endpoints';
import { ApiError } from '../api/errors';

const ProfileScreen = ({ navigation }) => {
  const { user, userData, logout, updateUser, refreshUser, isAdminOrOwner } = useAuth();
  const { colors, themeMode, setThemeMode } = useTheme();
  
  const [profileData, setProfileData] = useState(null);
  const [billingData, setBillingData] = useState(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProfileData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const me = await refreshUser();
      setProfileData(me);

      // New API has no billing endpoint yet. For admin/owner, surface the
      // tool count so the existing billing card renders something real.
      if (isAdminOrOwner) {
        try {
          const page = await toolsApi.listTools({ page: 1, page_size: 1 });
          const toolCount = page.total ?? 0;
          setBillingData({
            total_devices: toolCount,
            free_devices_remaining: Math.max(0, 3 - toolCount),
            billable_devices: Math.max(0, toolCount - 3),
            billing: {
              status: 'inactive',
              plan_type: null,
              max_devices: toolCount,
              next_billing_date: null,
            },
          });
        } catch (usageError) {
          setBillingData({
            total_devices: 0,
            free_devices_remaining: 3,
            billable_devices: 0,
            billing: {
              status: 'inactive',
              plan_type: null,
              max_devices: 0,
              next_billing_date: null,
            },
          });
        }
      }
    } catch (err) {
      if (!(err instanceof ApiError && err.code === 'unauthorized')) {
        setError('Failed to load profile data');
      }
    } finally {
      setLoading(false);
    }
  }, [refreshUser, isAdminOrOwner]);

  // Load profile data on component mount
  useEffect(() => {
    fetchProfileData();
  }, [fetchProfileData]);
  
  const handleUpdateProfile = useCallback(async (updatedData) => {
    try {
      setLoading(true);
      await updateUser(updatedData);
      await fetchProfileData();
      Alert.alert('Success', 'Profile updated successfully');
    } catch (err) {
      Alert.alert('Error', (err instanceof ApiError && err.message) || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  }, [updateUser, fetchProfileData]);

  const handleChangePassword = useCallback(async (currentPassword, newPassword) => {
    try {
      setLoading(true);
      await authApi.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      Alert.alert('Success', 'Password changed successfully');
    } catch (err) {
      const detail = err instanceof ApiError ? err.detail : undefined;
      const pickFirst = (key) => {
        const value = detail && typeof detail === 'object' ? detail[key] : undefined;
        if (Array.isArray(value) && value.length > 0) return String(value[0]);
        if (typeof value === 'string') return value;
        return undefined;
      };
      const message =
        pickFirst('current_password') ||
        pickFirst('new_password') ||
        (err instanceof ApiError && err.message) ||
        'Failed to change password';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Notification preference toggles are no-ops until the new API exposes a
  // preference endpoint. The local state updates optimistically so the UI
  // still feels responsive.
  const handlePushNotificationToggle = useCallback((value) => {
    setNotificationsEnabled(value);
  }, []);

  const handleEmailNotificationToggle = useCallback((value) => {
    setEmailNotificationsEnabled(value);
  }, []);
  
  const handleLogout = useCallback(() => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => logout(),
        },
      ]
    );
  }, [logout]);
  
  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };
  
  // Calculate user's initials for avatar
  const getInitials = () => {
    if (!profileData) return '';
    
    const firstInitial = profileData.first_name ? profileData.first_name.charAt(0) : '';
    const lastInitial = profileData.last_name ? profileData.last_name.charAt(0) : '';
    return (firstInitial + lastInitial).toUpperCase();
  };
  
  // Create a billing status label and color
  const getBillingStatus = () => {
    const status = billingData?.billing?.status || 'inactive';

    switch (status) {
      case 'active':
        return { label: 'Active', color: colors.success };
      case 'past_due':
        return { label: 'Past Due', color: colors.warning };
      case 'canceled':
        return { label: 'Canceled', color: colors.error };
      case 'inactive':
      default:
        return { label: 'Inactive', color: colors.disabled };
    }
  };
  
  // Handle error screen
  if (error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={60} color={colors.error} />
          <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            onPress={fetchProfileData}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
  
  // Handle loading screen
  if (loading && !profileData) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }
  
  // Get billing status
  const billingStatus = getBillingStatus();

  const appearanceOptions = [
    { label: 'System', value: 'system', icon: 'phone-portrait-outline' },
    { label: 'Light', value: 'light', icon: 'sunny-outline' },
    { label: 'Dark', value: 'dark', icon: 'moon-outline' },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView>
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}>
          <View style={styles.avatarContainer}>
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <Text style={styles.avatarText}>{getInitials()}</Text>
            </View>
          </View>
          <Text style={[styles.nameText, { color: colors.textPrimary }]}>
            {profileData?.first_name} {profileData?.last_name}
          </Text>
          <Text style={[styles.emailText, { color: colors.textSecondary }]}>{profileData?.email}</Text>
        </View>

        {/* Device Management Fee Section - Only for Admin/Owner */}
        {isAdminOrOwner && (
          <View style={[styles.section, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Device Management</Text>
              <View style={[styles.billingBadge, { backgroundColor: billingStatus.color }]}>
                <Text style={styles.billingBadgeText}>{billingStatus.label}</Text>
              </View>
            </View>

            {billingData?.billing?.status === 'active' ? (
              <>
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Plan:</Text>
                  <Text style={[styles.infoValue, { color: colors.textPrimary }]}>
                    {billingData.billing.plan_type === 'monthly' ? 'Monthly' : 'Annual'}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Devices:</Text>
                  <Text style={[styles.infoValue, { color: colors.textPrimary }]}>
                    {billingData.total_devices} ({billingData.billable_devices} billable)
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Next Billing:</Text>
                  <Text style={[styles.infoValue, { color: colors.textPrimary }]}>
                    {formatDate(billingData.billing.next_billing_date)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.actionButton, { borderTopColor: colors.borderLight }]}
                  onPress={() => navigation.navigate('ManageBilling')}
                >
                  <Text style={[styles.actionButtonText, { color: colors.primary }]}>Manage Billing</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.primary} />
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.noBillingContainer}>
                <Text style={[styles.noBillingText, { color: colors.textSecondary }]}>
                  {billingData?.total_devices <= 3
                    ? "You're using the free tier (up to 3 devices at no cost)."
                    : "You need to set up billing for your devices."}
                </Text>
                <TouchableOpacity
                  style={[styles.setupButton, { backgroundColor: colors.primary }]}
                  onPress={() => navigation.navigate('DataHandlingFee')}
                >
                  <Text style={styles.setupButtonText}>
                    {billingData?.total_devices <= 3
                      ? "Manage Devices"
                      : "Set Up Billing"}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Personal Information Section */}
        <View style={[styles.section, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Personal Information</Text>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Full Name:</Text>
            <Text style={[styles.infoValue, { color: colors.textPrimary }]}>
              {profileData?.first_name} {profileData?.last_name}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Email:</Text>
            <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{profileData?.email}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Phone:</Text>
            <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{profileData?.phone_number || 'Not set'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Member Since:</Text>
            <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{formatDate(profileData?.date_joined)}</Text>
          </View>
          <TouchableOpacity
            style={[styles.actionButton, { borderTopColor: colors.borderLight }]}
            onPress={() => navigation.navigate('EditProfile', { profileData })}
          >
            <Text style={[styles.actionButtonText, { color: colors.primary }]}>Edit Profile</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Notification Settings Section */}
        <View style={[styles.section, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Notification Settings</Text>
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Push Notifications</Text>
            <Switch
              value={notificationsEnabled}
              onValueChange={handlePushNotificationToggle}
              trackColor={{ false: colors.disabled, true: colors.primary }}
              thumbColor={'#FFFFFF'}
            />
          </View>
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Email Notifications</Text>
            <Switch
              value={emailNotificationsEnabled}
              onValueChange={handleEmailNotificationToggle}
              trackColor={{ false: colors.disabled, true: colors.primary }}
              thumbColor={'#FFFFFF'}
            />
          </View>
        </View>

        {/* Appearance Section */}
        <View style={[styles.section, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Appearance</Text>
          {appearanceOptions.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={styles.settingRow}
              onPress={() => setThemeMode(option.value)}
              activeOpacity={0.7}
            >
              <View style={styles.appearanceOption}>
                <Ionicons
                  name={option.icon}
                  size={20}
                  color={themeMode === option.value ? colors.primary : colors.textSecondary}
                  style={styles.appearanceIcon}
                />
                <Text style={[
                  styles.settingLabel,
                  { color: themeMode === option.value ? colors.primary : colors.textPrimary }
                ]}>
                  {option.label}
                </Text>
              </View>
              <View style={[
                styles.radioOuter,
                { borderColor: themeMode === option.value ? colors.primary : colors.disabled }
              ]}>
                {themeMode === option.value && (
                  <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Security Section */}
        <View style={[styles.section, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Security</Text>
          <TouchableOpacity
            style={[styles.actionButton, { borderTopColor: colors.borderLight }]}
            onPress={() => navigation.navigate('ChangePassword')}
          >
            <Text style={[styles.actionButtonText, { color: colors.primary }]}>Change Password</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          style={[styles.logoutButton, { backgroundColor: colors.error }]}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={20} color="#FFFFFF" />
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  avatarContainer: {
    marginBottom: 15,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: 'white',
  },
  nameText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  emailText: {
    fontSize: 16,
  },
  section: {
    margin: 20,
    marginTop: 10,
    borderRadius: 10,
    padding: 15,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  billingBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  billingBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 16,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  actionButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 5,
    borderTopWidth: 1,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  noBillingContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  noBillingText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 15,
  },
  setupButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 6,
  },
  setupButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  settingLabel: {
    fontSize: 16,
  },
  appearanceOption: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appearanceIcon: {
    marginRight: 12,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 20,
    marginTop: 10,
    padding: 15,
    borderRadius: 8,
  },
  logoutButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  // Loading and error states
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  retryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ProfileScreen;