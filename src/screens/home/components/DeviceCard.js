// components/DeviceCard/DeviceCard.js
import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Card from '../../../components/Card';
import Button from '../../../components/Button';

const { width } = Dimensions.get('window');

// Mock data matching Django models
export const mockAssignments = [
  {
    id: 1,
    device: {
      id: 1,
      identifier: "BAT-001",
      description: "18V Lithium Battery",
      make: "Milwaukee",
      model: "M18",
      device_type: "Battery",
      serial_number: "M18B5-2024-001",
      status: "assigned",
      is_active: true,
      maintenance_interval: 90,
      next_maintenance: "2024-05-20"
    },
    user: {
      id: 1,
      full_name: "John Doe"
    },
    location: null,
    assigned_date: "2024-02-15",
    returned_date: null,
    assigned_by: {
      id: 2,
      full_name: "Admin User"
    }
  },
  {
    id: 2,
    device: {
      id: 2,
      identifier: "DRL-002",
      description: "20V MAX Cordless Drill",
      make: "DeWalt",
      model: "DCD777C2",
      device_type: "Drill",
      serial_number: "DW2024-002",
      status: "maintenance",
      is_active: true,
      maintenance_interval: 30,
      next_maintenance: "2024-03-15"
    },
    user: null,
    location: {
      id: 1,
      name: "Main Workshop"
    },
    assigned_date: "2024-02-16",
    returned_date: null,
    assigned_by: {
      id: 2,
      full_name: "Admin User"
    }
  },
  {
    id: 3,
    device: {
      id: 3,
      identifier: "CHG-003",
      description: "Fast Charger for M18 Batteries",
      make: "Milwaukee",
      model: "48-59-1812",
      device_type: "Charger",
      serial_number: "CHG2024-003",
      status: "damaged",
      is_active: true,
      maintenance_interval: null,
      next_maintenance: null
    },
    user: {
      id: 3,
      full_name: "Sarah Wilson"
    },
    location: null,
    assigned_date: "2024-02-18",
    returned_date: null,
    assigned_by: {
      id: 2,
      full_name: "Admin User"
    }
  },
  {
    id: 4,
    device: {
      id: 4,
      identifier: "SAW-004",
      description: "Cordless Circular Saw",
      make: "Makita",
      model: "XSH04ZB",
      device_type: "Saw",
      serial_number: "MK2024-004",
      status: "assigned",
      is_active: true,
      maintenance_interval: 60,
      next_maintenance: "2024-04-20"
    },
    user: null,
    location: {
      id: 2,
      name: "Site B Construction"
    },
    assigned_date: "2024-02-19",
    returned_date: null,
    assigned_by: {
      id: 2,
      full_name: "Admin User"
    }
  },
  {
    id: 5,
    device: {
      id: 5,
      identifier: "ADP-005",
      description: "Power Adapter Kit",
      make: "DeWalt",
      model: "DCB094K",
      device_type: "Adapter",
      serial_number: "ADP2024-005",
      status: "stolen",
      is_active: false,
      maintenance_interval: null,
      next_maintenance: null
    },
    user: {
      id: 4,
      full_name: "Mike Johnson"
    },
    location: null,
    assigned_date: "2024-02-20",
    returned_date: null,
    assigned_by: {
      id: 2,
      full_name: "Admin User"
    }
  }
];

const getStatusColor = (status) => {
  const colors = {
    available: '#10B981', // green
    assigned: '#3B82F6', // blue
    damaged: '#EF4444',  // red
    stolen: '#6B7280',   // gray
    maintenance: '#F59E0B', // yellow
    lost: '#6B7280'      // gray
  };
  return colors[status] || colors.available;
};

const DeviceCard = ({ assignment, onReturn, style }) => {
  const { device, assigned_date, user, location } = assignment;
  const assignedTo = user ? user.full_name : location?.name || 'Unknown';

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

  return (
    <Card
      title={device.identifier}
      subtitle={device.device_type}
      style={[styles.deviceCard, style]}
    >
      <View style={styles.cardContent}>
        <View style={styles.statusContainer}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(device.status) }]}>
            <Text style={styles.statusText}>{device.status.charAt(0).toUpperCase() + device.status.slice(1)}</Text>
          </View>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.infoText}>Make: {device.make}</Text>
          <Text style={styles.infoText}>Model: {device.model}</Text>
          {device.serial_number && (
            <Text style={styles.infoText}>SN: {device.serial_number}</Text>
          )}
          <Text style={styles.infoText}>Assigned: {assigned_date}</Text>
          {renderMaintenanceInfo()}
        </View>
        <View style={styles.cardActions}>
          <Button
            title="Return"
            variant="outlined"
            size="small"
            textColor="#d27300"
            onPress={() => onReturn(assignment)}
            style={styles.returnButton}
          />
        </View>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  deviceCard: {
    width: (width * 0.45),
    marginBottom: '4%',
  },
  cardContent: {
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    width: '100%',
  },
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
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
  returnButton: {
    width: '100%',
    borderColor: '#d27300',
  },
});

export default DeviceCard;