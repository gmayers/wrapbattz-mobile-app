import React, { useState, useRef } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import TabBar from '../../../../components/TabBar';
import ReadTab from './ReadTab';
import LockTab from './LockTab';
import UnlockTab from './UnlockTab';
import EditTab from './EditTab';
import NfcManager, { NfcTech, Ndef } from 'react-native-nfc-manager';
import { ndefToJson } from '../../../../../utils/NfcUtils';

const NfcManagerModal = ({ visible, onClose }) => {
  // NFC Manager states
  const [nfcActiveTab, setNfcActiveTab] = useState('read');
  const [writeFields, setWriteFields] = useState([{ label: '', value: '' }]);
  const [isWriting, setIsWriting] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);
  const isCancelling = useRef(false);

  // NFC Tabs Configuration
  const nfcTabs = [
    { key: 'read', title: 'Read', icon: <Ionicons name="scan-outline" size={20} color={nfcActiveTab === 'read' ? '#007AFF' : '#666666'} /> },
    { key: 'lock', title: 'Lock', icon: <Ionicons name="lock-closed-outline" size={20} color={nfcActiveTab === 'lock' ? '#007AFF' : '#666666'} /> },
    { key: 'unlock', title: 'Unlock', icon: <Ionicons name="lock-open-outline" size={20} color={nfcActiveTab === 'unlock' ? '#007AFF' : '#666666'} /> },
    { key: 'edit', title: 'Edit', icon: <Ionicons name="create-outline" size={20} color={nfcActiveTab === 'edit' ? '#007AFF' : '#666666'} /> },
  ];

  const withNfcManager = async (callback) => {
    try {
      // Reset cancellation state at the start of new operation
      isCancelling.current = false;
      
      await NfcManager.requestTechnology(NfcTech.Ndef);
      return await callback();
    } catch (error) {
      if (!isCancelling.current) {
        console.error('NFC Error:', error);
        throw error;
      }
      // If cancelling, suppress the error
      return null;
    } finally {
      try {
        // Only call cancelTechnologyRequest if we're not already cancelling
        if (!isCancelling.current) {
          await NfcManager.cancelTechnologyRequest();
        }
      } catch (error) {
        // Suppress any cancellation errors
        console.log('Cleanup error:', error);
      }
    }
  };

  const handleNfcCancel = async () => {
    try {
      isCancelling.current = true;
      await NfcManager.cancelTechnologyRequest();
    } catch (error) {
      console.log('Cancel error:', error);
    }
  };

  // iOS-specific function for writing to NFC tags
  const writeToNfcTagIOS = async (jsonData) => {
    try {
      console.log("iOS: Writing data to tag:", jsonData);
      
      // Convert JSON to string
      const jsonString = JSON.stringify(jsonData);
      console.log("iOS: JSON string to write:", jsonString);
      
      // Create NDEF Text Record manually
      const languageCode = 'en';
      
      // Status byte: bit 7 = UTF-16 (0) or UTF-8 (1), bits 6-0 = language code length
      const statusByte = 0x80 | (languageCode.length & 0x3F); // UTF-8 with language code length
      
      // Full payload with language code and text
      const payload = [statusByte];
      
      // Add language code bytes
      for (let i = 0; i < languageCode.length; i++) {
        payload.push(languageCode.charCodeAt(i));
      }
      
      // Add text bytes
      for (let i = 0; i < jsonString.length; i++) {
        payload.push(jsonString.charCodeAt(i));
      }
      
      console.log("iOS: Created payload:", payload);
      
      // Create an NDEF Text Record
      const record = Ndef.record(Ndef.TNF_WELL_KNOWN, Ndef.RTD_TEXT, [], payload);
      
      console.log("iOS: Writing NDEF message with record:", record);
      
      // Write the record using the current API
      await NfcManager.writeNdefMessage([record]);
      console.log("iOS: Successfully wrote to tag");
      
      return true;
    } catch (error) {
      console.error("iOS: Error writing to tag:", error);
      throw error;
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

  // NFC Action Handlers
  const handleWriteNfc = async () => {
    try {
      setIsWriting(true);
      const jsonData = convertFieldsToJson();
      if (Object.keys(jsonData).length === 0) {
        Alert.alert('Error', 'Please enter at least one label/value pair.');
        return;
      }
      
      await withNfcManager(async () => {
        // Use platform-specific approach
        if (Platform.OS === 'ios') {
          await writeToNfcTagIOS(jsonData);
        } else {
          // Android approach
          const textRecord = Ndef.textRecord(JSON.stringify(jsonData));
          await NfcManager.writeNdefMessage([textRecord]);
        }
        
        if (!isCancelling.current) {
          Alert.alert('Success', 'Data written to NFC tag successfully!');
          setWriteFields([{ label: '', value: '' }]);
        }
      });
    } catch (error) {
      if (!isCancelling.current) {
        Alert.alert('Error', 'Failed to write to NFC tag.');
        console.error('Error writing NFC:', error);
      }
    } finally {
      setIsWriting(false);
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
            
            // Use platform-specific approach
            if (Platform.OS === 'ios') {
              await writeToNfcTagIOS(newData);
            } else {
              // Android approach
              const textRecord = Ndef.textRecord(JSON.stringify(newData));
              await NfcManager.writeNdefMessage([textRecord]);
            }
            
            if (!isCancelling.current) {
              Alert.alert('Success', 'Password removed. NFC tag is now unlocked.');
              setUnlockPassword('');
            }
          } else if (!isCancelling.current) {
            Alert.alert('Error', 'Incorrect password or tag is not locked.');
          }
        } else if (!isCancelling.current) {
          Alert.alert('Error', 'No NFC tag found.');
        }
      });
    } catch (error) {
      if (!isCancelling.current) {
        Alert.alert('Error', 'Failed to unlock NFC tag.');
        console.error('Error unlocking NFC:', error);
      }
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleNfcTabPress = (tabKey) => {
    console.log("Tab pressed:", tabKey);
    setNfcActiveTab(tabKey);
  };

  const renderTabContent = () => {
    switch (nfcActiveTab) {
      case 'read':
        return (
          <ReadTab
            withNfcManager={withNfcManager}
            ndefToJson={ndefToJson}
            onCancel={handleNfcCancel}
          />
        );
      case 'lock':
        return (
          <LockTab
            withNfcManager={withNfcManager}
            onCancel={handleNfcCancel}
          />
        );
      case 'unlock':
        return (
          <UnlockTab
            unlockPassword={unlockPassword}
            setUnlockPassword={setUnlockPassword}
            handleUnlockNfc={handleUnlockNfc}
            isUnlocking={isUnlocking}
            onCancel={handleNfcCancel}
          />
        );
      case 'edit':
        return (
          <EditTab
            withNfcManager={withNfcManager}
            ndefToJson={ndefToJson}
            onCancel={handleNfcCancel}
          />
        );
      default:
        return <View style={styles.emptyTabContent}><Text>No content available</Text></View>;
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.nfcModalContainer}>
          <View style={styles.nfcModalContent}>
            {/* NFC Manager Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>NFC Manager</Text>
              <TouchableOpacity 
                onPress={onClose} 
                hitSlop={{top: 20, bottom: 20, left: 20, right: 20}}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            {/* NFC Tabs */}
            <View style={styles.tabBarWrapper}>
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
            </View>

            {/* NFC Tab Content */}
            <View style={styles.tabContentContainer}>
              {renderTabContent()}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nfcModalContainer: {
    width: '95%',
    height: '90%',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 10,
    overflow: 'hidden', // Important for iOS rendering
  },
  nfcModalContent: {
    flex: 1,
    flexDirection: 'column',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    paddingHorizontal: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 5, // Add some padding to increase touch area
  },
  tabBarWrapper: {
    // Wrapper to help with iOS touch handling
    zIndex: 10,
    position: 'relative',
    marginBottom: 10,
  },
  nfcTabBarContainer: {
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    marginTop: 0,
    paddingTop: 5,
    // Improved iOS touch handling
    ...(Platform.OS === 'ios' ? {
      zIndex: 10,
      shadowColor: 'transparent', // Remove shadow that might interfere
      elevation: 0,
    } : {}),
  },
  nfcTabBarLabel: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  nfcTabBarIcon: {
    marginBottom: 2,
  },
  tabContentContainer: {
    flex: 1,
    // Ensure proper z-index stacking for iOS
    ...(Platform.OS === 'ios' ? {
      zIndex: 1,
      position: 'relative',
      marginTop: 5,
    } : {
      marginTop: 5,
    }),
  },
  emptyTabContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  }
});

export default NfcManagerModal;