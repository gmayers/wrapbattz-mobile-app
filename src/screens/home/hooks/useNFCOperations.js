// useNFCOperations.js

import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import NfcManager, { NfcTech, Ndef } from 'react-native-nfc-manager';

/**
 * Custom hook for managing NFC operations
 * @returns {Object} NFC operations and state
 */
const useNFCOperations = () => {
  // State for tracking NFC operations
  const [isProcessing, setIsProcessing] = useState(false);
  const [nfcEnabled, setNfcEnabled] = useState(false);

  /**
   * Initialize NFC manager
   */
  const initializeNfc = async () => {
    try {
      await NfcManager.start();
      const isSupported = await NfcManager.isSupported();
      if (isSupported) {
        const enabled = await NfcManager.isEnabled();
        setNfcEnabled(enabled);
        return enabled;
      }
      Alert.alert('Error', 'NFC is not supported on this device');
      return false;
    } catch (error) {
      console.error('Error initializing NFC:', error);
      Alert.alert('Error', 'Failed to initialize NFC');
      return false;
    }
  };

  /**
   * Helper function to request NDEF technology with cleanup
   */
  const withNfcManager = async (callback) => {
    try {
      // Prompt user to scan
      Alert.alert('NFC Operation', 'Please bring your device near the NFC tag.');
      
      // Request NDEF technology
      await NfcManager.requestTechnology(NfcTech.Ndef);
      return await callback();
    } catch (error) {
      console.error('NFC Operation Error:', error);
      throw error;
    } finally {
      NfcManager.cancelTechnologyRequest().catch(() => {
        // Ignore cleanup errors
        console.log('Cleanup NFC technology request');
      });
    }
  };

  /**
   * Convert JSON data to NDEF message
   */
  const jsonToNdef = useCallback((jsonData) => {
    try {
      const payload = JSON.stringify(jsonData);
      return Ndef.encodeMessage([Ndef.textRecord(payload)]);
    } catch (error) {
      console.error('Error converting to NDEF:', error);
      throw new Error('Failed to convert data to NDEF format');
    }
  }, []);

  /**
   * Convert NDEF message to JSON data
   */
  const ndefToJson = useCallback((tag) => {
    try {
      if (tag.ndefMessage && tag.ndefMessage.length > 0) {
        const ndefRecord = tag.ndefMessage[0];
        // On many devices, we can decode text with the built-in TextDecoder:
        const textDecoder = new TextDecoder();
        const payload = textDecoder.decode(ndefRecord.payload);

        // Often the first 3 bytes store language code info (e.g. 'en'),
        // so remove them if necessary:
        const jsonString = payload.slice(3);
        return JSON.parse(jsonString);
      }
      throw new Error('No NDEF message found on the tag');
    } catch (error) {
      console.error('Error parsing NDEF:', error);
      return null;
    }
  }, []);

  /**
   * Read NFC tag data (JSON-based)
   */
  const handleReadNfc = async () => {
    if (isProcessing) return null;
    setIsProcessing(true);

    try {
      console.log('Starting NFC read operation');
      let parsedData = null;

      await withNfcManager(async () => {
        const tag = await NfcManager.getTag();
        console.log('Tag found:', tag ? 'Yes' : 'No');

        if (tag) {
          parsedData = ndefToJson(tag);
          if (parsedData) {
            console.log('Parsed NFC data:', parsedData);
            Alert.alert('NFC Data', JSON.stringify(parsedData, null, 2));
          } else {
            throw new Error('Failed to parse NFC tag data');
          }
        } else {
          throw new Error('No NFC tag found');
        }
      });
      return parsedData;
    } catch (error) {
      console.error('Read NFC Error:', error);
      Alert.alert('Error', error.message || 'Failed to read NFC tag');
      return null;
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Write data to NFC tag (merges with existing data)
   */
  const handleWriteNfc = async (newData) => {
    if (isProcessing) return false;
    setIsProcessing(true);

    try {
      console.log('Starting NFC write operation with data:', newData);
      await withNfcManager(async () => {
        // 1) Read the existing tag
        const tag = await NfcManager.getTag();
        if (!tag) throw new Error('No NFC tag found');

        const existingData = ndefToJson(tag) || {};
        console.log('Existing Data on Tag:', existingData);

        // 2) Merge existing data with new data
        const mergedData = { ...existingData, ...newData };

        // 3) Write back to the tag
        const ndefMessage = jsonToNdef(mergedData);
        await NfcManager.ndefHandler.writeNdefMessage(ndefMessage);
        console.log('Write operation successful, new data:', mergedData);
      });
      Alert.alert('Success', 'Data written to NFC tag successfully!');
      return true;
    } catch (error) {
      console.error('Write NFC Error:', error);
      Alert.alert('Error', 'Failed to write to NFC tag');
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Lock NFC tag with password (logical lock in JSON)
   */
  const handleLockNfc = async (password) => {
    if (isProcessing) return false;
    setIsProcessing(true);

    try {
      console.log('Starting NFC lock operation');
      await withNfcManager(async () => {
        const tag = await NfcManager.getTag();
        if (!tag) throw new Error('No NFC tag found');

        // Read existing data and merge
        const existingData = ndefToJson(tag) || {};

        // Mark the tag locked and store the password
        const lockData = {
          ...existingData,
          locked: true,
          password: password,
          lockedAt: new Date().toISOString(),
        };

        const ndefMessage = jsonToNdef(lockData);
        await NfcManager.ndefHandler.writeNdefMessage(ndefMessage);
        console.log('Lock operation successful');
      });
      Alert.alert('Success', 'NFC tag has been locked successfully');
      return true;
    } catch (error) {
      console.error('Lock NFC Error:', error);
      Alert.alert('Error', 'Failed to lock NFC tag');
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Unlock NFC tag with password (logical lock in JSON)
   */
  const handleUnlockNfc = async (password) => {
    if (isProcessing) return false;
    setIsProcessing(true);

    try {
      console.log('Starting NFC unlock operation');
      await withNfcManager(async () => {
        const tag = await NfcManager.getTag();
        if (!tag) throw new Error('No NFC tag found');

        const existingData = ndefToJson(tag);
        if (!existingData) throw new Error('Could not read tag data');

        if (existingData.locked && existingData.password === password) {
          // Remove lock fields
          const unlockedData = {
            ...existingData,
            locked: false,
            unlockedAt: new Date().toISOString(),
          };
          delete unlockedData.password; // remove password from the tag

          const ndefMessage = jsonToNdef(unlockedData);
          await NfcManager.ndefHandler.writeNdefMessage(ndefMessage);
          console.log('Unlock operation successful');
          Alert.alert('Success', 'NFC tag has been unlocked successfully');
          return true;
        } else {
          throw new Error('Incorrect password or tag is not locked');
        }
      });
      return true;
    } catch (error) {
      console.error('Unlock NFC Error:', error);
      Alert.alert('Error', error.message || 'Failed to unlock NFC tag');
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Clean up NFC resources
   */
  const cleanupNfc = async () => {
    try {
      await NfcManager.cancelTechnologyRequest();
      await NfcManager.unregisterTagEvent();
    } catch (error) {
      console.error('Cleanup NFC Error:', error);
    }
  };

  return {
    isProcessing,
    nfcEnabled,
    initializeNfc,
    handleReadNfc,
    handleWriteNfc,
    handleLockNfc,
    handleUnlockNfc,
    cleanupNfc,
  };
};

export default useNFCOperations;
