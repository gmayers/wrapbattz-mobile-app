import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  SafeAreaView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

const PricingScreen = ({ navigation }) => {
  const [isAnnual, setIsAnnual] = useState(true);
  
  const toggleBilling = () => {
    setIsAnnual(!isAnnual);
  };
  
  // Price calculations based on billing period
  const professionalPrice = isAnnual ? '25p' : '30p';
  const professionalPeriod = isAnnual ? 'per asset/month, billed annually' : 'per asset/month, billed monthly';
  
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.appScreen}>
        <View style={styles.bgGradient} />
        <View style={styles.bgGradient2} />
        
        <View style={styles.titleSection}>
          <Text style={styles.pageTitle}>Choose Your Plan</Text>
          <Text style={styles.pageSubtitle}>Simple, transparent pricing that scales with your needs</Text>
        </View>
        
        <View style={styles.toggleContainer}>
          <Text style={[styles.toggleOption, !isAnnual && styles.toggleOptionActive]}>Monthly</Text>
          <TouchableOpacity style={styles.toggleSwitch} onPress={toggleBilling} activeOpacity={0.8}>
            <View style={[styles.toggleSwitchThumb, !isAnnual && styles.toggleSwitchThumbLeft]} />
          </TouchableOpacity>
          <Text style={[styles.toggleOption, isAnnual && styles.toggleOptionActive]}>
            Annually {isAnnual && '(Save 16%)'}
          </Text>
        </View>
        
        <View style={styles.pricingCards}>
          <View style={styles.pricingCard}>
            <Text style={styles.planName}>Starter</Text>
            <Text style={styles.planPrice}>FREE</Text>
            <Text style={styles.pricePeriod}>First 3 assets free forever</Text>
            <View style={styles.planFeatures}>
              <FeatureItem text="Up to 3 managed assets" />
              <FeatureItem text="Basic reporting tools" />
              <FeatureItem text="Email support" />
            </View>
            <TouchableOpacity style={styles.ctaButtonOutline}>
              <Text style={[styles.ctaButtonText, {color: '#FF7700'}]}>Get Started</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.pricingCardFeatured}>
            <View style={styles.cardBadge}>
              <Text style={styles.cardBadgeText}>Popular</Text>
            </View>
            <Text style={styles.planName}>Professional</Text>
            <Text style={styles.planPrice}>{professionalPrice}</Text>
            <Text style={styles.pricePeriod}>{professionalPeriod}</Text>
            <View style={styles.planFeatures}>
              <FeatureItem text="Unlimited managed assets" />
              <FeatureItem text="Advanced analytics" />
              <FeatureItem text="Priority support" />
            </View>
            <TouchableOpacity style={styles.ctaButton}>
              <Text style={styles.ctaButtonText}>Choose Plan</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.volumeSection}>
          <Text style={styles.sectionHeading}>Volume Discounts</Text>
          <View style={styles.volumeGrid}>
            <VolumeItem range="100-400" price="Reduced rates" />
            <VolumeItem range="400-1000" price="Further discounts" />
            <VolumeItem range="1000+" price="Custom pricing" />
          </View>
        </View>
        
        <View style={styles.missingFeature}>
          <Text style={styles.missingTitle}>Missing a Feature?</Text>
          <Text style={styles.missingText}>
            We're always open to suggestions to improve BattWrapz.
          </Text>
        <TouchableOpacity 
  style={styles.ctaButton}
  onPress={() => navigation.navigate('SuggestFeature')}
>
  <Text style={styles.ctaButtonText}>Suggest a Feature</Text>
</TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const FeatureItem = ({ text }) => (
  <View style={styles.featureItem}>
    <Text style={styles.featureIcon}>✓</Text>
    <Text style={styles.featureText}>{text}</Text>
  </View>
);

const VolumeItem = ({ range, price }) => (
  <View style={styles.volumeItem}>
    <Text style={styles.volumeRange}>{range}</Text>
    <Text style={styles.volumePrice}>{price}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  appScreen: {
    flex: 1,
    backgroundColor: '#1E1E1E',
    justifyContent: 'space-between',
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
    marginTop: 16,
    marginBottom: 12,
    paddingHorizontal: 20,
    zIndex: 1,
  },
  pageTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  pageSubtitle: {
    color: '#AAA',
    fontSize: 14,
    lineHeight: 18,
    textAlign: 'center',
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
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
    backgroundColor: '#FF7700',
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
  },
  pricingCard: {
    flex: 1,
    backgroundColor: '#2A2A2A',
    borderRadius: 16,
    padding: 14,
    position: 'relative',
    overflow: 'hidden',
    height: height * 0.25, // Responsive height
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 3,
  },
  pricingCardFeatured: {
    flex: 1,
    backgroundColor: '#2A2A2A',
    borderRadius: 16,
    padding: 14,
    position: 'relative',
    overflow: 'hidden',
    height: height * 0.25, // Responsive height
    borderWidth: 1,
    borderColor: '#FF7700',
    shadowColor: "#FF7700",
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.29,
    shadowRadius: 4.65,
    elevation: 5,
  },
  cardBadge: {
    position: 'absolute',
    top: 10,
    right: -25,
    backgroundColor: '#FF7700',
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
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  planPrice: {
    color: '#FF7700',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 2,
  },
  pricePeriod: {
    color: '#AAA',
    fontSize: 12,
    marginBottom: 8,
  },
  planFeatures: {
    marginBottom: 10,
    flex: 1,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  featureIcon: {
    color: '#FF7700',
    marginRight: 6,
    fontSize: 14,
    fontWeight: 'bold',
  },
  featureText: {
    color: '#DDD',
    fontSize: 13,
    lineHeight: 16,
  },
  ctaButton: {
    backgroundColor: '#FF7700',
    borderRadius: 25,
    paddingVertical: 8,
    width: '100%',
    alignItems: 'center',
  },
  ctaButtonOutline: {
    backgroundColor: 'transparent',
    borderRadius: 25,
    paddingVertical: 8,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FF7700',
  },
  ctaButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  volumeSection: {
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
    zIndex: 1,
  },
  sectionHeading: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  volumeGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  volumeItem: {
    flex: 1,
    backgroundColor: 'rgba(255, 119, 0, 0.1)',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
  },
  volumeRange: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  volumePrice: {
    color: '#AAA',
    fontSize: 11,
  },
  missingFeature: {
    backgroundColor: 'rgba(255, 119, 0, 0.05)',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    marginHorizontal: 16,
    zIndex: 1,
  },
  missingTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
    color: '#FF7700',
  },
  missingText: {
    fontSize: 12,
    color: '#CCC',
    marginBottom: 10,
    textAlign: 'center',
  },
});

export default PricingScreen;