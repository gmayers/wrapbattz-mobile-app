// UnlockNfcTab.js
import React, { useState } from 'react';
import { View, Text, Alert, ScrollView, Platform } from 'react-native';
import Button from '../../../../components/Button';
import { PasswordInput } from '../../../../components/TextInput';
import { styles } from './styles';
import NfcManager, { Ndef } from 'react-native-nfc-manager';

const UnlockTab = ({ withNfcManager, onCancel }) => {
  const [unlockPassword, setUnlockPassword] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [debugLogs, setDebugLogs] = useState([]);

  const addDebugLog = (message) => {
    console.log(`[UnlockTab] ${message}`);
    setDebugLogs(prevLogs => [...prevLogs, `[${new Date().toISOString()}] ${message}`]);
  };

  // Universal write function that handles both platforms
  const writeToNfcTag = async (jsonData) => {
    try {
      addDebugLog(`Starting write operation for platform: ${Platform.OS}`);
      
      // Log data types for debugging
      Object.entries(jsonData).forEach(([key, value]) => {
        const type = typeof value;
        addDebugLog(`Data property "${key}": value = ${value}, type = ${type}`);
        
        // Convert numbers to strings for iOS compatibility
        if (type === 'number' && Number.isInteger(value)) {
          addDebugLog(`Converting integer value for "${key}" to string to avoid issues`);
          jsonData[key] = String(value);
        }
      });
      
      // Convert JSON to string - ensure we're using only ASCII quotes
      const jsonString = JSON.stringify(jsonData)
        .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"') // Replace fancy double quotes
        .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'"); // Replace fancy single quotes
      
      addDebugLog(`JSON string to write: ${jsonString}`);

      // Create NDEF text record using the library function
      const textRecord = Ndef.textRecord(jsonString);
      addDebugLog('NDEF record created using Ndef.textRecord');
      
      // Write to tag using the standard approach
      addDebugLog('Writing NDEF message to tag');
      await NfcManager.writeNdefMessage([textRecord]);
      addDebugLog('Successfully wrote NDEF message');
      
      return true;
    } catch (error) {
      addDebugLog(`Write failed: ${error.message}`);
      addDebugLog(`Error name: ${error.name}`);
      if (error.stack) {
        addDebugLog(`Stack trace: ${error.stack}`);
      }
      
      // Attempt to extract more iOS-specific error details
      if (error.userInfo) {
        addDebugLog(`iOS userInfo: ${JSON.stringify(error.userInfo)}`);
      }
      
      throw error;
    }
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
      
      await withNfcManager(async () => {
        addDebugLog('NFC technology acquired');
        
        // First, read and verify the tag's password
        addDebugLog('Reading tag to verify password');
        const tagData = await readAndVerifyTag();
        addDebugLog('Password verified, preparing to unlock tag');
        
        // Create unlocked data by removing the lock properties but preserving other data
        const { locked, password, ...otherData } = tagData;
        addDebugLog(`Preserving ${Object.keys(otherData).length} other fields from the tag`);
        
        // Write the updated data back to the tag (without locked & password properties)
        await writeToNfcTag(otherData);
        
        addDebugLog('Unlock operation completed successfully');
        Alert.alert('Success', 'Tag unlocked successfully!');
        setUnlockPassword('');
      });
    } catch (error) {
      addDebugLog(`Unlock failed: ${error.message}`);
      Alert.alert(
        'Error', 
        `Failed to unlock tag: ${error.message}`
      );
    } finally {
      setIsUnlocking(false);
      addDebugLog('Unlock process completed');
    }
  };

  const cancelUnlocking = () => {
    if (isUnlocking) {
      setIsUnlocking(false);
      addDebugLog('Unlock operation cancelled by user');
    }
    onCancel?.();
  };

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
      
      <View style={styles.buttonContainer}>
        {isUnlocking ? (
          <Button
            title="Cancel"
            onPress={cancelUnlocking}
            secondary
            style={styles.cancelButton}
          />
        ) : (
          <Button
            title="Unlock Tag"
            onPress={handleUnlockNfc}
            disabled={isUnlocking || !unlockPassword}
            style={styles.unlockButton}
          />
        )}
      </View>
      
      {isUnlocking && (
        <View style={styles.readingStatusContainer}>
          <Text style={styles.readingStatusText}>
            Ready to unlock... Place NFC tag near device
          </Text>
        </View>
      )}
      
      <View style={styles.debugContainer}>
        <Text style={styles.debugTitle}>Debug Logs:</Text>
        <ScrollView style={styles.debugLogsContainer}>
          {debugLogs.map((log, index) => (
            <Text key={index} style={styles.debugText}>{log}</Text>
          ))}
        </ScrollView>
      </View>
    </View>
  );
};

export default UnlockTab;