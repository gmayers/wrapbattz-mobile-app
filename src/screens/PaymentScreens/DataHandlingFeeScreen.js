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
      console.error('Error fetching billing data:', error);
      // Fall back to mock data if API not ready
      setBillingData({
        devices: {
          total: 5,
          active: 5,
          inactive: 0,
          free_quota: 3,
          billable: 2
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
    } finally {
      setLoading(false);
    }
  };
  
  const handleActivate = () => {
    if (billingData.devices.billable <= 0) {
      Alert.alert(
        'Free Tier Available',
        'You can use up to 3 devices for free. Would you like to activate your free tier?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Activate Free Tier',
            onPress: async () => {
              try {
                await axiosInstance.post('/billing/activate-free-tier/');
                Alert.alert('Free Tier Activated', 'You can now use up to 3 devices at no cost.');
                navigation.navigate('ManageBilling');
              } catch (error) {
                console.error('Error activating free tier:', error);
                Alert.alert('Error', 'Failed to activate free tier. Please try again.');
              }
            }
          }
        ]
      );
      return;
    }
    
    // Show payment setup for paid plans
    setShowPayment(true);
  };

  const handleSubscriptionSuccess = () => {
    setShowPayment(false);
    navigation.navigate('ManageBilling');
  };

  const handleSubscriptionError = (error) => {
    setShowPayment(false);
    console.error('Subscription error:', error);
  };

  const handleSubscriptionCancel = () => {
    setShowPayment(false);
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
          <Text style={styles.tieredPricingTitle}>Tiered Pricing:</Text>
          
          <View style={styles.tierRow}>
            <Text style={styles.tierDescription}>1-100 stickers:</Text>
            <Text style={styles.tierPrice}>
              {planType === 'monthly' ? '£0.40' : '£0.25'} per sticker
            </Text>
          </View>
          
          <View style={styles.tierRow}>
            <Text style={styles.tierDescription}>101-400 stickers:</Text>
            <Text style={styles.tierPrice}>
              {planType === 'monthly' ? '£0.33' : '£0.25'} per sticker
            </Text>
          </View>
          
          <View style={styles.tierRow}>
            <Text style={styles.tierDescription}>400+ stickers:</Text>
            <Text style={styles.tierPrice}>£0.25 per sticker</Text>
          </View>
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
            <Text style={styles.deviceCountLabel}>Total Devices:</Text>
            <Text style={styles.deviceCountValue}>{billingData?.devices.total || 0}</Text>
          </View>
          <View style={styles.deviceCountRow}>
            <Text style={styles.deviceCountLabel}>Free Devices:</Text>
            <Text style={styles.deviceCountValue}>{Math.min(3, billingData?.devices.total || 0)}</Text>
          </View>
          <View style={styles.deviceCountRow}>
            <Text style={styles.deviceCountLabel}>Billable Devices:</Text>
            <Text style={styles.deviceCountValue}>{billingData?.devices.billable || 0}</Text>
          </View>
          
          {billingData.devices.billable <= 0 && (
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
          <View style={styles.costRow}>
            <Text style={styles.costLabel}>Free Tier (3 devices):</Text>
            <Text style={styles.costValue}>£0.00</Text>
          </View>
          <View style={styles.costRow}>
            <Text style={styles.costLabel}>
              {billingData.devices.billable} additional device{billingData.devices.billable !== 1 ? 's' : ''} × 
              {selectedPlan === 'monthly' 
                ? '£0.40' 
                : '£0.25'}:
            </Text>
            <Text style={styles.costValue}>
              £{((selectedPlan === 'monthly' ? 0.40 : 0.25) * billingData.devices.billable).toFixed(2)}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.costRow}>
            <Text style={styles.totalLabel}>
              Total {selectedPlan === 'monthly' ? 'Monthly' : 'Annual'} Cost:
            </Text>
            <Text style={styles.totalValue}>
              £{((selectedPlan === 'monthly' ? 0.40 : 0.25) * billingData.devices.billable).toFixed(2)}
            </Text>
          </View>
        </View>
        
        <Text style={styles.fineprint}>
          First 3 devices are always free. You will only be charged for devices beyond the free tier.
          Your payment covers the cost of securely handling device data and providing management services.
        </Text>
        
        {showPayment && billingData?.devices.billable > 0 ? (
          <SubscriptionSetup
            selectedPlan={selectedPlan}
            billableDevices={billingData.devices.billable}
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
              {billingData?.devices.billable > 0
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
});

export default DataHandlingFeeScreen;