import React, { useState, useRef } from 'react';
import { Modal, View, Text, TouchableOpacity, TouchableWithoutFeedback, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import TabBar from '../../../../components/TabBar';
import ReadTab from './ReadTab';
import LockTab from './LockTab';
import UnlockTab from './UnlockTab';
import EditTab from './EditTab';
import NfcManager, { NfcTech } from 'react-native-nfc-manager';
import { ndefToJson, jsonToNdef } from '../../../../../utils/NfcUtils';

const NfcManagerModal = ({ visible, onClose }) => {
  // NFC Manager states
  const [nfcActiveTab, setNfcActiveTab] = useState('read');
  const [writeFields, setWriteFields] = useState([{ label: '', value: '' }]);
  const [isWriting, setIsWriting] = useState(false);
  const [lockPassword, setLockPassword] = useState('');
  const [unlockPassword, setUnlockPassword] = useState('');
  const [isLocking, setIsLocking] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const isCancelling = useRef(false);

  // NFC Tabs Configuration
  const nfcTabs = [
    { key: 'read', title: 'Read', icon: <Ionicons name="scan-outline" size={20} /> },
    { key: 'lock', title: 'Lock', icon: <Ionicons name="lock-closed-outline" size={20} /> },
    { key: 'unlock', title: 'Unlock', icon: <Ionicons name="lock-open-outline" size={20} /> },
    { key: 'edit', title: 'Edit', icon: <Ionicons name="create-outline" size={20} /> },
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
        const ndefMessage = jsonToNdef(jsonData);
        await NfcManager.ndefHandler.writeNdefMessage(ndefMessage);
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
        if (!isCancelling.current) {
          Alert.alert('Success', 'NFC tag has been locked with a password.');
          setLockPassword('');
        }
      });
    } catch (error) {
      if (!isCancelling.current) {
        Alert.alert('Error', 'Failed to lock NFC tag.');
        console.error('Error locking NFC:', error);
      }
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

  const handleNfcTabPress = (key) => {
    setNfcActiveTab(key);
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
            lockPassword={lockPassword}
            setLockPassword={setLockPassword}
            handleLockNfc={handleLockNfc}
            isLocking={isLocking}
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
        return null;
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <View style={styles.nfcModalContainer}>
              <View style={styles.nfcModalContent}>
                {/* NFC Manager Header */}
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>NFC Manager</Text>
                  <TouchableOpacity onPress={onClose}>
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
                {renderTabContent()}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
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
  },
  nfcModalContent: {
    flex: 1,
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
});

export default NfcManagerModal;