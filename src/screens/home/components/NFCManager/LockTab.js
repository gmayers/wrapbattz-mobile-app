// LockTab.js
import React, { useState } from 'react';
import { View, Text, Alert, Platform, ScrollView } from 'react-native';
import Button from '../../../../components/Button';
import { PasswordInput } from '../../../../components/TextInput';
import { styles } from './styles';
import { nfcSecurityService } from '../../../../services/NFCSecurityService';

const ORANGE_COLOR = '#FF9500';

const LockTab = ({ onCancel }) => {
  const [lockPassword, setLockPassword] = useState('');
  const [isLocking, setIsLocking] = useState(false);

  const handleLockNfc = async () => {
    if (!lockPassword) {
      Alert.alert('Error', 'Please enter a password');
      return;
    }

    if (lockPassword.length < 4) {
      Alert.alert('Error', 'Password must be at least 4 characters long');
      return;
    }

    try {
      setIsLocking(true);
      
      // Use the new NFCSecurityService
      const result = await nfcSecurityService.lockTag(lockPassword);
      
      if (result.success) {
        const lockTypeMessage = result.lockType === 'hardware' 
          ? 'Tag locked with hardware password protection!'
          : 'Tag locked with encrypted content protection!';
        
        Alert.alert('Success', lockTypeMessage);
        setLockPassword('');
      } else {
        throw new Error(result.error || 'Unknown error occurred during lock operation');
      }
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to lock tag');
    } finally {
      setIsLocking(false);
    }
  };

  const cancelLocking = () => {
    if (isLocking) {
      setIsLocking(false);
      nfcSecurityService.getInstance().then(service => {
        // Cancel any ongoing operations
        service.constructor.prototype.cancelOperation?.();
      }).catch(() => {});
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
              disabled={isLocking || !lockPassword || lockPassword.length < 4}
              style={[styles.lockButton, { backgroundColor: ORANGE_COLOR }]}
              textColor="white"
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
        Note: NTAG213/215/216 tags support hardware password protection. Other NDEF tags will use encrypted content protection.
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