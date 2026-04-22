import React, { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../../../context/AuthContext';
import { useTheme } from '../../../context/ThemeContext';
import Button from '../../../components/Button';
import { ApiError } from '../../../api';

interface Props {
  navigation: any;
  route: {
    params: {
      emailVerificationId: string;
      email: string;
    };
  };
}

const VerifyEmailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { verifyEmail } = useAuth();
  const { colors } = useTheme();
  const { emailVerificationId, email } = route.params;

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!code.trim()) {
      setError('Enter the code from your email.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await verifyEmail({ email_verification_id: emailVerificationId, code: code.trim() });
      // On success, AuthProvider updates state → navigation routes into the app.
    } catch (e) {
      const apiError = e as ApiError;
      if (apiError.code === 'validation' || apiError.code === 'unauthorized') {
        setError('That code is incorrect or has expired.');
      } else if (apiError.code === 'network' || apiError.code === 'timeout') {
        setError('Network error — check your connection and try again.');
      } else {
        setError(apiError.message || 'Verification failed. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    Alert.alert(
      'Cancel verification?',
      'Your account exists but you need to verify before you can sign in.',
      [
        { text: 'Keep going', style: 'cancel' },
        { text: 'Back to login', onPress: () => navigation.navigate('Login') },
      ]
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle={colors.statusBar} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ flex: 1, justifyContent: 'center', paddingVertical: 40 }}>
            <View style={{ alignItems: 'center', marginBottom: 32 }}>
              <Image
                source={require('../../../../assets/logo-tooltraq.png')}
                style={{ width: 220, height: 70 }}
                resizeMode="contain"
              />
            </View>

            <Text style={{ fontSize: 22, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' }}>
              Verify your email
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: colors.textSecondary,
                textAlign: 'center',
                marginTop: 8,
                marginBottom: 24,
              }}
            >
              We sent a verification code to {email}. Enter it below to finish creating your account.
            </Text>

            <TextInput
              value={code}
              onChangeText={(value) => {
                setCode(value);
                if (error) setError('');
              }}
              autoFocus
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              placeholder="Verification code"
              placeholderTextColor={colors.textSecondary}
              style={{
                borderWidth: 1,
                borderColor: error ? colors.error ?? '#c00' : colors.borderInput,
                borderRadius: 12,
                padding: 14,
                fontSize: 18,
                textAlign: 'center',
                letterSpacing: 4,
                color: colors.textPrimary,
                backgroundColor: colors.surface,
              }}
            />

            {error ? (
              <Text style={{ color: colors.error ?? '#c00', marginTop: 8, textAlign: 'center' }}>
                {error}
              </Text>
            ) : null}

            <View style={{ marginTop: 24 }}>
              <Button title="Verify" onPress={handleSubmit} loading={submitting} />
            </View>

            <TouchableOpacity onPress={handleBack} style={{ marginTop: 20, alignItems: 'center' }}>
              <Text style={{ color: colors.textSecondary }}>Back to login</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default VerifyEmailScreen;
