import React, { useState } from 'react';
import { View, Text, Alert } from 'react-native';
import Button from '../../../../components/Button';
import NfcManager from 'react-native-nfc-manager';
import { styles } from './styles';

const ReadTab = ({ withNfcManager, ndefToJson, onCancel }) => {
  const [isReading, setIsReading] = useState(false);
  const [readResult, setReadResult] = useState(null);

  const cancelNfcRead = async () => {
    setIsReading(false);
    onCancel?.();
  };

  const handleReadNfc = async () => {
    try {
      setIsReading(true);
      setReadResult(null);
      
      await withNfcManager(async () => {
        const tag = await NfcManager.getTag();
        if (tag) {
          const parsedData = ndefToJson(tag);
          if (parsedData) {
            setReadResult(parsedData);
            Alert.alert('Success', 'NFC tag read successfully!');
          } else {
            setReadResult({ error: 'Failed to parse NFC tag data' });
            Alert.alert('Error', 'Failed to parse NFC tag data.');
          }
        } else {
          setReadResult({ error: 'No NFC tag found' });
          Alert.alert('Error', 'No NFC tag found.');
        }
      });
    } catch (error) {
      // Error handling is now managed by withNfcManager
      console.error('Error in read operation:', error);
    } finally {
      setIsReading(false);
    }
  };

  const formatReadResult = (result) => {
    if (!result) return '';
    try {
      if (typeof result === 'string') return result;
      return JSON.stringify(result, null, 2)
        .replace(/[{}"]/g, '')
        .split(',')
        .map(line => line.trim())
        .join('\n');
    } catch (e) {
      return JSON.stringify(result);
    }
  };

  return (
    <View style={styles.nfcTabContent}>
      <Text style={styles.nfcTabTitle}>Read NFC Tag</Text>
      <Text style={styles.nfcTabSubtitle}>Place your device near an NFC tag to read data.</Text>
      
      {isReading ? (
        <View style={styles.buttonGroup}>
          <Button
            title="Cancel Read"
            onPress={cancelNfcRead}
            style={styles.cancelButton}
          />
        </View>
      ) : (
        <Button
          title="Read Tag"
          onPress={handleReadNfc}
          style={styles.nfcButton}
          disabled={isReading}
        />
      )}

      {isReading && (
        <View style={styles.readingStatusContainer}>
          <Text style={styles.readingStatusText}>
            Ready to read... Place NFC tag near device
          </Text>
        </View>
      )}

      {readResult && !isReading && (
        <View style={styles.resultContainer}>
          <Text style={styles.resultTitle}>
            {readResult.error ? 'Read Error' : 'Read Result:'}
          </Text>
          <Text style={readResult.error ? styles.errorText : styles.resultText}>
            {readResult.error || formatReadResult(readResult)}
          </Text>
        </View>
      )}
    </View>
  );
};

export default ReadTab;