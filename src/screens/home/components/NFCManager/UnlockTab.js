// UnlockTab.js
import React, { useState } from 'react';
import { View, Text, Alert, ScrollView } from 'react-native';
import Button from '../../../../components/Button';
import { PasswordInput } from '../../../../components/TextInput';
import { styles } from './styles';
import { nfcSecurityService } from '../../../../services/NFCSecurityService';

const ORANGE_COLOR = '#FF9500';

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
      
      // Use the new NFCSecurityService
      const result = await nfcSecurityService.unlockTag(unlockPassword);
      
      if (result.success) {
        const unlockTypeMessage = result.lockType === 'hardware' 
          ? 'Hardware password protection removed successfully!'
          : 'Tag unlocked and content restored successfully!';
        
        let message = unlockTypeMessage;
        if (result.data?.restoredContent && result.data.restoredContent !== 'No content was stored') {
          message += '\n\nOriginal content has been restored to the tag.';
        }
        
        Alert.alert('Success', message);
        setUnlockPassword('');
      } else {
        throw new Error(result.error || 'Unknown error occurred during unlock operation');
      }
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to unlock tag');
    } finally {
      setIsUnlocking(false);
    }
  };

  const cancelUnlocking = () => {
    if (isUnlocking) {
      setIsUnlocking(false);
      nfcSecurityService.getInstance().then(service => {
        // Cancel any ongoing operations
        service.constructor.prototype.cancelOperation?.();
      }).catch(() => {});
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
              style={[styles.unlockButton, { backgroundColor: ORANGE_COLOR }]}
              textColor="white"
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
        This will remove password protection and restore the original content if any was stored before locking.
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