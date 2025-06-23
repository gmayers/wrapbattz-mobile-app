// DevicesList.js
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Button from '../../../../components/Button';
import StandardDeviceCard from '../../../components/StandardDeviceCard';

const { width } = Dimensions.get('window');

/**
 * DevicesList Component
 * @param {Object} props Component props
 * @param {Array} props.devices List of device assignments
 * @param {boolean} props.loading Loading state
 * @param {boolean} props.refreshing Refresh state
 * @param {Function} props.onRefresh Refresh callback
 * @param {Function} props.onReturnDevice Return device callback
 * @param {Function} props.onViewAll View all devices callback
 * @param {Object} props.navigation Navigation object
 * @returns {JSX.Element} DevicesList component
 */
const DevicesList = ({
  devices = [],
  loading = false,
  refreshing = false,
  onRefresh,
  onReturnDevice,
  onViewAll,
  navigation,
}) => {
  // Count devices by type
  const getDeviceTypeCounts = () => {
    return devices.reduce((acc, { device }) => {
      const type = device.device_type || 'Unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});
  };

  // Render header with counts
  const renderHeader = () => (
    <View style={styles.sectionHeader}>
      <View>
        <Text style={styles.sectionTitle}>Devices Assigned</Text>
        <Text style={styles.deviceCount}>
          {devices.length} {devices.length === 1 ? 'device' : 'devices'} assigned
        </Text>
      </View>
      <Button
        title="Add Device"
        onPress={() => navigation?.navigate('AddDevice')}
        size="small"
        style={styles.addDeviceButton}
      />
    </View>
  );

  // Render device type summary
  const renderTypeSummary = () => {
    const counts = getDeviceTypeCounts();
    return (
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.typeSummaryContainer}
        contentContainerStyle={styles.typeSummaryContent}
      >
        {Object.entries(counts).map(([type, count]) => (
          <View key={type} style={styles.typeCard}>
            <Text style={styles.typeCount}>{count}</Text>
            <Text style={styles.typeLabel}>{type}</Text>
          </View>
        ))}
      </ScrollView>
    );
  };

  // Render loading state
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  // Render empty state
  if (!loading && devices.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="cube-outline" size={48} color="#666" />
        <Text style={styles.emptyText}>No devices currently assigned</Text>
        <Button
          title="Add Device"
          onPress={() => navigation?.navigate('AddDevice')}
          size="small"
          style={styles.emptyAddButton}
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={['#007AFF']}
          tintColor="#007AFF"
        />
      }
    >
      {renderHeader()}
      
      {devices.length > 0 && renderTypeSummary()}

      <View style={styles.devicesGrid}>
        {devices.slice(0, 6).map((assignment) => (
          <StandardDeviceCard
            key={assignment.id}
            assignment={assignment}
            onReturn={onReturnDevice}
            onViewDetails={(deviceId) => navigation?.navigate('DeviceDetails', { 
              deviceId,
              sourceScreen: 'Home'
            })}
            style={styles.deviceCard}
          />
        ))}
      </View>

      {devices.length > 6 && (
        <TouchableOpacity
          style={styles.viewAllButton}
          onPress={onViewAll || (() => navigation?.navigate('AllDevices', { devices }))}
        >
          <Text style={styles.viewAllText}>
            View All ({devices.length} Devices)
          </Text>
          <Ionicons name="chevron-forward" size={16} color="#007AFF" />
        </TouchableOpacity>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 15,
    paddingBottom: Platform.OS === 'ios' ? 100 : 80,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  deviceCount: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  addDeviceButton: {
    minWidth: 100,
  },
  typeSummaryContainer: {
    marginBottom: 15,
  },
  typeSummaryContent: {
    paddingHorizontal: 5,
  },
  typeCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    marginRight: 10,
    minWidth: 80,
    alignItems: 'center',
  },
  typeCount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  typeLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  devicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  deviceCard: {
    marginBottom: 15,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginTop: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  viewAllText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '500',
    marginRight: 4,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
    marginBottom: 20,
    textAlign: 'center',
  },
  emptyAddButton: {
    minWidth: 120,
  },
});

export default DevicesList;