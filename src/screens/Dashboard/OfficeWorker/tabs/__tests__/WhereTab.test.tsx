import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import WhereTab from '../WhereTab';
import type { LocationItem } from '../../types';

const sampleLocations: LocationItem[] = [
  { id: 1, kind: 'site',     name: 'Chelsea Wharf',  code: 'CHW-04', toolCount: 8, workerInitials: ['MJ'] },
  { id: 2, kind: 'vehicle',  name: 'Transit Van 02', code: 'VAN-02', toolCount: 4, workerInitials: ['DT'] },
  { id: 3, kind: 'toolbox',  name: 'Toolbox A (HQ)', code: 'TB-A',   toolCount: 6, workerInitials: [] },
];

describe('WhereTab', () => {
  it('shows all locations when filter is "all"', () => {
    render(<WhereTab locations={sampleLocations} totalToolsPlaced={18} pendingApprovals={null} returnsDue={null} onLocationPress={() => {}} onReview={() => {}} />);
    expect(screen.getByText('Chelsea Wharf')).toBeTruthy();
    expect(screen.getByText('Transit Van 02')).toBeTruthy();
    expect(screen.getByText('Toolbox A (HQ)')).toBeTruthy();
  });

  it('filters to vehicles when Vehicles chip pressed', () => {
    render(<WhereTab locations={sampleLocations} totalToolsPlaced={18} pendingApprovals={null} returnsDue={null} onLocationPress={() => {}} onReview={() => {}} />);
    fireEvent.press(screen.getByLabelText('Vehicles filter'));
    expect(screen.getByText('Transit Van 02')).toBeTruthy();
    expect(screen.queryByText('Chelsea Wharf')).toBeNull();
    expect(screen.queryByText('Toolbox A (HQ)')).toBeNull();
  });

  it('renders empty copy when no locations match', () => {
    render(<WhereTab locations={[]} totalToolsPlaced={0} pendingApprovals={null} returnsDue={null} onLocationPress={() => {}} onReview={() => {}} />);
    expect(screen.getByText('No locations yet')).toBeTruthy();
  });

  it('passes location id through to onLocationPress', () => {
    const onLocationPress = jest.fn();
    render(<WhereTab locations={sampleLocations} totalToolsPlaced={18} pendingApprovals={null} returnsDue={null} onLocationPress={onLocationPress} onReview={() => {}} />);
    fireEvent.press(screen.getByLabelText('Chelsea Wharf, 8 tools'));
    expect(onLocationPress).toHaveBeenCalledWith(sampleLocations[0]);
  });
});
