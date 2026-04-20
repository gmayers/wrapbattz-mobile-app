import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  SafeAreaView,
  TouchableOpacity,
  Dimensions,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';

const { width, height } = Dimensions.get('window');

const PricingScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const [isAnnual, setIsAnnual] = useState(true);

  const toggleBilling = () => {
    setIsAnnual(!isAnnual);
  };

  // Price calculations based on billing period
  const professionalPrice = isAnnual ? '25p' : '30p';
  const professionalPeriod = isAnnual ? 'per asset/month,\nbilled annually' : 'per asset/month,\nbilled monthly';

  const handlePlanSelection = (planType) => {
    // Navigate to Register screen with selected plan
    navigation.navigate('Register', {
      selectedPlan: {
        type: planType,
        billing: isAnnual ? 'annual' : 'monthly',
        price: planType === 'starter' ? 'FREE' : professionalPrice,
      }
    });
  };
  
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.appScreen, { backgroundColor: colors.surfaceAlt }]}>
          <View style={styles.bgGradient} />
          <View style={styles.bgGradient2} />

          <View style={styles.titleSection}>
            <Text style={[styles.pageTitle, { color: colors.textPrimary }]}>Choose Your Plan</Text>
            <Text style={[styles.pageSubtitle, { color: colors.textMuted }]}>Simple, transparent pricing that scales with your needs</Text>
          </View>
        
        <View style={styles.toggleContainer}>
          <Text style={[styles.toggleOption, { color: colors.textMuted }, !isAnnual && [styles.toggleOptionActive, { color: colors.textPrimary }]]}>Monthly</Text>
          <TouchableOpacity style={[styles.toggleSwitch, { backgroundColor: colors.primary }]} onPress={toggleBilling} activeOpacity={0.8}>
            <View style={[styles.toggleSwitchThumb, !isAnnual && styles.toggleSwitchThumbLeft]} />
          </TouchableOpacity>
          <Text style={[styles.toggleOption, { color: colors.textMuted }, isAnnual && [styles.toggleOptionActive, { color: colors.textPrimary }]]}>
            Annually {isAnnual && '(Save 16%)'}
          </Text>
        </View>
        
        <View style={styles.pricingCards}>
          <View style={[styles.pricingCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.planName, { color: colors.textPrimary }]}>Starter</Text>
            <Text style={[styles.planPrice, { color: colors.primary }]}>FREE</Text>
            <Text style={[styles.pricePeriod, { color: colors.textMuted }]}>First 3 assets free forever</Text>
            <View style={styles.planFeatures}>
              <FeatureItem text="Up to 3 managed assets" />
              <FeatureItem text="Basic reporting tools" />
              <FeatureItem text="Email support" />
            </View>
            <TouchableOpacity style={[styles.ctaButtonOutline, { borderColor: colors.primary }]} onPress={() => handlePlanSelection('starter')}>
              <Text style={[styles.ctaButtonText, {color: colors.primary}]}>Get Started</Text>
            </TouchableOpacity>
          </View>
          
          <View style={[styles.pricingCardFeatured, { backgroundColor: colors.card, borderColor: colors.primary }]}>
            <View style={[styles.cardBadge, { backgroundColor: colors.primary }]}>
              <Text style={styles.cardBadgeText}>Popular</Text>
            </View>
            <Text style={[styles.planName, { color: colors.textPrimary }]}>Professional</Text>
            <Text style={[styles.planPrice, { color: colors.primary }]}>{professionalPrice}</Text>
            <Text style={[styles.pricePeriod, { color: colors.textMuted }]}>{professionalPeriod}</Text>
            <View style={styles.planFeatures}>
              <FeatureItem text="Unlimited managed assets" />
              <FeatureItem text="Advanced analytics" />
              <FeatureItem text="Priority support" />
            </View>
            <TouchableOpacity style={[styles.ctaButton, { backgroundColor: colors.primary }]} onPress={() => handlePlanSelection('professional')}>
              <Text style={styles.ctaButtonText}>Choose Plan</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.volumeSection}>
          <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>Volume Discounts</Text>
          <View style={styles.volumeGrid}>
            <VolumeItem range="100-400" price="Reduced rates" />
            <VolumeItem range="400-1000" price="Further discounts" />
            <VolumeItem range="1000+" price="Custom pricing" />
          </View>
        </View>
        
        <View style={styles.missingFeature}>
          <Text style={[styles.missingTitle, { color: colors.primary }]}>Missing a Feature?</Text>
          <Text style={[styles.missingText, { color: colors.textSecondary }]}>
            We're always open to suggestions to improve TOOLTRAQ.
          </Text>
        <TouchableOpacity
  style={[styles.ctaButton, { backgroundColor: colors.primary }]}
  onPress={() => navigation.navigate('SuggestFeature')}
>
  <Text style={styles.ctaButtonText}>Suggest a Feature</Text>
</TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const FeatureItem = ({ text }) => {
  const { colors } = useTheme();
  return (
    <View style={styles.featureItem}>
      <Text style={[styles.featureIcon, { color: colors.primary }]}>✓</Text>
      <Text style={[styles.featureText, { color: colors.textSecondary }]}>{text}</Text>
    </View>
  );
};

const VolumeItem = ({ range, price }) => {
  const { colors } = useTheme();
  return (
    <View style={styles.volumeItem}>
      <Text style={[styles.volumeRange, { color: colors.textPrimary }]}>{range}</Text>
      <Text style={[styles.volumePrice, { color: colors.textMuted }]}>{price}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  appScreen: {
    flex: 1,
    backgroundColor: '#1E1E1E',
    paddingBottom: 16,
  },
  bgGradient: {
    position: 'absolute',
    top: -140,
    right: -140,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(255, 119, 0, 0.1)',
    opacity: 0.7,
    zIndex: 0,
  },
  bgGradient2: {
    position: 'absolute',
    bottom: -120,
    left: -120,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(255, 119, 0, 0.06)',
    opacity: 0.7,
    zIndex: 0,
  },
  titleSection: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 24,
    paddingHorizontal: 20,
    zIndex: 1,
  },
  pageTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  pageSubtitle: {
    color: '#AAA',
    fontSize: 15,
    lineHeight: 20,
    textAlign: 'center',
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    zIndex: 1,
  },
  toggleOption: {
    fontSize: 15,
    color: '#AAA',
    paddingHorizontal: 12,
    fontWeight: '400',
  },
  toggleOptionActive: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  toggleSwitch: {
    width: 50,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFC72C',
    position: 'relative',
  },
  toggleSwitchThumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    top: 3,
    right: 3,
    // Add transition animation
    transform: [{ translateX: 0 }],
  },
  toggleSwitchThumbLeft: {
    right: 'auto',
    left: 3,
  },
  pricingCards: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    zIndex: 1,
    marginBottom: 24,
  },
  pricingCard: {
    flex: 1,
    backgroundColor: '#2A2A2A',
    borderRadius: 16,
    padding: 16,
    position: 'relative',
    overflow: 'hidden',
    minHeight: height * 0.35,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 3,
    justifyContent: 'space-between',
  },
  pricingCardFeatured: {
    flex: 1,
    backgroundColor: '#2A2A2A',
    borderRadius: 16,
    padding: 16,
    position: 'relative',
    overflow: 'hidden',
    minHeight: height * 0.35,
    borderWidth: 1,
    borderColor: '#FFC72C',
    shadowColor: "#FFC72C",
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.29,
    shadowRadius: 4.65,
    elevation: 5,
    justifyContent: 'space-between',
  },
  cardBadge: {
    position: 'absolute',
    top: 10,
    right: -25,
    backgroundColor: '#FFC72C',
    paddingHorizontal: 25,
    paddingVertical: 3,
    transform: [{ rotate: '45deg' }],
  },
  cardBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  planName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  planPrice: {
    color: '#FFC72C',
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 4,
  },
  pricePeriod: {
    color: '#AAA',
    fontSize: 11,
    marginBottom: 12,
    minHeight: 36,
    lineHeight: 16,
  },
  planFeatures: {
    marginBottom: 16,
    flex: 1,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  featureIcon: {
    color: '#FFC72C',
    marginRight: 8,
    fontSize: 14,
    fontWeight: 'bold',
  },
  featureText: {
    color: '#DDD',
    fontSize: 13,
    lineHeight: 17,
    flex: 1,
  },
  ctaButton: {
    backgroundColor: '#FFC72C',
    borderRadius: 25,
    paddingVertical: 12,
    width: '100%',
    alignItems: 'center',
    marginTop: 'auto', // Push to bottom of card
  },
  ctaButtonOutline: {
    backgroundColor: 'transparent',
    borderRadius: 25,
    paddingVertical: 12,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFC72C',
    marginTop: 'auto', // Push to bottom of card
  },
  ctaButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  volumeSection: {
    paddingHorizontal: 16,
    marginBottom: 24,
    zIndex: 1,
  },
  sectionHeading: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  volumeGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  volumeItem: {
    flex: 1,
    backgroundColor: 'rgba(255, 119, 0, 0.1)',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  volumeRange: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  volumePrice: {
    color: '#AAA',
    fontSize: 12,
  },
  missingFeature: {
    backgroundColor: 'rgba(255, 119, 0, 0.05)',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 20,
    zIndex: 1,
  },
  missingTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    color: '#FFC72C',
  },
  missingText: {
    fontSize: 14,
    color: '#CCC',
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default PricingScreen;