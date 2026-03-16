// components/DeviceInfoDisplay.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

/**
 * Component to display device information in a structured, readable format
 * Handles various field name variations and formats device data nicely
 */
const DeviceInfoDisplay = ({ deviceData, style }) => {
  const { colors } = useTheme();
  if (!deviceData || typeof deviceData !== 'object') {
    return (
      <View style={[styles.container, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }, style]}>
        <Text style={[styles.errorText, { color: colors.error }]}>No valid device data available</Text>
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
      possibleKeys: ['serialNumber', 'serial_number', 'sn', 'serial', 'Serial', 'serialNo', 'serial_no'],
    },
    {
      label: 'Description',
      icon: 'document-text-outline',
      possibleKeys: ['description', 'Description', 'desc', 'Desc', 'details', 'Details'],
    },
    {
      label: 'Maintenance Interval',
      icon: 'time-outline',
      possibleKeys: ['maintenanceInterval', 'maintenance_interval', 'maint', 'interval', 'Interval', 'maintenanceDays', 'maintenance_days'],
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
          <Ionicons name={icon} size={20} color={colors.info} style={styles.icon} />
          <Text style={[styles.label, { color: colors.textSecondary }]}>{label}:</Text>
        </View>
        <Text style={[styles.value, { color: colors.textPrimary }]}>{displayValue}</Text>
      </View>
    );
  };

  // Track which keys were matched by fieldMappings
  const matchedKeys = new Set();

  // Collect all fields that have values
  const infoRows = fieldMappings
    .map(({ label, icon, possibleKeys }) => {
      const value = findValue(possibleKeys);
      if (value) {
        // Record which key was matched
        for (const key of possibleKeys) {
          if (deviceData[key] !== undefined && deviceData[key] !== null && deviceData[key] !== '') {
            matchedKeys.add(key);
            break;
          }
          // Check case-insensitive
          const lowerKey = key.toLowerCase();
          const actualKey = Object.keys(deviceData).find(k => k.toLowerCase() === lowerKey);
          if (actualKey && deviceData[actualKey] !== undefined && deviceData[actualKey] !== null && deviceData[actualKey] !== '') {
            matchedKeys.add(actualKey);
            break;
          }
        }
        return renderInfoRow(label, value, icon);
      }
      return null;
    })
    .filter(row => row !== null);

  // Collect custom keys not matched by any field mapping
  const customRows = Object.entries(deviceData)
    .filter(([key, value]) => !matchedKeys.has(key) && value !== undefined && value !== null && value !== '')
    .map(([key, value]) => renderInfoRow(key, String(value), 'pricetag-outline'));

  // If no recognized fields found, show all available data as key-value pairs
  if (infoRows.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }, style]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Ionicons name="information-circle-outline" size={24} color={colors.info} />
          <Text style={[styles.headerText, { color: colors.textPrimary }]}>Tag Data</Text>
        </View>
        <View style={styles.infoContainer}>
          {Object.entries(deviceData).map(([key, value]) => (
            <View key={key} style={styles.infoRow}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>{key}:</Text>
              <Text style={[styles.value, { color: colors.textPrimary }]}>{String(value)}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }, style]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Ionicons name="information-circle-outline" size={24} color={colors.info} />
        <Text style={[styles.headerText, { color: colors.textPrimary }]}>Device Information</Text>
      </View>
      <View style={styles.infoContainer}>
        {infoRows}
        {customRows}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    padding: 15,
    marginTop: 15,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  headerText: {
    fontSize: 18,
    fontWeight: '600',
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
  },
  value: {
    fontSize: 15,
    marginLeft: 26, // Indent to align with label (icon width + margins)
    lineHeight: 22,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default DeviceInfoDisplay;
