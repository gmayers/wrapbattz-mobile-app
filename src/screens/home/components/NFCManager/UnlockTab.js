// UnlockTab.js
import React, { useState } from 'react';
import { View, Text, Alert, ScrollView } from 'react-native';
import Button from '../../../../components/Button';
import { PasswordInput } from '../../../../components/TextInput';
import { styles } from './styles';
import NfcManager, { NfcTech, Ndef } from 'react-native-nfc-manager';

const UnlockTab = ({ onCancel }) => {
  const [unlockPassword, setUnlockPassword] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [debugLogs, setDebugLogs] = useState([]);

  const addDebugLog = (message) => {
    console.log(`[UnlockTab] ${message}`);
    setDebugLogs(prevLogs => [...prevLogs, `[${new Date().toISOString()}] ${message}`]);
  };

  // Function to read and verify the tag's current password
  const readAndVerifyTag = async () => {
    try {
      addDebugLog('Starting tag read to verify password');
      
      const tag = await NfcManager.getTag();
      addDebugLog(`Tag detected: ${tag ? 'Yes' : 'No'}`);
      
      if (!tag) {
        addDebugLog('Error: No tag detected');
        throw new Error('No NFC tag detected.');
      }
      
      if (!tag.ndefMessage || !tag.ndefMessage.length) {
        addDebugLog('Error: No NDEF message found on tag');
        throw new Error('No NDEF message found on tag.');
      }
      
      // Process first NDEF record
      const record = tag.ndefMessage[0];
      
      if (!record || !record.payload) {
        addDebugLog('Error: Invalid record format');
        throw new Error('Tag contains an invalid NDEF record format.');
      }
      
      // Decode the payload
      let textContent;
      try {
        textContent = Ndef.text.decodePayload(record.payload);
        addDebugLog(`Decoded text content: ${textContent.substring(0, 30)}${textContent.length > 30 ? '...' : ''}`);
      } catch (e) {
        addDebugLog(`Error decoding payload: ${e.message}`);
        throw new Error('Failed to decode tag content.');
      }
      
      // Process the content if it's JSON
      if (textContent && (textContent.startsWith('{') || textContent.startsWith('['))) {
        try {
          const jsonData = JSON.parse(textContent);
          addDebugLog('Successfully parsed JSON data');
          
          // Check if tag is locked and verify password
          if (jsonData.locked === true || jsonData.locked === 'true') {
            addDebugLog('Tag is locked, checking password');
            
            if (jsonData.password !== unlockPassword) {
              addDebugLog('Password verification failed');
              throw new Error('Incorrect password. Please try again.');
            }
            
            addDebugLog('Password verified successfully');
            return jsonData; // Return the entire data object to preserve other fields
          } else {
            addDebugLog('Tag is not locked');
            throw new Error('This tag is not locked with a password.');
          }
        } catch (jsonError) {
          if (jsonError.message === 'Incorrect password. Please try again.' ||
              jsonError.message === 'This tag is not locked with a password.') {
            throw jsonError;
          }
          addDebugLog(`JSON parse error: ${jsonError.message}`);
          throw new Error('Tag contains invalid data format.');
        }
      } else {
        addDebugLog('Tag does not contain JSON data');
        throw new Error('Tag does not contain valid lock information.');
      }
    } catch (error) {
      addDebugLog(`Verification failed: ${error.message}`);
      throw error;
    }
  };

  const handleUnlockNfc = async () => {
    addDebugLog('Unlock button pressed');
    
    if (!unlockPassword) {
      addDebugLog('Error: No password entered');
      Alert.alert('Error', 'Please enter the current password');
      return;
    }

    try {
      setIsUnlocking(true);
      addDebugLog('Starting NFC unlock process');
      
      // Initialize NFC Manager
      await NfcManager.start();
      
      // STEP 1: Request NFC technology
      addDebugLog('Requesting NFC technology');
      await NfcManager.requestTechnology(NfcTech.Ndef);
      
      // First, read and verify the tag's password
      addDebugLog('Reading tag to verify password');
      const tagData = await readAndVerifyTag();
      addDebugLog('Password verified, preparing to unlock tag');
      
      // Create unlocked data by removing the lock properties but preserving other data
      const { locked, password, ...otherData } = tagData;
      addDebugLog(`Preserving ${Object.keys(otherData).length} other fields from the tag`);
      
      // Convert to JSON string with clean quotes
      const jsonString = JSON.stringify(otherData)
        .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
        .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'");
      
      addDebugLog(`JSON string to write: ${jsonString}`);
      
      // STEP 2: Create NDEF message bytes
      const bytes = Ndef.encodeMessage([Ndef.textRecord(jsonString)]);
      
      if (bytes) {
        // STEP 3: Write the updated data back to the tag
        addDebugLog('Writing NDEF message to tag');
        await NfcManager.ndefHandler.writeNdefMessage(bytes);
        
        addDebugLog('Unlock operation completed successfully');
        Alert.alert('Success', 'Tag unlocked successfully!');
        setUnlockPassword('');
      } else {
        throw new Error('Failed to encode NDEF message');
      }
    } catch (error) {
      addDebugLog(`Unlock failed: ${error.message}`);
      Alert.alert(
        'Error', 
        `Failed to unlock tag: ${error.message}`
      );
    } finally {
      // STEP 4: Always cancel technology request when done
      NfcManager.cancelTechnologyRequest();
      setIsUnlocking(false);
      addDebugLog('Unlock process completed');
    }
  };

  const cancelUnlocking = () => {
    if (isUnlocking) {
      setIsUnlocking(false);
      addDebugLog('Unlock operation cancelled by user');
      NfcManager.cancelTechnologyRequest();
    }
    onCancel?.();
  };

  return (
    <View style={styles.nfcTabContent} testID="unlock-tab-container">
      <Text style={styles.nfcTabTitle} testID="unlock-tab-title">Unlock NFC Tag</Text>
      <Text style={styles.nfcTabSubtitle} testID="unlock-tab-subtitle">
        Remove the password from your NFC tag.
      </Text>
      
      <PasswordInput
        placeholder="Enter Current Password"
        value={unlockPassword}
        onChangeText={setUnlockPassword}
        testID="unlock-password-input"
      />
      
      <View style={styles.buttonContainer} testID="unlock-buttons-container">
        {isUnlocking ? (
          <Button
            title="Cancel"
            onPress={cancelUnlocking}
            secondary
            style={styles.cancelButton}
            testID="unlock-cancel-button"
          />
        ) : (
          <>
            <Button
              title="Unlock Tag"
              onPress={handleUnlockNfc}
              disabled={isUnlocking || !unlockPassword}
              style={styles.unlockButton}
              testID="unlock-tag-button"
            />
            
            <Button
              title="Cancel"
              onPress={onCancel}
              disabled={isUnlocking}
              secondary
              style={styles.cancelButton}
              testID="unlock-back-button"
            />
          </>
        )}
      </View>
      
      {isUnlocking && (
        <View style={styles.readingStatusContainer} testID="unlock-status-container">
          <Text style={styles.readingStatusText} testID="unlock-status-text">
            Ready to unlock... Place NFC tag near device
          </Text>
        </View>
      )}
    </View>
  );
};

// Ensure styles exist
const additionalStyles = {
  nfcTabContent: {
    flex: 1,
    padding: 16,
    paddingBottom: 80, // Add padding to avoid overlap with tab navigation
  },
  nfcTabTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  nfcTabSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  buttonContainer: {
    flexDirection: 'column',
    marginTop: 20,
    marginBottom: 20,
  },
  unlockButton: {
    marginBottom: 10,
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

export default UnlockTab;