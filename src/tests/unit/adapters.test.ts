import { toLegacyDevice } from '@/api/adapters';

describe('toLegacyDevice lifecycle fields', () => {
  const base = {
    id: 1, uuid: 'u', name: 'Drill', make: 'M', model: 'X',
    serial_number: 's', category_id: null, category_name: '',
    nfc_tag_id: null, status: 'available', status_label: 'Available',
    is_available: true,
  } as any;

  it('passes through lifecycle fields when present', () => {
    const d = toLegacyDevice({
      ...base,
      maintenance_interval_days: 90,
      next_maintenance_date: '2026-10-01',
      condition_score: '8.0',
      warranty_expiry: '2027-01-01',
      purchase_date: '2025-05-10',
      purchase_cost: '199.99',
    });
    expect(d.maintenance_interval).toBe(90);
    expect(d.next_maintenance_date).toBe('2026-10-01');
    expect(d.condition_score).toBe('8.0');
    expect(d.warranty_expiry).toBe('2027-01-01');
    expect(d.purchase_date).toBe('2025-05-10');
    expect(d.purchase_cost).toBe('199.99');
  });

  it('defaults lifecycle fields to null when the API omits them', () => {
    const d = toLegacyDevice(base);
    expect(d.maintenance_interval).toBeNull();
    expect(d.next_maintenance_date).toBeNull();
    expect(d.condition_score).toBeNull();
    expect(d.warranty_expiry).toBeNull();
    expect(d.purchase_date).toBeNull();
    expect(d.purchase_cost).toBeNull();
  });
});
