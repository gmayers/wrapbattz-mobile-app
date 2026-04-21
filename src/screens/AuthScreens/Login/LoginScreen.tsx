// src/screens/AuthScreens/Login/LoginScreen.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Image,
  Alert,
  Switch,
  TextInput as RNTextInput,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import { useTheme } from '../../../context/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import { LoginForm, ValidationResult, NavigationProp } from '../../../types';
import { FormValidation } from '../../../utils/FormValidation';
import FormField from '../../../components/Form/FormField';
import PasswordField from '../../../components/Form/PasswordField';
import Button from '../../../components/Button';
import DeviceAuthService, { BiometricCapability } from '../../../services/DeviceAuthService';
import PinAuthService from '../../../services/PinAuthService';
import PinModal, { PinModalMode } from './PinModal';

type PinFlow =
  | { kind: 'idle' }
  | { kind: 'entry'; error?: string; attemptsRemaining?: number }
  | { kind: 'setup' }
  | { kind: 'confirm'; firstPin: string; error?: string };

const LoginScreen: React.FC = () => {
  const {
    login,
    loginWithStoredCredentials,
    enableBiometricUnlock,
    enablePinUnlock,
  } = useAuth() as any;
  const { colors, fonts } = useTheme();
  const navigation = useNavigation<NavigationProp>();

  const [formData, setFormData] = useState<LoginForm>({ email: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string>('');
  const passwordInputRef = useRef<RNTextInput>(null);

  const [staySignedIn, setStaySignedIn] = useState<boolean>(true);
  const [biometricCap, setBiometricCap] = useState<BiometricCapability | null>(null);
  const [biometricEnabled, setBiometricEnabled] = useState<boolean>(false);
  const [pinEnabled, setPinEnabled] = useState<boolean>(false);
  const [hasStoredCreds, setHasStoredCreds] = useState<boolean>(false);
  const [pinFlow, setPinFlow] = useState<PinFlow>({ kind: 'idle' });

  const refreshQuickAuthState = useCallback(async () => {
    const [cap, bio, pin, staySet, token] = await Promise.all([
      DeviceAuthService.getBiometricCapability(),
      DeviceAuthService.isBiometricEnabled(),
      DeviceAuthService.isPinEnabled(),
      DeviceAuthService.getStaySignedIn(),
      DeviceAuthService.getStoredRefreshToken(),
    ]);
    setBiometricCap(cap);
    setBiometricEnabled(bio);
    setPinEnabled(pin);
    setStaySignedIn(staySet);
    setHasStoredCreds(!!token);
  }, []);

  useEffect(() => {
    refreshQuickAuthState();
  }, [refreshQuickAuthState]);

  useEffect(() => {
    // Auto-prompt biometric on mount if it's enabled and we have stored creds
    (async () => {
      const [cap, bio, token] = await Promise.all([
        DeviceAuthService.getBiometricCapability(),
        DeviceAuthService.isBiometricEnabled(),
        DeviceAuthService.getStoredRefreshToken(),
      ]);
      if (bio && token && cap.available && cap.enrolled) {
        await handleBiometricUnlock(cap);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validateForm = (): boolean => {
    const rules = {
      email: FormValidation.commonRules.email(true),
      password: [
        { type: 'required' as const, message: 'Password is required' },
        { type: 'minLength' as const, value: 6, message: 'Password must be at least 6 characters' },
      ],
    };
    const result: ValidationResult = FormValidation.validateForm(formData, rules);
    setErrors(result.errors);
    return result.isValid;
  };

  const handleChange = (field: keyof LoginForm, value: string): void => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
    if (loginError) setLoginError('');
  };

  const handleToggleStaySignedIn = async (value: boolean) => {
    setStaySignedIn(value);
    await DeviceAuthService.setStaySignedIn(value);
  };

  const promptEnableQuickAuth = useCallback(
    async (cap: BiometricCapability | null) => {
      const buttons: Array<{ text: string; onPress?: () => void; style?: 'cancel' | 'default' }> = [];
      if (cap?.available && cap?.enrolled) {
        buttons.push({
          text: `Use ${cap.label}`,
          onPress: async () => {
            try {
              await enableBiometricUnlock();
              await refreshQuickAuthState();
            } catch (e: any) {
              Alert.alert(`${cap.label} setup failed`, e?.message || 'Please try again.');
            }
          },
        });
      }
      buttons.push({
        text: 'Use PIN',
        onPress: () => setPinFlow({ kind: 'setup' }),
      });
      buttons.push({ text: 'Not now', style: 'cancel' });

      Alert.alert(
        'Faster sign-in?',
        'Skip your password next time on this device.',
        buttons,
      );
    },
    [enableBiometricUnlock, refreshQuickAuthState],
  );

  const handleLogin = async (): Promise<void> => {
    if (!validateForm()) return;
    setIsLoading(true);
    setLoginError('');
    try {
      await login(formData.email, formData.password);
      // Already-enrolled devices skip the upsell
      const [bio, pin] = await Promise.all([
        DeviceAuthService.isBiometricEnabled(),
        DeviceAuthService.isPinEnabled(),
      ]);
      if (!bio && !pin) {
        const cap = await DeviceAuthService.getBiometricCapability();
        // Defer to next tick so navigation can settle
        setTimeout(() => promptEnableQuickAuth(cap), 200);
      }
    } catch (error: any) {
      console.error('Login error:', error);
      let errorMessage =
        'Unable to connect to the server. Please check your internet connection and try again.';
      if (error.response) {
        const status = error.response.status;
        if (status === 401) {
          errorMessage = 'Invalid email or password. Please try again.';
        } else if (status === 400) {
          errorMessage =
            error.response.data?.detail ||
            error.response.data?.message ||
            'Invalid credentials. Please check your email and password.';
        } else if (status === 403) {
          errorMessage = 'Your account has been disabled. Please contact support.';
        } else if (status >= 500) {
          errorMessage = 'Server error. Please try again later.';
        } else {
          errorMessage =
            error.response.data?.detail ||
            error.response.data?.message ||
            'Login failed. Please try again.';
        }
      } else if (error.request) {
        errorMessage = 'No response from server. Please check your internet connection.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      setLoginError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBiometricUnlock = async (capOverride?: BiometricCapability) => {
    const cap = capOverride || biometricCap;
    if (!cap?.available || !cap.enrolled) return;
    setLoginError('');
    const ok = await DeviceAuthService.authenticateWithBiometrics(`Sign in with ${cap.label}`);
    if (!ok) return;
    try {
      setIsLoading(true);
      await loginWithStoredCredentials();
    } catch (e: any) {
      setLoginError(e?.message || 'Could not sign in with biometrics. Please use your password.');
      await refreshQuickAuthState();
    } finally {
      setIsLoading(false);
    }
  };

  const handlePinEntrySubmit = async (pin: string) => {
    const result = await PinAuthService.verifyPin(pin);
    if (!result.success) {
      if (result.locked) {
        setPinFlow({ kind: 'idle' });
        Alert.alert(
          'Too many attempts',
          'PIN sign-in is now disabled on this device. Please sign in with your password.',
        );
        await refreshQuickAuthState();
        return;
      }
      setPinFlow({
        kind: 'entry',
        error: 'Incorrect PIN',
        attemptsRemaining: result.attemptsRemaining,
      });
      return;
    }
    setPinFlow({ kind: 'idle' });
    try {
      setIsLoading(true);
      await loginWithStoredCredentials();
    } catch (e: any) {
      setLoginError(e?.message || 'Could not sign in. Please use your password.');
      await refreshQuickAuthState();
    } finally {
      setIsLoading(false);
    }
  };

  const handlePinSetupSubmit = async (pin: string) => {
    setPinFlow({ kind: 'confirm', firstPin: pin });
  };

  const handlePinConfirmSubmit = async (pin: string) => {
    if (pinFlow.kind !== 'confirm') return;
    if (pin !== pinFlow.firstPin) {
      setPinFlow({ kind: 'confirm', firstPin: pinFlow.firstPin, error: 'PINs do not match' });
      return;
    }
    try {
      await enablePinUnlock(pin);
      setPinFlow({ kind: 'idle' });
      await refreshQuickAuthState();
      Alert.alert('PIN set', 'You can use your PIN to sign in on this device.');
    } catch (e: any) {
      setPinFlow({
        kind: 'confirm',
        firstPin: pinFlow.firstPin,
        error: e?.message || 'Could not save PIN',
      });
    }
  };

  const handleGoogleSignIn = () => {
    Alert.alert(
      'Google sign-in coming soon',
      'Backend endpoint (/auth/google/) and OAuth client configuration required before this will work.',
    );
  };

  const handleAppleSignIn = () => {
    Alert.alert(
      'Apple sign-in coming soon',
      'Backend endpoint (/auth/apple/) and Apple Developer configuration required before this will work.',
    );
  };

  const pinModalProps = (() => {
    if (pinFlow.kind === 'entry') {
      return {
        visible: true,
        mode: 'entry' as PinModalMode,
        errorText: pinFlow.error,
        attemptsRemaining: pinFlow.attemptsRemaining,
        onSubmit: handlePinEntrySubmit,
        onCancel: () => setPinFlow({ kind: 'idle' }),
      };
    }
    if (pinFlow.kind === 'setup') {
      return {
        visible: true,
        mode: 'setup' as PinModalMode,
        onSubmit: handlePinSetupSubmit,
        onCancel: () => setPinFlow({ kind: 'idle' }),
      };
    }
    if (pinFlow.kind === 'confirm') {
      return {
        visible: true,
        mode: 'confirm' as PinModalMode,
        errorText: pinFlow.error,
        onSubmit: handlePinConfirmSubmit,
        onCancel: () => setPinFlow({ kind: 'idle' }),
      };
    }
    return {
      visible: false,
      mode: 'entry' as PinModalMode,
      onSubmit: async () => {},
      onCancel: () => setPinFlow({ kind: 'idle' }),
    };
  })();

  const showBiometricButton =
    biometricEnabled && hasStoredCreds && biometricCap?.available && biometricCap?.enrolled;
  const showPinButton = pinEnabled && hasStoredCreds;
  const showAppleButton = Platform.OS === 'ios';

  const biometricIcon = (() => {
    if (!biometricCap) return 'finger-print';
    if (biometricCap.type === 'faceId' || biometricCap.type === 'generic') return 'scan-outline';
    return 'finger-print';
  })();

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
            {/* Logo Section */}
            <View style={{ alignItems: 'center', marginBottom: 40 }}>
              <Image
                source={require('../../../../assets/logo-tooltraq.png')}
                style={{ width: 260, height: 82, alignSelf: 'center' }}
                resizeMode="contain"
              />
              <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 8, marginTop: 12 }}>Welcome Back</Text>
              <Text style={{ fontSize: 16, color: colors.textSecondary }}>Sign in to continue</Text>
            </View>

            {/* Error Banner */}
            {loginError ? (
              <View style={{ backgroundColor: colors.errorBackground, borderWidth: 1, borderColor: colors.error, borderRadius: 8, padding: 12, marginBottom: 20, width: '100%' }}>
                <Text style={{ color: colors.errorText, fontSize: 14, textAlign: 'center', fontWeight: '500' }}>{loginError}</Text>
              </View>
            ) : null}

            {/* Quick-auth shortcuts */}
            {(showBiometricButton || showPinButton) && (
              <View style={styles.quickAuthWrap}>
                {showBiometricButton && (
                  <TouchableOpacity
                    style={[styles.quickAuthBtn, { borderColor: colors.primary, backgroundColor: colors.primaryTint10 }]}
                    onPress={() => handleBiometricUnlock()}
                    testID="biometric-login-button"
                  >
                    <Ionicons name={biometricIcon as any} size={22} color={colors.primary} />
                    <Text style={[styles.quickAuthText, { color: colors.primary }]}>
                      Sign in with {biometricCap?.label}
                    </Text>
                  </TouchableOpacity>
                )}
                {showPinButton && (
                  <TouchableOpacity
                    style={[styles.quickAuthBtn, { borderColor: colors.primary, backgroundColor: colors.primaryTint10 }]}
                    onPress={() => setPinFlow({ kind: 'entry' })}
                    testID="pin-login-button"
                  >
                    <Ionicons name="keypad-outline" size={22} color={colors.primary} />
                    <Text style={[styles.quickAuthText, { color: colors.primary }]}>Sign in with PIN</Text>
                  </TouchableOpacity>
                )}
                <View style={[styles.divider, { borderTopColor: colors.borderLight }]}>
                  <Text style={[styles.dividerText, { color: colors.textMuted, backgroundColor: colors.background }]}>
                    or use password
                  </Text>
                </View>
              </View>
            )}

            {/* Form Section */}
            <View style={{ width: '100%' }}>
              <FormField
                label="Email"
                value={formData.email}
                onChangeText={(value) => handleChange('email', value)}
                placeholder="Enter your email"
                keyboardType="email-address"
                autoCapitalize="none"
                error={errors.email}
                required
              />

              <PasswordField
                label="Password"
                value={formData.password}
                onChangeText={(value) => handleChange('password', value)}
                placeholder="Enter your password"
                error={errors.password}
                required
              />

              {/* Stay signed in toggle */}
              <View style={styles.staySignedInRow}>
                <Text style={{ fontSize: 15, color: colors.textSecondary }}>Stay signed in</Text>
                <Switch
                  value={staySignedIn}
                  onValueChange={handleToggleStaySignedIn}
                  trackColor={{ false: colors.borderInput, true: colors.primary }}
                  thumbColor="#FFFFFF"
                  testID="stay-signed-in-toggle"
                />
              </View>

              <Button
                title="Sign In"
                onPress={handleLogin}
                loading={isLoading}
                textColorProp="black"
                style={{ marginTop: 12, backgroundColor: colors.primary }}
                testID="login-button"
              />

              {/* Social login */}
              <View style={styles.socialWrap}>
                <View style={[styles.divider, { borderTopColor: colors.borderLight }]}>
                  <Text style={[styles.dividerText, { color: colors.textMuted, backgroundColor: colors.background }]}>
                    or continue with
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.socialBtn, { borderColor: colors.borderInput, backgroundColor: colors.card }]}
                  onPress={handleGoogleSignIn}
                  testID="google-login-button"
                >
                  <Ionicons name="logo-google" size={20} color={colors.textPrimary} />
                  <Text style={[styles.socialText, { color: colors.textPrimary }]}>Continue with Google</Text>
                </TouchableOpacity>

                {showAppleButton && (
                  <TouchableOpacity
                    style={[styles.socialBtn, { borderColor: colors.borderInput, backgroundColor: '#000' }]}
                    onPress={handleAppleSignIn}
                    testID="apple-login-button"
                  >
                    <Ionicons name="logo-apple" size={20} color="#FFF" />
                    <Text style={[styles.socialText, { color: '#FFF' }]}>Continue with Apple</Text>
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity
                style={{ alignItems: 'center', marginTop: 20 }}
                testID="forgot-password-button"
                onPress={() => navigation.navigate('ForgotPassword')}
              >
                <Text style={{ color: colors.primary, fontSize: 16 }}>
                  Forgot Password?
                </Text>
              </TouchableOpacity>

              {/* Register Section */}
              <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 20, paddingTop: 20, borderTopWidth: 1, borderTopColor: colors.borderLight }}>
                <Text style={{ fontSize: 16, color: colors.textSecondary }}>Don't have an account?</Text>
                <TouchableOpacity
                  testID="register-button"
                  onPress={() => navigation.navigate('Register')}
                >
                  <Text style={{ color: colors.primary, fontSize: 16, fontWeight: 'bold', marginLeft: 5 }}>Create Account</Text>
                </TouchableOpacity>
              </View>

              {/* Pricing Button — hidden during backend migration */}
              {/*
              <View style={{ alignItems: 'center', marginTop: 20 }}>
                <TouchableOpacity
                  style={{ backgroundColor: colors.surfaceAlt, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 25, borderWidth: 1, borderColor: colors.borderInput, width: '100%', alignItems: 'center' }}
                  testID="pricing-button"
                  onPress={() => navigation.navigate('Pricing')}
                >
                  <Text style={{ fontSize: 16, color: colors.textPrimary, fontWeight: '600' }}>View Service Plans</Text>
                </TouchableOpacity>
              </View>
              */}

            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <PinModal {...pinModalProps} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  quickAuthWrap: {
    marginBottom: 20,
    gap: 12,
  },
  quickAuthBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  quickAuthText: { fontSize: 16, fontWeight: '600' },
  staySignedInRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  socialWrap: { marginTop: 28, gap: 12 },
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  socialText: { fontSize: 16, fontWeight: '600' },
  divider: {
    marginVertical: 6,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  dividerText: {
    position: 'relative',
    top: -10,
    fontSize: 12,
    paddingHorizontal: 10,
  },
});

export default LoginScreen;
