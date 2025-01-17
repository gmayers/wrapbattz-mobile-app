import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
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
  });
  const [loading, setLoading] = useState(false);
  const [nfcModalVisible, setNfcModalVisible] = useState(false);
  const [deviceIdentifier, setDeviceIdentifier] = useState('');

  const handleInputChange = (name, value) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateForm = () => {
    if (!formData.description || !formData.make || !formData.model) {
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
      const response = await fetch('https://test.gmayersservices.com/api/devices/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to create device');
      }

      const data = await response.json();
      setDeviceIdentifier(data.identifier);
      setNfcModalVisible(true);
    } catch (error) {
      console.error('Error creating device:', error);
      Alert.alert('Error', 'Failed to create device. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleNFCWrite = async () => {
    const nfcData = {
      ID: deviceIdentifier
    };
    // NFCWrite component will handle the actual writing
    return nfcData;
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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <ScrollView style={styles.scrollView}>
          <View style={styles.form}>
            <BaseTextInput
              label="Description"
              value={formData.description}
              onChangeText={(text) => handleInputChange('description', text)}
              placeholder="Enter device description"
              multiline
              required
            />

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
  submitButton: {
    marginTop: 20,
  },
  nfcButton: {
    marginTop: 10,
  },
});

export default AddDevicePage;