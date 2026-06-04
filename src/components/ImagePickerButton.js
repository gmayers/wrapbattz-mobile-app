import React from 'react';
import { Alert, Button } from 'react-native';
import * as ExpoImagePicker from 'expo-image-picker';
import RNFS from 'react-native-fs';
import { useTheme } from '../context/ThemeContext';

const ImagePickerButton = ({ onImageSelected }) => {
  const { colors } = useTheme();
  const copyFileToPermanentStorage = async (tempUri) => {
    try {
      console.log('📁 [ImagePicker] Copying file from temp URI:', tempUri);
      const filename = tempUri.split('/').pop();
      const permanentUri = `${RNFS.DocumentDirectoryPath}/${filename}`;
      await RNFS.copyFile(tempUri, permanentUri);

      const accessibleUri = permanentUri.startsWith('file://')
        ? permanentUri
        : `file://${permanentUri}`;

      // Check file exists and get size
      const fileExists = await RNFS.exists(permanentUri);
      const fileInfo = fileExists ? await RNFS.stat(permanentUri) : null;
      console.log('📁 [ImagePicker] File copied successfully:', {
        permanentUri: accessibleUri,
        exists: fileExists,
        size: fileInfo?.size ? `${(fileInfo.size / 1024).toFixed(2)} KB` : 'unknown',
      });

      return accessibleUri;
    } catch (error) {
      console.error('❌ [ImagePicker] Error copying file:', error);
      throw error;
    }
  };

  // Gallery selection uses the Android/iOS system photo picker, which requires
  // no permission. Only the camera needs a runtime permission, so that's all we
  // request — keeping the app clear of the broad media-read permissions.
  const ensureCameraPermission = async () => {
    const current = await ExpoImagePicker.getCameraPermissionsAsync();
    if (current.status === 'granted') {
      return true;
    }
    const requested = await ExpoImagePicker.requestCameraPermissionsAsync();
    return requested.status === 'granted';
  };

  const handleImagePicker = () => {
    Alert.alert('Choose Image', 'How would you like to choose the image?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Choose from Gallery', onPress: chooseFromGallery },
      { text: 'Take Photo', onPress: takePhoto },
    ]);
  };

  const takePhoto = async () => {
    try {
      console.log('📷 [ImagePicker] Taking photo...');
      if (await ensureCameraPermission()) {
        let result = await ExpoImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 1,
        });

        console.log('📷 [ImagePicker] Camera result:', {
          canceled: result.canceled,
          assetCount: result.assets?.length || 0,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
          const imageAsset = result.assets[0];
          console.log('📷 [ImagePicker] Image captured:', {
            uri: imageAsset.uri,
            width: imageAsset.width,
            height: imageAsset.height,
            type: imageAsset.type,
            mimeType: imageAsset.mimeType,
            fileSize: imageAsset.fileSize ? `${(imageAsset.fileSize / 1024).toFixed(2)} KB` : 'unknown',
            fileName: imageAsset.fileName,
          });

          const permURI = await copyFileToPermanentStorage(imageAsset.uri);
          onImageSelected(permURI);
        }
      }
    } catch (error) {
      console.error('❌ [ImagePicker] Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo.');
    }
  };

  const chooseFromGallery = async () => {
    try {
      console.log('🖼️ [ImagePicker] Opening gallery...');
      // Uses the system photo picker — no permission required.
      const result = await ExpoImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
      });

      console.log('🖼️ [ImagePicker] Gallery result:', {
        canceled: result.canceled,
        assetCount: result.assets?.length || 0,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const imageAsset = result.assets[0];
        console.log('🖼️ [ImagePicker] Image selected:', {
          uri: imageAsset.uri,
          width: imageAsset.width,
          height: imageAsset.height,
          type: imageAsset.type,
          mimeType: imageAsset.mimeType,
          fileSize: imageAsset.fileSize ? `${(imageAsset.fileSize / 1024).toFixed(2)} KB` : 'unknown',
          fileName: imageAsset.fileName,
        });

        const permURI = await copyFileToPermanentStorage(imageAsset.uri);
        onImageSelected(permURI);
      }
    } catch (error) {
      console.error('❌ [ImagePicker] Error selecting image from gallery:', error);
      Alert.alert('Error', 'Failed to select image from gallery.');
    }
  };

  return <Button title="Choose Image" onPress={handleImagePicker} color={colors.primary} />;
};

export default ImagePickerButton;
