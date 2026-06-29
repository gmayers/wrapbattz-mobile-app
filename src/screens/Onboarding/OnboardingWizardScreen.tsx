// Onboarding wizard — a single data-driven container that renders whatever
// step the backend reports for this user. The step machine (owner vs invited,
// ordering, labels) lives server-side at GET /account/onboarding/ and is shared
// with the web wizard, so the two surfaces never drift.
//
// Flow:
//   1. Fetch OnboardingState (flow + ordered steps + current_step).
//   2. Render a progress header from `steps[]` and the body for `current_step`.
//   3. A step performs its domain action (create org/site/tool, invite…) then
//      calls advance(); the container PATCHes onboarding_step to the next key.
//   4. On the final step, advance() sets has_completed_onboarding → AuthContext
//      flips onboardingComplete → navigation swaps to the main app.
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { account } from '../../api/endpoints';
import { ApiError } from '../../api/errors';
import type { OnboardingState } from '../../api/types';
import { STEP_COMPONENTS, type WizardData } from './steps';

const OnboardingWizardScreen: React.FC = () => {
  const { colors } = useTheme();
  const { updateOnboarding, refreshUser, logout } = useAuth();

  const [state, setState] = useState<OnboardingState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyAdvancing, setBusyAdvancing] = useState(false);
  const [wizardData, setWizardDataState] = useState<WizardData>({});

  const setWizardData = useCallback((patch: Partial<WizardData>) => {
    setWizardDataState((prev) => ({ ...prev, ...patch }));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await account.getOnboarding();
      setState(next);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'unauthorized') return;
      setError(
        (e instanceof ApiError && e.message) || 'Failed to load onboarding. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const steps = state?.steps ?? [];
  const currentKey = state?.current_step ?? null;
  const currentIndex = steps.findIndex((s) => s.key === currentKey);
  const isLast = currentIndex >= 0 && currentIndex === steps.length - 1;
  const canGoBack = currentIndex > 0;

  const complete = useCallback(async () => {
    setBusyAdvancing(true);
    try {
      await updateOnboarding({ has_completed_onboarding: true, onboarding_step: 'completed' });
      // Pull fresh UserMe so onboardingComplete flips and navigation swaps to
      // the main app. The screen unmounts on success, so no need to clear busy.
      await refreshUser();
    } catch (e) {
      Alert.alert(
        'Error',
        (e instanceof ApiError && e.message) || 'Could not finish setup. Please try again.'
      );
      setBusyAdvancing(false);
    }
  }, [updateOnboarding, refreshUser]);

  const goToStep = useCallback(
    async (stepKey: string) => {
      setBusyAdvancing(true);
      try {
        await updateOnboarding({ onboarding_step: stepKey });
        await load();
      } catch (e) {
        Alert.alert(
          'Error',
          (e instanceof ApiError && e.message) || 'Could not continue. Please try again.'
        );
      } finally {
        setBusyAdvancing(false);
      }
    },
    [updateOnboarding, load]
  );

  const advance = useCallback(() => {
    if (isLast || currentIndex < 0) {
      // currentIndex < 0 means the server's current_step isn't in the rendered
      // steps[] (e.g. a stale "completed" while has_completed_onboarding is
      // still false). Finish setup rather than leaving the primary button a
      // silent no-op — never trap the user on a step a tap can't move past.
      complete();
    } else {
      goToStep(steps[currentIndex + 1].key);
    }
  }, [isLast, complete, currentIndex, goToStep, steps]);

  const goBack = useCallback(() => {
    if (canGoBack) goToStep(steps[currentIndex - 1].key);
  }, [canGoBack, goToStep, steps, currentIndex]);

  const confirmLogout = useCallback(() => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: logout },
    ]);
  }, [logout]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (error || !state || !currentKey) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: colors.background }]}>
        <Ionicons name="alert-circle-outline" size={44} color={colors.error || '#EF4444'} />
        <Text style={[styles.errorText, { color: colors.textSecondary }]}>
          {error || 'Onboarding is unavailable right now.'}
        </Text>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: colors.primary }]}
          onPress={load}
        >
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const StepBody = STEP_COMPONENTS[currentKey];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Progress header */}
      <View style={[styles.header, { borderBottomColor: colors.borderLight }]}>
        <View style={styles.headerTopRow}>
          <Text style={[styles.stepCounter, { color: colors.primary }]}>
            Step {Math.max(currentIndex + 1, 1)} of {steps.length}
          </Text>
          <TouchableOpacity onPress={confirmLogout} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[styles.logoutLink, { color: colors.textMuted }]}>Log out</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.progressTrack}>
          {steps.map((s, i) => {
            const reached = i <= currentIndex;
            return (
              <View
                key={s.key}
                style={[
                  styles.progressSegment,
                  {
                    backgroundColor: reached ? colors.primary : colors.borderLight,
                    marginLeft: i === 0 ? 0 : 4,
                  },
                ]}
              />
            );
          })}
        </View>
        <Text style={[styles.stepLabel, { color: colors.textPrimary }]}>
          {steps[currentIndex]?.label ?? ''}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {StepBody ? (
          <StepBody
            state={state}
            advance={advance}
            goBack={goBack}
            canGoBack={canGoBack}
            isLast={isLast}
            busyAdvancing={busyAdvancing}
            wizardData={wizardData}
            setWizardData={setWizardData}
          />
        ) : (
          // Unknown step key (server added a step the client doesn't render yet)
          // — let the user move forward rather than trapping them.
          <View>
            <Text style={[styles.stepLabel, { color: colors.textPrimary, marginBottom: 16 }]}>
              {steps[currentIndex]?.label ?? 'Next'}
            </Text>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: colors.primary }]}
              onPress={advance}
              disabled={busyAdvancing}
            >
              <Text style={styles.retryText}>{busyAdvancing ? 'Please wait…' : 'Continue'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { fontSize: 15, textAlign: 'center', marginTop: 12, marginBottom: 20, lineHeight: 21 },
  retryButton: {
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  retryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  stepCounter: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  logoutLink: { fontSize: 13, fontWeight: '600' },
  progressTrack: { flexDirection: 'row', marginBottom: 12 },
  progressSegment: { flex: 1, height: 4, borderRadius: 2 },
  stepLabel: { fontSize: 22, fontWeight: 'bold' },
  body: { padding: 20, paddingBottom: 48, flexGrow: 1 },
});

export default OnboardingWizardScreen;
