import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import TeamRosterTab from '../TeamRosterTab';
import type { MemberRow } from '../../types';

const members: MemberRow[] = [
  { memberId: 200, initials: 'WJ', name: 'Wendy Jones',     metaPrimary: 'CHW-04 · Site lead', toolCount: 3 },
  { memberId: 201, initials: 'SW', name: 'Sylvia Williams', metaPrimary: 'CHW-04 · Foreman',   toolCount: 2 },
];

describe('TeamRosterTab', () => {
  it('renders WHO HAS WHAT and member rows', () => {
    render(<TeamRosterTab members={members} totalMembers={2} totalToolsOut={5} onSite={1} hq={1} onMemberPress={() => {}} />);
    expect(screen.getByText('WHO HAS WHAT')).toBeTruthy();
    expect(screen.getByText('Wendy Jones')).toBeTruthy();
    expect(screen.getByText('Sylvia Williams')).toBeTruthy();
  });

  it('renders empty copy when no members', () => {
    render(<TeamRosterTab members={[]} totalMembers={0} totalToolsOut={0} onSite={null} hq={null} onMemberPress={() => {}} />);
    expect(screen.getByText('No teammates yet')).toBeTruthy();
  });

  it('passes memberId through to onMemberPress', () => {
    const onMemberPress = jest.fn();
    render(<TeamRosterTab members={members} totalMembers={2} totalToolsOut={5} onSite={1} hq={1} onMemberPress={onMemberPress} />);
    fireEvent.press(screen.getByLabelText('View Wendy Jones'));
    expect(onMemberPress).toHaveBeenCalledWith(200);
  });
});
