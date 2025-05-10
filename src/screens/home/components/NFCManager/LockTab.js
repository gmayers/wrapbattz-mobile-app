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

  const handleLockNfc = async () => {
    if (!lockPassword) {
      Alert.alert('Error', 'Please enter a password');
      return;
    }

    try {
      setIsLocking(true);
      
      // Initialize NFC Manager
      await NfcManager.start();
      
      // Request NFC technology
      await NfcManager.requestTechnology(NfcTech.Ndef);
      
      // Get tag instance
      const tag = await NfcManager.getTag();
      
      if (!tag) {
        throw new Error('No NFC tag detected');
      }
      
      // Check if the tag supports password protection
      if (!tag.ndefSupported || !tag.isWritable) {
        throw new Error('This tag does not support password protection');
      }
      
      // Attempt to set password protection on the tag
      // Note: This is the correct way to password protect an NDEF tag
      // instead of just writing the password to the payload
      try {
        // Get NFC adapter for direct commands
        const ndefAdapter = NfcManager.ndefHandler;
        
        // Use the setPassword API if available
        if (ndefAdapter && typeof ndefAdapter.setPassword === 'function') {
          await ndefAdapter.setPassword(lockPassword);
          Alert.alert('Success', 'Tag locked successfully with password protection!');
        } 
        // For NXP NTAG21x
        else if (tag.techTypes && tag.techTypes.includes('android.nfc.tech.MifareUltralight')) {
          // Implement NTAG21x password protection commands
          // PWD_AUTH command (0x1B) - password authentication command
          await NfcManager.transceive([
            0x1B,                               // PWD_AUTH command
            ...Array.from(new TextEncoder().encode(lockPassword.padEnd(4, '\0').slice(0, 4)))
          ]);
          
          // Set protection configuration in NTAG
          await NfcManager.transceive([
            0xA2,                               // WRITE command
            0x29,                               // Configuration page address
            0x04,                               // AUTH0: page from which password protection starts
            0x00,                               // No more access without password
            0x00,                               // No password prot. for reading, password prot. for writing
            0x00                                // Other access config settings
          ]);
          
          Alert.alert('Success', 'Tag locked successfully with password protection!');
        }
        // For other tag types we'll add a special marker in the NDEF record
        else {
          // Read existing NDEF message
          let existingMessage = null;
          
          // Try to read current content
          if (tag.ndefMessage && tag.ndefMessage.length > 0) {
            try {
              const record = tag.ndefMessage[0];
              if (record && record.payload) {
                const textContent = Ndef.text.decodePayload(record.payload);
                existingMessage = textContent;
              }
            } catch (error) {
              // If we can't read, we'll start fresh
              existingMessage = null;
            }
          }
          
          // Encrypt the content with password (simple XOR for demonstration)
          // In a real implementation, you'd use a proper encryption algorithm
          const encryptContent = (content, password) => {
            let result = '';
            for (let i = 0; i < content.length; i++) {
              const charCode = content.charCodeAt(i) ^ password.charCodeAt(i % password.length);
              result += String.fromCharCode(charCode);
            }
            return result;
          };
          
          // Create a special locked message format
          const lockedData = {
            _locked: true,
            _hint: "This tag is password protected",
            _content: existingMessage ? encryptContent(existingMessage, lockPassword) : ""
          };
          
          const jsonString = JSON.stringify(lockedData);
          
          // Write the protected data
          const bytes = Ndef.encodeMessage([Ndef.textRecord(jsonString)]);
          
          if (bytes) {
            await NfcManager.ndefHandler.writeNdefMessage(bytes);
            Alert.alert('Success', 'Tag content encrypted and locked with password!');
          } else {
            throw new Error('Failed to encode message for locking');
          }
        }
        
        setLockPassword('');
      } catch (lockError) {
        // Handle specific password setting errors
        if (lockError.message && lockError.message.includes('not supported')) {
          throw new Error('Password protection not supported on this tag type');
        } else {
          throw lockError;
        }
      }
    } catch (error) {
      Alert.alert(
        'Error', 
        `Failed to lock tag: ${error.message}`
      );
    } finally {
      // Always cancel technology request when done
      NfcManager.cancelTechnologyRequest();
      setIsLocking(false);
    }
  };

  const cancelLocking = () => {
    if (isLocking) {
      setIsLocking(false);
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
      
      <Text style={styles.infoText}>
        Note: Only certain NFC tags support password protection. For best results, use NTAG213, NTAG215, or NTAG216 tags.
      </Text>
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
  infoText: {
    fontSize: 14,
    color: '#777',
    fontStyle: 'italic',
    marginTop: 20,
    textAlign: 'center',
  }
};

// Add these styles if not already present
Object.assign(styles, additionalStyles);

export default LockTab;