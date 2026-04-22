import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { apiEvents } from '../api';

export function SessionExpiryAlert() {
  const showing = useRef(false);

  useEffect(() => {
    const off = apiEvents.on('session-expired', () => {
      if (showing.current) return;
      showing.current = true;
      Alert.alert(
        'Session expired',
        'Please sign in again to continue.',
        [
          {
            text: 'OK',
            onPress: () => {
              showing.current = false;
            },
          },
        ],
        { cancelable: false, onDismiss: () => { showing.current = false; } }
      );
    });
    return off;
  }, []);

  return null;
}
