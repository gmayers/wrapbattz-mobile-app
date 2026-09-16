import React from 'react';
import { render, act } from '@testing-library/react-native';
import { members as membersApi } from '../../../api/endpoints';
import * as invitationsApi from '../../../api/endpoints/invitations';
import MembersScreen from '../MembersScreen';

jest.mock('../../../api/endpoints', () => ({
  members: { listMembers: jest.fn(), updateMember: jest.fn(), removeMember: jest.fn() },
}));
jest.mock('../../../api/endpoints/invitations', () => ({
  listInvitations: jest.fn(),
  createInvitation: jest.fn(),
  deleteInvitation: jest.fn(),
  resendInvitation: jest.fn(),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn(), navigate: jest.fn() }),
}));

const mockAuth = {
  isAdminOrOwner: true,
  isOwner: true,
  userData: { role: 'owner' },
  user: { id: 1, email: 'owner@example.com' },
};
jest.mock('../../../context/AuthContext', () => ({
  useAuth: () => mockAuth,
}));

const mockTheme = { colors: new Proxy({}, { get: () => '#000000' }) };
jest.mock('../../../context/ThemeContext', () => ({
  useTheme: () => mockTheme,
}));

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: View };
});

jest.mock('../InviteMemberSheet', () => () => null);

describe('MembersScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (membersApi.listMembers as jest.Mock).mockResolvedValue({ items: [] });
    (invitationsApi.listInvitations as jest.Mock).mockResolvedValue({
      items: [],
      total_pages: 1,
    });
  });

  it('asks the server for pending invitations only, within the 100 page-size clamp', async () => {
    render(<MembersScreen />);
    await act(async () => {});

    expect(invitationsApi.listInvitations).toHaveBeenCalledWith({
      status: 'pending',
      page: 1,
      page_size: 100,
    });
  });
});
