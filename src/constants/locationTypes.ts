// Location (Site) types — mirrors the backend `SiteType` choices in
// sites/models.py. Used by the create-location form (LocationsScreen) and the
// onboarding wizard's Location step so both offer the same options.
export interface LocationTypeOption {
  label: string;
  value: string;
  key: string;
}

export const LOCATION_TYPE_OTHER = 'other';

export const LOCATION_TYPES: LocationTypeOption[] = [
  { label: 'Office', value: 'office', key: 'lt-office' },
  { label: 'Warehouse', value: 'warehouse', key: 'lt-warehouse' },
  { label: 'Project Site', value: 'project_site', key: 'lt-project_site' },
  { label: 'Vehicle', value: 'vehicle', key: 'lt-vehicle' },
  { label: 'Stockyard', value: 'stockyard', key: 'lt-stockyard' },
  { label: 'Other', value: LOCATION_TYPE_OTHER, key: 'lt-other' },
];

export const DEFAULT_LOCATION_TYPE = 'office';
