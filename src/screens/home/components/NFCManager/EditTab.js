import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, ScrollView, Alert, TouchableOpacity, Platform, KeyboardAvoidingView, Keyboard } from 'react-native';
import Button from '../../../../components/Button';
import { nfcService } from '../../../../services/NFCService';
import { getStyles } from './styles';
import { useTheme } from '../../../../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import NfcManager from 'react-native-nfc-manager';


// NFCService handles normalization, so we don't need this function anymore


// New function to validate JSON structure
const validateJSON = (jsonString) => {
  try {
    JSON.parse(jsonString);
    return { valid: true, error: null };
  } catch (e) {
    return { valid: false, error: e.message };
  }
};

// Function to determine if a string is likely JSON
const isLikelyJSON = (value) => {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) || 
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  );
};

const EditTab = ({ onCancel }) => {
  const { colors } = useTheme();
  const baseStyles = getStyles(colors);

  const additionalStyles = useMemo(() => ({
    nfcTabContent: {
      flex: 1,
      padding: 16,
      paddingBottom: 80,
    },
    editFieldsContainer: {
      flex: 1,
      marginTop: 20,
    },
    editFieldsContentContainer: {
      paddingBottom: 20,
    },
    fieldContainer: {
      marginBottom: 12,
    },
    fieldRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    fieldKeyCompact: {
      flex: 2,
      borderWidth: 1,
      borderColor: colors.borderInput,
      borderRadius: 5,
      padding: 10,
      fontSize: 14,
      marginRight: 8,
      backgroundColor: colors.card,
      color: colors.textPrimary,
    },
    fieldValueCompact: {
      flex: 3,
      borderWidth: 1,
      borderColor: colors.borderInput,
      borderRadius: 5,
      padding: 10,
      fontSize: 14,
      marginRight: 8,
      backgroundColor: colors.card,
      color: colors.textPrimary,
    },
    uneditableKeyCompact: {
      backgroundColor: colors.surfaceAlt,
      justifyContent: 'center',
    },
    uneditableValueCompact: {
      backgroundColor: colors.surfaceAlt,
      color: colors.textSecondary,
    },
    deleteButton: {
      padding: 8,
    },
    primaryFieldHint: {
      fontSize: 11,
      color: colors.textMuted,
      fontStyle: 'italic',
      marginTop: 4,
      marginLeft: 4,
    },
    fieldHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 5,
    },
    fieldKeyContainer: {
      flex: 1,
      marginRight: 10,
    },
    fieldKeyInput: {
      borderWidth: 1,
      borderColor: colors.borderInput,
      borderRadius: 5,
      padding: 8,
      fontSize: 14,
      fontWeight: '500',
      backgroundColor: colors.surface,
      color: colors.textPrimary,
    },
    fieldLabel: {
      fontSize: 16,
      fontWeight: '500',
      marginBottom: 5,
      color: colors.textPrimary,
    },
    fieldInput: {
      borderWidth: 1,
      borderColor: colors.borderInput,
      borderRadius: 5,
      padding: 10,
      fontSize: 16,
      color: colors.textPrimary,
      backgroundColor: colors.card,
    },
    idField: {
      marginBottom: 15,
      padding: 10,
      backgroundColor: colors.surface,
      borderRadius: 5,
    },
    idValueInput: {
      backgroundColor: colors.surfaceAlt,
      color: colors.textSecondary,
      fontWeight: '500',
      marginTop: 5,
    },
    idHelperText: {
      fontSize: 12,
      color: colors.textSecondary,
      fontStyle: 'italic',
      marginTop: 5,
    },
    uneditableKeyContainer: {
      borderWidth: 1,
      borderColor: colors.borderInput,
      borderRadius: 5,
      padding: 8,
      backgroundColor: colors.surfaceAlt,
    },
    uneditableKeyText: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    uneditableKeyHelp: {
      fontSize: 10,
      fontStyle: 'italic',
      color: colors.textMuted,
      marginTop: 2,
    },
    uneditableValueContainer: {
      marginBottom: 5,
    },
    uneditableValueInput: {
      backgroundColor: colors.surfaceAlt,
      color: colors.textSecondary,
      fontWeight: '500',
      textAlignVertical: 'top',
    },
    uneditableValueHelp: {
      fontSize: 10,
      fontStyle: 'italic',
      color: colors.textMuted,
      marginTop: 2,
    },
    addFieldContainer: {
      marginTop: 20,
      marginBottom: 15,
      padding: 15,
      backgroundColor: colors.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    addFieldTitle: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 10,
      color: colors.textTertiary,
    },
    newFieldRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    newFieldKey: {
      flex: 2,
      marginRight: 10,
    },
    newFieldValue: {
      flex: 3,
      marginRight: 10,
    },
    addFieldButton: {
      padding: 5,
    },
    jsonErrorText: {
      color: colors.error,
      fontSize: 12,
      marginTop: 4,
      fontStyle: 'italic',
    },
    plainTextNotice: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: colors.primaryLight,
      borderWidth: 1,
      borderColor: colors.warning,
      borderRadius: 8,
      padding: 12,
      marginBottom: 15,
    },
    plainTextNoticeText: {
      flex: 1,
      marginLeft: 10,
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    emptyTagNotice: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: colors.infoBg,
      borderWidth: 1,
      borderColor: colors.infoBorder,
      borderRadius: 8,
      padding: 12,
      marginBottom: 15,
    },
    emptyTagNoticeText: {
      flex: 1,
      marginLeft: 10,
      fontSize: 13,
      color: colors.infoText,
      lineHeight: 18,
    },
    modifiedFieldContainer: {
      backgroundColor: colors.primaryLight,
      borderWidth: 1,
      borderColor: colors.warning,
      borderRadius: 8,
      padding: 8,
      marginBottom: 12,
    },
    modifiedFieldHint: {
      fontSize: 11,
      color: colors.textSecondary,
      fontStyle: 'italic',
      marginTop: 4,
      marginLeft: 4,
    },
    addedFieldContainer: {
      backgroundColor: colors.successBg,
      borderWidth: 1,
      borderColor: colors.success,
      borderRadius: 8,
      padding: 8,
      marginBottom: 12,
    },
    addedFieldInput: {
      borderColor: colors.success,
    },
    addedFieldHint: {
      fontSize: 11,
      color: colors.successText,
      fontStyle: 'italic',
      marginTop: 4,
      marginLeft: 4,
    },
    deletedFieldContainer: {
      backgroundColor: colors.errorBg,
      borderWidth: 1,
      borderColor: colors.error,
      borderRadius: 8,
      padding: 8,
      marginBottom: 12,
    },
    deletedInput: {
      textDecorationLine: 'line-through',
      color: colors.textMuted,
    },
    deletedText: {
      textDecorationLine: 'line-through',
      color: colors.textMuted,
    },
    deletedFieldHint: {
      fontSize: 11,
      color: colors.errorTextAlt,
      fontStyle: 'italic',
      marginTop: 4,
      marginLeft: 4,
    },
    newFieldsDivider: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: 16,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.success,
    },
    dividerText: {
      marginHorizontal: 12,
      fontSize: 12,
      fontWeight: '600',
      color: colors.success,
    },
    changeSummary: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      marginTop: 16,
    },
    changeSummaryTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 8,
    },
    changeSummaryItems: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    changeSummaryItem: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    changeDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: 6,
    },
    changeSummaryText: {
      fontSize: 13,
      color: colors.textSecondary,
    },
  }), [colors]);

  const styles = useMemo(() => ({ ...baseStyles, ...additionalStyles }), [baseStyles, additionalStyles]);

  const [isReading, setIsReading] = useState(false);
  const [isWriting, setIsWriting] = useState(false);
  const [tagData, setTagData] = useState(null);
  const [editedFields, setEditedFields] = useState({});
  const [newField, setNewField] = useState({ key: '', value: '' });
  const [firstKey, setFirstKey] = useState(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // State for field editing
  const [editingKeys, setEditingKeys] = useState({});
  const [jsonValidationState, setJsonValidationState] = useState({});

  // Change tracking state
  const [originalFields, setOriginalFields] = useState({}); // Original values from tag
  const [deletedFields, setDeletedFields] = useState(new Set()); // Fields marked for deletion
  const [addedFields, setAddedFields] = useState(new Set()); // Fields added by user

  // Helper to check if a field is modified (exists in original and value changed)
  const isFieldModified = (key) => {
    if (addedFields.has(key)) return false; // New fields aren't "modified"
    if (!originalFields.hasOwnProperty(key)) return false;
    return originalFields[key] !== editedFields[key];
  };

  // Helper to check if there are any pending changes
  const hasPendingChanges = () => {
    const hasModified = Object.keys(editedFields).some(key => isFieldModified(key));
    const hasDeleted = deletedFields.size > 0;
    const hasAdded = addedFields.size > 0;
    const hasPendingNew = newField.key.trim() || newField.value.trim();
    return hasModified || hasDeleted || hasAdded || hasPendingNew;
  };

  // Keyboard event listeners
  React.useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      setIsKeyboardVisible(true);
    });
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setIsKeyboardVisible(false);
    });

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
    };
  }, []);


const handleReadTag = async () => {
  let result = false;
  let loadedTagData = null;
  let loadedEditedFields = {};
  let loadedFirstKey = null;
  let alertMessage = null;
  let alertTitle = 'Success';

  try {
    setIsReading(true);
    setTagData(null);
    setEditedFields({});
    setFirstKey(null);
    // Reset change tracking
    setOriginalFields({});
    setDeletedFields(new Set());
    setAddedFields(new Set());
    setNewField({ key: '', value: '' });

    console.log('[EditTab] Starting enhanced tag read with NFCService');

    // Use the enhanced NFCService for reading
    const readResult = await nfcService.readNFC({ timeout: 60000 });

    if (readResult.success) {
      console.log('[EditTab] Successfully read tag using NFCService');

      // Handle empty tags - allow editing from scratch
      if (readResult.data?.isEmpty) {
        console.log('[EditTab] Tag is empty, starting with blank editor');
        loadedTagData = {};
        loadedEditedFields = {};
        loadedFirstKey = null;
        alertTitle = 'Empty Tag';
        alertMessage = 'Tag is formatted but empty. You can add new fields below.';
        result = true;
      } else if (readResult.data?.parsedData) {
        // Handle structured JSON data
        const jsonData = readResult.data.parsedData;

        if (typeof jsonData === 'object' && jsonData !== null && !Array.isArray(jsonData)) {
          // Set the first key to maintain EditTab functionality
          const keys = Object.keys(jsonData);
          if (keys.length > 0) {
            loadedFirstKey = keys[0];
          }

          loadedTagData = jsonData;
          loadedEditedFields = { ...jsonData };
          alertMessage = 'NFC tag data loaded successfully!';
          result = true;
        } else {
          // Handle non-object data
          loadedTagData = {};
          loadedEditedFields = { "content": JSON.stringify(jsonData) };
          alertMessage = 'Tag content loaded.';
          result = true;
        }
      } else if (readResult.data?.content) {
        // Handle plain text content
        loadedTagData = {};
        loadedEditedFields = { "content": readResult.data.content };
        alertMessage = 'Plain text content loaded.';
        result = true;
      } else if (readResult.data?.jsonString) {
        // Try to parse JSON string
        try {
          const parsed = JSON.parse(readResult.data.jsonString);

          if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
            const keys = Object.keys(parsed);
            if (keys.length > 0) {
              loadedFirstKey = keys[0];
            }

            loadedTagData = parsed;
            loadedEditedFields = { ...parsed };
            alertMessage = 'NFC tag data loaded successfully!';
            result = true;
          } else {
            loadedTagData = {};
            loadedEditedFields = { "content": readResult.data.jsonString };
            alertMessage = 'Tag content loaded.';
            result = true;
          }
        } catch (e) {
          loadedTagData = {};
          loadedEditedFields = { "content": readResult.data.jsonString };
          alertMessage = 'Raw content loaded.';
          result = true;
        }
      } else {
        throw new Error('No valid data found on tag');
      }
    } else {
      throw new Error(readResult.error || 'Failed to read NFC tag');
    }
  } catch (error) {
    console.error('[EditTab] Error in handleReadTag:', error);

    const errorMsg = error.message || '';

    // Check if this was a cancel operation (empty message or explicit cancel)
    const wasCancelled = !errorMsg || errorMsg.includes('cancelled') || errorMsg.includes('canceled');

    if (wasCancelled) {
      // Don't show error for cancelled operations - just log it
      console.log('[EditTab] NFC read was cancelled by user');
    } else {
      // Create user-friendly error message based on error type
      let userErrorMessage;

      if (errorMsg.includes('NFC hardware')) {
        userErrorMessage = 'NFC is not available or is disabled on this device. Please check your device settings.';
      } else if (errorMsg.includes('No NFC tag detected')) {
        userErrorMessage = 'No NFC tag detected. Please make sure the tag is positioned correctly near your device.';
      } else if (errorMsg.includes('No NDEF message')) {
        userErrorMessage = 'This tag may not be NDEF formatted or may be empty. Please format the tag or try a different one.';
      } else if (errorMsg.includes('decode')) {
        userErrorMessage = 'Could not read tag content. The tag format may be incompatible or corrupted.';
      } else {
        // Generic error with the technical message included
        userErrorMessage = `Error reading NFC tag: ${errorMsg}`;
      }

      Alert.alert('NFC Read Error', userErrorMessage, [
        {
          text: 'Retry',
          onPress: () => handleReadTag(),
          style: 'default'
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ]);
    }

    result = false;
  } finally {
    // Always cancel technology request when done
    try {
      await NfcManager.cancelTechnologyRequest();
      console.log('[EditTab] NFC technology request canceled');
    } catch (finallyError) {
      console.warn(`[EditTab] Error canceling NFC technology request: ${finallyError.message}`);
    }

    // Apply state updates with proper sequencing for React
    if (result && loadedTagData !== null) {
      console.log('[EditTab] Applying loaded data to state', {
        hasTagData: !!loadedTagData,
        fieldCount: Object.keys(loadedEditedFields).length,
        firstKey: loadedFirstKey
      });

      // Set state in sequence
      setFirstKey(loadedFirstKey);
      setEditedFields(loadedEditedFields);
      setOriginalFields({ ...loadedEditedFields }); // Save original for change tracking
      setTagData(loadedTagData);
    }

    // Set isReading false after state is applied
    setIsReading(false);

    // Show alert with slight delay to allow UI to update first
    if (alertMessage) {
      setTimeout(() => {
        Alert.alert(alertTitle, alertMessage);
      }, 100);
    }
  }

  return result;
};

// Helper function to read Mifare pages with retry
const readMifarePagesWithRetry = async (maxRetries = 3) => {
  let mifarePages = [];
  let retryCount = 0;
  
  while (retryCount < maxRetries) {
    try {
      const readLength = 60; // Adjust based on your tag type
      
      for (let i = 0; i < readLength; i++) {
        try {
          const pages = await NfcManager.mifareUltralightHandlerAndroid
            .mifareUltralightReadPages(i * 4);
          
          if (pages) {
            mifarePages.push(pages);
          }
        } catch (pageError) {
          // If we hit the end of available pages, stop
          if (pageError.message.includes('Out of bounds') || 
              pageError.message.includes('Invalid page') ||
              pageError.message.includes('I/O error')) {
            console.log(`[EditTab] Reached end of readable pages at page ${i*4}`);
            break;
          }
          throw pageError; // Rethrow other errors
        }
      }
      
      // If we got here successfully, return the pages
      return mifarePages;
    } catch (error) {
      retryCount++;
      console.warn(`[EditTab] Mifare read attempt ${retryCount} failed: ${error.message}`);
      
      if (retryCount >= maxRetries) {
        throw new Error(`Failed to read Mifare tag after ${maxRetries} attempts: ${error.message}`);
      }
      
      // Brief delay before retry
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  return mifarePages;
};

// Helper function to process JSON tag content with console logging
const processJsonTagContent = (textContent) => {
  // Add console statement when reading data
  console.log('[EditTab] Processing tag JSON content:', textContent);

  // NFCService already handles normalization, so we just trim and parse
  const cleanJson = textContent.trim();

  // Parse the JSON
  const jsonData = JSON.parse(cleanJson);
  
  // Separate the ID field (if it exists) from other editable fields
  const { id, ...editableData } = jsonData;
  
  // Create a clean object for tagData and editedFields
  const tagDataObj = id ? { id } : {};
  
  // Convert all fields to strings for the TextInput component
  const editableFields = {};
  const jsonState = {};
  
  // Track the first key for making it uneditable
  let firstKey = null;
  
  Object.entries(editableData).forEach(([key, value], index) => {
    // Track the first key encountered
    if (index === 0 && firstKey === null) {
      firstKey = key;
    }
    
    if (typeof value === 'object' && value !== null) {
      // Properly stringify objects
      const stringifiedValue = JSON.stringify(value);
      editableFields[key] = stringifiedValue;
      jsonState[key] = { valid: true, error: null };
    } else {
      // Convert primitives to string
      editableFields[key] = String(value);
      // Check if the string looks like JSON
      if (isLikelyJSON(String(value))) {
        jsonState[key] = validateJSON(String(value));
      }
    }
  });
  
  // Store the first key in state for reference
  setFirstKey(firstKey);
  
  setTagData(tagDataObj);
  setEditedFields(editableFields);
  setJsonValidationState(jsonState);
};

// Write function using NFCService for all NFC operations
const handleWriteTag = async () => {
  let result = false;

  try {
    // Check for invalid JSON first
    const invalidFields = Object.entries(jsonValidationState)
      .filter(([key, state]) => state && !state.valid)
      .map(([key]) => key);

    if (invalidFields.length > 0) {
      Alert.alert(
        'Invalid JSON Detected',
        `Please fix the JSON formatting in these fields: ${invalidFields.join(', ')}`
      );
      return;
    }

    setIsWriting(true);

    // Auto-add pending new field if user typed something but forgot to press +
    if (newField.key.trim() || newField.value.trim()) {
      const keyToAdd = newField.key.trim() || 'field';
      const valueToAdd = newField.value;

      // Check for duplicate key
      if (!editedFields.hasOwnProperty(keyToAdd)) {
        // Validate JSON if it looks like JSON
        if (isLikelyJSON(valueToAdd) && !validateJSON(valueToAdd).valid) {
          Alert.alert('Invalid JSON', 'The new field value contains invalid JSON. Please fix it before saving.');
          return;
        }

        // Add the field
        setEditedFields(prev => ({
          ...prev,
          [keyToAdd]: valueToAdd
        }));

        // Track as added field
        setAddedFields(prev => {
          const updated = new Set(prev);
          updated.add(keyToAdd);
          return updated;
        });

        // Update local reference for this write operation
        editedFields[keyToAdd] = valueToAdd;

        // Clear the new field inputs
        setNewField({ key: '', value: '' });
      }
    }

    // Filter out deleted fields for writing
    const fieldsToWrite = Object.keys(editedFields).filter(key => !deletedFields.has(key));

    // Check if there are any fields to write
    if (fieldsToWrite.length === 0) {
      Alert.alert('Error', 'There are no fields to write to the tag. All fields are marked for deletion.');
      return;
    }

    // Process the data for writing
    const processedData = {};

    // Add ID if it exists
    if (tagData?.id) {
      processedData.id = tagData.id;
    }

    // Process all other fields (excluding deleted ones)
    fieldsToWrite.forEach((key) => {
      const value = editedFields[key];
      // Handle string values that might be JSON
      if (typeof value === 'string' && isLikelyJSON(value)) {
        try {
          processedData[key] = JSON.parse(value);
        } catch (e) {
          // If parsing fails, use as string
          processedData[key] = value;
        }
      } else {
        processedData[key] = value;
      }
    });

    // Convert to JSON string and write via NFCService
    const jsonString = JSON.stringify(processedData);
    const writeResult = await nfcService.writeNFC(jsonString);

    if (writeResult.success) {
      result = true;

      // Reset change tracking - current state becomes the new "original"
      const finalFields = {};
      fieldsToWrite.forEach(key => {
        finalFields[key] = editedFields[key];
      });
      setEditedFields(finalFields);
      setOriginalFields({ ...finalFields });
      setDeletedFields(new Set());
      setAddedFields(new Set());

      Alert.alert('Success', 'Changes saved to NFC tag successfully!');
    } else {
      Alert.alert('NFC Write Error', writeResult.error || 'Failed to write to NFC tag.', [
        {
          text: 'Retry',
          onPress: () => handleWriteTag(),
          style: 'default'
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ]);
    }
  } catch (error) {
    Alert.alert('NFC Write Error', error.message || 'An unexpected error occurred.', [
      {
        text: 'Retry',
        onPress: () => handleWriteTag(),
        style: 'default'
      },
      {
        text: 'Cancel',
        style: 'cancel'
      }
    ]);
    result = false;
  } finally {
    setIsWriting(false);
  }

  return result;
};
const handleFieldChange = (key, value) => {
  // Prevent changing the value of the first key
  if (key === firstKey) {
    Alert.alert('Error', 'The primary field cannot be modified.');
    return;
  }
  
  setEditedFields(prev => ({
    ...prev,
    [key]: value
  }));
  
  // Check JSON validity if the value looks like JSON
  if (isLikelyJSON(value)) {
    setJsonValidationState(prev => ({
      ...prev,
      [key]: validateJSON(value)
    }));
  } else {
    // If it no longer looks like JSON, remove validation state
    setJsonValidationState(prev => {
      const updated = { ...prev };
      delete updated[key];
      return updated;
    });
  }
};

// New improved key change handler with live feedback
const handleKeyChange = (oldKey, newKey) => {
  // Prevent editing the first key
  if (oldKey === firstKey) {
    Alert.alert('Error', 'The primary field cannot be renamed.');
    return;
  }
  
  // Update the editing state
  setEditingKeys(prev => ({
    ...prev,
    [oldKey]: newKey
  }));
};

// New function to commit key changes when editing is complete
const handleKeyChangeComplete = (oldKey) => {
  // Prevent editing the first key
  if (oldKey === firstKey) {
    setEditingKeys(prev => {
      const updated = { ...prev };
      delete updated[oldKey];
      return updated;
    });
    Alert.alert('Error', 'The primary field cannot be renamed.');
    return;
  }
  
  const newKey = editingKeys[oldKey]?.trim() || oldKey;
  
  // Handle empty keys - revert to original
  if (!newKey) {
    setEditingKeys(prev => {
      const updated = { ...prev };
      delete updated[oldKey];
      return updated;
    });
    Alert.alert('Error', 'Field name cannot be empty');
    return;
  }
  
  if (oldKey === newKey) {
    // No change needed, just clear the editing state
    setEditingKeys(prev => {
      const updated = { ...prev };
      delete updated[oldKey];
      return updated;
    });
    return;
  }
  
  // Check for duplicate keys, but ignore the current key
  if (oldKey !== newKey && editedFields.hasOwnProperty(newKey)) {
    Alert.alert('Error', `Field "${newKey}" already exists`);
    // Revert back to old key in the editing state
    setEditingKeys(prev => ({
      ...prev,
      [oldKey]: oldKey
    }));
    return;
  }
  
  // Commit the key change
  setEditedFields(prev => {
    const updatedFields = { ...prev };
    const value = updatedFields[oldKey];
    delete updatedFields[oldKey];
    updatedFields[newKey] = value;
    return updatedFields;
  });

  // Update addedFields set if this was an added field
  if (addedFields.has(oldKey)) {
    setAddedFields(prev => {
      const updated = new Set(prev);
      updated.delete(oldKey);
      updated.add(newKey);
      return updated;
    });
  }

  // Update deletedFields set if this was marked for deletion
  if (deletedFields.has(oldKey)) {
    setDeletedFields(prev => {
      const updated = new Set(prev);
      updated.delete(oldKey);
      updated.add(newKey);
      return updated;
    });
  }

  // Update originalFields if this key was from original data
  if (originalFields.hasOwnProperty(oldKey)) {
    setOriginalFields(prev => {
      const updated = { ...prev };
      const originalValue = updated[oldKey];
      delete updated[oldKey];
      updated[newKey] = originalValue;
      return updated;
    });
  }

  // Update JSON validation state if needed
  if (jsonValidationState.hasOwnProperty(oldKey)) {
    setJsonValidationState(prev => {
      const updated = { ...prev };
      const validationState = updated[oldKey];
      delete updated[oldKey];
      updated[newKey] = validationState;
      return updated;
    });
  }

  // Clear editing state for this key
  setEditingKeys(prev => {
    const updated = { ...prev };
    delete updated[oldKey];
    return updated;
  });
};

const handleAddField = () => {
  if (!newField.key.trim()) {
    Alert.alert('Error', 'Please enter a field name.');
    return;
  }

  if (editedFields.hasOwnProperty(newField.key.trim())) {
    Alert.alert('Error', `Field "${newField.key.trim()}" already exists`);
    return;
  }

  const keyToAdd = newField.key.trim();
  const valueToAdd = newField.value;

  // Add the new field to editedFields
  setEditedFields(prev => ({
    ...prev,
    [keyToAdd]: valueToAdd
  }));

  // Track this as a newly added field (not from original tag)
  setAddedFields(prev => {
    const updated = new Set(prev);
    updated.add(keyToAdd);
    return updated;
  });

  // Check if the value looks like JSON and validate if needed
  if (isLikelyJSON(valueToAdd)) {
    setJsonValidationState(prev => ({
      ...prev,
      [keyToAdd]: validateJSON(valueToAdd)
    }));
  }

  // Reset the new field inputs
  setNewField({ key: '', value: '' });
};

const handleDeleteField = (key) => {
  // Prevent deleting the first key
  if (key === firstKey) {
    Alert.alert('Error', 'The primary field cannot be deleted.');
    return;
  }

  // Toggle deletion state instead of actually removing
  setDeletedFields(prev => {
    const updated = new Set(prev);
    if (updated.has(key)) {
      // Unmark for deletion (recover)
      updated.delete(key);
    } else {
      // Mark for deletion
      updated.add(key);
    }
    return updated;
  });
};

const cancelOperation = () => {
  if (isReading || isWriting) {
    setIsReading(false);
    setIsWriting(false);
    NfcManager.cancelTechnologyRequest();
    onCancel?.();
  } else {
    onCancel?.();
  }
};

// Helper function to get field key border color based on validation
const getFieldKeyBorderColor = (key) => {
  // If the key is being edited and exists in another field, show error
  const editingValue = editingKeys[key];
  if (editingValue &&
      editingValue !== key &&
      editedFields.hasOwnProperty(editingValue)) {
    return colors.error; // Red for duplicate
  }
  return colors.borderInput; // Default
};

// Helper function to get field value border color based on JSON validation
const getFieldValueBorderColor = (key, value) => {
  // If this is a JSON field with validation state
  if (jsonValidationState[key]) {
    return jsonValidationState[key].valid ? colors.success : colors.error;
  }
  return colors.borderInput; // Default
};


return (
  <KeyboardAvoidingView
    style={styles.nfcTabContent}
    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
  >
    <View style={{ flex: 1 }} testID="edit-tab-container">
      <Text style={styles.nfcTabTitle} testID="edit-tab-title">Edit NFC Tag</Text>
      <Text style={styles.nfcTabSubtitle} testID="edit-tab-subtitle">
        Hold device close to NFC tag to load and display existing data. Scroll down to make changes and save.
      </Text>

    {isReading || isWriting ? (
      <View style={styles.buttonGroup} testID="operation-cancel-container">
        <Button
          title="Cancel Operation"
          onPress={cancelOperation}
          style={styles.cancelButton}
          testID="cancel-operation-button"
        />
      </View>
    ) : (
      <Button
        title={tagData ? "Reload Tag Data" : "Load Tag Data"}
        onPress={handleReadTag}
        style={styles.loadButton}
        disabled={isReading || isWriting}
        testID="load-tag-button"
      />
    )}

    {/* Helper text when no tag data is loaded */}
    {tagData === null && !isReading && !isWriting && (
      <View style={styles.helperContainer} testID="helper-container">
        <Ionicons name="information-circle-outline" size={48} color={colors.info} />
        <Text style={styles.helperTitle}>How to Edit NFC Tags</Text>
        <Text style={styles.helperText}>
          1. Tap "Load Tag Data" above{'\n'}
          2. Hold your NFC tag near the device{'\n'}
          3. Edit the tag's data fields below{'\n'}
          4. Tap "Write to Tag" to save changes
        </Text>
      </View>
    )}

    {(isReading || isWriting) && (
      <View style={styles.readingStatusContainer} testID="operation-status-container">
        <Text style={styles.readingStatusText} testID="operation-status-text">
          {isReading ? "Ready to read... Place NFC tag near device" : "Ready to write... Place NFC tag near device"}
        </Text>
      </View>
    )}

    {tagData !== null && !isReading && !isWriting && (
      <ScrollView
        style={styles.editFieldsContainer}
        contentContainerStyle={styles.editFieldsContentContainer}
        testID="edit-fields-scroll"
        scrollEnabled={!isKeyboardVisible || Platform.OS === 'ios'}
        keyboardShouldPersistTaps="handled"
      >
        {/* Show notice when tag has plain text (non-JSON) content */}
        {Object.keys(editedFields).length > 0 && !firstKey && editedFields.content !== undefined && (
          <View style={styles.plainTextNotice} testID="plain-text-notice">
            <Ionicons name="information-circle" size={20} color={colors.warning} />
            <Text style={styles.plainTextNoticeText}>
              This tag contains plain text data (not JSON format). You can edit the content below or add new fields.
            </Text>
          </View>
        )}

        {/* Show notice when tag is empty */}
        {Object.keys(editedFields).length === 0 && (
          <View style={styles.emptyTagNotice} testID="empty-tag-notice">
            <Ionicons name="document-outline" size={20} color={colors.infoText} />
            <Text style={styles.emptyTagNoticeText}>
              This tag is empty. Add fields below to write data to it.
            </Text>
          </View>
        )}

        {tagData.id && (
          <View style={styles.idField} testID="id-field-container">
            <Text style={styles.fieldLabel} testID="id-field-label">ID (Not Editable):</Text>
            
            {/* Display ID in a read-only TextInput for better visibility and copying functionality */}
            <TextInput
              style={[styles.fieldInput, styles.idValueInput]}
              value={tagData.id}
              editable={false}  // Make it non-editable
              selectTextOnFocus={true}  // Allow selection for copying
              testID="id-field-value-input"
            />
            
            {/* Optional: Add a small helper text */}
            <Text style={styles.idHelperText}>
              Tag ID is preserved during editing and cannot be modified.
              You can select and copy this value if needed.
            </Text>
          </View>
        )}
        
        {/* Existing/Original Fields - Compact single row layout */}
        {Object.entries(editedFields)
          .filter(([key]) => !addedFields.has(key))
          .map(([key, value], index) => {
            const isDeleted = deletedFields.has(key);
            const isModified = isFieldModified(key);

            return (
              <View
                key={key}
                style={[
                  styles.fieldContainer,
                  isDeleted && styles.deletedFieldContainer,
                  isModified && !isDeleted && styles.modifiedFieldContainer,
                ]}
                testID={`field-container-${index}`}
              >
                <View style={[styles.fieldRow, isDeleted && { opacity: 0.5 }]}>
                  {/* Key input */}
                  {key === firstKey ? (
                    <View style={[styles.fieldKeyCompact, styles.uneditableKeyCompact]}>
                      <Text style={[styles.uneditableKeyText, isDeleted && styles.deletedText]} numberOfLines={1}>{key}</Text>
                    </View>
                  ) : (
                    <TextInput
                      style={[
                        styles.fieldKeyCompact,
                        { borderColor: getFieldKeyBorderColor(key) },
                        isDeleted && styles.deletedInput,
                      ]}
                      value={editingKeys[key] !== undefined ? editingKeys[key] : key}
                      onChangeText={(newKey) => handleKeyChange(key, newKey)}
                      onEndEditing={() => handleKeyChangeComplete(key)}
                      placeholder="Key"
                      editable={!isDeleted}
                      testID={`field-key-input-${index}`}
                    />
                  )}

                  {/* Value input */}
                  {key === firstKey ? (
                    <TextInput
                      style={[styles.fieldValueCompact, styles.uneditableValueCompact, isDeleted && styles.deletedInput]}
                      value={value}
                      editable={false}
                      selectTextOnFocus={true}
                      placeholder="Value"
                      testID={`field-value-input-${index}`}
                    />
                  ) : (
                    <TextInput
                      style={[
                        styles.fieldValueCompact,
                        { borderColor: getFieldValueBorderColor(key, value) },
                        isDeleted && styles.deletedInput,
                      ]}
                      value={value}
                      onChangeText={(text) => handleFieldChange(key, text)}
                      placeholder="Value"
                      editable={!isDeleted}
                      testID={`field-value-input-${index}`}
                    />
                  )}

                  {/* Delete/Restore toggle button */}
                  <TouchableOpacity
                    onPress={() => handleDeleteField(key)}
                    testID={`field-delete-button-${index}`}
                    disabled={key === firstKey}
                    style={[styles.deleteButton, key === firstKey && { opacity: 0.3 }]}
                  >
                    <Ionicons
                      name={isDeleted ? "refresh-outline" : "trash-outline"}
                      size={20}
                      color={isDeleted ? colors.success : colors.error}
                    />
                  </TouchableOpacity>
                </View>

                {/* Show status indicator */}
                {isDeleted && (
                  <Text style={styles.deletedFieldHint}>Marked for deletion - tap restore to recover</Text>
                )}
                {isModified && !isDeleted && (
                  <Text style={styles.modifiedFieldHint}>Modified</Text>
                )}

                {/* Show validation error if JSON is invalid */}
                {jsonValidationState[key] && !jsonValidationState[key].valid && !isDeleted && (
                  <Text style={styles.jsonErrorText}>{jsonValidationState[key].error}</Text>
                )}

                {/* Show hint for primary field */}
                {key === firstKey && (
                  <Text style={styles.primaryFieldHint}>Primary field - read only</Text>
                )}
              </View>
            );
          })}

        {/* Divider for new fields section */}
        {addedFields.size > 0 && (
          <View style={styles.newFieldsDivider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>New Fields</Text>
            <View style={styles.dividerLine} />
          </View>
        )}

        {/* Added/New Fields */}
        {Object.entries(editedFields)
          .filter(([key]) => addedFields.has(key))
          .map(([key, value], index) => {
            const isDeleted = deletedFields.has(key);

            return (
              <View
                key={key}
                style={[
                  styles.fieldContainer,
                  styles.addedFieldContainer,
                  isDeleted && styles.deletedFieldContainer,
                ]}
                testID={`new-field-container-${index}`}
              >
                <View style={[styles.fieldRow, isDeleted && { opacity: 0.5 }]}>
                  {/* Key input */}
                  <TextInput
                    style={[
                      styles.fieldKeyCompact,
                      styles.addedFieldInput,
                      isDeleted && styles.deletedInput,
                    ]}
                    value={editingKeys[key] !== undefined ? editingKeys[key] : key}
                    onChangeText={(newKey) => handleKeyChange(key, newKey)}
                    onEndEditing={() => handleKeyChangeComplete(key)}
                    placeholder="Key"
                    editable={!isDeleted}
                    testID={`new-field-key-input-${index}`}
                  />

                  {/* Value input */}
                  <TextInput
                    style={[
                      styles.fieldValueCompact,
                      styles.addedFieldInput,
                      isDeleted && styles.deletedInput,
                    ]}
                    value={value}
                    onChangeText={(text) => handleFieldChange(key, text)}
                    placeholder="Value"
                    editable={!isDeleted}
                    testID={`new-field-value-input-${index}`}
                  />

                  {/* Delete/Restore toggle button */}
                  <TouchableOpacity
                    onPress={() => handleDeleteField(key)}
                    testID={`new-field-delete-button-${index}`}
                    style={styles.deleteButton}
                  >
                    <Ionicons
                      name={isDeleted ? "refresh-outline" : "trash-outline"}
                      size={20}
                      color={isDeleted ? colors.success : colors.error}
                    />
                  </TouchableOpacity>
                </View>

                {/* Show status indicator */}
                {isDeleted && (
                  <Text style={styles.deletedFieldHint}>Marked for deletion - tap restore to recover</Text>
                )}
                {!isDeleted && (
                  <Text style={styles.addedFieldHint}>New field</Text>
                )}

                {/* Show validation error if JSON is invalid */}
                {jsonValidationState[key] && !jsonValidationState[key].valid && !isDeleted && (
                  <Text style={styles.jsonErrorText}>{jsonValidationState[key].error}</Text>
                )}
              </View>
            );
          })}
        
        {/* Add New Field */}
        <View style={styles.addFieldContainer} testID="add-field-container">
          <Text style={styles.addFieldTitle} testID="add-field-title">Add New Field</Text>
          <View style={styles.newFieldRow}>
            <TextInput
              style={[styles.fieldInput, styles.newFieldKey]}
              value={newField.key}
              onChangeText={(text) => setNewField(prev => ({ ...prev, key: text }))}
              placeholder="Field Name"
              testID="new-field-key-input"
            />
            <TextInput
              style={[
                styles.fieldInput, 
                styles.newFieldValue,
                isLikelyJSON(newField.value) && !validateJSON(newField.value).valid 
                  ? { borderColor: colors.error } 
                  : {}
              ]}
              value={newField.value}
              onChangeText={(text) => setNewField(prev => ({ ...prev, value: text }))}
              placeholder="Field Value"
              testID="new-field-value-input"
            />
            <TouchableOpacity 
              style={styles.addFieldButton}
              onPress={handleAddField}
              testID="add-field-button"
            >
              <Ionicons name="add-circle" size={26} color={colors.info} />
            </TouchableOpacity>
          </View>
          
          {/* Add JSON validation error for new field if needed */}
          {isLikelyJSON(newField.value) && !validateJSON(newField.value).valid && (
            <Text style={styles.jsonErrorText}>{validateJSON(newField.value).error}</Text>
          )}
        </View>

        {/* Change summary */}
        {hasPendingChanges() && (
          <View style={styles.changeSummary} testID="change-summary">
            <Text style={styles.changeSummaryTitle}>Pending Changes:</Text>
            <View style={styles.changeSummaryItems}>
              {Object.keys(editedFields).filter(key => !addedFields.has(key) && isFieldModified(key) && !deletedFields.has(key)).length > 0 && (
                <View style={styles.changeSummaryItem}>
                  <View style={[styles.changeDot, { backgroundColor: colors.warning }]} />
                  <Text style={styles.changeSummaryText}>
                    {Object.keys(editedFields).filter(key => !addedFields.has(key) && isFieldModified(key) && !deletedFields.has(key)).length} modified
                  </Text>
                </View>
              )}
              {Array.from(addedFields).filter(key => !deletedFields.has(key)).length > 0 && (
                <View style={styles.changeSummaryItem}>
                  <View style={[styles.changeDot, { backgroundColor: colors.success }]} />
                  <Text style={styles.changeSummaryText}>
                    {Array.from(addedFields).filter(key => !deletedFields.has(key)).length} new
                  </Text>
                </View>
              )}
              {deletedFields.size > 0 && (
                <View style={styles.changeSummaryItem}>
                  <View style={[styles.changeDot, { backgroundColor: colors.error }]} />
                  <Text style={styles.changeSummaryText}>
                    {deletedFields.size} deleted
                  </Text>
                </View>
              )}
              {(newField.key.trim() || newField.value.trim()) && (
                <View style={styles.changeSummaryItem}>
                  <View style={[styles.changeDot, { backgroundColor: colors.info }]} />
                  <Text style={styles.changeSummaryText}>1 pending (auto-add on save)</Text>
                </View>
              )}
            </View>
          </View>
        )}

        <Button
          title="Save Changes to Tag"
          onPress={handleWriteTag}
          disabled={isWriting}
          style={[styles.writeButton, { marginTop: 20, marginBottom: 40 }]}
          testID="save-changes-button"
        />
      </ScrollView>
    )}
    </View>
  </KeyboardAvoidingView>
);
}

export default EditTab;