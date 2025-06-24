import React, { useState } from 'react';
import { View, Text, Alert, ScrollView } from 'react-native';
import Button from '../../../../components/Button';
import { nfcService } from '../../../../services/NFCService';
import { styles } from './styles';

// Remove the manual normalization logic - NFCService handles this now

const ReadTab = ({ withNfcManager, onCancel }) => {
  const [isReading, setIsReading] = useState(false);
  const [readResult, setReadResult] = useState(null);

  const cancelNfcRead = async () => {
    try {
      setIsReading(false);
      await nfcService.cancelOperation();
      console.log('[ReadTab] NFC operation cancelled');
    } catch (error) {
      console.warn('[ReadTab] Error cancelling NFC operation:', error);
    }
    onCancel?.();
  };

  const handleReadNfc = async () => {
    try {
      setIsReading(true);
      setReadResult(null);
      
      console.log('[ReadTab] Starting NFC read using NFCService');
      
      // Use the enhanced NFCService for reading
      const result = await nfcService.readNFC({ timeout: 60000 });
      
      if (result.success) {
        let formattedData = {};
        
        if (result.data?.parsedData) {
          // Handle parsed JSON data
          const jsonData = result.data.parsedData;
          
          if (Array.isArray(jsonData)) {
            formattedData["Array Data"] = JSON.stringify(jsonData, null, 2);
          } else if (typeof jsonData === 'object') {
            // Format object as key-value pairs
            Object.entries(jsonData).forEach(([key, value]) => {
              if (typeof value === 'object' && value !== null) {
                formattedData[key] = JSON.stringify(value, null, 2);
              } else {
                formattedData[key] = String(value);
              }
            });
          } else {
            formattedData["Content"] = String(jsonData);
          }
        } else if (result.data?.content) {
          // Handle plain text content
          formattedData["Content"] = result.data.content;
        } else if (result.data?.jsonString) {
          // Handle raw JSON string
          try {
            const parsed = JSON.parse(result.data.jsonString);
            Object.entries(parsed).forEach(([key, value]) => {
              if (typeof value === 'object' && value !== null) {
                formattedData[key] = JSON.stringify(value, null, 2);
              } else {
                formattedData[key] = String(value);
              }
            });
          } catch (e) {
            formattedData["Raw JSON"] = result.data.jsonString;
          }
        }
        
        setReadResult(formattedData);
        Alert.alert('Success', 'NFC tag read successfully!');
      } else {
        // Handle NFCService errors
        const errorMessage = result.error || 'Unknown error occurred';
        setReadResult({ "Error": errorMessage });
        Alert.alert('Error', errorMessage);
      }
    } catch (error) {
      console.error('[ReadTab] Unexpected error:', error);
      const errorMessage = error.message || 'Unexpected error occurred';
      setReadResult({ "Error": errorMessage });
      Alert.alert('Error', errorMessage);
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