import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from './Card';
import Button from './Button';

const { width } = Dimensions.get('window');

const getStatusColor = (status) => {
  const colors = {
    available: '#10B981',   // green
    assigned: '#3B82F6',    // blue
    damaged: '#EF4444',     // red
    stolen: '#6B7280',      // gray
    maintenance: '#F59E0B', // yellow
    lost: '#6B7280'         // gray
  };
  return colors[status] || colors.available;
};

const StandardDeviceCard = ({ 
  assignment, 
  onReturn, 
  onViewDetails, 
  style,
  showActiveStatus = true,
  showReturnButton = true 
}) => {
  const { device, assigned_date, user, location, returned_date } = assignment;
  const assignedTo = user ? user.full_name : location?.name || 'Unknown';
  const isActive = !returned_date;

  const renderMaintenanceInfo = () => {
    if (device.maintenance_interval && device.next_maintenance) {
      return (
        <Text style={styles.infoText}>
          Next Maintenance: {device.next_maintenance}
        </Text>
      );
    }
    return null;
  };

  const renderActiveStatus = () => {
    if (!showActiveStatus) return null;
    
    return (
      <View style={styles.statusRow}>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(device.status) }]}>
          <Text style={styles.statusText}>
            {device.status.charAt(0).toUpperCase() + device.status.slice(1)}
          </Text>
        </View>
        {isActive && (
          <View style={styles.activeBadge}>
            <Text style={styles.activeBadgeText}>ACTIVE</Text>
          </View>
        )}
        {!isActive && (
          <View style={styles.oldBadge}>
            <Text style={styles.oldBadgeText}>RETURNED</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <Card
      title={device.identifier}
      subtitle={device.device_type}
      style={[styles.deviceCard, !isActive && styles.inactiveCard, style]}
    >
      <View style={styles.cardContent}>
        {renderActiveStatus()}
        
        <View style={styles.cardInfo}>
          <Text style={styles.infoText}>Make: {device.make}</Text>
          <Text style={styles.infoText}>Model: {device.model}</Text>
          {device.serial_number && (
            <Text style={styles.infoText}>SN: {device.serial_number}</Text>
          )}
          <Text style={styles.infoText}>Assigned: {assigned_date}</Text>
          {returned_date && (
            <Text style={styles.infoText}>Returned: {returned_date}</Text>
          )}
          {renderMaintenanceInfo()}
        </View>
        
        <View style={styles.cardActions}>
          <Button
            title="View Details"
            variant="outlined"
            size="small"
            textColor="#FF9500"
            onPress={() => onViewDetails(device.id)}
            style={styles.detailsButton}
          />
          
          {showReturnButton && isActive && (
            <Button
              title="Return"
              variant="outlined"
              size="small"
              textColor="#d27300"
              onPress={() => onReturn(assignment)}
              style={[styles.returnButton, { marginTop: 8 }]}
            />
          )}
        </View>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  deviceCard: {
    width: (width * 0.45),
    marginBottom: '4%',
    borderColor: '#FF9500',
    borderWidth: 1,
  },
  inactiveCard: {
    opacity: 0.7,
    borderColor: '#ccc',
  },
  cardContent: {
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    width: '100%',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  activeBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  activeBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  oldBadge: {
    backgroundColor: '#6B7280',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  oldBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  cardInfo: {
    marginBottom: '2%',
    width: '100%',
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  cardActions: {
    alignSelf: 'flex-end',
    width: '100%',
  },
  detailsButton: {
    width: '100%',
    borderColor: '#FF9500',
    backgroundColor: 'transparent',
  },
  returnButton: {
    width: '100%',
    borderColor: '#d27300',
    backgroundColor: 'transparent',
  },
});

export default StandardDeviceCard;