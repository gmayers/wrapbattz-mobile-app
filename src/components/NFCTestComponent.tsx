// src/components/NFCTestComponent.tsx - Demo component to test the new NFC functionality
import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import Button from './Button';
import { nfcService } from '../services/NFCService';
import { DeviceNFCData } from '../types/nfc';

const NFCTestComponent: React.FC = () => {
  const [isReading, setIsReading] = useState(false);
  const [isWriting, setIsWriting] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const handleRead = async () => {
    try {
      setIsReading(true);
      setLastResult(null);
      
      const result = await nfcService.readNFC();
      
      if (result.success) {
        const resultString = JSON.stringify(result.data, null, 2);
        setLastResult(`READ SUCCESS:\n${resultString}`);
        Alert.alert('Read Success', 'NFC tag read successfully!');
      } else {
        setLastResult(`READ ERROR:\n${result.error}`);
        Alert.alert('Read Error', result.error || 'Unknown error');
      }
    } catch (error) {
      const errorMsg = (error as Error).message;
      setLastResult(`READ EXCEPTION:\n${errorMsg}`);
      Alert.alert('Read Exception', errorMsg);
    } finally {
      setIsReading(false);
    }
  };

  const handleWrite = async () => {
    try {
      setIsWriting(true);
      setLastResult(null);
      
      // Create test device data
      const testDeviceData: DeviceNFCData = {
        deviceId: `TEST-${Date.now()}`,
        make: 'Makita',
        model: 'DHP484Z',
        serialNumber: 'SN123456789',
        maintenanceInterval: 30,
        description: 'Test cordless drill - NFC Service demo'
      };
      
      const result = await nfcService.writeDeviceToNFC(testDeviceData);
      
      if (result.success) {
        const resultString = JSON.stringify(result.data, null, 2);
        setLastResult(`WRITE SUCCESS:\n${resultString}`);
        Alert.alert('Write Success', 'NFC tag written successfully!');
      } else {
        setLastResult(`WRITE ERROR:\n${result.error}`);
        Alert.alert('Write Error', result.error || 'Unknown error');
      }
    } catch (error) {
      const errorMsg = (error as Error).message;
      setLastResult(`WRITE EXCEPTION:\n${errorMsg}`);
      Alert.alert('Write Exception', errorMsg);
    } finally {
      setIsWriting(false);
    }
  };

  const handleWriteCustomJSON = async () => {
    try {
      setIsWriting(true);
      setLastResult(null);
      
      // Create test JSON data
      const testData = {
        testField1: 'Hello NFC',
        testField2: 123,
        testField3: true,
        timestamp: new Date().toISOString()
      };
      
      const jsonString = JSON.stringify(testData);
      const result = await nfcService.writeNFC(jsonString);
      
      if (result.success) {
        const resultString = JSON.stringify(result.data, null, 2);
        setLastResult(`CUSTOM JSON WRITE SUCCESS:\n${resultString}`);
        Alert.alert('Write Success', 'Custom JSON written successfully!');
      } else {
        setLastResult(`CUSTOM JSON WRITE ERROR:\n${result.error}`);
        Alert.alert('Write Error', result.error || 'Unknown error');
      }
    } catch (error) {
      const errorMsg = (error as Error).message;
      setLastResult(`CUSTOM JSON WRITE EXCEPTION:\n${errorMsg}`);
      Alert.alert('Write Exception', errorMsg);
    } finally {
      setIsWriting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>NFC Service Test Component</Text>
      
      <View style={styles.buttonContainer}>
        <Button
          title={isReading ? 'Reading...' : 'Read NFC Tag'}
          onPress={handleRead}
          disabled={isReading || isWriting}
          style={[styles.button, { backgroundColor: '#28a745' }]}
          textColor="white"
        />
        
        <Button
          title={isWriting ? 'Writing...' : 'Write Device Data'}
          onPress={handleWrite}
          disabled={isReading || isWriting}
          style={[styles.button, { backgroundColor: '#007bff' }]}
          textColor="white"
        />
        
        <Button
          title={isWriting ? 'Writing...' : 'Write Custom JSON'}
          onPress={handleWriteCustomJSON}
          disabled={isReading || isWriting}
          style={[styles.button, { backgroundColor: '#6f42c1' }]}
          textColor="white"
        />
      </View>
      
      {lastResult && (
        <View style={styles.resultContainer}>
          <Text style={styles.resultTitle}>Last Result:</Text>
          <Text style={styles.resultText}>{lastResult}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    margin: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  buttonContainer: {
    gap: 10,
  },
  button: {
    paddingVertical: 12,
    borderRadius: 8,
  },
  resultContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  resultText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#495057',
    lineHeight: 16,
  },
});

export default NFCTestComponent;