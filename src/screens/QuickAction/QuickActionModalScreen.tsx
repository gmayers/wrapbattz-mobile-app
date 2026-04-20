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
import { nfcService } from '../../services/NFCService';

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
  const { deviceService, isAdminOrOwner } = useAuth();

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

  const loadDevice = useCallback(async () => {
    if (!tagUID) {
      setErrorMsg('Missing tag ID.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setNotFound(false);
    setErrorMsg(null);
    try {
      const d = await deviceService.getDeviceByNfcUuid(tagUID);
      if (!d) setNotFound(true);
      else setDevice(d);
    } catch (err: any) {
      if (err?.response?.status !== 401) {
        setErrorMsg(err?.message || 'Could not load device.');
      }
    } finally {
      setLoading(false);
    }
  }, [deviceService, tagUID]);

  useEffect(() => { loadDevice(); }, [loadDevice]);

  const loadDestinations = useCallback(async () => {
    setDestinationsLoading(true);
    try {
      const [locs, vans] = await Promise.all([
        deviceService.getLocations(),
        deviceService.getVans().catch(() => []),
      ]);
      const locList = Array.isArray(locs) ? locs : locs?.results || [];
      const vanList = Array.isArray(vans) ? vans : vans?.results || [];
      const locOpts: LocationOption[] = locList.map((l: any) => ({
        label: `📍 ${l.name}`,
        value: String(l.id),
      }));
      const vanOpts: LocationOption[] = vanList
        .filter((v: any) => v.is_active !== false)
        .map((v: any) => ({ label: `🚐 ${v.name || v.registration}`, value: String(v.id) }));
      setLocationOptions(locOpts);
      setVehicleOptions(vanOpts);
      const combined = [...locOpts, ...vanOpts];
      if (combined.length > 0 && !selectedDestination) {
        setSelectedDestination(combined[0].value);
      }
    } catch (err: any) {
      if (err?.response?.status !== 401) {
        Alert.alert('Error', 'Could not load locations.');
      }
    } finally {
      setDestinationsLoading(false);
    }
  }, [deviceService, selectedDestination]);

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
      await deviceService.returnDeviceToLocation(assignmentId, {
        location: selectedDestination,
      });
      setReturnOpen(false);
      Alert.alert('Returned', 'Device has been returned successfully.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        err?.message ||
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
      const result = await nfcService.writeDeviceToNFC(
        {
          deviceId: device.identifier || String(device.id),
          make: device.make || '',
          model: device.model || '',
          serialNumber: device.serial_number || '',
          maintenanceInterval: device.maintenance_interval || 0,
          description: device.description || '',
        },
        { includeUniversalLink: true }
      );
      if (result.success) {
        const urlOnly = result.data?.writtenJson === false;
        Alert.alert(
          'Tag upgraded',
          urlOnly
            ? 'Tag has been upgraded with the launch URL only. Tag capacity was too small for the full JSON payload; device details will be fetched via network when the tag is tapped.'
            : 'Tag has been upgraded successfully. The next tap will launch the app directly.'
        );
      } else {
        Alert.alert('Upgrade failed', result.error || 'Could not write to tag.');
      }
    } catch (err: any) {
      Alert.alert('Upgrade failed', err?.message || 'Unknown error.');
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
          <Button title="Try again" onPress={loadDevice} style={styles.primaryBtn} />
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
          <View style={[styles.deviceCard, { backgroundColor: colors.card, borderColor: colors.borderLight }]}>
            <Text style={[styles.deviceIdentifier, { color: colors.textPrimary }]} testID="quick-action-device-identifier">
              {device.identifier || device.make || 'Device'}
            </Text>
            {device.device_type ? (
              <Text style={[styles.deviceMeta, { color: colors.textSecondary }]}>
                Type: {device.device_type}
              </Text>
            ) : null}
            {device.current_assignment?.user_name ? (
              <Text style={[styles.deviceMeta, { color: colors.textSecondary }]}>
                Assigned to: {device.current_assignment.user_name}
              </Text>
            ) : device.current_assignment?.location_name ? (
              <Text style={[styles.deviceMeta, { color: colors.textSecondary }]}>
                At: {device.current_assignment.location_name}
              </Text>
            ) : (
              <Text style={[styles.deviceMeta, { color: colors.textMuted }]}>
                No active assignment
              </Text>
            )}
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
                <Button
                  title="Assign device"
                  onPress={handleAssign}
                  variant="outlined"
                  style={styles.actionBtn}
                  testID="quick-action-assign"
                />
                <Button
                  title={upgrading ? 'Hold tag to device…' : 'Upgrade NFC tag'}
                  onPress={handleUpgradeTag}
                  variant="outlined"
                  loading={upgrading}
                  disabled={upgrading}
                  style={styles.actionBtn}
                  testID="quick-action-upgrade"
                />
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
