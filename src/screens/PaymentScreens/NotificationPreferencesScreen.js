import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Switch,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { createBillingService } from '../../services/BillingService';

const ORANGE_COLOR = '#FF9500';

const NotificationPreferencesScreen = ({ navigation }) => {
  const { axiosInstance, isAdminOrOwner } = useAuth();
  const billingService = createBillingService(axiosInstance);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState({
    email_notifications: true,
    payment_success: true,
    payment_failure: true,
    invoice_created: true,
    subscription_changes: true,
    cost_threshold_enabled: false,
    cost_threshold_amount: 50,
    device_count_alerts: true,
    additional_emails: [],
  });
  const [newEmail, setNewEmail] = useState('');

  // Check permissions
  React.useEffect(() => {
    if (!isAdminOrOwner) {
      Alert.alert(
        'Access Denied',
        'Only organization admins and owners can manage notification preferences.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    }
  }, [isAdminOrOwner, navigation]);

  const fetchPreferences = async () => {
    try {
      const prefs = await billingService.getNotificationPreferences();
      setPreferences(prefs);
    } catch (error) {
      // Check if it's a 404 (no preferences set yet)
      if (error.response?.status === 404) {
        console.log('ℹ️ No notification preferences found - using defaults');
        // Keep default preferences
      } else {
        console.error('Error fetching notification preferences:', error);
        // Keep default preferences if API fails
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPreferences();
  }, []);

  const updatePreference = (key, value) => {
    setPreferences(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const savePreferences = async () => {
    setSaving(true);
    try {
      await billingService.updateNotificationPreferences(preferences);
      Alert.alert('Success', 'Notification preferences updated successfully.');
    } catch (error) {
      console.error('Error saving preferences:', error);
      Alert.alert('Error', 'Unable to save preferences. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const addEmail = () => {
    if (!newEmail.trim()) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail.trim())) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    if (preferences.additional_emails.includes(newEmail.trim())) {
      Alert.alert('Duplicate Email', 'This email is already in the list.');
      return;
    }

    setPreferences(prev => ({
      ...prev,
      additional_emails: [...prev.additional_emails, newEmail.trim()],
    }));
    setNewEmail('');
  };

  const removeEmail = (email) => {
    setPreferences(prev => ({
      ...prev,
      additional_emails: prev.additional_emails.filter(e => e !== email),
    }));
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={ORANGE_COLOR} />
          <Text style={styles.loadingText}>Loading preferences...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Notification Preferences</Text>
            <Text style={styles.headerSubtitle}>
              Configure how you receive billing notifications
            </Text>
          </View>

          {/* Email Notifications Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Email Notifications</Text>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Enable Email Notifications</Text>
                <Text style={styles.settingDescription}>
                  Receive billing notifications via email
                </Text>
              </View>
              <Switch
                value={preferences.email_notifications}
                onValueChange={(value) => updatePreference('email_notifications', value)}
                trackColor={{ false: '#E0E0E0', true: ORANGE_COLOR }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          {/* Payment Notifications */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment Notifications</Text>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Payment Success</Text>
                <Text style={styles.settingDescription}>
                  Notify when payments are processed successfully
                </Text>
              </View>
              <Switch
                value={preferences.payment_success}
                onValueChange={(value) => updatePreference('payment_success', value)}
                trackColor={{ false: '#E0E0E0', true: ORANGE_COLOR }}
                thumbColor="#FFFFFF"
                disabled={!preferences.email_notifications}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Payment Failures</Text>
                <Text style={styles.settingDescription}>
                  Notify when payments fail or require attention
                </Text>
              </View>
              <Switch
                value={preferences.payment_failure}
                onValueChange={(value) => updatePreference('payment_failure', value)}
                trackColor={{ false: '#E0E0E0', true: ORANGE_COLOR }}
                thumbColor="#FFFFFF"
                disabled={!preferences.email_notifications}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Invoice Created</Text>
                <Text style={styles.settingDescription}>
                  Notify when new invoices are generated
                </Text>
              </View>
              <Switch
                value={preferences.invoice_created}
                onValueChange={(value) => updatePreference('invoice_created', value)}
                trackColor={{ false: '#E0E0E0', true: ORANGE_COLOR }}
                thumbColor="#FFFFFF"
                disabled={!preferences.email_notifications}
              />
            </View>
          </View>

          {/* Subscription Notifications */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Subscription Notifications</Text>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Subscription Changes</Text>
                <Text style={styles.settingDescription}>
                  Notify about plan changes, cancellations, and renewals
                </Text>
              </View>
              <Switch
                value={preferences.subscription_changes}
                onValueChange={(value) => updatePreference('subscription_changes', value)}
                trackColor={{ false: '#E0E0E0', true: ORANGE_COLOR }}
                thumbColor="#FFFFFF"
                disabled={!preferences.email_notifications}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Device Count Alerts</Text>
                <Text style={styles.settingDescription}>
                  Notify when device count changes significantly
                </Text>
              </View>
              <Switch
                value={preferences.device_count_alerts}
                onValueChange={(value) => updatePreference('device_count_alerts', value)}
                trackColor={{ false: '#E0E0E0', true: ORANGE_COLOR }}
                thumbColor="#FFFFFF"
                disabled={!preferences.email_notifications}
              />
            </View>
          </View>

          {/* Cost Threshold Alerts */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cost Threshold Alerts</Text>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Enable Cost Alerts</Text>
                <Text style={styles.settingDescription}>
                  Notify when monthly costs exceed a threshold
                </Text>
              </View>
              <Switch
                value={preferences.cost_threshold_enabled}
                onValueChange={(value) => updatePreference('cost_threshold_enabled', value)}
                trackColor={{ false: '#E0E0E0', true: ORANGE_COLOR }}
                thumbColor="#FFFFFF"
                disabled={!preferences.email_notifications}
              />
            </View>

            {preferences.cost_threshold_enabled && (
              <View style={styles.thresholdContainer}>
                <Text style={styles.thresholdLabel}>Alert when monthly cost exceeds:</Text>
                <View style={styles.thresholdInputContainer}>
                  <Text style={styles.currencySymbol}>£</Text>
                  <TextInput
                    style={styles.thresholdInput}
                    value={preferences.cost_threshold_amount?.toString() || ''}
                    onChangeText={(text) => {
                      const amount = parseFloat(text) || 0;
                      updatePreference('cost_threshold_amount', amount);
                    }}
                    keyboardType="numeric"
                    placeholder="50"
                  />
                </View>
              </View>
            )}
          </View>

          {/* Additional Email Recipients */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Additional Recipients</Text>
            <Text style={styles.sectionDescription}>
              Add extra email addresses to receive billing notifications
            </Text>

            <View style={styles.emailInputContainer}>
              <TextInput
                style={styles.emailInput}
                value={newEmail}
                onChangeText={setNewEmail}
                placeholder="Enter email address"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <TouchableOpacity style={styles.addButton} onPress={addEmail}>
                <Ionicons name="add" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {preferences.additional_emails.map((email, index) => (
              <View key={index} style={styles.emailItem}>
                <Text style={styles.emailText}>{email}</Text>
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removeEmail(email)}
                >
                  <Ionicons name="trash" size={16} color="#F44336" />
                </TouchableOpacity>
              </View>
            ))}
          </View>

          {/* Save Button */}
          <View style={styles.saveContainer}>
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={savePreferences}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="save" size={20} color="#FFFFFF" style={styles.saveIcon} />
                  <Text style={styles.saveButtonText}>Save Preferences</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
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
  header: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666',
  },
  section: {
    backgroundColor: '#FFFFFF',
    marginVertical: 10,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  thresholdContainer: {
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 8,
    marginTop: 12,
  },
  thresholdLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  thresholdInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginRight: 8,
  },
  thresholdInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
  },
  emailInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  emailInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    marginRight: 12,
  },
  addButton: {
    backgroundColor: ORANGE_COLOR,
    width: 44,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  emailText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  removeButton: {
    padding: 8,
  },
  saveContainer: {
    padding: 20,
  },
  saveButton: {
    backgroundColor: ORANGE_COLOR,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveIcon: {
    marginRight: 8,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default NotificationPreferencesScreen;