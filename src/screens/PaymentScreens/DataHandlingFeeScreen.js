// DataHandlingFeeScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import SubscriptionSetup from '../../components/SubscriptionSetup';

// Orange color to match existing UI
const ORANGE_COLOR = '#FF9500';

const DataHandlingFeeScreen = ({ navigation }) => {
  const { axiosInstance, isAdminOrOwner } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState('monthly');
  const [loading, setLoading] = useState(true);
  const [billingData, setBillingData] = useState(null);
  const [showPayment, setShowPayment] = useState(false);
  const [customDeviceCount, setCustomDeviceCount] = useState(null); // null means use current count
  
  // Check permissions
  React.useEffect(() => {
    if (!isAdminOrOwner) {
      Alert.alert(
        'Access Denied',
        'Only organization admins and owners can manage billing.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    }
  }, [isAdminOrOwner, navigation]);
  
  useEffect(() => {
    fetchBillingData();
  }, []);

  const fetchBillingData = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get('/billing/status/');
      setBillingData(response.data);
    } catch (error) {
      console.log('ℹ️ Billing status not available (expected if not set up):', error.response?.status || 'Network error');

      // Try to fetch device count from devices endpoint as fallback
      try {
        const devicesResponse = await axiosInstance.get('/devices/');
        const deviceCount = devicesResponse.data?.length || 0;

        setBillingData({
          devices: {
            total: deviceCount,
            active: deviceCount,
            inactive: 0,
            free_quota: 3,
            billable: Math.max(0, deviceCount - 3)
          },
          tier: {
            name: "1-100 Stickers",
            price_per_device: {
              monthly: 0.40,
              annual: 0.25
            }
          },
          billing: {
            status: 'inactive',
            cycle: 'monthly',
            free_quota: 3
          }
        });
      } catch (deviceError) {
        console.log('ℹ️ Device list not available, using defaults');
        // If we can't get device count either, use 0
        setBillingData({
          devices: {
            total: 0,
            active: 0,
            inactive: 0,
            free_quota: 3,
            billable: 0
          },
          tier: {
            name: "1-100 Stickers",
            price_per_device: {
              monthly: 0.40,
              annual: 0.25
            }
          },
          billing: {
            status: 'inactive',
            cycle: 'monthly',
            free_quota: 3
          }
        });
      }
    } finally {
      setLoading(false);
    }
  };
  
  const handleActivate = async () => {
    // Check effective billable devices
    if (getBillableDevices() <= 0) {
      // Free tier - activate directly without confirmation
      try {
        setLoading(true);
        await axiosInstance.post('/billing/activate-free-tier/');
        Alert.alert(
          'Free Tier Activated',
          'You can now use up to 3 devices at no cost.',
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate('ManageBilling')
            }
          ]
        );
      } catch (error) {
        console.error('Error activating free tier:', error);
        Alert.alert(
          'Error',
          error.response?.data?.detail || 'Failed to activate free tier. Please try again.'
        );
      } finally {
        setLoading(false);
      }
      return;
    }

    // Show payment setup for paid plans
    setShowPayment(true);
  };

  const handleSubscriptionSuccess = () => {
    // Replace current screen with ManageBilling to avoid flash of activate button
    navigation.replace('ManageBilling');
  };

  const handleSubscriptionError = (error) => {
    setShowPayment(false);
    console.error('Subscription error:', error);
  };

  const handleSubscriptionCancel = () => {
    setShowPayment(false);
  };

  // Get effective device count (custom or actual)
  const getEffectiveDeviceCount = () => {
    return customDeviceCount !== null ? customDeviceCount : (billingData?.devices.total || 0);
  };

  // Calculate billable devices based on effective count
  const getBillableDevices = () => {
    const totalDevices = getEffectiveDeviceCount();
    return Math.max(0, totalDevices - 3); // 3 free devices
  };

  // Get the tier based on TOTAL devices
  const getTierInfo = () => {
    const totalDevices = getEffectiveDeviceCount();

    // Tier determined by total device count
    if (totalDevices <= 100) {
      // 1-100 stickers tier
      return {
        name: '1-100 Stickers',
        monthlyRate: 0.40,
        annualRate: 0.25
      };
    } else if (totalDevices <= 400) {
      // 101-400 stickers tier (triggers at 101 total)
      return {
        name: '101-400 Stickers',
        monthlyRate: 0.33,
        annualRate: 0.25
      };
    } else {
      // 401+ stickers tier
      return {
        name: '400+ Stickers',
        monthlyRate: 0.25,
        annualRate: 0.25
      };
    }
  };

  // Calculate cost - all billable devices at the same rate
  const calculateTieredCost = (totalDevices, planType) => {
    const billableDevices = Math.max(0, totalDevices - 3);
    if (billableDevices <= 0) return 0;

    const tierInfo = getTierInfo();
    const rate = planType === 'monthly' ? tierInfo.monthlyRate : tierInfo.annualRate;

    return billableDevices * rate;
  };

  // Get minimum device count (can't subscribe to less than you currently have)
  const getMinimumDeviceCount = () => {
    return billingData?.devices.total || 0;
  };

  // Handle device count change
  const handleDeviceCountChange = (increment) => {
    const currentCount = getEffectiveDeviceCount();
    const minCount = getMinimumDeviceCount();
    const newCount = Math.max(minCount, currentCount + increment);
    setCustomDeviceCount(newCount);
  };

  // Handle direct text input for device count - allow any input during typing
  const handleDeviceCountInput = (text) => {
    // Remove non-numeric characters
    const numericValue = text.replace(/[^0-9]/g, '');

    // Allow empty or any number during typing
    if (numericValue === '') {
      // Set to null to show placeholder or current value
      setCustomDeviceCount(null);
      return;
    }

    const count = parseInt(numericValue, 10);
    // Allow setting any number during typing - validation happens on blur
    setCustomDeviceCount(count);
  };

  // Handle when user finishes editing (blur) - validate here
  const handleDeviceCountBlur = () => {
    const currentCount = getEffectiveDeviceCount();
    const minCount = getMinimumDeviceCount();

    // Validate and correct if needed
    if (!currentCount || currentCount < minCount) {
      // Show alert if user tried to go below minimum
      if (currentCount > 0 && currentCount < minCount) {
        Alert.alert(
          'Minimum Devices',
          `You currently have ${minCount} device${minCount !== 1 ? 's' : ''} in your system. You cannot subscribe to fewer devices than you currently have. Resetting to ${minCount}.`,
          [{ text: 'OK' }]
        );
      }
      setCustomDeviceCount(minCount);
    }
  };

  const renderPlanOption = (planType, title, description) => {
    // Calculate savings percentage
    const savingsPercent = Math.round(((0.40 - 0.25) / 0.40) * 100);
    
    return (
      <TouchableOpacity
        style={[
          styles.planOption,
          selectedPlan === planType && styles.planOptionSelected
        ]}
        onPress={() => setSelectedPlan(planType)}
      >
        <View style={styles.planHeader}>
          <Text style={styles.planTitle}>{title}</Text>
          {planType === 'annual' && (
            <View style={styles.savingsBadge}>
              <Text style={styles.savingsBadgeText}>Save {savingsPercent}%</Text>
            </View>
          )}
        </View>
        <Text style={styles.planDescription}>{description}</Text>
        
        <View style={styles.tieredPricing}>
          {planType === 'monthly' ? (
            <>
              <Text style={styles.tieredPricingTitle}>Tiered Pricing:</Text>
              <View style={styles.tierRow}>
                <Text style={styles.tierDescription}>1-100 stickers:</Text>
                <Text style={styles.tierPrice}>£0.40 per sticker</Text>
              </View>
              <View style={styles.tierRow}>
                <Text style={styles.tierDescription}>101-400 stickers:</Text>
                <Text style={styles.tierPrice}>£0.33 per sticker</Text>
              </View>
              <View style={styles.tierRow}>
                <Text style={styles.tierDescription}>400+ stickers:</Text>
                <Text style={styles.tierPrice}>£0.25 per sticker</Text>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.tieredPricingTitle}>Simple Flat Pricing:</Text>
              <View style={styles.flatPricingRow}>
                <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                <Text style={styles.flatPricingText}>£0.25 per sticker/month</Text>
              </View>
              <View style={styles.annualBreakdown}>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Monthly rate:</Text>
                  <Text style={styles.breakdownValue}>£0.25 × stickers</Text>
                </View>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Billed annually:</Text>
                  <Text style={styles.breakdownValue}>Monthly × 12</Text>
                </View>
              </View>
              <Text style={styles.flatPricingNote}>
                Same low rate for all quantities - no tier complexity
              </Text>
            </>
          )}
        </View>
      </TouchableOpacity>
    );
  };
  
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={ORANGE_COLOR} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }
  
  const isActive = billingData?.billing?.status === 'active';
  
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Device Management Fee</Text>
          <Text style={styles.headerSubtitle}>
            {isActive
              ? `You are currently on the ${billingData?.billing?.cycle} billing plan`
              : 'Choose a billing plan for your devices'}
          </Text>
        </View>
        
        <View style={styles.deviceSummary}>
          <Text style={styles.deviceSummaryTitle}>Device Usage</Text>
          <View style={styles.deviceCountRow}>
            <Text style={styles.deviceCountLabel}>Current Devices in System:</Text>
            <Text style={styles.deviceCountValue}>{billingData?.devices.total || 0}</Text>
          </View>

          {/* Device Count Selector */}
          <View style={styles.deviceSelector}>
            <Text style={styles.deviceSelectorLabel}>Devices to Subscribe:</Text>
            <View style={styles.deviceSelectorControls}>
              <TouchableOpacity
                style={styles.deviceSelectorButton}
                onPress={() => handleDeviceCountChange(-1)}
                disabled={getEffectiveDeviceCount() <= getMinimumDeviceCount()}
              >
                <Ionicons
                  name="remove-circle"
                  size={32}
                  color={getEffectiveDeviceCount() <= getMinimumDeviceCount() ? '#ccc' : ORANGE_COLOR}
                />
              </TouchableOpacity>
              <TextInput
                style={styles.deviceSelectorValue}
                value={String(getEffectiveDeviceCount())}
                onChangeText={handleDeviceCountInput}
                onBlur={handleDeviceCountBlur}
                keyboardType="number-pad"
                returnKeyType="done"
                maxLength={4}
                selectTextOnFocus={true}
              />
              <TouchableOpacity
                style={styles.deviceSelectorButton}
                onPress={() => handleDeviceCountChange(1)}
              >
                <Ionicons name="add-circle" size={32} color={ORANGE_COLOR} />
              </TouchableOpacity>
            </View>
            <Text style={styles.helperText}>
              Minimum: {getMinimumDeviceCount()} (current devices in system)
            </Text>
            <TouchableOpacity
              style={styles.resetButton}
              onPress={() => setCustomDeviceCount(null)}
            >
              <Text style={styles.resetButtonText}>
                Reset to current ({billingData?.devices.total || 0})
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          <View style={styles.deviceCountRow}>
            <Text style={styles.deviceCountLabel}>Free Devices:</Text>
            <Text style={styles.deviceCountValue}>{Math.min(3, getEffectiveDeviceCount())}</Text>
          </View>
          <View style={styles.deviceCountRow}>
            <Text style={styles.deviceCountLabel}>Billable Devices:</Text>
            <Text style={styles.deviceCountValue}>{getBillableDevices()}</Text>
          </View>

          {getBillableDevices() <= 0 && (
            <View style={styles.freeTierInfo}>
              <Text style={styles.freeTierInfoText}>
                You're using the free tier (up to 3 devices). Add more devices to upgrade.
              </Text>
            </View>
          )}
        </View>
        
        <View style={styles.planOptions}>
          <Text style={styles.planOptionsTitle}>Billing Plans</Text>
          {renderPlanOption(
            'monthly',
            'Monthly Billing',
            'Pay month-to-month with flexibility to cancel anytime'
          )}
          {renderPlanOption(
            'annual',
            'Annual Billing',
            'Lower per-device rate with annual payment'
          )}
        </View>
        
        <View style={styles.costSummary}>
          <Text style={styles.costSummaryTitle}>Cost Summary</Text>

          {/* Show current tier */}
          <View style={styles.tierBadgeContainer}>
            <Text style={styles.tierBadge}>Tier: {getTierInfo().name}</Text>
          </View>

          <View style={styles.costRow}>
            <Text style={styles.costLabel}>Free Devices:</Text>
            <Text style={styles.costValue}>3 × £0.00 = £0.00</Text>
          </View>

          {getBillableDevices() > 0 && (
            <View style={styles.costRow}>
              <Text style={styles.costLabel}>
                Billable Devices:
              </Text>
              <Text style={styles.costValue}>
                {getBillableDevices()} × £{(selectedPlan === 'monthly' ? getTierInfo().monthlyRate : getTierInfo().annualRate).toFixed(2)}/month
              </Text>
            </View>
          )}

          {getBillableDevices() > 0 && (
            <View style={styles.costRow}>
              <Text style={[styles.costLabel, { fontWeight: '600' }]}>
                Subtotal:
              </Text>
              <Text style={[styles.costValue, { fontWeight: '600' }]}>
                £{calculateTieredCost(getEffectiveDeviceCount(), selectedPlan).toFixed(2)}/month
              </Text>
            </View>
          )}

          {selectedPlan === 'annual' && getBillableDevices() > 0 && (
            <View style={styles.costRow}>
              <Text style={styles.costLabel}>Annual billing (×12 months):</Text>
              <Text style={styles.costValue}>
                £{(calculateTieredCost(getEffectiveDeviceCount(), selectedPlan) * 12).toFixed(2)}/year
              </Text>
            </View>
          )}

          <View style={styles.divider} />

          <View style={styles.costRow}>
            <Text style={styles.totalLabel}>
              Total {selectedPlan === 'monthly' ? 'Monthly' : 'Annual'} Cost:
            </Text>
            <Text style={styles.totalValue}>
              £{(selectedPlan === 'monthly'
                ? calculateTieredCost(getEffectiveDeviceCount(), selectedPlan).toFixed(2)
                : (calculateTieredCost(getEffectiveDeviceCount(), selectedPlan) * 12).toFixed(2))}
              {selectedPlan === 'monthly' ? '/month' : '/year'}
            </Text>
          </View>
        </View>
        
        <Text style={styles.fineprint}>
          First 3 devices are always free. You will only be charged for devices beyond the free tier.
          Your payment covers the cost of securely handling device data and providing management services.
        </Text>
        
        {showPayment && getBillableDevices() > 0 ? (
          <SubscriptionSetup
            selectedPlan={selectedPlan}
            billableDevices={getBillableDevices()}
            totalDevices={getEffectiveDeviceCount()}
            onSubscriptionSuccess={handleSubscriptionSuccess}
            onSubscriptionError={handleSubscriptionError}
            onCancel={handleSubscriptionCancel}
          />
        ) : (
          <TouchableOpacity
            style={styles.activateButton}
            onPress={handleActivate}
          >
            <Text style={styles.activateButtonText}>
              {getBillableDevices() > 0
                ? `Activate ${selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1)} Plan`
                : 'Activate Free Tier'}
            </Text>
          </TouchableOpacity>
        )}

        {showPayment && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleSubscriptionCancel}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        )}

        {/* Navigation buttons */}
        <View style={styles.navigationContainer}>
          <Text style={styles.navigationTitle}>Quick Links</Text>

          <TouchableOpacity
            style={styles.navButton}
            onPress={() => navigation.navigate('ManageBilling')}
          >
            <Ionicons name="card-outline" size={20} color={ORANGE_COLOR} />
            <Text style={styles.navButtonText}>Manage Billing</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navButton}
            onPress={() => navigation.navigate('BillingAnalytics')}
          >
            <Ionicons name="analytics-outline" size={20} color={ORANGE_COLOR} />
            <Text style={styles.navButtonText}>Billing Analytics</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navButton}
            onPress={() => navigation.navigate('PaymentHistory')}
          >
            <Ionicons name="receipt-outline" size={20} color={ORANGE_COLOR} />
            <Text style={styles.navButtonText}>Payment History</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navButton}
            onPress={() => navigation.navigate('NotificationPreferences')}
          >
            <Ionicons name="notifications-outline" size={20} color={ORANGE_COLOR} />
            <Text style={styles.navButtonText}>Notification Settings</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
  deviceSummary: {
    padding: 20,
    backgroundColor: '#F9F9F9',
    marginBottom: 20,
  },
  deviceSummaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  deviceCountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 6,
  },
  deviceCountLabel: {
    fontSize: 16,
    color: '#555',
  },
  deviceCountValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  deviceSelector: {
    marginVertical: 16,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: ORANGE_COLOR,
  },
  deviceSelectorLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  deviceSelectorControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  deviceSelectorButton: {
    padding: 8,
  },
  deviceSelectorValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginHorizontal: 24,
    minWidth: 80,
    textAlign: 'center',
    padding: 8,
    borderBottomWidth: 2,
    borderBottomColor: ORANGE_COLOR,
  },
  helperText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  resetButton: {
    alignSelf: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  resetButtonText: {
    fontSize: 13,
    color: ORANGE_COLOR,
    textDecorationLine: 'underline',
  },
  freeTierInfo: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#E1F5FE',
    borderRadius: 8,
  },
  freeTierInfoText: {
    fontSize: 14,
    color: '#0277BD',
  },
  planOptions: {
    padding: 20,
  },
  planOptionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  planOption: {
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    marginBottom: 12,
  },
  planOptionSelected: {
    borderColor: ORANGE_COLOR,
    backgroundColor: 'rgba(255, 149, 0, 0.05)',
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  planTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  savingsBadge: {
    backgroundColor: '#4CAF50',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  savingsBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  planDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  tieredPricing: {
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 6,
    marginVertical: 10,
  },
  tieredPricingTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  tierRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  tierDescription: {
    fontSize: 14,
    color: '#555',
  },
  tierPrice: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  flatPricingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
  },
  flatPricingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
    marginLeft: 8,
  },
  flatPricingNote: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
  },
  annualBreakdown: {
    backgroundColor: '#F5F5F5',
    padding: 10,
    borderRadius: 6,
    marginVertical: 8,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 3,
  },
  breakdownLabel: {
    fontSize: 14,
    color: '#555',
  },
  breakdownValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  costSummary: {
    margin: 20,
    padding: 16,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  costSummaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  tierBadgeContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  tierBadge: {
    backgroundColor: ORANGE_COLOR,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  costRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 6,
  },
  costLabel: {
    fontSize: 15,
    color: '#555',
    flex: 2,
  },
  costValue: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 10,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'right',
  },
  fineprint: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    marginHorizontal: 20,
    lineHeight: 18,
  },
  activateButton: {
    backgroundColor: ORANGE_COLOR,
    paddingVertical: 16,
    borderRadius: 8,
    marginHorizontal: 20,
    marginVertical: 20,
    alignItems: 'center',
  },
  activateButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 20,
    marginBottom: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '500',
  },
  navigationContainer: {
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 30,
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 16,
  },
  navigationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  navButtonText: {
    flex: 1,
    fontSize: 15,
    color: '#333',
    marginLeft: 12,
  },
});

export default DataHandlingFeeScreen;