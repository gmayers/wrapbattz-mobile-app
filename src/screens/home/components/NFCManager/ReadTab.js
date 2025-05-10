import React, { useState } from 'react';
import { View, Text, Alert, ScrollView } from 'react-native';
import Button from '../../../../components/Button';
import NfcManager, { Ndef } from 'react-native-nfc-manager';
import { styles } from './styles';

const normalizeJsonString = (jsonString) => {
  // Replace fancy quotes with standard quotes
  let normalized = jsonString
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')  // Replace various fancy double quotes
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'"); // Replace various fancy single quotes
  
  // Remove any control characters
  normalized = normalized.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
  
  // Fix any malformed JSON that might have occurred from improper encoding
  try {
    // Test if it's valid after normalization
    JSON.parse(normalized);
    return normalized;
  } catch (e) {
    // Further repairs for common issues
    
    // Replace unquoted property names - find words followed by colon
    normalized = normalized.replace(/(\s*)(\w+)(\s*):(\s*)/g, (match, before, word, middle, after) => {
      // Don't replace if it's already part of a properly quoted structure
      if ((/"\w+"(\s*):/.test(match) || /'?\w+'?(\s*):/.test(match))) {
        return match;
      }
      return `${before}"${word}"${middle}:${after}`;
    });
    
    // Try to fix dangling quote issues
    let quoteCount = 0;
    for (let i = 0; i < normalized.length; i++) {
      if (normalized[i] === '"' && (i === 0 || normalized[i-1] !== '\\')) {
        quoteCount++;
      }
    }
    
    if (quoteCount % 2 !== 0) {
      // Unbalanced quotes - try to identify and fix the issue
      console.log("[ReadTab] Detected unbalanced quotes, attempting fix");
      
      // Add a closing quote before any commas or closing braces
      normalized = normalized.replace(/([^"\s,{}[\]]+)(\s*)(,|\}|\])/g, '$1"$2$3');
      
      // Fix any values that should start with a quote but don't
      normalized = normalized.replace(/:(\s*)([^"\s,{}[\]][^,{}[\]]*)/g, ':$1"$2"');
    }
    
    return normalized;
  }
};

const ReadTab = ({ withNfcManager, onCancel }) => {
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
        
        if (!tag) {
          Alert.alert('Error', 'No NFC tag detected.');
          return;
        }
        
        if (!tag.ndefMessage || !tag.ndefMessage.length) {
          Alert.alert('Error', 'No NDEF message found on tag.');
          return;
        }
        
        // Process first NDEF record
        const record = tag.ndefMessage[0];
        
        if (record && record.payload && record.tnf === 1) {
          try {
            // Properly decode the NDEF Text Record payload
            let textContent;
            try {
              textContent = Ndef.text.decodePayload(record.payload);
            } catch (e) {
              // Manual decoding fallback
              try {
                // Get a byte array from the payload
                const bytes = [...new Uint8Array(record.payload)];
                
                // First byte contains status and language length
                const statusByte = bytes[0];
                const languageLength = statusByte & 0x3F;
                const isUTF16 = !(statusByte & 0x80);
                
                // Skip language code and status byte
                const textBytes = bytes.slice(1 + languageLength);
                
                // Convert to string based on encoding
                if (isUTF16) {
                  // UTF-16 encoding
                  const uint16Array = new Uint16Array(textBytes.length / 2);
                  for (let i = 0; i < textBytes.length; i += 2) {
                    uint16Array[i / 2] = (textBytes[i] << 8) | textBytes[i + 1];
                  }
                  textContent = String.fromCharCode.apply(null, uint16Array);
                } else {
                  // UTF-8 encoding
                  textContent = String.fromCharCode.apply(null, textBytes);
                }
              } catch (manualError) {
                throw e; // rethrow the original error
              }
            }
            
            // Check if it's valid JSON and process accordingly
            if (textContent && (textContent.startsWith('{') || textContent.startsWith('['))) {
              try {
                // Normalize and clean JSON string
                const cleanJson = normalizeJsonString(textContent.trim());
                
                // Standard JSON parsing
                const jsonData = JSON.parse(cleanJson);
                
                // Format as key-value pairs
                const formattedData = {};
                if (Array.isArray(jsonData)) {
                  // Handle array data
                  formattedData["Array Data"] = JSON.stringify(jsonData);
                } else {
                  // Handle object data
                  Object.entries(jsonData).forEach(([key, value]) => {
                    formattedData[key] = typeof value === 'object' ? JSON.stringify(value) : value;
                  });
                }
                
                setReadResult(formattedData);
                Alert.alert('Success', 'NFC tag read successfully!');
                return;
              } catch (jsonError) {
                // If not valid JSON, use text directly
                setReadResult({ 
                  "Content": textContent,
                  "Parse Error": jsonError.message
                });
                Alert.alert('Partial Success', 'NFC tag read as text (invalid JSON format)');
                return;
              }
            } else if (textContent) {
              // Not JSON, use text directly
              setReadResult({ "Content": textContent });
              Alert.alert('Success', 'NFC tag read successfully!');
              return;
            } else {
              throw new Error('Empty or invalid text content');
            }
          } catch (e) {
            // Last resort: try to use the raw payload as a buffer
            try {
              const rawBuffer = new Uint8Array(record.payload);
              const rawHex = Array.from(rawBuffer)
                .map(b => b.toString(16).padStart(2, '0'))
                .join(' ');
              
              setReadResult({ 
                "Raw Payload (Hex)": rawHex,
                "Record Type": record.type ? new TextDecoder().decode(record.type) : 'Unknown',
                "TNF": record.tnf
              });
              Alert.alert('Partial Success', 'Could not decode tag text. Showing raw data.');
              return;
            } catch (rawError) {
              // Failed to extract raw data
            }
          }
        } else {
          // Invalid record format
        }
        
        // If we reached here, we couldn't extract the data properly
        setReadResult({
          "Error": "Could not read data from tag"
        });
        Alert.alert('Error', 'Could not read data from tag.');
      });
    } catch (error) {
      setReadResult({
        "Error": error.message
      });
      
      Alert.alert(
        'Error', 
        'Failed to read NFC tag.'
      );
    } finally {
      setIsReading(false);
    }
  };

  // Render the key-value pairs
  const renderKeyValuePairs = () => {
    if (!readResult) return null;
    
    return Object.entries(readResult).map(([key, value]) => (
      <Text key={key} style={styles.resultText}>
        <Text style={styles.resultKey}>{key}:</Text> {String(value)}
      </Text>
    ));
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
          <Text style={styles.resultTitle}>Data:</Text>
          {renderKeyValuePairs()}
        </View>
      )}
    </View>
  );
};

export default ReadTab;