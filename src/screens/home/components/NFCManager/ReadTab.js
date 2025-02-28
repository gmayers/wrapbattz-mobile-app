import React, { useState } from 'react';
import { View, Text, Alert, ScrollView, Platform } from 'react-native';
import Button from '../../../../components/Button';
import NfcManager, { Ndef } from 'react-native-nfc-manager';
import { styles } from './styles';

const ReadTab = ({ withNfcManager, ndefToJson, onCancel }) => {
  const [isReading, setIsReading] = useState(false);
  const [readResult, setReadResult] = useState(null);
  const [rawTagData, setRawTagData] = useState(null);
  const [parseError, setParseError] = useState(null);

  const cancelNfcRead = async () => {
    setIsReading(false);
    onCancel?.();
  };

  // Helper function to safely parse JSON
  const safeJsonParse = (str) => {
    try {
      return JSON.parse(str);
    } catch (e) {
      console.log('JSON Parse Error:', e.message);
      console.log('String being parsed:', str);
      return { error: `JSON Parse Error: ${e.message}`, raw: str };
    }
  };

  // Helper function to extract text from NDEF records
  const extractTextFromNdef = (record) => {
    try {
      if (!record || !record.payload) {
        return '[No payload]';
      }

      // Log the raw payload for debugging
      console.log('Raw payload:', record.payload);
      
      // For Text records (TNF=1 and RTD=T)
      if (record.tnf === 1 && record.type && record.type.length > 0) {
        // Convert type bytes to string
        const typeStr = String.fromCharCode.apply(null, record.type);
        
        if (typeStr === 'T') {
          return Ndef.text.decodePayload(record.payload);
        }
        
        if (typeStr === 'U') {
          return Ndef.uri.decodePayload(record.payload);
        }
      }

      // If we can't determine the type, try a few approaches
      // First, try direct string conversion of payload
      let result = '';
      
      // Skip first byte for text records (it's the language code length)
      const startIndex = (record.tnf === 1) ? 1 : 0;
      
      for (let i = startIndex; i < record.payload.length; i++) {
        // Only include printable ASCII characters
        if (record.payload[i] >= 32 && record.payload[i] <= 126) {
          result += String.fromCharCode(record.payload[i]);
        }
      }
      
      if (result.length > 0) {
        return result;
      }
      
      // If nothing worked, return hex representation
      return record.payload.map(byte => byte.toString(16).padStart(2, '0')).join(' ');
    } catch (e) {
      console.error('Error extracting text:', e);
      return `[Extraction Error: ${e.message}]`;
    }
  };

  const handleReadNfc = async () => {
    try {
      setIsReading(true);
      setReadResult(null);
      setRawTagData(null);
      setParseError(null);
      
      await withNfcManager(async () => {
        const tag = await NfcManager.getTag();
        console.log('Raw tag data:', JSON.stringify(tag));
        setRawTagData(tag);
        
        if (tag) {
          try {
            // First, let's see what we're working with
            if (tag.ndefMessage && tag.ndefMessage.length > 0) {
              console.log(`Found ${tag.ndefMessage.length} NDEF records`);
              
              // Extract text from each NDEF record
              const textContents = tag.ndefMessage.map((record, index) => {
                const text = extractTextFromNdef(record);
                console.log(`Record ${index} content:`, text);
                return text;
              });

              // Join all text content
              const combinedText = textContents.join('\n');
              
              // Try to determine if this is JSON
              if (combinedText.trim().startsWith('{') || combinedText.trim().startsWith('[')) {
                try {
                  // Attempt to parse as JSON
                  const jsonData = safeJsonParse(combinedText);
                  setReadResult(jsonData);
                  Alert.alert('Success', 'NFC tag read and parsed as JSON successfully!');
                } catch (jsonError) {
                  console.error('JSON parsing error:', jsonError);
                  setParseError(`JSON Parse Error: ${jsonError.message}`);
                  setReadResult(combinedText);
                  Alert.alert('Success', 'NFC tag read with raw content (JSON parsing failed)');
                }
              } else {
                // Not JSON, just use the text content
                setReadResult(combinedText);
                Alert.alert('Success', 'NFC tag read successfully!');
              }
            } else {
              // No NDEF message but we have a tag
              setReadResult(JSON.stringify(tag, null, 2));
              Alert.alert('Success', 'Raw tag data read successfully!');
            }
          } catch (parseError) {
            console.error('Error processing tag:', parseError);
            setParseError(`Processing Error: ${parseError.message}`);
            setReadResult(JSON.stringify(tag, null, 2));
            Alert.alert('Partial Success', 'Read tag but encountered processing errors.');
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
      if (result.error) return result.error;
      return JSON.stringify(result, null, 2);
    } catch (e) {
      return `[Formatting Error: ${e.message}]`;
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
          <Text style={styles.resultTitle}>Read Result:</Text>
          <Text style={readResult.error ? styles.errorText : styles.resultText}>
            {formatReadResult(readResult)}
          </Text>
          
          {parseError && (
            <View>
              <Text style={[styles.resultTitle, {marginTop: 10, color: '#f44336'}]}>
                Parse Errors:
              </Text>
              <Text style={styles.errorText}>{parseError}</Text>
            </View>
          )}
          
          {rawTagData && (
            <>
              <Text style={[styles.resultTitle, {marginTop: 10}]}>Raw Tag Data:</Text>
              <Text style={styles.debugText}>
                {JSON.stringify(rawTagData, null, 2)}
              </Text>
              
              {rawTagData.ndefMessage && (
                <>
                  <Text style={[styles.resultTitle, {marginTop: 10}]}>NDEF Records:</Text>
                  {rawTagData.ndefMessage.map((record, index) => (
                    <View key={index} style={{marginBottom: 10}}>
                      <Text style={styles.recordHeader}>
                        Record {index + 1}: 
                        Type: {record.type ? Array.from(record.type).map(b => String.fromCharCode(b)).join('') : 'None'}
                        (TNF: {record.tnf})
                      </Text>
                      <Text style={styles.recordText}>
                        Payload: {record.payload ? 
                          record.payload.map(b => b.toString(16).padStart(2, '0')).join(' ') : 
                          'None'}
                      </Text>
                      <Text style={styles.recordText}>
                        Text: {extractTextFromNdef(record)}
                      </Text>
                    </View>
                  ))}
                </>
              )}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
};

// Add these styles to your styles.js file
const additionalStyles = {
  debugText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    color: '#555',
  },
  recordHeader: {
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 4,
  },
  recordText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    color: '#333',
    marginLeft: 8,
  },
};

export default ReadTab;