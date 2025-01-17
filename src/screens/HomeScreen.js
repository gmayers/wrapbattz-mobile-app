import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
  Platform,
  ActivityIndicator,
  Dimensions,
  Modal,
  TextInput,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Button from '../components/Button';
import Card from '../components/Card';
import TabBar from '../components/TabBar';
import NfcManager, { NfcTech, Ndef } from 'react-native-nfc-manager';
import { PasswordInput } from '../components/TextInput';

const { width } = Dimensions.get('window');

const HomeScreen = ({ navigation }) => {
  // State declarations
  const { logout, getAccessToken } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selectedReturnLocation, setSelectedReturnLocation] = useState(null);
  const [loading, setLoading] = useState(true);

  // Modal visibility states
  const [nfcManagerModalVisible, setNfcManagerModalVisible] = useState(false);
  const [assignDeviceModalVisible, setAssignDeviceModalVisible] = useState(false);
  const [returnDeviceModalVisible, setReturnDeviceModalVisible] = useState(false);
  const [selectedReturnDevice, setSelectedReturnDevice] = useState(null);

  // NFC Manager states
  const [nfcActiveTab, setNfcActiveTab] = useState('read');
  const [writeFields, setWriteFields] = useState([{ label: '', value: '' }]);
  const [isWriting, setIsWriting] = useState(false);
  const [lockPassword, setLockPassword] = useState('');
  const [unlockPassword, setUnlockPassword] = useState('');
  const [isLocking, setIsLocking] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);

  // Assign Device Modal states
  const [assignTab, setAssignTab] = useState('nfcScan');
  const [assignLoading, setAssignLoading] = useState(false);
  const [selectedLocationAssign, setSelectedLocationAssign] = useState(null);
  const [availableDevices, setAvailableDevices] = useState([]);
  const [selectedDeviceAssign, setSelectedDeviceAssign] = useState(null);

  // NFC Tabs Configuration
  const nfcTabs = [
    { key: 'read', title: 'Read', icon: <Ionicons name="scan-outline" size={20} /> },
    { key: 'write', title: 'Write', icon: <Ionicons name="create-outline" size={20} /> },
    { key: 'lock', title: 'Lock', icon: <Ionicons name="lock-closed-outline" size={20} /> },
    { key: 'unlock', title: 'Unlock', icon: <Ionicons name="lock-open-outline" size={20} /> },
    { key: 'edit', title: 'Edit', icon: <Ionicons name="create-outline" size={20} /> },
  ];

  // Tabs for bottom navigation
  const tabs = [
    { key: 'dashboard', title: 'Home', icon: <Ionicons name="home-outline" size={24} /> },
    { key: 'reports', title: 'Reports', icon: <Ionicons name="document-text-outline" size={24} /> },
    { key: 'logout', title: 'Logout', icon: <Ionicons name="log-out-outline" size={24} /> },
  ];

  // Initialize NFC Manager
  useEffect(() => {
    NfcManager.start();
    fetchDeviceAssignments();
    fetchLocations();

    return () => {
      NfcManager.cancelTechnologyRequest().catch(() => 0);
    };
  }, []);

  // API Functions
  const fetchDeviceAssignments = async () => {
    let isMounted = true;
    try {
      const token = await getAccessToken();
      if (!token) {
        Alert.alert('Error', 'Authentication token not found. Please log in again.');
        await logout();
        return;
      }

      const response = await axios.get('https://test.gmayersservices.com/api/device-assignments/', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const activeAssignments = response.data.filter(assignment => !assignment.returned_date);
      if (isMounted) {
        setAssignments(activeAssignments);
      }
    } catch (error) {
      handleApiError(error, 'Failed to fetch device assignments.');
    } finally {
      if (isMounted) {
        setLoading(false);
      }
    }
    return () => { isMounted = false; };
  };

  const fetchLocations = async () => {
    let isMounted = true;
    try {
      const token = await getAccessToken();
      if (!token) {
        Alert.alert('Error', 'Authentication token not found. Please log in again.');
        await logout();
        return;
      }

      const response = await axios.get('https://test.gmayersservices.com/api/locations/', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (isMounted) {
        setLocations(response.data);
      }
    } catch (error) {
      handleApiError(error, 'Failed to fetch locations.');
    }
    return () => { isMounted = false; };
  };

  const fetchDevicesByLocation = async (locationId) => {
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      const response = await axios.get(`https://test.gmayersservices.com/api/devices/?location=${locationId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      setAvailableDevices(response.data);
    } catch (error) {
      handleApiError(error, 'Failed to fetch devices for the selected location.');
    }
  };

  // Error handling
  const handleApiError = (error, defaultMessage) => {
    if (error.response) {
      const errorMessage = error.response.data.detail || defaultMessage;
      Alert.alert('Error', errorMessage);
    } else if (error.request) {
      Alert.alert('Error', 'No response from server. Please try again later.');
    } else {
      Alert.alert('Error', error.message || defaultMessage);
    }

    if (error.response && error.response.status === 401) {
      Alert.alert(
        'Session Expired',
        'Your session has expired. Please login again.',
        [
          {
            text: 'OK',
            onPress: async () => {
              await logout();
            }
          }
        ]
      );
    }
  };

  // Device Return Functions
  const handleDeviceReturn = (assignment) => {
    if (!assignment || !assignment.device) {
      Alert.alert('Error', 'Invalid device data');
      return;
    }
    
    setSelectedReturnDevice(assignment.device);
    setReturnDeviceModalVisible(true);
    setSelectedReturnLocation(null);
  };

  const handleConfirmReturn = async () => {
    if (!selectedReturnLocation) {
      Alert.alert('Error', 'Please select a location.');
      return;
    }

    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      const returnedDateTime = new Date().toISOString();

      await axios.patch(
        `https://test.gmayersservices.com/api/device-assignments/${selectedReturnDevice.id}/`,
        {
          returned_date: returnedDateTime.split('T')[0],
          returned_time: returnedDateTime.split('T')[1].split('.')[0],
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const newEntryData = {
        device_id: selectedReturnDevice.id,
        location: selectedReturnLocation.id,
        returned_date_time: returnedDateTime,
      };

      await axios.post(
        'https://test.gmayersservices.com/api/device-returns/',
        newEntryData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      Alert.alert('Success', 'Device has been returned successfully');
      setReturnDeviceModalVisible(false);
      setSelectedReturnLocation(null);
      fetchDeviceAssignments();
    } catch (error) {
      handleApiError(error, 'Failed to return device.');
    }
  };

  // Device Card Render Function
  const renderDeviceCard = (assignment) => (
    <Card
      key={assignment.id}
      title={assignment.device.identifier}
      subtitle={assignment.device.device_type}
      style={styles.deviceCard}
    >
      <View style={styles.cardContent}>
        <View style={styles.cardInfo}>
          <Text style={styles.infoText}>Make: {assignment.device.make}</Text>
          <Text style={styles.infoText}>Model: {assignment.device.model}</Text>
          <Text style={styles.infoText}>Assigned: {assignment.assigned_date}</Text>
        </View>
        <View style={styles.cardActions}>
          <Button
            title="Return"
            variant="outlined"
            size="small"
            onPress={() => handleDeviceReturn(assignment)}
            style={styles.returnButton}
          />
        </View>
      </View>
    </Card>
  );

  // NFC Functions
  const withNfcManager = async (callback) => {
    try {
      await NfcManager.requestTechnology(NfcTech.Ndef);
      const result = await callback();
      return result;
    } catch (error) {
      console.error('NFC Error:', error);
      throw error;
    } finally {
      NfcManager.cancelTechnologyRequest().catch(() => 0);
    }
  };

  const jsonToNdef = (jsonData) => {
    const payload = JSON.stringify(jsonData);
    return Ndef.encodeMessage([Ndef.textRecord(payload)]);
  };

  const ndefToJson = (tag) => {
    try {
      if (tag.ndefMessage && tag.ndefMessage.length > 0) {
        const ndefRecord = tag.ndefMessage[0];
        const textDecoder = new TextDecoder();
        const payload = textDecoder.decode(ndefRecord.payload);
        const jsonString = payload.slice(3);
        return JSON.parse(jsonString);
      }
    } catch (error) {
      console.error('Error parsing NDEF:', error);
    }
    return null;
  };

  // NFC Action Handlers
  const handleReadNfc = async () => {
    try {
      await withNfcManager(async () => {
        const tag = await NfcManager.getTag();
        if (tag) {
          const parsedData = ndefToJson(tag);
          if (parsedData) {
            Alert.alert('NFC Data', JSON.stringify(parsedData, null, 2));
          } else {
            Alert.alert('Error', 'Failed to parse NFC tag data.');
          }
        } else {
          Alert.alert('Error', 'No NFC tag found.');
        }
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to read NFC tag.');
      console.error('Error reading NFC:', error);
    }
  };

  const handleWriteNfc = async () => {
    try {
      setIsWriting(true);
      const jsonData = convertFieldsToJson();
      if (Object.keys(jsonData).length === 0) {
        Alert.alert('Error', 'Please enter at least one label/value pair.');
        return;
      }
      await withNfcManager(async () => {
        const ndefMessage = jsonToNdef(jsonData);
        await NfcManager.ndefHandler.writeNdefMessage(ndefMessage);
        Alert.alert('Success', 'Data written to NFC tag successfully!');
        setWriteFields([{ label: '', value: '' }]);
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to write to NFC tag.');
      console.error('Error writing NFC:', error);
    } finally {
      setIsWriting(false);
    }
  };

  const handleLockNfc = async () => {
    if (!lockPassword) {
      Alert.alert('Error', 'Please enter a password to lock the tag.');
      return;
    }

    try {
      setIsLocking(true);
      await withNfcManager(async () => {
        const jsonData = {
          locked: true,
          password: lockPassword,
        };
        const ndefMessage = jsonToNdef(jsonData);
        await NfcManager.ndefHandler.writeNdefMessage(ndefMessage);
        Alert.alert('Success', 'NFC tag has been locked with a password.');
        setLockPassword('');
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to lock NFC tag.');
      console.error('Error locking NFC:', error);
    } finally {
      setIsLocking(false);
    }
  };

  const handleUnlockNfc = async () => {
    if (!unlockPassword) {
      Alert.alert('Error', 'Please enter the current password to unlock.');
      return;
    }

    try {
      setIsUnlocking(true);
      await withNfcManager(async () => {
        const tag = await NfcManager.getTag();
        if (tag) {
          const existingData = ndefToJson(tag);
          if (existingData && existingData.locked && existingData.password === unlockPassword) {
            const newData = { locked: false };
            const ndefMessage = jsonToNdef(newData);
            await NfcManager.ndefHandler.writeNdefMessage(ndefMessage);
            Alert.alert('Success', 'Password removed. NFC tag is now unlocked.');
            setUnlockPassword('');
          } else {
            Alert.alert('Error', 'Incorrect password or tag is not locked.');
          }
        } else {
          Alert.alert('Error', 'No NFC tag found.');
        }
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to unlock NFC tag.');
      console.error('Error unlocking NFC:', error);
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleEditNfc = async () => {
    try {
      await withNfcManager(async () => {
        const tag = await NfcManager.getTag();
        if (tag) {
          const parsedData = ndefToJson(tag);
          if (parsedData) {
            const updatedData = {
              ...parsedData,
              edited: true,
            };
            const ndefMessage = jsonToNdef(updatedData);
            await NfcManager.ndefHandler.writeNdefMessage(ndefMessage);
            Alert.alert('Success', 'NFC tag data edited successfully!');
          } else {
            Alert.alert('Error', 'Failed to parse NFC tag data.');
          }
        } else {
          Alert.alert('Error', 'No NFC tag found.');
        }
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to edit NFC tag.');
      console.error('Error editing NFC:', error);
    }
  };

  // Write Fields Handlers
  const handleDeleteWriteField = (index) => {
    if (writeFields.length === 1) {
      Alert.alert('Error', 'At least one label-value pair is required.');
      return;
    }
    const updatedFields = writeFields.filter((_, idx) => idx !== index);
    setWriteFields(updatedFields);
  };

  const handleWriteFieldChange = (index, field, text) => {
    const updatedFields = writeFields.map((item, idx) => {
      if (idx === index) {
        return { ...item, [field]: text };
      }
      return item;
    });
    setWriteFields(updatedFields);
  };

  const addWriteFieldRow = () => {
    setWriteFields([...writeFields, { label: '', value: '' }]);
  };

  const convertFieldsToJson = () => {
    const jsonData = {};
    writeFields.forEach(({ label, value }) => {
      if (label.trim() !== '') {
        jsonData[label.trim()] = value.trim();
      }
    });
    return jsonData;
  };

  // Assignment Handlers
  const handleAssignNfc = async () => {
    try {
      setAssignLoading(true);
      await withNfcManager(async () => {
        const tag = await NfcManager.getTag();
        if (tag) {
          const parsedData = ndefToJson(tag);
          if (parsedData && parsedData.id) {
            const token = await getAccessToken();
            if (!token) {
              throw new Error('No authentication token available');
            }

            await axios.post(
              'https://test.gmayersservices.com/api/assign-device/',
              { device_id: parsedData.id },
              {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
              }
            );

            Alert.alert('Success', `Device with ID ${parsedData.id} assigned successfully.`);
            setAssignDeviceModalVisible(false);
            fetchDeviceAssignments();
          } else {
            Alert.alert('Error', 'Invalid NFC tag data.');
          }
        } else {
          Alert.alert('Error', 'No NFC tag found.');
        }
      });
    } catch (error) {
      handleApiError(error, 'Failed to assign device via NFC.');
    } finally {
      setAssignLoading(false);
    }
  };

  const handleAssignSelect = async () => {
    if (!selectedLocationAssign || !selectedDeviceAssign) {
      Alert.alert('Error', 'Please select both location and device.');
      return;
    }

    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      await axios.post(
        'https://test.gmayersservices.com/api/assign-device/',
        {
          device_id: selectedDeviceAssign.id,
          location_id: selectedLocationAssign.id,
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      Alert.alert('Success', `Device ${selectedDeviceAssign.name} assigned to ${selectedLocationAssign.name}.`);
      setAssignDeviceModalVisible(false);
      setSelectedLocationAssign(null);
      setSelectedDeviceAssign(null);
      setAvailableDevices([]);
      fetchDeviceAssignments();
    } catch (error) {
      handleApiError(error, 'Failed to assign device via selection.');
    }
  };

  // Tab Handlers
  const handleAssignTabChange = (key) => {
    setAssignTab(key);
    if (key === 'nfcScan') {
      setSelectedLocationAssign(null);
      setSelectedDeviceAssign(null);
      setAvailableDevices([]);
    }
  };

  const handleNfcTabPress = (key) => {
    setNfcActiveTab(key);
  };

  const handleTabPress = (key) => {
    switch (key) {
      case 'dashboard':
        break;
      case 'reports':
        navigation.navigate('Reports');
        break;
      case 'logout':
        Alert.alert(
          'Logout',
          'Are you sure you want to logout?',
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Logout',
              style: 'destructive',
              onPress: async () => {
                try {
                  await logout();
                } catch (error) {
                  console.error('Logout error:', error);
                  Alert.alert('Error', 'Failed to logout. Please try again.');
                }
              },
            },
          ],
          { cancelable: true }
        );
        break;
      default:
        break;
    }
  };

  // Modal Close Handlers
  const handleAssignDeviceModalClose = () => {
    setAssignDeviceModalVisible(false);
    setAssignTab('nfcScan');
    setAssignLoading(false);
    setSelectedLocationAssign(null);
    setSelectedDeviceAssign(null);
    setAvailableDevices([]);
  };

  const handleReturnDeviceModalClose = () => {
    setReturnDeviceModalVisible(false);
    setSelectedReturnLocation(null);
  };

  // Content Rendering Functions
  const renderAssignDeviceContent = () => {
    return (
      <ScrollView contentContainerStyle={[styles.modalContent, { paddingBottom: 60 }]}>
        <Text style={styles.modalTitle}>Assign Device</Text>
        
        <TabBar
          tabs={[
            {
              key: 'nfcScan',
              title: <Text>NFC Scan</Text>,
              icon: <Ionicons name="scan-outline" size={20} />,
            },
            {
              key: 'selectMenu',
              title: <Text>Select Menu</Text>,
              icon: <Ionicons name="list-outline" size={20} />,
            },
          ]}
          activeTab={assignTab}
          onTabPress={handleAssignTabChange}
          backgroundColor="#F9F9F9"
          activeColor="#007AFF"
          inactiveColor="#666666"
          showIcons
          showLabels
          height={50}
          containerStyle={[styles.assignTabBarContainer, { marginBottom: 15 }]}
          labelStyle={styles.assignTabBarLabel}
          iconStyle={styles.assignTabBarIcon}
        />
        
        {assignTab === 'nfcScan' && (
          <View style={styles.assignTabContent}>
            <Text style={styles.assignTabSubtitle}>Scan an NFC tag to assign a device.</Text>
            <Button
              title="Scan NFC Tag"
              onPress={handleAssignNfc}
              disabled={assignLoading}
              isLoading={assignLoading}
              style={styles.assignNfcButton}
            />
          </View>
        )}
        
        {assignTab === 'selectMenu' && (
          <View style={styles.assignTabContent}>
            <Text style={styles.assignTabSubtitle}>Select location and device to assign.</Text>

            <Text style={styles.pickerLabel}>Location:</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={selectedLocationAssign}
                onValueChange={(itemValue) => {
                  setSelectedLocationAssign(itemValue);
                  if (itemValue) {
                    fetchDevicesByLocation(itemValue.id);
                  } else {
                    setAvailableDevices([]);
                    setSelectedDeviceAssign(null);
                  }
                }}
                style={styles.picker}
              >
                <Picker.Item label="Select a location" value={null} />
                {locations.map((location) => (
                  <Picker.Item
                    key={location.id}
                    label={location.name || 'Unnamed Location'}
                    value={location}
                  />
                ))}
              </Picker>
            </View>
            
            <Text style={styles.pickerLabel}>Device:</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={selectedDeviceAssign}
                onValueChange={(itemValue) => setSelectedDeviceAssign(itemValue)}
                enabled={availableDevices.length > 0}
                style={styles.picker}
              >
                <Picker.Item label="Select a device" value={null} />
                {availableDevices.map((device) => (
                  <Picker.Item
                    key={device.id}
                    label={device.name || 'Unnamed Device'}
                    value={device}
                  />
                ))}
              </Picker>
            </View>
            
            <View style={styles.assignButtonsContainer}>
              <Button
                title="Submit"
                onPress={handleAssignSelect}
                disabled={assignLoading}
                isLoading={assignLoading}
                style={styles.submitButton}
              />
              <Button
                title="Close"
                onPress={() => setAssignDeviceModalVisible(false)}
                variant="outlined"
                style={styles.closeButton}
              />
            </View>
          </View>
        )}
      </ScrollView>
    );
  };

  const renderNfcTabContent = () => {
    switch (nfcActiveTab) {
      case 'read':
        return (
          <View style={styles.nfcTabContent}>
            <Text style={styles.nfcTabTitle}>Read NFC Tag</Text>
            <Text style={styles.nfcTabSubtitle}>Place your device near an NFC tag to read data.</Text>
            <Button
              title="Read Tag"
              onPress={handleReadNfc}
              style={styles.nfcButton}
            />
          </View>
        );

      case 'write':
        return (
          <View style={styles.nfcTabContent}>
            <Text style={styles.nfcTabTitle}>Write NFC Tag</Text>
            <Text style={styles.nfcTabSubtitle}>Enter label and value pairs to write to the NFC tag.</Text>
            
            {writeFields.map((field, index) => (
              <View key={index} style={styles.writeFieldRow}>
                <TextInput
                  style={styles.input}
                  placeholder="Label"
                  value={field.label}
                  onChangeText={(text) => handleWriteFieldChange(index, 'label', text)}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Value"
                  value={field.value}
                  onChangeText={(text) => handleWriteFieldChange(index, 'value', text)}
                />
                {index > 0 && (
                  <TouchableOpacity
                    onPress={() => handleDeleteWriteField(index)}
                    style={styles.deleteButton}
                    testID={`delete-write-field-${index}`}
                  >
                    <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                  </TouchableOpacity>
                )}
              </View>
            ))}
            
            <TouchableOpacity style={styles.addFieldButton} onPress={addWriteFieldRow}>
              <Text style={styles.addFieldText}>+ Add Value</Text>
            </TouchableOpacity>
            
            <Button
              title="Write to Tag"
              onPress={handleWriteNfc}
              disabled={isWriting || !writeFields.some((field) => field.label.trim())}
              isLoading={isWriting}
              style={styles.writeButton}
            />
          </View>
        );
      
      case 'lock':
        return (
          <View style={styles.nfcTabContent}>
            <Text style={styles.nfcTabTitle}>Lock NFC Tag</Text>
            <Text style={styles.nfcTabSubtitle}>
              Add a password to secure your NFC tag.
            </Text>
            <PasswordInput
              placeholder="Enter Password"
              value={lockPassword}
              onChangeText={setLockPassword}
            />
            <Button
              title="Lock Tag"
              onPress={handleLockNfc}
              disabled={isLocking}
              isLoading={isLocking}
              style={styles.lockButton}
            />
          </View>
        );

      case 'unlock':
        return (
          <View style={styles.nfcTabContent}>
            <Text style={styles.nfcTabTitle}>Unlock NFC Tag</Text>
            <Text style={styles.nfcTabSubtitle}>
              Remove the password from your NFC tag.
            </Text>
            <PasswordInput
              placeholder="Enter Current Password"
              value={unlockPassword}
              onChangeText={setUnlockPassword}
            />
            <Button
              title="Unlock Tag"
              onPress={handleUnlockNfc}
              disabled={isUnlocking}
              isLoading={isUnlocking}
              style={styles.unlockButton}
            />
          </View>
        );

      case 'edit':
        return (
          <View style={styles.nfcTabContent}>
            <Text style={styles.nfcTabTitle}>Edit NFC Tag</Text>
            <Text style={styles.nfcTabSubtitle}>
              Read the NFC tag to load existing data into the form, make changes, and save.
            </Text>
            <Button
              title="Load Tag Data"
              onPress={handleEditNfc}
              style={styles.loadButton}
            />
            <Button
              title="Save Changes"
              onPress={handleWriteNfc}
              disabled={isWriting}
              isLoading={isWriting}
              style={styles.writeButton}
            />
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header Section */}
      <View style={styles.header}>
        <View style={styles.welcomeContainer}>
          <Text style={styles.welcomeText} accessibilityRole="header">
            Welcome{'\n'}User
          </Text>
        </View>
        <View style={styles.spacer} />
        <View style={styles.buttonContainer}>
          <Button
            title="NFC Manager"
            onPress={() => setNfcManagerModalVisible(true)}
            size="small"
            style={styles.headerButton}
          />
          <Button
            title="Assign Device"
            onPress={() => setAssignDeviceModalVisible(true)}
            size="small"
            style={styles.headerButton}
          />
        </View>
      </View>

      {/* Device Assignments Section */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Devices Assigned</Text>
          <Button
            title="Add Device"
            onPress={() => navigation.navigate('AddDevice')}
            size="small"
            style={styles.addDeviceButton}
          />
        </View>
        <View style={styles.section}>
          {loading ? (
            <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
          ) : (
            <View style={styles.devicesContainer}>
              {assignments.length === 0 ? (
                <Text style={styles.emptyText}>No devices currently assigned</Text>
              ) : (
                <>
                  <View style={styles.devicesGrid}>
                    {assignments.slice(0, 5).map((assignment) => renderDeviceCard(assignment))}
                  </View>
                  {assignments.length > 5 && (
                    <TouchableOpacity
                      style={styles.viewAllButton}
                      onPress={() => navigation?.navigate('AllDevices', { assignments })}
                    >
                      <Text style={styles.viewAllText}>
                        View All ({assignments.length} Devices)
                      </Text>
                      <Ionicons name="chevron-forward" size={16} color="#007AFF" />
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom Tab Bar */}
      <TabBar
        tabs={tabs}
        activeTab="dashboard"
        onTabPress={handleTabPress}
        backgroundColor="#FFFFFF"
        activeColor="#007AFF"
        inactiveColor="#666666"
        showIcons
        showLabels
        height={Platform.OS === 'ios' ? 80 : 60}
        containerStyle={styles.tabBarContainer}
        labelStyle={styles.tabBarLabel}
        iconStyle={styles.tabBarIcon}
      />

      {/* Return Device Modal */}
      <Modal
        visible={returnDeviceModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={handleReturnDeviceModalClose}
      >
        <TouchableWithoutFeedback onPress={handleReturnDeviceModalClose}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContainer}>
                {selectedReturnDevice && (
                  <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>Return Device</Text>
                    <Text style={styles.modalText}>
                      Returning: <Text style={styles.modalTextBold}>{selectedReturnDevice.identifier}</Text>
                    </Text>
                    <Text style={styles.modalText}>
                      Type: <Text style={styles.modalTextBold}>{selectedReturnDevice.device_type}</Text>
                    </Text>

                    {/* Location Picker */}
                    <Text style={styles.modalText}>Select Location:</Text>
                    <View style={styles.pickerContainer}>
                      <Picker
                        selectedValue={selectedReturnLocation}
                        onValueChange={(itemValue) => setSelectedReturnLocation(itemValue)}
                        style={styles.picker}
                      >
                        <Picker.Item label="Select a location" value={null} />
                        {locations.map((location) => (
                          <Picker.Item key={location.id} label={location.name} value={location} />
                        ))}
                      </Picker>
                    </View>

                    <Button
                      title="Confirm Return"
                      onPress={handleConfirmReturn}
                      style={styles.confirmButton}
                    />
                    <Button
                      title="Cancel"
                      onPress={handleReturnDeviceModalClose}
                      variant="outlined"
                      style={styles.cancelButton}
                    />
                  </View>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Assign Device Modal */}
      <Modal
        visible={assignDeviceModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={handleAssignDeviceModalClose}
      >
        <TouchableWithoutFeedback onPress={handleAssignDeviceModalClose}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContainer}>
                {renderAssignDeviceContent()}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* NFC Manager Modal */}
      <Modal
        visible={nfcManagerModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setNfcManagerModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setNfcManagerModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.nfcModalContainer}>
                <View style={styles.nfcModalContent}>
                  {/* NFC Manager Header */}
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>NFC Manager</Text>
                    <TouchableOpacity onPress={() => setNfcManagerModalVisible(false)}>
                      <Ionicons name="close" size={24} color="#333" />
                    </TouchableOpacity>
                  </View>

                  {/* NFC Tabs */}
                  <TabBar
                    tabs={nfcTabs}
                    activeTab={nfcActiveTab}
                    onTabPress={handleNfcTabPress}
                    backgroundColor="#F9F9F9"
                    activeColor="#007AFF"
                    inactiveColor="#666666"
                    showIcons
                    showLabels
                    height={50}
                    containerStyle={styles.nfcTabBarContainer}
                    labelStyle={styles.nfcTabBarLabel}
                    iconStyle={styles.nfcTabBarIcon}
                  />

                  {/* NFC Tab Content */}
                  {renderNfcTabContent()}
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  // Container Styles
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: '4%',
    paddingBottom: Platform.OS === 'ios' ? 100 : 80,
  },

  // Header Styles
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: '5%',
    paddingVertical: '3%',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    marginBottom: '3%',
  },
  welcomeContainer: {
    flex: 2,
    justifyContent: 'center',
  },
  welcomeText: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#333',
    lineHeight: 32,
  },
  spacer: {
    width: '3%',
  },
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
  },
  headerButton: {
    marginLeft: '3%',
    paddingHorizontal: 12,
    minWidth: '30%',
  },

  // Section Header Styles
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '3%',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  addDeviceButton: {
    paddingHorizontal: 12,
    minWidth: '25%',
  },

  // Section Styles
  section: {
    marginBottom: '5%',
  },

  // Devices Styles
  devicesContainer: {
    flex: 1,
  },
  devicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  deviceCard: {
    width: (width * 0.45),
    marginBottom: '4%',
  },
  cardContent: {
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardInfo: {
    marginBottom: '2%',
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  cardActions: {
    alignSelf: 'flex-end',
    width: '100%',
  },
  returnButton: {
    width: '100%',
  },

  // View All Button Styles
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: '3%',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginTop: '3%',
    marginBottom: '2%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  viewAllText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '500',
    marginRight: 8,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxHeight: '90%',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
  },
  nfcModalContainer: {
    width: '95%',
    height: '90%',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 10,
  },
  nfcModalContent: {
    flex: 1,
  },
  modalContent: {
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalText: {
    fontSize: 16,
    marginBottom: 10,
    color: '#555',
  },
  modalTextBold: {
    fontWeight: 'bold',
    color: '#333',
  },

  // Form Styles
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    marginBottom: 15,
  },
  picker: {
    height: 50,
    width: '100%',
  },
  input: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 10,
    marginRight: 8,
    backgroundColor: '#fff',
  },

  // Button Styles
  confirmButton: {
    backgroundColor: '#007AFF',
    marginTop: 10,
  },
  cancelButton: {
    backgroundColor: '#ccc',
    marginTop: 10,
  },
  writeButton: {
    backgroundColor: '#007bff',
  },
  lockButton: {
    backgroundColor: '#dc3545',
  },
  unlockButton: {
    backgroundColor: '#ffc107',
  },
  loadButton: {
    backgroundColor: '#17a2b8',
    marginTop: 10,
  },
  assignNfcButton: {
    backgroundColor: '#17a2b8',
    marginVertical: 10,
  },
  submitButton: {
    backgroundColor: '#28a745',
    flex: 1,
    marginRight: 10,
  },
  closeButton: {
    backgroundColor: '#dc3545',
    flex: 1,
  },
  addFieldButton: {
    padding: 10,
    backgroundColor: '#28a745',
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 15,
  },
  deleteButton: {
    padding: 8,
    marginLeft: 5,
  },

  // Text Styles
  addFieldText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  nfcTabTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  nfcTabSubtitle: {
    fontSize: 14,
    color: '#555',
    marginBottom: 15,
  },
  assignTabTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  assignTabSubtitle: {
    fontSize: 14,
    color: '#555',
    marginBottom: 15,
  },
  pickerLabel: {
    fontSize: 14,
    color: '#333',
    marginBottom: 5,
  },

  // Tab Bar Styles
  tabBarContainer: {
    paddingBottom: Platform.OS === 'ios' ? 20 : 0,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 10,
  },
  tabBarLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  tabBarIcon: {
    fontSize: 24,
  },

  // NFC Tab Styles
  nfcTabBarContainer: {
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    marginTop: '2%',
  },
  nfcTabBarLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  nfcTabBarIcon: {
    fontSize: 20,
  },
  nfcTabContent: {
    padding: 10,
  },
  nfcButton: {
    marginVertical: 10,
    backgroundColor: '#17a2b8',
  },

  // Assign Device Tab Styles
  assignTabBarContainer: {
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    marginTop: '2%',
  },
  assignTabBarLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  assignTabBarIcon: {
    fontSize: 20,
  },
  assignTabContent: {
    padding: 10,
  },
  assignButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },

  // Write Field Styles
  writeFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    width: '100%',
  },

  // Loader and Empty State Styles
  loader: {
    marginVertical: '5%',
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    marginVertical: '5%',
  },
});

export default HomeScreen;