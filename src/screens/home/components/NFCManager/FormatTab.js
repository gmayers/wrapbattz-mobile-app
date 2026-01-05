import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { nfcService } from '../../../../services/NFCService';

const FormatTab = ({ withNfcManager, onCancel }) => {
  const [isFormatting, setIsFormatting] = useState(false);
  const [formatResult, setFormatResult] = useState(null);

  const handleFormatTag = async () => {
    try {
      setIsFormatting(true);
      setFormatResult(null);

      // Show confirmation dialog
      Alert.alert(
        'Format NFC Tag',
        'This will format the tag to NDEF format. Any existing data will be erased. Continue?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => setIsFormatting(false)
          },
          {
            text: 'Format',
            style: 'destructive',
            onPress: async () => {
              try {
                // Use the NFCService formatTag method
                const result = await nfcService.formatTag();
                
                if (result.success) {
                  setFormatResult({
                    success: true,
                    message: result.data?.message || 'Tag formatted successfully!'
                  });
                  Alert.alert('Success', result.data?.message || 'Tag formatted successfully!');
                } else {
                  setFormatResult({
                    success: false,
                    message: result.error || 'Failed to format tag'
                  });
                  Alert.alert('Error', result.error || 'Failed to format tag');
                }
              } catch (error) {
                console.error('Format error:', error);
                setFormatResult({
                  success: false,
                  message: error.message || 'An unexpected error occurred'
                });
                Alert.alert('Error', error.message || 'Failed to format tag');
              } finally {
                setIsFormatting(false);
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Format initialization error:', error);
      setIsFormatting(false);
      Alert.alert('Error', 'Failed to initialize format operation');
    }
  };

  const handleCancel = () => {
    setIsFormatting(false);
    if (onCancel) {
      onCancel();
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header Section */}
        <View style={styles.headerSection}>
          <Ionicons name="refresh-circle" size={80} color="#FF6B00" />
          <Text style={styles.title}>Format NFC Tag</Text>
          <Text style={styles.subtitle}>Convert tags to NDEF format</Text>
        </View>

        {/* Info Section */}
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>What is NDEF formatting?</Text>
          <Text style={styles.infoText}>
            NDEF (NFC Data Exchange Format) is the standard format for storing and exchanging data on NFC tags. 
            Tags must be NDEF formatted to work with WrapBattz.
          </Text>

          <View style={styles.bulletSection}>
            <Text style={styles.bulletTitle}>When to use this:</Text>
            <View style={styles.bulletItem}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.bulletText}>New blank NFC tags</Text>
            </View>
            <View style={styles.bulletItem}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.bulletText}>Tags showing "not NDEF formatted" errors</Text>
            </View>
            <View style={styles.bulletItem}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.bulletText}>Tags from other NFC applications</Text>
            </View>
          </View>

          <View style={styles.warningBox}>
            <Ionicons name="warning" size={24} color="#FF3B30" />
            <Text style={styles.warningText}>
              Formatting will erase all existing data on the tag!
            </Text>
          </View>

          {/* Platform-specific info */}
          {Platform.OS === 'ios' && (
            <View style={styles.platformInfoBox}>
              <Ionicons name="information-circle" size={20} color="#007AFF" />
              <Text style={styles.platformInfoText}>
                iOS Note: Blank tags may not be formattable. Please use pre-formatted NDEF tags. This function works best for clearing already-formatted tags.
              </Text>
            </View>
          )}

          {Platform.OS === 'android' && (
            <View style={styles.platformInfoBox}>
              <Ionicons name="information-circle" size={20} color="#3DDC84" />
              <Text style={styles.platformInfoText}>
                Android supports formatting both blank and already-formatted NDEF tags.
              </Text>
            </View>
          )}
        </View>

        {/* Result Display */}
        {formatResult && (
          <View style={[styles.resultBox, formatResult.success ? styles.successBox : styles.errorBox]}>
            <Ionicons 
              name={formatResult.success ? "checkmark-circle" : "close-circle"} 
              size={24} 
              color={formatResult.success ? "#34C759" : "#FF3B30"} 
            />
            <Text style={[styles.resultText, formatResult.success ? styles.successText : styles.errorText]}>
              {formatResult.message}
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          {!isFormatting ? (
            <TouchableOpacity style={styles.formatButton} onPress={handleFormatTag}>
              <Ionicons name="refresh" size={24} color="#FFFFFF" />
              <Text style={styles.formatButtonText}>Format Tag</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.formattingContainer}>
              <ActivityIndicator size="large" color="#FF6B00" />
              <Text style={styles.formattingText}>Hold tag near device...</Text>
              <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Instructions */}
        <View style={styles.instructionsSection}>
          <Text style={styles.instructionsTitle}>How to format:</Text>
          <View style={styles.stepContainer}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <Text style={styles.stepText}>Tap the "Format Tag" button above</Text>
          </View>
          <View style={styles.stepContainer}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <Text style={styles.stepText}>Hold your NFC tag near the device</Text>
          </View>
          <View style={styles.stepContainer}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>3</Text>
            </View>
            <Text style={styles.stepText}>Wait for the success message</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 20,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 5,
  },
  infoSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 15,
  },
  bulletSection: {
    marginTop: 10,
    marginBottom: 15,
  },
  bulletTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  bulletItem: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  bullet: {
    fontSize: 16,
    color: '#FF6B00',
    marginRight: 8,
    width: 20,
  },
  bulletText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
  },
  warningText: {
    fontSize: 14,
    color: '#E65100',
    marginLeft: 10,
    flex: 1,
  },
  platformInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
  },
  platformInfoText: {
    fontSize: 13,
    color: '#1565C0',
    marginLeft: 10,
    flex: 1,
    lineHeight: 18,
  },
  resultBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  successBox: {
    backgroundColor: '#E8F5E9',
  },
  errorBox: {
    backgroundColor: '#FFEBEE',
  },
  resultText: {
    fontSize: 14,
    marginLeft: 10,
    flex: 1,
  },
  successText: {
    color: '#2E7D32',
  },
  errorText: {
    color: '#C62828',
  },
  buttonContainer: {
    marginBottom: 30,
  },
  formatButton: {
    backgroundColor: '#FF6B00',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  formatButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 10,
  },
  formattingContainer: {
    alignItems: 'center',
    padding: 20,
  },
  formattingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 15,
    marginBottom: 20,
  },
  cancelButton: {
    paddingHorizontal: 30,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FF6B00',
  },
  cancelButtonText: {
    color: '#FF6B00',
    fontSize: 16,
  },
  instructionsSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  stepContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  stepNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FF6B00',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  stepNumberText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  stepText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
});

export default FormatTab;