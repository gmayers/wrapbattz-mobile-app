import React from 'react';
import { View, Text } from 'react-native';
import Button from '../../../../components/Button';
import { PasswordInput } from '../../../../components/TextInput';
import { styles } from './styles';

const LockTab = ({ lockPassword, setLockPassword, handleLockNfc, isLocking }) => {
  return (
    <View style={styles.nfcTabContent}>
      <Text style={styles.nfcTabTitle}>Lock NFC Tag</Text>
      <Text style={styles.nfcTabSubtitle}>
        Add a password to secure your NFC tag.
      </Text>
      <PasswordInput
        placeholder="Enter Password"
        value={lockPassword}
        onChangeText={setLockPassword}
      />
      <Button
        title="Lock Tag"
        onPress={handleLockNfc}
        disabled={isLocking}
        isLoading={isLocking}
        style={styles.lockButton}
      />
    </View>
  );
};

export default LockTab;
