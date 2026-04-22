// Adapters that convert new /api/v1/ schema types to the legacy shapes still
// consumed by screens that haven't been fully rewritten. Delete these when the
// last consumer of a legacy shape is gone (Phase 8).

import type {
  AssignmentRead,
  IncidentRead,
  SiteRead,
  ToolRead,
} from './types';

export interface LegacyAssignment {
  id: number;
  uuid: string;
  user_name: string;
  location_name: string;
  device: {
    id: number;
    identifier: string;
    device_type: string;
    make: string;
    model: string;
    serial_number: string;
    status: string;
    current_assignment?: { id: number };
  };
  user: string;
  user_id: number | null;
  location: { id: number; name: string } | null;
  assigned_date: string | null;
  returned_date: string | null;
  status: string;
  condition: string;
  notes: string;
}

export function toLegacyAssignment(a: AssignmentRead): LegacyAssignment {
  return {
    id: a.id,
    uuid: a.uuid,
    user_name: a.assignee_user_email ?? '',
    location_name: a.assignee_site_name ?? '',
    device: {
      id: a.tool_id,
      identifier: a.tool_name,
      device_type: '',
      make: '',
      model: '',
      serial_number: '',
      status: a.status ?? 'active',
      current_assignment: { id: a.id },
    },
    user: a.assignee_user_email ?? '',
    user_id: a.assignee_user_id ?? null,
    location:
      a.assignee_site_id != null
        ? { id: a.assignee_site_id, name: a.assignee_site_name ?? '' }
        : null,
    assigned_date: a.assigned_at ?? null,
    returned_date: a.returned_at ?? null,
    status: a.status ?? 'active',
    condition: a.condition ?? '',
    notes: a.notes ?? '',
  };
}

export interface LegacyDevice {
  id: number;
  identifier: string;
  device_type: string;
  make: string;
  model: string;
  serial_number: string;
  status: string;
  nfc_tag_id: string | null;
}

export function toLegacyDevice(t: ToolRead): LegacyDevice {
  return {
    id: t.id,
    identifier: t.name,
    device_type: t.category_name ?? '',
    make: t.make ?? '',
    model: t.model ?? '',
    serial_number: t.serial_number ?? '',
    status: t.status ?? '',
    nfc_tag_id: t.nfc_tag_id ?? null,
  };
}

export interface LegacyLocation {
  id: number;
  name: string;
  site_type: string;
  status: string;
  // Address fields kept for screens that still read the old shape. street_number
  // is empty because the new API keeps address_line1 as a single string.
  building_name: string;
  street_number: string;
  street_name: string;
  address_2: string;
  town_or_city: string;
  county: string;
  postcode: string;
  is_active: boolean;
}

export function toLegacyLocation(s: SiteRead): LegacyLocation {
  return {
    id: s.id,
    name: s.name,
    site_type: s.site_type,
    status: s.status,
    building_name: s.nickname ?? '',
    street_number: '',
    street_name: s.address_line1 ?? '',
    address_2: s.description ?? '',
    town_or_city: s.city ?? '',
    county: '',
    postcode: s.postcode ?? '',
    is_active: s.status === 'active',
  };
}

export interface LegacyReport {
  id: number;
  uuid: string;
  type: string;
  severity: string;
  status: string;
  description: string;
  device_id: number;
  device_name: string;
  location_id: number | null;
  location_name: string;
  created_at: string;
}

export function toLegacyReport(i: IncidentRead): LegacyReport {
  return {
    id: i.id,
    uuid: i.uuid,
    type: i.type,
    severity: i.severity,
    status: i.status,
    description: i.description,
    device_id: i.tool_id,
    device_name: i.tool_name,
    location_id: i.site_id ?? null,
    location_name: i.site_name ?? '',
    created_at: i.created_at,
  };
}
