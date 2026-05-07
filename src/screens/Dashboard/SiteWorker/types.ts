import type { Ionicons } from '@expo/vector-icons';
import type { ActionKind } from '../shared/actionColours';

export type ActionRowKind = 'overdue' | 'due_today' | 'flagged' | 'eod';

export interface ActionRow {
  id: string;
  kind: ActionRowKind;
  iconName: keyof typeof Ionicons.glyphMap;
  iconTint?: string;
  primary: string;
  secondary: string;
  cta: { kind: ActionKind; label: string };
  payload: { assignmentId?: number; incidentId?: number; toolId?: number; vanId?: number };
}

export interface SiteWorkerData {
  isLoading: boolean;
  error?: string;
  refresh: () => void;

  organizationName: string;
  siteTagline: string;
  userInitials: string;
  hasUnreadAlerts: boolean | null;

  checkedOut: number;
  returnedToday: number;
  overdueCount: number;

  rows: ActionRow[];
}
