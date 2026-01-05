import React, { useState } from 'react';
import { View, Text, Alert, ScrollView } from 'react-native';
import Button from '../../../../components/Button';
import DeviceInfoDisplay from '../../../../components/DeviceInfoDisplay';
import { nfcService } from '../../../../services/NFCService';
import { styles } from './styles';

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
        // Get the tag hardware UUID (always available on successful read)
        const tagId = result.data?.tagId;

        // Handle empty tags
        if (result.data?.isEmpty) {
          setReadResult({
            isEmpty: true,
            ...(tagId && { 'Tag UUID': tagId })
          });
          Alert.alert('Empty Tag', result.data.message || 'Tag is formatted but contains no data.');
          return;
        }

        // Extract parsed data for DeviceInfoDisplay
        let deviceData = null;

        if (result.data?.parsedData) {
          // Handle parsed JSON data
          const jsonData = result.data.parsedData;

          if (typeof jsonData === 'object' && !Array.isArray(jsonData)) {
            // Object data - use directly for DeviceInfoDisplay
            deviceData = jsonData;
          } else if (Array.isArray(jsonData)) {
            // Array data - convert to object
            deviceData = { "Array Data": JSON.stringify(jsonData, null, 2) };
          } else {
            // Primitive data
            deviceData = { "Content": String(jsonData) };
          }
        } else if (result.data?.jsonString) {
          // Handle raw JSON string
          try {
            const parsed = JSON.parse(result.data.jsonString);
            if (typeof parsed === 'object' && !Array.isArray(parsed)) {
              deviceData = parsed;
            } else {
              deviceData = { "Raw JSON": result.data.jsonString };
            }
          } catch (e) {
            deviceData = { "Raw JSON": result.data.jsonString };
          }
        } else if (result.data?.content) {
          // Handle plain text content
          deviceData = { "Content": result.data.content };
        }

        // Include tag UUID in the displayed data (at the top)
        if (tagId && deviceData) {
          deviceData = { 'Tag UUID': tagId, ...deviceData };
        }

        setReadResult(deviceData);
        Alert.alert('Success', 'NFC tag read successfully!');
      } else {
        // Handle NFCService errors
        const errorMessage = result.error || 'Unknown error occurred';
        setReadResult({ error: errorMessage });
        Alert.alert('Error', errorMessage);
      }
    } catch (error) {
      console.error('[ReadTab] Unexpected error:', error);
      const errorMessage = error.message || 'Unexpected error occurred';
      setReadResult({ error: errorMessage });
      Alert.alert('Error', errorMessage);
    } finally {
      setIsReading(false);
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
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {readResult.isEmpty ? (
            <View style={styles.resultContainer}>
              <Text style={styles.emptyTagText}>
                Tag is formatted but contains no data. You can write data to it using the Edit tab.
              </Text>
            </View>
          ) : readResult.error ? (
            <View style={styles.resultContainer}>
              <Text style={styles.errorText}>Error: {readResult.error}</Text>
            </View>
          ) : (
            <DeviceInfoDisplay deviceData={readResult} />
          )}
        </ScrollView>
      )}
    </View>
  );
};

export default ReadTab;