import React from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Button from '../../../../components/Button';
import { styles } from './styles';

const WriteTab = ({ writeFields, handleWriteFieldChange, handleDeleteWriteField, addWriteFieldRow, handleWriteNfc, isWriting }) => {
  return (
    <View style={styles.nfcTabContent}>
      <Text style={styles.nfcTabTitle}>Write NFC Tag</Text>
      <Text style={styles.nfcTabSubtitle}>Enter label and value pairs to write to the NFC tag.</Text>
      
      {writeFields.map((field, index) => (
        <View key={index} style={styles.writeFieldRow}>
          <TextInput
            style={styles.input}
            placeholder="Label"
            value={field.label}
            onChangeText={(text) => handleWriteFieldChange(index, 'label', text)}
          />
          <TextInput
            style={styles.input}
            placeholder="Value"
            value={field.value}
            onChangeText={(text) => handleWriteFieldChange(index, 'value', text)}
          />
          {index > 0 && (
            <TouchableOpacity
              onPress={() => handleDeleteWriteField(index)}
              style={styles.deleteButton}
              testID={`delete-write-field-${index}`}
            >
              <Ionicons name="trash-outline" size={20} color="#FF3B30" />
            </TouchableOpacity>
          )}
        </View>
      ))}
      
      <TouchableOpacity style={styles.addFieldButton} onPress={addWriteFieldRow}>
        <Text style={styles.addFieldText}>+ Add Value</Text>
      </TouchableOpacity>
      
      <Button
        title="Write to Tag"
        onPress={handleWriteNfc}
        disabled={isWriting || !writeFields.some((field) => field.label.trim())}
        isLoading={isWriting}
        style={styles.writeButton}
      />
    </View>
  );
};

export default WriteTab;