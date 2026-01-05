// components/DeviceInfoDisplay.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Component to display device information in a structured, readable format
 * Handles various field name variations and formats device data nicely
 */
const DeviceInfoDisplay = ({ deviceData, style }) => {
  if (!deviceData || typeof deviceData !== 'object') {
    return (
      <View style={[styles.container, style]}>
        <Text style={styles.errorText}>No valid device data available</Text>
      </View>
    );
  }

  // Define field mappings with labels and possible field names (case-insensitive)
  const fieldMappings = [
    {
      label: 'Device ID',
      icon: 'barcode-outline',
      possibleKeys: ['deviceId', 'device_id', 'id', 'ID', 'identifier'],
    },
    {
      label: 'Make',
      icon: 'business-outline',
      possibleKeys: ['make', 'Make', 'manufacturer', 'Manufacturer', 'brand', 'Brand'],
    },
    {
      label: 'Model',
      icon: 'hardware-chip-outline',
      possibleKeys: ['model', 'Model', 'modelNumber', 'model_number'],
    },
    {
      label: 'Device Type',
      icon: 'construct-outline',
      possibleKeys: ['deviceType', 'device_type', 'type', 'Type', 'category', 'Category'],
    },
    {
      label: 'Serial Number',
      icon: 'keypad-outline',
      possibleKeys: ['serialNumber', 'serial_number', 'serial', 'Serial', 'serialNo', 'serial_no'],
    },
    {
      label: 'Description',
      icon: 'document-text-outline',
      possibleKeys: ['description', 'Description', 'desc', 'Desc', 'details', 'Details'],
    },
    {
      label: 'Maintenance Interval',
      icon: 'time-outline',
      possibleKeys: ['maintenanceInterval', 'maintenance_interval', 'interval', 'Interval', 'maintenanceDays', 'maintenance_days'],
    },
    {
      label: 'Next Maintenance Date',
      icon: 'calendar-outline',
      possibleKeys: ['nextMaintenanceDate', 'next_maintenance_date', 'nextMaintenance', 'next_maintenance', 'maintenanceDate', 'maintenance_date'],
    },
  ];

  // Helper function to find value using case-insensitive key matching
  const findValue = (possibleKeys) => {
    for (const key of possibleKeys) {
      // Exact match first
      if (deviceData[key] !== undefined && deviceData[key] !== null && deviceData[key] !== '') {
        return String(deviceData[key]);
      }
    }

    // Case-insensitive match
    const lowerKeys = Object.keys(deviceData).reduce((acc, k) => {
      acc[k.toLowerCase()] = k;
      return acc;
    }, {});

    for (const possibleKey of possibleKeys) {
      const lowerKey = possibleKey.toLowerCase();
      if (lowerKeys[lowerKey]) {
        const actualKey = lowerKeys[lowerKey];
        const value = deviceData[actualKey];
        if (value !== undefined && value !== null && value !== '') {
          return String(value);
        }
      }
    }

    return null;
  };

  // Format the maintenance interval if it's a number (add "days" suffix)
  const formatMaintenanceInterval = (value) => {
    if (!value) return null;
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue)) {
      return `${numValue} days`;
    }
    return value;
  };

  // Render individual info row
  const renderInfoRow = (label, value, icon) => {
    if (!value) return null;

    // Special formatting for maintenance interval
    const displayValue = label === 'Maintenance Interval'
      ? formatMaintenanceInterval(value)
      : value;

    return (
      <View key={label} style={styles.infoRow}>
        <View style={styles.iconLabelContainer}>
          <Ionicons name={icon} size={20} color="#17a2b8" style={styles.icon} />
          <Text style={styles.label}>{label}:</Text>
        </View>
        <Text style={styles.value}>{displayValue}</Text>
      </View>
    );
  };

  // Collect all fields that have values
  const infoRows = fieldMappings
    .map(({ label, icon, possibleKeys }) => {
      const value = findValue(possibleKeys);
      return value ? renderInfoRow(label, value, icon) : null;
    })
    .filter(row => row !== null);

  // If no recognized fields found, show all available data as key-value pairs
  if (infoRows.length === 0) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.header}>
          <Ionicons name="information-circle-outline" size={24} color="#17a2b8" />
          <Text style={styles.headerText}>Tag Data</Text>
        </View>
        <View style={styles.infoContainer}>
          {Object.entries(deviceData).map(([key, value]) => (
            <View key={key} style={styles.infoRow}>
              <Text style={styles.label}>{key}:</Text>
              <Text style={styles.value}>{String(value)}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <Ionicons name="information-circle-outline" size={24} color="#17a2b8" />
        <Text style={styles.headerText}>Device Information</Text>
      </View>
      <View style={styles.infoContainer}>
        {infoRows}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 15,
    marginTop: 15,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#dee2e6',
  },
  headerText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  infoContainer: {
    gap: 10,
  },
  infoRow: {
    marginBottom: 8,
  },
  iconLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  icon: {
    marginRight: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
  },
  value: {
    fontSize: 15,
    color: '#333',
    marginLeft: 26, // Indent to align with label (icon width + margins)
    lineHeight: 22,
  },
  errorText: {
    fontSize: 14,
    color: '#dc3545',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default DeviceInfoDisplay;
