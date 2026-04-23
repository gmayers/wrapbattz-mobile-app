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
  Platform
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { Ionicons } from '@expo/vector-icons';
import Button from '../components/Button';
import { BaseTextInput } from '../components/TextInput';
import SignatureScreen from 'react-native-signature-canvas';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import Dropdown from '../components/Dropdown';
import RNFS from 'react-native-fs';
import {
  assignments as assignmentsApi,
  incidents as incidentsApi,
  toolPhotos as toolPhotosApi
} from '../api/endpoints';
import { toLegacyAssignment } from '../api/adapters';
import { ApiError } from '../api/errors';

const REPORT_TYPES = {
  DAMAGED: "Device is physically damaged or broken",
  STOLEN: "Device has been stolen or is missing under suspicious circumstances",
  LOST: "Device cannot be located but no suspicion of theft",
  MALFUNCTIONING: "Device is not working correctly but shows no physical damage",
  MAINTENANCE: "Device needs routine maintenance or inspection",
  OTHER: "Other issues not covered by other categories"
};

const CreateReportScreen = ({ navigation, route }) => {
  const { userData, isLoading: authLoading } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [formData, setFormData] = useState({
    device_id: '',
    type: '',
    description: ''
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
  const signatureDataRef = useRef(null);
  const isAutoCapture = useRef(false);

  const fetchActiveDevices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const rawList = await assignmentsApi.listMyActiveAssignments();
      const activeDevices = rawList
        .map(toLegacyAssignment)
        .filter((assignment) => !assignment.returned_date);

      setDevices(activeDevices);

      const formattedDevices = activeDevices.map((item) => ({
        label: `${item.device.identifier}${item.device.device_type ? ` - ${item.device.device_type}` : ''}`,
        value: item.device.id
}));

      if (formattedDevices.length === 0) {
        formattedDevices.unshift({ label: 'No active devices', value: '' });
      }

      setDeviceItems(formattedDevices);

      if (activeDevices.length > 0 && activeDevices[0]?.device?.id) {
        setFormData((prev) => ({ ...prev, device_id: activeDevices[0].device.id }));
      }
    } catch (error) {
      if (!(error instanceof ApiError && error.code === 'unauthorized')) {
        setError('Failed to fetch devices. Please try again.');
        Alert.alert('Error', 'Failed to fetch devices');
      }
    } finally {
      setLoading(false);
    }
  }, []);

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
      console.log('📷 [CreateReport] Taking main photo...');
      if (await checkAndRequestPermissions()) {
        let result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.5
});

        console.log('📷 [CreateReport] Camera result:', {
          canceled: result.canceled,
          assetCount: result.assets?.length || 0
});

        if (!result.canceled && result.assets && result.assets.length > 0) {
          const imageAsset = result.assets[0];
          console.log('📷 [CreateReport] Main photo captured:', {
            uri: imageAsset.uri,
            width: imageAsset.width,
            height: imageAsset.height,
            mimeType: imageAsset.mimeType,
            fileSize: imageAsset.fileSize ? `${(imageAsset.fileSize / 1024).toFixed(2)} KB` : 'unknown'
});

          const permURI = await copyFileToPermanentStorage(imageAsset.uri);
          console.log('📷 [CreateReport] Main photo stored at:', permURI);
          setPhotoUri(permURI);
        }
      }
    } catch (error) {
      console.error('❌ [CreateReport] Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo and save.');
    }
  }, [checkAndRequestPermissions, copyFileToPermanentStorage]);

  const chooseMainPhotoFromGallery = useCallback(async () => {
    try {
      console.log('🖼️ [CreateReport] Opening gallery for main photo...');
      if (await checkAndRequestPermissions()) {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.5
});

        console.log('🖼️ [CreateReport] Gallery result:', {
          canceled: result.canceled,
          assetCount: result.assets?.length || 0
});

        if (!result.canceled && result.assets && result.assets.length > 0) {
          const imageAsset = result.assets[0];
          console.log('🖼️ [CreateReport] Main photo selected:', {
            uri: imageAsset.uri,
            width: imageAsset.width,
            height: imageAsset.height,
            mimeType: imageAsset.mimeType,
            fileSize: imageAsset.fileSize ? `${(imageAsset.fileSize / 1024).toFixed(2)} KB` : 'unknown'
});

          const permURI = await copyFileToPermanentStorage(imageAsset.uri);
          console.log('🖼️ [CreateReport] Main photo stored at:', permURI);
          setPhotoUri(permURI);
        }
      }
    } catch (error) {
      console.error('❌ [CreateReport] Error selecting image from gallery:', error);
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
          mediaTypes: ['images'],
          quality: 0.5
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
          mediaTypes: ['images'],
          quality: 0.5
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
      const filePath = `${RNFS.DocumentDirectoryPath}/${fileName}`;
      await RNFS.writeFile(filePath, base64Data, 'base64');
      return `file://${filePath}`;
    } catch (error) {
      console.error('Error saving signature to file:', error);
      throw error;
    }
  }, []);

  const processSignatureData = useCallback(async (signature) => {
    if (!signature || typeof signature !== 'string') {
      return null;
    }

    // Handle both formats: full data URI or raw base64
    const base64String = signature.includes('base64,')
      ? signature.split('base64,')[1]
      : signature;

    if (!base64String) {
      return null;
    }

    return await saveSignatureAsFile(base64String);
  }, [saveSignatureAsFile]);

  const handleSignatureOK = useCallback(async (signature) => {
    // Auto-capture mode: just cache the data, don't close modal
    if (isAutoCapture.current) {
      isAutoCapture.current = false;
      if (signature && typeof signature === 'string') {
        signatureDataRef.current = signature;
      }
      return;
    }

    try {
      // Try the signature data from the callback first, fall back to cached data
      const signatureData = (signature && typeof signature === 'string')
        ? signature
        : signatureDataRef.current;

      if (!signatureData) {
        Alert.alert('Error', 'No signature data received. Please draw your signature and try again.');
        return;
      }

      const fileUri = await processSignatureData(signatureData);
      if (!fileUri) {
        Alert.alert('Error', 'Invalid signature data. Please try again.');
        return;
      }

      console.log('Signature saved as file:', fileUri);
      setSignatureUri(fileUri);
      setIsSignatureModal(false);
      signatureDataRef.current = null;
    } catch (error) {
      console.error('Error processing signature:', error);
      Alert.alert('Error', 'Failed to process signature. Please try again.');
    }
  }, [processSignatureData]);

  // Auto-capture signature data after each stroke ends
  const handleSignatureEnd = useCallback(() => {
    isAutoCapture.current = true;
    setTimeout(() => {
      signatureRef.current?.readSignature();
    }, 100);
  }, []);

  const handleSignatureClear = useCallback(() => {
    if (signatureRef.current && signatureRef.current.clearSignature) {
      signatureRef.current.clearSignature();
    }
    signatureDataRef.current = null;
  }, []);

  const handleSignatureClose = useCallback(() => {
    setIsSignatureModal(false);
    signatureDataRef.current = null;
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
      const toolId = Number(formData.device_id);

      await incidentsApi.createIncident({
        tool_id: toolId,
        type: formData.type,
        severity: 'medium',
        description: formData.description
});

      // Photos attach to the tool on the new API (not to the incident).
      const uploadPromises = [];

      if (photoUri) {
        uploadPromises.push(
          toolPhotosApi.uploadToolPhoto(toolId, {
            uri: photoUri,
            name: `report_photo_${Date.now()}.jpg`,
            type: 'image/jpeg'
})
        );
      }

      additionalPhotos.forEach((photo, i) => {
        uploadPromises.push(
          toolPhotosApi.uploadToolPhoto(toolId, {
            uri: photo.uri,
            name: `report_photo_${Date.now()}_${i}.jpg`,
            type: 'image/jpeg'
})
        );
      });

      if (signatureUri) {
        uploadPromises.push(
          toolPhotosApi.uploadToolPhoto(toolId, {
            uri: signatureUri,
            name: `signature_${Date.now()}.png`,
            type: 'image/png',
            isSignature: true
})
        );
      }

      await Promise.allSettled(uploadPromises);

      Alert.alert(
        'Success',
        'Report submitted successfully',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      if (!(error instanceof ApiError && error.code === 'unauthorized')) {
        const errorMsg =
          (error instanceof ApiError && error.message) ||
          'Failed to submit report. Please try again.';
        setError(errorMsg);
        Alert.alert('Error', errorMsg);
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [validateForm, formData, photoUri, additionalPhotos, signatureUri, navigation]);

  const renderTypeButton = useCallback((type, description) => {
    const selected = formData.type === type;
    return (
      <TouchableOpacity
        key={type}
        style={[
          styles.typeButtonGrid,
          { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
          selected && {
            backgroundColor: colors.primary,
            borderColor: colors.primary,
          },
        ]}
        onPress={() => setFormData(prev => ({ ...prev, type }))}
        activeOpacity={0.8}
      >
        <Text
          style={[
            styles.typeButtonText,
            { color: colors.textPrimary },
            selected && { color: colors.onPrimary },
          ]}
          numberOfLines={2}
        >
          {type}
        </Text>
        <TouchableOpacity
          style={styles.infoButtonContainer}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={() => Alert.alert(type, description)}
        >
          <Ionicons
            name="information-circle-outline"
            size={18}
            color={selected ? colors.onPrimary : colors.textSecondary}
          />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }, [formData.type, colors]);

  const cardStyle = [
    styles.card,
    { backgroundColor: colors.card, borderColor: colors.borderLight },
  ];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <ScrollView
        style={[styles.formContainer, { backgroundColor: colors.background }]}
        contentContainerStyle={[styles.formContent, { paddingBottom: insets.bottom + 24 }]}
      >
      {error && (
        <View style={[styles.errorBanner, { backgroundColor: colors.error }]}>
          <Text style={styles.errorBannerText}>{error}</Text>
          <TouchableOpacity onPress={() => setError(null)}>
            <Ionicons name="close-circle" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.formHeader}>
        <Text style={[styles.formTitle, { color: colors.textPrimary }]}>Create Report</Text>
        {userData?.name && (
          <Text style={[styles.userInfo, { color: colors.textSecondary }]}>Reporting as: {userData.name}</Text>
        )}
      </View>

      <View style={cardStyle}>
        <Text style={[styles.formLabel, { color: colors.textPrimary }]}>Device</Text>
        {loading || authLoading ? (
          <View style={[styles.loadingContainer, { backgroundColor: colors.surfaceAlt }]}>
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading devices…</Text>
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

      <View style={cardStyle}>
        <Text style={[styles.formLabel, { color: colors.textPrimary }]}>Report Type</Text>
        <View style={styles.typeGrid}>
          {Object.entries(REPORT_TYPES).map(([type, description]) => (
            <View key={type} style={styles.typeGridItem}>
              {renderTypeButton(type, description)}
            </View>
          ))}
        </View>
      </View>

      <View style={cardStyle}>
        <Text style={[styles.formLabel, { color: colors.textPrimary }]}>Description</Text>
        <BaseTextInput
          value={formData.description}
          onChangeText={text => setFormData(prev => ({ ...prev, description: text }))}
          placeholder="Describe what happened"
          multiline
          numberOfLines={5}
          style={styles.descriptionInput}
        />
      </View>

      <View style={cardStyle}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Main Photo</Text>
          <TouchableOpacity
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={() => Alert.alert('Main Photo', 'This photo will be the primary image associated with this report.')}
          >
            <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
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

      <View style={cardStyle}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Additional Photos</Text>
          <TouchableOpacity
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={() => Alert.alert('Additional Photos', 'Add more photos to provide complete documentation of the issue.')}
          >
            <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {additionalPhotos.map((photo, index) => (
          <View
            key={index}
            style={[styles.photoItem, { borderColor: colors.borderLight }]}
          >
            <TouchableOpacity onPress={() => toggleSection(index)}>
              <View style={[styles.photoHeader, { backgroundColor: colors.surfaceAlt }]}>
                <Text style={[styles.photoHeaderText, { color: colors.textPrimary }]}>
                  {activeSections.includes(index) ? '▲' : '▼'} Photo {index + 1}
                </Text>
                <TouchableOpacity onPress={() => handleRemovePhoto(index)}>
                  <Text style={styles.removeText}>Remove</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
            {activeSections.includes(index) && (
              <View style={[styles.photoContent, { backgroundColor: colors.card }]}>
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

      <View style={cardStyle}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Signature</Text>
          <TouchableOpacity
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={() => Alert.alert('Signature', 'Your signature confirms that the information in this report is accurate to the best of your knowledge.')}
          >
            <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
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
          <View style={[styles.modalInnerContainer, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Signature</Text>
              <TouchableOpacity onPress={handleSignatureClose}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={styles.signatureCanvasContainer}>
              <SignatureScreen
                ref={signatureRef}
                onOK={handleSignatureOK}
                onEnd={handleSignatureEnd}
                onEmpty={() => console.log('Empty signature')}
                autoClear={false}
                imageType="image/png"
                webStyle={`
                  .m-signature-pad { box-shadow: none; border: none; }
                  .m-signature-pad--body { border: none; }
                  .m-signature-pad--footer { display: none; }
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
},
  formContainer: {
    flex: 1,
},
  formContent: {
    padding: 16,
    gap: 14,
},
  formHeader: {
    marginBottom: 4,
},
  formTitle: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 4,
},
  userInfo: {
    fontSize: 14,
},
  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
},
  formLabel: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
},
  descriptionInput: {
    minHeight: 110,
    textAlignVertical: 'top',
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
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    height: 68,
    minWidth: '100%',
},
  typeButtonText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 0.85,
    lineHeight: 16,
},
  infoButtonContainer: {
    flex: 0.15,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
},
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    marginTop: 12,
},
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
},
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
},
  photoItem: {
    marginBottom: 10,
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
},
  photoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
},
  photoHeaderText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
},
  removeText: {
    color: '#EF4444',
    fontWeight: '600',
},
  photoContent: {
    padding: 10,
},
  photoImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
},
  addPhotoButton: {
    marginTop: 10,
},
  signaturePreview: {
    width: '100%',
    height: 200,
    marginTop: 12,
    borderRadius: 8,
},
  buttonContainer: {
    marginTop: 10,
    alignItems: 'stretch',
},
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center'
},
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15
},
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333'
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
    elevation: 5
},
  signatureCanvasContainer: {
    flex: 1,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    overflow: 'hidden'
},
  signatureCanvas: {
    flex: 1,
    width: '100%',
    height: '100%'
},
  signatureButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10
},
  signatureButton: {
    flex: 1,
    marginHorizontal: 5
},
  closeButtonRow: {
    width: '100%'
},
  closeButton: {
    width: '100%'
},
  // Error and loading styles
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F5F5F5'
},
  errorMessage: {
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 20
},
  errorBanner: {
    backgroundColor: '#EF4444',
    padding: 10,
    borderRadius: 8,
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
},
  errorBannerText: {
    color: '#FFFFFF',
    fontSize: 14,
    flex: 1
},
  loadingContainer: {
    padding: 15,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    alignItems: 'center'
},
  loadingText: {
    color: '#666',
    fontSize: 14
}
});

export default CreateReportScreen;