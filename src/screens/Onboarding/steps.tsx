// Onboarding step bodies. Each step performs a single domain action against the
// existing API endpoints, then calls `advance()` to let the container move the
// server-side step machine forward. Steps are intentionally self-contained:
// they read auth/theme via hooks and own their local form state.
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import Button from '../../components/Button';
import FormField from '../../components/Form/FormField';
import Dropdown from '../../components/Dropdown';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import {
  auth as authApi,
  organizations as organizationsApi,
  sites as sitesApi,
  tools as toolsApi,
  assignments as assignmentsApi,
  invitations as invitationsApi,
} from '../../api/endpoints';
import { getCached as getCachedTokens } from '../../api/tokenStore';
import { ApiError } from '../../api/errors';
import { normalizePostcode } from '../../utils/CommonUtils';
import {
  LOCATION_TYPES,
  LOCATION_TYPE_OTHER,
  DEFAULT_LOCATION_TYPE,
} from '../../constants/locationTypes';
import type { OnboardingState } from '../../api/types';

export interface WizardData {
  siteId?: number;
  siteName?: string;
  toolId?: number;
  toolName?: string;
}

export interface StepProps {
  state: OnboardingState;
  advance: () => void;
  goBack: () => void;
  canGoBack: boolean;
  isLast: boolean;
  busyAdvancing: boolean;
  wizardData: WizardData;
  setWizardData: (patch: Partial<WizardData>) => void;
}

// ── Shared scaffold ───────────────────────────────────────────────────────
interface ScaffoldProps {
  subtitle?: string;
  children?: React.ReactNode;
  primaryLabel: string;
  onPrimary: () => void;
  primaryLoading?: boolean;
  primaryDisabled?: boolean;
  skipLabel?: string;
  onSkip?: () => void;
}

const StepScaffold: React.FC<ScaffoldProps> = ({
  subtitle,
  children,
  primaryLabel,
  onPrimary,
  primaryLoading,
  primaryDisabled,
  skipLabel,
  onSkip,
}) => {
  const { colors } = useTheme();
  return (
    <View>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
      ) : null}
      <View style={styles.form}>{children}</View>
      <Button
        title={primaryLabel}
        onPress={onPrimary}
        loading={primaryLoading}
        disabled={primaryDisabled || primaryLoading}
        backgroundColorProp={colors.primary}
        textColorProp="#0F1722"
        style={styles.primaryButton}
      />
      {onSkip ? (
        <TouchableOpacity
          style={styles.skipButton}
          onPress={onSkip}
          disabled={primaryLoading}
        >
          <Text style={[styles.skipText, { color: colors.textMuted }]}>
            {skipLabel || 'Skip for now'}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

// Map an ApiError (or anything) to a user-facing message.
const errMsg = (e: unknown, fallback: string): string =>
  (e instanceof ApiError && e.message) || (e as Error)?.message || fallback;

// ── Owner: profile ─────────────────────────────────────────────────────────
const ProfileStep: React.FC<StepProps> = ({ advance, busyAdvancing }) => {
  const { user, updateUser } = useAuth();
  const [firstName, setFirstName] = useState(user?.first_name ?? '');
  const [lastName, setLastName] = useState(user?.last_name ?? '');
  const [phone, setPhone] = useState(user?.phone_number ?? '');
  const [submitting, setSubmitting] = useState(false);

  const onPrimary = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Missing details', 'Please enter your first and last name.');
      return;
    }
    setSubmitting(true);
    try {
      await updateUser({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone_number: phone.trim(),
      });
      advance();
    } catch (e) {
      Alert.alert('Error', errMsg(e, 'Could not save your details. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <StepScaffold
      subtitle="Confirm your details. This is the account owner's information."
      primaryLabel="Continue"
      onPrimary={onPrimary}
      primaryLoading={submitting || busyAdvancing}
    >
      <FormField label="First Name" value={firstName} onChangeText={setFirstName} placeholder="Enter first name" required editable={!submitting} />
      <FormField label="Last Name" value={lastName} onChangeText={setLastName} placeholder="Enter last name" required editable={!submitting} />
      <FormField label="Phone Number" value={phone} onChangeText={setPhone} placeholder="Enter phone number" keyboardType="phone-pad" editable={!submitting} />
    </StepScaffold>
  );
};

// ── Owner: company ───────────────────────────────────────────────────────────
const CompanyStep: React.FC<StepProps> = ({ advance, busyAdvancing }) => {
  const { user, refreshUser } = useAuth();
  // Revisiting via Back after the org was created: prefill and PATCH instead
  // of attempting a duplicate create (which the backend rejects with a 409).
  const hasOrg = user?.organization != null;
  const [name, setName] = useState(user?.organization?.name ?? '');
  const [tradingName, setTradingName] = useState(user?.organization?.trading_name ?? '');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // The org summary on UserMe has no contact fields — pull the full record to
  // prefill them. Best-effort: on failure the name fields are already seeded.
  useEffect(() => {
    if (!hasOrg) return;
    let cancelled = false;
    (async () => {
      try {
        const org = await organizationsApi.getMyOrganization();
        if (cancelled) return;
        setName(org.name ?? '');
        setTradingName(org.trading_name ?? '');
        setEmail(org.email ?? '');
        setPhone(org.phone ?? '');
        setWebsite(org.website ?? '');
      } catch {
        // Prefill only — never block the step on this.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasOrg]);

  const onPrimary = async () => {
    if (!name.trim()) {
      Alert.alert('Missing details', 'Please enter your organization name.');
      return;
    }
    if (website.trim() && !/^https?:\/\/.+/.test(website.trim())) {
      Alert.alert('Invalid website', 'Website must start with http:// or https://');
      return;
    }
    const payload = {
      name: name.trim(),
      trading_name: tradingName.trim() || '',
      email: email.trim() || null,
      phone: phone.trim() || '',
      website: website.trim() || '',
    };
    setSubmitting(true);
    try {
      if (hasOrg) {
        await organizationsApi.updateMyOrganization(payload);
      } else {
        try {
          await organizationsApi.createOrganization(payload);
        } catch (e) {
          // 409: the org already exists (local user state was stale). Treat it
          // as created and continue rather than trapping the user here.
          if (!(e instanceof ApiError && e.code === 'conflict')) throw e;
        }
        // The access token in hand is still user-scoped (no org claim), but the
        // steps that follow (location/tool/invite) hit org-scoped endpoints.
        // Refreshing swaps it for an org-scoped token server-side. Best-effort:
        // the API client also refresh-retries on 403 organization_required, so a
        // failure here must not fail the step — the org was already created.
        try {
          const tokens = getCachedTokens();
          if (tokens?.refreshToken) await authApi.refresh(tokens.refreshToken);
        } catch {
          // Non-fatal — see comment above.
        }
      }
      // Refresh so the new owner role/organization is reflected before later steps.
      await refreshUser();
      advance();
    } catch (e) {
      Alert.alert('Error', errMsg(e, 'Could not save your organization. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <StepScaffold
      subtitle="Your organization is your workspace — devices, locations, and team members live under it."
      primaryLabel={hasOrg ? 'Save & Continue' : 'Create Organization'}
      onPrimary={onPrimary}
      primaryLoading={submitting || busyAdvancing}
    >
      <FormField label="Organization Name" value={name} onChangeText={setName} placeholder="Enter organization name" required editable={!submitting} />
      <FormField label="Trading Name" value={tradingName} onChangeText={setTradingName} placeholder="Trading name (if different)" editable={!submitting} />
      <FormField label="Email" value={email} onChangeText={setEmail} placeholder="Organization email" keyboardType="email-address" autoCapitalize="none" editable={!submitting} />
      <FormField label="Phone" value={phone} onChangeText={setPhone} placeholder="Organization phone" keyboardType="phone-pad" editable={!submitting} />
      <FormField label="Website" value={website} onChangeText={setWebsite} placeholder="https://example.com" keyboardType="url" autoCapitalize="none" editable={!submitting} />
    </StepScaffold>
  );
};

// ── Owner: plan (informational only) ─────────────────────────────────────────
// TOOLTRAQ is a free B2B access client — there is NO in-app plan selection,
// pricing, or purchase (App Store Guideline 3.1.3(c) enterprise). Subscriptions
// are arranged with the organization directly. This step is purely
// informational: no prices, no selectable plans, and no link out. Ideally the
// backend omits the `plan` step from the onboarding flow entirely; this neutral
// component is the client-side fallback so no pricing UI ever renders.
const PlanStep: React.FC<StepProps> = ({ advance, busyAdvancing }) => {
  const { colors } = useTheme();

  return (
    <StepScaffold
      subtitle="Your TOOLTRAQ subscription is managed for your whole organization by your account administrator. There's nothing to set up here."
      primaryLabel="Continue"
      onPrimary={advance}
      primaryLoading={busyAdvancing}
    >
      <View style={[styles.planCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.planTitle, { color: colors.textPrimary }]}>You're all set</Text>
          <Text style={[styles.planDesc, { color: colors.textSecondary }]}>
            Your organization's plan unlocks the features available to your team.
          </Text>
        </View>
      </View>
    </StepScaffold>
  );
};

// ── Owner: location ──────────────────────────────────────────────────────────
const LocationStep: React.FC<StepProps> = ({ advance, busyAdvancing, setWizardData }) => {
  const [locationType, setLocationType] = useState(DEFAULT_LOCATION_TYPE);
  const [customType, setCustomType] = useState('');
  const [name, setName] = useState('');
  const [streetNumber, setStreetNumber] = useState('');
  const [streetName, setStreetName] = useState('');
  const [city, setCity] = useState('');
  const [postcode, setPostcode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isOther = locationType === LOCATION_TYPE_OTHER;

  const onPrimary = async () => {
    if (!streetName.trim() || !city.trim() || !postcode.trim()) {
      Alert.alert('Missing details', 'Please enter street name, town/city and postcode.');
      return;
    }
    if (isOther && !customType.trim()) {
      Alert.alert('Missing details', 'Please describe the location type.');
      return;
    }
    setSubmitting(true);
    try {
      const address1 = [streetNumber.trim(), streetName.trim()].filter(Boolean).join(' ').trim();
      const site = await sitesApi.createSite({
        name: name.trim() || address1 || 'New Site',
        site_type: locationType,
        // For "Other", keep the user's free-text label in nickname so it's not lost.
        nickname: isOther ? customType.trim().slice(0, 50) : '',
        description: '',
        prefix_code: '',
        address_line1: address1,
        city: city.trim(),
        postcode: normalizePostcode(postcode),
      });
      setWizardData({ siteId: site.id, siteName: site.name });
      advance();
    } catch (e) {
      Alert.alert('Error', errMsg(e, 'Could not create the location. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <StepScaffold
      subtitle="Add your first location. Devices can be assigned to a location or to a person."
      primaryLabel="Add Location"
      onPrimary={onPrimary}
      primaryLoading={submitting || busyAdvancing}
      onSkip={advance}
    >
      <LocationTypeField
        locationType={locationType}
        setLocationType={setLocationType}
        customType={customType}
        setCustomType={setCustomType}
        disabled={submitting}
      />
      <FormField label="Location Name" value={name} onChangeText={setName} placeholder="e.g. Main Office (optional)" editable={!submitting} />
      <FormField label="Street Number" value={streetNumber} onChangeText={setStreetNumber} placeholder="Enter street number" editable={!submitting} />
      <FormField label="Street Name" value={streetName} onChangeText={setStreetName} placeholder="Enter street name" required editable={!submitting} />
      <FormField label="Town/City" value={city} onChangeText={setCity} placeholder="Enter town or city" required editable={!submitting} />
      <FormField label="Postcode" value={postcode} onChangeText={setPostcode} placeholder="Enter postcode" required autoCapitalize="characters" editable={!submitting} />
    </StepScaffold>
  );
};

// Reusable Location Type dropdown + conditional "Other" free-text field. Shared
// shape with the create-location form so behaviour stays consistent.
export const LocationTypeField: React.FC<{
  locationType: string;
  setLocationType: (v: string) => void;
  customType: string;
  setCustomType: (v: string) => void;
  disabled?: boolean;
}> = ({ locationType, setLocationType, customType, setCustomType, disabled }) => {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Location Type</Text>
      <Dropdown
        value={locationType}
        onValueChange={setLocationType}
        items={LOCATION_TYPES}
        placeholder="Select location type"
        disabled={disabled}
        testID="location-type-dropdown"
      />
      {locationType === LOCATION_TYPE_OTHER ? (
        <View style={{ marginTop: 12 }}>
          <FormField
            label="Specify Type"
            value={customType}
            onChangeText={setCustomType}
            placeholder="e.g. Storage container, Lock-up"
            required
            editable={!disabled}
          />
        </View>
      ) : null}
    </View>
  );
};

// ── Owner: add_tool ──────────────────────────────────────────────────────────
const AddToolStep: React.FC<StepProps> = ({ advance, busyAdvancing, setWizardData }) => {
  const [description, setDescription] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onPrimary = async () => {
    if (!description.trim()) {
      Alert.alert('Missing details', 'Please enter a name or description for the tool.');
      return;
    }
    setSubmitting(true);
    try {
      const tool = await toolsApi.createTool({
        name: description.trim(),
        make: make.trim(),
        model: model.trim(),
        serial_number: '',
        category_id: null,
        nfc_tag_id: null,
      });
      setWizardData({ toolId: tool.id, toolName: tool.name });
      advance();
    } catch (e) {
      Alert.alert('Error', errMsg(e, 'Could not add the tool. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <StepScaffold
      subtitle="Add your first tool or device. You can register an NFC tag for it later."
      primaryLabel="Add Tool"
      onPrimary={onPrimary}
      primaryLoading={submitting || busyAdvancing}
      onSkip={advance}
    >
      <FormField label="Name / Description" value={description} onChangeText={setDescription} placeholder="e.g. Makita Drill" required editable={!submitting} />
      <FormField label="Make" value={make} onChangeText={setMake} placeholder="e.g. Makita" editable={!submitting} />
      <FormField label="Model" value={model} onChangeText={setModel} placeholder="Enter model" editable={!submitting} />
    </StepScaffold>
  );
};

// ── Owner: assign_tool ───────────────────────────────────────────────────────
const AssignToolStep: React.FC<StepProps> = ({ advance, busyAdvancing, wizardData }) => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const hasSite = wizardData.siteId != null;
  const [target, setTarget] = useState<'site' | 'me'>(hasSite ? 'site' : 'me');

  if (wizardData.toolId == null) {
    return (
      <StepScaffold
        subtitle="No tool was added, so there's nothing to assign yet. You can assign tools any time from the dashboard."
        primaryLabel="Continue"
        onPrimary={advance}
        primaryLoading={busyAdvancing}
      />
    );
  }

  const onPrimary = async () => {
    setSubmitting(true);
    try {
      if (target === 'site' && hasSite) {
        await assignmentsApi.createAssignment({
          tool_id: wizardData.toolId!,
          assignee_site_id: wizardData.siteId!,
          condition: '',
          notes: '',
        });
      } else {
        await toolsApi.assignToolToMe(wizardData.toolId!);
      }
      advance();
    } catch (e) {
      Alert.alert('Error', errMsg(e, 'Could not assign the tool. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const meLabel =
    user?.first_name ? `Assign to me (${user.first_name})` : 'Assign to me';

  return (
    <StepScaffold
      subtitle={`Assign "${wizardData.toolName ?? 'your tool'}" to get started.`}
      primaryLabel="Assign Tool"
      onPrimary={onPrimary}
      primaryLoading={submitting || busyAdvancing}
      onSkip={advance}
    >
      <View style={{ gap: 12 }}>
        {hasSite ? (
          <ChoiceRow
            label={`Assign to ${wizardData.siteName ?? 'location'}`}
            selected={target === 'site'}
            onPress={() => setTarget('site')}
            colors={colors}
          />
        ) : null}
        <ChoiceRow
          label={meLabel}
          selected={target === 'me'}
          onPress={() => setTarget('me')}
          colors={colors}
        />
      </View>
    </StepScaffold>
  );
};

const ChoiceRow: React.FC<{ label: string; selected: boolean; onPress: () => void; colors: any }> = ({
  label,
  selected,
  onPress,
  colors,
}) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.85}
    style={[
      styles.planCard,
      { backgroundColor: selected ? colors.primaryLight || colors.surface : colors.card, borderColor: selected ? colors.primary : colors.border },
    ]}
  >
    <View style={[styles.radioOuter, { borderColor: selected ? colors.primary : colors.border }]}>
      {selected ? <View style={[styles.radioInner, { backgroundColor: colors.primary }]} /> : null}
    </View>
    <Text style={[styles.planTitle, { color: colors.textPrimary }]}>{label}</Text>
  </TouchableOpacity>
);

// ── Owner: invite_team ───────────────────────────────────────────────────────
const ROLE_OPTIONS = [
  { label: 'Admin', value: 'admin', key: 'role-admin' },
  { label: 'Office Worker', value: 'office_worker', key: 'role-office' },
  { label: 'Site Worker', value: 'site_worker', key: 'role-site' },
];

const InviteTeamStep: React.FC<StepProps> = ({ advance, busyAdvancing, isLast }) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('site_worker');
  const [submitting, setSubmitting] = useState(false);

  const onPrimary = async () => {
    if (!email.trim()) {
      // Nothing to send — just move on (same as skipping).
      advance();
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email.trim())) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }
    setSubmitting(true);
    try {
      await invitationsApi.createInvitation({ email: email.trim(), role });
      advance();
    } catch (e) {
      Alert.alert('Error', errMsg(e, 'Could not send the invitation. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const { colors } = useTheme();
  return (
    <StepScaffold
      subtitle="Invite a teammate by email, or skip and add people later from Members."
      primaryLabel={isLast ? 'Send & Finish' : 'Send Invite'}
      onPrimary={onPrimary}
      primaryLoading={submitting || busyAdvancing}
      onSkip={advance}
      skipLabel={isLast ? 'Finish without inviting' : 'Skip for now'}
    >
      <FormField label="Email" value={email} onChangeText={setEmail} placeholder="teammate@company.com" keyboardType="email-address" autoCapitalize="none" editable={!submitting} />
      <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Role</Text>
      <Dropdown value={role} onValueChange={setRole} items={ROLE_OPTIONS} placeholder="Select role" disabled={submitting} testID="invite-role-dropdown" />
    </StepScaffold>
  );
};

// ── Invited flow ─────────────────────────────────────────────────────────────
const WelcomeStep: React.FC<StepProps> = ({ advance, busyAdvancing }) => (
  <StepScaffold
    subtitle="Welcome to TOOLTRAQ! You've joined your team's workspace. Let's get you set up in a couple of quick steps."
    primaryLabel="Get Started"
    onPrimary={advance}
    primaryLoading={busyAdvancing}
  />
);

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  office_worker: 'Office Worker',
  site_worker: 'Site Worker',
};

const RoleIntroStep: React.FC<StepProps> = ({ state, advance, busyAdvancing }) => {
  const { colors } = useTheme();
  const roleLabel = state.role ? ROLE_LABELS[state.role] ?? state.role : 'team member';
  return (
    <StepScaffold
      subtitle={`You've joined as a ${roleLabel}. This determines what you can see and do — your admin can adjust it any time.`}
      primaryLabel="Continue"
      onPrimary={advance}
      primaryLoading={busyAdvancing}
    >
      <View style={[styles.roleBadge, { backgroundColor: (colors.primary || '#FFC72C') + '22', borderColor: colors.primary }]}>
        <Text style={[styles.roleBadgeText, { color: colors.primary }]}>{roleLabel}</Text>
      </View>
    </StepScaffold>
  );
};

const FirstActionStep: React.FC<StepProps> = ({ advance, busyAdvancing }) => (
  <StepScaffold
    subtitle="You're all set. Scan an NFC tag or browse your team's devices from the dashboard to begin."
    primaryLabel="Go to Dashboard"
    onPrimary={advance}
    primaryLoading={busyAdvancing}
  />
);

// ── Registry ─────────────────────────────────────────────────────────────────
export const STEP_COMPONENTS: Record<string, React.FC<StepProps>> = {
  // owner
  profile: ProfileStep,
  company: CompanyStep,
  plan: PlanStep,
  location: LocationStep,
  add_tool: AddToolStep,
  assign_tool: AssignToolStep,
  invite_team: InviteTeamStep,
  // invited
  welcome: WelcomeStep,
  role_intro: RoleIntroStep,
  first_action: FirstActionStep,
};

const styles = StyleSheet.create({
  subtitle: { fontSize: 15, lineHeight: 22, marginBottom: 20 },
  form: { marginBottom: 8 },
  fieldLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  primaryButton: { marginTop: 12 },
  skipButton: { alignItems: 'center', paddingVertical: 14 },
  skipText: { fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 10,
    padding: 14,
    gap: 12,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: { width: 11, height: 11, borderRadius: 6 },
  planTitle: { fontSize: 16, fontWeight: '600' },
  planPrice: { fontSize: 20, fontWeight: '700', marginTop: 2 },
  planDesc: { fontSize: 12, marginTop: 2 },
  roleBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  roleBadgeText: { fontSize: 16, fontWeight: '700' },
});
