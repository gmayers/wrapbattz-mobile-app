import { navigationRef } from '../navigation/navigationRef';

export type NotificationLinkLike = { kind: string; id: number } | null | undefined;

export interface Route {
  name: string;
  params?: Record<string, unknown>;
}

const INBOX: Route = { name: 'Notifications' };

export function routeForLink(link: NotificationLinkLike, opts: { isAdminOrOwner: boolean }): Route {
  if (!link) return INBOX;
  if (link.kind === 'tool' && link.id) {
    // DeviceDetailsScreen reads route.params.deviceId.
    return { name: 'DeviceDetails', params: { deviceId: link.id } };
  }
  if (link.kind === 'transfer' || link.kind === 'tool_transfer') {
    // The dashboard shows the pending-transfers modal (accept/decline). For
    // the sender's accepted/declined/expired updates it's a neutral landing.
    return { name: 'MainTabs', params: { screen: 'dashboard' } };
  }
  if (link.kind === 'join_request' && opts.isAdminOrOwner) {
    return { name: 'Members' };
  }
  return INBOX;
}

export function navigateToLink(link: NotificationLinkLike, opts: { isAdminOrOwner: boolean }): boolean {
  if (!navigationRef.isReady()) return false;
  const route = routeForLink(link, opts);
  navigationRef.navigate(route.name as any, route.params as any);
  return true;
}
