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
import { useTheme } from '../../../../context/ThemeContext';

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
  const { colors } = useTheme();
  const styles = getTabStyles(colors);

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
          color={colors.primary}
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
              placeholderTextColor={colors.textMuted}
            />
            <TextInput
              style={styles.input}
              placeholder="Value"
              value={field.value}
              onChangeText={(text) => onWriteFieldChange(index, 'value', text)}
              placeholderTextColor={colors.textMuted}
            />
          </View>
          {writeFields.length > 1 && (
            <TouchableOpacity
              onPress={() => onRemoveWriteField(index)}
              style={styles.removeButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="remove-circle" size={24} color={colors.error} />
            </TouchableOpacity>
          )}
        </View>
      ))}
      
      <TouchableOpacity 
        style={styles.addFieldButton}
        onPress={onAddWriteField}
      >
        <Ionicons name="add-circle" size={20} color={colors.primary} />
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
        backgroundColor={colors.surface}
        activeColor={colors.primary}
        inactiveColor={colors.textSecondary}
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

const getTabStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
  },
  tabBarContainer: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  contentContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  tabContent: {
    flex: 1,
    padding: 20,
  },
  tabTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 10,
  },
  tabDescription: {
    fontSize: 16,
    color: colors.textSecondary,
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
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
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
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  addFieldText: {
    color: colors.primary,
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
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  actionButton: {
    marginTop: 10,
    minHeight: 44,
  },
});

export default NFCTabs;