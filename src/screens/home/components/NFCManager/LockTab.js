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
      addDebugLog('NFC Manager initialized');
      
      // STEP 1: Request NFC technology
      addDebugLog('Requesting NFC technology: Ndef');
      await NfcManager.requestTechnology(NfcTech.Ndef);
      addDebugLog('Ndef technology acquired');
      
      // Read existing tag data
      addDebugLog('Reading existing tag data');
      const tag = await NfcManager.getTag();
      
      if (!tag) {
        addDebugLog('Error: No tag detected');
        throw new Error('No NFC tag detected');
      }
      
      addDebugLog(`Tag detected with ID: ${tag.id || 'Unknown'}`);
      
      let existingData = {};
      
      // Try to parse existing data (if any)
      if (tag.ndefMessage && tag.ndefMessage.length > 0) {
        try {
          addDebugLog(`Tag has ${tag.ndefMessage.length} NDEF message(s)`);
          const record = tag.ndefMessage[0];
          
          if (record && record.payload) {
            const textContent = Ndef.text.decodePayload(record.payload);
            addDebugLog(`Decoded text content: ${textContent.substring(0, 50)}${textContent.length > 50 ? '...' : ''}`);
            
            if (textContent && (textContent.startsWith('{') || textContent.startsWith('['))) {
              const parsedData = JSON.parse(textContent);
              addDebugLog('Successfully parsed existing JSON data');
              
              // Check if already locked
              if (parsedData.locked === true || parsedData.locked === 'true') {
                addDebugLog('Tag is already locked');
                throw new Error('This tag is already locked. Please unlock it first.');
              }
              
              existingData = parsedData;
              addDebugLog(`Existing data has ${Object.keys(existingData).length} fields`);
            }
          }
        } catch (error) {
          if (error.message === 'This tag is already locked. Please unlock it first.') {
            throw error;
          }
          addDebugLog(`Error parsing existing data: ${error.message}. Starting fresh.`);
        }
      } else {
        addDebugLog('No NDEF message found on tag, will create new data');
      }
      
      // Add lock data to existing data
      const dataToWrite = {
        ...existingData,
        locked: true,
        password: lockPassword // Store as string
      };
      
      addDebugLog(`Prepared data to write with ${Object.keys(dataToWrite).length} fields`);
      
      // Convert to JSON string
      const jsonString = JSON.stringify(dataToWrite);
      addDebugLog(`JSON string to write: ${jsonString}`);
      
      // STEP 2: Create NDEF message
      addDebugLog('Creating NDEF message bytes');
      const bytes = Ndef.encodeMessage([Ndef.textRecord(jsonString)]);
      
      if (bytes) {
        // STEP 3: Write NDEF message to tag
        addDebugLog('Writing NDEF message to tag');
        await NfcManager.ndefHandler.writeNdefMessage(bytes);
        addDebugLog('Successfully wrote NDEF message to tag');
        
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
      addDebugLog('Canceling technology request');
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
    paddingBottom: 80,
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