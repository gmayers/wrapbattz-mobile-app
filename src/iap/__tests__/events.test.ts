import { iapEvents } from '../events';

describe('iapEvents', () => {
  it('delivers events to subscribers', () => {
    const heard: any[] = [];
    const off = iapEvents.on('purchase.success', (p) => heard.push(p));
    iapEvents.emit('purchase.success', { tierId: 'pro_monthly' });
    expect(heard).toEqual([{ tierId: 'pro_monthly' }]);
    off();
  });

  it('unsubscribes correctly', () => {
    const heard: any[] = [];
    const off = iapEvents.on('purchase.success', (p) => heard.push(p));
    off();
    iapEvents.emit('purchase.success', { tierId: 'x' });
    expect(heard).toEqual([]);
  });
});
