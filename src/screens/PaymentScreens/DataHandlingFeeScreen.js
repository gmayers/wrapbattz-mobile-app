// DataHandlingFeeScreen.js
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Orange color to match existing UI
const ORANGE_COLOR = '#FF9500';

// Mock data for demonstration
const MOCK_BILLING_DATA = {
  total_devices: 5,
  free_devices_remaining: 0,
  billable_devices: 2,
  billing: {
    status: 'inactive', // Change to 'active' to see active state
    plan_type: 'monthly',
    max_devices: 5,
    next_billing_date: '2025-12-31T23:59:59Z'
  }
};

const DataHandlingFeeScreen = ({ navigation }) => {
  const [selectedPlan, setSelectedPlan] = useState('monthly');
  const [loading, setLoading] = useState(false);
  
  // Mock billing data - replace with real data from API
  const billingData = MOCK_BILLING_DATA;
  
  const isActive = billingData?.billing?.status === 'active';
  const onFreeTier = billingData.free_devices_remaining > 0 && 
                    billingData.total_devices <= 3 &&
                    !isActive;

  const handleActivate = () => {
    // Placeholder for payment logic
    if (billingData.billable_devices <= 0) {
      Alert.alert(
        'Free Tier Available',
        'You can use up to 3 devices for free. Would you like to activate your free tier?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Activate Free Tier',
            onPress: () => {
              Alert.alert('Free Tier Activated', 'You can now use up to 3 devices at no cost.');
            }
          },
        ]
      );
      return;
    }
    
    Alert.alert(
      'Payment Confirmed',
      'Your device management fee payment has been processed successfully!',
      [{ text: 'OK' }]
    );
  };

  const openBillingPortal = () => {
    // Placeholder for billing portal navigation
    Alert.alert('Billing Portal', 'This would open the Stripe Customer Portal for payment management.');
  };

  const renderPlanOption = (planType, title, description, price) => (
    <TouchableOpacity
      style={[
        styles.planOption,
        selectedPlan === planType && styles.planOptionSelected,
        (isActive && billingData?.billing?.plan_type === planType) && styles.planOptionCurrent
      ]}
      onPress={() => setSelectedPlan(planType)}
      disabled={isActive}
    >
      <View style={styles.planHeader}>
        <Text style={styles.planTitle}>{title}</Text>
        {(isActive && billingData?.billing?.plan_type === planType) && (
          <View style={styles.currentPlanBadge}>
            <Text style={styles.currentPlanBadgeText}>Current Plan</Text>
          </View>
        )}
      </View>
      <Text style={styles.planDescription}>{description}</Text>
      <Text style={styles.planPrice}>{price}<Text style={styles.planPriceUnit}> per device</Text></Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Device Management Fee</Text>
          <Text style={styles.headerSubtitle}>
            {isActive
              ? `You are currently on the ${billingData?.billing?.plan_type} billing plan`
              : 'Choose a billing plan for your devices'}
          </Text>
        </View>

        <View style={styles.deviceSummary}>
          <Text style={styles.deviceSummaryTitle}>Device Usage</Text>
          <View style={styles.deviceCountRow}>
            <Text style={styles.deviceCountLabel}>Total Devices:</Text>
            <Text style={styles.deviceCountValue}>{billingData?.total_devices || 0}</Text>
          </View>
          <View style={styles.deviceCountRow}>
            <Text style={styles.deviceCountLabel}>Free Devices:</Text>
            <Text style={styles.deviceCountValue}>{Math.min(3, billingData?.total_devices || 0)}</Text>
          </View>
          <View style={styles.deviceCountRow}>
            <Text style={styles.deviceCountLabel}>Billable Devices:</Text>
            <Text style={styles.deviceCountValue}>{billingData?.billable_devices || 0}</Text>
          </View>
          
          {onFreeTier && (
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
            'Pay month-to-month with flexibility to cancel anytime',
            '$3.99/mo'
          )}
          {renderPlanOption(
            'yearly',
            'Annual Billing',
            'Save 20% with annual billing',
            '$3.19/mo'
          )}
        </View>

        <Text style={styles.fineprint}>
          First 3 devices are always free. You will only be charged for devices beyond the free tier.
          Your payment covers the cost of securely handling device data and providing management services.
        </Text>

        {isActive ? (
          <TouchableOpacity
            style={styles.manageButton}
            onPress={openBillingPortal}
          >
            <Text style={styles.manageButtonText}>Manage Billing</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.activateButton}
            onPress={handleActivate}
          >
            <Text style={styles.activateButtonText}>
              {billingData?.billable_devices > 0
                ? `Activate - ${selectedPlan === 'monthly' ? '$3.99/mo' : '$3.19/mo'} per device`
                : 'Activate Free Tier'}
            </Text>
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
  planOptionCurrent: {
    borderColor: '#4CAF50',
    backgroundColor: 'rgba(76, 175, 80, 0.05)',
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
  currentPlanBadge: {
    backgroundColor: '#4CAF50',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  currentPlanBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  planDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  planPrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  planPriceUnit: {
    fontSize: 14,
    fontWeight: 'normal',
    color: '#666',
  },
  fineprint: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    marginVertical: 20,
    paddingHorizontal: 20,
    lineHeight: 18,
  },
  activateButton: {
    backgroundColor: ORANGE_COLOR,
    paddingVertical: 16,
    borderRadius: 8,
    marginHorizontal: 20,
    marginBottom: 30,
    alignItems: 'center',
  },
  activateButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  manageButton: {
    backgroundColor: '#333',
    paddingVertical: 16,
    borderRadius: 8,
    marginHorizontal: 20,
    marginBottom: 30,
    alignItems: 'center',
  },
  manageButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default DataHandlingFeeScreen;