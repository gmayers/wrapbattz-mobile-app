// src/screens/HomeScreen/components/DevicesList.tsx
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Button from '../../../components/Button';
import StandardDeviceCard from '../../../components/StandardDeviceCard';

const ORANGE_COLOR = '#FF9500';

interface Assignment {
  id: string;
  device: {
    id: string;
    identifier: string;
    device_type: string;
    current_assignment?: {
      id: string;
    };
  };
  user: string;
  location: any;
  assigned_date: string;
  returned_date?: string;
}

interface DevicesListProps {
  assignments: Assignment[];
  loading: boolean;
  isAdminOrOwner: boolean;
  onDevicePress: (deviceId: string) => void;
  onDeviceReturn: (assignment: Assignment) => void;
  onViewAllPress: () => void;
  onAddDevicePress: () => void;
}

const DevicesList: React.FC<DevicesListProps> = ({
  assignments,
  loading,
  isAdminOrOwner,
  onDevicePress,
  onDeviceReturn,
  onViewAllPress,
  onAddDevicePress,
}) => {
  const renderDeviceCard = (assignment: Assignment) => (
    <StandardDeviceCard
      key={assignment.id}
      assignment={assignment}
      onReturn={onDeviceReturn}
      onViewDetails={onDevicePress}
      style={styles.deviceCard}
      showActiveStatus={true}
      showReturnButton={true}
    />
  );

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          Your Assigned Devices
        </Text>
        {isAdminOrOwner && (
          <Button
            title="Add Device"
            onPress={onAddDevicePress}
            size="small"
            textColor="black"
            style={[styles.addDeviceButton, { backgroundColor: ORANGE_COLOR }]}
            testID="add-device-button"
          />
        )}
      </View>
      
      <View style={styles.section}>
        {loading ? (
          <ActivityIndicator 
            size="large" 
            color={ORANGE_COLOR} 
            style={styles.loader}
            testID="devices-loading-indicator"
          />
        ) : (
          <View style={styles.devicesContainer}>
            {assignments.length === 0 ? (
              <Text style={styles.emptyText} testID="no-devices-text">
                You have no devices assigned
              </Text>
            ) : (
              <View style={styles.devicesGrid}>
                {/* Always show up to 5 device cards in the main view */}
                {assignments.slice(0, 5).map((assignment) => renderDeviceCard(assignment))}
              </View>
            )}
            
            {/* Always show View All button */}
            <TouchableOpacity
              style={styles.viewAllButton}
              onPress={onViewAllPress}
              activeOpacity={0.7}
              testID="view-all-devices-button"
            >
              <Text style={[styles.viewAllText, { color: ORANGE_COLOR }]}>
                View All ({assignments.length} Devices)
              </Text>
              <Ionicons name="chevron-forward" size={16} color={ORANGE_COLOR} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '3%',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  addDeviceButton: {
    paddingHorizontal: 12,
    height: 40,
    minWidth: Platform.OS === 'ios' ? 140 : 'auto',
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    marginBottom: '5%',
  },
  devicesContainer: {
    flex: 1,
  },
  devicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  deviceCard: {
    marginBottom: 15,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginTop: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    height: 48,
    width: '100%',
  },
  viewAllText: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  loader: {
    marginVertical: '5%',
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    marginVertical: '5%',
  },
});

export default DevicesList;