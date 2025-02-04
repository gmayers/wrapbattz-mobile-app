// DeviceCard.js
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Button from '../../../../components/Button';
import Card from '../../../../components/Card';

const { width } = Dimensions.get('window');

/**
 * DeviceCard Component
 * @param {Object} props Component props
 * @param {Object} props.assignment Device assignment data
 * @param {Function} props.onReturn Callback when return button is pressed
 * @param {Object} props.style Additional styles for the card
 * @returns {JSX.Element} DeviceCard component
 */
const DeviceCard = ({ 
  assignment, 
  onReturn, 
  style,
  onPress
}) => {
  // Format date to local string
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  // Get status color based on device type
  const getStatusColor = (deviceType) => {
    switch (deviceType?.toUpperCase()) {
      case 'BATTERY':
        return '#4CAF50'; // Green
      case 'CHARGER':
        return '#2196F3'; // Blue
      case 'ADAPTER':
        return '#FF9800'; // Orange
      case 'CABLE':
        return '#9C27B0'; // Purple
      case 'DRILL':
        return '#F44336'; // Red
      case 'SAW':
        return '#795548'; // Brown
      default:
        return '#757575'; // Grey
    }
  };

  if (!assignment || !assignment.device) {
    return null;
  }

  const { device } = assignment;

  return (
    <Card
      style={[styles.card, style]}
      onPress={onPress}
    >
      {/* Header Section */}
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.identifier} numberOfLines={1}>
            {device.identifier || 'Unknown Device'}
          </Text>
          <View 
            style={[
              styles.statusDot, 
              { backgroundColor: getStatusColor(device.device_type) }
            ]} 
          />
        </View>
        <Text style={styles.type}>
          {device.device_type || 'No Type'}
        </Text>
      </View>

      {/* Content Section */}
      <View style={styles.content}>
        <View style={styles.infoRow}>
          <Ionicons name="business-outline" size={16} color="#666" />
          <Text style={styles.infoText}>
            Make: {device.make || 'N/A'}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="construct-outline" size={16} color="#666" />
          <Text style={styles.infoText}>
            Model: {device.model || 'N/A'}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="calendar-outline" size={16} color="#666" />
          <Text style={styles.infoText}>
            Assigned: {formatDate(assignment.assigned_date)}
          </Text>
        </View>

        {assignment.due_date && (
          <View style={styles.infoRow}>
            <Ionicons name="alarm-outline" size={16} color="#666" />
            <Text style={styles.infoText}>
              Due: {formatDate(assignment.due_date)}
            </Text>
          </View>
        )}
      </View>

      {/* Actions Section */}
      <View style={styles.actions}>
        <Button
          title="Return"
          onPress={() => onReturn(assignment)}
          variant="outlined"
          size="small"
          style={styles.returnButton}
          accessibilityLabel={`Return ${device.identifier}`}
          accessibilityHint="Opens the device return dialog"
        />
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    width: (width - 50) / 2, // Two cards per row with spacing
    marginBottom: 15,
    padding: 12,
  },
  header: {
    marginBottom: 12,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  identifier: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    marginRight: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  type: {
    fontSize: 12,
    color: '#666',
    textTransform: 'uppercase',
  },
  content: {
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 6,
  },
  infoText: {
    fontSize: 13,
    color: '#666',
    flex: 1,
  },
  actions: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E0E0E0',
    paddingTop: 12,
  },
  returnButton: {
    width: '100%',
    minHeight: 36,
  },
});

export default DeviceCard;