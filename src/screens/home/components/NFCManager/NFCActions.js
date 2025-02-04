// NFCActions.js
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Button from '../../../../components/Button';
import { PasswordInput } from '../../../../components/TextInput';
import useNFCOperations from '../../hooks/useNFCOperations';

const NFCActions = ({ activeTab, onClose }) => {
  // State for form fields
  const [writeFields, setWriteFields] = useState([{ label: '', value: '' }]);
  const [lockPassword, setLockPassword] = useState('');
  const [unlockPassword, setUnlockPassword] = useState('');

  // Get NFC operations from hook
  const {
    isProcessing,
    handleReadNfc,
    handleWriteNfc,
    handleLockNfc,
    handleUnlockNfc,
  } = useNFCOperations();

  // Handler for write field changes
  const handleWriteFieldChange = (index, field, text) => {
    const updatedFields = writeFields.map((item, idx) => {
      if (idx === index) {
        return { ...item, [field]: text };
      }
      return item;
    });
    setWriteFields(updatedFields);
  };

  // Add new write field
  const addWriteField = () => {
    setWriteFields([...writeFields, { label: '', value: '' }]);
  };

  // Remove a write field
  const removeWriteField = (index) => {
    if (writeFields.length === 1) {
      Alert.alert('Error', 'At least one field is required');
      return;
    }
    setWriteFields(writeFields.filter((_, idx) => idx !== index));
  };

  // Convert write fields into JSON
  const convertFieldsToJson = () => {
    const jsonData = {};
    writeFields.forEach(({ label, value }) => {
      if (label.trim()) {
        jsonData[label.trim()] = value.trim();
      }
    });
    return jsonData;
  };

  // Handle writing to the NFC tag
  const handleWriteSubmit = async () => {
    const jsonData = convertFieldsToJson();
    if (Object.keys(jsonData).length === 0) {
      Alert.alert('Error', 'Please enter at least one valid label/value pair');
      return;
    }

    const success = await handleWriteNfc(jsonData);
    if (success) {
      // Optionally reset fields after a successful write
      setWriteFields([{ label: '', value: '' }]);
    }
  };

  // Render content based on the active tab
  const renderContent = () => {
    switch (activeTab) {
      case 'read':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.title}>Read NFC Tag</Text>
            <Text style={styles.description}>
              Place your device near an NFC tag to read its contents.
            </Text>
            <View style={styles.iconContainer}>
              <Ionicons name="scan" size={48} color="#007AFF" />
            </View>
            <Button
              title={isProcessing ? 'Reading...' : 'Read Tag'}
              onPress={handleReadNfc}
              disabled={isProcessing}
              style={styles.actionButton}
            />
          </View>
        );

      case 'write':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.title}>Write to NFC Tag</Text>
            <Text style={styles.description}>
              Enter the data you want to write to the tag. 
              This data will be merged with any existing information on the tag.
            </Text>
            {writeFields.map((field, index) => (
              <View key={index} style={styles.writeFieldContainer}>
                <View style={styles.fieldInputs}>
                  <TextInput
                    style={styles.input}
                    placeholder="Label"
                    value={field.label}
                    onChangeText={(text) =>
                      handleWriteFieldChange(index, 'label', text)
                    }
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Value"
                    value={field.value}
                    onChangeText={(text) =>
                      handleWriteFieldChange(index, 'value', text)
                    }
                  />
                </View>
                <TouchableOpacity
                  onPress={() => removeWriteField(index)}
                  style={styles.removeButton}
                  disabled={writeFields.length === 1}
                >
                  <Ionicons
                    name="remove-circle-outline"
                    size={24}
                    color={writeFields.length === 1 ? '#ccc' : '#FF3B30'}
                  />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={styles.addFieldButton} onPress={addWriteField}>
              <Text style={styles.addFieldText}>+ Add Field</Text>
            </TouchableOpacity>
            <Button
              title={isProcessing ? 'Writing...' : 'Write to Tag'}
              onPress={handleWriteSubmit}
              disabled={isProcessing}
              style={styles.actionButton}
            />
          </View>
        );

      case 'lock':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.title}>Lock NFC Tag</Text>
            <Text style={styles.description}>
              Set a password to lock the NFC tag. Remember this password to unlock later.
            </Text>
            <PasswordInput
              value={lockPassword}
              onChangeText={setLockPassword}
              placeholder="Enter password to lock"
              style={styles.passwordInput}
            />
            <Button
              title={isProcessing ? 'Locking...' : 'Lock Tag'}
              onPress={() => handleLockNfc(lockPassword)}
              disabled={isProcessing || !lockPassword}
              style={styles.actionButton}
            />
          </View>
        );

      case 'unlock':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.title}>Unlock NFC Tag</Text>
            <Text style={styles.description}>
              Enter the password used to lock the tag.
            </Text>
            <PasswordInput
              value={unlockPassword}
              onChangeText={setUnlockPassword}
              placeholder="Enter password to unlock"
              style={styles.passwordInput}
            />
            <Button
              title={isProcessing ? 'Unlocking...' : 'Unlock Tag'}
              onPress={() => handleUnlockNfc(unlockPassword)}
              disabled={isProcessing || !unlockPassword}
              style={styles.actionButton}
            />
          </View>
        );

      default:
        return null;
    }
  };

  return <View style={styles.container}>{renderContent()}</View>;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 15,
  },
  tabContent: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  iconContainer: {
    alignItems: 'center',
    marginVertical: 30,
  },
  writeFieldContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  fieldInputs: {
    flex: 1,
    flexDirection: 'row',
    gap: 10,
  },
  input: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 10,
    backgroundColor: '#F8F8F8',
  },
  removeButton: {
    padding: 5,
    marginLeft: 10,
  },
  addFieldButton: {
    backgroundColor: '#F8F8F8',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  addFieldText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '500',
  },
  passwordInput: {
    marginBottom: 20,
  },
  actionButton: {
    marginTop: 20,
  },
});

export default NFCActions;
