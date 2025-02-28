import React, { useState } from 'react';
import { View, Text, Alert, ScrollView } from 'react-native';
import Button from '../../../../components/Button';
import NfcManager, { Ndef } from 'react-native-nfc-manager';
import { styles } from './styles';

const ReadTab = ({ withNfcManager, ndefToJson, onCancel }) => {
  const [isReading, setIsReading] = useState(false);
  const [readResult, setReadResult] = useState(null);
  const [rawTagData, setRawTagData] = useState(null);

  const cancelNfcRead = async () => {
    setIsReading(false);
    onCancel?.();
  };

  const handleReadNfc = async () => {
    try {
      setIsReading(true);
      setReadResult(null);
      setRawTagData(null);
      
      await withNfcManager(async () => {
        const tag = await NfcManager.getTag();
        console.log('Raw tag data:', tag);
        setRawTagData(tag);
        
        if (tag) {
          try {
            // Try using the prop-provided parser first
            if (typeof ndefToJson === 'function') {
              const parsedData = ndefToJson(tag);
              if (parsedData) {
                setReadResult(parsedData);
                Alert.alert('Success', 'NFC tag read successfully!');
                return;
              }
            }
            
            // Fallback parsing if the provided parser fails
            if (tag.ndefMessage && tag.ndefMessage.length > 0) {
              const ndefRecords = tag.ndefMessage;
              const parsedData = ndefRecords.map(record => {
                try {
                  if (record.payload) {
                    // Try to decode the payload based on TNF
                    if (record.tnf === 1) { // Well-known type (NFC Forum)
                      return Ndef.text.decodePayload(record.payload);
                    } else if (record.tnf === 3) { // Absolute URI
                      return Ndef.uri.decodePayload(record.payload);
                    } else {
                      // For other types, try to convert to string
                      return String.fromCharCode.apply(null, record.payload);
                    }
                  }
                  return JSON.stringify(record);
                } catch (e) {
                  return `[Parsing Error: ${e.message}]`;
                }
              });
              
              setReadResult(parsedData.join('\n'));
              Alert.alert('Success', 'NFC tag read successfully!');
            } else {
              // No NDEF message but we have a tag
              setReadResult(JSON.stringify(tag));
              Alert.alert('Success', 'Raw tag data read successfully!');
            }
          } catch (parseError) {
            console.error('Error parsing tag:', parseError);
            setReadResult({ error: `Failed to parse NFC tag data: ${parseError.message}` });
            Alert.alert('Error', 'Failed to parse NFC tag data.');
          }
        } else {
          setReadResult({ error: 'No NFC tag found' });
          Alert.alert('Error', 'No NFC tag found.');
        }
      });
    } catch (error) {
      console.error('Error in read operation:', error);
      setReadResult({ error: `Read operation failed: ${error.message}` });
      Alert.alert('Error', `Read operation failed: ${error.message}`);
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
        <ScrollView style={styles.resultContainer}>
          <Text style={styles.resultTitle}>
            {readResult.error ? 'Read Error' : 'Read Result:'}
          </Text>
          <Text style={readResult.error ? styles.errorText : styles.resultText}>
            {readResult.error || formatReadResult(readResult)}
          </Text>
          
          {rawTagData && (
            <>
              <Text style={[styles.resultTitle, {marginTop: 10}]}>Raw Tag Data:</Text>
              <Text style={styles.debugText}>
                {JSON.stringify(rawTagData, null, 2)}
              </Text>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
};

export default ReadTab;