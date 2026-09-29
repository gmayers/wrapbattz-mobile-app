import React from 'react';
import { render, act, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import {
  assignments as assignmentsApi,
  sites as sitesApi,
  tools as toolsApi,
} from '../../../api/endpoints';
import { ApiError } from '../../../api/errors';
import QuickActionModalScreen from '../QuickActionModalScreen';

jest.mock('../../../api/endpoints', () => ({
  assignments: {
    listMyActiveAssignments: jest.fn(),
    returnAssignment: jest.fn(),
  },
  sites: { listSites: jest.fn(), listSitesForTool: jest.fn() },
  tools: {
    getToolByNfc: jest.fn(),
    getToolHistory: jest.fn(),
    assignToolToMe: jest.fn(),
    requestTool: jest.fn(),
  },
  vans: { listVans: jest.fn() },
}));

const mockDropdowns: any[] = [];
jest.mock('../../../components/Dropdown', () => (props: any) => {
  mockDropdowns.push(props);
  return null;
});

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

  describe('returning to the home site', () => {
    const HOME = { id: 5, name: 'Leeds Yard', site_type: 'warehouse', is_home: true };
    const OTHER = { id: 6, name: 'Van 2', site_type: 'vehicle', is_home: false };
    const toolWithHome = { id: 42, name: 'DRILL-1', is_available: false, home_site_id: 5, home_site_name: 'Leeds Yard' };
    let alertSpy: jest.SpyInstance;

    beforeEach(() => {
      mockDropdowns.length = 0;
      alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      (assignmentsApi.listMyActiveAssignments as jest.Mock).mockResolvedValue([{ id: 9, tool_id: 42 }]);
      (toolsApi.getToolHistory as jest.Mock).mockResolvedValue({ items: [] });
      (toolsApi.getToolByNfc as jest.Mock).mockResolvedValue(toolWithHome);
      (sitesApi.listSitesForTool as jest.Mock).mockResolvedValue({ items: [HOME, OTHER] });
      (assignmentsApi.returnAssignment as jest.Mock).mockResolvedValue({});
    });
    afterEach(() => {
      mockAuth.isAdminOrOwner = false;
      alertSpy.mockRestore();
    });

    const openReturn = async (screen: ReturnType<typeof render>) => {
      const returnBtn = await screen.findByTestId('quick-action-return');
      await act(async () => { fireEvent.press(returnBtn); });
    };
    const confirm = async (screen: ReturnType<typeof render>) => {
      await act(async () => { fireEvent.press(screen.getByTestId('quick-action-confirm-return')); });
    };
    const openAndConfirm = async (screen: ReturnType<typeof render>) => {
      await openReturn(screen);
      await confirm(screen);
    };

    it('a worker gets no picker and the tool goes to its home site', async () => {
      const screen = render(<QuickActionModalScreen />);
      await openReturn(screen);
      expect(screen.getByTestId('quick-action-return-home').props.children).toEqual(
        ['🏠 Returns to ', 'Leeds Yard']
      );
      await confirm(screen);

      expect(sitesApi.listSitesForTool).not.toHaveBeenCalled();
      expect(mockDropdowns.find((p) => p.testID === 'quick-action-return-destination')).toBeUndefined();
      expect(assignmentsApi.returnAssignment).toHaveBeenCalledWith(9, { target_site_id: 5, condition: '', notes: '' });
    });

    it('an admin gets a picker with the home site pre-selected and can pick another', async () => {
      mockAuth.isAdminOrOwner = true;
      const screen = render(<QuickActionModalScreen />);
      const target = await screen.findByTestId('quick-action-return');
      await act(async () => { fireEvent.press(target); });

      const picker = () => mockDropdowns.filter((p) => p.testID === 'quick-action-return-destination').pop();
      expect(picker().value).toBe('5');
      expect(picker().items).toEqual([
        { label: '🏠 Leeds Yard (home)', value: '5' },
        { label: '🚐 Van 2', value: '6' },
      ]);
      await act(async () => { picker().onValueChange('6'); });
      await act(async () => { fireEvent.press(screen.getByTestId('quick-action-confirm-return')); });
      expect(assignmentsApi.returnAssignment).toHaveBeenCalledWith(9, { target_site_id: 6, condition: '', notes: '' });
    });

    it('a tool without a home site says so and sends no target', async () => {
      (toolsApi.getToolByNfc as jest.Mock).mockResolvedValue({ ...toolWithHome, home_site_id: null, home_site_name: '' });
      const screen = render(<QuickActionModalScreen />);
      await openReturn(screen);
      expect(screen.getByTestId('quick-action-return-no-home')).toBeTruthy();
      await confirm(screen);

      expect(assignmentsApi.returnAssignment).toHaveBeenCalledWith(9, { target_site_id: null, condition: '', notes: '' });
    });

    it('shows the backend refusal when a return is not allowed', async () => {
      (assignmentsApi.returnAssignment as jest.Mock).mockRejectedValue(
        new ApiError({ code: 'forbidden', status: 403, message: 'DRILL-1 must be returned to its home site, Leeds Yard.' })
      );
      const screen = render(<QuickActionModalScreen />);
      await openAndConfirm(screen);
      expect(alertSpy).toHaveBeenCalledWith('Return failed', 'DRILL-1 must be returned to its home site, Leeds Yard.');
    });
  });

  describe('requesting a tool someone else holds', () => {
    let alertSpy: jest.SpyInstance;
    beforeEach(() => {
      alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      (assignmentsApi.listMyActiveAssignments as jest.Mock).mockResolvedValue([]);
      (toolsApi.getToolByNfc as jest.Mock).mockResolvedValue({ id: 42, name: 'DRILL-1', is_available: false });
      (toolsApi.getToolHistory as jest.Mock).mockResolvedValue({
        items: [{ status: 'active', returned_at: null, assignee_user_id: 2, assignee_user_email: 'alex@example.com', assigned_at: '2026-09-01' }],
      });
    });
    afterEach(() => alertSpy.mockRestore());

    it('sends a claim and tells the user the holder must confirm', async () => {
      (toolsApi.requestTool as jest.Mock).mockResolvedValue({ id: 3, status: 'pending' });
      const screen = render(<QuickActionModalScreen />);
      const target = await screen.findByTestId('quick-action-request');
      await act(async () => { fireEvent.press(target); });

      expect(toolsApi.requestTool).toHaveBeenCalledWith(42, { message: '' });
      expect(alertSpy).toHaveBeenCalledWith('Request sent', expect.stringContaining('alex@example.com will be asked to confirm'));
    });

    it('is not offered for a tool nobody else holds', async () => {
      (toolsApi.getToolHistory as jest.Mock).mockResolvedValue({ items: [] });
      const screen = render(<QuickActionModalScreen />);
      await screen.findByTestId('quick-action-buttons');
      await act(async () => {});
      expect(screen.queryByTestId('quick-action-request')).toBeNull();
    });
  });
});
