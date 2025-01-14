// components/ModalComponents.js
import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Platform } from 'react-native';
import { BaseTextInput } from '../TextInput';
import Button from '../Button';
import Dropdown from '../Dropdown';

const ITEM_CHOICES = [
  { label: 'Battery', value: 'Battery' },
  { label: 'Charger', value: 'Charger' },
  { label: 'Adapter', value: 'Adapter' },
  { label: 'Cable', value: 'Cable' },
  { label: 'Drill', value: 'Drill' },
  { label: 'Saw', value: 'Saw' },
  { label: 'Other', value: 'Other' }
];

const STATUS_CHOICES = [
  { label: 'Available', value: 'available' },
  { label: 'Assigned', value: 'assigned' },
  { label: 'Damaged', value: 'damaged' },
  { label: 'Stolen', value: 'stolen' },
  { label: 'Maintenance', value: 'maintenance' },
  { label: 'Lost', value: 'lost' }
];

export const AddDeviceForm = ({ onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    identifier: '',
    description: '',
    make: '',
    model: '',
    device_type: ITEM_CHOICES[0].value,
    serial_number: '',
    maintenance_interval: '',
    is_active: true,
    status: STATUS_CHOICES[0].value
  });

  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.identifier) {
      newErrors.identifier = 'Identifier is required';
    }
    if (!formData.description) {
      newErrors.description = 'Description is required';
    }
    if (!formData.make) {
      newErrors.make = 'Make is required';
    }
    if (!formData.model) {
      newErrors.model = 'Model is required';
    }
    if (formData.maintenance_interval && isNaN(formData.maintenance_interval)) {
      newErrors.maintenance_interval = 'Must be a number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.formContainer}>
        <BaseTextInput
          label="Identifier"
          value={formData.identifier}
          onChangeText={(text) => setFormData({...formData, identifier: text})}
          placeholder="Enter unique identifier"
          error={errors.identifier}
          containerStyle={styles.inputContainer}
        />

        <BaseTextInput
          label="Description" 
          value={formData.description}
          onChangeText={(text) => setFormData({...formData, description: text})}
          placeholder="Enter device description"
          error={errors.description}
          multiline
          numberOfLines={3}
          containerStyle={styles.inputContainer}
        />

        <BaseTextInput
          label="Make"
          value={formData.make}
          onChangeText={(text) => setFormData({...formData, make: text})}
          placeholder="Enter device make"
          error={errors.make}
          containerStyle={styles.inputContainer}
        />

        <BaseTextInput
          label="Model"
          value={formData.model}
          onChangeText={(text) => setFormData({...formData, model: text})}
          placeholder="Enter device model"
          error={errors.model}
          containerStyle={styles.inputContainer}
        />

        <Dropdown
          label="Device Type"
          value={formData.device_type}
          onValueChange={(value) => setFormData({...formData, device_type: value})}
          items={ITEM_CHOICES}
          placeholder="Select device type"
          containerStyle={styles.inputContainer}
        />

        <BaseTextInput
          label="Serial Number"
          value={formData.serial_number}
          onChangeText={(text) => setFormData({...formData, serial_number: text})}
          placeholder="Enter serial number (optional)"
          containerStyle={styles.inputContainer}
        />

        <BaseTextInput
          label="Maintenance Interval (days)"
          value={formData.maintenance_interval}
          onChangeText={(text) => setFormData({...formData, maintenance_interval: text})}
          keyboardType="numeric"
          placeholder="Enter maintenance interval"
          error={errors.maintenance_interval}
          containerStyle={styles.inputContainer}
        />

        <Dropdown
          label="Status"
          value={formData.status}
          onValueChange={(value) => setFormData({...formData, status: value})}
          items={STATUS_CHOICES}
          placeholder="Select status"
          containerStyle={styles.inputContainer}
        />

        <View style={styles.buttonContainer}>
          <Button
            title="Cancel"
            onPress={onCancel}
            variant="outlined"
            style={styles.buttonFlex}
          />
          <View style={styles.buttonSpacing} />
          <Button
            title="Add Device"
            onPress={handleSubmit}
            style={styles.buttonFlex}
          />
        </View>
      </View>
    </ScrollView>
  );
};

export const DeviceDetailsView = ({ device, onClose }) => {
  const getStatusBadgeStyle = (status) => {
    const colors = {
      available: { backgroundColor: '#DEF7EC', color: '#03543F' },
      assigned: { backgroundColor: '#E1EFFE', color: '#1E429F' },
      damaged: { backgroundColor: '#FDE8E8', color: '#9B1C1C' },
      stolen: { backgroundColor: '#F3F4F6', color: '#374151' },
      maintenance: { backgroundColor: '#FEF3C7', color: '#92400E' },
      lost: { backgroundColor: '#F3F4F6', color: '#374151' }
    };
    return colors[status] || colors.lost;
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.detailsContainer}>
        <DetailRow label="Identifier" value={device.identifier} />
        <DetailRow label="Description" value={device.description} />
        <DetailRow label="Make & Model" value={`${device.make} ${device.model}`} />
        <DetailRow label="Device Type" value={device.device_type} />
        <DetailRow label="Serial Number" value={device.serial_number || 'N/A'} />
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Status</Text>
          <View style={[
            styles.statusBadge,
            { backgroundColor: getStatusBadgeStyle(device.status).backgroundColor }
          ]}>
            <Text style={[
              styles.statusText,
              { color: getStatusBadgeStyle(device.status).color }
            ]}>
              {device.status}
            </Text>
          </View>
        </View>

        <DetailRow 
          label="Maintenance" 
          value={device.maintenance_interval 
            ? `Every ${device.maintenance_interval} days`
            : 'No maintenance schedule set'
          } 
        />
        
        {device.next_maintenance && (
          <DetailRow 
            label="Next Maintenance" 
            value={new Date(device.next_maintenance).toLocaleDateString()} 
          />
        )}

        <View style={styles.buttonContainer}>
          <Button
            title="Close"
            onPress={onClose}
            variant="outlined"
            style={styles.fullWidthButton}
          />
        </View>
      </View>
    </ScrollView>
  );
};

const DetailRow = ({ label, value }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  formContainer: {
    padding: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    marginTop: 24,
    marginBottom: Platform.OS === 'ios' ? 20 : 0,
  },
  buttonSpacing: {
    width: 12,
  },
  buttonFlex: {
    flex: 1,
  },
  fullWidthButton: {
    width: '100%',
  },
  detailsContainer: {
    padding: 16,
  },
  detailRow: {
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    color: '#333',
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  maintenanceDate: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
});

export default {
  AddDeviceForm,
  DeviceDetailsView
};