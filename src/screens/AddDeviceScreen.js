import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  TouchableOpacity,
  Text,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { BaseTextInput } from '../components/TextInput';
import Button from '../components/Button';
import CustomModal from '../components/Modal';
import Dropdown from '../components/Dropdown';
import { useAuth } from '../context/AuthContext';

const ITEM_CHOICES = [
  { label: 'Battery', value: 'Battery' },
  { label: 'Charger', value: 'Charger' },
  { label: 'Adapter', value: 'Adapter' },
  { label: 'Cable', value: 'Cable' },
  { label: 'Drill', value: 'Drill' },
  { label: 'Saw', value: 'Saw' },
  { label: 'Other', value: 'Other' }
];

const MAKES = [
  { label: 'Makita', value: 'Makita' },
  { label: 'Mawkee', value: 'Mawkee' },
  { label: 'Dewalt', value: 'Dewalt' },
  { label: 'Other', value: 'Other' }
];

const AddDevicePage = ({ navigation }) => {
  const { getAccessToken, deviceService } = useAuth();
  const [formData, setFormData] = useState({
    description: '',
    make: '',
    model: '',
    device_type: 'Battery',
    serial_number: '',
    maintenance_interval: '',
    next_maintenance_date: new Date(),
    location: '',
  });
  const [loading, setLoading] = useState(false);
  const [nfcModalVisible, setNfcModalVisible] = useState(false);
  const [deviceIdentifier, setDeviceIdentifier] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [locations, setLocations] = useState([]);
  const [locationOptions, setLocationOptions] = useState([]);
  const [otherMake, setOtherMake] = useState('');
  const [otherDeviceType, setOtherDeviceType] = useState('');

  useEffect(() => {
    fetchLocations();
  }, []);

  useEffect(() => {
    // Transform locations into the format expected by the Dropdown component
    if (locations.length > 0) {
      const options = locations.map(location => ({
        label: location.name,
        value: location.id
      }));
      setLocationOptions(options);
    }
  }, [locations]);

  const fetchLocations = async () => {
    try {
      const locationsData = await deviceService.getLocations();
      setLocations(locationsData);
    } catch (error) {
      console.error('Error fetching locations:', error);
      Alert.alert('Error', 'Failed to load locations. Please try again.');
    }
  };

  const handleInputChange = (name, value) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const validateForm = () => {
    if (!formData.description || !formData.make || !formData.model || !formData.location) {
      Alert.alert('Error', 'Please fill in all required fields');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);

    try {
      const token = await getAccessToken();
      const requestData = {
        ...formData,
        next_maintenance_date: formatDate(formData.next_maintenance_date),
      };

      const response = await fetch('https://test.gmayersservices.com/api/devices/', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create device: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      setDeviceIdentifier(data.identifier);
      setNfcModalVisible(true);
    } catch (error) {
      console.error('Error in handleSubmit:', error);
      Alert.alert('Error', 'Failed to create device. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const handleNFCWrite = async () => {
    return { ID: deviceIdentifier };
  };

  const handleNFCSuccess = () => {
    Alert.alert(
      'Success',
      'Device created and NFC tag written successfully',
      [{ text: 'OK', onPress: () => navigation.goBack() }]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardAvoid}>
        <ScrollView contentContainerStyle={styles.scrollView}>
          <View style={styles.form}>
            {/* Make Dropdown */}
            <Dropdown
              label="Make"
              value={formData.make}
              onValueChange={(value) => {
                if (value === 'Other') {
                  setOtherMake('');
                  handleInputChange('make', 'Other'); // Retain "Other" in the dropdown
                } else {
                  handleInputChange('make', value);
                }
              }}
              items={MAKES}
              placeholder="Select Make"
              testID="make-dropdown"
            />

            {/* Other Make Input */}
            {formData.make === 'Other' && (
              <BaseTextInput
                value={otherMake}
                onChangeText={(text) => {
                  setOtherMake(text);
                  handleInputChange('make', text); // Update formData.make with custom input
                }}
                placeholder="Enter other make"
                required
              />
            )}

            {/* Model Input */}
            <Text style={styles.label}>Model</Text>
            <BaseTextInput
              value={formData.model}
              onChangeText={(text) => handleInputChange('model', text)}
              placeholder="Enter device model"
              required
            />

            {/* Description Input */}
            <Text style={styles.label}>Description</Text>
            <BaseTextInput
              value={formData.description}
              onChangeText={(text) => handleInputChange('description', text)}
              placeholder="Enter device description"
              multiline
              required
            />

            {/* Device Type Dropdown */}
            <Dropdown
              label="Device Type"
              value={formData.device_type}
              onValueChange={(value) => {
                if (value === 'Other') {
                  setOtherDeviceType('');
                  handleInputChange('device_type', 'Other'); // Retain "Other" in the dropdown
                } else {
                  handleInputChange('device_type', value);
                }
              }}
              items={ITEM_CHOICES}
              placeholder="Select Device Type"
              testID="device-type-dropdown"
            />

            {/* Other Device Type Input */}
            {formData.device_type === 'Other' && (
              <BaseTextInput
                value={otherDeviceType}
                onChangeText={(text) => {
                  setOtherDeviceType(text);
                  handleInputChange('device_type', text); // Update formData.device_type with custom input
                }}
                placeholder="Enter other device type"
                required
              />
            )}

            {/* Serial Number Input */}
            <Text style={styles.label}>Serial Number</Text>
            <BaseTextInput
              value={formData.serial_number}
              onChangeText={(text) => handleInputChange('serial_number', text)}
              placeholder="Enter serial number (optional)"
            />

            {/* Maintenance Interval Input */}
            <Text style={styles.label}>Maintenance Interval</Text>
            <BaseTextInput
              value={formData.maintenance_interval}
              onChangeText={(text) => handleInputChange('maintenance_interval', text)}
              placeholder="Enter maintenance interval (optional)"
              keyboardType="numeric"
            />

            {/* Next Maintenance Date Picker */}
            <Text style={styles.label}>Next Maintenance Date</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={styles.dateButtonText}>
                {formatDate(formData.next_maintenance_date)}
              </Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={formData.next_maintenance_date}
                mode="date"
                display="default"
                onChange={(event, selectedDate) => {
                  setShowDatePicker(false);
                  if (selectedDate) {
                    handleInputChange('next_maintenance_date', selectedDate);
                  }
                }}
                themeVariant="light"
                accentColor="#FFA500" // Orange color
              />
            )}

            {/* Location Dropdown */}
            <Dropdown
              label="Location"
              value={formData.location}
              onValueChange={(value) => handleInputChange('location', value)}
              items={locationOptions}
              placeholder="Select Location"
              testID="location-dropdown"
            />

            {/* Submit Button */}
            <Button
              title="Submit"
              onPress={handleSubmit}
              loading={loading}
              style={styles.submitButton}
            />
          </View>
        </ScrollView>

        {/* NFC Modal */}
        <CustomModal
          visible={nfcModalVisible}
          onClose={() => setNfcModalVisible(false)}
          title="Write NFC Tag"
          style={styles.modal}
        >
          <Text style={styles.modalText}>Write the following data to the NFC tag:</Text>
          <Text style={styles.modalText}>{JSON.stringify({ ID: deviceIdentifier })}</Text>
          <Button
            title="Write NFC Tag"
            onPress={async () => {
              await handleNFCWrite();
              handleNFCSuccess();
            }}
            style={styles.nfcButton}
          />
        </CustomModal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollView: {
    flexGrow: 1,
    padding: 20,
  },
  form: {
    flex: 1,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  dateButton: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#F8F8F8',
    marginBottom: 16,
  },
  dateButtonText: {
    fontSize: 16,
    color: '#333',
  },
  submitButton: {
    marginTop: 20,
    backgroundColor: 'orange',
  },
  modal: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  modalText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 10,
  },
  nfcButton: {
    marginTop: 10,
  },
});

export default AddDevicePage;