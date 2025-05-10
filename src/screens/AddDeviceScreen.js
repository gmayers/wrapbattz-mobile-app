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
import NfcManager, { NfcTech, Ndef } from 'react-native-nfc-manager';

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
  const { getAccessToken, deviceService, axiosInstance } = useAuth();
  const [formData, setFormData] = useState({
    description: '',
    make: 'Makita',
    model: '',
    device_type: 'Battery',
    serial_number: '',
    maintenance_interval: '',
    next_maintenance_date: new Date(),
    location: '', // Will be set when user selects an option
  });
  const [loading, setLoading] = useState(false);
  const [nfcModalVisible, setNfcModalVisible] = useState(false);
  const [deviceIdentifier, setDeviceIdentifier] = useState('');
  const [isWritingNfc, setIsWritingNfc] = useState(false);
  const [nfcWriteSuccess, setNfcWriteSuccess] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [locations, setLocations] = useState([]);
  const [locationOptions, setLocationOptions] = useState([]);
  const [otherMake, setOtherMake] = useState('');
  const [otherDeviceType, setOtherDeviceType] = useState('');
  // No need to store the full API response, we're using local values

  // Initialize NFC when component mounts
  useEffect(() => {
    const initNfc = async () => {
      try {
        await NfcManager.start();
        logMessage('NFC initialized successfully');
      } catch (error) {
        logMessage(`Error initializing NFC: ${error.message}`);
        console.error('Error initializing NFC:', error);
      }
    };

    initNfc();

    // Clean up NFC when component unmounts
    return () => {
      NfcManager.cancelTechnologyRequest().catch(() => {});
    };
  }, []);

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
      
      // Set a default location if we have locations and form doesn't have one yet
      if (options.length > 0 && !formData.location) {
        handleInputChange('location', options[0].value);
      }
    }
  }, [locations]);

  // Simple console logging without storing in state
  const logMessage = (message) => {
    if (__DEV__) {
      console.log(`[AddDevicePage] ${message}`);
    }
  };

  const fetchLocations = async () => {
    try {
      const locationsData = await deviceService.getLocations();
      setLocations(locationsData);
      logMessage(`Fetched ${locationsData.length} locations`);
    } catch (error) {
      console.error('Error fetching locations:', error);
      Alert.alert('Error', 'Failed to load locations. Please try again.');
    }
  };

  const handleInputChange = (name, value) => {
    logMessage(`Input change: ${name} = ${value}`);
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Fixed dropdown handling for "Other" values
  const handleMakeChange = (value) => {
    if (value === 'Other') {
      // Just set dropdown to "Other" but don't clear the custom value yet
      handleInputChange('make', 'Other');
    } else {
      // For standard options, update normally
      handleInputChange('make', value);
      // Clear otherMake when selecting a standard option
      setOtherMake('');
    }
  };

  const handleDeviceTypeChange = (value) => {
    if (value === 'Other') {
      // Just set dropdown to "Other" but don't clear the custom value yet
      handleInputChange('device_type', 'Other');
    } else {
      // For standard options, update normally
      handleInputChange('device_type', value);
      // Clear otherDeviceType when selecting a standard option
      setOtherDeviceType('');
    }
  };

  const validateForm = () => {
    // Collect all missing required fields
    const missingFields = [];
    
    if (!formData.description || formData.description.trim() === '') 
      missingFields.push('Description');
    
    // Check make field - make sure it's not null, undefined, or empty string
    if (formData.make === null || formData.make === undefined || formData.make === '') 
      missingFields.push('Make');
    
    if (!formData.model || formData.model.trim() === '') 
      missingFields.push('Model');
    
    // Check location field - empty string, zero, or placeholder value
    if (!formData.location || formData.location === '' || formData.location === 0) 
      missingFields.push('Location');
    
    // maintenance_interval is optional, so we don't check for it
    
    // If there are missing fields, show specific error message
    if (missingFields.length > 0) {
      Alert.alert(
        'Missing Required Fields', 
        `Please fill in the following required fields:\n• ${missingFields.join('\n• ')}`
      );
      return false;
    }
    
    return true;
  };

  // Handle preparing the form data for submission
  const prepareFormData = () => {
    // Send exactly what the backend expects now
    return {
      description: formData.description,
      make: formData.make || '',
      model: formData.model,
      device_type: formData.device_type,
      serial_number: formData.serial_number || '',
      maintenance_interval: formData.maintenance_interval || null,
      // Format date as DD/MM/YYYY as expected by the backend
      next_maintenance_date: formatDate(formData.next_maintenance_date),
      // Include location directly - backend will handle the assignment
      location: formData.location || null
    };
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    logMessage('Starting device submission');

    try {
      const requestData = prepareFormData();
      logMessage(`Submitting device data: ${JSON.stringify(requestData)}`);

      // Use the axiosInstance from AuthContext for proper token handling
      const response = await axiosInstance.post('/devices/', requestData);
      
      // Extract just the device identifier from the response
      // We'll use local form data for everything else
      const identifier = response.data.identifier;
      logMessage(`Device created successfully with ID: ${identifier}`);
      
      // Set the identifier for use in NFC tag writing
      setDeviceIdentifier(identifier);
      
      // Show the success modal
      setNfcModalVisible(true);
    } catch (error) {
      console.error('Error in handleSubmit:', error);
      logMessage(`Error submitting device data: ${error.message}`);
      
      // Enhanced error handling to provide better feedback
      let errorMessage = 'Failed to create device. Please try again.';
      
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        logMessage(`Server error status: ${error.response.status}`);
        logMessage(`Server error data: ${JSON.stringify(error.response.data, null, 2)}`);
        
        if (error.response.data) {
          if (error.response.data.errors) {
            // Handle structured error responses
            const errorMessages = [];
            
            // Handle general errors
            if (error.response.data.errors.general) {
              errorMessages.push(...error.response.data.errors.general);
            }
            
            // Handle field-specific errors
            Object.entries(error.response.data.errors).forEach(([field, errors]) => {
              if (field !== 'general') {
                errors.forEach(err => {
                  errorMessages.push(`${field}: ${err}`);
                });
              }
            });
            
            if (errorMessages.length > 0) {
              errorMessage = errorMessages.join('\n');
            }
          } else if (error.response.data.message) {
            errorMessage = error.response.data.message;
          } else if (error.response.data.detail) {
            errorMessage = error.response.data.detail;
          } else if (typeof error.response.data === 'string') {
            errorMessage = error.response.data;
          }
        }
      } else if (error.request) {
        // The request was made but no response was received
        errorMessage = 'No response received from server. Please check your connection.';
        logMessage('No response received from server');
      } else {
        // Something happened in setting up the request that triggered an Error
        errorMessage = `An error occurred: ${error.message}`;
      }
      
      Alert.alert('Error', errorMessage);
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
    try {
      setIsWritingNfc(true);
      logMessage('Starting NFC write operation');

      // Prepare data to write to the NFC tag
      // Always use the locally stored form values to ensure all fields are included
      const dataToWrite = {
        ID: deviceIdentifier,
        description: formData.description,
        make: formData.make === 'Other' ? otherMake : formData.make,
        model: formData.model,
        device_type: formData.device_type === 'Other' ? otherDeviceType : formData.device_type,
        serial_number: formData.serial_number || '',
        maintenance_interval: formData.maintenance_interval || '',
        next_maintenance_date: formatDate(formData.next_maintenance_date)
      };
      
      const jsonString = JSON.stringify(dataToWrite);
      logMessage(`Data to write: ${jsonString}`);

      // Check if data might be too large for standard NFC tag
      if (jsonString.length > 500) {
        logMessage(`Warning: Data size (${jsonString.length} bytes) may be too large for some NFC tags`);
      }

      // Request NFC technology
      await NfcManager.requestTechnology(NfcTech.Ndef);
      logMessage('NFC technology requested');

      // Create NDEF message bytes
      const bytes = Ndef.encodeMessage([Ndef.textRecord(jsonString)]);
      
      if (bytes) {
        // Write the message to the tag
        logMessage('Writing NDEF message to tag');
        await NfcManager.ndefHandler.writeNdefMessage(bytes);
        
        logMessage('Write operation completed successfully');
        setNfcWriteSuccess(true);
        return true;
      } else {
        throw new Error('Failed to encode NDEF message');
      }
    } catch (error) {
      logMessage(`Error in NFC write operation: ${error.message}`);
      Alert.alert('Error', `Failed to write to NFC tag: ${error.message}`);
      return false;
    } finally {
      // Always cancel technology request when done
      NfcManager.cancelTechnologyRequest();
      setIsWritingNfc(false);
      logMessage('NFC write process completed');
    }
  };

  const resetForm = () => {
    setFormData({
      description: '',
      make: 'Makita', // Reset to default
      model: '',
      device_type: 'Battery', // Reset to default
      serial_number: '',
      maintenance_interval: '',
      next_maintenance_date: new Date(),
      location: locationOptions.length > 0 ? locationOptions[0].value : '', // Reset to first location
    });
    setOtherMake('');
    setOtherDeviceType('');
    setDeviceIdentifier('');
    setNfcWriteSuccess(false);
    setApiResponse(null); // Clear API response when resetting
  };

  const handleAddAnother = () => {
    resetForm();
    setNfcModalVisible(false);
  };

  const handleFinish = () => {
    navigation.goBack();
  };

  const handleNFCSuccess = () => {
    // Just update the UI state to show success, but keep the modal open
    // for the user to choose next steps
    setNfcWriteSuccess(true);
  };

  // Debug log current form values
  useEffect(() => {
    logMessage(`Current location value: ${formData.location}`);
    logMessage(`Available location options: ${JSON.stringify(locationOptions)}`);
  }, [formData.location, locationOptions]);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardAvoid}>
        <ScrollView 
          contentContainerStyle={styles.scrollView}
          keyboardShouldPersistTaps="handled" // Better dropdown interaction
        >
          <View style={styles.form}>
            {/* Make Dropdown - with improved required styling and fixed handling*/}
            <View style={styles.formField}>
              <Text style={styles.label}>Make *</Text>
              <Dropdown
                value={formData.make}
                onValueChange={handleMakeChange}
                items={MAKES}
                placeholder="Select Make (Required)"
                testID="make-dropdown"
                style={formData.make ? {} : styles.requiredField} // Highlight if empty
                containerStyle={[
                  styles.dropdownContainer,
                  Platform.OS === 'ios' && styles.iosDropdownContainer
                ]}
              />
            </View>

            {/* Other Make Input */}
            {formData.make === 'Other' && (
              <View style={styles.formField}>
                <Text style={styles.label}>Specify Make *</Text>
                <BaseTextInput
                  value={otherMake}
                  onChangeText={(text) => {
                    setOtherMake(text);
                    // Only update formData.make with custom input if we're in "Other" mode
                    if (formData.make === 'Other') {
                      handleInputChange('make', text); 
                    }
                  }}
                  placeholder="Enter other make"
                  style={otherMake ? {} : styles.requiredInput}
                />
              </View>
            )}

            {/* Model Input */}
            <View style={styles.formField}>
              <Text style={styles.label}>Model *</Text>
              <BaseTextInput
                value={formData.model}
                onChangeText={(text) => handleInputChange('model', text)}
                placeholder="Enter device model"
                style={formData.model ? {} : styles.requiredInput}
              />
            </View>

            {/* Description Input */}
            <View style={styles.formField}>
              <Text style={styles.label}>Description *</Text>
              <BaseTextInput
                value={formData.description}
                onChangeText={(text) => handleInputChange('description', text)}
                placeholder="Enter device description"
                multiline
                style={formData.description ? {} : styles.requiredInput}
              />
            </View>

            {/* Device Type Dropdown */}
            <View style={styles.formField}>
              <Text style={styles.label}>Device Type</Text>
              <Dropdown
                value={formData.device_type}
                onValueChange={handleDeviceTypeChange}
                items={ITEM_CHOICES}
                placeholder="Select Device Type"
                testID="device-type-dropdown"
                containerStyle={[
                  styles.dropdownContainer,
                  Platform.OS === 'ios' && styles.iosDropdownContainer
                ]}
              />
            </View>

            {/* Other Device Type Input */}
            {formData.device_type === 'Other' && (
              <View style={styles.formField}>
                <Text style={styles.label}>Specify Device Type *</Text>
                <BaseTextInput
                  value={otherDeviceType}
                  onChangeText={(text) => {
                    setOtherDeviceType(text);
                    // Only update formData.device_type with custom input if we're in "Other" mode
                    if (formData.device_type === 'Other') {
                      handleInputChange('device_type', text);
                    }
                  }}
                  placeholder="Enter other device type"
                  style={otherDeviceType ? {} : styles.requiredInput}
                />
              </View>
            )}

            {/* Serial Number Input */}
            <View style={styles.formField}>
              <Text style={styles.label}>Serial Number</Text>
              <BaseTextInput
                value={formData.serial_number}
                onChangeText={(text) => handleInputChange('serial_number', text)}
                placeholder="Enter serial number (optional)"
              />
            </View>

            {/* Maintenance Interval Input - OPTIONAL */}
            <View style={styles.formField}>
              <Text style={styles.label}>Maintenance Interval (optional)</Text>
              <BaseTextInput
                value={formData.maintenance_interval}
                onChangeText={(text) => handleInputChange('maintenance_interval', text)}
                placeholder="Enter maintenance interval"
                keyboardType="numeric"
              />
            </View>

            {/* Next Maintenance Date Picker */}
            <View style={styles.formField}>
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
            </View>

            {/* Location Dropdown - FIXED */}
            <View style={[styles.formField, { zIndex: 1 }]}>
              <Text style={styles.label}>Location *</Text>
              <Dropdown
                value={formData.location}
                onValueChange={(value) => {
                  logMessage(`Location dropdown selected: ${value}`);
                  handleInputChange('location', value);
                }}
                items={locationOptions}
                placeholder="Select Location (Required)"
                testID="location-dropdown"
                style={formData.location ? {} : styles.requiredField}
                containerStyle={[
                  styles.dropdownContainer,
                  Platform.OS === 'ios' && styles.iosDropdownContainer
                ]}
              />
            </View>

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
          title="Device Created Successfully"
          style={styles.modal}
        >
          {!nfcWriteSuccess ? (
            <>
              <Text style={styles.successText}>Device Added Successfully!</Text>
              <Text style={styles.modalText}>Device ID: {deviceIdentifier}</Text>
              
              <View style={styles.dataPreview}>
                <Text style={styles.dataPreviewTitle}>Data to be written to NFC tag:</Text>
                <Text style={styles.dataPreviewItem}>
                  Make: {formData.make === 'Other' ? otherMake : formData.make}
                </Text>
                <Text style={styles.dataPreviewItem}>
                  Model: {formData.model}
                </Text>
                <Text style={styles.dataPreviewItem}>
                  Type: {formData.device_type === 'Other' ? otherDeviceType : formData.device_type}
                </Text>
                {formData.serial_number ? (
                  <Text style={styles.dataPreviewItem}>
                    Serial: {formData.serial_number}
                  </Text>
                ) : null}
                {formData.maintenance_interval ? (
                  <Text style={styles.dataPreviewItem}>
                    Maintenance Interval: {formData.maintenance_interval}
                  </Text>
                ) : null}
                <Text style={styles.dataPreviewItem}>
                  Next Maintenance: {formatDate(formData.next_maintenance_date)}
                </Text>
              </View>
              
              <View style={styles.buttonRow}>
                <Button
                  title="Write NFC Tag"
                  onPress={async () => {
                    const success = await handleNFCWrite();
                    if (success) {
                      handleNFCSuccess();
                    }
                  }}
                  style={[styles.actionButton, styles.nfcButton]}
                />
              </View>
              
              <View style={styles.buttonRow}>
                <Button
                  title="Add Another Device"
                  onPress={handleAddAnother}
                  style={[styles.actionButton, styles.addButton]}
                />
                <Button
                  title="Finish"
                  onPress={handleFinish}
                  style={[styles.actionButton, styles.finishButton]}
                />
              </View>
              
              {isWritingNfc && (
                <View style={styles.nfcWritingContainer}>
                  <Text style={styles.nfcInstructionText}>
                    Hold your device near the NFC tag...
                  </Text>
                  <Button
                    title="Cancel"
                    onPress={() => {
                      NfcManager.cancelTechnologyRequest();
                      setIsWritingNfc(false);
                    }}
                    style={styles.cancelButton}
                  />
                </View>
              )}
            </>
          ) : (
            <>
              <Text style={styles.successText}>NFC Tag Written Successfully!</Text>
              <Text style={styles.modalText}>All device data has been saved to the NFC tag.</Text>
              <View style={styles.buttonRow}>
                <Button
                  title="Add Another Device"
                  onPress={handleAddAnother}
                  style={[styles.actionButton, styles.addButton]}
                />
                <Button
                  title="Finish"
                  onPress={handleFinish}
                  style={[styles.actionButton, styles.finishButton]}
                />
              </View>
            </>
          )}
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
  formField: {
    marginBottom: 16,
    ...(Platform.OS === 'ios' ? { zIndex: 10 } : {}),
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  dropdownContainer: {
    marginBottom: 5,
    ...(Platform.OS === 'ios' ? { zIndex: 1000 } : {}),
  },
  iosDropdownContainer: {
    zIndex: 1000,
    position: 'relative',
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
    backgroundColor: 'orange',
  },
  modal: {
    justifyContent: 'flex-end',
    margin: 0,
    padding: 20,
  },
  modalText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 10,
  },
  dataPreview: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 8,
    marginVertical: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  dataPreviewTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#555',
  },
  dataPreviewItem: {
    fontSize: 14,
    marginBottom: 5,
    color: '#333',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  nfcButton: {
    marginTop: 20,
    backgroundColor: '#4CAF50', // Green color
  },
  cancelButton: {
    marginTop: 10,
    backgroundColor: '#f44336', // Red color
  },
  nfcInstructionText: {
    fontSize: 18,
    textAlign: 'center',
    marginVertical: 20,
    fontWeight: 'bold',
  },
  successText: {
    fontSize: 20,
    textAlign: 'center',
    marginVertical: 20,
    fontWeight: 'bold',
    color: '#4CAF50', // Green color
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
  },
  actionButton: {
    flex: 1,
    margin: 10,
  },
  addButton: {
    backgroundColor: '#2196F3', // Blue color
  },
  finishButton: {
    backgroundColor: '#FF9800', // Orange color
  },
  requiredField: {
    borderColor: 'red',
    borderWidth: 1,
  },
  requiredInput: {
    borderColor: 'red',
    borderWidth: 1,
  },
  nfcWritingContainer: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 5,
  }
});

export default AddDevicePage;