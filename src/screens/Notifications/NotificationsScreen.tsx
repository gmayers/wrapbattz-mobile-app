import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../auth/AuthContext';
import { useMarkAllRead, useMarkRead, useNotificationsFeed } from '../../notifications/queries';
import { routeForLink } from '../../notifications/linkRouting';
import type { NotificationRead } from '../../api/types';

type Tab = 'all' | 'unread';

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

const NotificationsScreen: React.FC = () => {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const { isAdminOrOwner } = useAuth();
  const [tab, setTab] = useState<Tab>('all');
  const feed = useNotificationsFeed(tab);
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();
  // Pull-to-refresh spinner is driven by the user's pull only — not
  // feed.isRefetching, which also flips on background refetches (focus,
  // invalidation after mark-read) and would flash the spinner unprompted.
  const [pulling, setPulling] = useState(false);
  const onPull = useCallback(() => {
    setPulling(true);
    Promise.resolve(feed.refetch()).finally(() => setPulling(false));
  }, [feed]);
  const onMarkAll = useCallback(() => {
    markAll.mutate(undefined, {
      onError: () =>
        Alert.alert("Couldn't mark all read", 'Please check your connection and try again.'),
    });
  }, [markAll]);

  useLayoutEffect(() => {
    navigation.setOptions?.({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate('NotificationSettings')}
          accessibilityLabel="Notification settings"
          style={{ paddingHorizontal: 16 }}
        >
          <Ionicons name="settings-outline" size={20} color={colors.primary} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, colors.primary]);

  const items = useMemo(
    () => feed.data?.pages.flatMap((p) => p.items) ?? [],
    [feed.data]
  );

  const onPressItem = useCallback(
    (n: NotificationRead) => {
      if (!n.is_read) markRead.mutate(n.id);
      if (n.link) {
        const route = routeForLink(n.link, { isAdminOrOwner });
        if (route.name !== 'Notifications') navigation.navigate(route.name, route.params);
      }
    },
    [markRead, navigation, isAdminOrOwner]
  );

  const renderItem = ({ item }: { item: NotificationRead }) => (
    <TouchableOpacity
      onPress={() => onPressItem(item)}
      style={[styles.row, { borderBottomColor: colors.border, backgroundColor: colors.card }]}
      accessibilityRole="button"
      accessibilityLabel={`${item.is_read ? '' : 'Unread, '}${item.title}, ${item.message}`}
    >
      <View style={[styles.dot, { backgroundColor: item.is_read ? 'transparent' : colors.primary }]} />
      <View style={styles.rowText}>
        <Text style={[styles.title, { color: colors.textPrimary }, !item.is_read && styles.unread]}>
          {item.title}
        </Text>
        <Text style={[styles.message, { color: colors.textSecondary }]} numberOfLines={2}>
          {item.message}
        </Text>
      </View>
      <Text style={[styles.time, { color: colors.textSecondary }]}>{timeAgo(item.created_at)}</Text>
    </TouchableOpacity>
  );

  let body: React.ReactNode;
  if (feed.isLoading) {
    body = <ActivityIndicator style={styles.center} color={colors.primary} />;
  } else if (feed.isError) {
    body = (
      <View style={styles.center}>
        <Text style={{ color: colors.textPrimary }}>Couldn't load notifications</Text>
        <TouchableOpacity onPress={() => feed.refetch()} accessibilityLabel="Retry">
          <Text style={{ color: colors.primary, marginTop: 8 }}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  } else if (items.length === 0) {
    body = (
      <View style={styles.center}>
        <Ionicons name="notifications-off-outline" size={32} color={colors.textSecondary} />
        <Text style={{ color: colors.textPrimary, marginTop: 8 }}>You're all caught up</Text>
      </View>
    );
  } else {
    body = (
      <FlatList
        data={items}
        keyExtractor={(n) => String(n.id)}
        renderItem={renderItem}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
        }}
        ListFooterComponent={
          feed.isFetchingNextPage ? (
            <ActivityIndicator
              testID="notifications-next-page"
              style={styles.footer}
              color={colors.primary}
            />
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={pulling}
            onRefresh={onPull}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      />
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.toolbar}>
        {(['all', 'unread'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setTab(t)}
            accessibilityLabel={t === 'all' ? 'Show all' : 'Show unread'}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t }}
            style={[styles.tab, tab === t && { backgroundColor: colors.primary }]}
          >
            <Text style={{ color: tab === t ? '#111' : colors.textSecondary }}>
              {t === 'all' ? 'All' : 'Unread'}
            </Text>
          </TouchableOpacity>
        ))}
        <View style={{ flex: 1 }} />
        {items.length > 0 ? (
          <TouchableOpacity
            onPress={onMarkAll}
            disabled={markAll.isPending}
            accessibilityRole="button"
            accessibilityLabel="Mark all read"
          >
            <Text style={{ color: colors.primary }}>Mark all read</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {body}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  toolbar: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8 },
  tab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  row: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, borderBottomWidth: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6, marginRight: 10 },
  rowText: { flex: 1 },
  title: { fontSize: 15 },
  unread: { fontWeight: '700' },
  message: { fontSize: 13, marginTop: 2 },
  time: { fontSize: 12, marginLeft: 8 },
  footer: { paddingVertical: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
});

export default NotificationsScreen;
