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
    setScannedNfcUuid(null); // Clear NFC UUID when resetting
    setIsScanningNfc(false);
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

// Simplified NFC write function - writes minimal data (ID + contact info)
const handleNFCWrite = async () => {
  let result = false;

  try {
    setIsWritingNfc(true);
    logMessage('Starting NFC write operation (minimal data)');

    // Get organization contact info from userData context
    // Falls back to empty string if not available
    const orgContact = userData?.orgEmail || userData?.orgPhone || '';

    // Prepare minimal device data for NFC writing
    const nfcData = {
      id: deviceIdentifier,
      contact: orgContact
    };

    logMessage(`Minimal NFC data to write: ${JSON.stringify(nfcData)}`);

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

/**
 * Scan NFC tag to capture hardware UID for device registration
 * This registers the tag's UID with the device in the database
 */
const handleScanNfcForRegistration = async () => {
  try {
    setIsScanningNfc(true);
    logMessage('Scanning NFC tag for UUID registration');

    const readResult = await nfcService.readNFC({ timeout: 60000 });

    if (!readResult.success) {
      throw new Error(readResult.error || 'Failed to read NFC tag');
    }

    const tagId = readResult.data?.tagId;
    if (!tagId) {
      throw new Error('Could not read tag ID. Please try again.');
    }

    logMessage(`Captured NFC tag ID: ${tagId}`);
    setScannedNfcUuid(tagId);

    // Register the NFC tag ID with the device via API
    if (!apiResponse?.id) {
      throw new Error('Device ID not available. The device may not have been created successfully. Please try adding the device again.');
    }

    try {
      await axiosInstance.patch(`/devices/${apiResponse.id}/`, {
        nfc_tag_id: tagId
      });
      logMessage(`Registered NFC tag ID ${tagId} with device ${apiResponse.id}`);

      Alert.alert(
        'NFC Tag Registered',
        `Tag has been registered with device ${deviceIdentifier}.\n\nYou can now scan this tag to identify and assign the device.`
      );
    } catch (patchError) {
      logMessage(`Error registering NFC UUID: ${patchError.message}`);

      // Log full error details for debugging
      if (patchError.response) {
        logMessage(`Error status: ${patchError.response.status}`);
        logMessage(`Error data: ${JSON.stringify(patchError.response.data)}`);
      }

      // Provide specific error messages for different API failure scenarios
      if (patchError.response?.status === 409) {
        throw new Error('This NFC tag is already registered with another device. Please use a different tag.');
      } else if (patchError.response?.status === 404) {
        throw new Error('Device not found. It may have been deleted. Please try adding the device again.');
      } else if (patchError.response?.status === 400) {
        const errorDetail = patchError.response.data?.nfc_uuid?.[0] ||
                           patchError.response.data?.detail ||
                           'Invalid NFC tag format.';
        throw new Error(errorDetail);
      } else {
        throw new Error('Failed to register NFC tag with device. Please try again.');
      }
    }
  } catch (error) {
    logMessage(`Error scanning NFC for registration: ${error.message}`);
    Alert.alert('NFC Scan Error', error.message);
    setScannedNfcUuid(null);
  } finally {
    setIsScanningNfc(false);
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
{/* NFC Modal */}
        <CustomModal
          visible={nfcModalVisible}
          onClose={() => setNfcModalVisible(false)}
          title="Device Created Successfully"
          style={styles.modal}
        >
          <Text style={styles.successText}>Device Added Successfully!</Text>
          <Text style={styles.modalText}>Device ID: {deviceIdentifier}</Text>

          {/* NFC Tag Registration Section */}
          <View style={styles.dataPreview}>
            <Text style={styles.dataPreviewTitle}>
              {scannedNfcUuid
                ? 'NFC Tag Registered!'
                : 'Optional: Register an NFC tag with this device'}
            </Text>

            {scannedNfcUuid ? (
              <Text style={styles.dataPreviewItem}>Tag UUID: {scannedNfcUuid}</Text>
            ) : (
              <Text style={styles.dataPreviewHint}>
                Scan an NFC tag to link it with this device. You can then use the tag to quickly identify and assign the device.
              </Text>
            )}
          </View>

          {/* NFC Registration Button */}
          {!scannedNfcUuid && (
            <Button
              title={isScanningNfc ? 'Scanning...' : 'Scan NFC Tag to Register'}
              onPress={handleScanNfcForRegistration}
              disabled={isScanningNfc}
              loading={isScanningNfc}
              style={styles.nfcButton}
              textColorProp="white"
            />
          )}

          {/* Write ID to tag (optional, after registration) */}
          {scannedNfcUuid && !nfcWriteSuccess && (
            <View style={styles.buttonRow}>
              <Button
                title={isWritingNfc ? 'Writing...' : 'Write ID to NFC Tag'}
                onPress={async () => {
                  const success = await handleNFCWrite();
                  if (success) {
                    handleNFCSuccess();
                  }
                }}
                disabled={isWritingNfc}
                loading={isWritingNfc}
                style={[styles.actionButton, styles.nfcButton]}
                textColorProp="white"
              />
            </View>
          )}

          {nfcWriteSuccess && (
            <View style={styles.successBadge}>
              <Text style={styles.successBadgeText}>Device ID written to NFC tag</Text>
            </View>
          )}

          {/* Cancel scanning indicator */}
          {isScanningNfc && (
            <View style={styles.nfcWritingContainer}>
              <Text style={styles.nfcInstructionText}>
                Hold your device near the NFC tag...
              </Text>
              <Button
                title="Cancel"
                onPress={() => {
                  nfcService.cancelOperation();
                  setIsScanningNfc(false);
                }}
                style={styles.cancelButton}
                textColorProp="white"
              />
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.buttonRow}>
            <Button
              title="Add Another Device"
              onPress={handleAddAnother}
              style={[styles.actionButton, styles.addButton]}
              textColorProp="white"
            />
            <Button
              title="Finish"
              onPress={handleFinish}
              style={[styles.actionButton, styles.finishButton]}
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
  dataPreviewHint: {
    fontSize: 14,
    color: '#333',
    fontStyle: 'italic',
  },
  successBadge: {
    backgroundColor: '#d4edda',
    borderRadius: 8,
    padding: 12,
    marginVertical: 10,
    alignItems: 'center',
  },
  successBadgeText: {
    color: '#155724',
    fontWeight: '600',
    fontSize: 14,
  },
  nfcButton: {
    marginTop: 10,
    backgroundColor: '#4CAF50', // Green color
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
  }
});

export default AddDevicePage;