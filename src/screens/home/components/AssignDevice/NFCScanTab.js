// components/home/components/AssignDevice/NFCScanTab.js
import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Button from '../../../../components/Button';
import NfcManager, { NfcTech, Ndef } from 'react-native-nfc-manager';
import { useAuth } from '../../../../context/AuthContext';
import axios from 'axios';
import { ndefToJson } from '../../../../../utils/NfcUtils';

const NFCScanTab = ({ onAssignComplete, handleApiError }) => {
  const [assignLoading, setAssignLoading] = useState(false);
  const { getAccessToken } = useAuth();

  const withNfcManager = async (callback) => {
    try {
      await NfcManager.requestTechnology(NfcTech.Ndef);
      const result = await callback();
      return result;
    } catch (error) {
      console.error('NFC Error:', error);
      throw error;
    } finally {
      NfcManager.cancelTechnologyRequest().catch(() => 0);
    }
  };

  const handleAssignNfc = async () => {
    try {
      setAssignLoading(true);
      await withNfcManager(async () => {
        const tag = await NfcManager.getTag();
        if (tag) {
          const parsedData = ndefToJson(tag);
          if (parsedData && parsedData.id) {
            const token = await getAccessToken();
            if (!token) {
              throw new Error('No authentication token available');
            }

            await axios.post(
              'https://test.gmayersservices.com/api/assign-device/',
              { device_id: parsedData.id },
              {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
              }
            );

            Alert.alert('Success', `Device with ID ${parsedData.id} assigned successfully.`);
            onAssignComplete();
          } else {
            Alert.alert('Error', 'Invalid NFC tag data.');
          }
        } else {
          Alert.alert('Error', 'No NFC tag found.');
        }
      });
    } catch (error) {
      handleApiError(error, 'Failed to assign device via NFC.');
    } finally {
      setAssignLoading(false);
    }
  };

  return (
    <View style={styles.assignTabContent}>
      <Text style={styles.assignTabSubtitle}>Scan an NFC tag to assign a device.</Text>
      <Button
        title="Scan NFC Tag"
        onPress={handleAssignNfc}
        disabled={assignLoading}
        isLoading={assignLoading}
        style={styles.assignNfcButton}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  assignTabContent: {
    padding: 10,
  },
  assignTabSubtitle: {
    fontSize: 14,
    color: '#555',
    marginBottom: 15,
  },
  assignNfcButton: {
    backgroundColor: '#17a2b8',
    marginVertical: 10,
  },
});

export default NFCScanTab;