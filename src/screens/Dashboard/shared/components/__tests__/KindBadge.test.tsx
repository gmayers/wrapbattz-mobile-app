import React from 'react';
import { render, screen } from '@testing-library/react-native';
import KindBadge from '../KindBadge';

describe('KindBadge', () => {
  it('renders SITE label and icon for kind=site', () => {
    render(<KindBadge kind="site" />);
    expect(screen.getByText('SITE')).toBeTruthy();
  });
  it('renders VEHICLE for kind=vehicle', () => {
    render(<KindBadge kind="vehicle" />);
    expect(screen.getByText('VEHICLE')).toBeTruthy();
  });
  it('renders TOOLBOX for kind=toolbox', () => {
    render(<KindBadge kind="toolbox" />);
    expect(screen.getByText('TOOLBOX')).toBeTruthy();
  });
});
