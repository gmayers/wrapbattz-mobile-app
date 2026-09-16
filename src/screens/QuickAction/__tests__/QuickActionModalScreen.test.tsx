import React from 'react';
import { render, act } from '@testing-library/react-native';
import {
  assignments as assignmentsApi,
  tools as toolsApi,
} from '../../../api/endpoints';
import QuickActionModalScreen from '../QuickActionModalScreen';

jest.mock('../../../api/endpoints', () => ({
  assignments: {
    listMyActiveAssignments: jest.fn(),
    returnAssignment: jest.fn(),
  },
  sites: { listSites: jest.fn() },
  tools: {
    getToolByNfc: jest.fn(),
    getToolHistory: jest.fn(),
    assignToolToMe: jest.fn(),
  },
  vans: { listVans: jest.fn() },
}));

jest.mock('react-native-nfc-manager', () => ({
  __esModule: true,
  default: { cancelTechnologyRequest: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn(), navigate: jest.fn() }),
  useRoute: () => ({ params: { tagUID: 'ABC123' } }),
}));

const mockAuth = { isAdminOrOwner: false, user: { id: 1, email: 'test@example.com' } };
jest.mock('../../../context/AuthContext', () => ({
  useAuth: () => mockAuth,
}));

const mockTheme = { colors: new Proxy({}, { get: () => '#000000' }) };
jest.mock('../../../context/ThemeContext', () => ({
  useTheme: () => mockTheme,
}));

describe('QuickActionModalScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('looks up the tool and my active assignments in parallel on scan', async () => {
    // getToolByNfc never resolves: the assignments lookup must not wait on it.
    (toolsApi.getToolByNfc as jest.Mock).mockReturnValue(new Promise(() => {}));
    (assignmentsApi.listMyActiveAssignments as jest.Mock).mockResolvedValue([]);
    (toolsApi.getToolHistory as jest.Mock).mockResolvedValue({ items: [] });

    render(<QuickActionModalScreen />);
    await act(async () => {});

    expect(toolsApi.getToolByNfc).toHaveBeenCalledWith('ABC123');
    expect(assignmentsApi.listMyActiveAssignments).toHaveBeenCalledTimes(1);
  });
});
