import React from 'react';
import { render, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { incidents as incidentsApi } from '../../api/endpoints';
import ReportsScreen from '../ReportsScreen';

jest.mock('../../api/endpoints', () => ({
  incidents: { listMyIncidents: jest.fn() },
}));

const mockRefreshUser = jest.fn();
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    userData: { role: 'site_worker' },
    user: { first_name: 'Test', email: 'test@example.com' },
    refreshUser: mockRefreshUser,
  }),
}));

jest.mock('../../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: new Proxy({}, { get: () => '#000000' }),
    isDark: false,
  }),
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

function renderScreen(navigation) {
  // gcTime Infinity: no GC timers, so Jest can exit cleanly.
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0, gcTime: Infinity } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ReportsScreen navigation={navigation} />
    </QueryClientProvider>
  );
}

const incident = (id, status) => ({
  id,
  uuid: `u-${id}`,
  type: 'DAMAGED',
  severity: 'low',
  status,
  description: `incident ${id}`,
  tool_id: 1,
  tool_name: 'Drill',
  site_id: null,
  site_name: null,
  created_at: '2026-07-01T00:00:00Z',
});

describe('ReportsScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('keeps showing loaded reports while a focus refetch is in flight', async () => {
    incidentsApi.listMyIncidents.mockResolvedValueOnce({
      items: [incident(1, 'pending')],
    });
    const { navigation, fireFocus } = makeNavigation();
    const screen = renderScreen(navigation);
    expect(await screen.findByText(/incident 1/)).toBeTruthy();

    // Second focus: the refetch hangs — the list must NOT blank to a spinner.
    incidentsApi.listMyIncidents.mockReturnValue(new Promise(() => {}));
    await act(async () => {
      fireFocus();
    });
    expect(screen.getByText(/incident 1/)).toBeTruthy();
  });

  it('ignores focus events while a fetch is already in flight', async () => {
    let resolveFetch;
    incidentsApi.listMyIncidents.mockImplementation(
      () => new Promise((r) => { resolveFetch = r; }),
    );
    const { navigation, fireFocus } = makeNavigation();
    renderScreen(navigation);

    // Rapid tab switching: three focus events before the first fetch resolves.
    await act(async () => {
      fireFocus();
      fireFocus();
      fireFocus();
    });
    expect(incidentsApi.listMyIncidents).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFetch({ items: [] });
    });

    // A focus after the fetch settles should refetch normally.
    await act(async () => {
      fireFocus();
    });
    expect(incidentsApi.listMyIncidents).toHaveBeenCalledTimes(2);
  });

  it('does not refetch the account on mount (bootstrap already has it)', async () => {
    incidentsApi.listMyIncidents.mockResolvedValue({ items: [] });
    const { navigation } = makeNavigation();
    renderScreen(navigation);
    await act(async () => {});
    expect(mockRefreshUser).not.toHaveBeenCalled();
  });
});
