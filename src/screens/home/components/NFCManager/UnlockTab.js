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

  const handleUnlockNfc = async () => {
    if (!unlockPassword) {
      Alert.alert('Error', 'Please enter the current password');
      return;
    }

    try {
      setIsUnlocking(true);
      
      // Initialize NFC Manager
      await NfcManager.start();
      
      // Request NFC technology
      await NfcManager.requestTechnology(NfcTech.Ndef);
      
      // Get tag instance
      const tag = await NfcManager.getTag();
      
      if (!tag) {
        throw new Error('No NFC tag detected');
      }
      
      // Attempt to unlock the tag based on its type
      if (tag.techTypes && tag.techTypes.includes('android.nfc.tech.MifareUltralight')) {
        // For NTAG21x tags (common NFC tags)
        try {
          // Send the PWD_AUTH command with the password
          const authResponse = await NfcManager.transceive([
            0x1B,                               // PWD_AUTH command
            ...Array.from(new TextEncoder().encode(unlockPassword.padEnd(4, '\0').slice(0, 4)))
          ]);
          
          // If we get here, the password was correct (otherwise an exception would be thrown)
          
          // Reset protection configuration in NTAG
          await NfcManager.transceive([
            0xA2,                               // WRITE command
            0x29,                               // Configuration page address
            0xFF,                               // AUTH0: disable password authentication (0xFF)
            0x00,                               // No access restrictions
            0x00,                               // No password protection
            0x00                                // Other access config settings
          ]);
          
          Alert.alert('Success', 'Tag password protection removed successfully!');
        } catch (error) {
          if (error.message && error.message.toLowerCase().includes('authentication')) {
            throw new Error('Incorrect password. Please try again.');
          } else {
            throw error;
          }
        }
      } 
      // Use standard NDEF password removal if available
      else if (NfcManager.ndefHandler && typeof NfcManager.ndefHandler.removePassword === 'function') {
        try {
          await NfcManager.ndefHandler.removePassword(unlockPassword);
          Alert.alert('Success', 'Tag password protection removed successfully!');
        } catch (error) {
          if (error.message && (error.message.includes('auth') || error.message.includes('password'))) {
            throw new Error('Incorrect password. Please try again.');
          } else {
            throw error;
          }
        }
      }
      // For tags without proper password protection
      else {
        // First verify that we can read the tag
        if (!tag.ndefMessage || !tag.ndefMessage.length) {
          throw new Error('No NDEF message found on tag');
        }
        
        const record = tag.ndefMessage[0];
        
        if (!record || !record.payload) {
          throw new Error('Tag contains an invalid NDEF record format');
        }
        
        // Try to decode and verify with password
        let textContent;
        try {
          textContent = Ndef.text.decodePayload(record.payload);
        } catch (e) {
          throw new Error('Failed to decode tag content');
        }
        
        // Check if tag contains JSON data
        if (textContent && (textContent.startsWith('{') || textContent.startsWith('['))) {
          try {
            // Try to parse the JSON
            const tagData = JSON.parse(textContent);
            
            // If the tag wasn't locked using our lock mechanism, notify the user
            if (tagData.locked !== true && tagData.locked !== 'true') {
              throw new Error('This tag is not locked or requires a different unlock method');
            }
            
            // Verify password
            if (tagData.password !== unlockPassword) {
              throw new Error('Incorrect password. Please try again');
            }
            
            // Remove lock and password properties
            const { locked, password, ...otherData } = tagData;
            
            // Write the updated data back to the tag
            const jsonString = JSON.stringify(otherData);
            const bytes = Ndef.encodeMessage([Ndef.textRecord(jsonString)]);
            
            if (bytes) {
              await NfcManager.ndefHandler.writeNdefMessage(bytes);
              Alert.alert('Success', 'Tag unlocked successfully!');
              setUnlockPassword('');
            } else {
              throw new Error('Failed to encode NDEF message');
            }
          } catch (jsonError) {
            if (jsonError.message.includes('password')) {
              throw jsonError;
            }
            throw new Error('Tag contains invalid data format');
          }
        } else {
          throw new Error('This tag does not appear to be locked or contains an unsupported format');
        }
      }
      
      setUnlockPassword('');
      
    } catch (error) {
      Alert.alert(
        'Error', 
        `Failed to unlock tag: ${error.message}`
      );
    } finally {
      // Always cancel technology request when done
      NfcManager.cancelTechnologyRequest();
      setIsUnlocking(false);
    }
  };

  const cancelUnlocking = () => {
    if (isUnlocking) {
      setIsUnlocking(false);
      NfcManager.cancelTechnologyRequest();
    }
    onCancel?.();
  };

  return (
    <View style={styles.nfcTabContent} testID="unlock-tab-container">
      <Text style={styles.nfcTabTitle} testID="unlock-tab-title">Unlock NFC Tag</Text>
      <Text style={styles.nfcTabSubtitle} testID="unlock-tab-subtitle">
        Remove the password protection from your NFC tag.
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
      
      <Text style={styles.infoText}>
        This will remove the password protection previously set on NTAG213, NTAG215, or NTAG216 tags.
      </Text>
    </View>
  );
};

// Ensure styles exist
const additionalStyles = {
  nfcTabContent: {
    flex: 1,
    padding: 16,
    paddingBottom: 80,
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

export default UnlockTab;