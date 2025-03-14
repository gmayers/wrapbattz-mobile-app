// LockTab.js
import React, { useState } from 'react';
import { View, Text, Alert, Platform, ScrollView } from 'react-native';
import Button from '../../../../components/Button';
import { PasswordInput } from '../../../../components/TextInput';
import { styles } from './styles';
import NfcManager, { Ndef } from 'react-native-nfc-manager';

const LockTab = ({ withNfcManager, onCancel }) => {
  const [lockPassword, setLockPassword] = useState('');
  const [isLocking, setIsLocking] = useState(false);
  const [debugLogs, setDebugLogs] = useState([]);

  const addDebugLog = (message) => {
    console.log(`[LockTab] ${message}`);
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
        
        // Check for problematic integer values
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
      addDebugLog(`Error code: ${error.code || 'N/A'}`);
      addDebugLog(`Stack trace: ${error.stack}`);
      
      // Attempt to extract more iOS-specific error details
      if (error.userInfo) {
        addDebugLog(`iOS userInfo: ${JSON.stringify(error.userInfo)}`);
      }
      
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
      addDebugLog('Starting NFC write process');
      addDebugLog(`Password type: ${typeof lockPassword}, value: "${lockPassword}", length: ${lockPassword.length}`);
      
      // Check if password contains potentially problematic characters
      const specialChars = lockPassword.match(/[^\w\s]/g);
      if (specialChars) {
        addDebugLog(`WARNING: Password contains special characters: ${specialChars.join('')}`);
      }
      
      // Check if password is or could be interpreted as a number
      if (!isNaN(lockPassword)) {
        addDebugLog(`WARNING: Password "${lockPassword}" could be interpreted as a number: ${Number(lockPassword)}`);
      }
      
      await withNfcManager(async () => {
        addDebugLog('NFC technology acquired');
        
        // Create data object with explicit string type for password
        const jsonData = {
          locked: true,
          password: String(lockPassword), // Force string type
        };
        
        addDebugLog(`Data object created: locked=${jsonData.locked} (${typeof jsonData.locked}), password="${jsonData.password}" (${typeof jsonData.password})`);
        
        // Use the unified write function
        await writeToNfcTag(jsonData);
        
        addDebugLog('Write operation completed successfully');
        Alert.alert('Success', 'Tag locked successfully!');
        setLockPassword('');
      });
    } catch (error) {
      addDebugLog(`Lock failed: ${error.message}`);
      Alert.alert(
        'Error', 
        `Failed to lock tag: ${error.message}\n\nPlease check debug logs for more details.`
      );
    } finally {
      setIsLocking(false);
      addDebugLog('Lock process completed');
    }
  };

  const cancelLocking = () => {
    if (isLocking) {
      setIsLocking(false);
      addDebugLog('Lock operation cancelled by user');
    }
    onCancel?.();
  };

  return (
    <View style={styles.nfcTabContent}>
      <Text style={styles.sectionTitle}>Lock NFC Tag</Text>
      <Text style={styles.sectionDescription}>
        Set a password to lock your NFC tag. You'll need this password to unlock or modify the tag later.
      </Text>
      
      <PasswordInput
        label="Password"
        value={lockPassword}
        onChangeText={setLockPassword}
        placeholder="Enter password to lock the tag"
        style={styles.input}
      />
      
      <View style={styles.buttonContainer}>
        {isLocking ? (
          <Button
            title="Cancel"
            onPress={cancelLocking}
            secondary
            style={styles.cancelButton}
          />
        ) : (
          <>
            <Button
              title="Lock Tag"
              onPress={handleLockNfc}
              disabled={isLocking || !lockPassword}
              primary
            />
            
            <Button
              title="Cancel"
              onPress={onCancel}
              secondary
              style={styles.cancelButton}
            />
          </>
        )}
      </View>
      
      {isLocking && (
        <View style={styles.readingStatusContainer}>
          <Text style={styles.readingStatusText}>
            Ready to lock... Place NFC tag near device
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

export default LockTab;