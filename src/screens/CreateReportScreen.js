// CreateReportScreen.js
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import Button from '../components/Button';
import { BaseTextInput } from '../components/TextInput';
import SignatureScreen from 'react-native-signature-canvas';
import ImagePickerButton from '../components/ImagePickerButton';
import { useAuth } from '../context/AuthContext';

const REPORT_TYPES = {
  DAMAGED: "Device is physically damaged or broken",
  STOLEN: "Device has been stolen or is missing under suspicious circumstances",
  LOST: "Device cannot be located but no suspicion of theft",
  MALFUNCTIONING: "Device is not working correctly but shows no physical damage",
  MAINTENANCE: "Device needs routine maintenance or inspection",
  OTHER: "Other issues not covered by other categories"
};

const CreateReportScreen = ({ navigation }) => {
  const { axiosInstance, logout } = useAuth();
  const [formData, setFormData] = useState({
    device_id: '',
    type: '',
    description: '',
    photo: null,
    signature: null,
  });
  const [photoUri, setPhotoUri] = useState(null);
  const [extraPhotos, setExtraPhotos] = useState([]);
  const [activeSections, setActiveSections] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSignatureModal, setIsSignatureModal] = useState(false);

  // Main photo picker
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

  // Extra photos accordion
  const handleExtraPhotoSelected = (newPhotoUri) => {
    const updatedPhotos = [...extraPhotos, { uri: newPhotoUri, extraComment: '' }];
    setExtraPhotos(updatedPhotos);
    setActiveSections([updatedPhotos.length - 1]);
  };

  const handleRemoveExtraPhoto = (index) => {
    const updatedPhotos = extraPhotos.filter((_, i) => i !== index);
    setExtraPhotos(updatedPhotos);
    setActiveSections([]);
  };

  const toggleExtraPhotoSection = (index) => {
    setActiveSections(prev =>
      prev.includes(index) ? [] : [index]
    );
  };

  const updateExtraPhotoComment = (index, text) => {
    const updatedPhotos = extraPhotos.map((photo, i) =>
      i === index ? { ...photo, extraComment: text } : photo
    );
    setExtraPhotos(updatedPhotos);
  };

  // Signature canvas handling
  const handleSignatureOK = (signature) => {
    const base64String = signature.replace('data:image/png;base64,', '');
    setFormData(prev => ({ ...prev, signature: base64String }));
    setIsSignatureModal(false);
  };

  const handleSignatureEmpty = () => {
    setIsSignatureModal(false);
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
      // Create the report
      const reportResponse = await axiosInstance.post('/reports/', {
        ...formData,
        status: 'OPEN',
        report_date: new Date().toISOString().split('T')[0],
      });
      const reportData = reportResponse.data;

      // Upload main photo if exists
      if (photoUri) {
        const photoForm = new FormData();
        photoForm.append('image', {
          uri: photoUri,
          type: 'image/jpeg',
          name: 'photo.jpg',
        });
        photoForm.append('device', formData.device_id);
        photoForm.append('report', reportData.id);
        try {
          await axiosInstance.post('/device-photos/', photoForm, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        } catch (error) {
          console.warn('Failed to upload main photo, but report was created');
        }
      }

      // Upload extra photos (if any)
      for (const extraPhoto of extraPhotos) {
        const extraPhotoForm = new FormData();
        extraPhotoForm.append('image', {
          uri: extraPhoto.uri,
          type: 'image/jpeg',
          name: 'extra_photo.jpg',
        });
        extraPhotoForm.append('device', formData.device_id);
        extraPhotoForm.append('report', reportData.id);
        extraPhotoForm.append('extraComment', extraPhoto.extraComment || '');
        try {
          await axiosInstance.post('/device-photos/', extraPhotoForm, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        } catch (error) {
          console.warn('Failed to upload an extra photo');
        }
      }

      Alert.alert('Success', 'Report submitted successfully');
      navigation.goBack();
    } catch (error) {
      console.error('Error submitting report:', error);
      if (error.response && error.response.status === 401) {
        Alert.alert('Session Expired', 'Please login again');
        logout();
      } else {
        Alert.alert('Error', 'Failed to submit report. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render report type buttons
  const renderTypeButton = (type, description) => (
    <TouchableOpacity
      key={type}
      style={[
        styles.typeButtonGrid,
        formData.type === type && styles.typeButtonSelected,
      ]}
      onPress={() => {
        setFormData(prev => ({ ...prev, type }));
        Alert.alert(type, description);
      }}
    >
      <Text style={[
        styles.typeButtonText,
        formData.type === type && styles.typeButtonTextSelected,
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
        {/* TODO: Add your device selection dropdown here */}
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
        onChangeText={text => setFormData(prev => ({ ...prev, description: text }))}
        placeholder="Enter description"
        multiline
        numberOfLines={4}
        style={styles.formInput}
      />

      <View style={styles.photoSection}>
        <Button
          title="Add Main Photo"
          onPress={pickImage}
          variant="outlined"
          size="small"
        />
        {photoUri && (
          <Image source={{ uri: photoUri }} style={styles.previewImage} />
        )}
      </View>

      <View style={styles.extraPhotosSection}>
        <Text style={styles.sectionTitle}>Extra Photos</Text>
        {extraPhotos.map((photo, index) => (
          <View key={index}>
            <TouchableOpacity onPress={() => toggleExtraPhotoSection(index)}>
              <View style={styles.extraPhotoHeader}>
                <Text style={styles.extraPhotoHeaderText}>
                  {activeSections.includes(index) ? '▲' : '▼'} Photo {index + 1}
                </Text>
                <TouchableOpacity onPress={() => handleRemoveExtraPhoto(index)}>
                  <Text style={styles.removeText}>Remove</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
            {activeSections.includes(index) && (
              <View style={styles.extraPhotoContent}>
                <Image source={{ uri: photo.uri }} style={styles.extraPhotoImage} />
                <TextInput
                  style={styles.extraPhotoComment}
                  onChangeText={text => updateExtraPhotoComment(index, text)}
                  value={photo.extraComment}
                  multiline
                  numberOfLines={3}
                  placeholder="Add comment"
                />
              </View>
            )}
          </View>
        ))}
        <Text style={styles.sectionText}>Any more extra photos?</Text>
        <ImagePickerButton onImageSelected={handleExtraPhotoSelected} />
      </View>

      <View style={styles.signatureSection}>
        <Button
          title={formData.signature ? "Edit Signature" : "Add Signature"}
          onPress={() => setIsSignatureModal(true)}
          variant="outlined"
          size="small"
        />
        {formData.signature && (
          <Image
            source={{ uri: `data:image/png;base64,${formData.signature}` }}
            style={styles.signaturePreview}
          />
        )}
      </View>

      <View style={styles.buttonContainer}>
        <Button
          title="Submit Report"
          onPress={handleSubmit}
          disabled={isSubmitting}
        />
      </View>

      <Modal
        animationType="slide"
        transparent={true}
        visible={isSignatureModal}
        onRequestClose={() => setIsSignatureModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalInnerContainer}>
            <SignatureScreen
              onOK={handleSignatureOK}
              onEmpty={handleSignatureEmpty}
              webStyle={`
                .m-signature-pad { box-shadow: none; border: none; }
                .m-signature-pad--body { border: none; }
                .m-signature-pad--footer { margin: 0px; }
                body, html { width: 100%; height: 100%; }
              `}
              backgroundColor="#F5F5F5"
              style={styles.signatureCanvas}
            />
            <Button
              title="Close"
              onPress={() => setIsSignatureModal(false)}
            />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  formContainer: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    flex: 1,
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
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    borderRadius: 5,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
  extraPhotosSection: {
    marginVertical: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  extraPhotoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  extraPhotoHeaderText: {
    flex: 1,
    fontSize: 16,
  },
  removeText: {
    color: 'red',
  },
  extraPhotoContent: {
    padding: 10,
    backgroundColor: '#f1f1f1',
  },
  extraPhotoImage: {
    width: '100%',
    height: 200,
  },
  extraPhotoComment: {
    borderColor: 'gray',
    borderWidth: 1,
    marginVertical: 10,
    padding: 10,
    borderRadius: 5,
  },
  sectionText: {
    textAlign: 'center',
    fontSize: 16,
    marginVertical: 10,
  },
  signatureSection: {
    marginVertical: 20,
    alignItems: 'center',
  },
  signaturePreview: {
    width: '100%',
    height: 200,
    marginTop: 10,
  },
  buttonContainer: {
    marginVertical: 20,
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalInnerContainer: {
    width: '90%',
    height: '70%',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  signatureCanvas: {
    flex: 1,
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
});

export default CreateReportScreen;
