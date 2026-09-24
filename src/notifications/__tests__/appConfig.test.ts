import appJson from '../../../app.json';

describe('app.json notification config', () => {
  const expo: any = (appJson as any).expo;

  it('registers the expo-notifications plugin with the default channel', () => {
    const entry = expo.plugins.find(
      (p: any) => (Array.isArray(p) ? p[0] : p) === 'expo-notifications'
    );
    expect(entry).toBeDefined();
    expect(entry[1]).toMatchObject({ defaultChannel: 'default' });
  });

  it('declares the Android 13 notification permission and FCM config', () => {
    expect(expo.android.permissions).toContain('android.permission.POST_NOTIFICATIONS');
    expect(expo.android.googleServicesFile).toBe('./google-services.json');
  });
});
