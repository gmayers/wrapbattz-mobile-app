import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  SafeAreaView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
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
  // Using more properties from the auth context
  const { 
    deviceService, 
    axiosInstance,
    error: authError, 
    clearError, 
    userData, 
    logout,
    isLoading: authLoading
  } = useAuth();
  
  const [formData, setFormData] = useState({
    device_id: '',
    type: '',
    description: '',
  });
  const [photoUri, setPhotoUri] = useState(null);
  const [additionalPhotos, setAdditionalPhotos] = useState([]);
  const [signatureUri, setSignatureUri] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSignatureModal, setIsSignatureModal] = useState(false);
  const [devices, setDevices] = useState([]);
  const [deviceItems, setDeviceItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSections, setActiveSections] = useState([]);
  const [error, setError] = useState(null);
  const signatureRef = useRef(null);

  // Clear auth context errors when component unmounts
  useEffect(() => {
    return () => {
      if (authError) clearError();
    };
  }, [authError, clearError]);

  const fetchActiveDevices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Using deviceService from auth context
      const data = await deviceService.getMyActiveAssignments();
      const activeDevices = Array.isArray(data) 
        ? data.filter(assignment => !assignment.returned_date)
        : [];
        
      setDevices(activeDevices);

      const formattedDevices = activeDevices.map(item => ({
        label: `${item.device.identifier} - ${item.device.device_type}`,
        value: item.device.id
      }));

      if (formattedDevices.length === 0) {
        formattedDevices.unshift({ label: "No active devices", value: "" });
      }

      setDeviceItems(formattedDevices);

      if (activeDevices.length > 0 && activeDevices[0]?.device?.id) {
        setFormData(prev => ({ ...prev, device_id: activeDevices[0].device.id }));
      }
    } catch (error) {
      console.error('Error fetching devices:', error);

      // Skip 401 errors - they're handled globally by the axios interceptor
      if (error.response?.status !== 401) {
        setError('Failed to fetch devices. Please try again.');
        Alert.alert('Error', 'Failed to fetch devices');
      }
    } finally {
      setLoading(false);
    }
  }, [deviceService, logout]);

  useEffect(() => {
    fetchActiveDevices();
  }, [fetchActiveDevices]);

  const copyFileToPermanentStorage = useCallback(async (tempUri) => {
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
  }, []);

  const checkAndRequestPermissions = useCallback(async () => {
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
  }, []);

  const pickImage = useCallback(() => {
    Alert.alert('Choose Image', 'How would you like to choose the image?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Choose from Gallery', onPress: chooseMainPhotoFromGallery },
      { text: 'Take Photo', onPress: takeMainPhoto },
    ]);
  }, []);

  const takeMainPhoto = useCallback(async () => {
    try {
      if (await checkAndRequestPermissions()) {
        let result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.5,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
          const permURI = await copyFileToPermanentStorage(result.assets[0].uri);
          setPhotoUri(permURI);
        }
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo and save.');
    }
  }, [checkAndRequestPermissions, copyFileToPermanentStorage]);

  const chooseMainPhotoFromGallery = useCallback(async () => {
    try {
      if (await checkAndRequestPermissions()) {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.5,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
          const permURI = await copyFileToPermanentStorage(result.assets[0].uri);
          setPhotoUri(permURI);
        }
      }
    } catch (error) {
      console.error('Error selecting image from gallery:', error);
      Alert.alert('Error', 'Failed to select image from gallery.');
    }
  }, [checkAndRequestPermissions, copyFileToPermanentStorage]);

  const handleAddPhoto = useCallback(() => {
    Alert.alert('Choose Image', 'How would you like to choose the image?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Choose from Gallery', onPress: chooseAdditionalPhotoFromGallery },
      { text: 'Take Photo', onPress: takeAdditionalPhoto },
    ]);
  }, []);

  const takeAdditionalPhoto = useCallback(async () => {
    try {
      if (await checkAndRequestPermissions()) {
        let result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.5,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
          const permURI = await copyFileToPermanentStorage(result.assets[0].uri);
          setAdditionalPhotos(prev => {
            const updatedPhotos = [...prev, { uri: permURI }];
            setActiveSections([updatedPhotos.length - 1]);
            return updatedPhotos;
          });
        }
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo and save.');
    }
  }, [checkAndRequestPermissions, copyFileToPermanentStorage]);

  const chooseAdditionalPhotoFromGallery = useCallback(async () => {
    try {
      if (await checkAndRequestPermissions()) {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.5,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
          const permURI = await copyFileToPermanentStorage(result.assets[0].uri);
          setAdditionalPhotos(prev => {
            const updatedPhotos = [...prev, { uri: permURI }];
            setActiveSections([updatedPhotos.length - 1]);
            return updatedPhotos;
          });
        }
      }
    } catch (error) {
      console.error('Error selecting image from gallery:', error);
      Alert.alert('Error', 'Failed to select image from gallery.');
    }
  }, [checkAndRequestPermissions, copyFileToPermanentStorage]);

  const handleRemovePhoto = useCallback((index) => {
    setAdditionalPhotos(prev => prev.filter((_, i) => i !== index));
    setActiveSections([]);
  }, []);

  const toggleSection = useCallback((index) => {
    setActiveSections(prev =>
      prev.includes(index) ? [] : [index]
    );
  }, []);

  const saveSignatureAsFile = useCallback(async (base64Data) => {
    try {
      const fileName = `signature_${Date.now()}.png`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, base64Data, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return fileUri;
    } catch (error) {
      console.error('Error saving signature to file:', error);
      throw error;
    }
  }, []);

  const handleSignatureOK = useCallback(async (signature) => {
    try {
      const base64String = signature.replace('data:image/png;base64,', '');
      const fileUri = await saveSignatureAsFile(base64String);
      console.log('Signature saved as file:', fileUri);
      setSignatureUri(fileUri);
      setIsSignatureModal(false);
    } catch (error) {
      console.error('Error processing signature:', error);
      Alert.alert('Error', 'Failed to process signature. Please try again.');
    }
  }, [saveSignatureAsFile]);

  const handleSignatureClear = useCallback(() => {
    if (signatureRef.current && signatureRef.current.clearSignature) {
      signatureRef.current.clearSignature();
    }
  }, []);

  const handleSignatureClose = useCallback(() => {
    setIsSignatureModal(false);
  }, []);

  const validateForm = useCallback(() => {
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
  }, [formData]);

  const handleSubmit = useCallback(async () => {
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      // Format the report data according to the API expectations
      const reportData = {
        device_id: formData.device_id,
        type: formData.type,
        description: formData.description,
        report_date: new Date().toISOString().split('T')[0],
      };

      // Use the appropriate method to create a report
      // First, check if deviceService has a createReport method
      let reportResponse;
      if (typeof deviceService.createReport === 'function') {
        reportResponse = await deviceService.createReport(reportData);
      } else {
        // If not, use the axiosInstance directly as a fallback
        reportResponse = await axiosInstance.post('/reports/', reportData);
        reportResponse = reportResponse.data; // Extract data from axios response
      }
      
      const reportId = reportResponse.id;
      console.log('Report created successfully:', reportId);

      // Process photos using the deviceService.createDevicePhoto method
      const uploadPromises = [];

      if (photoUri) {
        const photoForm = new FormData();
        photoForm.append('image', {
          uri: photoUri,
          type: 'image/jpeg',
          name: 'photo.jpg',
        });
        photoForm.append('device', formData.device_id); // Using 'device' instead of 'device_id' based on API
        photoForm.append('report', reportId);
        
        try {
          // Check if deviceService has createDevicePhoto method
          if (typeof deviceService.createDevicePhoto === 'function') {
            // Check if deviceService has createDevicePhoto method
          if (typeof deviceService.createDevicePhoto === 'function') {
            uploadPromises.push(deviceService.createDevicePhoto(photoForm));
          } else {
            // Fallback to axiosInstance
            uploadPromises.push(axiosInstance.post('/device-photos/', photoForm));
          }
          } else {
            // Fallback to axiosInstance
            uploadPromises.push(axiosInstance.post('/device-photos/', photoForm));
          }
        } catch (error) {
          console.warn('Failed to upload main photo, but report was created:', error);
        }
      }

      // Process additional photos
      for (const photo of additionalPhotos) {
        const photoForm = new FormData();
        photoForm.append('image', {
          uri: photo.uri,
          type: 'image/jpeg',
          name: 'additional_photo.jpg',
        });
        photoForm.append('device', formData.device_id); // Using 'device' instead of 'device_id' based on API
        photoForm.append('report', reportId);
        
        try {
          uploadPromises.push(deviceService.createDevicePhoto(photoForm));
        } catch (error) {
          console.warn('Failed to upload an additional photo:', error);
        }
      }

      // Process signature if available
      if (signatureUri) {
        console.log('Preparing to upload signature as image');
        const signatureForm = new FormData();
        signatureForm.append('image', {
          uri: signatureUri,
          type: 'image/png',
          name: 'signature.png',
        });
        signatureForm.append('device', formData.device_id); // Using 'device' instead of 'device_id' based on API
        signatureForm.append('report', reportId);
        signatureForm.append('is_signature', true);
        
        try {
          // Check if deviceService has createDevicePhoto method
          if (typeof deviceService.createDevicePhoto === 'function') {
            uploadPromises.push(deviceService.createDevicePhoto(signatureForm));
          } else {
            // Fallback to axiosInstance
            uploadPromises.push(axiosInstance.post('/device-photos/', signatureForm));
          }
        } catch (error) {
          console.warn('Failed to upload signature as image:', error);
        }
      }

      // Wait for all uploads to complete
      await Promise.allSettled(uploadPromises);

      Alert.alert(
        'Success', 
        'Report submitted successfully',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error('Error submitting report:', error);

      // Skip 401 errors - they're handled globally by the axios interceptor
      if (error.response?.status !== 401) {
        const errorMsg = error.response?.data?.message || 'Failed to submit report. Please try again.';
        setError(errorMsg);
        Alert.alert('Error', errorMsg);
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [validateForm, formData, photoUri, additionalPhotos, signatureUri, deviceService, navigation, logout]);

  const renderTypeButton = useCallback((type, description) => (
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
  ), [formData.type]);

  // Handle auth errors
  if (authError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorMessage}>{authError}</Text>
        <Button
          title="Try Again"
          onPress={() => {
            clearError();
            fetchActiveDevices();
          }}
          size="medium"
        />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.formContainer}>
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{error}</Text>
          <TouchableOpacity onPress={() => setError(null)}>
            <Ionicons name="close-circle" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}
      
      <View style={styles.formHeader}>
        <Text style={styles.formTitle}>Create Report</Text>
        {userData?.name && (
          <Text style={styles.userInfo}>Reporting as: {userData.name}</Text>
        )}
      </View>
      
      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>Device</Text>
        {loading || authLoading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading devices...</Text>
          </View>
        ) : (
          <Dropdown
            label=""
            placeholder="Select a device"
            value={formData.device_id}
            onValueChange={(value) => setFormData(prev => ({ ...prev, device_id: value }))}
            items={deviceItems}
            containerStyle={styles.dropdownContainer}
            disabled={deviceItems.length === 0}
          />
        )}
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
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Main Photo</Text>
          <TouchableOpacity onPress={() => Alert.alert('Main Photo', 'This photo will be the primary image associated with this report.')}>
            <Ionicons name="information-circle-outline" size={18} color="#666" />
          </TouchableOpacity>
        </View>
        <Button
          title={photoUri ? "Change Main Photo" : "Add Main Photo"}
          onPress={pickImage}
          variant="outlined"
          size="small"
        />
        {photoUri && (
          <Image source={{ uri: photoUri }} style={styles.previewImage} />
        )}
      </View>

      <View style={styles.photosSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Additional Photos</Text>
          <TouchableOpacity onPress={() => Alert.alert('Additional Photos', 'Add more photos to provide complete documentation of the issue.')}>
            <Ionicons name="information-circle-outline" size={18} color="#666" />
          </TouchableOpacity>
        </View>
        
        {additionalPhotos.map((photo, index) => (
          <View key={index} style={styles.photoItem}>
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
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Signature</Text>
          <TouchableOpacity onPress={() => Alert.alert('Signature', 'Your signature confirms that the information in this report is accurate to the best of your knowledge.')}>
            <Ionicons name="information-circle-outline" size={18} color="#666" />
          </TouchableOpacity>
        </View>
        <Button
          title={signatureUri ? "Edit Signature" : "Add Signature"}
          onPress={() => setIsSignatureModal(true)}
          variant="outlined"
          size="small"
        />
        {signatureUri && (
          <Image
            source={{ uri: signatureUri }}
            style={styles.signaturePreview}
          />
        )}
      </View>

      <View style={styles.buttonContainer}>
        <Button
          title={isSubmitting ? "Submitting..." : "Submit Report"}
          onPress={handleSubmit}
          disabled={isSubmitting || loading || authLoading}
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
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Signature</Text>
              <TouchableOpacity onPress={handleSignatureClose}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <View style={styles.signatureCanvasContainer}>
              <SignatureScreen
                ref={signatureRef}
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
                onPress={() => signatureRef.current?.readSignature()}
                style={styles.signatureButton}
              />
              <Button
                title="Clear"
                onPress={handleSignatureClear}
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  formContainer: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    flex: 1,
  },
  formHeader: {
    marginBottom: 20,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  userInfo: {
    fontSize: 14,
    color: '#666',
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
    marginTop: 0,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  typeGridItem: {
    width: '50%',
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
    flex: 0.85,
    lineHeight: 16,
  },
  typeButtonTextSelected: {
    color: '#007AFF',
  },
  infoButtonContainer: {
    flex: 0.15,
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  photoItem: {
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  photoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#F5F5F5',
  },
  photoHeaderText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  removeText: {
    color: '#EF4444',
    fontWeight: '600',
  },
  photoContent: {
    padding: 10,
    backgroundColor: '#FFFFFF',
  },
  photoImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  },
  addPhotoButton: {
    marginTop: 10,
  },
  signatureSection: {
    marginVertical: 20,
  },
  signaturePreview: {
    width: '100%',
    height: 200,
    marginTop: 10,
    borderRadius: 8,
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
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
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
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  signatureCanvas: {
    flex: 1,
    width: '100%',
    height: '100%',
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
  // Error and loading styles
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F5F5F5',
  },
  errorMessage: {
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 20,
  },
  errorBanner: {
    backgroundColor: '#EF4444',
    padding: 10,
    borderRadius: 8,
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorBannerText: {
    color: '#FFFFFF',
    fontSize: 14,
    flex: 1,
  },
  loadingContainer: {
    padding: 15,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    alignItems: 'center',
  },
  loadingText: {
    color: '#666',
    fontSize: 14,
  },
});

export default CreateReportScreen;