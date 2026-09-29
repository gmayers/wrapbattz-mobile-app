import React from 'react';
import { render, act, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
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

const mockNav = { goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn(), canGoBack: () => true };
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNav,
  useRoute: () => ({ params: { tagUID: 'ABC123' } }),
}));

const mockAuth: any = { isAdminOrOwner: false, user: { id: 1, email: 'test@example.com' } };
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

  describe('as admin', () => {
    beforeEach(() => {
      mockAuth.isAdminOrOwner = true;
      (assignmentsApi.listMyActiveAssignments as jest.Mock).mockResolvedValue([]);
      (toolsApi.getToolHistory as jest.Mock).mockResolvedValue({ items: [] });
      (toolsApi.getToolByNfc as jest.Mock).mockResolvedValue({
        id: 42, name: 'DRILL-1', is_available: true,
      });
    });
    afterEach(() => { mockAuth.isAdminOrOwner = false; });

    it('Assign tool actually assigns the tool instead of just opening details', async () => {
      (toolsApi.assignToolToMe as jest.Mock).mockResolvedValue({ id: 7, tool_id: 42 });
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      const { findByTestId } = render(<QuickActionModalScreen />);
      const btn = await findByTestId('quick-action-assign');
      await act(async () => { fireEvent.press(btn); });

      expect(toolsApi.assignToolToMe).toHaveBeenCalledWith(42);
      expect(mockNav.replace).not.toHaveBeenCalled();
      expect(alertSpy).toHaveBeenCalledWith('Assigned', expect.any(String), expect.anything());
      alertSpy.mockRestore();
    });

    it('surfaces an assign failure instead of failing silently', async () => {
      (toolsApi.assignToolToMe as jest.Mock).mockRejectedValue(new Error('Tool is already assigned'));
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      const { findByTestId } = render(<QuickActionModalScreen />);
      const btn = await findByTestId('quick-action-assign');
      await act(async () => { fireEvent.press(btn); });

      expect(alertSpy).toHaveBeenCalledWith('Assign failed', 'Tool is already assigned');
      alertSpy.mockRestore();
    });
  });
});
