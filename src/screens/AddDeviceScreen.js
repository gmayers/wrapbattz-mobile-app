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
  Switch,
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
  { label: 'Bosch', value: 'Bosch' },
  { label: 'Hilti', value: 'Hilti' },
  { label: 'Ryobi', value: 'Ryobi' },
  { label: 'Other', value: 'Other' }
];


// Function to normalize JSON string from EditTab
const normalizeJsonString = (jsonString) => {
  // Replace fancy quotes with standard quotes
  let normalized = jsonString
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')  // Replace various fancy double quotes
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'"); // Replace various fancy single quotes
  
  // Remove any control characters
  normalized = normalized.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
  
  // Fix any malformed JSON that might have occurred from improper encoding
  try {
    // Test if it's valid after normalization
    JSON.parse(normalized);
    return normalized;
  } catch (e) {
    // Further repairs for common issues
    
    // Replace unquoted property names - find words followed by colon
    normalized = normalized.replace(/(\s*)(\w+)(\s*):(\s*)/g, (match, before, word, middle, after) => {
      // Don't replace if it's already part of a properly quoted structure
      if ((/"\w+"(\s*):/.test(match) || /'?\w+'?(\s*):/.test(match))) {
        return match;
      }
      return `${before}"${word}"${middle}:${after}`;
    });
    
    // Try to fix dangling quote issues
    let quoteCount = 0;
    for (let i = 0; i < normalized.length; i++) {
      if (normalized[i] === '"' && (i === 0 || normalized[i-1] !== '\\')) {
        quoteCount++;
      }
    }
    
    if (quoteCount % 2 !== 0) {
      // Unbalanced quotes - try to identify and fix the issue
      console.log("Detected unbalanced quotes, attempting fix");
      
      // Add a closing quote before any commas or closing braces
      normalized = normalized.replace(/([^"\s,{}[\]]+)(\s*)(,|\}|\])/g, '$1"$2$3');
      
      // Fix any values that should start with a quote but don't
      normalized = normalized.replace(/:(\s*)([^"\s,{}[\]][^,{}[\]]*)/g, ':$1"$2"');
    }
    
    return normalized;
  }
};


const AddDevicePage = ({ navigation }) => {
  const { getAccessToken, deviceService, axiosInstance } = useAuth();
  
  // Calculate date 2 weeks from today
  const twoWeeksFromNow = new Date();
  twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);
  
  const [formData, setFormData] = useState({
    description: '',
    make: 'Makita',
    model: '',
    device_type: 'Battery',
    serial_number: '',
    maintenance_interval: '',
    next_maintenance_date: twoWeeksFromNow, // Set to 2 weeks from today
    location: '', // Will be set when user selects an option
    user: '', // New field for user assignment
  });
  const [loading, setLoading] = useState(false);
  const [nfcModalVisible, setNfcModalVisible] = useState(false);
  const [deviceIdentifier, setDeviceIdentifier] = useState('');
  const [isWritingNfc, setIsWritingNfc] = useState(false);
  const [nfcWriteSuccess, setNfcWriteSuccess] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [locations, setLocations] = useState([]);
  const [locationOptions, setLocationOptions] = useState([]);
  const [userOptions, setUserOptions] = useState([]);
  const [otherMake, setOtherMake] = useState('');
  const [otherDeviceType, setOtherDeviceType] = useState('');
  const [apiResponse, setApiResponse] = useState(null);
  // Toggle for user/location assignment
  const [isUserAssignment, setIsUserAssignment] = useState(true);
  
  // Log function for better debugging
  const logMessage = (message) => {
    if (__DEV__) {
      console.log(`[AddDevicePage] ${message}`);
    }
  };
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

  // Fetch locations
  useEffect(() => {
    fetchLocations();
    // fetchUsers();
  }, []);

  // Update dropdown options when data is fetched
  useEffect(() => {
    // Transform locations into dropdown format
    if (locations.length > 0) {
      const options = locations.map(location => ({
        label: location.name || `Location ${location.id}`,
        value: location.id
      }));
      
      logMessage(`Created ${options.length} location options for dropdown`);
      setLocationOptions(options);
      
      // Set a default location if we have locations and form doesn't have one yet
      if (options.length > 0 && !formData.location) {
        handleInputChange('location', options[0].value);
        logMessage(`Setting default location to: ${options[0].value}`);
      }
    }
  }, [locations]);


  const fetchLocations = async () => {
    try {
      logMessage('Fetching locations...');
      const locationsData = await deviceService.getLocations();
      logMessage(`Fetched ${locationsData.length} locations`);
      setLocations(locationsData);
    } catch (error) {
      console.error('Error fetching locations:', error);
      logMessage(`Error fetching locations: ${error.message}`);
      Alert.alert('Error', 'Failed to load locations. Please try again.');
    }
  };

  const fetchUsers = async () => {
    try {
      logMessage('Fetching users...');
      // This is a mockup - replace with your actual API endpoint
      const response = await axiosInstance.get('/users/');
      const userData = response.data;
      logMessage(`Fetched ${userData.length} users`);
      
      const options = userData.map(user => ({
        label: `${user.first_name} ${user.last_name}`,
        value: user.id
      }));
      
      setUserOptions(options);
      
      // Set current user as default if available
      if (options.length > 0) {
        const currentUserData = await deviceService.getCurrentUser();
        if (currentUserData && currentUserData.id) {
          handleInputChange('user', currentUserData.id);
          logMessage(`Setting default user to current user: ${currentUserData.id}`);
        } else {
          handleInputChange('user', options[0].value);
          logMessage(`Setting default user to first user: ${options[0].value}`);
        }
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      logMessage(`Error fetching users: ${error.message}`);
      // Continue without user data rather than showing an alert
      // We'll use a placeholder array for testing
      setUserOptions([
        { label: 'John Doe', value: '1' },
        { label: 'Jane Smith', value: '2' },
        { label: 'Current User', value: 'current' }
      ]);
      handleInputChange('user', 'current');
    }
  };

  const handleInputChange = (name, value) => {
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
    
    // Check make field
    if (formData.make === null || formData.make === undefined || formData.make === '') 
      missingFields.push('Make');
    
    if (!formData.model || formData.model.trim() === '') 
      missingFields.push('Model');
    
    // Check location or user based on assignment toggle
    if (isUserAssignment) {
      if (!formData.user || formData.user === '' || formData.user === 0)
        missingFields.push('User');
    } else {
      if (!formData.location || formData.location === '' || formData.location === 0)
        missingFields.push('Location');
    }
    
    // If there are missing fields, show specific error message
    if (missingFields.length > 0) {
      Alert.alert(
        'Missing Required Fields', 
        `Please fill in the following required fields:\n• ${missingFields.join('\n• ')}`
      );
      logMessage(`Form validation failed. Missing fields: ${missingFields.join(', ')}`);
      return false;
    }
    
    logMessage('Form validation passed');
    return true;
  };

  // Handle preparing the form data for submission
  const prepareFormData = () => {
    logMessage('Preparing form data for submission');
    
    // Determine the make value based on selection
    const finalMake = formData.make === 'Other' ? otherMake : formData.make;
    // Determine the device_type value based on selection
    const finalDeviceType = formData.device_type === 'Other' ? otherDeviceType : formData.device_type;
    
    // Create the request data object
    const requestData = {
      description: formData.description,
      make: finalMake || '',
      model: formData.model,
      device_type: finalDeviceType,
      serial_number: formData.serial_number || '',
      maintenance_interval: formData.maintenance_interval || null,
      // Format date as DD/MM/YYYY as expected by the backend
      next_maintenance_date: formatDate(formData.next_maintenance_date),
    };
    
    // Add either location or user based on the toggle
    if (isUserAssignment) {
      requestData.user = formData.user || null;
      // May still need location for backend logic
      requestData.location = null;
    } else {
      requestData.location = formData.location || null;
      // May still need user for backend logic
      requestData.user = null;
    }
    
    logMessage(`Prepared data: ${JSON.stringify(requestData)}`);
    return requestData;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    logMessage('Starting device submission');

    try {
      const requestData = prepareFormData();

      // Use the axiosInstance from AuthContext for proper token handling
      const response = await axiosInstance.post('/devices/', requestData);
      
      // Save the full API response for debugging
      setApiResponse(response.data);
      
      // Extract the device identifier
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

  const resetForm = () => {
    // Calculate a new date 2 weeks from today for reset
    const twoWeeksFromNow = new Date();
    twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);
    
    setFormData({
      description: '',
      make: 'Makita', // Reset to default
      model: '',
      device_type: 'Battery', // Reset to default
      serial_number: '',
      maintenance_interval: '',
      next_maintenance_date: twoWeeksFromNow, // Reset to 2 weeks from now
      location: locationOptions.length > 0 ? locationOptions[0].value : '', // Reset to first location
      user: userOptions.length > 0 ? userOptions[0].value : '', // Reset to first user
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

  // Improved NFC write function based on EditTab implementation
  const handleNFCWrite = async () => {
    try {
      setIsWritingNfc(true);
      logMessage('Starting NFC write operation');

      // Prepare data to write to the NFC tag
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
      
      // Add assignment info
      if (isUserAssignment) {
        const userOption = userOptions.find(u => u.value === formData.user);
        dataToWrite.assigned_to = userOption ? userOption.label : 'Unknown User';
      } else {
        const locationOption = locationOptions.find(l => l.value === formData.location);
        dataToWrite.location = locationOption ? locationOption.label : 'Unknown Location';
      }
      
      // Convert to JSON string and normalize it
      const jsonString = normalizeJsonString(JSON.stringify(dataToWrite));
      logMessage(`Data to write: ${jsonString}`);

      // Check if data might be too large for standard NFC tag
      if (jsonString.length > 500) {
        logMessage(`Warning: Data size (${jsonString.length} bytes) may be too large for some NFC tags`);
      }

      // STEP 1: Request NFC technology
      await NfcManager.requestTechnology(NfcTech.Ndef);
      logMessage('NFC technology requested successfully');

      // STEP 2: Create NDEF message bytes
      const bytes = Ndef.encodeMessage([Ndef.textRecord(jsonString)]);
      
      if (bytes) {
        logMessage('NDEF message encoded successfully');
        
        // STEP 3: Write the message to the tag
        await NfcManager.ndefHandler.writeNdefMessage(bytes);
        logMessage('Write operation completed successfully');
        
        setNfcWriteSuccess(true);
        return true;
      } else {
        throw new Error('Failed to encode NDEF message');
      }
    } catch (error) {
      logMessage(`Error in NFC write operation: ${error.message}`);
      logMessage(`Error stack: ${error.stack}`);
      Alert.alert('Error', `Failed to write to NFC tag: ${error.message}`);
      return false;
    } finally {
      // STEP 4: Always cancel technology request when done
      try {
        await NfcManager.cancelTechnologyRequest();
        logMessage('NFC technology request canceled');
      } catch (error) {
        logMessage(`Error canceling NFC technology request: ${error.message}`);
      }
      setIsWritingNfc(false);
      logMessage('NFC write process completed');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        enabled
      >
        <ScrollView 
          contentContainerStyle={styles.scrollView}
          keyboardShouldPersistTaps="handled" // Better dropdown interaction
          bounces={false}
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

            {/* Assignment Toggle Switch - Updated order to have User first */}
            <View style={styles.toggleContainer}>
              <Text style={styles.toggleLabel}>Assign to:</Text>
              <View style={styles.toggleRow}>
                <Text style={isUserAssignment ? styles.toggleTextActive : styles.toggleTextInactive}>
                  User
                </Text>
                <Switch
                  value={!isUserAssignment}
                  onValueChange={(value) => setIsUserAssignment(!value)}
                  trackColor={{ false: '#3498db', true: '#3498db' }}
                  thumbColor={Platform.OS === 'ios' ? '' : '#FFFFFF'}
                  ios_backgroundColor="#ccc"
                  style={styles.toggle}
                />
                <Text style={isUserAssignment ? styles.toggleTextInactive : styles.toggleTextActive}>
                  Location
                </Text>
              </View>
            </View>

            {/* Dynamic Dropdown based on toggle - Location or User */}
            <View style={[styles.formField, { zIndex: 1 }]}>
              <Text style={styles.label}>
                {isUserAssignment ? 'User *' : 'Location *'}
              </Text>
              <Dropdown
                value={isUserAssignment ? formData.user : formData.location}
                onValueChange={(value) => {
                  if (isUserAssignment) {
                    logMessage(`User dropdown selected: ${value}`);
                    handleInputChange('user', value);
                  } else {
                    logMessage(`Location dropdown selected: ${value}`);
                    handleInputChange('location', value);
                  }
                }}
                items={isUserAssignment ? userOptions : locationOptions}
                placeholder={isUserAssignment ? 
                  "Select User (Required)" : 
                  "Select Location (Required)"
                }
                testID={isUserAssignment ? "user-dropdown" : "location-dropdown"}
                style={(isUserAssignment ? formData.user : formData.location) ? {} : styles.requiredField}
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
              textColor={'black'}
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
                <Text style={styles.dataPreviewItem}>
                  {isUserAssignment ? 
                    `Assigned to: ${userOptions.find(u => u.value === formData.user)?.label || 'Unknown'}` : 
                    `Location: ${locationOptions.find(l => l.value === formData.location)?.label || 'Unknown'}`
                  }
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
    paddingBottom: 100, // Extra padding at bottom to ensure all content is accessible when keyboard is open
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
  },
  // New styles for toggle switch
  toggleContainer: {
    marginBottom: 16,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  toggle: {
    marginHorizontal: 10,
  },
  toggleTextActive: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3498db',
  },
  toggleTextInactive: {
    fontSize: 16,
    color: '#777',
  },
  bottomSpacer: {
    height: 100, // Extra space at the bottom
  }
});

export default AddDevicePage;