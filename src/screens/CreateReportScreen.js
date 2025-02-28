// CreateReportScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  Modal,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { Ionicons } from '@expo/vector-icons';
import Button from '../components/Button';
import { BaseTextInput } from '../components/TextInput';
import SignatureScreen from 'react-native-signature-canvas';
import { useAuth } from '../context/AuthContext';
import Dropdown from '../components/Dropdown';
import RNFS from 'react-native-fs';

const REPORT_TYPES = {
  DAMAGED: "Device is physically damaged or broken",
  STOLEN: "Device has been stolen or is missing under suspicious circumstances",
  LOST: "Device cannot be located but no suspicion of theft",
  MALFUNCTIONING: "Device is not working correctly but shows no physical damage",
  MAINTENANCE: "Device needs routine maintenance or inspection",
  OTHER: "Other issues not covered by other categories"
};

const CreateReportScreen = ({ navigation, route }) => {
  const { axiosInstance, logout, deviceService } = useAuth();
  const [formData, setFormData] = useState({
    device_id: '',
    type: '',
    description: '',
    photo: null,
    signature: null,
  });
  const [photoUri, setPhotoUri] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSignatureModal, setIsSignatureModal] = useState(false);
  const [devices, setDevices] = useState([]);
  const [deviceItems, setDeviceItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSections, setActiveSections] = useState([]);

  useEffect(() => {
    // Fetch active devices when component mounts
    fetchActiveDevices();
  }, []);

  const fetchActiveDevices = async () => {
    try {
      setLoading(true);
      const data = await deviceService.getAssignments();
      const activeDevices = data.filter(assignment => !assignment.returned_date);
      setDevices(activeDevices);
      
      // Format devices for Dropdown component
      const formattedDevices = activeDevices.map(item => ({
        label: `${item.device.identifier} - ${item.device.device_type}`,
        value: item.device.id
      }));
      
      // Add a placeholder item if needed
      if (formattedDevices.length === 0) {
        formattedDevices.unshift({ label: "No active devices", value: "" });
      }
      
      setDeviceItems(formattedDevices);
      
      if (activeDevices.length > 0 && activeDevices[0]?.device?.id) {
        setFormData(prev => ({ ...prev, device_id: activeDevices[0].device.id }));
      }
    } catch (error) {
      console.error('Error fetching devices:', error);
      Alert.alert('Error', 'Failed to fetch devices');
    } finally {
      setLoading(false);
    }
  };

  const copyFileToPermanentStorage = async (tempUri) => {
    try {
      const filename = tempUri.split('/').pop();
      const permanentUri = `${RNFS.DocumentDirectoryPath}/${filename}`;
      await RNFS.copyFile(tempUri, permanentUri);

      const accessibleUri = permanentUri.startsWith('file://')
        ? permanentUri
        : `file://${permanentUri}`;

      return accessibleUri;
    } catch (error) {
      console.error('Error copying file:', error);
      throw error;
    }
  };

  const checkAndRequestPermissions = async () => {
    const cameraPermission = await ImagePicker.getCameraPermissionsAsync();
    const mediaLibraryPermission = await MediaLibrary.getPermissionsAsync();

    if (
      cameraPermission.status !== 'granted' ||
      mediaLibraryPermission.status !== 'granted'
    ) {
      const newCameraPermission = await ImagePicker.requestCameraPermissionsAsync();
      const newMediaLibraryPermission = await MediaLibrary.requestPermissionsAsync();

      return (
        newCameraPermission.status === 'granted' &&
        newMediaLibraryPermission.status === 'granted'
      );
    }
    return true;
  };

  // Main photo picker
  const pickImage = () => {
    Alert.alert('Choose Image', 'How would you like to choose the image?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Choose from Gallery', onPress: chooseMainPhotoFromGallery },
      { text: 'Take Photo', onPress: takeMainPhoto },
    ]);
  };

  const takeMainPhoto = async () => {
    try {
      if (await checkAndRequestPermissions()) {
        let result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.5, // Reduced quality for faster uploads
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
          const asset = await MediaLibrary.createAssetAsync(result.assets[0].uri);
          const permURI = await copyFileToPermanentStorage(result.assets[0].uri);
          
          setPhotoUri(permURI);
          setFormData(prev => ({ ...prev, photo: permURI }));
        }
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo and save to gallery.');
    }
  };

  const chooseMainPhotoFromGallery = async () => {
    try {
      if (await checkAndRequestPermissions()) {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.5, // Reduced quality for faster uploads
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
          const permURI = await copyFileToPermanentStorage(result.assets[0].uri);
          
          setPhotoUri(permURI);
          setFormData(prev => ({ ...prev, photo: permURI }));
        }
      }
    } catch (error) {
      console.error('Error selecting image from gallery:', error);
      Alert.alert('Error', 'Failed to select image from gallery.');
    }
  };

  // Additional photos functions
  const handleAddPhoto = () => {
    Alert.alert('Choose Image', 'How would you like to choose the image?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Choose from Gallery', onPress: chooseAdditionalPhotoFromGallery },
      { text: 'Take Photo', onPress: takeAdditionalPhoto },
    ]);
  };

  const takeAdditionalPhoto = async () => {
    try {
      if (await checkAndRequestPermissions()) {
        let result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.5, // Reduced quality for faster uploads
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
          const asset = await MediaLibrary.createAssetAsync(result.assets[0].uri);
          const permURI = await copyFileToPermanentStorage(result.assets[0].uri);
          
          const updatedPhotos = [...photos, { uri: permURI }];
          setPhotos(updatedPhotos);
          setActiveSections([updatedPhotos.length - 1]);
        }
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo and save to gallery.');
    }
  };

  const chooseAdditionalPhotoFromGallery = async () => {
    try {
      if (await checkAndRequestPermissions()) {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.5, // Reduced quality for faster uploads
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
          const permURI = await copyFileToPermanentStorage(result.assets[0].uri);
          
          const updatedPhotos = [...photos, { uri: permURI }];
          setPhotos(updatedPhotos);
          setActiveSections([updatedPhotos.length - 1]);
        }
      }
    } catch (error) {
      console.error('Error selecting image from gallery:', error);
      Alert.alert('Error', 'Failed to select image from gallery.');
    }
  };

  const handleRemovePhoto = (index) => {
    const updatedPhotos = photos.filter((_, i) => i !== index);
    setPhotos(updatedPhotos);
    setActiveSections([]);
  };

  const toggleSection = (index) => {
    setActiveSections(prev =>
      prev.includes(index) ? [] : [index]
    );
  };

  // Signature canvas handling
  const handleSignatureOK = (signature) => {
    // For the example we're changing from base64 to a file-based approach
    // In a real implementation, you would save this as a file instead
    const base64String = signature.replace('data:image/png;base64,', '');
    setFormData(prev => ({ ...prev, signature: base64String }));
    setIsSignatureModal(false);
  };

  const handleSignatureClear = (ref) => {
    if (ref && ref.clearSignature) {
      ref.clearSignature();
    }
  };

  const handleSignatureClose = () => {
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

      // Upload additional photos (if any)
      for (const photo of photos) {
        const photoForm = new FormData();
        photoForm.append('image', {
          uri: photo.uri,
          type: 'image/jpeg',
          name: 'additional_photo.jpg',
        });
        photoForm.append('device', formData.device_id);
        photoForm.append('report', reportData.id);
        try {
          await axiosInstance.post('/device-photos/', photoForm, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        } catch (error) {
          console.warn('Failed to upload an additional photo');
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
      }}
    >
      <Text style={[
        styles.typeButtonText,
        formData.type === type && styles.typeButtonTextSelected,
      ]} numberOfLines={2}>
        {type}
      </Text>
      <TouchableOpacity 
        style={styles.infoButtonContainer}
        onPress={() => Alert.alert(type, description)}
      >
        <Ionicons
          name="information-circle-outline"
          size={18}
          color={formData.type === type ? '#007AFF' : '#666'}
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  // Create report type items for a dropdown if needed
  const reportTypeItems = Object.entries(REPORT_TYPES).map(([type, description]) => ({
    label: type,
    value: type
  }));

  return (
    <ScrollView style={styles.formContainer}>
      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>Device</Text>
        <Dropdown
          label=""
          placeholder="Select a device"
          value={formData.device_id}
          onValueChange={(value) => setFormData(prev => ({ ...prev, device_id: value }))}
          items={deviceItems}
          containerStyle={styles.dropdownContainer}
          disabled={loading || deviceItems.length === 0}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>Report Type</Text>
        <View style={styles.typeGrid}>
          {Object.entries(REPORT_TYPES).map(([type, description], index) => (
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

      <View style={styles.photosSection}>
        <Text style={styles.sectionTitle}>Photos</Text>
        {photos.map((photo, index) => (
          <View key={index}>
            <TouchableOpacity onPress={() => toggleSection(index)}>
              <View style={styles.photoHeader}>
                <Text style={styles.photoHeaderText}>
                  {activeSections.includes(index) ? '▲' : '▼'} Photo {index + 1}
                </Text>
                <TouchableOpacity onPress={() => handleRemovePhoto(index)}>
                  <Text style={styles.removeText}>Remove</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
            {activeSections.includes(index) && (
              <View style={styles.photoContent}>
                <Image source={{ uri: photo.uri }} style={styles.photoImage} />
              </View>
            )}
          </View>
        ))}
        <Button
          title="Add Photo"
          onPress={handleAddPhoto}
          variant="outlined"
          size="small"
          style={styles.addPhotoButton}
        />
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
            <View style={styles.signatureCanvasContainer}>
              <SignatureScreen
                ref={(ref) => (this.signatureRef = ref)}
                onOK={handleSignatureOK}
                onEmpty={() => console.log('Empty signature')}
                webStyle={`
                  .m-signature-pad { box-shadow: none; border: none; }
                  .m-signature-pad--body { border: none; }
                  .m-signature-pad--footer { margin: 0px; }
                  body, html { width: 100%; height: 100%; }
                `}
                backgroundColor="#F5F5F5"
                style={styles.signatureCanvas}
              />
            </View>
            <View style={styles.signatureButtonRow}>
              <Button
                title="OK"
                onPress={() => this.signatureRef.readSignature()}
                style={styles.signatureButton}
              />
              <Button
                title="Clear"
                onPress={() => handleSignatureClear(this.signatureRef)}
                variant="outlined"
                style={styles.signatureButton}
              />
            </View>
            <View style={styles.closeButtonRow}>
              <Button
                title="Close"
                onPress={handleSignatureClose}
                variant="outlined"
                style={styles.closeButton}
              />
            </View>
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
  dropdownContainer: {
    marginTop: 0, // Adjust if needed
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  typeGridItem: {
    width: '50%', // 2 columns
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
    flex: 0.85, // 85% of the space
    lineHeight: 16,
  },
  typeButtonTextSelected: {
    color: '#007AFF',
  },
  infoButtonContainer: {
    flex: 0.15, // 15% of the space
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
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
  photosSection: {
    marginVertical: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  photoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  photoHeaderText: {
    flex: 1,
    fontSize: 16,
  },
  removeText: {
    color: 'red',
  },
  photoContent: {
    padding: 10,
    backgroundColor: '#f1f1f1',
  },
  photoImage: {
    width: '100%',
    height: 200,
  },
  addPhotoButton: {
    marginTop: 10,
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
  signatureCanvasContainer: {
    flex: 1,
    marginBottom: 10,
  },
  signatureCanvas: {
    flex: 1,
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  signatureButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  signatureButton: {
    flex: 1,
    marginHorizontal: 5,
  },
  closeButtonRow: {
    width: '100%',
  },
  closeButton: {
    width: '100%',
  },
});

export default CreateReportScreen;