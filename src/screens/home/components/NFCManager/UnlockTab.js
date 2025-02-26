import React from 'react';
import { View, Text } from 'react-native';
import Button from '../../../../components/Button';
import { PasswordInput } from '../../../../components/TextInput';
import { styles } from './styles';

const UnlockTab = ({ unlockPassword, setUnlockPassword, handleUnlockNfc, isUnlocking }) => {
  return (
    <View style={styles.nfcTabContent}>
      <Text style={styles.nfcTabTitle}>Unlock NFC Tag</Text>
      <Text style={styles.nfcTabSubtitle}>
        Remove the password from your NFC tag.
      </Text>
      <PasswordInput
        placeholder="Enter Current Password"
        value={unlockPassword}
        onChangeText={setUnlockPassword}
      />
      <Button
        title="Unlock Tag"
        onPress={handleUnlockNfc}
        disabled={isUnlocking}
        isLoading={isUnlocking}
        style={styles.unlockButton}
      />
    </View>
  );
};

export default UnlockTab;