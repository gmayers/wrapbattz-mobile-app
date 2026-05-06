import React from 'react';
import { render, screen } from '@testing-library/react-native';
import InitialsChipStack from '../InitialsChipStack';

describe('InitialsChipStack', () => {
  it('renders up to 3 chips', () => {
    render(<InitialsChipStack initials={['MJ', 'SW', 'LG']} />);
    expect(screen.getByText('MJ')).toBeTruthy();
    expect(screen.getByText('SW')).toBeTruthy();
    expect(screen.getByText('LG')).toBeTruthy();
    expect(screen.queryByText(/^\+\d+$/)).toBeNull();
  });

  it('renders +N overflow when more than 3', () => {
    render(<InitialsChipStack initials={['MJ', 'SW', 'LG', 'DT', 'WJ']} />);
    expect(screen.getByText('+2')).toBeTruthy();
  });

  it('renders nothing when array empty', () => {
    const { toJSON } = render(<InitialsChipStack initials={[]} />);
    expect(toJSON()).toBeNull();
  });
});
