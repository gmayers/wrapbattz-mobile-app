// LockTab.js
import React, { useState } from 'react';
import { View, Text, Alert, Platform, ScrollView } from 'react-native';
import Button from '../../../../components/Button';
import { PasswordInput } from '../../../../components/TextInput';
import { styles } from './styles';
import NfcManager, { NfcTech, Ndef } from 'react-native-nfc-manager';

const LockTab = ({ onCancel }) => {
  const [lockPassword, setLockPassword] = useState('');
  const [isLocking, setIsLocking] = useState(false);
  const [debugLogs, setDebugLogs] = useState([]);

  const addDebugLog = (message) => {
    console.log(`[LockTab] ${message}`);
    setDebugLogs(prevLogs => [...prevLogs, `[${new Date().toISOString()}] ${message}`]);
  };

  // First try to read any existing data from the tag
  const readExistingTagData = async () => {
    try {
      addDebugLog('Reading existing tag data before locking');
      
      // Get tag data
      const tag = await NfcManager.getTag();
      addDebugLog(`Tag detected: ${tag ? 'Yes' : 'No'}`);
      
      if (!tag) {
        addDebugLog('Error: No tag detected');
        throw new Error('No NFC tag detected.');
      }
      
      // If tag has no NDEF message, return empty object to start fresh
      if (!tag.ndefMessage || !tag.ndefMessage.length) {
        addDebugLog('No NDEF message found on tag, will create new data');
        return {};
      }
      
      // Process first NDEF record
      const record = tag.ndefMessage[0];
      
      if (!record || !record.payload) {
        addDebugLog('Invalid record format, will create new data');
        return {};
      }
      
      // Try to decode the payload
      try {
        const textContent = Ndef.text.decodePayload(record.payload);
        addDebugLog(`Decoded existing text content: ${textContent.substring(0, 50)}${textContent.length > 50 ? '...' : ''}`);
        
        // Check if content is JSON
        if (textContent && (textContent.startsWith('{') || textContent.startsWith('['))) {
          try {
            const jsonData = JSON.parse(textContent);
            addDebugLog('Successfully parsed existing JSON data');
            
            // Check if tag is already locked
            if (jsonData.locked === true || jsonData.locked === 'true') {
              addDebugLog('Tag is already locked');
              throw new Error('This tag is already locked. Please unlock it first.');
            }
            
            return jsonData; // Return the parsed data
          } catch (jsonError) {
            if (jsonError.message === 'This tag is already locked. Please unlock it first.') {
              throw jsonError;
            }
            
            addDebugLog(`JSON parse error: ${jsonError.message}, will create new data`);
            return {}; // Start fresh if can't parse existing data
          }
        } else {
          addDebugLog('Existing data is not in JSON format, will create new data');
          return {};
        }
      } catch (decodeError) {
        addDebugLog(`Error decoding payload: ${decodeError.message}, will create new data`);
        return {};
      }
    } catch (error) {
      addDebugLog(`Error reading tag: ${error.message}`);
      throw error;
    }
  };

  const handleLockNfc = async () => {
    addDebugLog('Lock button pressed');
    
    if (!lockPassword) {
      addDebugLog('Error: No password entered');
      Alert.alert('Error', 'Please enter a password');
      return;
    }

    try {
      setIsLocking(true);
      addDebugLog('Starting NFC lock process');
      addDebugLog(`Password length: ${lockPassword.length}`);
      
      // Initialize NFC Manager
      await NfcManager.start();
      
      // STEP 1: Request NFC technology
      addDebugLog('Requesting NFC technology');
      await NfcManager.requestTechnology(NfcTech.Ndef);
      
      // First read existing data to preserve it
      const existingData = await readExistingTagData();
      addDebugLog(`Existing data has ${Object.keys(existingData).length} fields`);
      
      // Combine existing data with lock info
      const dataToWrite = {
        ...existingData,
        locked: true,
        password: String(lockPassword), // Ensure password is stored as string
      };
      
      addDebugLog(`Combined data has ${Object.keys(dataToWrite).length} fields`);
      
      // Convert to JSON string with clean quotes
      const jsonString = JSON.stringify(dataToWrite)
        .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
        .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'");
      
      addDebugLog(`JSON string to write: ${jsonString}`);
      
      // STEP 2: Create NDEF message bytes
      const bytes = Ndef.encodeMessage([Ndef.textRecord(jsonString)]);
      
      if (bytes) {
        // STEP 3: Write NDEF message to tag
        addDebugLog('Writing NDEF message to tag');
        await NfcManager.ndefHandler.writeNdefMessage(bytes);
        
        addDebugLog('Lock operation completed successfully');
        Alert.alert('Success', 'Tag locked successfully!');
        setLockPassword('');
      } else {
        throw new Error('Failed to encode NDEF message');
      }
    } catch (error) {
      addDebugLog(`Lock failed: ${error.message}`);
      Alert.alert(
        'Error', 
        `Failed to lock tag: ${error.message}`
      );
    } finally {
      // STEP 4: Always cancel technology request when done
      NfcManager.cancelTechnologyRequest();
      setIsLocking(false);
      addDebugLog('Lock process completed');
    }
  };

  const cancelLocking = () => {
    if (isLocking) {
      setIsLocking(false);
      addDebugLog('Lock operation cancelled by user');
      NfcManager.cancelTechnologyRequest();
    }
    onCancel?.();
  };

  return (
    <View style={styles.nfcTabContent} testID="lock-tab-container">
      <Text style={styles.sectionTitle} testID="lock-tab-title">Lock NFC Tag</Text>
      <Text style={styles.sectionDescription} testID="lock-tab-description">
        Set a password to lock your NFC tag. You'll need this password to unlock or modify the tag later.
      </Text>
      
      <PasswordInput
        label="Password"
        value={lockPassword}
        onChangeText={setLockPassword}
        placeholder="Enter password to lock the tag"
        style={styles.input}
        testID="lock-password-input"
      />
      
      <View style={styles.buttonContainer} testID="lock-buttons-container">
        {isLocking ? (
          <Button
            title="Cancel"
            onPress={cancelLocking}
            secondary
            style={styles.cancelButton}
            testID="lock-cancel-button"
          />
        ) : (
          <>
            <Button
              title="Lock Tag"
              onPress={handleLockNfc}
              disabled={isLocking || !lockPassword}
              primary
              testID="lock-tag-button"
            />
            
            <Button
              title="Cancel"
              onPress={onCancel}
              disabled={isLocking}
              secondary
              style={styles.cancelButton}
              testID="lock-back-button"
            />
          </>
        )}
      </View>
      
      {isLocking && (
        <View style={styles.readingStatusContainer} testID="lock-status-container">
          <Text style={styles.readingStatusText} testID="lock-status-text">
            Ready to lock... Place NFC tag near device
          </Text>
        </View>
      )}
    </View>
  );
};

// Ensure the styles exist
const additionalStyles = {
  nfcTabContent: {
    flex: 1,
    padding: 16,
    paddingBottom: 80, // Add padding to avoid overlap with tab navigation
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  sectionDescription: {
    fontSize: 16,
    color: '#555',
    marginBottom: 20,
  },
  input: {
    marginBottom: 20,
  },
  buttonContainer: {
    flexDirection: 'column',
    marginTop: 10,
    marginBottom: 20,
  },
  cancelButton: {
    marginTop: 10,
  },
  readingStatusContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#f5f7fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e5eb',
    alignItems: 'center',
  },
  readingStatusText: {
    fontSize: 16,
    color: '#4a6da7',
    textAlign: 'center',
  },
};

// Add these styles if not already present
Object.assign(styles, additionalStyles);

export default LockTab;