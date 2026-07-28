import React from 'react';
import { render, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { sites as sitesApi } from '../../api/endpoints';
import LocationsScreen from '../LocationsScreen';

jest.mock('../../api/endpoints', () => ({
  sites: {
    listSites: jest.fn(),
    createSite: jest.fn(),
    updateSite: jest.fn(),
  },
}));

const mockAuth = {
  isAdminOrOwner: true,
  userData: { role: 'owner' },
  user: { first_name: 'Test', email: 'owner@example.com' },
};
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => mockAuth,
}));

const mockTheme = { colors: new Proxy({}, { get: () => '#000000' }) };
jest.mock('../../context/ThemeContext', () => ({
  useTheme: () => mockTheme,
}));

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: View };
});

function makeNavigation() {
  const listeners = {};
  return {
    navigation: {
      setOptions: jest.fn(),
      navigate: jest.fn(),
      addListener: jest.fn((event, cb) => {
        listeners[event] = cb;
        return () => delete listeners[event];
      }),
    },
    fireFocus: () => listeners.focus?.(),
  };
}

const site = (id, name) => ({
  id,
  name,
  site_type: 'office',
  status: 'active',
  nickname: name,
  address_line1: `${id} Test Street`,
  description: '',
  city: 'London',
  postcode: 'E1 1AA',
});

function renderScreen(navigation) {
  // gcTime Infinity: no GC timers, so Jest can exit cleanly.
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0, gcTime: Infinity } },
  });
  return render(
    <QueryClientProvider client={client}>
      <LocationsScreen navigation={navigation} />
    </QueryClientProvider>
  );
}

describe('LocationsScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('keeps showing the loaded list while a focus refetch is in flight', async () => {
    sitesApi.listSites.mockResolvedValueOnce({ items: [site(1, 'Head Office')] });
    const { navigation, fireFocus } = makeNavigation();
    const screen = renderScreen(navigation);

    expect(await screen.findByText(/Head Office/)).toBeTruthy();
    expect(sitesApi.listSites).toHaveBeenCalledTimes(1);

    // Second focus: the refetch hangs — the list must NOT blank to a spinner.
    sitesApi.listSites.mockReturnValue(new Promise(() => {}));
    await act(async () => {
      fireFocus();
    });
    expect(screen.getByText(/Head Office/)).toBeTruthy();
  });
});
