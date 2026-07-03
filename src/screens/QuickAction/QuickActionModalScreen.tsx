// src/screens/QuickAction/QuickActionModalScreen.tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import Button from '../../components/Button';
import Dropdown from '../../components/Dropdown';
import NfcManager from 'react-native-nfc-manager';
import { nfcService } from '../../services/NFCService';
import {
  assignments as assignmentsApi,
  sites as sitesApi,
  tools as toolsApi,
  vans as vansApi,
} from '../../api/endpoints';
import { ApiError } from '../../api/errors';
import { pickLastUserHolder } from '../Tools/hooks/lastHeld';

type QuickActionParamList = {
  QuickActionModal: { tagUID?: string };
};

type QuickActionRouteProp = RouteProp<QuickActionParamList, 'QuickActionModal'>;
type Nav = StackNavigationProp<any>;

interface LocationOption {
  label: string;
  value: string;
}

interface DeviceLike {
  id: string | number;
  identifier?: string;
  make?: string;
  model?: string;
  device_type?: string;
  serial_number?: string;
  maintenance_interval?: number;
  description?: string;
  is_available?: boolean;
  current_assignment?: {
    id: string;
    user_name?: string;
    location_name?: string;
  } | null;
}

const QuickActionModalScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<QuickActionRouteProp>();
  const { colors } = useTheme();
  const { isAdminOrOwner, user } = useAuth();

  const rawTag = route.params?.tagUID;
  const tagUID = (rawTag || '').toUpperCase();

  const [device, setDevice] = useState<DeviceLike | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [returnOpen, setReturnOpen] = useState(false);
  const [returnLoading, setReturnLoading] = useState(false);
  const [locationOptions, setLocationOptions] = useState<LocationOption[]>([]);
  const [vehicleOptions, setVehicleOptions] = useState<LocationOption[]>([]);
  const [selectedDestination, setSelectedDestination] = useState<string>('');
  const [destinationsLoading, setDestinationsLoading] = useState(false);

  const [upgrading, setUpgrading] = useState(false);

  // Holder info derived from history
  const [holderLine, setHolderLine] = useState<string | null>(null);
  const [holderLoading, setHolderLoading] = useState(false);
  // Active holder kind/userId for Assign-to-me gate
  const [activeHolderKind, setActiveHolderKind] = useState<'user' | 'site' | null>(null);
  const [activeHolderUserId, setActiveHolderUserId] = useState<number | null>(null);

  const loadDevice = useCallback(async (cancelled: { current: boolean }) => {
    if (!tagUID) {
      setErrorMsg('Missing tag ID.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setNotFound(false);
    setErrorMsg(null);
    setHolderLine(null);
    setActiveHolderKind(null);
    setActiveHolderUserId(null);
    try {
      const tool = await toolsApi.getToolByNfc(tagUID);
      if (cancelled.current) return;
      // Look up the active assignment so we can return it later.
      let currentAssignmentId: number | null = null;
      try {
        const active = await assignmentsApi.listMyActiveAssignments();
        if (!cancelled.current) {
          const match = active.find((a) => a.tool_id === tool.id);
          if (match) currentAssignmentId = match.id;
        }
      } catch {
        // Non-critical.
      }
      if (cancelled.current) return;
      setDevice({
        id: tool.id,
        identifier: tool.name,
        make: tool.make,
        model: tool.model,
        device_type: tool.category_name,
        serial_number: tool.serial_number,
        is_available: tool.is_available,
        current_assignment: currentAssignmentId ? { id: String(currentAssignmentId) } : null,
      });

      // Load holder info from history (non-blocking — renders card first)
      setHolderLoading(true);
      toolsApi.getToolHistory(tool.id).then((history) => {
        if (cancelled.current) return;
        const items = history.items ?? [];
        // Find the most recent active assignment to determine current holder
        const active = items
          .filter((h) => h.status === 'active' || h.returned_at == null)
          .sort((a, b) => String(b.assigned_at ?? '').localeCompare(String(a.assigned_at ?? '')));
        const current = active[0] ?? null;

        if (tool.is_available || !current) {
          setHolderLine('Available');
          setActiveHolderKind(null);
          setActiveHolderUserId(null);
        } else if (current.assignee_user_id) {
          setHolderLine(`👤 ${current.assignee_user_email || 'Unknown user'}`);
          setActiveHolderKind('user');
          setActiveHolderUserId(current.assignee_user_id);
        } else if (current.assignee_site_id) {
          const siteName = current.assignee_site_name || 'Unknown location';
          // Also find last user holder
          const lastUser = pickLastUserHolder(items.filter((h) => h.status !== 'active'));
          if (lastUser) {
            setHolderLine(`📍 ${siteName} · last held by ${lastUser}`);
          } else {
            setHolderLine(`📍 ${siteName}`);
          }
          setActiveHolderKind('site');
          setActiveHolderUserId(null);
        } else {
          setHolderLine('Available');
          setActiveHolderKind(null);
          setActiveHolderUserId(null);
        }
      }).catch(() => {
        if (cancelled.current) return;
        // Non-critical — just don't show holder line
        setHolderLine(null);
      }).finally(() => {
        if (cancelled.current) return;
        setHolderLoading(false);
      });
    } catch (err) {
      if (cancelled.current) return;
      if (err instanceof ApiError && err.code === 'not_found') {
        setNotFound(true);
      } else if (!(err instanceof ApiError && err.code === 'unauthorized')) {
        setErrorMsg((err instanceof ApiError && err.message) || 'Could not load device.');
      }
    } finally {
      if (!cancelled.current) setLoading(false);
    }
  }, [tagUID]);

  useEffect(() => {
    const cancelled = { current: false };
    loadDevice(cancelled);
    return () => { cancelled.current = true; };
  }, [loadDevice]);

  // Cancel any pending NFC technology request when this modal unmounts so the
  // OS doesn't fire a dangling "NFC read failed / operation cancelled" alert
  // after the user navigates away (e.g. pressing back after an assign error).
  useEffect(() => {
    return () => {
      NfcManager.cancelTechnologyRequest().catch(() => {});
    };
  }, []);

  const loadDestinations = useCallback(async () => {
    setDestinationsLoading(true);
    try {
      const [sitePage, vanPage] = await Promise.all([
        sitesApi.listSites(),
        vansApi.listVans().catch(() => ({ items: [], page: 1, page_size: 0, total: 0, total_pages: 0 })),
      ]);
      const locOpts: LocationOption[] = sitePage.items.map((l) => ({
        label: `📍 ${l.name}`,
        value: String(l.id),
      }));
      const vanOpts: LocationOption[] = vanPage.items
        .filter((v) => v.status === 'active')
        .map((v) => ({
          label: `🚐 ${v.name || v.prefix_code}`,
          value: String(v.id),
        }));
      setLocationOptions(locOpts);
      setVehicleOptions(vanOpts);
      const combined = [...locOpts, ...vanOpts];
      if (combined.length > 0 && !selectedDestination) {
        setSelectedDestination(combined[0].value);
      }
    } catch (err) {
      if (!(err instanceof ApiError && err.code === 'unauthorized')) {
        Alert.alert('Error', 'Could not load locations.');
      }
    } finally {
      setDestinationsLoading(false);
    }
  }, [selectedDestination]);

  const handleOpenReturn = () => {
    if (!device?.current_assignment?.id) {
      Alert.alert(
        'Not currently assigned',
        'This device has no active assignment to return.'
      );
      return;
    }
    setReturnOpen(true);
    if (locationOptions.length === 0 && vehicleOptions.length === 0) {
      loadDestinations();
    }
  };

  const handleConfirmReturn = async () => {
    if (!selectedDestination) {
      Alert.alert('Select a destination', 'Please pick a location or vehicle.');
      return;
    }
    const assignmentId = device?.current_assignment?.id;
    if (!assignmentId) return;
    setReturnLoading(true);
    try {
      await assignmentsApi.returnAssignment(Number(assignmentId), {
        target_site_id: Number(selectedDestination),
        condition: '',
        notes: '',
      });
      setReturnOpen(false);
      Alert.alert('Returned', 'Device has been returned successfully.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      const msg =
        (err instanceof ApiError && err.message) ||
        (err instanceof Error && err.message) ||
        'Return failed. Please try again.';
      Alert.alert('Return failed', msg);
    } finally {
      setReturnLoading(false);
    }
  };

  const handleViewDetails = () => {
    if (!device) return;
    navigation.replace('DeviceDetails', { deviceId: device.id });
  };

  const handleReport = () => {
    if (!device) return;
    navigation.replace('CreateReport', {
      deviceId: device.id,
      identifier: device.identifier,
    });
  };

  const handleAssign = () => {
    if (!device) return;
    navigation.replace('DeviceDetails', { deviceId: device.id });
  };

  const handleRegisterTag = () => {
    navigation.replace('AddDevice', { prefilledTagUid: tagUID });
  };

  const handleUpgradeTag = async () => {
    if (!device) return;
    setUpgrading(true);
    try {
      const result = await Promise.race([
        nfcService.writeDeviceToNFC(
          {
            deviceId: device.identifier || String(device.id),
            make: device.make || '',
            model: device.model || '',
            serialNumber: device.serial_number || '',
            maintenanceInterval: device.maintenance_interval || 0,
            description: device.description || '',
          },
          { includeUniversalLink: true }
        ),
        new Promise<never>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(
                  'NFC timed out — hold the tag steady against the device and try again.'
                )
              ),
            20000
          )
        ),
      ]);
      if (result.success) {
        const urlOnly = result.data?.writtenJson === false;
        Alert.alert(
          'Tag updated',
          urlOnly
            ? 'Tag has been updated with the launch URL only. Tag capacity was too small for the full JSON payload; device details will be fetched via network when the tag is tapped.'
            : 'Tag has been updated successfully. The next tap will launch the app directly.'
        );
      } else {
        Alert.alert('Re-write failed', result.error || 'Could not write to tag.');
      }
    } catch (err: any) {
      Alert.alert('Re-write failed', err?.message || 'Unknown error.');
    } finally {
      setUpgrading(false);
    }
  };

  const handleClose = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.replace('MainTabs');
  };

  const combinedDestinations =
    vehicleOptions.length > 0
      ? [...locationOptions, ...vehicleOptions]
      : locationOptions;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.headerRow, { borderBottomColor: colors.borderLight }]}>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          Quick Actions
        </Text>
        <TouchableOpacity
          onPress={handleClose}
          style={styles.closeBtn}
          testID="quick-action-close"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="close" size={26} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered} testID="quick-action-loading">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.hintText, { color: colors.textSecondary }]}>
            Looking up device…
          </Text>
        </View>
      ) : errorMsg ? (
        <View style={styles.centered} testID="quick-action-error">
          <Ionicons name="warning-outline" size={42} color={colors.error} />
          <Text style={[styles.statusTitle, { color: colors.textPrimary }]}>
            Something went wrong
          </Text>
          <Text style={[styles.hintText, { color: colors.textSecondary }]}>
            {errorMsg}
          </Text>
          <Button title="Try again" onPress={() => loadDevice({ current: false })} style={styles.primaryBtn} />
        </View>
      ) : notFound ? (
        <View style={styles.centered} testID="quick-action-not-found">
          <Ionicons name="help-circle-outline" size={42} color={colors.warning || colors.primary} />
          <Text style={[styles.statusTitle, { color: colors.textPrimary }]}>
            Tag not registered
          </Text>
          <Text style={[styles.hintText, { color: colors.textSecondary }]}>
            No device is linked to this NFC tag (UID: {tagUID}).
          </Text>
          {isAdminOrOwner ? (
            <Button
              title="Register this tag"
              onPress={handleRegisterTag}
              style={styles.primaryBtn}
            />
          ) : (
            <Text style={[styles.hintText, { color: colors.textSecondary, marginTop: 8 }]}>
              Ask an admin or owner to register this tag.
            </Text>
          )}
        </View>
      ) : device ? (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Holder / location block — shown prominently above action buttons */}
          {(holderLoading || holderLine) ? (
            <View style={[styles.holderBlock, { backgroundColor: colors.card, borderColor: colors.borderLight }]} testID="quick-action-holder-block">
              {holderLoading ? (
                <View style={styles.holderLoadingRow}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={[styles.holderLoadingText, { color: colors.textSecondary }]}>
                    Checking holder…
                  </Text>
                </View>
              ) : (
                <Text style={[styles.holderText, { color: colors.textPrimary }]} testID="quick-action-holder-line">
                  {holderLine}
                </Text>
              )}
            </View>
          ) : null}

          <View style={[styles.deviceCard, { backgroundColor: colors.card, borderColor: colors.borderLight }]}>
            <Text style={[styles.deviceIdentifier, { color: colors.textPrimary }]} testID="quick-action-device-identifier">
              {device.identifier || device.make || 'Device'}
            </Text>
            {device.device_type ? (
              <Text style={[styles.deviceMeta, { color: colors.textSecondary }]}>
                Type: {device.device_type}
              </Text>
            ) : null}
          </View>

          <View style={styles.actionsGroup} testID="quick-action-buttons">
            <Button
              title="View full details"
              onPress={handleViewDetails}
              style={styles.actionBtn}
              testID="quick-action-view-details"
            />

            {device.current_assignment?.id ? (
              <Button
                title="Return device"
                onPress={handleOpenReturn}
                style={styles.actionBtn}
                testID="quick-action-return"
              />
            ) : null}

            <Button
              title="Report an issue"
              onPress={handleReport}
              variant="outlined"
              style={styles.actionBtn}
              testID="quick-action-report"
            />

            {isAdminOrOwner ? (
              <>
                {/* Show Assign unless tool is held by a different user. Available
                    tools and site-held tools can always be grabbed. */}
                {!(activeHolderKind === 'user' && activeHolderUserId != null && activeHolderUserId !== (user?.id ?? null)) ? (
                  <Button
                    title="Assign device"
                    onPress={handleAssign}
                    variant="outlined"
                    style={styles.actionBtn}
                    testID="quick-action-assign"
                  />
                ) : null}
                <Button
                  title={upgrading ? 'Hold tag steady…' : 'Re-write tag data'}
                  onPress={handleUpgradeTag}
                  variant="outlined"
                  loading={upgrading}
                  disabled={upgrading}
                  style={styles.actionBtn}
                  testID="quick-action-upgrade"
                />
                <Text style={[styles.hintText, { color: colors.textSecondary, textAlign: 'left', marginTop: -4 }]}>
                  Refreshes the device data stored on this NFC tag.
                </Text>
              </>
            ) : null}
          </View>

          {returnOpen ? (
            <View
              style={[styles.returnPanel, { backgroundColor: colors.card, borderColor: colors.borderLight }]}
              testID="quick-action-return-panel"
            >
              <Text style={[styles.returnTitle, { color: colors.textPrimary }]}>
                Return device
              </Text>
              {destinationsLoading ? (
                <ActivityIndicator color={colors.primary} />
              ) : combinedDestinations.length === 0 ? (
                <Text style={[styles.hintText, { color: colors.textSecondary }]}>
                  No locations or vehicles available.
                </Text>
              ) : (
                <Dropdown
                  value={selectedDestination}
                  onValueChange={setSelectedDestination}
                  items={combinedDestinations}
                  placeholder="Select destination"
                  disabled={returnLoading}
                  testID="quick-action-return-destination"
                />
              )}
              <View style={styles.returnButtonRow}>
                <Button
                  title={returnLoading ? 'Returning…' : 'Confirm return'}
                  onPress={handleConfirmReturn}
                  loading={returnLoading}
                  disabled={returnLoading || combinedDestinations.length === 0}
                  style={styles.actionBtn}
                  testID="quick-action-confirm-return"
                />
                <Button
                  title="Cancel"
                  onPress={() => setReturnOpen(false)}
                  variant="ghost"
                  disabled={returnLoading}
                  style={styles.actionBtn}
                />
              </View>
            </View>
          ) : null}
        </ScrollView>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 6,
  },
  hintText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 6,
  },
  scrollContent: {
    padding: 20,
  },
  holderBlock: {
    borderRadius: 12,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 12,
    minHeight: 44,
    justifyContent: 'center',
  },
  holderLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  holderLoadingText: {
    fontSize: 14,
    marginLeft: 8,
  },
  holderText: {
    fontSize: 16,
    fontWeight: '600',
  },
  deviceCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 20,
  },
  deviceIdentifier: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  deviceMeta: {
    fontSize: 14,
    marginTop: 2,
  },
  actionsGroup: {
    gap: 10,
  },
  actionBtn: {
    marginBottom: 10,
  },
  primaryBtn: {
    marginTop: 16,
    minWidth: 180,
  },
  returnPanel: {
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  returnTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 12,
  },
  returnButtonRow: {
    marginTop: 14,
  },
});

export default QuickActionModalScreen;
