import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { members as membersApi } from '../../api/endpoints';
import type { MemberRead } from '../../api/types';
import { ApiError } from '../../api/errors';

type Role = 'owner' | 'admin' | 'office_worker' | 'site_worker';

const ROLE_LABEL: Record<Role, string> = {
  owner: 'Owner',
  admin: 'Admin',
  office_worker: 'Office worker',
  site_worker: 'Site worker',
};

const ROLE_ORDER: Role[] = ['owner', 'admin', 'office_worker', 'site_worker'];

function roleColor(role: string): string {
  switch (role) {
    case 'owner':
      return '#FFC72C';
    case 'admin':
      return '#58A6FF';
    case 'office_worker':
      return '#22C55E';
    case 'site_worker':
    default:
      return '#8B949E';
  }
}

function initials(m: MemberRead): string {
  const a = (m.first_name?.[0] || '').toUpperCase();
  const b = (m.last_name?.[0] || '').toUpperCase();
  const ab = a + b;
  if (ab) return ab;
  return (m.email?.[0] || '?').toUpperCase();
}

const MembersScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const { userData, isOwner } = useAuth();

  const [members, setMembers] = useState<MemberRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roleSheetFor, setRoleSheetFor] = useState<MemberRead | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const currentUserId: number | undefined = userData?.user_id ?? userData?.id;

  const load = useCallback(async () => {
    try {
      setError(null);
      const page = await membersApi.listMembers();
      page.items.sort((a, b) => {
        const ra = ROLE_ORDER.indexOf(a.role as Role);
        const rb = ROLE_ORDER.indexOf(b.role as Role);
        if (ra !== rb) return ra - rb;
        return (a.last_name || a.email).localeCompare(b.last_name || b.email);
      });
      setMembers(page.items);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'unauthorized') return;
      const msg =
        err instanceof ApiError ? err.message : 'Failed to load members. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleChangeRole = useCallback(
    async (member: MemberRead, role: Role) => {
      if (role === member.role) {
        setRoleSheetFor(null);
        return;
      }
      setRoleSheetFor(null);
      setBusyId(member.user_id);
      try {
        const updated = await membersApi.updateMemberRole(member.user_id, { role });
        setMembers((prev) => prev.map((m) => (m.user_id === member.user_id ? updated : m)));
      } catch (err) {
        if (err instanceof ApiError && err.code === 'unauthorized') return;
        const msg =
          err instanceof ApiError ? err.message : 'Unable to update role. Please try again.';
        Alert.alert('Update failed', msg);
      } finally {
        setBusyId(null);
      }
    },
    [],
  );

  const handleRemove = useCallback(
    (member: MemberRead) => {
      const name =
        `${member.first_name || ''} ${member.last_name || ''}`.trim() || member.email;
      Alert.alert(
        'Remove member',
        `Remove ${name} from the organization? They'll lose access immediately.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: async () => {
              setBusyId(member.user_id);
              try {
                await membersApi.removeMember(member.user_id);
                setMembers((prev) => prev.filter((m) => m.user_id !== member.user_id));
              } catch (err) {
                if (err instanceof ApiError && err.code === 'unauthorized') return;
                const msg =
                  err instanceof ApiError
                    ? err.message
                    : 'Unable to remove member. Please try again.';
                Alert.alert('Remove failed', msg);
              } finally {
                setBusyId(null);
              }
            },
          },
        ],
      );
    },
    [],
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const canManage = useCallback(
    (m: MemberRead): boolean => {
      // The acting user can't manage themselves or the primary owner from here.
      if (currentUserId && m.user_id === currentUserId) return false;
      if (m.is_primary) return false;
      return true;
    },
    [currentUserId],
  );

  const renderItem = useCallback(
    ({ item }: { item: MemberRead }) => {
      const fullName =
        `${item.first_name || ''} ${item.last_name || ''}`.trim() || item.email;
      const isSelf = currentUserId === item.user_id;
      const manageable = canManage(item);
      const busy = busyId === item.user_id;
      return (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.row}>
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <Text style={styles.avatarText}>{initials(item)}</Text>
            </View>
            <View style={styles.info}>
              <View style={styles.nameRow}>
                <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
                  {fullName}
                </Text>
                {isSelf ? (
                  <Text style={[styles.selfTag, { color: colors.textMuted }]}>· you</Text>
                ) : null}
              </View>
              <Text style={[styles.email, { color: colors.textSecondary }]} numberOfLines={1}>
                {item.email}
              </Text>
              <View style={styles.metaRow}>
                <View style={[styles.roleBadge, { backgroundColor: roleColor(item.role) }]}>
                  <Text style={styles.roleText}>{ROLE_LABEL[item.role as Role] ?? item.role}</Text>
                </View>
                {item.is_primary ? (
                  <Text style={[styles.primaryTag, { color: colors.textMuted }]}>Primary</Text>
                ) : null}
                {!item.is_active ? (
                  <Text style={[styles.inactiveTag, { color: '#F85149' }]}>Inactive</Text>
                ) : null}
              </View>
            </View>
            {busy ? (
              <ActivityIndicator color={colors.primary} />
            ) : manageable ? (
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.iconBtn, { borderColor: colors.border }]}
                  onPress={() => setRoleSheetFor(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`Change role for ${fullName}`}
                >
                  <Ionicons name="swap-vertical" size={18} color={colors.textPrimary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.iconBtn, { borderColor: colors.border }]}
                  onPress={() => handleRemove(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${fullName}`}
                >
                  <Ionicons name="trash-outline" size={18} color="#F85149" />
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </View>
      );
    },
    [busyId, canManage, colors, currentUserId, handleRemove],
  );

  const availableRoles = useMemo<Role[]>(() => {
    // Only owners can promote to owner. Admins can manage admin/office/site.
    return isOwner ? ROLE_ORDER : ROLE_ORDER.filter((r) => r !== 'owner');
  }, [isOwner]);

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={26} color={colors.primary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Members</Text>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={40} color="#F85149" />
          <Text style={[styles.errorText, { color: colors.textPrimary }]}>{error}</Text>
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: colors.primary }]}
            onPress={() => {
              setLoading(true);
              load();
            }}
          >
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={members}
          keyExtractor={(m) => String(m.user_id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="people-outline" size={48} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No members yet.
              </Text>
            </View>
          }
        />
      )}

      <Modal
        visible={!!roleSheetFor}
        transparent
        animationType="fade"
        onRequestClose={() => setRoleSheetFor(null)}
      >
        <TouchableOpacity
          style={styles.sheetBackdrop}
          activeOpacity={1}
          onPress={() => setRoleSheetFor(null)}
        >
          <TouchableOpacity activeOpacity={1} style={[styles.sheet, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>Change role</Text>
            {roleSheetFor ? (
              <Text style={[styles.sheetSubtitle, { color: colors.textSecondary }]}>
                {roleSheetFor.email}
              </Text>
            ) : null}
            {availableRoles.map((r) => {
              const active = roleSheetFor?.role === r;
              return (
                <TouchableOpacity
                  key={r}
                  style={[styles.sheetRow, { borderBottomColor: colors.border }]}
                  onPress={() => roleSheetFor && handleChangeRole(roleSheetFor, r)}
                  accessibilityRole="button"
                >
                  <View style={[styles.roleDot, { backgroundColor: roleColor(r) }]} />
                  <Text style={[styles.sheetRowText, { color: colors.textPrimary }]}>
                    {ROLE_LABEL[r]}
                  </Text>
                  {active ? (
                    <Ionicons name="checkmark" size={20} color={colors.primary} />
                  ) : null}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={[styles.sheetCancel, { borderColor: colors.border }]}
              onPress={() => setRoleSheetFor(null)}
            >
              <Text style={[styles.sheetCancelText, { color: colors.textPrimary }]}>Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 32, alignItems: 'flex-start' },
  title: { fontSize: 18, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { textAlign: 'center', fontSize: 15, marginTop: 12 },
  retryBtn: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 8,
  },
  retryText: { color: '#000', fontWeight: '600' },
  emptyText: { fontSize: 15, marginTop: 10, textAlign: 'center' },
  listContent: { padding: 16, paddingBottom: 32 },
  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    marginBottom: 10,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { color: '#000', fontWeight: '700', fontSize: 16 },
  info: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: 15, fontWeight: '600' },
  selfTag: { fontSize: 12, marginLeft: 6 },
  email: { fontSize: 13, marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  roleText: { color: '#000', fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  primaryTag: { fontSize: 11, marginLeft: 8, fontWeight: '600' },
  inactiveTag: { fontSize: 11, marginLeft: 8, fontWeight: '600' },
  actions: { flexDirection: 'row', marginLeft: 8, gap: 8 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    padding: 16,
    paddingBottom: 28,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700' },
  sheetSubtitle: { fontSize: 13, marginTop: 2, marginBottom: 12 },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  roleDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  sheetRowText: { flex: 1, fontSize: 15, fontWeight: '500' },
  sheetCancel: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  sheetCancelText: { fontSize: 15, fontWeight: '600' },
});

export default MembersScreen;
