import React, { useState } from 'react';
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
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { BaseTextInput } from '../components/TextInput';
import Button from '../components/Button';
import CustomModal from '../components/Modal';
import { NFCWrite } from '../components/NFCComponents';
import { useAuth } from '../context/AuthContext';

const ITEM_CHOICES = [
  'Battery',
  'Charger',
  'Adapter',
  'Cable',
  'Drill',
  'Saw',
  'Other',
];

const AddDevicePage = ({ navigation }) => {
  const { getAccessToken } = useAuth();
  const [formData, setFormData] = useState({
    description: '',
    make: '',
    model: '',
    device_type: 'Battery',
    serial_number: '',
    maintenance_interval: '',
    next_maintenance_date: new Date(),
  });
  const [loading, setLoading] = useState(false);
  const [nfcModalVisible, setNfcModalVisible] = useState(false);
  const [deviceIdentifier, setDeviceIdentifier] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleInputChange = (name, value) => {
    console.log('Input Change:', { field: name, value: value });
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateForm = () => {
    console.log('Validating Form Data:', formData);
    if (!formData.description || !formData.make || !formData.model) {
      console.log('Form Validation Failed: Missing required fields');
      Alert.alert('Error', 'Please fill in all required fields');
      return false;
    }
    console.log('Form Validation: Success');
    return true;
  };

  const handleSubmit = async () => {
    console.log('Submit Attempt - Initial Form Data:', formData);
    
    if (!validateForm()) {
      console.log('Submit Cancelled: Form validation failed');
      return;
    }

    setLoading(true);
    console.log('Setting loading state: true');

    try {
      console.log('Getting access token...');
      const token = await getAccessToken();
      console.log('Access Token Retrieved:', token ? 'Token present' : 'Token missing');

      const requestData = {
        ...formData,
        next_maintenance_date: formData.next_maintenance_date.toISOString().split('T')[0]
      };

      console.log('Preparing Request:', {
        url: 'https://test.gmayersservices.com/api/devices/',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        data: requestData
      });

      console.log('Sending API request...');
      const response = await fetch('https://test.gmayersservices.com/api/devices/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      console.log('API Response received:', {
        status: response.status,
        statusText: response.statusText
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        throw new Error(`Failed to create device: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      console.log('API Success Response:', data);
      
      setDeviceIdentifier(data.identifier);
      console.log('Device Identifier set:', data.identifier);
      
      setNfcModalVisible(true);
      console.log('NFC Modal visibility set to true');

    } catch (error) {
      console.error('Error in handleSubmit:', {
        message: error.message,
        stack: error.stack,
        response: error.response ? {
          status: error.response.status,
          data: error.response.data,
          headers: error.response.headers
        } : 'No response object'
      });
      Alert.alert('Error', 'Failed to create device. Please try again.');
    } finally {
      console.log('Setting loading state: false');
      setLoading(false);
    }
  };

  const handleNFCWrite = async () => {
    console.log('NFC Write Attempt for device:', deviceIdentifier);
    const nfcData = {
      ID: deviceIdentifier
    };
    console.log('NFC Data prepared:', nfcData);
    return nfcData;
  };

  const handleNFCSuccess = () => {
    console.log('NFC Write Success - Navigating back');
    Alert.alert(
      'Success',
      'Device created and NFC tag written successfully',
      [{ text: 'OK', onPress: () => navigation.goBack() }]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <ScrollView style={styles.scrollView}>
          <View style={styles.form}>
            <BaseTextInput
              label="Make"
              value={formData.make}
              onChangeText={(text) => handleInputChange('make', text)}
              placeholder="Enter device make"
              required
            />

            <BaseTextInput
              label="Model"
              value={formData.model}
              onChangeText={(text) => handleInputChange('model', text)}
              placeholder="Enter device model"
              required
            />

            <BaseTextInput
              label="Description"
              value={formData.description}
              onChangeText={(text) => handleInputChange('description', text)}
              placeholder="Enter device description"
              multiline
              required
            />

            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={formData.device_type}
                onValueChange={(value) => handleInputChange('device_type', value)}
                style={styles.picker}
              >
                {ITEM_CHOICES.map((item) => (
                  <Picker.Item key={item} label={item} value={item} />
                ))}
              </Picker>
            </View>

            <BaseTextInput
              label="Serial Number"
              value={formData.serial_number}
              onChangeText={(text) => handleInputChange('serial_number', text)}
              placeholder="Enter serial number (optional)"
            />

            <BaseTextInput
              label="Maintenance Interval (days)"
              value={formData.maintenance_interval}
              onChangeText={(text) => handleInputChange('maintenance_interval', text)}
              placeholder="Enter maintenance interval (optional)"
              keyboardType="numeric"
            />

            <View style={styles.datePickerContainer}>
              <Text style={styles.dateLabel}>Next Maintenance Date</Text>
              <TouchableOpacity 
                style={styles.dateButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={styles.dateButtonText}>
                  {formData.next_maintenance_date.toLocaleDateString()}
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
                />
              )}
            </View>

            <Button
              title="Create Device"
              onPress={handleSubmit}
              loading={loading}
              style={styles.submitButton}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <CustomModal
        visible={nfcModalVisible}
        onClose={() => setNfcModalVisible(false)}
        title="Write NFC Tag"
      >
        <NFCWrite
          onWrite={handleNFCWrite}
          onSuccess={handleNFCSuccess}
          buttonStyle={styles.nfcButton}
        />
      </CustomModal>
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
    flex: 1,
  },
  form: {
    padding: 20,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    marginBottom: 16,
  },
  picker: {
    height: 50,
  },
  datePickerContainer: {
    marginBottom: 16,
  },
  dateLabel: {
    fontSize: 16,
    marginBottom: 8,
    color: '#333',
  },
  dateButton: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#F8F8F8',
  },
  dateButtonText: {
    fontSize: 16,
    color: '#333',
  },
  submitButton: {
    marginTop: 20,
  },
  nfcButton: {
    marginTop: 10,
  },
});

export default AddDevicePage;