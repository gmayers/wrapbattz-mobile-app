import React from 'react';
import { Alert, Button } from 'react-native';
import * as ExpoImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import RNFS from 'react-native-fs';

const ImagePickerButton = ({ onImageSelected }) => {
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
    const cameraPermission = await ExpoImagePicker.getCameraPermissionsAsync();
    const mediaLibraryPermission = await MediaLibrary.getPermissionsAsync();

    if (
      cameraPermission.status !== 'granted' ||
      mediaLibraryPermission.status !== 'granted'
    ) {
      const newCameraPermission =
        await ExpoImagePicker.requestCameraPermissionsAsync();
      const newMediaLibraryPermission =
        await MediaLibrary.requestPermissionsAsync();

      return (
        newCameraPermission.status === 'granted' &&
        newMediaLibraryPermission.status === 'granted'
      );
    }
    return true;
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
      if (await checkAndRequestPermissions()) {
        let result = await ExpoImagePicker.launchCameraAsync({
          mediaTypes: ExpoImagePicker.MediaTypeOptions.Images,
          quality: 1,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
          const asset = await MediaLibrary.createAssetAsync(
            result.assets[0].uri
          );

          const permURI = await copyFileToPermanentStorage(
            result.assets[0].uri
          );

          onImageSelected(permURI);
        }
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo and save to gallery.');
    }
  };

  const chooseFromGallery = async () => {
    try {
      if (await checkAndRequestPermissions()) {
        const result = await ExpoImagePicker.launchImageLibraryAsync({
          mediaTypes: ExpoImagePicker.MediaTypeOptions.Images,
          quality: 1,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
          const permURI = await copyFileToPermanentStorage(
            result.assets[0].uri
          );

          onImageSelected(permURI);
        }
      }
    } catch (error) {
      console.error('Error selecting image from gallery:', error);
      Alert.alert('Error', 'Failed to select image from gallery.');
    }
  };

  return <Button title="Choose Image" onPress={handleImagePicker} />;
};

export default ImagePickerButton;
