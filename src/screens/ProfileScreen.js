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
import axios from 'axios';

// Orange color to match existing UI
const ORANGE_COLOR = '#FF9500';

// API endpoints
const API_BASE_URL = 'https://battwrapz.gmayersservices.com/api';

const ProfileScreen = ({ navigation }) => {
  // Use AuthContext
  const { user, userData, logout, updateUserProfile, getUserProfile, axiosInstance } = useAuth();
  
  const [profileData, setProfileData] = useState(null);
  const [billingData, setBillingData] = useState(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Fetch profile data
  const fetchProfileData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Get user profile from AuthContext 
      // (This should have been implemented in your AuthContext as described in your earlier code)
      const userId = userData?.userId || user?.id;
      
      if (!userId) {
        throw new Error('User ID not found');
      }
      
      // Get user profile using authContext method
      const profileResponse = await getUserProfile(userId);
      setProfileData(profileResponse);
      
      // For demo purposes, also fetch mock billing data
      // In a real implementation, this would come from your API
      setBillingData({
        total_devices: 5,
        free_devices_remaining: 0,
        billable_devices: 2,
        billing: {
          status: 'active',
          plan_type: 'monthly',
          max_devices: 5,
          next_billing_date: '2025-12-31T23:59:59Z'
        }
      });
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError('Failed to load profile data');
    } finally {
      setLoading(false);
    }
  }, [user, userData, getUserProfile]);
  
  // Load profile data on component mount
  useEffect(() => {
    fetchProfileData();
  }, [fetchProfileData]);
  
  const handleUpdateProfile = useCallback(async (updatedData) => {
    try {
      setLoading(true);
      const userId = userData?.userId || user?.id;
      
      if (!userId) {
        throw new Error('User ID not found');
      }
      
      // Update profile using the AuthContext method
      await updateUserProfile(userId, updatedData);
      
      // Refresh profile data
      fetchProfileData();
      
      Alert.alert('Success', 'Profile updated successfully');
    } catch (err) {
      console.error('Error updating profile:', err);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  }, [userData, user, updateUserProfile, fetchProfileData]);
  
  const handleChangePassword = useCallback(async (currentPassword, newPassword) => {
    try {
      setLoading(true);
      
      // Call password change endpoint directly
      await axiosInstance.post('/auth/password/change/', {
        old_password: currentPassword,
        new_password1: newPassword,
        new_password2: newPassword
      });
      
      Alert.alert('Success', 'Password changed successfully');
    } catch (err) {
      console.error('Error changing password:', err);
      
      if (err.response?.data?.old_password) {
        Alert.alert('Error', err.response.data.old_password[0]);
      } else if (err.response?.data?.new_password1) {
        Alert.alert('Error', err.response.data.new_password1[0]);
      } else {
        Alert.alert('Error', 'Failed to change password');
      }
    } finally {
      setLoading(false);
    }
  }, [axiosInstance]);
  
  const handleNotificationToggle = useCallback(async (value) => {
    try {
      setNotificationsEnabled(value);
      
      // Update notification preferences in profile
      const userId = userData?.userId || user?.id;
      
      if (userId) {
        await updateUserProfile(userId, {
          push_notifications_enabled: value
        });
      }
    } catch (err) {
      console.error('Error updating notification preferences:', err);
      // Revert the switch if update fails
      setNotificationsEnabled(!value);
      Alert.alert('Error', 'Failed to update notification preferences');
    }
  }, [userData, user, updateUserProfile]);
  
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
        return { label: 'Active', color: '#4CAF50' };
      case 'past_due':
        return { label: 'Past Due', color: '#FF9800' };
      case 'canceled':
        return { label: 'Canceled', color: '#F44336' };
      case 'inactive':
      default:
        return { label: 'Inactive', color: '#757575' };
    }
  };
  
  // Handle error screen
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={60} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
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
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={ORANGE_COLOR} />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }
  
  // Get billing status
  const billingStatus = getBillingStatus();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials()}</Text>
            </View>
          </View>
          <Text style={styles.nameText}>
            {profileData?.first_name} {profileData?.last_name}
          </Text>
          <Text style={styles.emailText}>{profileData?.email}</Text>
        </View>

        {/* Device Management Fee Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Device Management</Text>
            <View style={[styles.billingBadge, { backgroundColor: billingStatus.color }]}>
              <Text style={styles.billingBadgeText}>{billingStatus.label}</Text>
            </View>
          </View>
          
          {billingData?.billing?.status === 'active' ? (
            <>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Plan:</Text>
                <Text style={styles.infoValue}>
                  {billingData.billing.plan_type === 'monthly' ? 'Monthly' : 'Annual'}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Devices:</Text>
                <Text style={styles.infoValue}>
                  {billingData.total_devices} ({billingData.billable_devices} billable)
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Next Billing:</Text>
                <Text style={styles.infoValue}>
                  {formatDate(billingData.billing.next_billing_date)}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => navigation.navigate('ManageBilling')}
              >
                <Text style={styles.actionButtonText}>Manage Billing</Text>
                <Ionicons name="chevron-forward" size={16} color={ORANGE_COLOR} />
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.noBillingContainer}>
              <Text style={styles.noBillingText}>
                {billingData?.total_devices <= 3 
                  ? "You're using the free tier (up to 3 devices at no cost)."
                  : "You need to set up billing for your devices."}
              </Text>
              <TouchableOpacity
                style={styles.setupButton}
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

        {/* Personal Information Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Full Name:</Text>
            <Text style={styles.infoValue}>
              {profileData?.first_name} {profileData?.last_name}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email:</Text>
            <Text style={styles.infoValue}>{profileData?.email}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Phone:</Text>
            <Text style={styles.infoValue}>{profileData?.phone_number || 'Not set'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Member Since:</Text>
            <Text style={styles.infoValue}>{formatDate(profileData?.date_joined)}</Text>
          </View>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('EditProfile', { profileData })}
          >
            <Text style={styles.actionButtonText}>Edit Profile</Text>
            <Ionicons name="chevron-forward" size={16} color={ORANGE_COLOR} />
          </TouchableOpacity>
        </View>

        {/* Notification Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notification Settings</Text>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Push Notifications</Text>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleNotificationToggle}
              trackColor={{ false: '#D1D5DB', true: ORANGE_COLOR }}
              thumbColor={'#FFFFFF'}
            />
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Email Notifications</Text>
            <Switch
              value={profileData?.email_notifications_enabled || false}
              onValueChange={(value) => handleUpdateProfile({ email_notifications_enabled: value })}
              trackColor={{ false: '#D1D5DB', true: ORANGE_COLOR }}
              thumbColor={'#FFFFFF'}
            />
          </View>
        </View>

        {/* Security Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security</Text>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('ChangePassword')}
          >
            <Text style={styles.actionButtonText}>Change Password</Text>
            <Ionicons name="chevron-forward" size={16} color={ORANGE_COLOR} />
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          style={styles.logoutButton}
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
    backgroundColor: '#FFFFFF',
  },
  header: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F9F9F9',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  avatarContainer: {
    marginBottom: 15,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: ORANGE_COLOR,
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
    color: '#333',
    marginBottom: 5,
  },
  emailText: {
    fontSize: 16,
    color: '#666',
  },
  section: {
    margin: 20,
    marginTop: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 15,
    shadowColor: '#000',
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
    color: '#333',
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
    color: '#555',
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  actionButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 5,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },
  actionButtonText: {
    fontSize: 16,
    color: ORANGE_COLOR,
    fontWeight: '600',
  },
  noBillingContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  noBillingText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 15,
  },
  setupButton: {
    backgroundColor: ORANGE_COLOR,
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
    color: '#333',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 20,
    marginTop: 10,
    padding: 15,
    backgroundColor: '#EF4444',
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
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: ORANGE_COLOR,
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