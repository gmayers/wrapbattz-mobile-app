// NFCTabs.js
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Button from '../../../../components/Button';
import { PasswordInput } from '../../../../components/TextInput';
import TabBar from '../../../../components/TabBar';

const NFCTabs = ({
  activeTab,
  onTabChange,
  isProcessing = false,
  writeFields = [],
  onWriteFieldChange,
  onAddWriteField,
  onRemoveWriteField,
  lockPassword = '',
  onLockPasswordChange,
  unlockPassword = '',
  onUnlockPasswordChange,
  onReadNfc,
  onWriteNfc,
  onLockNfc,
  onUnlockNfc,
}) => {
  // Tab configuration
  const tabs = [
    {
      key: 'read',
      title: 'Read',
      icon: <Ionicons name="scan-outline" size={20} />,
    },
    {
      key: 'write',
      title: 'Write',
      icon: <Ionicons name="create-outline" size={20} />,
    },
    {
      key: 'lock',
      title: 'Lock',
      icon: <Ionicons name="lock-closed-outline" size={20} />,
    },
    {
      key: 'unlock',
      title: 'Unlock',
      icon: <Ionicons name="lock-open-outline" size={20} />,
    },
  ];

  // Render read tab content
  const renderReadTab = () => (
    <View style={styles.tabContent}>
      <Text style={styles.tabTitle}>Read NFC Tag</Text>
      <Text style={styles.tabDescription}>
        Place your device near an NFC tag to read its contents.
      </Text>
      <View style={styles.iconContainer}>
        <Ionicons 
          name="scan-circle-outline" 
          size={80} 
          color="#007AFF"
        />
      </View>
      <Button
        title={isProcessing ? "Reading..." : "Read Tag"}
        onPress={onReadNfc}
        disabled={isProcessing}
        style={styles.actionButton}
      />
    </View>
  );

  // Render write tab content
  const renderWriteTab = () => (
    <ScrollView style={styles.tabContent}>
      <Text style={styles.tabTitle}>Write to NFC Tag</Text>
      <Text style={styles.tabDescription}>
        Enter the data you want to write to the tag.
      </Text>
      
      {writeFields.map((field, index) => (
        <View key={index} style={styles.writeFieldContainer}>
          <View style={styles.fieldInputs}>
            <TextInput
              style={styles.input}
              placeholder="Label"
              value={field.label}
              onChangeText={(text) => onWriteFieldChange(index, 'label', text)}
              placeholderTextColor="#999"
            />
            <TextInput
              style={styles.input}
              placeholder="Value"
              value={field.value}
              onChangeText={(text) => onWriteFieldChange(index, 'value', text)}
              placeholderTextColor="#999"
            />
          </View>
          {writeFields.length > 1 && (
            <TouchableOpacity
              onPress={() => onRemoveWriteField(index)}
              style={styles.removeButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="remove-circle" size={24} color="#FF3B30" />
            </TouchableOpacity>
          )}
        </View>
      ))}
      
      <TouchableOpacity 
        style={styles.addFieldButton}
        onPress={onAddWriteField}
      >
        <Ionicons name="add-circle" size={20} color="#007AFF" />
        <Text style={styles.addFieldText}>Add Field</Text>
      </TouchableOpacity>

      <Button
        title={isProcessing ? "Writing..." : "Write to Tag"}
        onPress={onWriteNfc}
        disabled={isProcessing || !writeFields.some(f => f.label && f.value)}
        style={styles.actionButton}
      />
    </ScrollView>
  );

  // Render lock tab content
  const renderLockTab = () => (
    <View style={styles.tabContent}>
      <Text style={styles.tabTitle}>Lock NFC Tag</Text>
      <Text style={styles.tabDescription}>
        Set a password to lock the NFC tag. Make sure to remember this password.
      </Text>
      <View style={styles.passwordContainer}>
        <PasswordInput
          value={lockPassword}
          onChangeText={onLockPasswordChange}
          placeholder="Enter password to lock"
          style={styles.passwordInput}
        />
        <Text style={styles.passwordHint}>
          Password must be at least 6 characters
        </Text>
      </View>
      <Button
        title={isProcessing ? "Locking..." : "Lock Tag"}
        onPress={onLockNfc}
        disabled={isProcessing || !lockPassword || lockPassword.length < 6}
        style={styles.actionButton}
      />
    </View>
  );

  // Render unlock tab content
  const renderUnlockTab = () => (
    <View style={styles.tabContent}>
      <Text style={styles.tabTitle}>Unlock NFC Tag</Text>
      <Text style={styles.tabDescription}>
        Enter the password used to lock the tag.
      </Text>
      <View style={styles.passwordContainer}>
        <PasswordInput
          value={unlockPassword}
          onChangeText={onUnlockPasswordChange}
          placeholder="Enter password to unlock"
          style={styles.passwordInput}
        />
      </View>
      <Button
        title={isProcessing ? "Unlocking..." : "Unlock Tag"}
        onPress={onUnlockNfc}
        disabled={isProcessing || !unlockPassword}
        style={styles.actionButton}
      />
    </View>
  );

  // Render active tab content
  const renderActiveTabContent = () => {
    switch (activeTab) {
      case 'read':
        return renderReadTab();
      case 'write':
        return renderWriteTab();
      case 'lock':
        return renderLockTab();
      case 'unlock':
        return renderUnlockTab();
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <TabBar
        tabs={tabs}
        activeTab={activeTab}
        onTabPress={onTabChange}
        backgroundColor="#F9F9F9"
        activeColor="#007AFF"
        inactiveColor="#666666"
        showIcons
        showLabels
        height={50}
        containerStyle={styles.tabBarContainer}
      />
      <View style={styles.contentContainer}>
        {renderActiveTabContent()}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabBarContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  contentContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  tabContent: {
    flex: 1,
    padding: 20,
  },
  tabTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  tabDescription: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    lineHeight: 22,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 30,
  },
  writeFieldContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  fieldInputs: {
    flex: 1,
    flexDirection: 'row',
    gap: 10,
  },
  input: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    backgroundColor: '#F8F8F8',
    color: '#333',
  },
  removeButton: {
    marginLeft: 10,
    padding: 5,
  },
  addFieldButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 20,
  },
  addFieldText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  passwordContainer: {
    marginBottom: 20,
  },
  passwordInput: {
    marginBottom: 8,
  },
  passwordHint: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  actionButton: {
    marginTop: 10,
    minHeight: 44,
  },
});

export default NFCTabs;