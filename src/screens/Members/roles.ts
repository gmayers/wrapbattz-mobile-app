export type Role = 'owner' | 'admin' | 'office_worker' | 'site_worker';

export const ROLE_LABEL: Record<Role, string> = {
  owner: 'Owner',
  admin: 'Admin',
  office_worker: 'Office worker',
  site_worker: 'Site worker',
};
