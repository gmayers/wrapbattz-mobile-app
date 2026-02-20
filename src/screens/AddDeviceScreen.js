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
import { nfcService } from '../services/NFCService';

// Define the orange color to match other screens
const ORANGE_COLOR = '#FF9500';




const AddDevicePage = ({ navigation }) => {
  // Use auth context with all needed properties including getOrganizationMembers
  const { deviceService, axiosInstance, userData, user, getOrganizationMembers } = useAuth();
  
  // Calculate date 2 weeks from today
  const twoWeeksFromNow = new Date();
  twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);
  
  const ITEM_CHOICES = [
    { label: 'Battery', value: 'Battery', key: 'device-battery' },
    { label: 'Charger', value: 'Charger', key: 'device-charger' },
    { label: 'Adapter', value: 'Adapter', key: 'device-adapter' },
    { label: 'Cable', value: 'Cable', key: 'device-cable' },
    { label: 'Drill', value: 'Drill', key: 'device-drill' },
    { label: 'Saw', value: 'Saw', key: 'device-saw' },
    { label: 'Other', value: 'Other', key: 'device-other' }
  ];

  const MAKES = [
    { label: 'Makita', value: 'Makita', key: 'make-makita' },
    { label: 'Milwaukee', value: 'Milwaukee', key: 'make-milwaukee' },
    { label: 'Dewalt', value: 'Dewalt', key: 'make-dewalt' },
    { label: 'Bosch', value: 'Bosch', key: 'make-bosch' },
    { label: 'Hilti', value: 'Hilti', key: 'make-hilti' },
    { label: 'Ryobi', value: 'Ryobi', key: 'make-ryobi' },
    { label: 'Other', value: 'Other', key: 'make-other' }
  ];



const [formData, setFormData] = useState({
    description: '',
    make: 'Makita',
    model: '',
    device_type: 'Battery',
    serial_number: '',
    maintenance_interval: '',
    next_maintenance_date: twoWeeksFromNow,
    location: '', // Will be set when user selects an option
    user: '', // New field for user assignment
  });
  const [loading, setLoading] = useState(false);
  const [nfcModalVisible, setNfcModalVisible] = useState(false);
  const [deviceIdentifier, setDeviceIdentifier] = useState('');
  const [isWritingNfc, setIsWritingNfc] = useState(false);
  const [nfcWriteSuccess, setNfcWriteSuccess] = useState(false);
  const [scannedNfcUuid, setScannedNfcUuid] = useState(null); // NFC tag hardware UUID for registration
  const [isScanningNfc, setIsScanningNfc] = useState(false);
  const [preScannedNfcTagId, setPreScannedNfcTagId] = useState(null); // NFC tag scanned before form submission
  // NFC write options - what data to include on tag (device ID always included)
  const [nfcWriteOptions, setNfcWriteOptions] = useState({
    description: false,
    make: true,
    model: true,
    serial_number: false,
    contact: true,
  });
  // Tag already registered modal state
  const [tagAlreadyRegisteredModal, setTagAlreadyRegisteredModal] = useState({
    visible: false,
    tagId: '',
    deviceIdentifier: '',
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [locations, setLocations] = useState([]);
  const [locationOptions, setLocationOptions] = useState([]);
  const [userOptions, setUserOptions] = useState([]);
  const [otherMake, setOtherMake] = useState('');
  const [otherDeviceType, setOtherDeviceType] = useState('');
  const [apiResponse, setApiResponse] = useState(null);
  const [createdDeviceId, setCreatedDeviceId] = useState(null);
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
        await nfcService.initialize();
        logMessage('NFC Service initialized successfully');
      } catch (error) {
        logMessage(`Error initializing NFC Service: ${error.message}`);
        console.error('Error initializing NFC Service:', error);
      }
    };

    initNfc();

    // Clean up NFC when component unmounts
    return () => {
      nfcService.cancelOperation().catch(() => {});
    };
  }, []);

  // Fetch locations and users on component mount
  useEffect(() => {
    fetchLocations();
    fetchUsers();
  }, []);


// Update dropdown options when locations are fetched
  useEffect(() => {
    if (locations.length > 0) {
      const options = locations.map(location => ({
        label: location.name || `${location.street_number} ${location.street_name}`,
        value: location.id,
        key: `location-${location.id}` // Add unique key for each item
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
      logMessage('Fetching organization members...');
      
      // Use getOrganizationMembers from auth context
      const membersData = await getOrganizationMembers();
      logMessage(`Fetched ${membersData.length} organization members`);
      
      // Extract current user ID from auth context
      const currentUserId = userData?.userId;
      logMessage(`Current user ID from auth context: ${currentUserId}`);
      
      // Create options array with current user first, then others
      let options = [];
      
      // Add "Current User" option first
      options.push({
        label: 'Current User (You)',
        value: currentUserId,
        key: 'current-user'
      });
      
      // Add other users (excluding current user to avoid duplication)
      membersData.forEach(member => {
        // Skip if this is the current user
        if (member.user === currentUserId) return;
        
        // Create a meaningful label with name and role
        let roleLabel = '';
        switch(member.role) {
          case 'owner':
            roleLabel = '(Owner)';
            break;
          case 'admin':
            roleLabel = '(Admin)';
            break;
          case 'office_worker':
            roleLabel = '(Office)';
            break;
          case 'site_worker':
            roleLabel = '(Worker)';
            break;
          default:
            roleLabel = '';
        }
        
        // Check for user details in the response
        let displayName;
        if (member.user_first_name || member.user_last_name) {
          // If we have names, use them
          const firstName = member.user_first_name || '';
          const lastName = member.user_last_name || '';
          displayName = `${firstName} ${lastName}`.trim();
          if (!displayName) {
            displayName = `User ${member.user}`;
          }
          if (roleLabel) displayName += ` ${roleLabel}`;
        } else {
          // Fallback to user ID with role
          displayName = `User ${member.user} ${roleLabel}`;
        }
        
        options.push({
          label: displayName,
          value: member.user,
          key: `user-${member.user}`
        });
      });
      
      setUserOptions(options);
      
      // Default to current user
      if (currentUserId) {
        handleInputChange('user', currentUserId);
        logMessage(`Set default user to current user: ${currentUserId}`);
      } else if (options.length > 0) {
        handleInputChange('user', options[0].value);
        logMessage(`Set default user to first option: ${options[0].value}`);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      logMessage(`Error fetching users: ${error.message}`);
      
      // Create fallback with just current user
      const currentUserId = userData?.userId || 'current';
      const fallbackOptions = [
        { 
          label: 'Current User (You)',
          value: currentUserId,
          key: 'current-user'
        }
      ];
      
      setUserOptions(fallbackOptions);
      handleInputChange('user', currentUserId);
    }
  };


const handleInputChange = (name, value) => {
    setFormData(prev => ({
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

// Prepare device data without user/location assignment
  const prepareDeviceData = () => {
    logMessage('Preparing device data for submission');

    // Determine the make value based on selection
    const finalMake = formData.make === 'Other' ? otherMake : formData.make;
    // Determine the device_type value based on selection
    const finalDeviceType = formData.device_type === 'Other' ? otherDeviceType : formData.device_type;

    // Create the request data object - WITHOUT user or location
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

    // Include NFC tag ID if scanned before submission
    if (preScannedNfcTagId) {
      requestData.nfc_tag_id = preScannedNfcTagId;
      logMessage(`Including pre-scanned NFC tag ID: ${preScannedNfcTagId}`);
    }

    logMessage(`Prepared device data: ${JSON.stringify(requestData)}`);
    return requestData;
  };

  
// Handle device creation and assignment as separate steps
  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    logMessage('Starting device creation and assignment process');

    try {
      // STEP 1: Create the device (without assignment data)
      const deviceData = prepareDeviceData();
      logMessage('Creating device without assignment data');
      
      // Use axiosInstance from AuthContext for proper token handling
      const deviceResponse = await axiosInstance.post('/devices/', deviceData);
      
      // Extract the device ID and identifier
      const createdDeviceId = deviceResponse.data.id;
      const identifier = deviceResponse.data.identifier;
      
      logMessage(`Device created successfully with ID: ${createdDeviceId}, identifier: ${identifier}`);
      
      // STEP 2: Assign the device based on the toggle selection
      if (isUserAssignment) {
        if (formData.user === userData?.userId || formData.user === user?.id) {
          // OPTION A: If current user, use assign-to-me endpoint which doesn't need any body
          logMessage('Assigning device to current user (self)');
          await axiosInstance.post(`/device-assignments/device/${createdDeviceId}/assign-to-me/`);
          logMessage('Device assigned to current user successfully');
        } else {
          // OPTION B: For other users, use regular assign endpoint with user parameter
          logMessage(`Assigning device to user: ${formData.user}`);
          const assignmentData = {
            user: formData.user
          };
          await axiosInstance.post(`/device-assignments/device/${createdDeviceId}/assign/`, assignmentData);
          logMessage('Device assigned to user successfully');
        }
      } else {
        // OPTION C: Assign to location
        logMessage(`Assigning device to location: ${formData.location}`);
        const assignmentData = {
          location: formData.location
        };
        await axiosInstance.post(`/device-assignments/device/${createdDeviceId}/assign/`, assignmentData);
        logMessage('Device assigned to location successfully');
      }
      
      // Save the full API response for debugging
      setApiResponse(deviceResponse.data);
      setCreatedDeviceId(deviceResponse.data.id);
      
      // Set the identifier for use in NFC tag writing
      setDeviceIdentifier(identifier);
      
      // Show the success modal
      setNfcModalVisible(true);
      
    } catch (error) {
      console.error('Error in handleSubmit:', error);
      logMessage(`Error in device creation/assignment: ${error.message}`);
      
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
    setCreatedDeviceId(null);
    setScannedNfcUuid(null); // Clear NFC UUID when resetting
    setPreScannedNfcTagId(null); // Clear pre-scanned NFC tag when resetting
    setIsScanningNfc(false);
    // Reset NFC write options to defaults
    setNfcWriteOptions({
      description: false,
      make: true,
      model: true,
      serial_number: false,
      contact: true,
    });
  };

  const handleAddAnother = () => {
    resetForm();
    setNfcModalVisible(false);
  };

  const handleFinish = () => {
    if (createdDeviceId) {
      setNfcModalVisible(false);
      navigation.replace('DeviceDetails', { deviceId: createdDeviceId });
    } else {
      navigation.goBack();
    }
  };

  const handleNFCSuccess = () => {
    // Just update the UI state to show success, but keep the modal open
    // for the user to choose next steps
    setNfcWriteSuccess(true);
  };

/**
 * Scan NFC tag before form submission to include tag ID in device creation
 */
const handlePreScanNfc = async () => {
  try {
    setIsScanningNfc(true);
    logMessage('Pre-scanning NFC tag for device registration');

    const readResult = await nfcService.readNFC({ timeout: 60000 });

    if (!readResult.success) {
      throw new Error(readResult.error || 'Failed to read NFC tag');
    }

    const tagId = readResult.data?.tagId;
    if (!tagId) {
      throw new Error('Could not read tag ID. Please try again.');
    }

    logMessage(`Pre-scanned NFC tag ID: ${tagId}`);

    // Check if the NFC tag is already registered with another device
    try {
      const existingDevice = await deviceService.getDeviceByNfcUuid(tagId);
      if (existingDevice) {
        logMessage(`NFC tag ${tagId} is already registered with device ${existingDevice.identifier}`);
        setTagAlreadyRegisteredModal({
          visible: true,
          tagId: tagId,
          deviceIdentifier: existingDevice.identifier,
        });
        return;
      }
    } catch (checkError) {
      // 404 = not found = tag is available for registration
      logMessage('NFC tag is available for registration');
    }

    setPreScannedNfcTagId(tagId);
    // Tag ID is now shown in the form UI - no need for additional alert
  } catch (error) {
    logMessage(`Error pre-scanning NFC: ${error.message}`);
    Alert.alert('NFC Scan Error', error.message);
  } finally {
    setIsScanningNfc(false);
  }
};

// NFC write function - writes selected data with device ID as primary key
const handleNFCWrite = async () => {
  let result = false;

  try {
    setIsWritingNfc(true);
    logMessage('Starting NFC write operation');

    // Device ID is always included as primary key
    const nfcData = {
      id: deviceIdentifier,
    };

    // Add optional fields based on user selection
    if (nfcWriteOptions.description && formData.description) {
      nfcData.desc = formData.description;
    }
    if (nfcWriteOptions.make) {
      const finalMake = formData.make === 'Other' ? otherMake : formData.make;
      if (finalMake) nfcData.make = finalMake;
    }
    if (nfcWriteOptions.model && formData.model) {
      nfcData.model = formData.model;
    }
    if (nfcWriteOptions.serial_number && formData.serial_number) {
      nfcData.sn = formData.serial_number;
    }
    if (nfcWriteOptions.contact) {
      const orgContact = userData?.orgEmail || userData?.orgPhone || '';
      if (orgContact) nfcData.contact = orgContact;
    }

    logMessage(`NFC data to write: ${JSON.stringify(nfcData)}`);

    // Use the NFCService to write minimal data
    const writeResult = await nfcService.writeNFC(JSON.stringify(nfcData));

    if (writeResult.success) {
      logMessage('NFC write operation completed successfully');
      result = true;
      setNfcWriteSuccess(true);
    } else {
      throw new Error(writeResult.error || 'Unknown error occurred during NFC write');
    }
  } catch (error) {
    logMessage(`Error in NFC write operation: ${error.message}`);

    Alert.alert('NFC Write Error', error.message, [
      {
        text: 'Retry',
        onPress: () => handleNFCWrite(),
        style: 'default'
      },
      {
        text: 'Cancel',
        style: 'cancel',
        onPress: () => {
          setIsWritingNfc(false);
        }
      }
    ]);
  } finally {
    setIsWritingNfc(false);
  }

  return result;
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
                  accentColor={ORANGE_COLOR}
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
                  trackColor={{ false: ORANGE_COLOR, true: ORANGE_COLOR }}
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

            {/* NFC Tag Registration Section */}
            <View style={styles.nfcSection}>
              <Text style={styles.label}>NFC Tag (Optional)</Text>
              {preScannedNfcTagId ? (
                <View style={styles.nfcTagScanned}>
                  <View style={styles.nfcTagInfo}>
                    <Text style={styles.nfcTagLabel}>Tag ID:</Text>
                    <Text style={styles.nfcTagId}>{preScannedNfcTagId}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.nfcClearButton}
                    onPress={() => setPreScannedNfcTagId(null)}
                  >
                    <Text style={styles.nfcClearButtonText}>Clear</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.nfcScanButton, isScanningNfc && styles.nfcScanButtonDisabled]}
                  onPress={handlePreScanNfc}
                  disabled={isScanningNfc}
                >
                  <Text style={styles.nfcScanButtonText}>
                    {isScanningNfc ? 'Scanning...' : 'Scan NFC Tag'}
                  </Text>
                </TouchableOpacity>
              )}
              <Text style={styles.nfcHint}>
                Scan an NFC tag now to register it with this device
              </Text>
            </View>

            {/* Submit Button */}
            <Button
              title="Submit"
              onPress={handleSubmit}
              loading={loading}
              style={styles.submitButton}
              textColorProp="black"
            />
          </View>
        </ScrollView>
{/* NFC Modal - Custom Orange Theme */}
        <CustomModal
          visible={nfcModalVisible}
          onClose={() => {
            if (createdDeviceId) {
              setNfcModalVisible(false);
              navigation.replace('DeviceDetails', { deviceId: createdDeviceId });
            } else {
              setNfcModalVisible(false);
            }
          }}
          title="Device Created"
          titleColor={ORANGE_COLOR}
          titleSize={20}
          closeButtonColor={ORANGE_COLOR}
          borderRadius={15}
          padding={20}
          headerStyle={styles.customModalHeader}
          contentStyle={styles.customModalContent}
        >
          <View style={styles.successHeader}>
            <Text style={styles.successIcon}>✓</Text>
            <Text style={styles.successText}>Device Added Successfully!</Text>
          </View>
          <View style={styles.deviceIdBox}>
            <Text style={styles.deviceIdLabel}>Device ID</Text>
            <Text style={styles.deviceIdValue}>{deviceIdentifier}</Text>
          </View>

          {/* NFC Tag Registration Section */}
          <View style={styles.dataPreview}>
            <Text style={styles.dataPreviewTitle}>
              {preScannedNfcTagId
                ? 'NFC Tag Registered!'
                : 'No NFC Tag Registered'}
            </Text>

            {preScannedNfcTagId ? (
              <Text style={styles.dataPreviewItem}>Tag ID: {preScannedNfcTagId}</Text>
            ) : (
              <Text style={styles.dataPreviewHint}>
                To register an NFC tag with a device, scan it before submitting the form.
              </Text>
            )}
          </View>

          {/* Write data to tag (optional, after registration) */}
          {preScannedNfcTagId && !nfcWriteSuccess && (
            <View style={styles.writeOptionsContainer}>
              <Text style={styles.writeOptionsTitle}>Select data to write to tag:</Text>

              {/* Device ID - always included */}
              <View style={styles.writeOptionRow}>
                <Text style={styles.writeOptionLabelFixed}>Device ID (always included)</Text>
                <Text style={styles.writeOptionValue}>{deviceIdentifier}</Text>
              </View>

              {/* Optional fields */}
              <View style={styles.writeOptionRow}>
                <Text style={styles.writeOptionLabel}>Make</Text>
                <Switch
                  value={nfcWriteOptions.make}
                  onValueChange={(val) => setNfcWriteOptions(prev => ({...prev, make: val}))}
                  trackColor={{ false: '#ccc', true: ORANGE_COLOR }}
                  thumbColor={Platform.OS === 'ios' ? '' : '#fff'}
                />
              </View>

              <View style={styles.writeOptionRow}>
                <Text style={styles.writeOptionLabel}>Model</Text>
                <Switch
                  value={nfcWriteOptions.model}
                  onValueChange={(val) => setNfcWriteOptions(prev => ({...prev, model: val}))}
                  trackColor={{ false: '#ccc', true: ORANGE_COLOR }}
                  thumbColor={Platform.OS === 'ios' ? '' : '#fff'}
                />
              </View>

              <View style={styles.writeOptionRow}>
                <Text style={styles.writeOptionLabel}>Description</Text>
                <Switch
                  value={nfcWriteOptions.description}
                  onValueChange={(val) => setNfcWriteOptions(prev => ({...prev, description: val}))}
                  trackColor={{ false: '#ccc', true: ORANGE_COLOR }}
                  thumbColor={Platform.OS === 'ios' ? '' : '#fff'}
                />
              </View>

              <View style={styles.writeOptionRow}>
                <Text style={styles.writeOptionLabel}>Serial Number</Text>
                <Switch
                  value={nfcWriteOptions.serial_number}
                  onValueChange={(val) => setNfcWriteOptions(prev => ({...prev, serial_number: val}))}
                  trackColor={{ false: '#ccc', true: ORANGE_COLOR }}
                  thumbColor={Platform.OS === 'ios' ? '' : '#fff'}
                />
              </View>

              <View style={styles.writeOptionRow}>
                <Text style={styles.writeOptionLabel}>Contact Info</Text>
                <Switch
                  value={nfcWriteOptions.contact}
                  onValueChange={(val) => setNfcWriteOptions(prev => ({...prev, contact: val}))}
                  trackColor={{ false: '#ccc', true: ORANGE_COLOR }}
                  thumbColor={Platform.OS === 'ios' ? '' : '#fff'}
                />
              </View>

              <Button
                title={isWritingNfc ? 'Writing...' : 'Write Data to Tag'}
                onPress={async () => {
                  const success = await handleNFCWrite();
                  if (success) {
                    handleNFCSuccess();
                  }
                }}
                disabled={isWritingNfc}
                loading={isWritingNfc}
                style={styles.nfcButton}
                textColorProp="white"
              />
            </View>
          )}

          {nfcWriteSuccess && (
            <View style={styles.successBadge}>
              <Text style={styles.successBadgeText}>Data written to NFC tag</Text>
            </View>
          )}

          {nfcWriteSuccess && (
            <Button
              title="View Device"
              onPress={handleFinish}
              style={[styles.nfcButton, { marginBottom: 5 }]}
              textColorProp="white"
            />
          )}

          {/* Action Buttons */}
          <View style={styles.modalButtonRow}>
            <Button
              title="Add Another"
              onPress={handleAddAnother}
              style={[styles.actionButton, styles.addButton]}
              textColorProp="white"
            />
            <Button
              title="View Device"
              onPress={handleFinish}
              style={[styles.actionButton, styles.finishButton]}
              textColorProp="white"
            />
          </View>
        </CustomModal>

        {/* Tag Already Registered Modal */}
        <CustomModal
          visible={tagAlreadyRegisteredModal.visible}
          onClose={() => setTagAlreadyRegisteredModal(prev => ({...prev, visible: false}))}
          title="Tag Already Registered"
          titleColor="#d32f2f"
          titleSize={18}
          closeButtonColor="#d32f2f"
          borderRadius={15}
          padding={20}
          headerStyle={styles.errorModalHeader}
          contentStyle={styles.errorModalContent}
        >
          <View style={styles.errorIconContainer}>
            <Text style={styles.errorIcon}>!</Text>
          </View>
          <Text style={styles.errorMessage}>
            This NFC tag is already registered with another device.
          </Text>
          <View style={styles.errorDeviceBox}>
            <Text style={styles.errorDeviceLabel}>Registered to:</Text>
            <Text style={styles.errorDeviceId}>{tagAlreadyRegisteredModal.deviceIdentifier}</Text>
          </View>
          <Text style={styles.errorHint}>Please use a different NFC tag.</Text>
          <View style={styles.modalButtonRow}>
            <Button
              title="OK"
              onPress={() => setTagAlreadyRegisteredModal(prev => ({...prev, visible: false}))}
              style={styles.errorButton}
              textColorProp="white"
            />
          </View>
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
    backgroundColor: ORANGE_COLOR,
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
    backgroundColor: '#fafafa',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#ccc',
  },
  dataPreviewTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  dataPreviewItem: {
    fontSize: 13,
    color: ORANGE_COLOR,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '500',
  },
  dataPreviewHint: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
    lineHeight: 18,
  },
  successBadge: {
    backgroundColor: '#fff3e0',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: ORANGE_COLOR,
  },
  successBadgeText: {
    color: ORANGE_COLOR,
    fontWeight: '600',
    fontSize: 14,
  },
  nfcButton: {
    marginTop: 15,
    backgroundColor: ORANGE_COLOR,
    width: '100%',
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
    fontSize: 16,
    fontWeight: '600',
    color: '#2e7d32',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
  },
  modalButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
    paddingBottom: Platform.OS === 'android' ? 20 : 0,
  },
  actionButton: {
    flex: 1,
    margin: 10,
  },
  addButton: {
    backgroundColor: '#666', // Gray for secondary action
  },
  finishButton: {
    backgroundColor: ORANGE_COLOR, // Orange color to match app theme
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
    color: ORANGE_COLOR, // Matching app theme
  },
  toggleTextInactive: {
    fontSize: 16,
    color: '#777',
  },
  bottomSpacer: {
    height: 100, // Extra space at the bottom
  },
  // NFC Section styles
  nfcSection: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  nfcTagScanned: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#d4edda',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  nfcTagInfo: {
    flex: 1,
  },
  nfcTagLabel: {
    fontSize: 12,
    color: '#155724',
    marginBottom: 2,
  },
  nfcTagId: {
    fontSize: 14,
    fontWeight: '600',
    color: '#155724',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  nfcClearButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#c3e6cb',
    borderRadius: 5,
  },
  nfcClearButtonText: {
    fontSize: 14,
    color: '#155724',
  },
  nfcScanButton: {
    backgroundColor: ORANGE_COLOR,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  nfcScanButtonDisabled: {
    backgroundColor: '#ccc',
  },
  nfcScanButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  nfcHint: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  // Write options styles
  writeOptionsContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: ORANGE_COLOR,
  },
  writeOptionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: ORANGE_COLOR,
    marginBottom: 12,
  },
  writeOptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  writeOptionLabel: {
    fontSize: 14,
    color: '#333',
  },
  writeOptionLabelFixed: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  writeOptionValue: {
    fontSize: 12,
    color: ORANGE_COLOR,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  // Custom modal styles
  customModalHeader: {
    borderBottomColor: ORANGE_COLOR,
    borderBottomWidth: 2,
    paddingBottom: 12,
  },
  customModalContent: {
    maxHeight: '85%',
    paddingBottom: Platform.OS === 'android' ? 10 : 0,
  },
  successHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },
  successIcon: {
    fontSize: 24,
    color: '#4CAF50',
    fontWeight: 'bold',
    marginRight: 10,
    backgroundColor: '#e8f5e9',
    width: 36,
    height: 36,
    textAlign: 'center',
    lineHeight: 36,
    borderRadius: 18,
    overflow: 'hidden',
  },
  deviceIdBox: {
    backgroundColor: '#fff3e0',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: ORANGE_COLOR,
  },
  deviceIdLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  deviceIdValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: ORANGE_COLOR,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  // Error modal styles (Tag Already Registered)
  errorModalHeader: {
    borderBottomColor: '#d32f2f',
    borderBottomWidth: 2,
    paddingBottom: 12,
  },
  errorModalContent: {
    maxHeight: '70%',
  },
  errorIconContainer: {
    alignItems: 'center',
    marginBottom: 15,
  },
  errorIcon: {
    fontSize: 28,
    color: '#fff',
    fontWeight: 'bold',
    backgroundColor: '#d32f2f',
    width: 50,
    height: 50,
    textAlign: 'center',
    lineHeight: 50,
    borderRadius: 25,
    overflow: 'hidden',
  },
  errorMessage: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginBottom: 15,
    lineHeight: 22,
  },
  errorDeviceBox: {
    backgroundColor: '#ffebee',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#d32f2f',
  },
  errorDeviceLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  errorDeviceId: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#d32f2f',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  errorHint: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: 10,
  },
  errorButton: {
    flex: 1,
    backgroundColor: '#d32f2f',
    marginHorizontal: 0,
  },
});

export default AddDevicePage;