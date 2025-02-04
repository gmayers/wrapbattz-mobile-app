import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  TextInput, 
  StyleSheet, 
  Dimensions, 
  Platform, 
  ScrollView, 
  Alert 
} from 'react-native';
import NfcManager, { NfcTech, Ndef, NfcError } from 'react-native-nfc-manager';

// Dimensions for responsive design
const { width } = Dimensions.get('window');

// Initialize NFC Manager
NfcManager.start();

/**
 * Helper to request NFC, perform an operation, then cancel request.
 * We also show an Alert prompting the user to "scan the NFC tag" just before scanning.
 */
const withNfcManager = async (title, message, callback) => {
  // Prompt user
  Alert.alert(title, message);

  try {
    await NfcManager.requestTechnology(NfcTech.Ndef);
    const result = await callback();
    return result;
  } catch (error) {
    console.error('NFC Error:', error);
    throw error;
  } finally {
    NfcManager.cancelTechnologyRequest();
  }
};

// Convert JSON to NDEF message
const jsonToNdef = (jsonData) => {
  const payload = JSON.stringify(jsonData);
  return Ndef.encodeMessage([Ndef.textRecord(payload)]);
};

// Parse NDEF message to JSON (assuming the first record is a text record containing JSON)
const ndefToJson = (tag) => {
  try {
    if (tag.ndefMessage && tag.ndefMessage.length > 0) {
      const ndefRecord = tag.ndefMessage[0];
      const textDecoder = new TextDecoder();
      const payload = textDecoder.decode(ndefRecord.payload);

      // The first few bytes in a text record often specify language (e.g. 'en'),
      // so we slice off the first 3 bytes or so. Adjust if needed for your usage.
      const jsonString = payload.slice(3);
      return JSON.parse(jsonString);
    }
  } catch (error) {
    console.error('Error parsing NDEF:', error);
  }
  return null;
};

// Shared NFCButton component for consistent styling
const NFCButton = ({ 
  onPress, 
  title, 
  isLoading, 
  disabled,
  backgroundColor = '#007AFF',
  textColor = 'white',
  style
}) => (
  <TouchableOpacity 
    style={[
      styles.button,
      { backgroundColor },
      disabled && styles.buttonDisabled,
      style
    ]}
    onPress={onPress}
    disabled={disabled || isLoading}
  >
    <Text style={[styles.buttonText, { color: textColor }]}>
      {isLoading ? 'Processing...' : title}
    </Text>
  </TouchableOpacity>
);

/**
 * Lock NFC Tag (JSON-based)
 * Writes { locked: true, password } into the existing data on the tag
 */
export const NFCLock = ({
  onLock,
  buttonStyle,
  containerStyle,
  titleStyle,
  backgroundColor,
  textColor,
}) => {
  const [isLocking, setIsLocking] = useState(false);
  const [password, setPassword] = useState('');

  const handleLock = async () => {
    if (!password) {
      Alert.alert('Error', 'Please enter a password to lock the tag.');
      return;
    }

    try {
      setIsLocking(true);

      await withNfcManager(
        'Lock NFC Tag',
        'Please bring your device near the NFC tag to lock it.',
        async () => {
          // 1) Read existing data
          const tag = await NfcManager.getTag();
          const existingData = ndefToJson(tag) || {};

          // 2) Merge existing data with locked/password
          const newData = {
            ...existingData,
            locked: true,
            password,
          };

          // 3) Write the new data
          const ndefMessage = jsonToNdef(newData);
          await NfcManager.ndefHandler.writeNdefMessage(ndefMessage);

          Alert.alert('Success', 'NFC tag has been locked with a password.');
          onLock?.();
          setPassword('');
        }
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to lock NFC tag.');
      console.error('Error locking NFC:', error);
    } finally {
      setIsLocking(false);
    }
  };

  return (
    <View style={[styles.container, containerStyle]}>
      <Text style={[styles.title, titleStyle]}>Lock NFC Tag</Text>
      <TextInput
        style={[styles.input, styles.passwordInput]}
        value={password}
        onChangeText={setPassword}
        placeholder="Enter Password"
        secureTextEntry
      />
      <NFCButton
        title="Lock Tag"
        onPress={handleLock}
        isLoading={isLocking}
        backgroundColor={backgroundColor || '#dc3545'}
        textColor={textColor || 'white'}
        style={buttonStyle}
      />
    </View>
  );
};

/**
 * Remove Password (JSON-based)
 * Reads the existing data, checks if locked/password matches,
 * then sets locked = false, removing password from the JSON.
 */
export const NFCRemovePassword = ({
  onRemove,
  buttonStyle,
  containerStyle,
  titleStyle,
  backgroundColor,
  textColor,
}) => {
  const [isRemoving, setIsRemoving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');

  const handleRemove = async () => {
    if (!currentPassword) {
      Alert.alert('Error', 'Please enter the current password to remove.');
      return;
    }

    try {
      setIsRemoving(true);

      await withNfcManager(
        'Remove Password',
        'Please bring your device near the NFC tag to unlock it.',
        async () => {
          // 1) Read existing data
          const tag = await NfcManager.getTag();
          const existingData = ndefToJson(tag) || {};

          if (existingData.locked && existingData.password === currentPassword) {
            // 2) Modify data so locked is false & remove the password
            const newData = {
              ...existingData,
              locked: false
            };
            delete newData.password;

            // 3) Write updated data
            const ndefMessage = jsonToNdef(newData);
            await NfcManager.ndefHandler.writeNdefMessage(ndefMessage);

            Alert.alert('Success', 'Password removed. NFC tag is now unlocked.');
            onRemove?.();
            setCurrentPassword('');
          } else {
            Alert.alert('Error', 'Incorrect password or the tag is not locked.');
          }
        }
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to remove password from NFC tag.');
      console.error('Error removing password:', error);
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <View style={[styles.container, containerStyle]}>
      <Text style={[styles.title, titleStyle]}>Remove Password Protection</Text>
      <TextInput
        style={[styles.input, styles.passwordInput]}
        value={currentPassword}
        onChangeText={setCurrentPassword}
        placeholder="Enter Current Password"
        secureTextEntry
      />
      <NFCButton
        title="Remove Protection"
        onPress={handleRemove}
        isLoading={isRemoving}
        backgroundColor={backgroundColor || '#ffc107'}
        textColor={textColor || 'white'}
        style={buttonStyle}
      />
    </View>
  );
};

/**
 * Read NFC Tag
 * Reads any existing JSON data from the tag
 */
export const NFCRead = ({
  onRead,
  buttonStyle,
  containerStyle,
  titleStyle,
  backgroundColor,
  textColor,
  dataStyle,
}) => {
  const [tagData, setTagData] = useState(null);
  const [isReading, setIsReading] = useState(false);

  const handleRead = async () => {
    try {
      setIsReading(true);

      await withNfcManager(
        'Read NFC Tag',
        'Please bring your device near the NFC tag to read it.',
        async () => {
          const tag = await NfcManager.getTag();
          if (tag) {
            const parsedData = ndefToJson(tag);
            if (parsedData) {
              setTagData(parsedData);
              onRead?.(parsedData);
              Alert.alert('Success', 'NFC tag data read successfully.');
            } else {
              Alert.alert('Error', 'Failed to parse NFC tag data.');
            }
          } else {
            Alert.alert('Error', 'No NFC tag found.');
          }
        }
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to read NFC tag.');
      console.error('Error reading NFC:', error);
    } finally {
      setIsReading(false);
    }
  };

  return (
    <View style={[styles.container, containerStyle]}>
      <Text style={[styles.title, titleStyle]}>Read NFC Tag</Text>
      <NFCButton
        title="Read Tag"
        onPress={handleRead}
        isLoading={isReading}
        backgroundColor={backgroundColor || '#17a2b8'}
        textColor={textColor || 'white'}
        style={buttonStyle}
      />
      {tagData && (
        <View style={[styles.dataContainer, dataStyle]}>
          <Text style={styles.dataText}>
            {JSON.stringify(tagData, null, 2)}
          </Text>
        </View>
      )}
    </View>
  );
};

/**
 * Write to NFC Tag
 * 1) Reads existing data from the tag,
 * 2) Merges with new label/value pairs,
 * 3) Writes final merged data back to the tag
 */
export const NFCWrite = ({
  onWrite,
  buttonStyle,
  containerStyle,
  titleStyle,
  inputStyle,
  backgroundColor,
  textColor,
}) => {
  const [writeFields, setWriteFields] = useState([{ label: '', value: '' }]);
  const [isWriting, setIsWriting] = useState(false);

  // Function to add a new label/value pair
  const addWriteField = () => {
    setWriteFields([...writeFields, { label: '', value: '' }]);
  };

  // Handle changes in write fields
  const handleWriteFieldChange = (index, field, text) => {
    const updatedFields = writeFields.map((item, idx) => {
      if (idx === index) {
        return { ...item, [field]: text };
      }
      return item;
    });
    setWriteFields(updatedFields);
  };

  // Convert fields to JSON
  const convertFieldsToJson = () => {
    const jsonData = {};
    writeFields.forEach(({ label, value }) => {
      if (label.trim() !== '') {
        jsonData[label.trim()] = value.trim();
      }
    });
    return jsonData;
  };

  const handleWrite = async () => {
    try {
      setIsWriting(true);
      const newData = convertFieldsToJson();
      if (Object.keys(newData).length === 0) {
        Alert.alert('Error', 'Please enter at least one label/value pair.');
        return;
      }

      await withNfcManager(
        'Write NFC Tag',
        'Please bring your device near the NFC tag to write.',
        async () => {
          // 1) Read existing data
          const tag = await NfcManager.getTag();
          const existingData = ndefToJson(tag) || {};

          // 2) Merge existing data with the new data
          const mergedData = { ...existingData, ...newData };

          // 3) Write the merged data to the tag
          const ndefMessage = jsonToNdef(mergedData);
          await NfcManager.ndefHandler.writeNdefMessage(ndefMessage);

          Alert.alert('Success', 'Data written to NFC tag successfully!');
          onWrite?.(mergedData);

          // Reset fields after writing
          setWriteFields([{ label: '', value: '' }]);
        }
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to write to NFC tag.');
      console.error('Error writing NFC:', error);
    } finally {
      setIsWriting(false);
    }
  };

  return (
    <View style={[styles.container, containerStyle]}>
      <Text style={[styles.title, titleStyle]}>Write to NFC Tag</Text>
      <ScrollView>
        {writeFields.map((field, index) => (
          <View key={index} style={styles.writeFieldRow}>
            <TextInput
              style={[styles.input, inputStyle]}
              value={field.label}
              onChangeText={(text) => handleWriteFieldChange(index, 'label', text)}
              placeholder="Label"
              placeholderTextColor="#999"
            />
            <TextInput
              style={[styles.input, inputStyle]}
              value={field.value}
              onChangeText={(text) => handleWriteFieldChange(index, 'value', text)}
              placeholder="Value"
              placeholderTextColor="#999"
            />
          </View>
        ))}
        <TouchableOpacity style={styles.addFieldButton} onPress={addWriteField}>
          <Text style={styles.addFieldText}>+ Add Value</Text>
        </TouchableOpacity>
      </ScrollView>
      <NFCButton
        title="Write to Tag"
        onPress={handleWrite}
        isLoading={isWriting}
        backgroundColor={backgroundColor || '#007bff'}
        textColor={textColor || 'white'}
        style={buttonStyle}
      />
    </View>
  );
};

/**
 * Combined Manager with Tabs for Read, Write, Lock, Unlock
 */
export const NFCManagerComponent = () => {
  const [activeTab, setActiveTab] = useState('read');

  const handleRead = (data) => {
    console.log('Read Data:', data);
  };

  const handleWrite = (data) => {
    console.log('Written Data:', data);
  };

  const handleLock = () => {
    console.log('Tag Locked');
  };

  const handleRemove = () => {
    console.log('Password Removed');
  };

  return (
    <View style={styles.managerContainer}>
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[
            styles.tabButton, 
            activeTab === 'read' && styles.activeTabButton
          ]}
          onPress={() => setActiveTab('read')}
        >
          <Text style={[
            styles.tabText, 
            activeTab === 'read' && styles.activeTabText
          ]}>Read</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[
            styles.tabButton, 
            activeTab === 'write' && styles.activeTabButton
          ]}
          onPress={() => setActiveTab('write')}
        >
          <Text style={[
            styles.tabText, 
            activeTab === 'write' && styles.activeTabText
          ]}>Write</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[
            styles.tabButton, 
            activeTab === 'lock' && styles.activeTabButton
          ]}
          onPress={() => setActiveTab('lock')}
        >
          <Text style={[
            styles.tabText, 
            activeTab === 'lock' && styles.activeTabText
          ]}>Lock</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[
            styles.tabButton, 
            activeTab === 'unlock' && styles.activeTabButton
          ]}
          onPress={() => setActiveTab('unlock')}
        >
          <Text style={[
            styles.tabText, 
            activeTab === 'unlock' && styles.activeTabText
          ]}>Unlock</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'read' && (
        <NFCRead onRead={handleRead} />
      )}
      {activeTab === 'write' && (
        <NFCWrite onWrite={handleWrite} />
      )}
      {activeTab === 'lock' && (
        <NFCLock onLock={handleLock} />
      )}
      {activeTab === 'unlock' && (
        <NFCRemovePassword onRemove={handleRemove} />
      )}
    </View>
  );
};

// Styles for all components
const styles = StyleSheet.create({
  // Container for individual NFC operations
  container: {
    padding: 20,
    width: width * 0.95,
    backgroundColor: 'white',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    marginVertical: 10,
  },
  // Title for each NFC operation
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  // General button styling
  button: {
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  // Disabled button styling
  buttonDisabled: {
    opacity: 0.5,
  },
  // Button text styling
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  // Input fields styling
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
    color: '#333',
  },
  // Additional styling for password inputs
  passwordInput: {
    backgroundColor: '#f9f9f9',
  },
  // Container for displaying read data
  dataContainer: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  // Text styling for read data
  dataText: {
    fontSize: 14,
    color: '#333',
  },
  // Row styling for write fields
  writeFieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  // Button for adding new label/value pair
  addFieldButton: {
    padding: 10,
    backgroundColor: '#28a745',
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 15,
  },
  // Text for add field button
  addFieldText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  // Manager container for combined NFC operations
  managerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
  },
  // Tab container for switching between NFC operations
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderColor: '#ccc',
  },
  // Individual tab buttons
  tabButton: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    marginRight: 10,
  },
  // Active tab button styling
  activeTabButton: {
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
  },
  // Tab text styling
  tabText: {
    fontSize: 16,
    color: '#666',
  },
  // Active tab text styling
  activeTabText: {
    color: '#007AFF',
    fontWeight: 'bold',
  },
});

export default NFCManagerComponent;
