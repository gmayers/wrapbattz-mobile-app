// The deployed backend accepts filters/pagination the committed spec lagged
// on: incidents take status/severity/tool/site + page/page_size (also on
// /mine/), members/sites/assignments take page/page_size, and invitations
// take a status filter. page_size is clamped to 100 server-side.
import { apiClient } from '../../client';
import * as incidents from '../incidents';
import * as invitations from '../invitations';
import * as members from '../members';
import * as sites from '../sites';
import * as assignments from '../assignments';

jest.mock('../../client', () => ({
  apiClient: { get: jest.fn() },
}));

const page = { items: [], total: 0, total_pages: 1 };

describe('list endpoint params', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (apiClient.get as jest.Mock).mockResolvedValue({ data: page });
  });

  it('listIncidents passes filters and pagination', async () => {
    await incidents.listIncidents({ tool: 7, status: 'pending', page: 2, page_size: 50 });
    expect(apiClient.get).toHaveBeenCalledWith('/incidents/', {
      params: { tool: 7, status: 'pending', page: 2, page_size: 50 },
    });
  });

  it('listMyIncidents passes filters and pagination', async () => {
    await incidents.listMyIncidents({ severity: 'critical', page: 1 });
    expect(apiClient.get).toHaveBeenCalledWith('/incidents/mine/', {
      params: { severity: 'critical', page: 1 },
    });
  });

  it('listInvitations passes a status filter', async () => {
    await invitations.listInvitations({ status: 'pending', page: 1, page_size: 100 });
    expect(apiClient.get).toHaveBeenCalledWith('/invitations/', {
      params: { status: 'pending', page: 1, page_size: 100 },
    });
  });

  it('listMembers passes pagination', async () => {
    await members.listMembers({ page: 3, page_size: 100 });
    expect(apiClient.get).toHaveBeenCalledWith('/members/', {
      params: { page: 3, page_size: 100 },
    });
  });

  it('listSites passes pagination alongside existing filters', async () => {
    await sites.listSites({ status: 'active', page: 2, page_size: 100 });
    expect(apiClient.get).toHaveBeenCalledWith('/sites/', {
      params: { status: 'active', page: 2, page_size: 100 },
    });
  });

  it('listAssignments passes pagination alongside existing filters', async () => {
    await assignments.listAssignments({ status: 'active', page: 2, page_size: 100 });
    expect(apiClient.get).toHaveBeenCalledWith('/assignments/', {
      params: { status: 'active', page: 2, page_size: 100 },
    });
  });
});
