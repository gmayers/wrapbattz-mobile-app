import React from 'react';
import { render, screen } from '@testing-library/react-native';
import StatsRow from '../StatsRow';

describe('StatsRow', () => {
  it('renders three stat blocks', () => {
    render(<StatsRow stats={[
      { label: 'ON SITE', value: 3 },
      { label: 'HQ',      value: 1 },
      { label: 'TOOLS OUT', value: 8 },
    ]} />);
    expect(screen.getByText('ON SITE')).toBeTruthy();
    expect(screen.getByText('HQ')).toBeTruthy();
    expect(screen.getByText('TOOLS OUT')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('8')).toBeTruthy();
  });
  it('renders em-dash for null values', () => {
    render(<StatsRow stats={[{ label: 'ON SITE', value: null }]} />);
    expect(screen.getByText('—')).toBeTruthy();
  });
});
