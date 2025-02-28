import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, Alert } from 'react-native';
import Button from '../../../../components/Button';
import NfcManager from 'react-native-nfc-manager';
import { styles } from './styles';

const EditTab = ({ withNfcManager, ndefToJson, onCancel }) => {
  const [isReading, setIsReading] = useState(false);
  const [isWriting, setIsWriting] = useState(false);
  const [tagData, setTagData] = useState(null);
  const [editedFields, setEditedFields] = useState({});

  const handleReadTag = async () => {
    try {
      setIsReading(true);
      setTagData(null);
      
      await withNfcManager(async () => {
        const tag = await NfcManager.getTag();
        if (tag) {
          const parsedData = ndefToJson(tag);
          if (parsedData) {
            // Convert the parsed data into editable fields, excluding the ID
            const { id, ...editableData } = parsedData;
            setTagData({ id, ...editableData });
            setEditedFields(editableData);
            Alert.alert('Success', 'NFC tag data loaded successfully!');
          } else {
            Alert.alert('Error', 'Failed to parse NFC tag data.');
          }
        } else {
          Alert.alert('Error', 'No NFC tag found.');
        }
      });
    } catch (error) {
      console.error('Error in read operation:', error);
    } finally {
      setIsReading(false);
    }
  };

  const handleWriteTag = async () => {
    try {
      setIsWriting(true);
      
      // Preserve the original ID if it exists
      const dataToWrite = tagData?.id 
        ? { id: tagData.id, ...editedFields }
        : editedFields;

      await withNfcManager(async () => {
        // Convert editedFields back to NDEF format and write
        const ndefMessage = {
          type: "text/plain",
          value: JSON.stringify(dataToWrite),
          encoding: 'UTF-8',
        };

        await NfcManager.ndefHandler.writeNdefMessage(ndefMessage);
        Alert.alert('Success', 'Changes saved to NFC tag successfully!');
      });
    } catch (error) {
      console.error('Error in write operation:', error);
      Alert.alert('Error', 'Failed to write changes to NFC tag.');
    } finally {
      setIsWriting(false);
    }
  };

  const handleFieldChange = (key, value) => {
    setEditedFields(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const cancelOperation = () => {
    if (isReading || isWriting) {
      setIsReading(false);
      setIsWriting(false);
      onCancel?.();
    }
  };

  return (
    <View style={styles.nfcTabContent}>
      <Text style={styles.nfcTabTitle}>Edit NFC Tag</Text>
      <Text style={styles.nfcTabSubtitle}>
        Read the NFC tag to load existing data into the form, make changes, and save.
      </Text>

      {isReading || isWriting ? (
        <View style={styles.buttonGroup}>
          <Button
            title="Cancel Operation"
            onPress={cancelOperation}
            style={styles.cancelButton}
          />
        </View>
      ) : (
        <Button
          title={tagData ? "Reload Tag Data" : "Load Tag Data"}
          onPress={handleReadTag}
          style={styles.loadButton}
          disabled={isReading || isWriting}
        />
      )}

      {(isReading || isWriting) && (
        <View style={styles.readingStatusContainer}>
          <Text style={styles.readingStatusText}>
            {isReading ? "Ready to read... Place NFC tag near device" : "Ready to write... Place NFC tag near device"}
          </Text>
        </View>
      )}

      {tagData && !isReading && !isWriting && (
        <ScrollView style={styles.editFieldsContainer}>
          {tagData.id && (
            <View style={styles.idField}>
              <Text style={styles.fieldLabel}>ID (Not Editable):</Text>
              <Text style={styles.idValue}>{tagData.id}</Text>
            </View>
          )}
          
          {Object.entries(editedFields).map(([key, value]) => (
            <View key={key} style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>{key}:</Text>
              <TextInput
                style={styles.fieldInput}
                value={String(value)}
                onChangeText={(text) => handleFieldChange(key, text)}
                placeholder={`Enter ${key}`}
                multiline={value && value.length > 40}
              />
            </View>
          ))}

          <Button
            title="Save Changes"
            onPress={handleWriteTag}
            disabled={isWriting}
            style={[styles.writeButton, { marginTop: 20 }]}
          />
        </ScrollView>
      )}
    </View>
  );
};

// Additional styles
const additionalStyles = {
  editFieldsContainer: {
    flex: 1,
    marginTop: 20,
  },
  fieldContainer: {
    marginBottom: 15,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 5,
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    fontSize: 16,
  },
  idField: {
    marginBottom: 15,
    padding: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 5,
  },
  idValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
  },
};

// Merge the additional styles
Object.assign(styles, additionalStyles);

export default EditTab;