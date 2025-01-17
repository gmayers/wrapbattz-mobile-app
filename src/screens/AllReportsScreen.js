// AllReportsScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import Button from '../components/Button';
import Card from '../components/Card';
import CustomModal from '../components/Modal';
import { BaseTextInput } from '../components/TextInput';

// Reuse the report types from ReportsScreen
const REPORT_TYPES = {
  DAMAGED: "Device is physically damaged or broken",
  STOLEN: "Device has been stolen or is missing under suspicious circumstances",
  LOST: "Device cannot be located but no suspicion of theft",
  MALFUNCTIONING: "Device is not working correctly but shows no physical damage",
  MAINTENANCE: "Device needs routine maintenance or inspection",
  OTHER: "Other issues not covered by other categories"
};

// Report Form Component
const ReportForm = ({ onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    device_id: '',
    type: '',
    description: '',
    photo: null
  });
  const [photoUri, setPhotoUri] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });

      if (!result.canceled) {
        setPhotoUri(result.assets[0].uri);
        setFormData(prev => ({ ...prev, photo: result.assets[0].uri }));
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  const validateForm = () => {
    if (!formData.device_id) {
      Alert.alert('Error', 'Please select a device');
      return false;
    }
    if (!formData.type) {
      Alert.alert('Error', 'Please select a report type');
      return false;
    }
    if (!formData.description) {
      Alert.alert('Error', 'Please enter a description');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      
      const reportResponse = await fetch('https://test.gmayersservices.com/api/reports/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          status: 'OPEN',
          report_date: new Date().toISOString().split('T')[0],
        }),
      });

      if (!reportResponse.ok) {
        throw new Error(`Failed to create report: ${reportResponse.status}`);
      }

      const reportData = await reportResponse.json();

      if (photoUri) {
        const photoForm = new FormData();
        photoForm.append('image', {
          uri: photoUri,
          type: 'image/jpeg',
          name: 'photo.jpg',
        });
        photoForm.append('device', formData.device_id);
        photoForm.append('report', reportData.id);

        const photoResponse = await fetch('https://test.gmayersservices.com/api/device-photos/', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
          body: photoForm,
        });

        if (!photoResponse.ok) {
          console.warn('Failed to upload photo, but report was created');
        }
      }

      onSubmit();
      Alert.alert('Success', 'Report submitted successfully');
    } catch (error) {
      console.error('Error submitting report:', error);
      Alert.alert('Error', 'Failed to submit report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderTypeButton = (type, description) => (
    <TouchableOpacity
      key={type}
      style={[
        styles.typeButtonGrid,
        formData.type === type && styles.typeButtonSelected
      ]}
      onPress={() => {
        setFormData(prev => ({ ...prev, type }));
        Alert.alert(type, description);
      }}
    >
      <Text style={[
        styles.typeButtonText,
        formData.type === type && styles.typeButtonTextSelected
      ]} numberOfLines={2}>
        {type}
      </Text>
      <Ionicons 
        name="information-circle-outline" 
        size={18} 
        color={formData.type === type ? '#007AFF' : '#666'}
        style={styles.typeButtonIcon}
      />
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.formContainer}>
      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>Device</Text>
        {/* Device dropdown component will go here */}
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>Report Type</Text>
        <View style={styles.typeGrid}>
          {Object.entries(REPORT_TYPES).map(([type, description]) => (
            <View key={type} style={styles.typeGridItem}>
              {renderTypeButton(type, description)}
            </View>
          ))}
        </View>
      </View>

      <BaseTextInput
        label="Description"
        value={formData.description}
        onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
        placeholder="Enter description"
        multiline
        numberOfLines={4}
        style={styles.formInput}
      />

      <View style={styles.photoSection}>
        <Button
          title="Add Photo"
          onPress={pickImage}
          variant="outlined"
          size="small"
        />
        {photoUri && (
          <Image source={{ uri: photoUri }} style={styles.previewImage} />
        )}
      </View>

      <View style={styles.buttonContainer}>
        <Button
          title="Cancel"
          onPress={onCancel}
          variant="outlined"
          style={styles.buttonMargin}
          disabled={isSubmitting}
        />
        <Button
          title={isSubmitting ? "Submitting..." : "Submit"}
          onPress={handleSubmit}
          disabled={isSubmitting}
        />
      </View>
    </ScrollView>
  );
};

const AllReportsScreen = ({ navigation }) => {
  // ... rest of your existing AllReportsScreen code ...
};

const styles = StyleSheet.create({
  // Your existing styles
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backText: {
    fontSize: 17,
    color: '#007AFF',
    marginLeft: 4,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: 15,
  },
  reportCard: {
    marginBottom: 10,
  },
  reportContent: {
    gap: 4,
  },
  reportText: {
    fontSize: 14,
    color: '#666',
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    marginTop: 20,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    marginTop: 20,
  },
  modalHeaderOverride: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomColor: '#eee',
    borderBottomWidth: 1,
    paddingVertical: 15,
  },

  // Added Report Form Styles
  formContainer: {
    padding: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  formInput: {
    fontSize: 16,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    marginHorizontal: -4,
  },
  typeGridItem: {
    width: '33.33%',
    padding: 4,
  },
  typeButtonGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#F5F5F5',
    height: 60,
    minWidth: '100%',
  },
  typeButtonSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#E3F2FD',
  },
  typeButtonText: {
    fontSize: 10,
    color: '#333',
    fontWeight: '500',
    flex: 1,
    lineHeight: 16,
  },
  typeButtonTextSelected: {
    color: '#007AFF',
  },
  typeButtonIcon: {
    marginLeft: 2,
  },
  photoSection: {
    marginVertical: 20,
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    marginTop: 10,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 20,
    paddingBottom: 20,
  },
  buttonMargin: {
    marginRight: 10,
  },
});

export default AllReportsScreen;