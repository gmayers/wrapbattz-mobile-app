import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Dimensions, Platform } from 'react-native';
import NfcManager, { NfcTech, Ndef, NfcAdapter, NfcError } from 'react-native-nfc-manager';

const { width } = Dimensions.get('window');

// Initialize NFC Manager
NfcManager.start();

// Helper function to handle NFC session
const withNfcManager = async (callback) => {
  try {
    await NfcManager.requestTechnology(NfcTech.NfcA);
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

// Parse NDEF message to JSON
const ndefToJson = (tag) => {
  try {
    if (tag.ndefMessage && tag.ndefMessage.length > 0) {
      const ndefRecord = tag.ndefMessage[0];
      const textDecoder = new TextDecoder();
      const payload = textDecoder.decode(ndefRecord.payload);
      // Remove language code bytes from the beginning
      const jsonString = payload.slice(3);
      return JSON.parse(jsonString);
    }
  } catch (error) {
    console.error('Error parsing NDEF:', error);
  }
  return null;
};

// Shared NFCButton component
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

// NFC Lock Component
export const NFCLock = ({
  onLock,
  buttonStyle,
  containerStyle,
  titleStyle,
  backgroundColor,
  textColor,
}) => {
  const [isLocking, setIsLocking] = useState(false);
  
  const handleLock = async () => {
    try {
      setIsLocking(true);
      await withNfcManager(async () => {
        const tag = await NfcManager.getTag();
        if (tag) {
          // Lock tag using NfcA commands
          await NfcManager.nfcAHandler.transceive([0x28, 0x00, 0x00, 0x00]); // Lock command
          onLock?.();
        }
      });
    } catch (error) {
      console.error('Error locking NFC:', error);
    } finally {
      setIsLocking(false);
    }
  };

  return (
    <View style={[styles.container, containerStyle]}>
      <Text style={[styles.title, titleStyle]}>Lock NFC Tag</Text>
      <NFCButton
        title="Lock Tag"
        onPress={handleLock}
        isLoading={isLocking}
        backgroundColor={backgroundColor}
        textColor={textColor}
        style={buttonStyle}
      />
    </View>
  );
};

// NFC Read Component
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
      await withNfcManager(async () => {
        const tag = await NfcManager.getTag();
        if (tag) {
          const parsedData = ndefToJson(tag);
          setTagData(parsedData);
          onRead?.(parsedData);
          return parsedData;
        }
      });
    } catch (error) {
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
        backgroundColor={backgroundColor}
        textColor={textColor}
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

// NFC Write Component
export const NFCWrite = ({
  onWrite,
  buttonStyle,
  containerStyle,
  titleStyle,
  inputStyle,
  backgroundColor,
  textColor,
  placeholder = "Enter JSON data to write",
}) => {
  const [message, setMessage] = useState('');
  const [isWriting, setIsWriting] = useState(false);

  const handleWrite = async () => {
    try {
      setIsWriting(true);
      let jsonData;
      try {
        jsonData = JSON.parse(message);
      } catch (error) {
        console.error('Invalid JSON format:', error);
        return;
      }

      await withNfcManager(async () => {
        const ndefMessage = jsonToNdef(jsonData);
        await NfcManager.nfcAHandler.transceive([0xA2, 0x04, ...ndefMessage]); // Write command
        onWrite?.(jsonData);
      });
      setMessage('');
    } catch (error) {
      console.error('Error writing NFC:', error);
    } finally {
      setIsWriting(false);
    }
  };

  return (
    <View style={[styles.container, containerStyle]}>
      <Text style={[styles.title, titleStyle]}>Write to NFC Tag</Text>
      <TextInput
        style={[styles.input, inputStyle]}
        value={message}
        onChangeText={setMessage}
        placeholder={placeholder}
        placeholderTextColor="#999"
        multiline
      />
      <NFCButton
        title="Write to Tag"
        onPress={handleWrite}
        isLoading={isWriting}
        disabled={!message}
        backgroundColor={backgroundColor}
        textColor={textColor}
        style={buttonStyle}
      />
    </View>
  );
};

// NFC Password Protect Component
export const NFCPassword = ({
  onProtect,
  buttonStyle,
  containerStyle,
  titleStyle,
  inputStyle,
  backgroundColor,
  textColor,
}) => {
  const [password, setPassword] = useState('');
  const [isProtecting, setIsProtecting] = useState(false);

  const handleProtect = async () => {
    try {
      setIsProtecting(true);
      await withNfcManager(async () => {
        // Convert password to bytes
        const passwordBytes = new TextEncoder().encode(password);
        // Send password protection command
        await NfcManager.nfcAHandler.transceive([0x1B, ...passwordBytes]); // PWD_AUTH command
        onProtect?.(password);
      });
      setPassword('');
    } catch (error) {
      console.error('Error protecting NFC:', error);
    } finally {
      setIsProtecting(false);
    }
  };

  return (
    <View style={[styles.container, containerStyle]}>
      <Text style={[styles.title, titleStyle]}>Password Protect Tag</Text>
      <TextInput
        style={[styles.input, inputStyle]}
        value={password}
        onChangeText={setPassword}
        placeholder="Enter password"
        placeholderTextColor="#999"
        secureTextEntry
      />
      <NFCButton
        title="Protect Tag"
        onPress={handleProtect}
        isLoading={isProtecting}
        disabled={!password}
        backgroundColor={backgroundColor}
        textColor={textColor}
        style={buttonStyle}
      />
    </View>
  );
};

// NFC Remove Password Component
export const NFCRemovePassword = ({
  onRemove,
  buttonStyle,
  containerStyle,
  titleStyle,
  inputStyle,
  backgroundColor,
  textColor,
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [isRemoving, setIsRemoving] = useState(false);

  const handleRemove = async () => {
    try {
      setIsRemoving(true);
      await withNfcManager(async () => {
        // Convert password to bytes
        const passwordBytes = new TextEncoder().encode(currentPassword);
        // Send remove protection command
        await NfcManager.nfcAHandler.transceive([0x1B, ...passwordBytes, 0x00]); // Remove PWD command
        onRemove?.(currentPassword);
      });
      setCurrentPassword('');
    } catch (error) {
      console.error('Error removing password:', error);
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <View style={[styles.container, containerStyle]}>
      <Text style={[styles.title, titleStyle]}>Remove Password Protection</Text>
      <TextInput
        style={[styles.input, inputStyle]}
        value={currentPassword}
        onChangeText={setCurrentPassword}
        placeholder="Enter current password"
        placeholderTextColor="#999"
        secureTextEntry
      />
      <NFCButton
        title="Remove Protection"
        onPress={handleRemove}
        isLoading={isRemoving}
        disabled={!currentPassword}
        backgroundColor={backgroundColor}
        textColor={textColor}
        style={buttonStyle}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    width: width * 0.9,
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
    margin: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  button: {
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
    color: '#333',
  },
  dataContainer: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  dataText: {
    fontSize: 14,
    color: '#333',
  },
});

