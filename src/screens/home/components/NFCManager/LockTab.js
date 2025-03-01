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

  // iOS-specific function for writing to NFC tags
  const writeToNfcTagIOS = async (jsonData) => {
    try {
      addDebugLog('Starting iOS write operation');
      
      // Log data types to debug MSdictionaryM integer value issues
      Object.entries(jsonData).forEach(([key, value]) => {
        const type = typeof value;
        addDebugLog(`Data property "${key}": value = ${value}, type = ${type}`);
        
        // Check for problematic integer values
        if (type === 'number' && Number.isInteger(value)) {
          addDebugLog(`WARNING: Integer value detected for "${key}" which may cause MSdictionaryM issues on iOS`);
        }
      });
      
      addDebugLog(`Preparing JSON data: ${JSON.stringify(jsonData)}`);

      // Ensure all numeric values are converted to strings to avoid MSdictionaryM issues
      const safejsonData = {};
      Object.entries(jsonData).forEach(([key, value]) => {
        if (typeof value === 'number') {
          safejsonData[key] = String(value);
          addDebugLog(`Converting numeric value for "${key}" to string: ${value} → "${String(value)}"`);
        } else {
          safejsonData[key] = value;
        }
      });
      
      // Convert JSON to string - ensure we're using only ASCII quotes
      const jsonString = JSON.stringify(safejsonData)
        .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"') // Replace fancy double quotes
        .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'"); // Replace fancy single quotes
      
      addDebugLog(`Safe JSON string: ${jsonString}`);

      // Create NDEF Text Record manually
      const languageCode = 'en';
      
      // IMPORTANT: Force UTF-8 encoding to avoid UTF-16 issues
      // Status byte: bit 7 = UTF-16 (0) or UTF-8 (1), bits 6-0 = language code length
      const statusByte = 0x80 | (languageCode.length & 0x3F); // UTF-8 with language code length
      addDebugLog(`Status byte: ${statusByte.toString(16)} (hex), ${statusByte} (decimal), Encoding: UTF-8`);
      
      // Create payload array
      const payload = [statusByte];

      // Add language code
      for (const char of languageCode) {
        payload.push(char.charCodeAt(0));
      }
      addDebugLog(`Language code bytes: ${languageCode} (${payload.slice(1, 1 + languageCode.length).join(', ')})`);

      // Log each character and its code point for debugging
      addDebugLog('Character by character breakdown of JSON string:');
      for (let i = 0; i < jsonString.length; i++) {
        const char = jsonString[i];
        const code = jsonString.charCodeAt(i);
        addDebugLog(`Position ${i}: '${char}' → ${code}`);
        
        // Verify quote characters are standard ASCII
        if ((char === '"' && code !== 34) || (char === "'" && code !== 39)) {
          addDebugLog(`WARNING: Non-standard quote character detected at position ${i}`);
        }
      }

      // Add JSON data
      for (const char of jsonString) {
        payload.push(char.charCodeAt(0));
      }
      addDebugLog(`Payload length: ${payload.length} bytes`);
      addDebugLog(`Full payload: [${payload.join(', ')}]`);

      // Create NDEF record
      const record = Ndef.record(
        Ndef.TNF_WELL_KNOWN,
        Ndef.RTD_TEXT,
        [],
        payload
      );
      addDebugLog(`NDEF record created: TNF=${record.tnf}, TYPE=${record.type}, ID=${record.id || 'none'}, PAYLOAD_LENGTH=${record.payload ? record.payload.length : 'undefined'}`);

      // Write to tag
      addDebugLog('Writing NDEF message to tag');
      await NfcManager.writeNdefMessage([record]);
      addDebugLog('Successfully wrote NDEF message');
      
      return true;
    } catch (error) {
      addDebugLog(`Write failed: ${error.message}`);
      addDebugLog(`Error name: ${error.name}`);
      addDebugLog(`Error code: ${error.code || 'N/A'}`);
      addDebugLog(`Error native code: ${error.nativeStackIOS || error.nativeStackAndroid || 'N/A'}`);
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
        
        // Create data object with explicit type handling
        const jsonData = {
          locked: true,
          password: String(lockPassword), // Force string type
        };
        
        addDebugLog(`Data object created: locked=${jsonData.locked} (${typeof jsonData.locked}), password="${jsonData.password}" (${typeof jsonData.password})`);
        addDebugLog(`Raw JSON stringify result: ${JSON.stringify(jsonData)}`);
        addDebugLog(`Preparing data for ${Platform.OS}`);
        
        if (Platform.OS === 'ios') {
          addDebugLog('Using iOS write method');
          await writeToNfcTagIOS(jsonData);
        } else {
          addDebugLog('Using Android write method');
          const jsonString = JSON.stringify(jsonData);
          addDebugLog(`Android JSON string: ${jsonString}`);
          const textRecord = Ndef.textRecord(jsonString);
          addDebugLog('Android NDEF record created');
          await NfcManager.writeNdefMessage([textRecord]);
        }
        
        addDebugLog('Write operation completed successfully');
        Alert.alert('Success', 'Tag locked successfully!');
        setLockPassword('');
      });
    } catch (error) {
      addDebugLog(`Lock failed: ${error.message}`);
      // Enhanced error reporting in the alert
      Alert.alert(
        'Error', 
        `Failed to lock tag: ${error.message}\n\nPlease check debug logs for more details.`
      );
    } finally {
      setIsLocking(false);
      addDebugLog('Lock process completed');
    }
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
        <Button
          title={isLocking ? "Locking..." : "Lock Tag"}
          onPress={handleLockNfc}
          disabled={isLocking}
          primary
        />
        
        <Button
          title="Cancel"
          onPress={onCancel}
          disabled={isLocking}
          secondary
          style={styles.cancelButton}
        />
      </View>
      
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